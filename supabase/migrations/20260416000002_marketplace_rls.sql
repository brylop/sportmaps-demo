-- ============================================================
-- SPORTMAPS MARKETPLACE — FASE 2: RLS Y SEGURIDAD
-- Politicas de acceso para todas las tablas del marketplace,
-- correccion de tablas existentes sin politicas,
-- aislamiento de datos de salud, RPCs de busqueda
-- ============================================================


-- ============================================================
-- 1. vendor_profiles RLS
-- ============================================================

ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

-- Publico: ver vendedores activos y verificados
CREATE POLICY "vendor_profiles_select_public"
    ON public.vendor_profiles FOR SELECT
    USING (is_active = true AND verification_status = 'verified');

-- Owner: ver siempre su propio perfil (incluso sin verificar)
CREATE POLICY "vendor_profiles_select_own"
    ON public.vendor_profiles FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Owner: crear su perfil
CREATE POLICY "vendor_profiles_insert_own"
    ON public.vendor_profiles FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Owner: actualizar su perfil
CREATE POLICY "vendor_profiles_update_own"
    ON public.vendor_profiles FOR UPDATE TO authenticated
    USING (user_id = auth.uid());


-- ============================================================
-- 2. service_listings RLS
-- ============================================================

ALTER TABLE public.service_listings ENABLE ROW LEVEL SECURITY;

-- Publico: ver servicios activos y publicos
CREATE POLICY "service_listings_select_public"
    ON public.service_listings FOR SELECT
    USING (is_active = true AND visibility = 'public');

-- Owner: ver todos sus servicios (incluso inactivos/drafts)
CREATE POLICY "service_listings_select_own"
    ON public.service_listings FOR SELECT TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );

-- Owner: crear servicios
CREATE POLICY "service_listings_insert_own"
    ON public.service_listings FOR INSERT TO authenticated
    WITH CHECK (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );

-- Owner: actualizar sus servicios
CREATE POLICY "service_listings_update_own"
    ON public.service_listings FOR UPDATE TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );

-- Owner: eliminar sus servicios
CREATE POLICY "service_listings_delete_own"
    ON public.service_listings FOR DELETE TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );


-- ============================================================
-- 3. service_variations RLS
-- ============================================================

ALTER TABLE public.service_variations ENABLE ROW LEVEL SECURITY;

-- Publico: ver variaciones de servicios publicos
CREATE POLICY "service_variations_select_public"
    ON public.service_variations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.service_listings sl
            WHERE sl.id = service_variations.service_listing_id
              AND sl.is_active = true
              AND sl.visibility = 'public'
        )
    );

-- Owner: CRUD completo via service_listing → vendor_profile
CREATE POLICY "service_variations_owner"
    ON public.service_variations FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.service_listings sl
            JOIN public.vendor_profiles vp ON vp.id = sl.vendor_profile_id
            WHERE sl.id = service_variations.service_listing_id
              AND vp.user_id = auth.uid()
        )
    );


-- ============================================================
-- 4. service_availability RLS
-- ============================================================

ALTER TABLE public.service_availability ENABLE ROW LEVEL SECURITY;

-- Publico: ver horarios activos (necesario para reservar)
CREATE POLICY "service_availability_select_public"
    ON public.service_availability FOR SELECT
    USING (is_active = true);

-- Owner: CRUD completo
CREATE POLICY "service_availability_owner"
    ON public.service_availability FOR ALL TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );


-- ============================================================
-- 5. product_variants RLS
-- ============================================================

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Publico: ver variantes de productos publicos y activos
CREATE POLICY "product_variants_select_public"
    ON public.product_variants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_variants.product_id
              AND p.active = true
              AND p.visibility = 'public'
              AND p.status = 'active'
        )
    );

-- Owner: ver todas sus variantes (incluso inactivas)
CREATE POLICY "product_variants_select_own"
    ON public.product_variants FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_variants.product_id
              AND p.vendor_id = auth.uid()
        )
    );

-- Owner: CRUD
CREATE POLICY "product_variants_insert_own"
    ON public.product_variants FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_variants.product_id
              AND p.vendor_id = auth.uid()
        )
    );

CREATE POLICY "product_variants_update_own"
    ON public.product_variants FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_variants.product_id
              AND p.vendor_id = auth.uid()
        )
    );

CREATE POLICY "product_variants_delete_own"
    ON public.product_variants FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_variants.product_id
              AND p.vendor_id = auth.uid()
        )
    );


-- ============================================================
-- 6. products RLS — REESCRIBIR
-- (Actualmente tiene RLS habilitado pero politicas rotas/parciales)
-- ============================================================

-- Limpiar politicas existentes de products
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'products'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', r.policyname);
    END LOOP;
END $$;

-- SELECT publico: productos activos y publicos
CREATE POLICY "products_select_public"
    ON public.products FOR SELECT
    USING (active = true AND visibility = 'public' AND status = 'active');

-- SELECT school_only: productos de escuela, solo para miembros
CREATE POLICY "products_select_school_members"
    ON public.products FOR SELECT TO authenticated
    USING (
        visibility = 'school_only'
        AND active = true
        AND status = 'active'
        AND school_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = products.school_id
              AND sm.profile_id = auth.uid()
              AND sm.status = 'active'
        )
    );

-- SELECT owner: vendor ve todos sus productos (incluso drafts/archived)
CREATE POLICY "products_select_own"
    ON public.products FOR SELECT TO authenticated
    USING (vendor_id = auth.uid());

-- INSERT: solo el vendor owner
CREATE POLICY "products_insert_own"
    ON public.products FOR INSERT TO authenticated
    WITH CHECK (vendor_id = auth.uid());

-- UPDATE: solo el vendor owner
CREATE POLICY "products_update_own"
    ON public.products FOR UPDATE TO authenticated
    USING (vendor_id = auth.uid());

-- DELETE: solo el vendor owner
CREATE POLICY "products_delete_own"
    ON public.products FOR DELETE TO authenticated
    USING (vendor_id = auth.uid());


-- ============================================================
-- 7. orders RLS — AGREGAR (actualmente sin politicas)
-- ============================================================

-- Limpiar politicas existentes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'orders'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', r.policyname);
    END LOOP;
END $$;

-- Comprador: ver sus propias ordenes
CREATE POLICY "orders_select_buyer"
    ON public.orders FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Vendedor: ver ordenes que contienen sus productos
CREATE POLICY "orders_select_vendor"
    ON public.orders FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.order_items oi
            JOIN public.products p ON oi.product_id = p.id
            WHERE oi.order_id = orders.id
              AND p.vendor_id = auth.uid()
        )
    );

-- Comprador: crear ordenes
CREATE POLICY "orders_insert_buyer"
    ON public.orders FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Comprador: actualizar su orden (ej: cancelar)
CREATE POLICY "orders_update_buyer"
    ON public.orders FOR UPDATE TO authenticated
    USING (user_id = auth.uid());


-- ============================================================
-- 8. order_items RLS
-- ============================================================

-- Limpiar politicas existentes
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'order_items'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_items', r.policyname);
    END LOOP;
END $$;

-- Ver items de ordenes propias (comprador)
CREATE POLICY "order_items_select_buyer"
    ON public.order_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND o.user_id = auth.uid()
        )
    );

-- Ver items que son de mis productos (vendedor)
CREATE POLICY "order_items_select_vendor"
    ON public.order_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = order_items.product_id
              AND p.vendor_id = auth.uid()
        )
    );

-- Insertar items en ordenes propias
CREATE POLICY "order_items_insert_buyer"
    ON public.order_items FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND o.user_id = auth.uid()
        )
    );


-- ============================================================
-- 9. carts RLS (corregir — actualmente sin politicas)
-- ============================================================

DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'carts'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.carts', r.policyname);
    END LOOP;
END $$;

CREATE POLICY "carts_select_own"
    ON public.carts FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "carts_insert_own"
    ON public.carts FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "carts_update_own"
    ON public.carts FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "carts_delete_own"
    ON public.carts FOR DELETE TO authenticated
    USING (user_id = auth.uid());


-- ============================================================
-- 10. WELLNESS DATA ISOLATION (CRITICO — compliance salud)
-- Datos de salud SOLO visibles para el profesional y el atleta.
-- School admins explicitamente EXCLUIDOS.
-- ============================================================

-- 10a. wellness_evaluations
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'wellness_evaluations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.wellness_evaluations', r.policyname);
    END LOOP;
END $$;

ALTER TABLE public.wellness_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wellness_evaluations_professional_or_athlete"
    ON public.wellness_evaluations FOR ALL TO authenticated
    USING (professional_id = auth.uid() OR athlete_id = auth.uid());

-- 10b. health_records
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'health_records'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.health_records', r.policyname);
    END LOOP;
END $$;

ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_records_professional_or_athlete"
    ON public.health_records FOR ALL TO authenticated
    USING (professional_id = auth.uid() OR athlete_id = auth.uid());

-- 10c. wellness_appointments — profesional, atleta, o padre del atleta
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'wellness_appointments'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.wellness_appointments', r.policyname);
    END LOOP;
END $$;

ALTER TABLE public.wellness_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wellness_appointments_access"
    ON public.wellness_appointments FOR ALL TO authenticated
    USING (
        professional_id = auth.uid()
        OR athlete_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.id = wellness_appointments.athlete_id
              AND c.parent_id = auth.uid()
        )
    );


-- ============================================================
-- 11. AUDIT TRIGGERS para datos de salud
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_health_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.security_audit_log (
        user_id, action, target_table, target_id, metadata
    ) VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        jsonb_build_object(
            'professional_id', COALESCE(NEW.professional_id, OLD.professional_id),
            'athlete_id', COALESCE(NEW.athlete_id, OLD.athlete_id)
        )
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_wellness_evaluations ON public.wellness_evaluations;
CREATE TRIGGER trg_audit_wellness_evaluations
    AFTER INSERT OR UPDATE OR DELETE ON public.wellness_evaluations
    FOR EACH ROW EXECUTE FUNCTION public.audit_health_data_access();

DROP TRIGGER IF EXISTS trg_audit_health_records ON public.health_records;
CREATE TRIGGER trg_audit_health_records
    AFTER INSERT OR UPDATE OR DELETE ON public.health_records
    FOR EACH ROW EXECUTE FUNCTION public.audit_health_data_access();


-- ============================================================
-- 12. RPC: search_marketplace
-- Busqueda publica unificada de productos + servicios
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_marketplace(
    p_query text DEFAULT NULL,
    p_category text DEFAULT NULL,
    p_type text DEFAULT 'all',
    p_city text DEFAULT NULL,
    p_price_max numeric DEFAULT NULL,
    p_service_type text DEFAULT NULL,
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 24,
    p_order_by text DEFAULT 'newest'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offset integer := (GREATEST(p_page, 1) - 1) * p_limit;
    v_products jsonb := '[]';
    v_services jsonb := '[]';
    v_combined jsonb := '[]';
    v_total integer := 0;
BEGIN
    -- Buscar productos
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
                'has_variants', EXISTS(SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active),
                'vendor_name', vp.display_name,
                'vendor_slug', vp.slug,
                'vendor_city', vp.city,
                'vendor_verified', vp.verification_status = 'verified',
                'created_at', p.created_at
            ) AS item
            FROM products p
            LEFT JOIN vendor_profiles vp ON vp.user_id = p.vendor_id
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

    -- Buscar servicios
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
                'duration_minutes', sl.duration_minutes,
                'tax_rate', sl.tax_rate,
                'has_variations', sl.has_variations,
                'vendor_name', vp.display_name,
                'vendor_slug', vp.slug,
                'vendor_city', vp.city,
                'vendor_verified', vp.verification_status = 'verified',
                'created_at', sl.created_at
            ) AS item
            FROM service_listings sl
            JOIN vendor_profiles vp ON vp.id = sl.vendor_profile_id
            WHERE sl.is_active = true
              AND sl.visibility = 'public'
              AND vp.is_active = true
              AND (p_query IS NULL OR sl.name ILIKE '%' || p_query || '%' OR sl.description ILIKE '%' || p_query || '%')
              AND (p_service_type IS NULL OR sl.service_type = p_service_type)
              AND (p_city IS NULL OR vp.city ILIKE '%' || p_city || '%')
              AND (p_price_max IS NULL OR sl.price <= p_price_max)
        ) sub;
    END IF;

    -- Combinar y ordenar
    v_combined := v_products || v_services;
    v_total := jsonb_array_length(v_combined);

    -- Ordenar
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
            'order_by', p_order_by
        )
    );
END;
$$;


-- ============================================================
-- 13. RPC: get_available_slots
-- Retorna slots disponibles para un dia, respetando
-- availability + citas existentes + buffer_time
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_available_slots(
    p_vendor_profile_id uuid,
    p_service_listing_id uuid DEFAULT NULL,
    p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day_of_week integer;
    v_availability RECORD;
    v_slot_start time;
    v_slot_end time;
    v_duration integer;
    v_buffer integer;
    v_slots jsonb := '[]';
    v_vendor_user_id uuid;
    v_overlap_count integer;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date)::integer;

    -- Obtener user_id del vendor
    SELECT user_id INTO v_vendor_user_id
    FROM vendor_profiles WHERE id = p_vendor_profile_id;

    IF v_vendor_user_id IS NULL THEN
        RETURN jsonb_build_object('slots', '[]'::jsonb, 'date', p_date, 'error', 'Vendor not found');
    END IF;

    -- Obtener duracion del servicio (si se proporciona)
    IF p_service_listing_id IS NOT NULL THEN
        SELECT duration_minutes INTO v_duration
        FROM service_listings WHERE id = p_service_listing_id;
    END IF;

    -- Iterar disponibilidad del dia
    FOR v_availability IN
        SELECT start_time, end_time, slot_duration_minutes, buffer_time_minutes, max_concurrent
        FROM service_availability
        WHERE vendor_profile_id = p_vendor_profile_id
          AND day_of_week = v_day_of_week
          AND is_active = true
        ORDER BY start_time
    LOOP
        v_duration := COALESCE(v_duration, v_availability.slot_duration_minutes);
        v_buffer := v_availability.buffer_time_minutes;
        v_slot_start := v_availability.start_time;

        -- Generar slots dentro del bloque de disponibilidad
        WHILE v_slot_start + (v_duration || ' minutes')::interval <= v_availability.end_time LOOP
            v_slot_end := v_slot_start + (v_duration || ' minutes')::interval;

            -- Contar citas existentes que se solapan con este slot
            SELECT COUNT(*) INTO v_overlap_count
            FROM wellness_appointments wa
            WHERE wa.professional_id = v_vendor_user_id
              AND wa.appointment_date = p_date
              AND wa.status NOT IN ('cancelled')
              AND wa.appointment_time < v_slot_end
              AND wa.appointment_time + (wa.duration_minutes || ' minutes')::interval > v_slot_start;

            -- Si hay espacio (menos que max_concurrent), el slot esta disponible
            IF v_overlap_count < v_availability.max_concurrent THEN
                v_slots := v_slots || jsonb_build_object(
                    'start_time', v_slot_start::text,
                    'end_time', v_slot_end::text,
                    'duration_minutes', v_duration,
                    'available', true
                );
            END IF;

            -- Avanzar al siguiente slot (duracion + buffer)
            v_slot_start := v_slot_start + ((v_duration + v_buffer) || ' minutes')::interval;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'slots', v_slots,
        'date', p_date,
        'day_of_week', v_day_of_week,
        'vendor_profile_id', p_vendor_profile_id,
        'service_listing_id', p_service_listing_id
    );
END;
$$;


-- ============================================================
-- 14. GRANT acceso a funciones RPC para anon y authenticated
-- ============================================================

GRANT EXECUTE ON FUNCTION public.search_marketplace TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_slots TO anon, authenticated;
