-- Migration: 20260421000001_explore_map_trainers_and_opt_in.sql
-- Description: Actualiza search_explore_map para
--   1) exigir school_settings.public_profile_enabled=true en schools
--   2) agregar seccion trainers (trainer_profiles is_published=true con lat/lng)

CREATE OR REPLACE FUNCTION public.search_explore_map(
    p_category text DEFAULT 'all',
    p_query text DEFAULT NULL,
    p_city text DEFAULT NULL,
    p_sport text DEFAULT NULL,
    p_service_type text DEFAULT NULL,
    p_bounds_sw_lat numeric DEFAULT NULL,
    p_bounds_sw_lng numeric DEFAULT NULL,
    p_bounds_ne_lat numeric DEFAULT NULL,
    p_bounds_ne_lng numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_markers jsonb := '[]';
    v_services jsonb := '[]';
    v_trainers jsonb := '[]';
    v_events jsonb := '[]';
    v_schools jsonb := '[]';
    v_use_bounds boolean;
BEGIN
    v_use_bounds := (p_bounds_sw_lat IS NOT NULL AND p_bounds_sw_lng IS NOT NULL
                     AND p_bounds_ne_lat IS NOT NULL AND p_bounds_ne_lng IS NOT NULL);

    -- ── Services (vendor_profiles con servicios activos) ────────────────
    IF p_category IN ('all', 'services') THEN
        SELECT COALESCE(jsonb_agg(item), '[]') INTO v_services
        FROM (
            SELECT DISTINCT ON (vp.id) jsonb_build_object(
                'id', sl.id,
                'item_type', 'service',
                'name', sl.name,
                'lat', vp.lat,
                'lng', vp.lng,
                'price', sl.price,
                'service_type', sl.service_type,
                'vendor_name', vp.display_name,
                'vendor_slug', vp.slug,
                'vendor_city', vp.city,
                'vendor_verified', vp.verification_status = 'verified',
                'vendor_logo', vp.logo_url,
                'duration_minutes', sl.duration_minutes
            ) AS item
            FROM service_listings sl
            JOIN vendor_profiles vp ON vp.id = sl.vendor_profile_id
            WHERE sl.is_active = true
              AND sl.visibility = 'public'
              AND vp.is_active = true
              AND vp.lat IS NOT NULL
              AND vp.lng IS NOT NULL
              AND (p_query IS NULL OR sl.name ILIKE '%' || p_query || '%' OR vp.display_name ILIKE '%' || p_query || '%')
              AND (p_city IS NULL OR vp.city ILIKE '%' || p_city || '%')
              AND (p_service_type IS NULL OR sl.service_type = p_service_type)
              AND (NOT v_use_bounds OR (
                  vp.lat BETWEEN p_bounds_sw_lat AND p_bounds_ne_lat
                  AND vp.lng BETWEEN p_bounds_sw_lng AND p_bounds_ne_lng
              ))
            ORDER BY vp.id, sl.created_at DESC
            LIMIT 100
        ) sub;
    END IF;

    -- ── Trainers (trainer_profiles publicados con coordenadas) ──────────
    IF p_category IN ('all', 'trainers') THEN
        SELECT COALESCE(jsonb_agg(item), '[]') INTO v_trainers
        FROM (
            SELECT jsonb_build_object(
                'id', tp.id,
                'item_type', 'trainer',
                'name', tp.display_name,
                'lat', tp.lat,
                'lng', tp.lng,
                'price', tp.rate_per_session,
                'vendor_name', tp.display_name,
                'vendor_city', tp.city,
                'vendor_logo', tp.avatar_url,
                'trainer_user_id', tp.user_id,
                'primary_sport', tp.primary_sport,
                'modality', tp.modality,
                'specialties', tp.specialties,
                'experience_years', tp.experience_years,
                'rating', tp.rating,
                'review_count', tp.review_count
            ) AS item
            FROM trainer_profiles tp
            WHERE tp.is_published = true
              AND tp.lat IS NOT NULL
              AND tp.lng IS NOT NULL
              AND (p_query IS NULL OR tp.display_name ILIKE '%' || p_query || '%' OR tp.tagline ILIKE '%' || p_query || '%')
              AND (p_city IS NULL OR tp.city ILIKE '%' || p_city || '%')
              AND (p_sport IS NULL OR tp.primary_sport ILIKE '%' || p_sport || '%')
              AND (NOT v_use_bounds OR (
                  tp.lat BETWEEN p_bounds_sw_lat AND p_bounds_ne_lat
                  AND tp.lng BETWEEN p_bounds_sw_lng AND p_bounds_ne_lng
              ))
            ORDER BY tp.rating DESC NULLS LAST
            LIMIT 100
        ) sub;
    END IF;

    -- ── Events ──────────────────────────────────────────────────────────
    IF p_category IN ('all', 'events') THEN
        SELECT COALESCE(jsonb_agg(item), '[]') INTO v_events
        FROM (
            SELECT jsonb_build_object(
                'id', e.id,
                'item_type', 'event',
                'name', e.title,
                'lat', e.lat,
                'lng', e.lng,
                'price', e.price,
                'event_date', e.event_date,
                'event_time', e.start_time,
                'event_type', e.event_type,
                'sport', e.sport,
                'city', e.city,
                'capacity', e.capacity,
                'slug', e.slug,
                'registrations_open', e.registrations_open
            ) AS item
            FROM events e
            WHERE e.status = 'active'
              AND e.event_date >= CURRENT_DATE
              AND e.lat IS NOT NULL
              AND e.lng IS NOT NULL
              AND (p_query IS NULL OR e.title ILIKE '%' || p_query || '%')
              AND (p_city IS NULL OR e.city ILIKE '%' || p_city || '%')
              AND (p_sport IS NULL OR e.sport ILIKE '%' || p_sport || '%')
              AND (NOT v_use_bounds OR (
                  e.lat BETWEEN p_bounds_sw_lat AND p_bounds_ne_lat
                  AND e.lng BETWEEN p_bounds_sw_lng AND p_bounds_ne_lng
              ))
            ORDER BY e.event_date ASC
            LIMIT 100
        ) sub;
    END IF;

    -- ── Schools (solo con public_profile_enabled=true) ──────────────────
    IF p_category IN ('all', 'schools') THEN
        SELECT COALESCE(jsonb_agg(item), '[]') INTO v_schools
        FROM (
            SELECT jsonb_build_object(
                'id', s.id,
                'item_type', 'school',
                'name', s.name,
                'lat', s.lat,
                'lng', s.lng,
                'price', 0,
                'city', s.city,
                'sports', s.sports,
                'rating', s.rating,
                'review_count', s.review_count,
                'logo_url', s.logo_url,
                'verified', s.verified
            ) AS item
            FROM schools s
            WHERE s.active = true
              AND s.lat IS NOT NULL
              AND s.lng IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM school_settings ss
                  WHERE ss.school_id = s.id AND ss.public_profile_enabled = true
              )
              AND (p_query IS NULL OR s.name ILIKE '%' || p_query || '%')
              AND (p_city IS NULL OR s.city ILIKE '%' || p_city || '%')
              AND (p_sport IS NULL OR EXISTS (
                  SELECT 1 FROM unnest(s.sports) sp WHERE sp ILIKE '%' || p_sport || '%'
              ))
              AND (NOT v_use_bounds OR (
                  s.lat BETWEEN p_bounds_sw_lat AND p_bounds_ne_lat
                  AND s.lng BETWEEN p_bounds_sw_lng AND p_bounds_ne_lng
              ))
            ORDER BY s.rating DESC NULLS LAST
            LIMIT 100
        ) sub;
    END IF;

    v_markers := v_services || v_trainers || v_events || v_schools;

    RETURN jsonb_build_object(
        'markers', v_markers,
        'counts', jsonb_build_object(
            'services', jsonb_array_length(v_services),
            'trainers', jsonb_array_length(v_trainers),
            'events', jsonb_array_length(v_events),
            'schools', jsonb_array_length(v_schools)
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_explore_map TO anon, authenticated;
