BEGIN;

-- Real tryout (timed) with server-side scoring + session persistence.
-- Requires tables from migrate-to-categories-schema.sql:
--   - categories, questions, exam_packages, user_exam_sessions, user_answers
-- And for SKB mode requires:
--   - institutions, exam_blueprints
--   - generate_institution_questions(institution_code) (from skb-blueprints-rpc.sql)

-- Start: category-based tryout (SKD-style)
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

  -- pick questions from category + descendants (single source of truth)
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
      q.id AS question_id,
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
      p.*,
      (row_number() OVER (ORDER BY random()))::int AS question_order
    FROM pool p
    LIMIT v_take
  ),
  ins AS (
    INSERT INTO public.user_answers (session_id, question_id)
    SELECT v_session_id, picked.question_id
    FROM picked
    ON CONFLICT ON CONSTRAINT user_answers_pkey DO NOTHING
    RETURNING user_answers.question_id
  )
  SELECT
    v_session_id,
    v_started_at,
    v_duration,
    picked.question_order,
    picked.question_id,
    picked.topic_slug,
    picked.question_text,
    picked.question_type,
    picked.options
  FROM picked
  ORDER BY picked.question_order;
END $$;

GRANT EXECUTE ON FUNCTION public.start_category_tryout(text, int, int) TO authenticated;

-- Start: institution-based tryout (SKB-style)
-- NOTE: Do not overload this function with the same named parameters.
-- PostgREST resolves RPCs by named parameters and can become ambiguous.
DROP FUNCTION IF EXISTS public.start_institution_tryout(p_duration_minutes int, p_institution_code text);
CREATE OR REPLACE FUNCTION public.start_institution_tryout(
  p_institution_code text,
  p_duration_minutes int DEFAULT 60
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
  v_code text := upper(p_institution_code);
  v_title text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure institution exists
  IF NOT EXISTS (SELECT 1 FROM public.institutions i WHERE upper(i.code) = v_code) THEN
    RAISE EXCEPTION 'Institution not found: %', v_code;
  END IF;

  v_title := 'Real Tryout SKB - ' || v_code;

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

  RETURN QUERY
  WITH picked AS (
    SELECT
      g.id AS question_id,
      g.topic_slug,
      g.question_text,
      g.question_type,
      g.options,
      (row_number() OVER (ORDER BY random()))::int AS question_order
    FROM public.generate_institution_questions(v_code) g
  ),
  ins AS (
    INSERT INTO public.user_answers (session_id, question_id)
    SELECT v_session_id, picked.question_id
    FROM picked
    ON CONFLICT ON CONSTRAINT user_answers_pkey DO NOTHING
    RETURNING user_answers.question_id
  )
  SELECT
    v_session_id,
    v_started_at,
    v_duration,
    picked.question_order,
    picked.question_id,
    picked.topic_slug,
    picked.question_text,
    picked.question_type,
    picked.options
  FROM picked
  ORDER BY picked.question_order;
END $$;

GRANT EXECUTE ON FUNCTION public.start_institution_tryout(text, int) TO authenticated;

-- Start: full SKD tryout (TWK+TIU+TKP in one timed session)
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

  SELECT id INTO v_twk_id FROM public.categories WHERE slug = 'twk' LIMIT 1;
  SELECT id INTO v_tiu_id FROM public.categories WHERE slug = 'tiu' LIMIT 1;
  SELECT id INTO v_tkp_id FROM public.categories WHERE slug = 'tkp' LIMIT 1;

  IF v_twk_id IS NULL OR v_tiu_id IS NULL OR v_tkp_id IS NULL THEN
    RAISE EXCEPTION 'SKD categories (twk/tiu/tkp) not found. Run seed.sql or create categories first.';
  END IF;

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

  RETURN QUERY
  WITH RECURSIVE
  twk_tree AS (
    SELECT v_twk_id AS id
    UNION ALL
    SELECT c.id FROM public.categories c JOIN twk_tree t ON c.parent_id = t.id
  ),
  tiu_tree AS (
    SELECT v_tiu_id AS id
    UNION ALL
    SELECT c.id FROM public.categories c JOIN tiu_tree t ON c.parent_id = t.id
  ),
  tkp_tree AS (
    SELECT v_tkp_id AS id
    UNION ALL
    SELECT c.id FROM public.categories c JOIN tkp_tree t ON c.parent_id = t.id
  ),
  twk_pool AS (
    SELECT q.id AS question_id, q.question_text, q.question_type, q.options, cat.slug AS topic_slug
    FROM public.questions q
    JOIN public.categories cat ON cat.id = q.category_id
    WHERE q.category_id IN (SELECT id FROM twk_tree)
  ),
  tiu_pool AS (
    SELECT q.id AS question_id, q.question_text, q.question_type, q.options, cat.slug AS topic_slug
    FROM public.questions q
    JOIN public.categories cat ON cat.id = q.category_id
    WHERE q.category_id IN (SELECT id FROM tiu_tree)
  ),
  tkp_pool AS (
    SELECT q.id AS question_id, q.question_text, q.question_type, q.options, cat.slug AS topic_slug
    FROM public.questions q
    JOIN public.categories cat ON cat.id = q.category_id
    WHERE q.category_id IN (SELECT id FROM tkp_tree)
  ),
  twk_picked AS (
    SELECT p.*, row_number() OVER (ORDER BY random()) AS rn
    FROM twk_pool p
    LIMIT v_take_twk
  ),
  tiu_picked AS (
    SELECT p.*, row_number() OVER (ORDER BY random()) AS rn
    FROM tiu_pool p
    LIMIT v_take_tiu
  ),
  tkp_picked AS (
    SELECT p.*, row_number() OVER (ORDER BY random()) AS rn
    FROM tkp_pool p
    LIMIT v_take_tkp
  ),
  combined AS (
    SELECT
      1 AS part,
      (rn)::int AS question_order,
      question_id,
      topic_slug,
      question_text,
      question_type,
      options
    FROM twk_picked
    UNION ALL
    SELECT
      2 AS part,
      (rn + v_take_twk)::int AS question_order,
      question_id,
      topic_slug,
      question_text,
      question_type,
      options
    FROM tiu_picked
    UNION ALL
    SELECT
      3 AS part,
      (rn + v_take_twk + v_take_tiu)::int AS question_order,
      question_id,
      topic_slug,
      question_text,
      question_type,
      options
    FROM tkp_picked
  ),
  ins AS (
    INSERT INTO public.user_answers (session_id, question_id)
    SELECT v_session_id, combined.question_id
    FROM combined
    ON CONFLICT ON CONSTRAINT user_answers_pkey DO NOTHING
    RETURNING user_answers.question_id
  )
  SELECT
    v_session_id,
    v_started_at,
    v_duration,
    combined.question_order,
    combined.question_id,
    combined.topic_slug,
    combined.question_text,
    combined.question_type,
    combined.options
  FROM combined
  ORDER BY combined.question_order;
END $$;

GRANT EXECUTE ON FUNCTION public.start_skd_tryout(int, int, int, int) TO authenticated;

-- Submit: server-side scoring
CREATE OR REPLACE FUNCTION public.submit_tryout_session(
  p_session_id uuid,
  p_answers jsonb
)
RETURNS TABLE (
  score_total int,
  max_score int,
  total_questions int,
  correct_count int,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  v_user_id uuid;
  v_duration int;
  v_started_at timestamptz;
  v_now timestamptz := now();
  v_status text := 'submitted';
  v_score int := 0;
  v_max int := 0;
  v_total int := 0;
  v_correct int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.started_at, p.duration_minutes
  INTO v_started_at, v_duration
  FROM public.user_exam_sessions s
  JOIN public.exam_packages p ON p.id = s.package_id
  WHERE s.id = p_session_id
    AND s.user_id = v_user_id
  LIMIT 1;

  IF v_started_at IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_now > (v_started_at + make_interval(mins => v_duration)) THEN
    v_status := 'expired';
  END IF;

  -- Update answers + score per question
  WITH a AS (
    SELECT
      (kv.key)::uuid AS question_id,
      upper(kv.value) AS chosen
    FROM jsonb_each_text(COALESCE(p_answers, '{}'::jsonb)) kv
    WHERE kv.key ~* '^[0-9a-f\-]{36}$'
  ),
  target AS (
    SELECT ua.question_id
    FROM public.user_answers ua
    WHERE ua.session_id = p_session_id
  ),
  scored AS (
    SELECT
      t.question_id,
      a.chosen,
      q.question_type,
      q.answer_key,
      CASE
        WHEN q.question_type = 'multiple_choice' THEN
          CASE
            WHEN a.chosen = upper(coalesce(q.answer_key->>'correct', '')) THEN
              COALESCE((q.answer_key->>'score')::int, 1)
            ELSE 0
          END
        WHEN q.question_type = 'scale_tkp' THEN
          COALESCE((q.answer_key->>a.chosen)::int, 0)
        ELSE 0
      END AS score_obtained
    FROM target t
    LEFT JOIN a ON a.question_id = t.question_id
    JOIN public.questions q ON q.id = t.question_id
  )
  UPDATE public.user_answers AS ua
  SET
    answer_chosen = scored.chosen,
    score_obtained = scored.score_obtained
  FROM scored
  WHERE ua.session_id = p_session_id
    AND ua.question_id = scored.question_id;

  -- Aggregate results
  SELECT
    COALESCE(sum(COALESCE(ua.score_obtained, 0)), 0)::int,
    COALESCE(sum(
      CASE
        WHEN q.question_type = 'multiple_choice' THEN COALESCE((q.answer_key->>'score')::int, 1)
        WHEN q.question_type = 'scale_tkp' THEN COALESCE(
          (SELECT max((v.value)::int)
           FROM jsonb_each_text(q.answer_key) v
           WHERE v.value ~ '^-?\d+$'
          ),
          0
        )
        ELSE 0
      END
    ), 0)::int,
    count(*)::int,
    COALESCE(sum(
      CASE
        WHEN q.question_type = 'multiple_choice'
          AND ua.answer_chosen IS NOT NULL
          AND upper(ua.answer_chosen) = upper(coalesce(q.answer_key->>'correct', ''))
          THEN 1
        ELSE 0
      END
    ), 0)::int
  INTO v_score, v_max, v_total, v_correct
  FROM public.user_answers ua
  JOIN public.questions q ON q.id = ua.question_id
  WHERE ua.session_id = p_session_id;

  UPDATE public.user_exam_sessions
  SET
    score_total = v_score,
    status = v_status,
    finished_at = v_now
  WHERE id = p_session_id
    AND user_id = v_user_id;

  RETURN QUERY SELECT v_score, v_max, v_total, v_correct, v_status;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_tryout_session(uuid, jsonb) TO authenticated;

COMMIT;
