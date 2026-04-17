-- ============================================================
-- SPORTMAPS MARKETPLACE — FASE 9: LOGISTICA E INTEGRACIONES
-- Shipping zones/rates, shipments con tracking,
-- invoices (facturacion), notificaciones automaticas
-- ============================================================


-- ============================================================
-- 1. TABLA shipping_zones
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    cities      text[]      NOT NULL DEFAULT '{}',
    is_default  boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Zonas iniciales Colombia
INSERT INTO public.shipping_zones (name, cities, is_default) VALUES
    ('Bogota', ARRAY['Bogota', 'Bogotá', 'Soacha', 'Chia', 'Zipaquira'], false),
    ('Medellin', ARRAY['Medellin', 'Medellín', 'Envigado', 'Bello', 'Itagui'], false),
    ('Cali', ARRAY['Cali', 'Palmira', 'Yumbo', 'Jamundi'], false),
    ('Nacional', ARRAY[]::text[], true)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 2. TABLA shipping_rates
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
CREATE INDEX IF NOT EXISTS idx_shipping_rates_zone ON public.shipping_rates(shipping_zone_id);


-- ============================================================
-- 3. TABLA shipments (envios con tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipments (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid        NOT NULL REFERENCES public.orders(id),
    vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id),
    carrier             text,
    tracking_number     text,
    tracking_url        text,
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'picked_up', 'in_transit', 'delivered', 'returned')),
    shipped_at          timestamptz,
    delivered_at        timestamptz,
    estimated_delivery  date,
    shipping_cost       numeric     NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_vendor ON public.shipments(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);

DROP TRIGGER IF EXISTS trg_shipments_updated_at ON public.shipments;
CREATE TRIGGER trg_shipments_updated_at
    BEFORE UPDATE ON public.shipments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 4. TABLA invoices (facturacion)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoices (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid        NOT NULL REFERENCES public.orders(id),
    vendor_profile_id   uuid        REFERENCES public.vendor_profiles(id),
    invoice_type        text        NOT NULL
                                    CHECK (invoice_type IN ('purchase', 'commission', 'payout')),
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

CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON public.invoices(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);

-- Secuencia para invoice_number
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 1000;


-- ============================================================
-- 5. RLS
-- ============================================================

-- shipping_zones: lectura publica
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipping_zones_select_public"
    ON public.shipping_zones FOR SELECT USING (true);

-- shipping_rates: lectura publica, CRUD vendor
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipping_rates_select_public"
    ON public.shipping_rates FOR SELECT
    USING (is_active = true);

CREATE POLICY "shipping_rates_owner"
    ON public.shipping_rates FOR ALL TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
        )
    );

-- shipments: comprador y vendedor
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipments_select_buyer"
    ON public.shipments FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders o WHERE o.id = shipments.order_id AND o.user_id = auth.uid()
        )
    );

CREATE POLICY "shipments_vendor"
    ON public.shipments FOR ALL TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
        )
    );

-- invoices: comprador y vendedor
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_buyer"
    ON public.invoices FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders o WHERE o.id = invoices.order_id AND o.user_id = auth.uid()
        )
    );

CREATE POLICY "invoices_select_vendor"
    ON public.invoices FOR SELECT TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
        )
    );


-- ============================================================
-- 6. TRIGGER: auto_complete_order_on_delivery
-- Cuando un shipment pasa a 'delivered', marcar orden como
-- 'completed' si todos los envios estan entregados.
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_complete_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pending integer;
BEGIN
    IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
        -- Contar envios no entregados de la misma orden
        SELECT COUNT(*) INTO v_pending
        FROM shipments
        WHERE order_id = NEW.order_id
          AND status NOT IN ('delivered', 'returned');

        -- Si todos entregados, completar la orden
        IF v_pending = 0 THEN
            UPDATE orders SET status = 'completed' WHERE id = NEW.order_id;
        END IF;

        -- Notificar al comprador
        INSERT INTO notifications (user_id, title, message, type, link)
        SELECT o.user_id,
            'Pedido entregado',
            format('Tu pedido #%s ha sido entregado', LEFT(NEW.order_id::text, 8)),
            'info',
            '/marketplace/orders/' || NEW.order_id
        FROM orders o WHERE o.id = NEW.order_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_complete_delivery ON public.shipments;
CREATE TRIGGER trg_auto_complete_delivery
    AFTER UPDATE ON public.shipments
    FOR EACH ROW EXECUTE FUNCTION public.auto_complete_on_delivery();


-- ============================================================
-- 7. TRIGGER: notify_vendor_on_order
-- Al crear una orden, notificar a cada vendedor involucrado
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_vendor_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vendor_id uuid;
BEGIN
    -- Notificar a cada vendor unico en la orden
    FOR v_vendor_id IN
        SELECT DISTINCT oi.vendor_id
        FROM order_items oi
        WHERE oi.order_id = NEW.id
          AND oi.vendor_id IS NOT NULL
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_vendor_id,
            'Nuevo pedido recibido',
            format('Tienes un nuevo pedido por $%s COP', NEW.total_amount),
            'info',
            '/vendor/orders'
        );
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_vendor_new_order ON public.orders;
CREATE TRIGGER trg_notify_vendor_new_order
    AFTER INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.notify_vendor_on_new_order();


-- ============================================================
-- 8. FUNCTION: generate_invoice_number
-- Genera numero de factura secuencial
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := 'SM-' || LPAD(nextval('invoice_number_seq')::text, 8, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_number ON public.invoices;
CREATE TRIGGER trg_invoice_number
    BEFORE INSERT ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();


-- ============================================================
-- 9. COMENTARIOS
-- ============================================================

COMMENT ON TABLE public.shipping_zones IS 'Zonas de envio con ciudades asociadas. La zona "Nacional" es default.';
COMMENT ON TABLE public.shipping_rates IS 'Tarifas de envio por zona, peso y vendedor. is_free_above = envio gratis sobre X.';
COMMENT ON TABLE public.shipments IS 'Envios con tracking. Status: pending → picked_up → in_transit → delivered.';
COMMENT ON TABLE public.invoices IS 'Facturas generadas: purchase (comprador), commission (vendedor), payout (retiro).';
