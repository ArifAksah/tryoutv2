-- ============================================================================
-- FINAL COMPREHENSIVE FIX FOR ALL TRYOUT FUNCTIONS
-- ============================================================================
-- Root cause of "column reference X is ambiguous":
-- PostgreSQL gets confused between:
--   1. RETURNS TABLE column names (session_id, question_id, etc.)
--   2. Variables with similar names (v_session_id)
--   3. CTE columns with same names
--
-- Solution: Use OUT parameters instead of RETURNS TABLE, and ensure
-- all variable names are completely different from output column names.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX start_category_tryout (for individual sections: TWK, TIU, TKP)
-- ============================================================================
DROP FUNCTION IF EXISTS public.start_category_tryout(text, int, int) CASCADE;

CREATE FUNCTION public.start_category_tryout(
  p_category_slug text,
  p_duration_minutes int DEFAULT NULL,
  p_take int DEFAULT 30,
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
  var_package_id uuid;
  var_session_id uuid;
  var_category_id uuid;
  var_category_duration int;
  var_started_at timestamptz := now();
  var_take int := GREATEST(1, COALESCE(p_take, 1));
  var_duration int;
  var_title text;
  rec record;
  var_order int := 0;
BEGIN
  -- Auth check
  var_user_id := auth.uid();
  IF var_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find category
  SELECT id INTO var_category_id
  FROM public.categories
  WHERE slug = p_category_slug
  LIMIT 1;

  IF var_category_id IS NULL THEN
    RAISE EXCEPTION 'Category not found: %', p_category_slug;
  END IF;

  SELECT duration_minutes
  INTO var_category_duration
  FROM public.categories
  WHERE id = var_category_id
  LIMIT 1;

  var_duration := GREATEST(1, COALESCE(p_duration_minutes, var_category_duration, 30));

  var_title := 'Real Tryout - ' || p_category_slug;

  -- Get or create package
  SELECT id INTO var_package_id
  FROM public.exam_packages
  WHERE title = var_title
  ORDER BY inserted_at DESC
  LIMIT 1;

  IF var_package_id IS NULL THEN
    INSERT INTO public.exam_packages (title, duration_minutes, is_active)
    VALUES (var_title, var_duration, true)
    RETURNING id INTO var_package_id;
  END IF;

  -- Create session
  INSERT INTO public.user_exam_sessions (user_id, package_id, status, started_at)
  VALUES (var_user_id, var_package_id, 'started', var_started_at)
  RETURNING id INTO var_session_id;

  -- Loop through questions and return each row
  FOR rec IN
    WITH RECURSIVE cat_tree AS (
      SELECT var_category_id AS cat_id
      UNION ALL
      SELECT c.id FROM public.categories c
      INNER JOIN cat_tree ct ON c.parent_id = ct.cat_id
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
    ORDER BY random()
    LIMIT var_take
  LOOP
    var_order := var_order + 1;
    
    -- Insert into user_answers
    INSERT INTO public.user_answers (session_id, question_id)
    VALUES (var_session_id, rec.q_id)
    ON CONFLICT (session_id, question_id) DO NOTHING;
    
    -- Set OUT parameters and return row
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_category_tryout(text, int, int) TO authenticated;


-- ============================================================================
-- 2. FIX start_skd_tryout (for full SKD: TWK + TIU + TKP combined)
-- ============================================================================
DROP FUNCTION IF EXISTS public.start_skd_tryout(int, int, int, int) CASCADE;

CREATE FUNCTION public.start_skd_tryout(
  p_duration_minutes int DEFAULT 100,
  p_take_tiu int DEFAULT 35,
  p_take_tkp int DEFAULT 45,
  p_take_twk int DEFAULT 30,
  -- OUT parameters
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
  var_package_id uuid;
  var_session_id uuid;
  var_started_at timestamptz := now();
  var_duration int := GREATEST(1, COALESCE(p_duration_minutes, 1));
  var_take_twk int := GREATEST(0, COALESCE(p_take_twk, 0));
  var_take_tiu int := GREATEST(0, COALESCE(p_take_tiu, 0));
  var_take_tkp int := GREATEST(0, COALESCE(p_take_tkp, 0));
  var_twk_id uuid;
  var_tiu_id uuid;
  var_tkp_id uuid;
  var_title text := 'Real Tryout - skd';
  rec record;
  var_order int := 0;
BEGIN
  -- Auth check
  var_user_id := auth.uid();
  IF var_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get category IDs
  SELECT id INTO var_twk_id FROM public.categories WHERE slug = 'twk' LIMIT 1;
  SELECT id INTO var_tiu_id FROM public.categories WHERE slug = 'tiu' LIMIT 1;
  SELECT id INTO var_tkp_id FROM public.categories WHERE slug = 'tkp' LIMIT 1;

  IF var_twk_id IS NULL OR var_tiu_id IS NULL OR var_tkp_id IS NULL THEN
    RAISE EXCEPTION 'SKD categories (twk/tiu/tkp) not found.';
  END IF;

  -- Get or create package
  SELECT id INTO var_package_id
  FROM public.exam_packages
  WHERE title = var_title
  ORDER BY inserted_at DESC
  LIMIT 1;

  IF var_package_id IS NULL THEN
    INSERT INTO public.exam_packages (title, duration_minutes, is_active)
    VALUES (var_title, var_duration, true)
    RETURNING id INTO var_package_id;
  END IF;

  -- Create session
  INSERT INTO public.user_exam_sessions (user_id, package_id, status, started_at)
  VALUES (var_user_id, var_package_id, 'started', var_started_at)
  RETURNING id INTO var_session_id;

  -- Process TWK questions
  FOR rec IN
    WITH RECURSIVE twk_tree AS (
      SELECT var_twk_id AS cat_id
      UNION ALL
      SELECT c.id FROM public.categories c
      INNER JOIN twk_tree t ON c.parent_id = t.cat_id
    )
    SELECT q.id AS q_id, q.question_text AS q_text, q.question_type AS q_type,
           q.options AS q_opts, c.slug AS q_topic
    FROM public.questions q
    INNER JOIN public.categories c ON c.id = q.category_id
    WHERE q.category_id IN (SELECT cat_id FROM twk_tree)
    ORDER BY random()
    LIMIT var_take_twk
  LOOP
    var_order := var_order + 1;
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

  -- Process TIU questions
  FOR rec IN
    WITH RECURSIVE tiu_tree AS (
      SELECT var_tiu_id AS cat_id
      UNION ALL
      SELECT c.id FROM public.categories c
      INNER JOIN tiu_tree t ON c.parent_id = t.cat_id
    )
    SELECT q.id AS q_id, q.question_text AS q_text, q.question_type AS q_type,
           q.options AS q_opts, c.slug AS q_topic
    FROM public.questions q
    INNER JOIN public.categories c ON c.id = q.category_id
    WHERE q.category_id IN (SELECT cat_id FROM tiu_tree)
    ORDER BY random()
    LIMIT var_take_tiu
  LOOP
    var_order := var_order + 1;
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

  -- Process TKP questions
  FOR rec IN
    WITH RECURSIVE tkp_tree AS (
      SELECT var_tkp_id AS cat_id
      UNION ALL
      SELECT c.id FROM public.categories c
      INNER JOIN tkp_tree t ON c.parent_id = t.cat_id
    )
    SELECT q.id AS q_id, q.question_text AS q_text, q.question_type AS q_type,
           q.options AS q_opts, c.slug AS q_topic
    FROM public.questions q
    INNER JOIN public.categories c ON c.id = q.category_id
    WHERE q.category_id IN (SELECT cat_id FROM tkp_tree)
    ORDER BY random()
    LIMIT var_take_tkp
  LOOP
    var_order := var_order + 1;
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_skd_tryout(int, int, int, int) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  fn_count int;
BEGIN
  SELECT count(*) INTO fn_count
  FROM pg_proc
  WHERE proname IN ('start_category_tryout', 'start_skd_tryout');
  
  IF fn_count = 2 THEN
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ SUCCESS! Both functions created successfully!        ║';
    RAISE NOTICE '╠══════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  • start_category_tryout - for TWK/TIU/TKP individual   ║';
    RAISE NOTICE '║  • start_skd_tryout - for full SKD (combined)           ║';
    RAISE NOTICE '╠══════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  Now test in the application:                           ║';
    RAISE NOTICE '║  1. Refresh browser                                     ║';
    RAISE NOTICE '║  2. Click Tryout Real on TWK/TIU/TKP cards             ║';
    RAISE NOTICE '║  3. Should work without any ambiguous errors!          ║';
    RAISE NOTICE '╚══════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
  ELSE
    RAISE EXCEPTION '❌ FAILED: Expected 2 functions, found %', fn_count;
  END IF;
END;
$$;
