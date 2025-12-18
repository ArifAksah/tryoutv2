BEGIN;

-- UUID generator (best-effort)
DO $$
BEGIN
  BEGIN
    EXECUTE 'create extension if not exists pgcrypto with schema extensions';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Add a stable slug to exam_packages so we can have multiple named tryouts (e.g. "tryout-akbar-skd-1").
ALTER TABLE public.exam_packages
  ADD COLUMN IF NOT EXISTS slug text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_packages_slug_key'
  ) THEN
    ALTER TABLE public.exam_packages
      ADD CONSTRAINT exam_packages_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Blueprint for custom tryouts (package -> categories/subtopics + per-category quota)
CREATE TABLE IF NOT EXISTS public.exam_package_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.exam_packages(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  question_count int NOT NULL CHECK (question_count > 0),
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (package_id, category_id)
);

CREATE INDEX IF NOT EXISTS exam_package_blueprints_package_idx ON public.exam_package_blueprints(package_id);
CREATE INDEX IF NOT EXISTS exam_package_blueprints_category_idx ON public.exam_package_blueprints(category_id);

ALTER TABLE public.exam_package_blueprints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename='exam_package_blueprints'
      AND policyname='Authenticated read exam_package_blueprints'
  ) THEN
    CREATE POLICY "Authenticated read exam_package_blueprints" ON public.exam_package_blueprints
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename='exam_package_blueprints'
      AND policyname='Admin write exam_package_blueprints'
  ) THEN
    CREATE POLICY "Admin write exam_package_blueprints" ON public.exam_package_blueprints
      FOR ALL
      USING (exists (select 1 from public.admin_users where user_id = auth.uid()))
      WITH CHECK (exists (select 1 from public.admin_users where user_id = auth.uid()));
  END IF;
END $$;

-- Start: custom tryout package (blueprint-driven)
DROP FUNCTION IF EXISTS public.start_package_tryout(text, int) CASCADE;

CREATE FUNCTION public.start_package_tryout(
  p_package_slug text,
  p_duration_minutes int DEFAULT NULL,
  -- OUT parameters (avoid RETURNS TABLE ambiguity)
  OUT o_session_id uuid,
  OUT o_started_at timestamptz,
  OUT o_duration_minutes int,
  OUT o_question_order int,
  OUT o_question_id uuid,
  OUT o_topic_slug text,
  OUT o_question_text text,
  OUT o_question_type public.question_type,
  OUT o_options jsonb
)
RETURNS SETOF record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  var_user_id uuid;
  var_slug text := lower(trim(p_package_slug));
  var_package_id uuid;
  var_package_duration int;
  var_session_id uuid;
  var_started_at timestamptz := now();
  var_duration int;
  var_used_questions uuid[] := '{}'::uuid[];
  var_order int := 0;
  bp record;
  rec record;
  var_available int;
BEGIN
  var_user_id := auth.uid();
  IF var_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, COALESCE(duration_minutes, 60)
  INTO var_package_id, var_package_duration
  FROM public.exam_packages
  WHERE slug = var_slug
    AND is_active = true
  ORDER BY inserted_at DESC
  LIMIT 1;

  IF var_package_id IS NULL THEN
    RAISE EXCEPTION 'Tryout package not found: %', var_slug;
  END IF;

  var_duration := GREATEST(1, COALESCE(p_duration_minutes, var_package_duration, 60));

  IF NOT EXISTS (
    SELECT 1
    FROM public.exam_package_blueprints b
    WHERE b.package_id = var_package_id
  ) THEN
    RAISE EXCEPTION 'Tryout package has no blueprints: %', var_slug;
  END IF;

  INSERT INTO public.user_exam_sessions (user_id, package_id, status, started_at)
  VALUES (var_user_id, var_package_id, 'started', var_started_at)
  RETURNING id INTO var_session_id;

  FOR bp IN
    SELECT
      b.category_id,
      b.question_count,
      c.slug AS category_slug
    FROM public.exam_package_blueprints b
    JOIN public.categories c ON c.id = b.category_id
    WHERE b.package_id = var_package_id
    ORDER BY b.inserted_at ASC
  LOOP
    WITH RECURSIVE cat_tree AS (
      SELECT bp.category_id AS cat_id
      UNION ALL
      SELECT c.id
      FROM public.categories c
      INNER JOIN cat_tree t ON c.parent_id = t.cat_id
    )
    SELECT count(*) INTO var_available
    FROM public.questions q
    WHERE q.category_id IN (SELECT cat_id FROM cat_tree)
      AND NOT (q.id = ANY(var_used_questions));

    IF var_available < bp.question_count THEN
      RAISE EXCEPTION 'Not enough questions for % (need %, have %)', bp.category_slug, bp.question_count, var_available;
    END IF;

    FOR rec IN
      WITH RECURSIVE cat_tree AS (
        SELECT bp.category_id AS cat_id
        UNION ALL
        SELECT c.id
        FROM public.categories c
        INNER JOIN cat_tree t ON c.parent_id = t.cat_id
      )
      SELECT
        q.id AS q_id,
        q.question_text AS q_text,
        q.question_type AS q_type,
        q.options AS q_opts,
        c.slug AS q_topic
      FROM public.questions q
      INNER JOIN public.categories c ON c.id = q.category_id
      WHERE q.category_id IN (SELECT cat_id FROM cat_tree)
        AND NOT (q.id = ANY(var_used_questions))
      ORDER BY random()
      LIMIT bp.question_count
    LOOP
      var_order := var_order + 1;
      var_used_questions := array_append(var_used_questions, rec.q_id);

      INSERT INTO public.user_answers (session_id, question_id)
      VALUES (var_session_id, rec.q_id)
      ON CONFLICT (session_id, question_id) DO NOTHING;

      o_session_id := var_session_id;
      o_started_at := var_started_at;
      o_duration_minutes := var_duration;
      o_question_order := var_order;
      o_question_id := rec.q_id;
      o_topic_slug := rec.q_topic;
      o_question_text := rec.q_text;
      o_question_type := rec.q_type;
      o_options := rec.q_opts;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_package_tryout(text, int) TO authenticated;

COMMIT;
