BEGIN;

-- Leaderboard per tryout package (requires exam_packages.slug)
CREATE OR REPLACE FUNCTION public.get_package_leaderboard(
  p_package_slug text,
  p_mode text DEFAULT 'best',
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  best_score int,
  total_score int,
  tryout_count int,
  last_active timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id uuid;
  v_mode text := lower(coalesce(p_mode, 'best'));
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 200));
  v_package_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_package_id
  FROM public.exam_packages
  WHERE slug = p_package_slug
  LIMIT 1;

  IF v_package_id IS NULL THEN
    RAISE EXCEPTION 'Package not found: %', p_package_slug;
  END IF;

  RETURN QUERY
  WITH stats AS (
    SELECT
      s.user_id,
      coalesce(sum(coalesce(s.score_total, 0)), 0)::int AS total_score,
      coalesce(max(coalesce(s.score_total, 0)), 0)::int AS best_score,
      count(*)::int AS tryout_count,
      max(coalesce(s.finished_at, s.started_at)) AS last_active
    FROM public.user_exam_sessions s
    WHERE s.package_id = v_package_id
      AND s.status = 'submitted'
    GROUP BY s.user_id
  )
  SELECT
    st.user_id,
    p.username,
    coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'User') AS display_name,
    st.best_score,
    st.total_score,
    st.tryout_count,
    st.last_active
  FROM stats st
  LEFT JOIN public.user_profiles p ON p.id = st.user_id
  ORDER BY
    CASE WHEN v_mode = 'total' THEN st.total_score ELSE st.best_score END DESC,
    st.last_active DESC
  LIMIT v_limit;
END $$;

GRANT EXECUTE ON FUNCTION public.get_package_leaderboard(text, text, int) TO authenticated;

-- Leaderboard per practice topic (category slug)
CREATE OR REPLACE FUNCTION public.get_practice_leaderboard(
  p_category_slug text,
  p_mode text DEFAULT 'best_pct',
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  best_score int,
  best_max_score int,
  best_pct numeric,
  total_score int,
  total_max_score int,
  session_count int,
  last_active timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id uuid;
  v_mode text := lower(coalesce(p_mode, 'best_pct'));
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 200));
  v_category_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_category_id
  FROM public.categories
  WHERE slug = p_category_slug
  LIMIT 1;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Category not found: %', p_category_slug;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.user_id,
      coalesce(s.score_total, 0)::int AS score_total,
      greatest(coalesce(s.max_score, 0), 0)::int AS max_score,
      coalesce(s.finished_at, s.started_at) AS ts
    FROM public.user_practice_sessions s
    WHERE s.category_id = v_category_id
  ),
  agg AS (
    SELECT
      b.user_id,
      sum(b.score_total)::int AS total_score,
      sum(b.max_score)::int AS total_max_score,
      max(b.score_total)::int AS best_score,
      max(b.max_score)::int AS best_max_score,
      max(CASE WHEN b.max_score > 0 THEN (b.score_total::numeric / b.max_score::numeric) ELSE 0 END) AS best_pct,
      count(*)::int AS session_count,
      max(b.ts) AS last_active
    FROM base b
    GROUP BY b.user_id
  )
  SELECT
    a.user_id,
    p.username,
    coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'User') AS display_name,
    a.best_score,
    a.best_max_score,
    a.best_pct,
    a.total_score,
    a.total_max_score,
    a.session_count,
    a.last_active
  FROM agg a
  LEFT JOIN public.user_profiles p ON p.id = a.user_id
  ORDER BY
    CASE
      WHEN v_mode = 'total' THEN a.total_score::numeric
      WHEN v_mode = 'best' THEN a.best_score::numeric
      ELSE a.best_pct
    END DESC,
    a.last_active DESC
  LIMIT v_limit;
END $$;

GRANT EXECUTE ON FUNCTION public.get_practice_leaderboard(text, text, int) TO authenticated;

COMMIT;
