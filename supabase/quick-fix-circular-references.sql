-- QUICK FIX: Remove all circular references immediately
-- This will fix the hanging issue by removing self-references

BEGIN;

-- Fix 1: Remove self-references (category pointing to itself)
UPDATE public.categories
SET parent_id = NULL,
    updated_at = now()
WHERE id = parent_id;

-- Fix 2: Ensure twk/tiu/tkp have correct parent (skd)
WITH skd AS (
  SELECT id FROM public.categories WHERE slug = 'skd' LIMIT 1
)
UPDATE public.categories
SET parent_id = (SELECT id FROM skd),
    type = 'topic',
    updated_at = now()
WHERE slug IN ('twk', 'tiu', 'tkp')
  AND (parent_id IS NULL OR parent_id != (SELECT id FROM skd));

-- Verify the fix
DO $$
DECLARE
  v_self_ref_count int;
  v_twk_parent uuid;
  v_tiu_parent uuid;
  v_tkp_parent uuid;
  v_skd_id uuid;
BEGIN
  -- Check for remaining self-references
  SELECT count(*) INTO v_self_ref_count
  FROM public.categories
  WHERE id = parent_id;
  
  IF v_self_ref_count > 0 THEN
    RAISE WARNING '⚠️ Still have % self-referencing categories!', v_self_ref_count;
  ELSE
    RAISE NOTICE '✅ No self-references found';
  END IF;
  
  -- Check twk/tiu/tkp parents
  SELECT id INTO v_skd_id FROM public.categories WHERE slug = 'skd';
  SELECT parent_id INTO v_twk_parent FROM public.categories WHERE slug = 'twk';
  SELECT parent_id INTO v_tiu_parent FROM public.categories WHERE slug = 'tiu';
  SELECT parent_id INTO v_tkp_parent FROM public.categories WHERE slug = 'tkp';
  
  IF v_twk_parent = v_skd_id AND v_tiu_parent = v_skd_id AND v_tkp_parent = v_skd_id THEN
    RAISE NOTICE '✅ TWK/TIU/TKP have correct parent (SKD)';
  ELSE
    RAISE WARNING '⚠️ TWK/TIU/TKP parents are not correct';
    RAISE NOTICE 'TWK parent: % (should be: %)', v_twk_parent, v_skd_id;
    RAISE NOTICE 'TIU parent: % (should be: %)', v_tiu_parent, v_skd_id;
    RAISE NOTICE 'TKP parent: % (should be: %)', v_tkp_parent, v_skd_id;
  END IF;
END $$;

COMMIT;

-- After running this, refresh the admin questions page!
