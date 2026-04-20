-- ============================================================
-- SPORTMAPS MARKETPLACE — GEO: Coordenadas para vendedores
-- Necesario para el mapa unificado del explorar global.
-- Schools y Events ya tienen lat/lng en su schema base.
-- ============================================================

-- 1. Agregar coordenadas a vendor_profiles
ALTER TABLE public.vendor_profiles
    ADD COLUMN IF NOT EXISTS lat numeric;

ALTER TABLE public.vendor_profiles
    ADD COLUMN IF NOT EXISTS lng numeric;

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_geo
    ON public.vendor_profiles(lat, lng)
    WHERE lat IS NOT NULL AND lng IS NOT NULL;

COMMENT ON COLUMN public.vendor_profiles.lat IS 'Latitud del consultorio/local del vendedor. Usado en mapa del explorar.';
COMMENT ON COLUMN public.vendor_profiles.lng IS 'Longitud del consultorio/local del vendedor. Usado en mapa del explorar.';


-- 2. RPC: search_explore_map
-- Retorna TODOS los items con coordenadas para pintar el mapa unificado.
-- Cada item tiene item_type, lat, lng, y datos minimos para el popup.

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

    -- ── Schools ─────────────────────────────────────────────────────────
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

    -- Combinar
    v_markers := v_services || v_events || v_schools;

    RETURN jsonb_build_object(
        'markers', v_markers,
        'counts', jsonb_build_object(
            'services', jsonb_array_length(v_services),
            'events', jsonb_array_length(v_events),
            'schools', jsonb_array_length(v_schools)
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_explore_map TO anon, authenticated;

COMMENT ON FUNCTION public.search_explore_map IS 'Retorna marcadores para el mapa unificado del explorar. Filtra por tipo, texto, ciudad, deporte y viewport bounds.';
