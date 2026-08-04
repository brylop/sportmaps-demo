-- ============================================================
-- SERVICE_LISTINGS — CAMPOS PROFESIONALES (Marketplace UX)
--
-- Agrega contexto rico al catalogo de servicios para mejorar
-- conversion en marketplace de wellness/personal_trainer/coach:
--   - modality:        presencial / virtual / domicilio / hibrido
--   - target_audience: deportistas, niños, post_quirurgico, etc.
--   - includes:        bullets de "que incluye" la sesion
--   - requirements:    requisitos previos (estudios, evaluacion)
--   - subcategory:     sub-especialidad libre (ej. "Rehabilitacion")
--
-- Actualiza la RPC search_marketplace para exponer estos campos
-- en los resultados (lo necesita el card y los filtros del frontend).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ALTER TABLE service_listings — nuevas columnas
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.service_listings
    ADD COLUMN IF NOT EXISTS modality text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.service_listings
    ADD COLUMN IF NOT EXISTS target_audience text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.service_listings
    ADD COLUMN IF NOT EXISTS includes text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.service_listings
    ADD COLUMN IF NOT EXISTS requirements text;

ALTER TABLE public.service_listings
    ADD COLUMN IF NOT EXISTS subcategory text;

-- Whitelist de modalidades validas (constraint en array)
DO $$ BEGIN
    ALTER TABLE public.service_listings
        ADD CONSTRAINT service_listings_modality_valid
        CHECK (
            modality <@ ARRAY['presencial', 'virtual', 'domicilio', 'hibrido']::text[]
        );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Indice GIN para filtros tipo "modality && {'virtual'}" en marketplace
CREATE INDEX IF NOT EXISTS idx_service_listings_modality
    ON public.service_listings USING GIN (modality);

CREATE INDEX IF NOT EXISTS idx_service_listings_audience
    ON public.service_listings USING GIN (target_audience);

COMMENT ON COLUMN public.service_listings.modality IS
    'Modalidades de entrega: presencial, virtual, domicilio, hibrido. Array para soportar servicios mixtos.';
COMMENT ON COLUMN public.service_listings.target_audience IS
    'Publico objetivo libre (deportistas, niños, adultos_mayores, post_quirurgico, embarazadas, principiantes). Usado en filtros y display.';
COMMENT ON COLUMN public.service_listings.includes IS
    'Lista de items que incluye la sesion. Ej: {"Evaluacion postural", "Terapia manual", "Plan de ejercicios"}.';
COMMENT ON COLUMN public.service_listings.requirements IS
    'Requisitos previos del cliente. Ej: traer estudios medicos, evaluacion previa, ropa deportiva.';
COMMENT ON COLUMN public.service_listings.subcategory IS
    'Sub-especialidad libre del tipo de servicio. Ej: en Fisioterapia → Deportiva / Rehabilitacion / Prevencion.';


-- ─────────────────────────────────────────────────────────────
-- 2. RPC search_marketplace — incluir nuevos campos en payload
-- + nuevo parametro p_modality para filtrar al nivel DB
-- (DROP + CREATE porque cambiamos la firma)
-- ─────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.search_marketplace(text, text, text, text, numeric, text, integer, integer, text);

CREATE OR REPLACE FUNCTION public.search_marketplace(
    p_query text DEFAULT NULL,
    p_category text DEFAULT NULL,
    p_type text DEFAULT 'all',
    p_city text DEFAULT NULL,
    p_price_max numeric DEFAULT NULL,
    p_service_type text DEFAULT NULL,
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 24,
    p_order_by text DEFAULT 'newest',
    p_modality text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_offset integer := (GREATEST(p_page, 1) - 1) * p_limit;
    v_products jsonb := '[]';
    v_services jsonb := '[]';
    v_combined jsonb := '[]';
    v_total integer := 0;
BEGIN
    IF p_type IN ('all', 'products') THEN
        SELECT COALESCE(jsonb_agg(item), '[]') INTO v_products
        FROM (
            SELECT jsonb_build_object(
                'id', p.id,
                'type', 'product',
                'name', p.name,
                'description', p.description,
                'price', p.price,
                'image_url', p.image_url,
                'category', p.category,
                'stock', p.stock,
                'tax_rate', p.tax_rate,
                'has_variants', EXISTS(SELECT 1 FROM public.product_variants pv WHERE pv.product_id = p.id AND pv.is_active),
                'vendor_name', vp.display_name,
                'vendor_slug', vp.slug,
                'vendor_city', vp.city,
                'vendor_verified', vp.verification_status = 'verified',
                'created_at', p.created_at
            ) AS item
            FROM public.products p
            LEFT JOIN public.vendor_profiles vp ON vp.user_id = p.vendor_id
            WHERE p.active = true
              AND p.visibility = 'public'
              AND p.status = 'active'
              AND p.stock > 0
              AND (p_query IS NULL OR p.name ILIKE '%' || p_query || '%' OR p.description ILIKE '%' || p_query || '%')
              AND (p_category IS NULL OR p.category = p_category)
              AND (p_city IS NULL OR vp.city ILIKE '%' || p_city || '%')
              AND (p_price_max IS NULL OR p.price <= p_price_max)
        ) sub;
    END IF;

    IF p_type IN ('all', 'services') THEN
        SELECT COALESCE(jsonb_agg(item), '[]') INTO v_services
        FROM (
            SELECT jsonb_build_object(
                'id', sl.id,
                'type', 'service',
                'name', sl.name,
                'description', sl.description,
                'price', sl.price,
                'image_url', sl.image_url,
                'category', sl.service_type,
                'subcategory', sl.subcategory,
                'duration_minutes', sl.duration_minutes,
                'tax_rate', sl.tax_rate,
                'has_variations', sl.has_variations,
                'modality', sl.modality,
                'target_audience', sl.target_audience,
                'includes', sl.includes,
                'cancellation_policy_hours', sl.cancellation_policy_hours,
                'vendor_name', vp.display_name,
                'vendor_slug', vp.slug,
                'vendor_city', vp.city,
                'vendor_verified', vp.verification_status = 'verified',
                'created_at', sl.created_at
            ) AS item
            FROM public.service_listings sl
            JOIN public.vendor_profiles vp ON vp.id = sl.vendor_profile_id
            WHERE sl.is_active = true
              AND sl.visibility = 'public'
              AND vp.is_active = true
              AND (p_query IS NULL OR sl.name ILIKE '%' || p_query || '%' OR sl.description ILIKE '%' || p_query || '%')
              AND (p_service_type IS NULL OR sl.service_type = p_service_type)
              AND (p_city IS NULL OR vp.city ILIKE '%' || p_city || '%')
              AND (p_price_max IS NULL OR sl.price <= p_price_max)
              AND (p_modality IS NULL OR sl.modality && ARRAY[p_modality]::text[])
        ) sub;
    END IF;

    v_combined := v_products || v_services;
    v_total := jsonb_array_length(v_combined);

    SELECT COALESCE(jsonb_agg(elem), '[]') INTO v_combined
    FROM (
        SELECT elem
        FROM jsonb_array_elements(v_combined) AS elem
        ORDER BY
            CASE WHEN p_order_by = 'newest' THEN elem->>'created_at' END DESC,
            CASE WHEN p_order_by = 'price_asc' THEN (elem->>'price')::numeric END ASC,
            CASE WHEN p_order_by = 'price_desc' THEN (elem->>'price')::numeric END DESC,
            CASE WHEN p_order_by = 'name' THEN elem->>'name' END ASC
        LIMIT p_limit
        OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object(
        'items', v_combined,
        'total', v_total,
        'page', p_page,
        'pages', CEIL(v_total::numeric / GREATEST(p_limit, 1)),
        'filters_applied', jsonb_build_object(
            'query', p_query,
            'category', p_category,
            'type', p_type,
            'city', p_city,
            'price_max', p_price_max,
            'service_type', p_service_type,
            'modality', p_modality,
            'order_by', p_order_by
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_marketplace TO anon, authenticated;
