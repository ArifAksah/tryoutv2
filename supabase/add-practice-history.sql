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

-- Practice attempt history (latihan) stored per user + category.
CREATE TABLE IF NOT EXISTS public.user_practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  take_count int NOT NULL CHECK (take_count > 0),
  question_ids uuid[] NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  doubts jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_total int NOT NULL DEFAULT 0,
  max_score int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  total_questions int NOT NULL DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_practice_sessions_user_idx ON public.user_practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_practice_sessions_category_idx ON public.user_practice_sessions(category_id);
CREATE INDEX IF NOT EXISTS user_practice_sessions_user_category_idx ON public.user_practice_sessions(user_id, category_id);

ALTER TABLE public.user_practice_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='user_practice_sessions' AND policyname='Users manage own practice sessions'
  ) THEN
    CREATE POLICY "Users manage own practice sessions" ON public.user_practice_sessions
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
