BEGIN;

-- Function to pick random questions from a category (including descendants)
-- Used for practice mode
CREATE OR REPLACE FUNCTION public.pick_random_questions(
  p_category_id uuid,
  p_take int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  question_text text,
  question_type public.question_type,
  options jsonb,
  answer_key jsonb,
  discussion text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_take int := GREATEST(1, COALESCE(p_take, 1));
BEGIN
  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT p_category_id AS id
    UNION ALL
    SELECT c.id
    FROM public.categories c
    JOIN tree t ON c.parent_id = t.id
  )
  SELECT
    q.id,
    q.question_text,
    q.question_type,
    q.options,
    q.answer_key,
    q.discussion
  FROM public.questions q
  WHERE q.category_id IN (SELECT tree.id FROM tree)
  ORDER BY random()
  LIMIT v_take;
END $$;

GRANT EXECUTE ON FUNCTION public.pick_random_questions(uuid, int) TO authenticated;

COMMIT;
