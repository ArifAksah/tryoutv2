-- Add helper function to count questions recursively (including all descendants)
-- This is needed for dashboard to show question counts correctly

BEGIN;

CREATE OR REPLACE FUNCTION public.count_questions_recursive(category_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_count int;
BEGIN
  -- Use recursive CTE to get all descendant categories
  WITH RECURSIVE tree AS (
    SELECT category_id AS id
    UNION ALL
    SELECT c.id
    FROM public.categories c
    JOIN tree t ON c.parent_id = t.id
  )
  SELECT COUNT(*)::int INTO v_count
  FROM public.questions q
  WHERE q.category_id IN (SELECT id FROM tree);
  
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.count_questions_recursive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_questions_recursive(uuid) TO anon;

-- Test the function
DO $$
DECLARE
  v_twk_id uuid;
  v_tiu_id uuid;
  v_tkp_id uuid;
  v_twk_count int;
  v_tiu_count int;
  v_tkp_count int;
BEGIN
  SELECT id INTO v_twk_id FROM public.categories WHERE slug = 'twk';
  SELECT id INTO v_tiu_id FROM public.categories WHERE slug = 'tiu';
  SELECT id INTO v_tkp_id FROM public.categories WHERE slug = 'tkp';
  
  IF v_twk_id IS NOT NULL THEN
    SELECT count_questions_recursive(v_twk_id) INTO v_twk_count;
    RAISE NOTICE 'TWK question count: %', v_twk_count;
  END IF;
  
  IF v_tiu_id IS NOT NULL THEN
    SELECT count_questions_recursive(v_tiu_id) INTO v_tiu_count;
    RAISE NOTICE 'TIU question count: %', v_tiu_count;
  END IF;
  
  IF v_tkp_id IS NOT NULL THEN
    SELECT count_questions_recursive(v_tkp_id) INTO v_tkp_count;
    RAISE NOTICE 'TKP question count: %', v_tkp_count;
  END IF;
END $$;

COMMIT;

-- After running this, the dashboard should show correct question counts
