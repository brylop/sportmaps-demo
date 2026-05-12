-- ============================================================
-- SPORTMAPS MARKETPLACE — R4.1 Pipeline de envios (aggregator)
--
-- Ya existe (de 20260418000002_logistics_integrations):
--   - shipping_zones    (zonas CO con cities[])
--   - shipping_rates    (tarifa vendor x zona x peso)
--   - shipments         (envio con tracking)
--   - invoices          (factura/comision/payout)
--   - trigger auto_complete_on_delivery, notify_vendor_on_new_order
--
-- Esta migracion agrega:
--   1. shipping_carriers       — catalogo de carriers (Servientrega, ...)
--   2. vendor_shipping_settings — origen + cajas + carriers aceptados
--   3. shipping_rate_quotes    — cache de cotizaciones
--   4. ALTER shipments: cost_amount, label_url, events, raw_response,
--                       weight_grams, dimensions, origin, destination
--   5. Vista vendor_shipments_summary (KPIs envios)
--
-- Estrategia: BFF tiene un adapter pattern.
--   - MockProvider (default, devuelve quotes calculadas con shipping_rates)
--   - MoxProvider, DrenvioProvider, ServientregaProvider (a enchufar)
-- Esta migracion no presupone provider — solo deja la BD lista.
-- ============================================================


-- ============================================================
-- 1. shipping_carriers — catalogo
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_carriers (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code              text        NOT NULL UNIQUE,
    name              text        NOT NULL,
    logo_url          text,
    -- 'direct' = integramos directo con el carrier
    -- 'mox', 'drenvio', '99minutos' = via aggregator
    -- 'manual' = no hay integracion, vendor coordina con sus medios
    api_provider      text        NOT NULL DEFAULT 'manual'
                                  CHECK (api_provider IN ('direct','mox','drenvio','99minutos','shippify','manual')),
    supports_cod      boolean     NOT NULL DEFAULT false,   -- cash on delivery
    supports_pickup   boolean     NOT NULL DEFAULT true,
    supports_tracking boolean     NOT NULL DEFAULT true,
    coverage          text        NOT NULL DEFAULT 'national'
                                  CHECK (coverage IN ('intracity','national','international')),
    is_active         boolean     NOT NULL DEFAULT true,
    sort_order        integer     NOT NULL DEFAULT 0,
    metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_carriers_active   ON public.shipping_carriers(is_active);
CREATE INDEX IF NOT EXISTS idx_shipping_carriers_provider ON public.shipping_carriers(api_provider);

-- Seed: carriers principales en Colombia
INSERT INTO public.shipping_carriers (code, name, api_provider, coverage, supports_cod, sort_order) VALUES
    ('servientrega',      'Servientrega',           'mox',    'national',   true,  10),
    ('coordinadora',      'Coordinadora',           'mox',    'national',   true,  20),
    ('interrapidisimo',   'Interrapidísimo',        'mox',    'national',   true,  30),
    ('envia_colvanes',    'Envía Colvanes',         'mox',    'national',   true,  40),
    ('tcc',               'TCC',                    'mox',    'national',   false, 50),
    ('mensajeros_urbanos','Mensajeros Urbanos',     'direct', 'intracity',  false, 60),
    ('picap',             'Picap',                  'direct', 'intracity',  false, 70),
    ('rappi_cargo',       'Rappi Cargo',            'direct', 'intracity',  false, 80),
    ('pickup_in_store',   'Recoger en tienda',      'manual', 'intracity',  false, 90),
    ('vendor_delivers',   'Envio propio del vendor','manual', 'national',   true,  100)
ON CONFLICT (code) DO UPDATE
    SET name            = EXCLUDED.name,
        api_provider    = EXCLUDED.api_provider,
        coverage        = EXCLUDED.coverage,
        supports_cod    = EXCLUDED.supports_cod,
        sort_order      = EXCLUDED.sort_order;

ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_carriers_public_read" ON public.shipping_carriers;
CREATE POLICY "shipping_carriers_public_read"
    ON public.shipping_carriers FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "shipping_carriers_admin_write" ON public.shipping_carriers;
CREATE POLICY "shipping_carriers_admin_write"
    ON public.shipping_carriers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role::text IN ('admin','super_admin')
        )
    );


-- ============================================================
-- 2. vendor_shipping_settings — config de envios por vendor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_shipping_settings (
    vendor_profile_id        uuid        PRIMARY KEY REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,

    -- Origen de despacho
    origin_address           jsonb       NOT NULL DEFAULT '{}'::jsonb,
    origin_city              text,
    origin_state             text,
    origin_postal_code       text,
    origin_country           text        NOT NULL DEFAULT 'CO',

    -- Dimensiones default de caja (cm) y peso default (g)
    default_box_length_cm    integer,
    default_box_width_cm     integer,
    default_box_height_cm    integer,
    default_weight_grams     integer,

    -- Politica de envio
    free_shipping_min_amount numeric,                       -- envio gratis sobre X
    ready_to_ship_hours      integer     NOT NULL DEFAULT 24,
    accepts_pickup_in_store  boolean     NOT NULL DEFAULT false,
    pickup_addresses         jsonb       NOT NULL DEFAULT '[]'::jsonb,

    -- Carriers que este vendor acepta (codes de shipping_carriers)
    accepted_carrier_codes   text[]      NOT NULL DEFAULT ARRAY[]::text[],

    -- Politica de devoluciones
    return_policy_days       integer     NOT NULL DEFAULT 0,
    return_policy_text       text,

    metadata                 jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_vendor_shipping_settings_updated_at ON public.vendor_shipping_settings $tr$;
        EXECUTE $tr$
            CREATE TRIGGER trg_vendor_shipping_settings_updated_at
            BEFORE UPDATE ON public.vendor_shipping_settings
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
        $tr$;
    END IF;
END $$;

ALTER TABLE public.vendor_shipping_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_shipping_settings_owner" ON public.vendor_shipping_settings;
CREATE POLICY "vendor_shipping_settings_owner"
    ON public.vendor_shipping_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
            WHERE vp.id = vendor_shipping_settings.vendor_profile_id
              AND vp.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
            WHERE vp.id = vendor_shipping_settings.vendor_profile_id
              AND vp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "vendor_shipping_settings_public_read" ON public.vendor_shipping_settings;
CREATE POLICY "vendor_shipping_settings_public_read"
    ON public.vendor_shipping_settings FOR SELECT
    USING (true);   -- el comprador necesita ver origin_city para calcular envio


-- ============================================================
-- 3. shipping_rate_quotes — cache de cotizaciones del aggregator
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_rate_quotes (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id             text,                    -- session/user-based para anonimos
    user_id             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

    origin              jsonb       NOT NULL,    -- {city, state, postal_code, address}
    destination         jsonb       NOT NULL,
    weight_grams        integer     NOT NULL,
    declared_value      numeric,
    dimensions          jsonb,                   -- {length, width, height}

    -- Resultado: array de quotes con {carrier_code, service, days_min, days_max, cost}
    quotes              jsonb       NOT NULL DEFAULT '[]'::jsonb,
    provider            text        NOT NULL DEFAULT 'mock',
    raw_response        jsonb,

    expires_at          timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_quotes_cart    ON public.shipping_rate_quotes(cart_id) WHERE cart_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_user    ON public.shipping_rate_quotes(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_expires ON public.shipping_rate_quotes(expires_at);

ALTER TABLE public.shipping_rate_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_quotes_owner_read" ON public.shipping_rate_quotes;
CREATE POLICY "shipping_quotes_owner_read"
    ON public.shipping_rate_quotes FOR SELECT
    USING (
        user_id = auth.uid()
        OR (user_id IS NULL AND cart_id IS NOT NULL)   -- anonimos por cart_id
    );

DROP POLICY IF EXISTS "shipping_quotes_insert" ON public.shipping_rate_quotes;
CREATE POLICY "shipping_quotes_insert"
    ON public.shipping_rate_quotes FOR INSERT
    WITH CHECK (true);   -- cualquiera puede crear quote (anonimo OK)


-- ============================================================
-- 4. Extender shipments con columnas faltantes
-- ============================================================

DO $$
BEGIN
    IF to_regclass('public.shipments') IS NOT NULL THEN
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS carrier_code text                $sql$;
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS label_url    text                $sql$;
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS label_format text DEFAULT 'pdf'  $sql$;
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS weight_grams integer             $sql$;
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS dimensions   jsonb               $sql$;
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS origin       jsonb               $sql$;
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS destination  jsonb               $sql$;
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS events       jsonb NOT NULL DEFAULT '[]'::jsonb $sql$;
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS raw_response jsonb               $sql$;
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS provider     text                $sql$;
        EXECUTE $sql$ ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pickup_at    timestamptz         $sql$;

        -- FK opcional al catalogo
        EXECUTE $sql$
            ALTER TABLE public.shipments
            ADD COLUMN IF NOT EXISTS carrier_id uuid REFERENCES public.shipping_carriers(id) ON DELETE SET NULL
        $sql$;

        -- Ampliar status check (agregar out_for_delivery, lost, label_created)
        EXECUTE $sql$ ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_status_check $sql$;
        EXECUTE $sql$
            ALTER TABLE public.shipments
            ADD CONSTRAINT shipments_status_check
            CHECK (status IN (
                'pending', 'label_created', 'picked_up', 'in_transit',
                'out_for_delivery', 'delivered', 'returned', 'lost', 'failed'
            ))
        $sql$;

        EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_shipments_carrier_code ON public.shipments(carrier_code) WHERE carrier_code IS NOT NULL $sql$;
        EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_shipments_tracking     ON public.shipments(tracking_number) WHERE tracking_number IS NOT NULL $sql$;
    END IF;
END $$;


-- ============================================================
-- 5. Vista: vendor_shipments_summary (KPIs)
-- ============================================================

DROP VIEW IF EXISTS public.vendor_shipments_summary;
CREATE VIEW public.vendor_shipments_summary AS
SELECT
    s.vendor_profile_id,
    COUNT(*) FILTER (WHERE s.status = 'pending')                          AS pending_count,
    COUNT(*) FILTER (WHERE s.status IN ('picked_up','in_transit'))        AS in_transit_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered')                        AS delivered_count,
    COUNT(*) FILTER (WHERE s.status = 'returned')                         AS returned_count,
    COUNT(*)                                                              AS total,
    AVG(EXTRACT(EPOCH FROM (s.delivered_at - s.shipped_at)) / 86400)
        FILTER (WHERE s.delivered_at IS NOT NULL AND s.shipped_at IS NOT NULL) AS avg_delivery_days
FROM public.shipments s
GROUP BY s.vendor_profile_id;


-- ============================================================
-- 6. RPC: get_shipping_quote_mock — mock provider para arrancar sin
--    aggregator. Calcula costo via shipping_rates si existen, sino
--    devuelve estimacion plana.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_shipping_quote_mock(
    p_origin_city      text,
    p_destination_city text,
    p_weight_grams     integer,
    p_vendor_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_zone_id    uuid;
    v_quotes     jsonb := '[]'::jsonb;
    v_rate       RECORD;
    v_same_city  boolean;
BEGIN
    v_same_city := (lower(trim(p_origin_city)) = lower(trim(p_destination_city)));

    -- Resolver zona destino
    SELECT id INTO v_zone_id
      FROM public.shipping_zones
     WHERE p_destination_city = ANY(cities) OR (is_default AND v_zone_id IS NULL)
     ORDER BY (p_destination_city = ANY(cities)) DESC, is_default ASC
     LIMIT 1;

    -- Buscar tarifas del vendor para esa zona
    IF p_vendor_profile_id IS NOT NULL AND v_zone_id IS NOT NULL THEN
        FOR v_rate IN
            SELECT sr.carrier, sr.price, sr.estimated_days, sr.is_free_above
              FROM public.shipping_rates sr
             WHERE sr.vendor_profile_id = p_vendor_profile_id
               AND sr.shipping_zone_id  = v_zone_id
               AND sr.is_active         = true
               AND p_weight_grams BETWEEN sr.min_weight_grams AND sr.max_weight_grams
        LOOP
            v_quotes := v_quotes || jsonb_build_object(
                'carrier_code', COALESCE(v_rate.carrier, 'vendor_delivers'),
                'service',      'standard',
                'cost',         v_rate.price,
                'days_min',     GREATEST(v_rate.estimated_days - 1, 1),
                'days_max',     v_rate.estimated_days + 1,
                'free_above',   v_rate.is_free_above
            );
        END LOOP;
    END IF;

    -- Fallback: tarifas planas de mock por carriers verificados
    IF jsonb_array_length(v_quotes) = 0 THEN
        IF v_same_city THEN
            v_quotes := jsonb_build_array(
                jsonb_build_object('carrier_code','mensajeros_urbanos','service','same_day','cost', 12000, 'days_min', 0, 'days_max', 1),
                jsonb_build_object('carrier_code','coordinadora',      'service','intracity','cost',  9000, 'days_min', 1, 'days_max', 2)
            );
        ELSE
            v_quotes := jsonb_build_array(
                jsonb_build_object('carrier_code','coordinadora',    'service','standard',     'cost', 14000, 'days_min', 2, 'days_max', 4),
                jsonb_build_object('carrier_code','servientrega',    'service','standard',     'cost', 15000, 'days_min', 2, 'days_max', 5),
                jsonb_build_object('carrier_code','interrapidisimo', 'service','express',      'cost', 18000, 'days_min', 1, 'days_max', 3)
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'origin_city',      p_origin_city,
        'destination_city', p_destination_city,
        'weight_grams',     p_weight_grams,
        'same_city',        v_same_city,
        'provider',         'mock',
        'quotes',           v_quotes
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shipping_quote_mock(text, text, integer, uuid) TO authenticated, anon;


-- ============================================================
-- 7. Comentarios
-- ============================================================

COMMENT ON TABLE public.shipping_carriers        IS 'Catalogo de transportadoras. api_provider define como integrar (mock, mox aggregator, direct API, manual).';
COMMENT ON TABLE public.vendor_shipping_settings IS 'Config de envios por vendor: origen, cajas default, carriers aceptados, politica de devolucion.';
COMMENT ON TABLE public.shipping_rate_quotes     IS 'Cache de cotizaciones del provider. Expira en 15 min. Permite seleccionar tarifa al checkout.';
COMMENT ON FUNCTION public.get_shipping_quote_mock IS 'Mock provider. Reemplazar al integrar Mox/Drenvio real. Devuelve quotes plausibles para arrancar.';
