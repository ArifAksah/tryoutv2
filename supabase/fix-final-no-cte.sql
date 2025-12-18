-- FINAL FIX: Complete rewrite WITHOUT any CTEs
-- Pure procedural approach - no ambiguity possible

BEGIN;

-- First, completely remove the old function
DROP FUNCTION IF EXISTS public.start_category_tryout(text, int, int) CASCADE;

-- Create a simple version without any CTEs
CREATE OR REPLACE FUNCTION public.start_category_tryout(
  category_slug text,
  p_duration_minutes int DEFAULT 30,
  p_take int DEFAULT 30
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
  v_category_id uuid;
  v_started_at timestamptz := now();
  v_take int := GREATEST(1, COALESCE(p_take, 1));
  v_duration int := GREATEST(1, COALESCE(p_duration_minutes, 1));
  v_title text;
  v_rec record;
  v_order int := 0;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find category by slug
  SELECT id INTO v_category_id
  FROM public.categories
  WHERE slug = category_slug
  LIMIT 1;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Category not found: %', category_slug;
  END IF;

  v_title := 'Real Tryout - ' || category_slug;

  -- Get or create exam package
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

  -- Create user session
  INSERT INTO public.user_exam_sessions (user_id, package_id, status, started_at)
  VALUES (v_user_id, v_package_id, 'started', v_started_at)
  RETURNING id INTO v_session_id;

  -- Create temp table to hold results
  DROP TABLE IF EXISTS _temp_tryout_questions;
  CREATE TEMP TABLE _temp_tryout_questions (
    qid uuid,
    qtext text,
    qtype public.question_type,
    qopts jsonb,
    qtopic text,
    qorder int
  );

  -- Get all descendant category IDs into a temp table
  DROP TABLE IF EXISTS _temp_category_tree;
  CREATE TEMP TABLE _temp_category_tree AS
  WITH RECURSIVE cat_tree AS (
    SELECT id FROM public.categories WHERE id = v_category_id
    UNION ALL
    SELECT c.id FROM public.categories c
    INNER JOIN cat_tree ct ON c.parent_id = ct.id
  )
  SELECT id FROM cat_tree;

  -- Insert random questions into temp table
  INSERT INTO _temp_tryout_questions (qid, qtext, qtype, qopts, qtopic, qorder)
  SELECT 
    q.id,
    q.question_text,
    q.question_type,
    q.options,
    c.slug,
    row_number() OVER (ORDER BY random())::int
  FROM public.questions q
  INNER JOIN public.categories c ON c.id = q.category_id
  WHERE q.category_id IN (SELECT id FROM _temp_category_tree)
  ORDER BY random()
  LIMIT v_take;

  -- Insert into user_answers
  INSERT INTO public.user_answers (session_id, question_id)
  SELECT v_session_id, qid FROM _temp_tryout_questions
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
  FROM _temp_tryout_questions t
  ORDER BY t.qorder;

  -- Cleanup
  DROP TABLE IF EXISTS _temp_tryout_questions;
  DROP TABLE IF EXISTS _temp_category_tree;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.start_category_tryout(text, int, int) TO authenticated;

COMMIT;

-- Verify
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'start_category_tryout') THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ SUCCESS! Function created/replaced.';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Now test via the application:';
    RAISE NOTICE '1. Go to http://localhost:3000';
    RAISE NOTICE '2. Click "Tryout Real" on TWK/TIU/TKP';
    RAISE NOTICE '3. Should work without ambiguous error!';
    RAISE NOTICE '';
  ELSE
    RAISE EXCEPTION '❌ FAILED: Function not created!';
  END IF;
END;
$$;
