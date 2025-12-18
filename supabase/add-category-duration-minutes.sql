BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS duration_minutes int;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_duration_minutes_check'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_duration_minutes_check
      CHECK (duration_minutes IS NULL OR duration_minutes > 0);
  END IF;
END $$;

COMMIT;
