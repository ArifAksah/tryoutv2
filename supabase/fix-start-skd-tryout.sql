-- Fix start_skd_tryout function - same ambiguous column issue
-- This is for FULL SKD tryout (TWK + TIU + TKP combined)

BEGIN;

DROP FUNCTION IF EXISTS public.start_skd_tryout(int, int, int, int) CASCADE;

CREATE OR REPLACE FUNCTION public.start_skd_tryout(
  p_duration_minutes int DEFAULT 100,
  p_take_tiu int DEFAULT 35,
  p_take_tkp int DEFAULT 45,
  p_take_twk int DEFAULT 30
)
RETURNS TABLE (
  session_id uuid,
  started_at timestamptz,
  duration_minutes int,
  question_order int,
  question_id uuid,
  topic_slug text,
  question_text text,
  question_type public.question_type,
  options jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  v_user_id uuid;
  v_package_id uuid;
  v_session_id uuid;
  v_started_at timestamptz := now();
  v_duration int := GREATEST(1, COALESCE(p_duration_minutes, 1));
  v_take_twk int := GREATEST(0, COALESCE(p_take_twk, 0));
  v_take_tiu int := GREATEST(0, COALESCE(p_take_tiu, 0));
  v_take_tkp int := GREATEST(0, COALESCE(p_take_tkp, 0));
  v_twk_id uuid;
  v_tiu_id uuid;
  v_tkp_id uuid;
  v_title text := 'Real Tryout - skd';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get category IDs
  SELECT id INTO v_twk_id FROM public.categories WHERE slug = 'twk' LIMIT 1;
  SELECT id INTO v_tiu_id FROM public.categories WHERE slug = 'tiu' LIMIT 1;
  SELECT id INTO v_tkp_id FROM public.categories WHERE slug = 'tkp' LIMIT 1;

  IF v_twk_id IS NULL OR v_tiu_id IS NULL OR v_tkp_id IS NULL THEN
    RAISE EXCEPTION 'SKD categories (twk/tiu/tkp) not found.';
  END IF;

  -- Get or create package
  SELECT id INTO v_package_id
  FROM public.exam_packages
  WHERE title = v_title
  ORDER BY inserted_at DESC
  LIMIT 1;

  IF v_package_id IS NULL THEN
    INSERT INTO public.exam_packages (title, duration_minutes, is_active)
    VALUES (v_title, v_duration, true)
    RETURNING id INTO v_package_id;
  END IF;

  -- Create session
  INSERT INTO public.user_exam_sessions (user_id, package_id, status, started_at)
  VALUES (v_user_id, v_package_id, 'started', v_started_at)
  RETURNING id INTO v_session_id;

  -- Use temp tables to avoid CTE ambiguity
  DROP TABLE IF EXISTS _temp_skd_questions;
  CREATE TEMP TABLE _temp_skd_questions (
    qid uuid,
    qtext text,
    qtype public.question_type,
    qopts jsonb,
    qtopic text,
    qorder int
  );

  -- Get TWK category tree
  DROP TABLE IF EXISTS _temp_twk_tree;
  CREATE TEMP TABLE _temp_twk_tree AS
  WITH RECURSIVE tree AS (
    SELECT v_twk_id AS id
    UNION ALL
    SELECT c.id FROM public.categories c JOIN tree t ON c.parent_id = t.id
  )
  SELECT id FROM tree;

  -- Get TIU category tree
  DROP TABLE IF EXISTS _temp_tiu_tree;
  CREATE TEMP TABLE _temp_tiu_tree AS
  WITH RECURSIVE tree AS (
    SELECT v_tiu_id AS id
    UNION ALL
    SELECT c.id FROM public.categories c JOIN tree t ON c.parent_id = t.id
  )
  SELECT id FROM tree;

  -- Get TKP category tree
  DROP TABLE IF EXISTS _temp_tkp_tree;
  CREATE TEMP TABLE _temp_tkp_tree AS
  WITH RECURSIVE tree AS (
    SELECT v_tkp_id AS id
    UNION ALL
    SELECT c.id FROM public.categories c JOIN tree t ON c.parent_id = t.id
  )
  SELECT id FROM tree;

  -- Pick TWK questions
  INSERT INTO _temp_skd_questions (qid, qtext, qtype, qopts, qtopic, qorder)
  SELECT q.id, q.question_text, q.question_type, q.options, c.slug,
         row_number() OVER (ORDER BY random())::int
  FROM public.questions q
  JOIN public.categories c ON c.id = q.category_id
  WHERE q.category_id IN (SELECT id FROM _temp_twk_tree)
  ORDER BY random()
  LIMIT v_take_twk;

  -- Pick TIU questions (continue numbering)
  INSERT INTO _temp_skd_questions (qid, qtext, qtype, qopts, qtopic, qorder)
  SELECT q.id, q.question_text, q.question_type, q.options, c.slug,
         v_take_twk + row_number() OVER (ORDER BY random())::int
  FROM public.questions q
  JOIN public.categories c ON c.id = q.category_id
  WHERE q.category_id IN (SELECT id FROM _temp_tiu_tree)
  ORDER BY random()
  LIMIT v_take_tiu;

  -- Pick TKP questions (continue numbering)
  INSERT INTO _temp_skd_questions (qid, qtext, qtype, qopts, qtopic, qorder)
  SELECT q.id, q.question_text, q.question_type, q.options, c.slug,
         v_take_twk + v_take_tiu + row_number() OVER (ORDER BY random())::int
  FROM public.questions q
  JOIN public.categories c ON c.id = q.category_id
  WHERE q.category_id IN (SELECT id FROM _temp_tkp_tree)
  ORDER BY random()
  LIMIT v_take_tkp;

  -- Insert into user_answers
  INSERT INTO public.user_answers (session_id, question_id)
  SELECT v_session_id, qid FROM _temp_skd_questions
  ON CONFLICT (session_id, question_id) DO NOTHING;

  -- Return results
  RETURN QUERY
  SELECT
    v_session_id,
    v_started_at,
    v_duration,
    t.qorder,
    t.qid,
    t.qtopic,
    t.qtext,
    t.qtype,
    t.qopts
  FROM _temp_skd_questions t
  ORDER BY t.qorder;

  -- Cleanup
  DROP TABLE IF EXISTS _temp_skd_questions;
  DROP TABLE IF EXISTS _temp_twk_tree;
  DROP TABLE IF EXISTS _temp_tiu_tree;
  DROP TABLE IF EXISTS _temp_tkp_tree;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_skd_tryout(int, int, int, int) TO authenticated;

COMMIT;

-- Verify
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'start_skd_tryout') THEN
    RAISE NOTICE '✅ start_skd_tryout function created successfully!';
  ELSE
    RAISE EXCEPTION '❌ Function creation failed!';
  END IF;
END;
$$;
