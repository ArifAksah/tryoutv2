BEGIN;

-- Drop the existing FK to auth.users if it complicates PostgREST joins with user_profiles
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_fkey;

-- Add FK to public.user_profiles
-- This assumes user_profiles.id is the same as auth.users.id (it is)
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.user_profiles(id)
  ON DELETE CASCADE;

COMMIT;
