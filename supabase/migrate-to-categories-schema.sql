BEGIN;

-- Rename legacy tables so we can reuse names in the new schema
DO $$
BEGIN
  IF to_regclass('public.legacy_exam_questions') IS NULL AND to_regclass('public.exam_questions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.exam_questions RENAME TO legacy_exam_questions';
  END IF;

  IF to_regclass('public.legacy_exam_topics') IS NULL AND to_regclass('public.exam_topics') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.exam_topics RENAME TO legacy_exam_topics';
  END IF;

  IF to_regclass('public.legacy_exam_sections') IS NULL AND to_regclass('public.exam_sections') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.exam_sections RENAME TO legacy_exam_sections';
  END IF;
END $$;

-- UUID generator
DO $$
BEGIN
  BEGIN
    EXECUTE 'create extension if not exists pgcrypto with schema extensions';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Enums
DO $$
BEGIN
  BEGIN
    CREATE TYPE public.category_type AS ENUM ('subject', 'topic', 'subtopic');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE TYPE public.question_type AS ENUM ('multiple_choice', 'scale_tkp');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- categories (self-referencing)
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  type public.category_type,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories(parent_id);

-- questions (bank soal)
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  question_text text NOT NULL,
  question_type public.question_type NOT NULL DEFAULT 'multiple_choice',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer_key jsonb NOT NULL DEFAULT '{}'::jsonb,
  discussion text,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questions_category_id_idx ON public.questions(category_id);
CREATE INDEX IF NOT EXISTS questions_options_gin_idx ON public.questions USING gin (options);
CREATE INDEX IF NOT EXISTS questions_answer_key_gin_idx ON public.questions USING gin (answer_key);

-- exam_packages (paket tryout)
CREATE TABLE IF NOT EXISTS public.exam_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  duration_minutes int,
  is_active boolean NOT NULL DEFAULT true,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- exam_questions (pivot table)
CREATE TABLE IF NOT EXISTS public.exam_questions (
  exam_package_id uuid NOT NULL REFERENCES public.exam_packages(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  question_order int NOT NULL,
  PRIMARY KEY (exam_package_id, question_id),
  UNIQUE (exam_package_id, question_order)
);

CREATE INDEX IF NOT EXISTS exam_questions_package_idx ON public.exam_questions(exam_package_id);

-- Optional transactional tables (user attempts)
CREATE TABLE IF NOT EXISTS public.user_exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.exam_packages(id) ON DELETE CASCADE,
  score_total int,
  status text NOT NULL DEFAULT 'started',
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.user_answers (
  session_id uuid NOT NULL REFERENCES public.user_exam_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_chosen text,
  score_obtained int,
  inserted_at timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, question_id)
);

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Authenticated read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Authenticated read categories') THEN
    CREATE POLICY "Authenticated read categories" ON public.categories
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='Authenticated read questions') THEN
    CREATE POLICY "Authenticated read questions" ON public.questions
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exam_packages' AND policyname='Authenticated read exam_packages') THEN
    CREATE POLICY "Authenticated read exam_packages" ON public.exam_packages
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exam_questions' AND policyname='Authenticated read exam_questions') THEN
    CREATE POLICY "Authenticated read exam_questions" ON public.exam_questions
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  -- Admin write (requires public.admin_users)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Admin write categories') THEN
    CREATE POLICY "Admin write categories" ON public.categories
      FOR ALL
      USING (exists (select 1 from public.admin_users where user_id = auth.uid()))
      WITH CHECK (exists (select 1 from public.admin_users where user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='Admin write questions') THEN
    CREATE POLICY "Admin write questions" ON public.questions
      FOR ALL
      USING (exists (select 1 from public.admin_users where user_id = auth.uid()))
      WITH CHECK (exists (select 1 from public.admin_users where user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exam_packages' AND policyname='Admin write exam_packages') THEN
    CREATE POLICY "Admin write exam_packages" ON public.exam_packages
      FOR ALL
      USING (exists (select 1 from public.admin_users where user_id = auth.uid()))
      WITH CHECK (exists (select 1 from public.admin_users where user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exam_questions' AND policyname='Admin write exam_questions') THEN
    CREATE POLICY "Admin write exam_questions" ON public.exam_questions
      FOR ALL
      USING (exists (select 1 from public.admin_users where user_id = auth.uid()))
      WITH CHECK (exists (select 1 from public.admin_users where user_id = auth.uid()));
  END IF;

  -- User sessions/answers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_exam_sessions' AND policyname='Users manage own sessions') THEN
    CREATE POLICY "Users manage own sessions" ON public.user_exam_sessions
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_answers' AND policyname='Users manage own answers') THEN
    CREATE POLICY "Users manage own answers" ON public.user_answers
      FOR ALL
      USING (exists (
        select 1 from public.user_exam_sessions s
        where s.id = user_answers.session_id and s.user_id = auth.uid()
      ))
      WITH CHECK (exists (
        select 1 from public.user_exam_sessions s
        where s.id = user_answers.session_id and s.user_id = auth.uid()
      ));
  END IF;
END $$;

-- ============================================================
-- Data migration: legacy tables -> categories/questions
-- ============================================================

-- Root categories
INSERT INTO public.categories (slug, name, type)
VALUES
  ('skd', 'SKD', 'subject'),
  ('skb', 'SKB', 'subject')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  updated_at = now();

-- Legacy sections -> categories(topic)
WITH roots AS (
  SELECT
    (SELECT id FROM public.categories WHERE slug='skd') AS skd_id,
    (SELECT id FROM public.categories WHERE slug='skb') AS skb_id
),
src AS (
  SELECT
    s.id AS legacy_section_id,
    s.name,
    s.code,
    s.type,
    CASE
      WHEN lower(coalesce(s.code, '')) IN ('skd', 'skb') THEN s.id
      WHEN s.code IS NOT NULL AND s.code <> '' THEN s.code
      ELSE s.id
    END AS base_slug,
    CASE WHEN s.type = 'SKB' THEN (SELECT skb_id FROM roots) ELSE (SELECT skd_id FROM roots) END AS parent_id
  FROM public.legacy_exam_sections s
),
upserted AS (
  INSERT INTO public.categories (legacy_id, slug, name, parent_id, type)
  SELECT
    'section:' || src.legacy_section_id AS legacy_id,
    CASE
      WHEN regexp_replace(regexp_replace(lower(src.base_slug), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') IN ('skd', 'skb')
        THEN 'section-' || regexp_replace(regexp_replace(lower(src.legacy_section_id), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
      ELSE regexp_replace(regexp_replace(lower(src.base_slug), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
    END AS slug,
    src.name,
    src.parent_id,
    'topic'::public.category_type
  FROM src
  ON CONFLICT (legacy_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    type = EXCLUDED.type,
    updated_at = now()
  RETURNING id
)
SELECT 1;

-- Legacy topics -> categories(subtopic)
WITH section_cat AS (
  SELECT legacy_id, id
  FROM public.categories
  WHERE legacy_id LIKE 'section:%'
),
src AS (
  SELECT
    t.id AS legacy_topic_id,
    t.section_id AS legacy_section_id,
    t.name
  FROM public.legacy_exam_topics t
),
upserted AS (
  INSERT INTO public.categories (legacy_id, slug, name, parent_id, type)
  SELECT
    'topic:' || src.legacy_topic_id AS legacy_id,
    regexp_replace(regexp_replace(lower(src.legacy_topic_id), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') AS slug,
    src.name,
    (SELECT id FROM section_cat WHERE legacy_id = 'section:' || src.legacy_section_id),
    'subtopic'::public.category_type
  FROM src
  ON CONFLICT (legacy_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    type = EXCLUDED.type,
    updated_at = now()
  RETURNING id
)
SELECT 1;

-- Legacy questions -> questions
WITH topic_cat AS (
  SELECT legacy_id, id
  FROM public.categories
  WHERE legacy_id LIKE 'topic:%'
),
section_cat AS (
  SELECT legacy_id, id
  FROM public.categories
  WHERE legacy_id LIKE 'section:%'
),
src AS (
  SELECT
    q.id AS legacy_question_id,
    q.section_id AS legacy_section_id,
    q.topic_id AS legacy_topic_id,
    q.prompt,
    q.options,
    q.correct_choice_id,
    q.explanation
  FROM public.legacy_exam_questions q
),
resolved AS (
  SELECT
    src.*,
    COALESCE(
      (SELECT id FROM topic_cat WHERE legacy_id = 'topic:' || src.legacy_topic_id),
      (SELECT id FROM section_cat WHERE legacy_id = 'section:' || src.legacy_section_id)
    ) AS category_id
  FROM src
)
INSERT INTO public.questions (
  legacy_id,
  category_id,
  question_text,
  question_type,
  options,
  answer_key,
  discussion
)
SELECT
  'question:' || resolved.legacy_question_id AS legacy_id,
  resolved.category_id,
  resolved.prompt AS question_text,
  'multiple_choice'::public.question_type AS question_type,
  CASE
    WHEN jsonb_typeof(resolved.options) = 'array' THEN (
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', upper(coalesce(elem->>'id', elem->>'key')),
          'text', elem->>'text'
        )
        ORDER BY ord
      )
      FROM jsonb_array_elements(resolved.options) WITH ORDINALITY AS arr(elem, ord)
    )
    ELSE resolved.options
  END AS options,
  jsonb_build_object(
    'correct', upper(resolved.correct_choice_id),
    'score', 5
  ) AS answer_key,
  resolved.explanation AS discussion
FROM resolved
WHERE resolved.category_id IS NOT NULL
ON CONFLICT (legacy_id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  question_text = EXCLUDED.question_text,
  question_type = EXCLUDED.question_type,
  options = EXCLUDED.options,
  answer_key = EXCLUDED.answer_key,
  discussion = EXCLUDED.discussion,
  updated_at = now();

COMMIT;
