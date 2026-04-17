-- ============================================================
-- SPORTMAPS MARKETPLACE — FASE 1: TABLAS CORE
-- Vendor profiles, service listings, product variants,
-- service availability, alteraciones a products/orders
-- ============================================================

-- ============================================================
-- 1. ENUMS NUEVOS
-- ============================================================

DO $$ BEGIN
    CREATE TYPE public.vendor_type AS ENUM ('store', 'wellness', 'school');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.product_visibility AS ENUM ('public', 'school_only', 'private');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.settlement_status AS ENUM ('pending', 'processing', 'paid', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.fulfillment_type AS ENUM ('physical', 'digital', 'service');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Agregar 'organizer' al enum user_role (falta en BD, existe solo en frontend)
DO $$ BEGIN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'organizer';
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================
-- 2. TABLA vendor_profiles (perfil universal de vendedor)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_profiles (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_type         public.vendor_type NOT NULL,
    display_name        text        NOT NULL,
    slug                text        UNIQUE,
    description         text,
    logo_url            text,
    cover_image_url     text,
    city                text,
    address             text,
    phone               text,
    email               text,
    nit                 text,
    website_url         text,
    payment_methods     jsonb       NOT NULL DEFAULT '[]',
    bank_data           jsonb       NOT NULL DEFAULT '{}',
    capabilities        jsonb       NOT NULL DEFAULT '{"can_sell_products": false, "can_sell_services": false}',
    commission_rate     numeric     NOT NULL DEFAULT 0.10 CHECK (commission_rate >= 0 AND commission_rate <= 1),
    verification_status text        NOT NULL DEFAULT 'pending'
                                    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_doc_url text,
    is_active           boolean     NOT NULL DEFAULT true,
    metadata            jsonb       NOT NULL DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_user_id ON public.vendor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_vendor_type ON public.vendor_profiles(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_city ON public.vendor_profiles(city);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_slug ON public.vendor_profiles(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_active_verified ON public.vendor_profiles(is_active, verification_status);

DROP TRIGGER IF EXISTS trg_vendor_profiles_updated_at ON public.vendor_profiles;
CREATE TRIGGER trg_vendor_profiles_updated_at
    BEFORE UPDATE ON public.vendor_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 3. TABLA service_listings (catalogo de servicios)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.service_listings (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id       uuid        NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    name                    text        NOT NULL,
    description             text,
    service_type            text        NOT NULL
                                        CHECK (service_type IN (
                                            'Fisioterapia', 'Nutricion', 'Psicologia',
                                            'Medicina_Deportiva', 'Entrenamiento', 'Otro'
                                        )),
    price                   numeric     NOT NULL DEFAULT 0 CHECK (price >= 0),
    currency                text        NOT NULL DEFAULT 'COP',
    duration_minutes        integer     NOT NULL DEFAULT 60,
    image_url               text,
    visibility              public.product_visibility NOT NULL DEFAULT 'public',
    is_active               boolean     NOT NULL DEFAULT true,
    max_daily_slots         integer     DEFAULT 8,
    tax_rate                numeric     NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 1),
    cancellation_policy_hours integer   NOT NULL DEFAULT 24,
    has_variations          boolean     NOT NULL DEFAULT false,
    metadata                jsonb       NOT NULL DEFAULT '{}',
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_listings_vendor ON public.service_listings(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_service_listings_type ON public.service_listings(service_type);
CREATE INDEX IF NOT EXISTS idx_service_listings_active ON public.service_listings(is_active, visibility);

DROP TRIGGER IF EXISTS trg_service_listings_updated_at ON public.service_listings;
CREATE TRIGGER trg_service_listings_updated_at
    BEFORE UPDATE ON public.service_listings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 4. TABLA service_variations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.service_variations (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    service_listing_id  uuid        NOT NULL REFERENCES public.service_listings(id) ON DELETE CASCADE,
    name                text        NOT NULL,
    description         text,
    price               numeric     NOT NULL CHECK (price >= 0),
    duration_minutes    integer     NOT NULL,
    is_active           boolean     NOT NULL DEFAULT true,
    sort_order          integer     NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_variations_listing ON public.service_variations(service_listing_id);

DROP TRIGGER IF EXISTS trg_service_variations_updated_at ON public.service_variations;
CREATE TRIGGER trg_service_variations_updated_at
    BEFORE UPDATE ON public.service_variations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 5. TABLA service_availability (horarios del profesional)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.service_availability (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id       uuid        NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    day_of_week             integer     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time              time        NOT NULL,
    end_time                time        NOT NULL,
    slot_duration_minutes   integer     NOT NULL DEFAULT 60,
    buffer_time_minutes     integer     NOT NULL DEFAULT 10,
    max_concurrent          integer     NOT NULL DEFAULT 1,
    is_active               boolean     NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT service_availability_time_order CHECK (end_time > start_time),
    CONSTRAINT service_availability_unique_slot UNIQUE (vendor_profile_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_service_availability_vendor ON public.service_availability(vendor_profile_id, is_active);

DROP TRIGGER IF EXISTS trg_service_availability_updated_at ON public.service_availability;
CREATE TRIGGER trg_service_availability_updated_at
    BEFORE UPDATE ON public.service_availability
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 6. TABLA product_variants (variaciones de producto)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_variants (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku             text        UNIQUE,
    name            text        NOT NULL,
    attributes      jsonb       NOT NULL DEFAULT '{}',
    price_override  numeric     CHECK (price_override IS NULL OR price_override >= 0),
    stock           integer     NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url       text,
    is_active       boolean     NOT NULL DEFAULT true,
    sort_order      integer     NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON public.product_variants(product_id, is_active);

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 7. ALTER TABLE products — nuevas columnas
-- ============================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS visibility public.product_visibility NOT NULL DEFAULT 'public';

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS vendor_profile_id uuid REFERENCES public.vendor_profiles(id);

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'draft', 'archived'));

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS sku text;

-- sku UNIQUE constraint (partial — solo non-null)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_products_sku_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_products_sku_unique ON public.products(sku) WHERE sku IS NOT NULL;
    END IF;
END $$;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}';

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS weight_grams integer;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS is_digital boolean NOT NULL DEFAULT false;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS min_stock_alert integer NOT NULL DEFAULT 5;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0
        CHECK (tax_rate >= 0 AND tax_rate <= 1);

CREATE INDEX IF NOT EXISTS idx_products_visibility ON public.products(visibility);
CREATE INDEX IF NOT EXISTS idx_products_vendor_profile ON public.products(vendor_profile_id)
    WHERE vendor_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);


-- ============================================================
-- 8. ALTER TABLE orders — nuevas columnas
-- ============================================================

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS tax_total numeric NOT NULL DEFAULT 0;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS tracking_number text;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS shipping_carrier text;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS fulfillment_type public.fulfillment_type NOT NULL DEFAULT 'physical';

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS vendor_notes text;


-- ============================================================
-- 9. ALTER TABLE order_items — nuevas columnas
-- ============================================================

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id);

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES auth.users(id);

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0;


-- ============================================================
-- 10. TRIGGER: auto_create_vendor_profile
-- Al registrar un store_owner o wellness_professional,
-- crear automaticamente su vendor_profile con capabilities
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_create_vendor_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Solo crear para roles vendedores
    IF NEW.role IN ('store_owner', 'wellness_professional') THEN
        INSERT INTO public.vendor_profiles (
            user_id,
            vendor_type,
            display_name,
            capabilities
        ) VALUES (
            NEW.id,
            CASE NEW.role
                WHEN 'store_owner' THEN 'store'::public.vendor_type
                WHEN 'wellness_professional' THEN 'wellness'::public.vendor_type
            END,
            COALESCE(NEW.full_name, NEW.email, 'Vendedor'),
            CASE NEW.role
                WHEN 'store_owner' THEN
                    '{"can_sell_products": true, "can_sell_services": false}'::jsonb
                WHEN 'wellness_professional' THEN
                    '{"can_sell_products": false, "can_sell_services": true}'::jsonb
            END
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_vendor_profile ON public.profiles;
CREATE TRIGGER trg_auto_vendor_profile
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.auto_create_vendor_profile();


-- ============================================================
-- 11. TRIGGER: validate_product_vendor_capability
-- Impide que un vendor sin can_sell_products suba productos
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_product_vendor_capability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_capabilities jsonb;
BEGIN
    -- Solo validar si tiene vendor_profile_id
    IF NEW.vendor_profile_id IS NOT NULL THEN
        SELECT capabilities INTO v_capabilities
        FROM public.vendor_profiles
        WHERE id = NEW.vendor_profile_id;

        IF v_capabilities IS NULL THEN
            RAISE EXCEPTION 'Perfil de vendedor no encontrado.'
                USING ERRCODE = '42501';
        END IF;

        IF NOT COALESCE((v_capabilities->>'can_sell_products')::boolean, false) THEN
            RAISE EXCEPTION 'Este vendedor no tiene permisos para vender productos fisicos. Active la capacidad de productos en su perfil.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_vendor ON public.products;
CREATE TRIGGER trg_validate_product_vendor
    BEFORE INSERT OR UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.validate_product_vendor_capability();


-- ============================================================
-- 12. TRIGGER: validate_service_vendor_capability
-- Impide que un vendor sin can_sell_services cree servicios
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_service_vendor_capability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_capabilities jsonb;
BEGIN
    SELECT capabilities INTO v_capabilities
    FROM public.vendor_profiles
    WHERE id = NEW.vendor_profile_id;

    IF v_capabilities IS NULL THEN
        RAISE EXCEPTION 'Perfil de vendedor no encontrado.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT COALESCE((v_capabilities->>'can_sell_services')::boolean, false) THEN
        RAISE EXCEPTION 'Este vendedor no tiene permisos para crear servicios. Active la capacidad de servicios en su perfil.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_service_vendor ON public.service_listings;
CREATE TRIGGER trg_validate_service_vendor
    BEFORE INSERT OR UPDATE ON public.service_listings
    FOR EACH ROW EXECUTE FUNCTION public.validate_service_vendor_capability();


-- ============================================================
-- 13. TRIGGER: validate_appointment_no_overlap
-- Impide citas simultaneas para el mismo profesional
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_appointment_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_buffer integer;
    v_end_time time;
    v_overlap_count integer;
BEGIN
    -- Solo validar citas no canceladas
    IF NEW.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    -- Obtener buffer del profesional (default 10 min)
    SELECT COALESCE(
        (SELECT buffer_time_minutes FROM public.service_availability
         WHERE vendor_profile_id = (
             SELECT id FROM public.vendor_profiles WHERE user_id = NEW.professional_id LIMIT 1
         )
         AND is_active = true
         LIMIT 1),
        10
    ) INTO v_buffer;

    -- Calcular hora de fin de la nueva cita + buffer
    v_end_time := NEW.appointment_time + (NEW.duration_minutes || ' minutes')::interval;

    -- Verificar overlap
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.wellness_appointments wa
    WHERE wa.professional_id = NEW.professional_id
      AND wa.appointment_date = NEW.appointment_date
      AND wa.status NOT IN ('cancelled')
      AND wa.id IS DISTINCT FROM NEW.id
      AND (
          -- La nueva cita empieza durante una existente (incluyendo buffer)
          (NEW.appointment_time < wa.appointment_time + (wa.duration_minutes + v_buffer || ' minutes')::interval
           AND v_end_time > wa.appointment_time)
      );

    IF v_overlap_count > 0 THEN
        RAISE EXCEPTION 'El profesional ya tiene una cita en este horario. Considere el tiempo de buffer entre citas (% minutos).', v_buffer
            USING ERRCODE = '23505';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_appointment_overlap ON public.wellness_appointments;
CREATE TRIGGER trg_validate_appointment_overlap
    BEFORE INSERT OR UPDATE ON public.wellness_appointments
    FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_no_overlap();


-- ============================================================
-- 14. HELPER: generate_vendor_slug
-- Genera slug unico para vendedores basado en display_name
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_vendor_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_base_slug text;
    v_slug text;
    v_counter integer := 0;
BEGIN
    -- Solo generar si no tiene slug
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        -- Generar slug base: lowercase, reemplazar espacios con guiones, quitar caracteres especiales
        v_base_slug := lower(regexp_replace(
            regexp_replace(NEW.display_name, '[^a-zA-Z0-9\s-]', '', 'g'),
            '\s+', '-', 'g'
        ));

        -- Quitar guiones multiples y trim
        v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
        v_base_slug := trim(both '-' from v_base_slug);

        -- Si queda vacio, usar 'vendor'
        IF v_base_slug = '' THEN
            v_base_slug := 'vendor';
        END IF;

        v_slug := v_base_slug;

        -- Verificar unicidad
        WHILE EXISTS (SELECT 1 FROM public.vendor_profiles WHERE slug = v_slug AND id != NEW.id) LOOP
            v_counter := v_counter + 1;
            v_slug := v_base_slug || '-' || v_counter;
        END LOOP;

        NEW.slug := v_slug;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_vendor_slug ON public.vendor_profiles;
CREATE TRIGGER trg_generate_vendor_slug
    BEFORE INSERT OR UPDATE ON public.vendor_profiles
    FOR EACH ROW EXECUTE FUNCTION public.generate_vendor_slug();


-- ============================================================
-- 15. COMENTARIOS DE DOCUMENTACION
-- ============================================================

COMMENT ON TABLE public.vendor_profiles IS 'Perfil universal de vendedor. Unifica store_owner, wellness_professional y schools como proveedores del marketplace.';
COMMENT ON COLUMN public.vendor_profiles.capabilities IS 'JSON con capacidades: {"can_sell_products": bool, "can_sell_services": bool}. Validado por triggers en products y service_listings.';
COMMENT ON COLUMN public.vendor_profiles.commission_rate IS 'Tasa de comision de la plataforma (0.0 a 1.0). Default 10%.';

COMMENT ON TABLE public.service_listings IS 'Catalogo de servicios ofrecidos por profesionales de salud y wellness en el marketplace.';
COMMENT ON COLUMN public.service_listings.cancellation_policy_hours IS 'Horas minimas antes de la cita para cancelar sin penalidad.';

COMMENT ON TABLE public.service_variations IS 'Variaciones de un servicio. Ej: Sesion Inicial (60min, $80k) vs Seguimiento (30min, $50k).';

COMMENT ON TABLE public.service_availability IS 'Horarios disponibles del profesional por dia de semana. buffer_time_minutes = tiempo entre citas.';

COMMENT ON TABLE public.product_variants IS 'Variaciones de producto (talla, color). El stock se maneja POR VARIANTE, no por producto padre.';
COMMENT ON COLUMN public.product_variants.price_override IS 'Precio especifico de esta variante. Si NULL, se usa el precio del producto padre.';

COMMENT ON COLUMN public.products.visibility IS 'public=todos ven, school_only=solo miembros de la escuela, private=solo el vendor.';
COMMENT ON COLUMN public.products.min_stock_alert IS 'Umbral para notificacion de stock bajo al vendedor.';
COMMENT ON COLUMN public.products.tax_rate IS 'Tasa de impuesto (0.0 a 1.0). Ej: 0.19 para IVA 19%.';
