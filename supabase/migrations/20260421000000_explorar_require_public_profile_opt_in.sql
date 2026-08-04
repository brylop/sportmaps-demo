-- Migration: 20260421000000_explorar_require_public_profile_opt_in.sql
-- Description: Explorar solo muestra escuelas con public_profile_enabled=true en school_settings.
-- Afecta las RPCs search_schools y schools_near_location.

-- ── 1. search_schools: agrega filtro obligatorio por opt-in ─────────────────
CREATE OR REPLACE FUNCTION search_schools(
  p_query text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_sport text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_price_max numeric DEFAULT NULL,
  p_rating_min numeric DEFAULT NULL,
  p_age numeric DEFAULT NULL,
  p_verified boolean DEFAULT NULL,
  p_open_now boolean DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL,
  p_distance_km numeric DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 24,
  p_order_by text DEFAULT 'rating'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer;
  v_data jsonb;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  WITH base_schools AS (
    SELECT
      sp.id,
      sp.name,
      sp.city,
      sp.address,
      sp.logo_url,
      sp.cover_image_url,
      sp.verified,
      sp.category_name,
      sp.category_icon,
      sp.avg_rating,
      sp.review_count,
      sp.min_price,
      sp.max_price,
      sp.main_lat,
      sp.main_lng,
      sp.program_sports,
      is_school_open_now(sp.id) as is_open_now,
      get_distance_km(p_lat, p_lng, sp.main_lat, sp.main_lng) as distance_km
    FROM school_public_profile sp
    WHERE
      EXISTS (
        SELECT 1 FROM school_settings ss
        WHERE ss.school_id = sp.id AND ss.public_profile_enabled = true
      )
      AND (p_query IS NULL OR sp.name ILIKE '%' || p_query || '%' OR sp.description ILIKE '%' || p_query || '%')
      AND (p_city IS NULL OR sp.city ILIKE '%' || p_city || '%')
      AND (p_sport IS NULL OR p_sport = ANY(sp.program_sports))
      AND (p_category IS NULL OR sp.category_name = p_category)
      AND (p_price_max IS NULL OR sp.min_price <= p_price_max)
      AND (p_rating_min IS NULL OR sp.avg_rating >= p_rating_min)
      AND (p_verified IS NULL OR sp.verified = p_verified)
      AND (p_age IS NULL OR EXISTS (
        SELECT 1 FROM teams t WHERE t.school_id = sp.id AND t.active = true AND t.age_min <= p_age AND t.age_max >= p_age
      ))
  ),
  filtered_by_open_and_distance AS (
    SELECT * FROM base_schools
    WHERE
      (p_open_now IS NULL OR is_open_now = p_open_now)
      AND (p_distance_km IS NULL OR distance_km IS NULL OR distance_km <= p_distance_km)
  ),
  total_count AS (
    SELECT count(*) as total FROM filtered_by_open_and_distance
  ),
  sorted_data AS (
    SELECT * FROM filtered_by_open_and_distance
    ORDER BY
      CASE WHEN p_order_by = 'distance' THEN distance_km END ASC NULLS LAST,
      CASE WHEN p_order_by = 'price_asc' THEN min_price END ASC NULLS LAST,
      CASE WHEN p_order_by = 'price_desc' THEN min_price END DESC NULLS LAST,
      CASE WHEN p_order_by = 'rating' THEN avg_rating END DESC NULLS LAST,
      id
    LIMIT p_limit
    OFFSET v_offset
  )

  SELECT
    jsonb_build_object(
      'data', COALESCE((SELECT jsonb_agg(row_to_json(sd)) FROM sorted_data sd), '[]'::jsonb),
      'pagination', jsonb_build_object(
        'total', COALESCE((SELECT total FROM total_count), 0),
        'page', p_page,
        'limit', p_limit,
        'total_pages', CEIL(COALESCE((SELECT total::numeric FROM total_count), 0) / p_limit)
      ),
      'filters_applied', jsonb_build_object(
        'query', p_query,
        'city', p_city,
        'sport', p_sport,
        'price_max', p_price_max,
        'rating_min', p_rating_min,
        'lat', p_lat,
        'lng', p_lng,
        'distance_km', p_distance_km
      )
    ) INTO v_data;

  RETURN v_data;
END;
$$;

-- ── 2. schools_near_location: mismo filtro obligatorio ──────────────────────
CREATE OR REPLACE FUNCTION schools_near_location(
  p_lat numeric,
  p_lng numeric,
  p_radius_km numeric DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(res)), '[]'::jsonb) INTO v_data
  FROM (
    SELECT
      sp.id,
      sp.name,
      sp.logo_url,
      sp.category_name,
      sp.category_icon,
      sp.avg_rating,
      sp.main_lat as lat,
      sp.main_lng as lng,
      get_distance_km(p_lat, p_lng, sp.main_lat, sp.main_lng) as distance_km
    FROM school_public_profile sp
    WHERE sp.main_lat IS NOT NULL AND sp.main_lng IS NOT NULL
      AND get_distance_km(p_lat, p_lng, sp.main_lat, sp.main_lng) <= p_radius_km
      AND EXISTS (
        SELECT 1 FROM school_settings ss
        WHERE ss.school_id = sp.id AND ss.public_profile_enabled = true
      )
    ORDER BY distance_km ASC
    LIMIT 50
  ) res;

  RETURN v_data;
END;
$$;

GRANT EXECUTE ON FUNCTION search_schools(text, text, text, text, numeric, numeric, numeric, boolean, boolean, numeric, numeric, numeric, integer, integer, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION schools_near_location(numeric, numeric, numeric) TO authenticated, anon;
