-- Check where questions are actually stored and their category distribution

BEGIN;

-- 1. Show all categories with their question counts
SELECT 
  c.slug,
  c.name,
  c.type,
  c.parent_id,
  COUNT(q.id) AS question_count,
  CASE 
    WHEN COUNT(q.id) > 0 THEN '✅ Has questions'
    ELSE '⚠️ No questions'
  END AS status
FROM public.categories c
LEFT JOIN public.questions q ON q.category_id = c.id
GROUP BY c.id, c.slug, c.name, c.type, c.parent_id
ORDER BY question_count DESC, c.slug;

-- 2. Check sample questions and their category slugs
SELECT 
  q.id,
  c.slug AS category_slug,
  c.name AS category_name,
  c.type AS category_type,
  LEFT(q.question_text, 60) AS question_preview
FROM public.questions q
JOIN public.categories c ON c.id = q.category_id
LIMIT 20;

-- 3. Find parent category for questions (to understand hierarchy)
WITH question_categories AS (
  SELECT 
    q.id AS question_id,
    c.id AS cat_id,
    c.slug AS cat_slug,
    c.name AS cat_name,
    c.parent_id,
    c.type AS cat_type
  FROM public.questions q
  JOIN public.categories c ON c.id = q.category_id
)
SELECT 
  qc.cat_slug,
  qc.cat_name,
  qc.cat_type,
  p.slug AS parent_slug,
  p.name AS parent_name,
  p.type AS parent_type,
  COUNT(qc.question_id) AS question_count
FROM question_categories qc
LEFT JOIN public.categories p ON p.id = qc.parent_id
GROUP BY qc.cat_slug, qc.cat_name, qc.cat_type, p.slug, p.name, p.type
ORDER BY question_count DESC;

-- 4. Check if questions need to be migrated
SELECT 
  'DIAGNOSIS' AS section,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.categories c ON c.id = q.category_id
      WHERE c.slug IN ('twk', 'tiu', 'tkp')
    ) THEN '✅ Questions are in sections (TWK/TIU/TKP)'
    
    WHEN EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.categories c ON c.id = q.category_id
      WHERE c.slug LIKE 'twk-%' OR c.slug LIKE 'tiu-%' OR c.slug LIKE 'tkp-%'
    ) THEN '⚠️ Questions are in SUB-TOPICS (need to stay there, just fix display)'
    
    ELSE '❌ Questions not found or in wrong categories'
  END AS status;

COMMIT;

-- Expected behavior:
-- Questions SHOULD be in sub-topics (twk-pancasila, tiu-deret, etc)
-- Tryout should use recursive query to get questions from section + all children
-- Dashboard should only DISPLAY sections (TWK/TIU/TKP), not sub-topics
