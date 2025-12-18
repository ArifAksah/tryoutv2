-- Fix "column reference question_id is ambiguous" - VERSION 3 (FINAL FIX)
-- The problem: Even with aliases, PostgreSQL gets confused when multiple CTEs reference same columns
-- Solution: Completely separate INSERT from SELECT, no nested CTEs referencing each other

BEGIN;

-- Drop and recreate function to ensure clean state
DROP FUNCTION IF EXISTS public.start_category_tryout(text, int, int);

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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find category
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

  -- Create session
  INSERT INTO public.user_exam_sessions (user_id, package_id, status, started_at)
  VALUES (v_user_id, v_package_id, 'started', v_started_at)
  RETURNING id INTO v_session_id;

  -- Create temporary table for picked questions (cleaner approach)
  CREATE TEMP TABLE IF NOT EXISTS temp_picked_questions (
    q_id uuid PRIMARY KEY,
    q_text text,
    q_type public.question_type,
    q_options jsonb,
    q_topic_slug text,
    q_order int
  ) ON COMMIT DROP;

  -- Pick questions and insert into temp table
  INSERT INTO temp_picked_questions (q_id, q_text, q_type, q_options, q_topic_slug, q_order)
  WITH RECURSIVE tree AS (
    SELECT v_category_id AS id
    UNION ALL
    SELECT c.id
    FROM public.categories c
    INNER JOIN tree t ON c.parent_id = t.id
  ),
  pool AS (
    SELECT
      q.id,
      q.question_text,
      q.question_type,
      q.options,
      cat.slug AS topic_slug
    FROM public.questions q
    INNER JOIN public.categories cat ON cat.id = q.category_id
    WHERE q.category_id IN (SELECT id FROM tree)
    ORDER BY random()
    LIMIT v_take
  )
  SELECT
    pool.id,
    pool.question_text,
    pool.question_type,
    pool.options,
    pool.topic_slug,
    row_number() OVER (ORDER BY random())::int
  FROM pool;

  -- Insert picked questions into user_answers
  INSERT INTO public.user_answers (session_id, question_id)
  SELECT v_session_id, q_id
  FROM temp_picked_questions
  ON CONFLICT (session_id, question_id) DO NOTHING;

  -- Return the picked questions
  RETURN QUERY
  SELECT
    v_session_id,
    v_started_at,
    v_duration,
    tpq.q_order,
    tpq.q_id,
    tpq.q_topic_slug,
    tpq.q_text,
    tpq.q_type,
    tpq.q_options
  FROM temp_picked_questions tpq
  ORDER BY tpq.q_order;
END $$;

GRANT EXECUTE ON FUNCTION public.start_category_tryout(text, int, int) TO authenticated;

COMMIT;

-- Verify function was created successfully
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'start_category_tryout'
  ) THEN
    RAISE NOTICE '✅ Function start_category_tryout created successfully!';
    RAISE NOTICE 'You can now test it via the application.';
  ELSE
    RAISE EXCEPTION '❌ Function creation failed!';
  END IF;
END $$;

-- Manual test (requires authenticated user - run from app, not here):
-- SELECT * FROM start_category_tryout('twk', 30, 5);
