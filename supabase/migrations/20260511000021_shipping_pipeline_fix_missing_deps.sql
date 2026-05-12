-- ============================================================
-- SPORTMAPS — R4.1 correctiva
--
-- La migracion 20260511000020 fallo al crear el view
-- vendor_shipments_summary porque public.shipments no existe en
-- esta DB (la migracion base 20260418000002_logistics_integrations
-- nunca se aplico).
--
-- Esta migracion:
--   1. Crea shipments, shipping_zones y shipping_rates si faltan
--      (versiones minimas, idempotentes)
--   2. Recrea el view solo si shipments existe
--   3. Reescribe get_shipping_quote_mock con guards to_regclass
--      para que no falle si shipping_zones / shipping_rates faltan
-- ============================================================


-- ============================================================
-- 1. shipping_zones — minimal con seed
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    cities      text[]      NOT NULL DEFAULT '{}',
    is_default  boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.shipping_zones (name, cities, is_default) VALUES
    ('Bogota',   ARRAY['Bogota','Bogotá','Soacha','Chia','Zipaquira'], false),
    ('Medellin', ARRAY['Medellin','Medellín','Envigado','Bello','Itagui'], false),
    ('Cali',     ARRAY['Cali','Palmira','Yumbo','Jamundi'], false),
    ('Nacional', ARRAY[]::text[], true)
ON CONFLICT DO NOTHING;

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shipping_zones_select_public" ON public.shipping_zones;
CREATE POLICY "shipping_zones_select_public" ON public.shipping_zones FOR SELECT USING (true);


-- ============================================================
-- 2. shipping_rates — vendor tarifa por zona/peso
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_rates (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id   uuid        REFERENCES public.vendor_profiles(id),
    shipping_zone_id    uuid        NOT NULL REFERENCES public.shipping_zones(id),
    min_weight_grams    integer     NOT NULL DEFAULT 0,
    max_weight_grams    integer     NOT NULL DEFAULT 999999,
    price               numeric     NOT NULL CHECK (price >= 0),
    estimated_days      integer     NOT NULL DEFAULT 3,
    carrier             text,
    is_free_above       numeric,
    is_active           boolean     NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_rates_vendor ON public.shipping_rates(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_zone   ON public.shipping_rates(shipping_zone_id);

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shipping_rates_select_public" ON public.shipping_rates;
CREATE POLICY "shipping_rates_select_public" ON public.shipping_rates FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "shipping_rates_owner" ON public.shipping_rates;
CREATE POLICY "shipping_rates_owner" ON public.shipping_rates FOR ALL TO authenticated
    USING (vendor_profile_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()));


-- ============================================================
-- 3. shipments — minimal con TODAS las columnas (base + R4.1)
--    Idempotente: si la base de 20260418000002 ya existe, los
--    ADD COLUMN IF NOT EXISTS no la rompen.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipments (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid        NOT NULL REFERENCES public.orders(id),
    vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id),
    carrier             text,
    tracking_number     text,
    tracking_url        text,
    status              text        NOT NULL DEFAULT 'pending',
    shipped_at          timestamptz,
    delivered_at        timestamptz,
    estimated_delivery  date,
    shipping_cost       numeric     NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Columnas adicionales R4.1
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS carrier_code text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS label_url    text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS label_format text DEFAULT 'pdf';
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS weight_grams integer;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS dimensions   jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS origin       jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS destination  jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS events       jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS raw_response jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS provider     text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pickup_at    timestamptz;

-- FK al catalogo (puede ya existir o no, defensivo)
DO $$
BEGIN
    IF to_regclass('public.shipping_carriers') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name   = 'shipments'
             AND column_name  = 'carrier_id'
       ) THEN
        EXECUTE 'ALTER TABLE public.shipments
                 ADD COLUMN carrier_id uuid REFERENCES public.shipping_carriers(id) ON DELETE SET NULL';
    END IF;
END $$;

-- Status check actualizado
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_status_check
    CHECK (status IN (
        'pending','label_created','picked_up','in_transit',
        'out_for_delivery','delivered','returned','lost','failed'
    ));

CREATE INDEX IF NOT EXISTS idx_shipments_order        ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_vendor       ON public.shipments(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status       ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_code ON public.shipments(carrier_code) WHERE carrier_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_tracking     ON public.shipments(tracking_number) WHERE tracking_number IS NOT NULL;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_shipments_updated_at ON public.shipments';
        EXECUTE 'CREATE TRIGGER trg_shipments_updated_at
                 BEFORE UPDATE ON public.shipments
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shipments_select_buyer" ON public.shipments;
CREATE POLICY "shipments_select_buyer" ON public.shipments FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.orders o WHERE o.id = shipments.order_id AND o.user_id = auth.uid()
    ));
DROP POLICY IF EXISTS "shipments_vendor" ON public.shipments;
CREATE POLICY "shipments_vendor" ON public.shipments FOR ALL TO authenticated
    USING (vendor_profile_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()));


-- ============================================================
-- 4. View vendor_shipments_summary
-- ============================================================

DROP VIEW IF EXISTS public.vendor_shipments_summary;
CREATE VIEW public.vendor_shipments_summary AS
SELECT
    s.vendor_profile_id,
    COUNT(*) FILTER (WHERE s.status = 'pending')                                     AS pending_count,
    COUNT(*) FILTER (WHERE s.status IN ('picked_up','in_transit'))                   AS in_transit_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered')                                   AS delivered_count,
    COUNT(*) FILTER (WHERE s.status = 'returned')                                    AS returned_count,
    COUNT(*)                                                                          AS total,
    AVG(EXTRACT(EPOCH FROM (s.delivered_at - s.shipped_at)) / 86400)
        FILTER (WHERE s.delivered_at IS NOT NULL AND s.shipped_at IS NOT NULL)        AS avg_delivery_days
FROM public.shipments s
GROUP BY s.vendor_profile_id;


-- ============================================================
-- 5. Reescribir get_shipping_quote_mock con guards
--    para que funcione aunque falten tablas dependientes.
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

    -- Resolver zona solo si shipping_zones existe
    IF to_regclass('public.shipping_zones') IS NOT NULL THEN
        SELECT id INTO v_zone_id
          FROM public.shipping_zones
         WHERE p_destination_city = ANY(cities) OR (is_default AND v_zone_id IS NULL)
         ORDER BY (p_destination_city = ANY(cities)) DESC, is_default ASC
         LIMIT 1;
    END IF;

    -- Buscar tarifas del vendor para esa zona si ambas tablas existen
    IF p_vendor_profile_id IS NOT NULL
       AND v_zone_id IS NOT NULL
       AND to_regclass('public.shipping_rates') IS NOT NULL THEN
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

    -- Fallback: tarifas planas hardcoded
    IF jsonb_array_length(v_quotes) = 0 THEN
        IF v_same_city THEN
            v_quotes := jsonb_build_array(
                jsonb_build_object('carrier_code','mensajeros_urbanos','service','same_day','cost', 12000, 'days_min', 0, 'days_max', 1),
                jsonb_build_object('carrier_code','coordinadora',      'service','intracity','cost',  9000, 'days_min', 1, 'days_max', 2)
            );
        ELSE
            v_quotes := jsonb_build_array(
                jsonb_build_object('carrier_code','coordinadora',    'service','standard','cost', 14000, 'days_min', 2, 'days_max', 4),
                jsonb_build_object('carrier_code','servientrega',    'service','standard','cost', 15000, 'days_min', 2, 'days_max', 5),
                jsonb_build_object('carrier_code','interrapidisimo', 'service','express', 'cost', 18000, 'days_min', 1, 'days_max', 3)
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
-- 6. invoices (de 20260418000002 — minimal por si falta)
--    El BFF no lo usa todavia pero el trigger lo asume
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoices (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid        NOT NULL REFERENCES public.orders(id),
    vendor_profile_id   uuid        REFERENCES public.vendor_profiles(id),
    invoice_type        text        NOT NULL CHECK (invoice_type IN ('purchase','commission','payout')),
    invoice_number      text        NOT NULL UNIQUE,
    buyer_name          text,
    buyer_document      text,
    buyer_email         text,
    seller_name         text,
    seller_nit          text,
    subtotal            numeric     NOT NULL DEFAULT 0,
    tax_amount          numeric     NOT NULL DEFAULT 0,
    total               numeric     NOT NULL DEFAULT 0,
    currency            text        NOT NULL DEFAULT 'COP',
    pdf_url             text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_order  ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON public.invoices(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 1000;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_select_buyer" ON public.invoices;
CREATE POLICY "invoices_select_buyer" ON public.invoices FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = invoices.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "invoices_select_vendor" ON public.invoices;
CREATE POLICY "invoices_select_vendor" ON public.invoices FOR SELECT TO authenticated
    USING (vendor_profile_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()));


-- ============================================================
-- 7. Comentarios
-- ============================================================

COMMENT ON TABLE public.shipping_zones IS 'Zonas de envio CO. Nacional es default.';
COMMENT ON TABLE public.shipping_rates IS 'Tarifas vendor x zona x peso. is_free_above = envio gratis sobre X.';
COMMENT ON TABLE public.shipments      IS 'Envios con tracking. status: pending -> label_created -> picked_up -> in_transit -> out_for_delivery -> delivered.';
COMMENT ON TABLE public.invoices       IS 'Facturas: purchase (comprador), commission (vendor), payout (retiro).';
