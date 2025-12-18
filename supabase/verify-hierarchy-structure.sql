-- Verify Category Hierarchy Structure
-- Run this to see what's being displayed in dashboard

BEGIN;

-- 1. Check root categories (should be 'skd' and optionally 'skb')
SELECT 
  'ROOT CATEGORIES' AS section,
  id,
  slug,
  name,
  type,
  parent_id
FROM public.categories
WHERE parent_id IS NULL
ORDER BY slug;

-- 2. Check direct children of SKD (should be TWK, TIU, TKP only)
WITH skd AS (
  SELECT id FROM public.categories WHERE slug = 'skd' LIMIT 1
)
SELECT 
  'SECTIONS (Children of SKD)' AS section,
  c.id,
  c.slug,
  c.name,
  c.type,
  c.parent_id
FROM public.categories c
WHERE c.parent_id = (SELECT id FROM skd)
ORDER BY c.slug;

-- 3. Check if there are any categories that should be children but have wrong parent
SELECT 
  'POTENTIAL ORPHANS' AS section,
  id,
  slug,
  name,
  type,
  parent_id,
  CASE 
    WHEN slug LIKE 'twk-%' THEN 'Should be child of TWK'
    WHEN slug LIKE 'tiu-%' THEN 'Should be child of TIU'
    WHEN slug LIKE 'tkp-%' THEN 'Should be child of TKP'
    ELSE 'Unknown'
  END AS expected_parent
FROM public.categories
WHERE parent_id IS NULL
  AND slug NOT IN ('skd', 'skb')
  AND (slug LIKE 'twk-%' OR slug LIKE 'tiu-%' OR slug LIKE 'tkp-%')
ORDER BY slug;

-- 4. Show full hierarchy structure
WITH RECURSIVE tree AS (
  SELECT 
    id,
    slug,
    name,
    parent_id,
    type,
    0 AS level,
    slug::text AS path
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
    t.path || ' > ' || c.slug
  FROM public.categories c
  INNER JOIN tree t ON c.parent_id = t.id
  WHERE t.level < 10
)
SELECT 
  'FULL HIERARCHY' AS section,
  level,
  repeat('  ', level) || name AS hierarchy,
  slug,
  type,
  parent_id
FROM tree
WHERE path LIKE '%skd%'
ORDER BY path;

-- 5. Count questions per category
SELECT 
  'QUESTION COUNT' AS section,
  c.slug,
  c.name,
  c.type,
  COUNT(q.id) AS question_count
FROM public.categories c
LEFT JOIN public.questions q ON q.category_id = c.id
WHERE c.parent_id IS NULL OR c.slug IN ('twk', 'tiu', 'tkp')
GROUP BY c.id, c.slug, c.name, c.type
ORDER BY c.slug;

COMMIT;

-- Expected output for dashboard to work correctly:
-- ROOT: skd (and optionally skb)
-- SECTIONS: twk, tiu, tkp (all with parent_id = skd.id)
-- SUBTOPICS: twk-*, tiu-*, tkp-* (with parent_id = respective section)
