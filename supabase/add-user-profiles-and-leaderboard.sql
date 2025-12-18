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

-- Profiles: public identity + personalization fields.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_username_format CHECK (
    username IS NULL OR username ~ '^[a-z0-9_]{3,20}$'
  )
);

CREATE INDEX IF NOT EXISTS user_profiles_username_idx ON public.user_profiles (username);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_user_profiles_updated_at'
  ) THEN
    CREATE TRIGGER set_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Auto-create profile row when auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display text;
BEGIN
  v_display := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'User'
  );

  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, v_display)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profile'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_profile();
  END IF;
END $$;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='user_profiles' AND policyname='Authenticated read profiles'
  ) THEN
    CREATE POLICY "Authenticated read profiles" ON public.user_profiles
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='user_profiles' AND policyname='Users manage own profile'
  ) THEN
    CREATE POLICY "Users manage own profile" ON public.user_profiles
      FOR ALL
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Leaderboard: rank users based on tryout sessions.
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_mode text DEFAULT 'total',
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  total_score int,
  best_score int,
  tryout_count int,
  last_active timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_mode text := lower(coalesce(p_mode, 'total'));
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 200));
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      s.user_id,
      coalesce(sum(coalesce(s.score_total, 0)), 0)::int AS total_score,
      coalesce(max(coalesce(s.score_total, 0)), 0)::int AS best_score,
      count(*)::int AS tryout_count,
      max(coalesce(s.finished_at, s.started_at)) AS last_active
    FROM public.user_exam_sessions s
    WHERE s.status = 'submitted'
    GROUP BY s.user_id
  )
  SELECT
    st.user_id,
    p.username,
    coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'User') AS display_name,
    st.total_score,
    st.best_score,
    st.tryout_count,
    st.last_active
  FROM stats st
  LEFT JOIN public.user_profiles p ON p.id = st.user_id
  ORDER BY
    CASE WHEN v_mode = 'best' THEN st.best_score ELSE st.total_score END DESC,
    st.last_active DESC
  LIMIT v_limit;
END $$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, int) TO authenticated;

COMMIT;
