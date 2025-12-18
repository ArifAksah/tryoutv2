BEGIN;

-- Generate SKB questions in one call based on institutions + exam_blueprints.
-- Picks random questions per blueprint category, including its descendant categories.
-- Requires: categories, questions, institutions, exam_blueprints tables.

CREATE OR REPLACE FUNCTION public.generate_institution_questions(institution_code text)
RETURNS TABLE (
  id uuid,
  topic_slug text,
  topic_name text,
  question_text text,
  question_type public.question_type,
  options jsonb,
  answer_key jsonb,
  discussion text
)
LANGUAGE sql
VOLATILE
AS $$
  WITH RECURSIVE inst AS (
    SELECT i.id
    FROM public.institutions i
    WHERE upper(i.code) = upper(institution_code)
    LIMIT 1
  ),
  bp AS (
    SELECT b.category_id AS root_category_id,
           b.question_count
    FROM public.exam_blueprints b
    WHERE b.institution_id = (SELECT id FROM inst)
  ),
  tree AS (
    SELECT bp.root_category_id, bp.root_category_id AS category_id
    FROM bp
    UNION ALL
    SELECT tree.root_category_id, c.id AS category_id
    FROM public.categories c
    JOIN tree ON c.parent_id = tree.category_id
  ),
  pool AS (
    SELECT
      tree.root_category_id,
      q.id,
      q.question_text,
      q.question_type,
      q.options,
      q.answer_key,
      q.discussion
    FROM tree
    JOIN public.questions q ON q.category_id = tree.category_id
  ),
  ranked AS (
    SELECT
      p.*,
      row_number() OVER (PARTITION BY p.root_category_id ORDER BY random()) AS rn
    FROM pool p
  ),
  picked AS (
    SELECT
      r.*
    FROM ranked r
    JOIN bp ON bp.root_category_id = r.root_category_id
    WHERE r.rn <= bp.question_count
  )
  SELECT
    picked.id,
    c.slug AS topic_slug,
    c.name AS topic_name,
    picked.question_text,
    picked.question_type,
    picked.options,
    picked.answer_key,
    picked.discussion
  FROM picked
  JOIN public.categories c ON c.id = picked.root_category_id
  ORDER BY c.slug, random();
$$;

GRANT EXECUTE ON FUNCTION public.generate_institution_questions(text) TO authenticated;

COMMIT;
