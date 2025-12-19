


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."category_type" AS ENUM (
    'subject',
    'topic',
    'subtopic'
);


ALTER TYPE "public"."category_type" OWNER TO "postgres";


CREATE TYPE "public"."question_type" AS ENUM (
    'multiple_choice',
    'scale_tkp'
);


ALTER TYPE "public"."question_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_questions_recursive"("category_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count int;
BEGIN
  -- Use recursive CTE to get all descendant categories
  WITH RECURSIVE tree AS (
    SELECT category_id AS id
    UNION ALL
    SELECT c.id
    FROM public.categories c
    JOIN tree t ON c.parent_id = t.id
  )
  SELECT COUNT(*)::int INTO v_count
  FROM public.questions q
  WHERE q.category_id IN (SELECT id FROM tree);
  
  RETURN v_count;
END $$;


ALTER FUNCTION "public"."count_questions_recursive"("category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_institution_questions"("institution_code" "text") RETURNS TABLE("id" "uuid", "topic_slug" "text", "topic_name" "text", "question_text" "text", "question_type" "public"."question_type", "options" "jsonb", "answer_key" "jsonb", "discussion" "text")
    LANGUAGE "sql"
    AS $$
  WITH RECURSIVE inst AS (
    SELECT i.id
    FROM public.institutions i
    WHERE upper(i.code) = upper(institution_code)
    LIMIT 1
  ),
  bp AS (
    SELECT b.category_id AS root_category_id,
           b.question_count
    FROM public.exam_blueprints b
    WHERE b.institution_id = (SELECT id FROM inst)
  ),
  tree AS (
    SELECT bp.root_category_id, bp.root_category_id AS category_id
    FROM bp
    UNION ALL
    SELECT tree.root_category_id, c.id AS category_id
    FROM public.categories c
    JOIN tree ON c.parent_id = tree.category_id
  ),
  pool AS (
    SELECT
      tree.root_category_id,
      q.id,
      q.question_text,
      q.question_type,
      q.options,
      q.answer_key,
      q.discussion
    FROM tree
    JOIN public.questions q ON q.category_id = tree.category_id
  ),
  ranked AS (
    SELECT
      p.*,
      row_number() OVER (PARTITION BY p.root_category_id ORDER BY random()) AS rn
    FROM pool p
  ),
  picked AS (
    SELECT
      r.*
    FROM ranked r
    JOIN bp ON bp.root_category_id = r.root_category_id
    WHERE r.rn <= bp.question_count
  )
  SELECT
    picked.id,
    c.slug AS topic_slug,
    c.name AS topic_name,
    picked.question_text,
    picked.question_type,
    picked.options,
    picked.answer_key,
    picked.discussion
  FROM picked
  JOIN public.categories c ON c.id = picked.root_category_id
  ORDER BY c.slug, random();
$$;


ALTER FUNCTION "public"."generate_institution_questions"("institution_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pick_random_questions"("category_ids" "uuid"[], "take" integer) RETURNS TABLE("id" "uuid", "category_id" "uuid", "question_text" "text", "question_type" "public"."question_type", "options" "jsonb", "answer_key" "jsonb", "discussion" "text")
    LANGUAGE "sql"
    AS $$
  SELECT q.id, q.category_id, q.question_text, q.question_type, q.options, q.answer_key, q.discussion
  FROM public.questions q
  WHERE q.category_id = ANY(category_ids)
  ORDER BY random()
  LIMIT take;
$$;


ALTER FUNCTION "public"."pick_random_questions"("category_ids" "uuid"[], "take" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pick_random_questions"("p_category_id" "uuid", "p_take" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "question_text" "text", "question_type" "public"."question_type", "options" "jsonb", "answer_key" "jsonb", "discussion" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_take int := GREATEST(1, COALESCE(p_take, 1));
BEGIN
  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT p_category_id AS id
    UNION ALL
    SELECT c.id
    FROM public.categories c
    JOIN tree t ON c.parent_id = t.id
  )
  SELECT
    q.id,
    q.question_text,
    q.question_type,
    q.options,
    q.answer_key,
    q.discussion
  FROM public.questions q
  WHERE q.category_id IN (SELECT tree.id FROM tree)
  ORDER BY random()
  LIMIT v_take;
END $$;


ALTER FUNCTION "public"."pick_random_questions"("p_category_id" "uuid", "p_take" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_category_tryout"("p_category_slug" "text", "p_duration_minutes" integer DEFAULT 30, "p_take" integer DEFAULT 30, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") RETURNS SETOF "record"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  var_user_id uuid;
  var_package_id uuid;
  var_session_id uuid;
  var_category_id uuid;
  var_started_at timestamptz := now();
  var_take int := GREATEST(1, COALESCE(p_take, 1));
  var_duration int := GREATEST(1, COALESCE(p_duration_minutes, 1));
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


ALTER FUNCTION "public"."start_category_tryout"("p_category_slug" "text", "p_duration_minutes" integer, "p_take" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_institution_tryout"("p_institution_code" "text", "p_duration_minutes" integer DEFAULT 60) RETURNS TABLE("session_id" "uuid", "started_at" timestamp with time zone, "duration_minutes" integer, "question_order" integer, "question_id" "uuid", "topic_slug" "text", "question_text" "text", "question_type" "public"."question_type", "options" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."start_institution_tryout"("p_institution_code" "text", "p_duration_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_package_tryout"("p_package_slug" "text", "p_duration_minutes" integer DEFAULT NULL::integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") RETURNS SETOF "record"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."start_package_tryout"("p_package_slug" "text", "p_duration_minutes" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_skd_tryout"("p_duration_minutes" integer DEFAULT 100, "p_take_tiu" integer DEFAULT 35, "p_take_tkp" integer DEFAULT 45, "p_take_twk" integer DEFAULT 30, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") RETURNS SETOF "record"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."start_skd_tryout"("p_duration_minutes" integer, "p_take_tiu" integer, "p_take_tkp" integer, "p_take_twk" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_tryout_session"("p_session_id" "uuid", "p_answers" "jsonb") RETURNS TABLE("score_total" integer, "max_score" integer, "total_questions" integer, "correct_count" integer, "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
END $_$;


ALTER FUNCTION "public"."submit_tryout_session"("p_session_id" "uuid", "p_answers" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_id" "text",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "parent_id" "uuid",
    "type" "public"."category_type",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "duration_minutes" integer,
    CONSTRAINT "categories_duration_minutes_check" CHECK ((("duration_minutes" IS NULL) OR ("duration_minutes" > 0)))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_blueprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "question_count" integer NOT NULL,
    "passing_grade" integer,
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "exam_blueprints_question_count_check" CHECK (("question_count" > 0))
);


ALTER TABLE "public"."exam_blueprints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_package_blueprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "question_count" integer NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "exam_package_blueprints_question_count_check" CHECK (("question_count" > 0))
);


ALTER TABLE "public"."exam_package_blueprints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "duration_minutes" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text"
);


ALTER TABLE "public"."exam_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_questions" (
    "exam_package_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "question_order" integer NOT NULL
);


ALTER TABLE "public"."exam_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."institutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legacy_exam_questions" (
    "id" "text" NOT NULL,
    "section_id" "text" NOT NULL,
    "topic_id" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "options" "jsonb" NOT NULL,
    "correct_choice_id" "text" NOT NULL,
    "explanation" "text",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."legacy_exam_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legacy_exam_sections" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "type" "text" NOT NULL,
    "description" "text",
    "school" "text",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "exam_sections_type_check" CHECK (("type" = ANY (ARRAY['SKD'::"text", 'SKB'::"text"])))
);


ALTER TABLE "public"."legacy_exam_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legacy_exam_topics" (
    "id" "text" NOT NULL,
    "section_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "question_count" integer,
    "duration_minutes" integer,
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."legacy_exam_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_id" "text",
    "category_id" "uuid" NOT NULL,
    "question_text" "text" NOT NULL,
    "question_type" "public"."question_type" DEFAULT 'multiple_choice'::"public"."question_type" NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "answer_key" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "discussion" "text",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "question_image_url" "text",
    "question_image_alt" "text"
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_answers" (
    "session_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "answer_chosen" "text",
    "score_obtained" integer,
    "inserted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_exam_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "score_total" integer,
    "status" "text" DEFAULT 'started'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone
);


ALTER TABLE "public"."user_exam_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_practice_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "take_count" integer NOT NULL,
    "question_ids" "uuid"[] NOT NULL,
    "answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "doubts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "score_total" integer DEFAULT 0 NOT NULL,
    "max_score" integer DEFAULT 0 NOT NULL,
    "correct_count" integer DEFAULT 0 NOT NULL,
    "total_questions" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_practice_sessions_take_count_check" CHECK (("take_count" > 0))
);


ALTER TABLE "public"."user_practice_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."exam_blueprints"
    ADD CONSTRAINT "exam_blueprints_institution_id_category_id_key" UNIQUE ("institution_id", "category_id");



ALTER TABLE ONLY "public"."exam_blueprints"
    ADD CONSTRAINT "exam_blueprints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_package_blueprints"
    ADD CONSTRAINT "exam_package_blueprints_package_id_category_id_key" UNIQUE ("package_id", "category_id");



ALTER TABLE ONLY "public"."exam_package_blueprints"
    ADD CONSTRAINT "exam_package_blueprints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_packages"
    ADD CONSTRAINT "exam_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_packages"
    ADD CONSTRAINT "exam_packages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_exam_package_id_question_order_key" UNIQUE ("exam_package_id", "question_order");



ALTER TABLE ONLY "public"."legacy_exam_questions"
    ADD CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_pkey1" PRIMARY KEY ("exam_package_id", "question_id");



ALTER TABLE ONLY "public"."legacy_exam_sections"
    ADD CONSTRAINT "exam_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legacy_exam_topics"
    ADD CONSTRAINT "exam_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_answers"
    ADD CONSTRAINT "user_answers_pkey" PRIMARY KEY ("session_id", "question_id");



ALTER TABLE ONLY "public"."user_exam_sessions"
    ADD CONSTRAINT "user_exam_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_practice_sessions"
    ADD CONSTRAINT "user_practice_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "categories_parent_id_idx" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "exam_blueprints_category_idx" ON "public"."exam_blueprints" USING "btree" ("category_id");



CREATE INDEX "exam_blueprints_institution_idx" ON "public"."exam_blueprints" USING "btree" ("institution_id");



CREATE INDEX "exam_package_blueprints_category_idx" ON "public"."exam_package_blueprints" USING "btree" ("category_id");



CREATE INDEX "exam_package_blueprints_package_idx" ON "public"."exam_package_blueprints" USING "btree" ("package_id");



CREATE INDEX "exam_questions_package_idx" ON "public"."exam_questions" USING "btree" ("exam_package_id");



CREATE INDEX "questions_answer_key_gin_idx" ON "public"."questions" USING "gin" ("answer_key");



CREATE INDEX "questions_category_id_idx" ON "public"."questions" USING "btree" ("category_id");



CREATE INDEX "questions_options_gin_idx" ON "public"."questions" USING "gin" ("options");



CREATE INDEX "user_practice_sessions_category_idx" ON "public"."user_practice_sessions" USING "btree" ("category_id");



CREATE INDEX "user_practice_sessions_user_category_idx" ON "public"."user_practice_sessions" USING "btree" ("user_id", "category_id");



CREATE INDEX "user_practice_sessions_user_idx" ON "public"."user_practice_sessions" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_blueprints"
    ADD CONSTRAINT "exam_blueprints_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."exam_blueprints"
    ADD CONSTRAINT "exam_blueprints_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_package_blueprints"
    ADD CONSTRAINT "exam_package_blueprints_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."exam_package_blueprints"
    ADD CONSTRAINT "exam_package_blueprints_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."exam_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_exam_package_id_fkey" FOREIGN KEY ("exam_package_id") REFERENCES "public"."exam_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."legacy_exam_questions"
    ADD CONSTRAINT "exam_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."legacy_exam_sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."legacy_exam_questions"
    ADD CONSTRAINT "exam_questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."legacy_exam_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."legacy_exam_topics"
    ADD CONSTRAINT "exam_topics_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."legacy_exam_sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_answers"
    ADD CONSTRAINT "user_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_answers"
    ADD CONSTRAINT "user_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."user_exam_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_exam_sessions"
    ADD CONSTRAINT "user_exam_sessions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."exam_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_exam_sessions"
    ADD CONSTRAINT "user_exam_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_practice_sessions"
    ADD CONSTRAINT "user_practice_sessions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_practice_sessions"
    ADD CONSTRAINT "user_practice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin users can read self" ON "public"."admin_users" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Admin write categories" ON "public"."categories" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admin write exam_blueprints" ON "public"."exam_blueprints" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admin write exam_package_blueprints" ON "public"."exam_package_blueprints" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admin write exam_packages" ON "public"."exam_packages" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admin write exam_questions" ON "public"."exam_questions" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admin write exam_questions" ON "public"."legacy_exam_questions" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admin write exam_sections" ON "public"."legacy_exam_sections" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admin write exam_topics" ON "public"."legacy_exam_topics" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admin write institutions" ON "public"."institutions" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admin write questions" ON "public"."questions" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Authenticated read categories" ON "public"."categories" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated read exam_blueprints" ON "public"."exam_blueprints" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated read exam_package_blueprints" ON "public"."exam_package_blueprints" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated read exam_packages" ON "public"."exam_packages" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated read exam_questions" ON "public"."exam_questions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated read exam_questions" ON "public"."legacy_exam_questions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated read exam_sections" ON "public"."legacy_exam_sections" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated read exam_topics" ON "public"."legacy_exam_topics" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated read institutions" ON "public"."institutions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated read questions" ON "public"."questions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users manage own answers" ON "public"."user_answers" USING ((EXISTS ( SELECT 1
   FROM "public"."user_exam_sessions" "s"
  WHERE (("s"."id" = "user_answers"."session_id") AND ("s"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_exam_sessions" "s"
  WHERE (("s"."id" = "user_answers"."session_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users manage own practice sessions" ON "public"."user_practice_sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own sessions" ON "public"."user_exam_sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_blueprints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_package_blueprints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institutions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legacy_exam_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legacy_exam_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legacy_exam_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_exam_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_practice_sessions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."count_questions_recursive"("category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_questions_recursive"("category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_questions_recursive"("category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_institution_questions"("institution_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_institution_questions"("institution_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_institution_questions"("institution_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pick_random_questions"("category_ids" "uuid"[], "take" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pick_random_questions"("category_ids" "uuid"[], "take" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pick_random_questions"("category_ids" "uuid"[], "take" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pick_random_questions"("p_category_id" "uuid", "p_take" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pick_random_questions"("p_category_id" "uuid", "p_take" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pick_random_questions"("p_category_id" "uuid", "p_take" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."start_category_tryout"("p_category_slug" "text", "p_duration_minutes" integer, "p_take" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."start_category_tryout"("p_category_slug" "text", "p_duration_minutes" integer, "p_take" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_category_tryout"("p_category_slug" "text", "p_duration_minutes" integer, "p_take" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."start_institution_tryout"("p_institution_code" "text", "p_duration_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."start_institution_tryout"("p_institution_code" "text", "p_duration_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_institution_tryout"("p_institution_code" "text", "p_duration_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."start_package_tryout"("p_package_slug" "text", "p_duration_minutes" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."start_package_tryout"("p_package_slug" "text", "p_duration_minutes" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_package_tryout"("p_package_slug" "text", "p_duration_minutes" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."start_skd_tryout"("p_duration_minutes" integer, "p_take_tiu" integer, "p_take_tkp" integer, "p_take_twk" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."start_skd_tryout"("p_duration_minutes" integer, "p_take_tiu" integer, "p_take_tkp" integer, "p_take_twk" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_skd_tryout"("p_duration_minutes" integer, "p_take_tiu" integer, "p_take_tkp" integer, "p_take_twk" integer, OUT "o_session_id" "uuid", OUT "o_started_at" timestamp with time zone, OUT "o_duration_minutes" integer, OUT "o_question_order" integer, OUT "o_question_id" "uuid", OUT "o_topic_slug" "text", OUT "o_question_text" "text", OUT "o_question_type" "public"."question_type", OUT "o_options" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_tryout_session"("p_session_id" "uuid", "p_answers" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_tryout_session"("p_session_id" "uuid", "p_answers" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_tryout_session"("p_session_id" "uuid", "p_answers" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."exam_blueprints" TO "anon";
GRANT ALL ON TABLE "public"."exam_blueprints" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_blueprints" TO "service_role";



GRANT ALL ON TABLE "public"."exam_package_blueprints" TO "anon";
GRANT ALL ON TABLE "public"."exam_package_blueprints" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_package_blueprints" TO "service_role";



GRANT ALL ON TABLE "public"."exam_packages" TO "anon";
GRANT ALL ON TABLE "public"."exam_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_packages" TO "service_role";



GRANT ALL ON TABLE "public"."exam_questions" TO "anon";
GRANT ALL ON TABLE "public"."exam_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_questions" TO "service_role";



GRANT ALL ON TABLE "public"."institutions" TO "anon";
GRANT ALL ON TABLE "public"."institutions" TO "authenticated";
GRANT ALL ON TABLE "public"."institutions" TO "service_role";



GRANT ALL ON TABLE "public"."legacy_exam_questions" TO "anon";
GRANT ALL ON TABLE "public"."legacy_exam_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."legacy_exam_questions" TO "service_role";



GRANT ALL ON TABLE "public"."legacy_exam_sections" TO "anon";
GRANT ALL ON TABLE "public"."legacy_exam_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."legacy_exam_sections" TO "service_role";



GRANT ALL ON TABLE "public"."legacy_exam_topics" TO "anon";
GRANT ALL ON TABLE "public"."legacy_exam_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."legacy_exam_topics" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."user_answers" TO "anon";
GRANT ALL ON TABLE "public"."user_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_answers" TO "service_role";



GRANT ALL ON TABLE "public"."user_exam_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_exam_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_exam_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_practice_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_practice_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_practice_sessions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































