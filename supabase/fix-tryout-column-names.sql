-- ============================================================================
-- FIX COLUMN NAMES - Return correct column names for frontend
-- ============================================================================
-- Problem: OUT parameters return columns with "o_" prefix
-- Frontend expects: session_id, question_id, question_text, etc.
-- Solution: Use OUT parameters with correct names (no prefix)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX start_category_tryout
-- ============================================================================
DROP FUNCTION IF EXISTS public.start_category_tryout(text, int, int) CASCADE;

CREATE FUNCTION public.start_category_tryout(
  p_category_slug text,
  p_duration_minutes int DEFAULT 30,
  p_take int DEFAULT 30,
  -- OUT parameters with CORRECT names (matching frontend expectations)
  OUT session_id uuid,
  OUT started_at timestamptz,
  OUT duration_minutes int,
  OUT question_order int,
  OUT question_id uuid,
  OUT topic_slug text,
  OUT question_text text,
  OUT question_type public.question_type,
  OUT options jsonb
)
RETURNS SETOF record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  -- All variables use "var_" prefix to avoid ANY conflict
  var_user_id uuid;
  var_package_id uuid;
  var_session_id uuid;
  var_category_id uuid;
  var_started_at timestamptz := now();
  var_take int := GREATEST(1, COALESCE(p_take, 1));
  var_duration int := GREATEST(1, COALESCE(p_duration_minutes, 1));
  var_title text;
  var_rec record;
  var_order int := 0;
BEGIN
  -- Auth check
  var_user_id := auth.uid();
  IF var_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find category
  SELECT c.id INTO var_category_id
  FROM public.categories c
  WHERE c.slug = p_category_slug
  LIMIT 1;

  IF var_category_id IS NULL THEN
    RAISE EXCEPTION 'Category not found: %', p_category_slug;
  END IF;

  var_title := 'Real Tryout - ' || p_category_slug;

  -- Get or create package
  SELECT ep.id INTO var_package_id
  FROM public.exam_packages ep
  WHERE ep.title = var_title
  ORDER BY ep.inserted_at DESC
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
  FOR var_rec IN
    WITH RECURSIVE cat_tree AS (
      SELECT var_category_id AS cat_id
      UNION ALL
      SELECT cc.id FROM public.categories cc
      INNER JOIN cat_tree ct ON cc.parent_id = ct.cat_id
    )
    SELECT 
      q.id AS q_id,
      q.question_text AS q_text,
      q.question_type AS q_type,
      q.options AS q_opts,
      cat.slug AS q_topic
    FROM public.questions q
    INNER JOIN public.categories cat ON cat.id = q.category_id
    WHERE q.category_id IN (SELECT cat_id FROM cat_tree)
    ORDER BY random()
    LIMIT var_take
  LOOP
    var_order := var_order + 1;
    
    -- Insert into user_answers
    INSERT INTO public.user_answers (session_id, question_id)
    VALUES (var_session_id, var_rec.q_id)
    ON CONFLICT (session_id, question_id) DO NOTHING;
    
    -- Assign to OUT parameters (these become the returned columns)
    session_id := var_session_id;
    started_at := var_started_at;
    duration_minutes := var_duration;
    question_order := var_order;
    question_id := var_rec.q_id;
    topic_slug := var_rec.q_topic;
    question_text := var_rec.q_text;
    question_type := var_rec.q_type;
    options := var_rec.q_opts;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_category_tryout(text, int, int) TO authenticated;


-- ============================================================================
-- 2. FIX start_skd_tryout
-- ============================================================================
DROP FUNCTION IF EXISTS public.start_skd_tryout(int, int, int, int) CASCADE;

CREATE FUNCTION public.start_skd_tryout(
  p_duration_minutes int DEFAULT 100,
  p_take_tiu int DEFAULT 35,
  p_take_tkp int DEFAULT 45,
  p_take_twk int DEFAULT 30,
  -- OUT parameters with CORRECT names
  OUT session_id uuid,
  OUT started_at timestamptz,
  OUT duration_minutes int,
  OUT question_order int,
  OUT question_id uuid,
  OUT topic_slug text,
  OUT question_text text,
  OUT question_type public.question_type,
  OUT options jsonb
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
  var_rec record;
  var_order int := 0;
BEGIN
  -- Auth check
  var_user_id := auth.uid();
  IF var_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get category IDs
  SELECT c.id INTO var_twk_id FROM public.categories c WHERE c.slug = 'twk' LIMIT 1;
  SELECT c.id INTO var_tiu_id FROM public.categories c WHERE c.slug = 'tiu' LIMIT 1;
  SELECT c.id INTO var_tkp_id FROM public.categories c WHERE c.slug = 'tkp' LIMIT 1;

  IF var_twk_id IS NULL OR var_tiu_id IS NULL OR var_tkp_id IS NULL THEN
    RAISE EXCEPTION 'SKD categories (twk/tiu/tkp) not found.';
  END IF;

  -- Get or create package
  SELECT ep.id INTO var_package_id
  FROM public.exam_packages ep
  WHERE ep.title = var_title
  ORDER BY ep.inserted_at DESC
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
  FOR var_rec IN
    WITH RECURSIVE twk_tree AS (
      SELECT var_twk_id AS cat_id
      UNION ALL
      SELECT cc.id FROM public.categories cc
      INNER JOIN twk_tree t ON cc.parent_id = t.cat_id
    )
    SELECT q.id AS q_id, q.question_text AS q_text, q.question_type AS q_type,
           q.options AS q_opts, cat.slug AS q_topic
    FROM public.questions q
    INNER JOIN public.categories cat ON cat.id = q.category_id
    WHERE q.category_id IN (SELECT cat_id FROM twk_tree)
    ORDER BY random()
    LIMIT var_take_twk
  LOOP
    var_order := var_order + 1;
    INSERT INTO public.user_answers (session_id, question_id)
    VALUES (var_session_id, var_rec.q_id)
    ON CONFLICT (session_id, question_id) DO NOTHING;
    
    session_id := var_session_id;
    started_at := var_started_at;
    duration_minutes := var_duration;
    question_order := var_order;
    question_id := var_rec.q_id;
    topic_slug := var_rec.q_topic;
    question_text := var_rec.q_text;
    question_type := var_rec.q_type;
    options := var_rec.q_opts;
    RETURN NEXT;
  END LOOP;

  -- Process TIU questions
  FOR var_rec IN
    WITH RECURSIVE tiu_tree AS (
      SELECT var_tiu_id AS cat_id
      UNION ALL
      SELECT cc.id FROM public.categories cc
      INNER JOIN tiu_tree t ON cc.parent_id = t.cat_id
    )
    SELECT q.id AS q_id, q.question_text AS q_text, q.question_type AS q_type,
           q.options AS q_opts, cat.slug AS q_topic
    FROM public.questions q
    INNER JOIN public.categories cat ON cat.id = q.category_id
    WHERE q.category_id IN (SELECT cat_id FROM tiu_tree)
    ORDER BY random()
    LIMIT var_take_tiu
  LOOP
    var_order := var_order + 1;
    INSERT INTO public.user_answers (session_id, question_id)
    VALUES (var_session_id, var_rec.q_id)
    ON CONFLICT (session_id, question_id) DO NOTHING;
    
    session_id := var_session_id;
    started_at := var_started_at;
    duration_minutes := var_duration;
    question_order := var_order;
    question_id := var_rec.q_id;
    topic_slug := var_rec.q_topic;
    question_text := var_rec.q_text;
    question_type := var_rec.q_type;
    options := var_rec.q_opts;
    RETURN NEXT;
  END LOOP;

  -- Process TKP questions
  FOR var_rec IN
    WITH RECURSIVE tkp_tree AS (
      SELECT var_tkp_id AS cat_id
      UNION ALL
      SELECT cc.id FROM public.categories cc
      INNER JOIN tkp_tree t ON cc.parent_id = t.cat_id
    )
    SELECT q.id AS q_id, q.question_text AS q_text, q.question_type AS q_type,
           q.options AS q_opts, cat.slug AS q_topic
    FROM public.questions q
    INNER JOIN public.categories cat ON cat.id = q.category_id
    WHERE q.category_id IN (SELECT cat_id FROM tkp_tree)
    ORDER BY random()
    LIMIT var_take_tkp
  LOOP
    var_order := var_order + 1;
    INSERT INTO public.user_answers (session_id, question_id)
    VALUES (var_session_id, var_rec.q_id)
    ON CONFLICT (session_id, question_id) DO NOTHING;
    
    session_id := var_session_id;
    started_at := var_started_at;
    duration_minutes := var_duration;
    question_order := var_order;
    question_id := var_rec.q_id;
    topic_slug := var_rec.q_topic;
    question_text := var_rec.q_text;
    question_type := var_rec.q_type;
    options := var_rec.q_opts;
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
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'start_category_tryout')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'start_skd_tryout') THEN
    RAISE NOTICE '';
    RAISE NOTICE '╔═══════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ SUCCESS! Both functions updated with correct columns!     ║';
    RAISE NOTICE '╠═══════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  Column names now match frontend expectations:                ║';
    RAISE NOTICE '║  • session_id, started_at, duration_minutes                  ║';
    RAISE NOTICE '║  • question_order, question_id, topic_slug                   ║';
    RAISE NOTICE '║  • question_text, question_type, options                     ║';
    RAISE NOTICE '╠═══════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  Test now: Refresh browser and try Tryout Real!              ║';
    RAISE NOTICE '╚═══════════════════════════════════════════════════════════════╝';
  ELSE
    RAISE EXCEPTION '❌ Function creation failed!';
  END IF;
END;
$$;
