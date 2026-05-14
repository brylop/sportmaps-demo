-- ============================================================
-- SPORTMAPS — R4.1 correctiva 2/2
--
-- La migracion 20260511000021 fallo porque public.shipping_zones
-- existia previamente sin la columna `name`. Algo en una migracion
-- previa la creo con shape distinto.
--
-- Estrategia: asegurar TODAS las columnas via ALTER TABLE ADD
-- COLUMN IF NOT EXISTS antes de hacer INSERT del seed. Lo mismo
-- para shipping_rates, shipments, invoices.
-- ============================================================


-- ============================================================
-- 1. shipping_zones — asegurar columnas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS name        text;
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS cities      text[] DEFAULT '{}'::text[];
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS is_default  boolean DEFAULT false;
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

-- Backfill: si por algun motivo hay filas sin name, ponerle uno
UPDATE public.shipping_zones SET name = 'Zona ' || left(id::text, 8)
WHERE name IS NULL;

-- Ahora si, NOT NULL en name
ALTER TABLE public.shipping_zones ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.shipping_zones ALTER COLUMN cities SET NOT NULL;
ALTER TABLE public.shipping_zones ALTER COLUMN cities SET DEFAULT '{}'::text[];
ALTER TABLE public.shipping_zones ALTER COLUMN is_default SET NOT NULL;
ALTER TABLE public.shipping_zones ALTER COLUMN is_default SET DEFAULT false;
ALTER TABLE public.shipping_zones ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.shipping_zones ALTER COLUMN created_at SET DEFAULT now();

-- Seed (idempotente — si ya hay zonas con el mismo nombre, no se duplican)
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
-- 2. shipping_rates — asegurar columnas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS vendor_profile_id uuid REFERENCES public.vendor_profiles(id);
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS shipping_zone_id  uuid REFERENCES public.shipping_zones(id);
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS min_weight_grams  integer DEFAULT 0;
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS max_weight_grams  integer DEFAULT 999999;
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS price             numeric DEFAULT 0;
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS estimated_days    integer DEFAULT 3;
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS carrier           text;
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS is_free_above     numeric;
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS is_active         boolean DEFAULT true;
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS created_at        timestamptz DEFAULT now();

-- Constraints solo si los valores son validos
DO $$
BEGIN
    -- Solo agregar check si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'shipping_rates'
          AND constraint_name = 'shipping_rates_price_check'
    ) THEN
        BEGIN
            EXECUTE 'ALTER TABLE public.shipping_rates ADD CONSTRAINT shipping_rates_price_check CHECK (price >= 0)';
        EXCEPTION WHEN check_violation THEN
            RAISE NOTICE 'No se pudo agregar check price >= 0: hay rows con price negativo';
        END;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shipping_rates_vendor ON public.shipping_rates(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_zone   ON public.shipping_rates(shipping_zone_id);

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shipping_rates_select_public" ON public.shipping_rates;
CREATE POLICY "shipping_rates_select_public" ON public.shipping_rates FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "shipping_rates_owner" ON public.shipping_rates;
CREATE POLICY "shipping_rates_owner" ON public.shipping_rates FOR ALL TO authenticated
    USING (vendor_profile_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()));


-- ============================================================
-- 3. shipments — asegurar columnas (base + R4.1)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Columnas base
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS order_id           uuid REFERENCES public.orders(id);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS vendor_profile_id  uuid REFERENCES public.vendor_profiles(id);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS carrier            text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS tracking_number    text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS tracking_url       text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS status             text DEFAULT 'pending';
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS shipped_at         timestamptz;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS delivered_at       timestamptz;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS estimated_delivery date;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS shipping_cost      numeric DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS created_at         timestamptz DEFAULT now();
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS updated_at         timestamptz DEFAULT now();

-- Columnas R4.1
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS carrier_code text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS label_url    text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS label_format text DEFAULT 'pdf';
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS weight_grams integer;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS dimensions   jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS origin       jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS destination  jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS events       jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS raw_response jsonb;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS provider     text;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pickup_at    timestamptz;

-- FK al catalogo
DO $$
BEGIN
    IF to_regclass('public.shipping_carriers') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'carrier_id'
       ) THEN
        EXECUTE 'ALTER TABLE public.shipments ADD COLUMN carrier_id uuid REFERENCES public.shipping_carriers(id) ON DELETE SET NULL';
    END IF;
END $$;

-- NOT NULL en campos esenciales (solo si todas las filas tienen valor)
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.shipments ALTER COLUMN order_id          SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'shipments.order_id no se pudo marcar NOT NULL (hay filas con NULL)';
    END;
    BEGIN
        ALTER TABLE public.shipments ALTER COLUMN vendor_profile_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'shipments.vendor_profile_id no se pudo marcar NOT NULL';
    END;
    BEGIN
        ALTER TABLE public.shipments ALTER COLUMN status            SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'shipments.status no se pudo marcar NOT NULL';
    END;
    BEGIN
        ALTER TABLE public.shipments ALTER COLUMN events            SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'shipments.events no se pudo marcar NOT NULL';
    END;
END $$;

-- Status check
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
        EXECUTE 'CREATE TRIGGER trg_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shipments_select_buyer" ON public.shipments;
CREATE POLICY "shipments_select_buyer" ON public.shipments FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = shipments.order_id AND o.user_id = auth.uid()));
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
-- 5. invoices — asegurar columnas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS order_id          uuid REFERENCES public.orders(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vendor_profile_id uuid REFERENCES public.vendor_profiles(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_type      text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number    text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS buyer_name        text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS buyer_document    text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS buyer_email       text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS seller_name       text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS seller_nit        text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal          numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount        numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total             numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency          text DEFAULT 'COP';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pdf_url           text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_at        timestamptz DEFAULT now();

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invoices_invoice_number_key'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='invoices' AND column_name='invoice_number'
    ) THEN
        BEGIN
            EXECUTE 'ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number)';
        EXCEPTION WHEN unique_violation THEN
            RAISE NOTICE 'Hay invoice_numbers duplicados — saltar UNIQUE constraint.';
        END;
    END IF;
END $$;

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
