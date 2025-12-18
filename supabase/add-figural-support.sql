BEGIN;

-- Add figural question type
DO $$
BEGIN
  -- Add 'figural' to question_type enum
  ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'figural';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add columns for image support in questions table
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS question_image_url text,
  ADD COLUMN IF NOT EXISTS question_image_alt text;

COMMENT ON COLUMN public.questions.question_image_url IS 'URL gambar untuk soal figural';
COMMENT ON COLUMN public.questions.question_image_alt IS 'Alt text untuk gambar soal';

-- Note: options jsonb already supports image URLs per option
-- Format for figural questions:
-- options: [
--   { "key": "A", "text": "Pilihan A", "image_url": "https://...", "image_alt": "..." },
--   { "key": "B", "text": "Pilihan B", "image_url": "https://...", "image_alt": "..." }
-- ]

COMMIT;
