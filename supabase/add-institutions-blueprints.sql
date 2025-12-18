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

-- institutions
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  logo_url text,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- exam_blueprints
CREATE TABLE IF NOT EXISTS public.exam_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  question_count int NOT NULL CHECK (question_count > 0),
  passing_grade int,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (institution_id, category_id)
);

CREATE INDEX IF NOT EXISTS exam_blueprints_institution_idx ON public.exam_blueprints(institution_id);
CREATE INDEX IF NOT EXISTS exam_blueprints_category_idx ON public.exam_blueprints(category_id);

-- Helper RPC: pick random questions from a set of category_ids
-- NOTE: uses ORDER BY random() so it's VOLATILE.
CREATE OR REPLACE FUNCTION public.pick_random_questions(category_ids uuid[], take int)
RETURNS TABLE (
  id uuid,
  category_id uuid,
  question_text text,
  question_type public.question_type,
  options jsonb,
  answer_key jsonb,
  discussion text
)
LANGUAGE sql
VOLATILE
AS $$
  SELECT q.id, q.category_id, q.question_text, q.question_type, q.options, q.answer_key, q.discussion
  FROM public.questions q
  WHERE q.category_id = ANY(category_ids)
  ORDER BY random()
  LIMIT take;
$$;

GRANT EXECUTE ON FUNCTION public.pick_random_questions(uuid[], int) TO authenticated;

-- RLS
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_blueprints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Authenticated read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='institutions' AND policyname='Authenticated read institutions') THEN
    CREATE POLICY "Authenticated read institutions" ON public.institutions
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exam_blueprints' AND policyname='Authenticated read exam_blueprints') THEN
    CREATE POLICY "Authenticated read exam_blueprints" ON public.exam_blueprints
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  -- Admin write
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='institutions' AND policyname='Admin write institutions') THEN
    CREATE POLICY "Admin write institutions" ON public.institutions
      FOR ALL
      USING (exists (select 1 from public.admin_users where user_id = auth.uid()))
      WITH CHECK (exists (select 1 from public.admin_users where user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exam_blueprints' AND policyname='Admin write exam_blueprints') THEN
    CREATE POLICY "Admin write exam_blueprints" ON public.exam_blueprints
      FOR ALL
      USING (exists (select 1 from public.admin_users where user_id = auth.uid()))
      WITH CHECK (exists (select 1 from public.admin_users where user_id = auth.uid()));
  END IF;
END $$;

-- Optional bootstrap:
-- If you previously migrated from legacy SKB sections into categories under root 'skb',
-- create institutions + blueprints from that existing structure.
DO $$
BEGIN
  IF to_regclass('public.categories') IS NULL OR to_regclass('public.questions') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'skb') THEN
    RETURN;
  END IF;

  -- 1) institutions from direct children of root 'skb'
  WITH skb_root AS (
    SELECT id FROM public.categories WHERE slug = 'skb' LIMIT 1
  ),
  inst_cats AS (
    SELECT c.id, c.slug, c.name
    FROM public.categories c
    WHERE c.parent_id = (SELECT id FROM skb_root)
  )
  INSERT INTO public.institutions (code, name)
  SELECT upper(inst_cats.slug), inst_cats.name
  FROM inst_cats
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = now();

  -- 2) blueprints from each institution-category children
  WITH skb_root AS (
    SELECT id FROM public.categories WHERE slug = 'skb' LIMIT 1
  ),
  inst_cats AS (
    SELECT c.id AS inst_category_id, c.slug AS inst_slug
    FROM public.categories c
    WHERE c.parent_id = (SELECT id FROM skb_root)
  ),
  inst_map AS (
    SELECT i.id AS institution_id, ic.inst_category_id
    FROM inst_cats ic
    JOIN public.institutions i ON i.code = upper(ic.inst_slug)
  ),
  blueprint_targets AS (
    SELECT
      im.institution_id,
      child.id AS category_id
    FROM inst_map im
    JOIN public.categories child ON child.parent_id = im.inst_category_id
  ),
  counted AS (
    SELECT
      bt.institution_id,
      bt.category_id,
      (
        WITH RECURSIVE d AS (
          SELECT c0.id
          FROM public.categories c0
          WHERE c0.id = bt.category_id
          UNION ALL
          SELECT c1.id
          FROM public.categories c1
          JOIN d ON c1.parent_id = d.id
        )
        SELECT COUNT(*)::int
        FROM public.questions q
        WHERE q.category_id IN (SELECT id FROM d)
      ) AS cnt
    FROM blueprint_targets bt
  )
  INSERT INTO public.exam_blueprints (institution_id, category_id, question_count)
  SELECT institution_id, category_id, cnt
  FROM counted
  WHERE cnt > 0
  ON CONFLICT (institution_id, category_id) DO UPDATE SET
    question_count = EXCLUDED.question_count,
    updated_at = now();
END $$;

COMMIT;
