-- ============================================================
-- SPORTMAPS MARKETPLACE — R2.1 Producto rico
-- Taxonomia de categorias con attribute_schema dinamico,
-- marcas, columnas products.category_id + brand_id,
-- estado pending_review, validador de calidad minima.
--
-- Defensivo: skip secciones que requieran products si no existe.
-- ============================================================


-- ============================================================
-- 1. Tabla product_categories (jerarquica)
--    attribute_schema describe campos a pedir en el wizard.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id         uuid        REFERENCES public.product_categories(id) ON DELETE SET NULL,
    slug              text        NOT NULL UNIQUE,
    name              text        NOT NULL,
    icon              text,
    sport             text,
    -- attribute_schema: array de objetos con shape
    --   { key, label, type, required, options[], applies_to: 'product'|'variant', unit? }
    attribute_schema  jsonb       NOT NULL DEFAULT '[]'::jsonb,
    sort_order        integer     NOT NULL DEFAULT 0,
    is_active         boolean     NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_parent     ON public.product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_slug       ON public.product_categories(slug);
CREATE INDEX IF NOT EXISTS idx_product_categories_sport      ON public.product_categories(sport) WHERE sport IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_categories_is_active  ON public.product_categories(is_active);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_product_categories_updated_at ON public.product_categories $tr$;
        EXECUTE $tr$
            CREATE TRIGGER trg_product_categories_updated_at
            BEFORE UPDATE ON public.product_categories
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
        $tr$;
    END IF;
END $$;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categorias visibles para todos" ON public.product_categories;
CREATE POLICY "Categorias visibles para todos"
    ON public.product_categories FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Solo admin modifica categorias" ON public.product_categories;
CREATE POLICY "Solo admin modifica categorias"
    ON public.product_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'super_admin')
        )
    );


-- ============================================================
-- 2. Tabla product_brands
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_brands (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        text        NOT NULL UNIQUE,
    name        text        NOT NULL,
    logo_url    text,
    website_url text,
    is_official boolean     NOT NULL DEFAULT false,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_brands_slug ON public.product_brands(slug);
CREATE INDEX IF NOT EXISTS idx_product_brands_active ON public.product_brands(is_active);

ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marcas visibles para todos" ON public.product_brands;
CREATE POLICY "Marcas visibles para todos"
    ON public.product_brands FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Solo admin modifica marcas" ON public.product_brands;
CREATE POLICY "Solo admin modifica marcas"
    ON public.product_brands FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'super_admin')
        )
    );

-- Seed de marcas mas comunes
INSERT INTO public.product_brands (slug, name, is_official) VALUES
    ('nike',         'Nike',         true),
    ('adidas',       'Adidas',       true),
    ('puma',         'Puma',         true),
    ('under-armour', 'Under Armour', true),
    ('new-balance',  'New Balance',  true),
    ('reebok',       'Reebok',       true),
    ('umbro',        'Umbro',        true),
    ('asics',        'Asics',        true),
    ('mizuno',       'Mizuno',       true),
    ('wilson',       'Wilson',       true),
    ('babolat',      'Babolat',      true),
    ('head',         'Head',         true),
    ('molten',       'Molten',       true),
    ('mikasa',       'Mikasa',       true),
    ('on-running',   'On',           true),
    ('hoka',         'Hoka',         true),
    ('generica',     'Sin marca',    false)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- 3. Extender products: category_id, brand_id, status pending_review
--    Solo si products existe.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) THEN
        RAISE NOTICE 'Skip 3: tabla products no existe.';
        RETURN;
    END IF;

    EXECUTE $sql$
        ALTER TABLE public.products
            ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;
    $sql$;

    EXECUTE $sql$
        ALTER TABLE public.products
            ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.product_brands(id) ON DELETE SET NULL;
    $sql$;

    EXECUTE $sql$
        CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id) WHERE category_id IS NOT NULL;
    $sql$;
    EXECUTE $sql$
        CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id) WHERE brand_id IS NOT NULL;
    $sql$;

    -- Extender check constraint de status si existe
    -- Posibles estados: draft (vendor edita), pending_review (esperando admin),
    -- active (visible publico), archived (soft delete), rejected (admin rechazo)
    EXECUTE $sql$
        ALTER TABLE public.products
            DROP CONSTRAINT IF EXISTS products_status_check;
    $sql$;
    EXECUTE $sql$
        ALTER TABLE public.products
            ADD CONSTRAINT products_status_check
            CHECK (status IN ('draft', 'pending_review', 'active', 'archived', 'rejected'));
    $sql$;

    -- Agregar columnas extra para moderacion
    EXECUTE $sql$
        ALTER TABLE public.products
            ADD COLUMN IF NOT EXISTS rejection_reason text;
    $sql$;
    EXECUTE $sql$
        ALTER TABLE public.products
            ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
    $sql$;
    EXECUTE $sql$
        ALTER TABLE public.products
            ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);
    $sql$;
END $$;


-- ============================================================
-- 4. Funcion validate_product_quality(product_id)
--    Devuelve un array de issues. Si esta vacio, el producto
--    cumple los minimos para publicarse.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_product_quality(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product    RECORD;
    v_issues     jsonb := '[]'::jsonb;
    v_image_count integer := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT id, name, description, price, image_url, category_id, vendor_profile_id, status
      INTO v_product
      FROM public.products
     WHERE id = p_product_id;

    IF v_product.id IS NULL THEN
        RETURN jsonb_build_array(jsonb_build_object('code', 'not_found', 'message', 'Producto no encontrado.'));
    END IF;

    -- Reglas:
    IF v_product.name IS NULL OR length(trim(v_product.name)) < 5 THEN
        v_issues := v_issues || jsonb_build_object('code', 'name_too_short', 'message', 'Nombre debe tener al menos 5 caracteres.');
    END IF;

    IF v_product.description IS NULL OR length(trim(v_product.description)) < 30 THEN
        v_issues := v_issues || jsonb_build_object('code', 'description_too_short', 'message', 'Descripcion debe tener al menos 30 caracteres.');
    END IF;

    IF v_product.price IS NULL OR v_product.price <= 0 THEN
        v_issues := v_issues || jsonb_build_object('code', 'price_invalid', 'message', 'Precio debe ser mayor a 0.');
    END IF;

    IF v_product.category_id IS NULL THEN
        v_issues := v_issues || jsonb_build_object('code', 'category_required', 'message', 'Categoria es requerida.');
    END IF;

    -- Imagen: legacy `image_url` o tabla product_media si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'product_media'
    ) THEN
        EXECUTE $q$
            SELECT COUNT(*) FROM public.product_media WHERE product_id = $1 AND type IN ('image', 'image_360')
        $q$ INTO v_image_count USING p_product_id;

        IF v_image_count = 0 AND (v_product.image_url IS NULL OR length(v_product.image_url) = 0) THEN
            v_issues := v_issues || jsonb_build_object('code', 'no_image', 'message', 'Al menos una imagen es requerida.');
        END IF;
    ELSIF v_product.image_url IS NULL OR length(v_product.image_url) = 0 THEN
        v_issues := v_issues || jsonb_build_object('code', 'no_image', 'message', 'Al menos una imagen es requerida.');
    END IF;

    -- Vendor verificado?  (no bloquea, pero se anota)
    IF v_product.vendor_profile_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
            WHERE vp.id = v_product.vendor_profile_id
              AND vp.verification_status::text <> 'verified'
        ) THEN
            v_issues := v_issues || jsonb_build_object('code', 'vendor_unverified', 'message', 'Vendor no verificado — producto requerira revision admin.', 'severity', 'warning');
        END IF;
    END IF;

    RETURN v_issues;
END;
$$;

COMMENT ON FUNCTION public.validate_product_quality(uuid) IS
    'Valida reglas minimas de calidad del producto. Devuelve jsonb array de issues. Si vacio, el producto puede pasar a active.';

GRANT EXECUTE ON FUNCTION public.validate_product_quality(uuid) TO authenticated;


-- ============================================================
-- 5. Trigger: al cambiar status a 'active', si no cumple calidad
--    se redirige a 'pending_review'. Si el vendor esta verificado
--    y cumple calidad, sigue a 'active' (auto-publish).
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) THEN
        RAISE NOTICE 'Skip 5: tabla products no existe. Trigger no se crea.';
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.enforce_product_publish_gate()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_issues          jsonb;
            v_blocking_issues jsonb;
            v_vendor_verified boolean := false;
        BEGIN
            -- Solo intervenir cuando se intenta publicar (status = 'active')
            IF NEW.status <> 'active' THEN
                RETURN NEW;
            END IF;

            -- Si ya estaba activo, no revalidar
            IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
                RETURN NEW;
            END IF;

            v_issues := public.validate_product_quality(NEW.id);

            -- Filtrar issues no-warning
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
              INTO v_blocking_issues
              FROM jsonb_array_elements(v_issues) elem
             WHERE COALESCE(elem ->> 'severity', 'error') <> 'warning';

            IF jsonb_array_length(v_blocking_issues) > 0 THEN
                RAISE EXCEPTION 'Producto no cumple reglas de calidad: %', v_blocking_issues::text
                    USING ERRCODE = '23514';
            END IF;

            -- Si vendor no esta verificado, mandar a pending_review
            IF NEW.vendor_profile_id IS NOT NULL THEN
                SELECT (verification_status::text = 'verified') INTO v_vendor_verified
                  FROM public.vendor_profiles
                 WHERE id = NEW.vendor_profile_id;

                IF NOT v_vendor_verified THEN
                    NEW.status := 'pending_review';
                END IF;
            END IF;

            RETURN NEW;
        END;
        $body$;
    $func$;

    EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_enforce_product_publish_gate ON public.products $tr$;
    EXECUTE $tr$
        CREATE TRIGGER trg_enforce_product_publish_gate
            BEFORE INSERT OR UPDATE OF status ON public.products
            FOR EACH ROW
            EXECUTE FUNCTION public.enforce_product_publish_gate();
    $tr$;
END $$;


-- ============================================================
-- 6. Seed de categorias deportivas con attribute_schema
--    attribute_schema spec:
--      key, label, type (select|color|number|text|multiselect),
--      required, options[], applies_to ('product'|'variant'), unit?
-- ============================================================

INSERT INTO public.product_categories (slug, name, icon, sport, attribute_schema, sort_order) VALUES
-- ---------------- ROPA DEPORTIVA ----------------
('ropa-deportiva', 'Ropa Deportiva', 'shirt', NULL,
 '[
    {"key":"genero","label":"Género","type":"select","required":true,"applies_to":"product",
     "options":["hombre","mujer","unisex","niño","niña"]},
    {"key":"deporte","label":"Deporte","type":"select","required":false,"applies_to":"product",
     "options":["futbol","baloncesto","tenis","running","gym","ciclismo","natacion","crossfit","yoga","otro"]},
    {"key":"temporada","label":"Temporada","type":"select","required":false,"applies_to":"product",
     "options":["primavera-verano","otono-invierno","todo-el-ano"]},
    {"key":"talla","label":"Talla","type":"select","required":true,"applies_to":"variant",
     "options":["XS","S","M","L","XL","XXL","XXXL"]},
    {"key":"color","label":"Color","type":"color","required":true,"applies_to":"variant"}
 ]'::jsonb, 10),

-- ---------------- CALZADO ----------------
('calzado', 'Calzado Deportivo', 'footprints', NULL,
 '[
    {"key":"genero","label":"Género","type":"select","required":true,"applies_to":"product",
     "options":["hombre","mujer","unisex","niño","niña"]},
    {"key":"tipo_pisada","label":"Tipo de pisada","type":"select","required":false,"applies_to":"product",
     "options":["neutra","pronadora","supinadora","no-aplica"]},
    {"key":"deporte","label":"Deporte","type":"select","required":false,"applies_to":"product",
     "options":["futbol","baloncesto","tenis","running","trail","gym","ciclismo","crossfit","otro"]},
    {"key":"talla","label":"Talla (Colombia)","type":"select","required":true,"applies_to":"variant",
     "options":["34","35","36","37","38","39","40","41","42","43","44","45","46"]},
    {"key":"color","label":"Color","type":"color","required":true,"applies_to":"variant"}
 ]'::jsonb, 20),

-- ---------------- SUPLEMENTOS ----------------
('suplementos', 'Suplementos', 'pill', NULL,
 '[
    {"key":"tipo","label":"Tipo","type":"select","required":true,"applies_to":"product",
     "options":["proteina","creatina","pre-entreno","aminoacidos","quemador","multivitaminico","ganador-de-masa","otro"]},
    {"key":"restricciones","label":"Restricciones","type":"multiselect","required":false,"applies_to":"product",
     "options":["vegano","sin-gluten","sin-lactosa","kosher","sin-azucar"]},
    {"key":"presentacion","label":"Presentación","type":"select","required":false,"applies_to":"product",
     "options":["polvo","capsulas","liquido","barra","gel"]},
    {"key":"peso_gramos","label":"Peso (g)","type":"number","required":true,"applies_to":"variant","unit":"g"},
    {"key":"sabor","label":"Sabor","type":"select","required":false,"applies_to":"variant",
     "options":["vainilla","chocolate","fresa","cookies-cream","natural","limon","piña-colada","sin-sabor","otro"]}
 ]'::jsonb, 30),

-- ---------------- NUTRICION DEPORTIVA ----------------
('nutricion-deportiva', 'Nutrición Deportiva', 'apple', NULL,
 '[
    {"key":"tipo","label":"Tipo","type":"select","required":true,"applies_to":"product",
     "options":["barra-energetica","gel-energetico","bebida-isotonica","bebida-recuperacion","fruta-deshidratada","otro"]},
    {"key":"restricciones","label":"Restricciones","type":"multiselect","required":false,"applies_to":"product",
     "options":["vegano","sin-gluten","sin-lactosa","sin-azucar","organico"]},
    {"key":"peso_gramos","label":"Peso (g)","type":"number","required":false,"applies_to":"variant","unit":"g"},
    {"key":"sabor","label":"Sabor","type":"text","required":false,"applies_to":"variant"}
 ]'::jsonb, 40),

-- ---------------- EQUIPAMIENTO ----------------
('equipamiento', 'Equipamiento Deportivo', 'dumbbell', NULL,
 '[
    {"key":"deporte","label":"Deporte","type":"select","required":true,"applies_to":"product",
     "options":["futbol","baloncesto","tenis","gym","ciclismo","natacion","crossfit","boxeo","artes-marciales","ciclismo","otro"]},
    {"key":"nivel","label":"Nivel","type":"select","required":false,"applies_to":"product",
     "options":["principiante","intermedio","avanzado","profesional"]},
    {"key":"tamano","label":"Tamaño","type":"text","required":false,"applies_to":"variant"},
    {"key":"color","label":"Color","type":"color","required":false,"applies_to":"variant"},
    {"key":"peso_gramos","label":"Peso (g)","type":"number","required":false,"applies_to":"variant","unit":"g"}
 ]'::jsonb, 50),

-- ---------------- ACCESORIOS ----------------
('accesorios', 'Accesorios', 'glasses', NULL,
 '[
    {"key":"deporte","label":"Deporte","type":"select","required":false,"applies_to":"product",
     "options":["futbol","baloncesto","tenis","running","gym","ciclismo","natacion","crossfit","general","otro"]},
    {"key":"tipo","label":"Tipo","type":"select","required":false,"applies_to":"product",
     "options":["gorra","gafas","mochila","guantes","calcetines","banda","reloj","botella","toalla","otro"]},
    {"key":"tamano","label":"Tamaño","type":"select","required":false,"applies_to":"variant",
     "options":["unico","S","M","L","XL"]},
    {"key":"color","label":"Color","type":"color","required":false,"applies_to":"variant"}
 ]'::jsonb, 60),

-- ---------------- SERVICIOS ----------------
('servicios', 'Servicios Profesionales', 'briefcase', NULL,
 '[
    {"key":"tipo_servicio","label":"Tipo de servicio","type":"select","required":true,"applies_to":"product",
     "options":["fisioterapia","nutricion","psicologia","medicina-deportiva","entrenamiento-personal","preparacion-fisica","masaje-deportivo","asesoria-tecnica","otro"]},
    {"key":"modalidad","label":"Modalidad","type":"select","required":true,"applies_to":"product",
     "options":["presencial","virtual","hibrida","a-domicilio"]},
    {"key":"nivel","label":"Nivel objetivo","type":"select","required":false,"applies_to":"product",
     "options":["principiante","intermedio","avanzado","profesional","todos"]},
    {"key":"duracion_minutos","label":"Duración (min)","type":"number","required":true,"applies_to":"variant","unit":"min"},
    {"key":"variacion","label":"Tipo de sesión","type":"text","required":false,"applies_to":"variant"}
 ]'::jsonb, 70)

ON CONFLICT (slug) DO UPDATE
    SET name             = EXCLUDED.name,
        icon             = EXCLUDED.icon,
        sport            = EXCLUDED.sport,
        attribute_schema = EXCLUDED.attribute_schema,
        sort_order       = EXCLUDED.sort_order,
        updated_at       = now();


-- ============================================================
-- 7. Migracion de datos: products.category (text) -> category_id
--    Mapea strings legacy a slugs de la nueva taxonomia.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'category'
    ) THEN
        RETURN;
    END IF;

    -- Mapeo: texto legacy -> slug nuevo
    EXECUTE $sql$
        UPDATE public.products p
        SET category_id = c.id
        FROM public.product_categories c
        WHERE p.category_id IS NULL
          AND c.slug = CASE lower(coalesce(p.category, ''))
              WHEN 'ropa'          THEN 'ropa-deportiva'
              WHEN 'ropa-deportiva' THEN 'ropa-deportiva'
              WHEN 'futbol'        THEN 'equipamiento'
              WHEN 'baloncesto'    THEN 'equipamiento'
              WHEN 'tenis'         THEN 'equipamiento'
              WHEN 'natación'      THEN 'equipamiento'
              WHEN 'natacion'      THEN 'equipamiento'
              WHEN 'running'       THEN 'calzado'
              WHEN 'fitness'       THEN 'equipamiento'
              WHEN 'gym'           THEN 'equipamiento'
              WHEN 'boxeo'         THEN 'equipamiento'
              WHEN 'ciclismo'      THEN 'equipamiento'
              WHEN 'accesorios'    THEN 'accesorios'
              WHEN 'nutrición'     THEN 'nutricion-deportiva'
              WHEN 'nutricion'     THEN 'nutricion-deportiva'
              WHEN 'suplementos'   THEN 'suplementos'
              WHEN 'calzado'       THEN 'calzado'
              ELSE NULL
          END;
    $sql$;
END $$;


-- ============================================================
-- 8. Comentarios
-- ============================================================

COMMENT ON TABLE public.product_categories IS
    'Taxonomia jerarquica de categorias. attribute_schema describe campos dinamicos a pedir en el wizard de producto.';
COMMENT ON COLUMN public.product_categories.attribute_schema IS
    'JSONB array. Cada elemento: {key, label, type (select|color|number|text|multiselect), required, options?, applies_to (product|variant), unit?}.';
COMMENT ON TABLE public.product_brands IS
    'Marcas reconocidas. is_official = marca con cuenta verificada en SportMaps.';
