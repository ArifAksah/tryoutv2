-- Fix SKD Categories Structure
-- This script creates the parent categories (skd, twk, tiu, tkp) and updates existing sub-categories
-- to have the correct parent_id relationships.
--
-- Run this if you get error: "SKD categories (twk/tiu/tkp) not found"
--
-- Usage:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this script
--   3. Click "Run"

BEGIN;

-- Step 1: Create root category 'skd' if not exists
INSERT INTO public.categories (slug, name, type)
VALUES ('skd', 'SKD (Seleksi Kompetensi Dasar)', 'subject')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  updated_at = now();

-- Step 2: Create main categories (twk, tiu, tkp) as children of skd
WITH skd AS (
  SELECT id FROM public.categories WHERE slug = 'skd' LIMIT 1
)
INSERT INTO public.categories (slug, name, parent_id, type)
VALUES
  ('twk', 'TWK (Tes Wawasan Kebangsaan)', (SELECT id FROM skd), 'topic'),
  ('tiu', 'TIU (Tes Intelegensi Umum)', (SELECT id FROM skd), 'topic'),
  ('tkp', 'TKP (Tes Karakteristik Pribadi)', (SELECT id FROM skd), 'topic')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  type = EXCLUDED.type,
  updated_at = now();

-- Step 3: Update existing TWK sub-categories to have twk as parent
WITH twk AS (
  SELECT id FROM public.categories WHERE slug = 'twk' LIMIT 1
)
UPDATE public.categories
SET parent_id = (SELECT id FROM twk),
    type = 'subtopic',
    updated_at = now()
WHERE slug LIKE 'twk-%'
  AND slug != 'twk'
  AND parent_id IS NULL OR parent_id != (SELECT id FROM twk);

-- Step 4: Update existing TIU sub-categories to have tiu as parent
WITH tiu AS (
  SELECT id FROM public.categories WHERE slug = 'tiu' LIMIT 1
)
UPDATE public.categories
SET parent_id = (SELECT id FROM tiu),
    type = 'subtopic',
    updated_at = now()
WHERE slug LIKE 'tiu-%'
  AND slug != 'tiu'
  AND parent_id IS NULL OR parent_id != (SELECT id FROM tiu);

-- Step 5: Update existing TKP sub-categories to have tkp as parent
WITH tkp AS (
  SELECT id FROM public.categories WHERE slug = 'tkp' LIMIT 1
)
UPDATE public.categories
SET parent_id = (SELECT id FROM tkp),
    type = 'subtopic',
    updated_at = now()
WHERE slug LIKE 'tkp-%'
  AND slug != 'tkp'
  AND parent_id IS NULL OR parent_id != (SELECT id FROM tkp);

-- Step 6: Verify the structure
DO $$
DECLARE
  v_skd_id uuid;
  v_twk_id uuid;
  v_tiu_id uuid;
  v_tkp_id uuid;
  v_twk_children int;
  v_tiu_children int;
  v_tkp_children int;
BEGIN
  -- Check if main categories exist
  SELECT id INTO v_skd_id FROM public.categories WHERE slug = 'skd';
  SELECT id INTO v_twk_id FROM public.categories WHERE slug = 'twk';
  SELECT id INTO v_tiu_id FROM public.categories WHERE slug = 'tiu';
  SELECT id INTO v_tkp_id FROM public.categories WHERE slug = 'tkp';

  IF v_skd_id IS NULL THEN
    RAISE EXCEPTION '❌ SKD category not found!';
  END IF;

  IF v_twk_id IS NULL OR v_tiu_id IS NULL OR v_tkp_id IS NULL THEN
    RAISE EXCEPTION '❌ One or more main categories (TWK/TIU/TKP) not found!';
  END IF;

  -- Count children
  SELECT count(*) INTO v_twk_children FROM public.categories WHERE parent_id = v_twk_id;
  SELECT count(*) INTO v_tiu_children FROM public.categories WHERE parent_id = v_tiu_id;
  SELECT count(*) INTO v_tkp_children FROM public.categories WHERE parent_id = v_tkp_id;

  RAISE NOTICE '✅ Categories structure fixed successfully!';
  RAISE NOTICE 'SKD ID: %', v_skd_id;
  RAISE NOTICE 'TWK ID: % (% sub-categories)', v_twk_id, v_twk_children;
  RAISE NOTICE 'TIU ID: % (% sub-categories)', v_tiu_id, v_tiu_children;
  RAISE NOTICE 'TKP ID: % (% sub-categories)', v_tkp_id, v_tkp_children;
  RAISE NOTICE '';
  RAISE NOTICE '✅ You can now start SKD tryouts!';
END $$;

COMMIT;
