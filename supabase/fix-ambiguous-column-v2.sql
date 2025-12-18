-- Fix "column reference question_id is ambiguous" error - VERSION 2 (SIMPLE)
-- The issue: Multiple CTEs with 'question_id' column causing ambiguity
-- Solution: Use unique column names in each CTE to avoid conflicts

BEGIN;

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

  SELECT id INTO v_category_id
  FROM public.categories
  WHERE slug = category_slug
  LIMIT 1;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Category not found: %', category_slug;
  END IF;

  v_title := 'Real Tryout - ' || category_slug;

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

  INSERT INTO public.user_exam_sessions (user_id, package_id, status, started_at)
  VALUES (v_user_id, v_package_id, 'started', v_started_at)
  RETURNING id INTO v_session_id;

  -- Pick questions from category + all descendants (recursive)
  -- FIX: Use unique column aliases to avoid ambiguity
  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT v_category_id AS id
    UNION ALL
    SELECT c.id
    FROM public.categories c
    JOIN tree t ON c.parent_id = t.id
  ),
  pool AS (
    SELECT
      q.id,
      q.question_text,
      q.question_type,
      q.options,
      cat.slug AS topic_slug
    FROM public.questions q
    JOIN public.categories cat ON cat.id = q.category_id
    WHERE q.category_id IN (SELECT id FROM tree)
  ),
  picked AS (
    SELECT
      pool.id,
      pool.question_text,
      pool.question_type,
      pool.options,
      pool.topic_slug,
      (row_number() OVER (ORDER BY random()))::int AS question_order
    FROM pool
    LIMIT v_take
  ),
  ins AS (
    INSERT INTO public.user_answers (session_id, question_id)
    SELECT v_session_id, picked.id
    FROM picked
    ON CONFLICT (session_id, question_id) DO NOTHING
    RETURNING user_answers.question_id AS inserted_qid
  )
  SELECT
    v_session_id AS session_id,
    v_started_at AS started_at,
    v_duration AS duration_minutes,
    picked.question_order,
    picked.id AS question_id,
    picked.topic_slug,
    picked.question_text,
    picked.question_type,
    picked.options
  FROM picked
  ORDER BY picked.question_order;
END $$;

GRANT EXECUTE ON FUNCTION public.start_category_tryout(text, int, int) TO authenticated;

COMMIT;

-- Test the function
-- SELECT * FROM start_category_tryout('twk', 30, 5);
-- SELECT * FROM start_category_tryout('tiu', 30, 5);
-- SELECT * FROM start_category_tryout('tkp', 30, 5);
