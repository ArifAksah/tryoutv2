-- Diagnose and Fix Category Hierarchy Issues
-- Run this to identify and fix circular references and structure problems

BEGIN;

-- Step 1: Identify the problematic category
SELECT 
  id,
  slug,
  name,
  parent_id,
  type,
  CASE 
    WHEN id = parent_id THEN '⚠️ SELF-REFERENCE!'
    ELSE 'OK'
  END AS status
FROM public.categories
WHERE id = 'b393de94-d3a6-4656-ae4c-8b0b4d6e86d9'
   OR parent_id = 'b393de94-d3a6-4656-ae4c-8b0b4d6e86d9';

-- Step 2: Check for all self-referencing categories
SELECT 
  id,
  slug,
  name,
  parent_id,
  type,
  '⚠️ SELF-REFERENCE DETECTED!' AS issue
FROM public.categories
WHERE id = parent_id;

-- Step 3: Show complete hierarchy structure
WITH RECURSIVE tree AS (
  SELECT 
    id,
    slug,
    name,
    parent_id,
    type,
    0 AS level,
    slug::text AS path,
    ARRAY[id] AS id_path
  FROM public.categories
  WHERE parent_id IS NULL
  
  UNION ALL
  
  SELECT 
    c.id,
    c.slug,
    c.name,
    c.parent_id,
    c.type,
    t.level + 1,
    t.path || ' > ' || c.slug,
    t.id_path || c.id
  FROM public.categories c
  INNER JOIN tree t ON c.parent_id = t.id
  WHERE NOT (c.id = ANY(t.id_path)) -- Prevent circular references
    AND t.level < 10 -- Safety limit
)
SELECT 
  level,
  repeat('  ', level) || name AS hierarchy,
  slug,
  type,
  id,
  parent_id
FROM tree
ORDER BY path;

-- Step 4: Fix self-referencing categories by setting parent_id to NULL
UPDATE public.categories
SET parent_id = NULL,
    updated_at = now()
WHERE id = parent_id;

-- Step 5: Verify roots (should be 'skd' and optionally 'skb')
SELECT 
  id,
  slug,
  name,
  type,
  parent_id
FROM public.categories
WHERE parent_id IS NULL
ORDER BY name;

-- Step 6: Verify main categories (twk, tiu, tkp should have parent = skd)
WITH skd AS (
  SELECT id FROM public.categories WHERE slug = 'skd' LIMIT 1
)
SELECT 
  c.id,
  c.slug,
  c.name,
  c.type,
  c.parent_id,
  CASE 
    WHEN c.parent_id = (SELECT id FROM skd) THEN '✅ Correct parent'
    ELSE '⚠️ Wrong or NULL parent'
  END AS status
FROM public.categories c
WHERE c.slug IN ('twk', 'tiu', 'tkp');

-- Step 7: Show orphaned categories (categories that should have parent but don't)
SELECT 
  id,
  slug,
  name,
  type,
  parent_id
FROM public.categories
WHERE parent_id IS NULL
  AND slug NOT IN ('skd', 'skb')
  AND (slug LIKE 'twk%' OR slug LIKE 'tiu%' OR slug LIKE 'tkp%')
ORDER BY slug;

COMMIT;

-- After running this, check the output and share the results!
-- Then we can create a proper fix based on what we find.
