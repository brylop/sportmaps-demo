-- ============================================================================
-- Migración Wompi: Reemplaza ePayco como única pasarela de pagos.
--
-- Cambios:
-- 1. Renombra columnas epayco_* → wompi_* en todas las tablas relevantes
-- 2. Renombra epayco_enabled → wompi_enabled en school_settings
-- 3. Agrega columnas de Wompi y envío a orders/order_items (multi-vendor + shipping)
-- 4. Crea tablas nuevas: shipping_zones, inventory_logs, product_images
-- 5. Crea RPC confirm_order_payment (descuenta stock atómico) + actualiza confirm_marketplace_payment
-- 6. RLS policies para orders, order_items, product_variants, shipping_zones, inventory_logs
--
-- Idempotente: usa IF EXISTS / IF NOT EXISTS donde aplica.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. school_settings: epayco_enabled → wompi_enabled
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Si la columna destino ya existe Y tambien la legacy: drop legacy (ya migrado parcialmente)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'school_settings' AND column_name = 'epayco_enabled'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'school_settings' AND column_name = 'wompi_enabled'
  ) THEN
    ALTER TABLE public.school_settings DROP COLUMN epayco_enabled;
  -- Solo legacy: rename seguro
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'school_settings' AND column_name = 'epayco_enabled'
  ) THEN
    ALTER TABLE public.school_settings RENAME COLUMN epayco_enabled TO wompi_enabled;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'school_settings' AND column_name = 'wompi_enabled'
  ) THEN
    ALTER TABLE public.school_settings ADD COLUMN wompi_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. payment_links: epayco_session_id → wompi_reference
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Ambas columnas presentes: drop legacy
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_links' AND column_name = 'epayco_session_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_links' AND column_name = 'wompi_reference'
  ) THEN
    ALTER TABLE public.payment_links DROP COLUMN epayco_session_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_links' AND column_name = 'epayco_session_id'
  ) THEN
    ALTER TABLE public.payment_links RENAME COLUMN epayco_session_id TO wompi_reference;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_links' AND column_name = 'wompi_reference'
  ) THEN
    ALTER TABLE public.payment_links ADD COLUMN wompi_reference TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_links' AND column_name = 'enrollment_id'
  ) THEN
    ALTER TABLE public.payment_links ADD COLUMN enrollment_id UUID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_links_wompi_reference
  ON public.payment_links (wompi_reference)
  WHERE wompi_reference IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. payments: epayco_ref / epayco_transaction_id → wompi_*
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- epayco_ref → wompi_reference
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'epayco_ref'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'wompi_reference'
  ) THEN
    ALTER TABLE public.payments DROP COLUMN epayco_ref;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'epayco_ref'
  ) THEN
    ALTER TABLE public.payments RENAME COLUMN epayco_ref TO wompi_reference;
  END IF;

  -- epayco_transaction_id → wompi_transaction_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'epayco_transaction_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'wompi_transaction_id'
  ) THEN
    ALTER TABLE public.payments DROP COLUMN epayco_transaction_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'epayco_transaction_id'
  ) THEN
    ALTER TABLE public.payments RENAME COLUMN epayco_transaction_id TO wompi_transaction_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'wompi_reference'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN wompi_reference TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'wompi_transaction_id'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN wompi_transaction_id TEXT;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. payment_splits: epayco_* → wompi_*
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- epayco_ref → wompi_reference
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'epayco_ref'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'wompi_reference'
  ) THEN
    ALTER TABLE public.payment_splits DROP COLUMN epayco_ref;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'epayco_ref'
  ) THEN
    ALTER TABLE public.payment_splits RENAME COLUMN epayco_ref TO wompi_reference;
  END IF;

  -- epayco_transaction_id → wompi_transaction_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'epayco_transaction_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'wompi_transaction_id'
  ) THEN
    ALTER TABLE public.payment_splits DROP COLUMN epayco_transaction_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'epayco_transaction_id'
  ) THEN
    ALTER TABLE public.payment_splits RENAME COLUMN epayco_transaction_id TO wompi_transaction_id;
  END IF;

  -- epayco_fee → wompi_fee
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'epayco_fee'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'wompi_fee'
  ) THEN
    ALTER TABLE public.payment_splits DROP COLUMN epayco_fee;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'epayco_fee'
  ) THEN
    ALTER TABLE public.payment_splits RENAME COLUMN epayco_fee TO wompi_fee;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'wompi_reference'
  ) THEN
    ALTER TABLE public.payment_splits ADD COLUMN wompi_reference TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'wompi_transaction_id'
  ) THEN
    ALTER TABLE public.payment_splits ADD COLUMN wompi_transaction_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'wompi_fee'
  ) THEN
    ALTER TABLE public.payment_splits ADD COLUMN wompi_fee NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_splits_wompi_tx
  ON public.payment_splits (wompi_transaction_id)
  WHERE wompi_transaction_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. marketplace_transactions: epayco_session_id → wompi_reference
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Skip si la tabla no existe en este entorno
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'marketplace_transactions'
  ) THEN
    RAISE NOTICE 'marketplace_transactions no existe en este entorno; saltando seccion 5.';
    RETURN;
  END IF;

  -- epayco_session_id → wompi_reference
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketplace_transactions' AND column_name = 'epayco_session_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketplace_transactions' AND column_name = 'wompi_reference'
  ) THEN
    ALTER TABLE public.marketplace_transactions DROP COLUMN epayco_session_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketplace_transactions' AND column_name = 'epayco_session_id'
  ) THEN
    ALTER TABLE public.marketplace_transactions RENAME COLUMN epayco_session_id TO wompi_reference;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketplace_transactions' AND column_name = 'epayco_ref'
  ) THEN
    ALTER TABLE public.marketplace_transactions DROP COLUMN epayco_ref;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketplace_transactions' AND column_name = 'wompi_reference'
  ) THEN
    ALTER TABLE public.marketplace_transactions ADD COLUMN wompi_reference TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketplace_transactions' AND column_name = 'wompi_transaction_id'
  ) THEN
    ALTER TABLE public.marketplace_transactions ADD COLUMN wompi_transaction_id TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_tx_wompi_reference
      ON public.marketplace_transactions (wompi_reference)
      WHERE wompi_reference IS NOT NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. orders: agregar vendor_id, columnas Wompi, campos de envío
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN vendor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'wompi_reference'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN wompi_reference TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'wompi_transaction_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN wompi_transaction_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_cost'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN shipping_cost NUMERIC(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tax_total'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN tax_total NUMERIC(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_document'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_document TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN tracking_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'carrier'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN carrier TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN notes TEXT;
  END IF;

  -- updated_at: estandar, requerido por my_orders_view y confirm_order_payment
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_wompi_reference
  ON public.orders (wompi_reference)
  WHERE wompi_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON public.orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. order_items: agregar vendor_id, variant_id, subtotal, tax_amount
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN vendor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- variant_id solo si product_variants existe (referencia FK)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'variant_id'
  ) AND EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='product_variants'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'variant_id'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN variant_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN subtotal NUMERIC(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'tax_amount'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN tax_amount NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_vendor_id ON public.order_items (vendor_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. shipping_zones (NUEVA TABLA)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    departamento TEXT NOT NULL UNIQUE,
    costo_base NUMERIC(12,2) NOT NULL,
    estimated_days_min INT DEFAULT 1,
    estimated_days_max INT DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.shipping_zones (departamento, costo_base, estimated_days_min, estimated_days_max)
VALUES
    ('Bogota DC', 12000, 1, 2),
    ('Cundinamarca', 15000, 1, 3),
    ('Antioquia', 18000, 2, 4),
    ('Valle del Cauca', 18000, 2, 4),
    ('Atlantico', 22000, 3, 5),
    ('Santander', 22000, 3, 5),
    ('Bolivar', 25000, 3, 6),
    ('Magdalena', 25000, 3, 6),
    ('Choco', 35000, 5, 10),
    ('Amazonas', 45000, 7, 14),
    ('Vaupes', 45000, 7, 14),
    ('Vichada', 45000, 7, 14),
    ('Guainia', 45000, 7, 14),
    ('San Andres', 55000, 5, 10)
ON CONFLICT (departamento) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. inventory_logs (NUEVA TABLA — audit de movimientos de stock)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID,  -- FK opcional a product_variants, se agrega abajo si la tabla existe
    vendor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    delta INT NOT NULL,
    stock_before INT NOT NULL,
    stock_after INT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('order_paid', 'order_cancelled', 'manual_restock', 'manual_adjust', 'returned')),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK opcional: solo si product_variants existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='product_variants')
       AND NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema='public' AND table_name='inventory_logs'
              AND constraint_name='inventory_logs_variant_id_fkey'
       )
    THEN
        ALTER TABLE public.inventory_logs
            ADD CONSTRAINT inventory_logs_variant_id_fkey
            FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON public.inventory_logs (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_vendor_id ON public.inventory_logs (vendor_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON public.inventory_logs (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. product_images (NUEVA TABLA — soporte multi-imagen)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images (product_id, sort_order);

-- Backfill desde products.image_url
INSERT INTO public.product_images (product_id, image_url, is_primary, sort_order)
SELECT id, image_url, true, 0
FROM public.products
WHERE image_url IS NOT NULL AND image_url != ''
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RPC: confirm_order_payment — descuenta stock atómico y actualiza order
-- ─────────────────────────────────────────────────────────────────────────────

-- Usa EXECUTE dinamico para acceder a product_variants si existe,
-- de manera que la funcion se compile aunque la tabla no exista todavia.
CREATE OR REPLACE FUNCTION public.confirm_order_payment(
    p_order_id UUID,
    p_wompi_reference TEXT,
    p_wompi_transaction_id TEXT,
    p_payment_method_type TEXT DEFAULT 'CARD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_stock_before INT;
    v_stock_after INT;
    v_has_variants BOOLEAN := EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='product_variants'
    );
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

    IF v_order.status = 'paid' AND v_order.wompi_transaction_id = p_wompi_transaction_id THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END IF;

    IF v_order.status NOT IN ('pending', 'payment_review') THEN
        RAISE EXCEPTION 'order_not_pending: %', v_order.status;
    END IF;

    FOR v_item IN
        SELECT id, product_id, variant_id, quantity
        FROM public.order_items
        WHERE order_id = p_order_id
        ORDER BY product_id, variant_id NULLS FIRST
    LOOP
        IF v_item.variant_id IS NOT NULL AND v_has_variants THEN
            EXECUTE 'SELECT stock FROM public.product_variants WHERE id = $1 FOR UPDATE'
                INTO v_stock_before USING v_item.variant_id;

            IF v_stock_before IS NULL OR v_stock_before < v_item.quantity THEN
                RAISE EXCEPTION 'insufficient_stock_variant: %', v_item.variant_id;
            END IF;

            v_stock_after := v_stock_before - v_item.quantity;
            EXECUTE 'UPDATE public.product_variants SET stock = $1, updated_at = NOW() WHERE id = $2'
                USING v_stock_after, v_item.variant_id;
        ELSE
            SELECT stock INTO v_stock_before FROM public.products WHERE id = v_item.product_id FOR UPDATE;
            IF v_stock_before IS NULL OR v_stock_before < v_item.quantity THEN
                RAISE EXCEPTION 'insufficient_stock_product: %', v_item.product_id;
            END IF;

            v_stock_after := v_stock_before - v_item.quantity;
            UPDATE public.products SET stock = v_stock_after, updated_at = NOW() WHERE id = v_item.product_id;
        END IF;

        INSERT INTO public.inventory_logs (
            product_id, variant_id, vendor_id, delta, stock_before, stock_after, reason, order_id
        ) VALUES (
            v_item.product_id,
            v_item.variant_id,
            (SELECT vendor_id FROM public.products WHERE id = v_item.product_id),
            -v_item.quantity,
            v_stock_before,
            v_stock_after,
            'order_paid',
            p_order_id
        );
    END LOOP;

    UPDATE public.orders
    SET status = 'paid',
        wompi_reference = p_wompi_reference,
        wompi_transaction_id = p_wompi_transaction_id,
        payment_method = COALESCE(p_payment_method_type, 'wompi'),
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'wompi_reference', p_wompi_reference);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_payment(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Actualizar firma de confirm_marketplace_payment para usar wompi_*
-- ─────────────────────────────────────────────────────────────────────────────

-- Solo crear si la tabla marketplace_transactions existe en este entorno.
-- Usa EXECUTE dinamico para que la funcion compile incluso si las tablas
-- side-effect (wellness_appointments, event_registrations, subscriptions)
-- no existen aun.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
        RAISE NOTICE 'marketplace_transactions no existe; saltando confirm_marketplace_payment.';
        RETURN;
    END IF;

    DROP FUNCTION IF EXISTS public.confirm_marketplace_payment(UUID, TEXT, TEXT);
    DROP FUNCTION IF EXISTS public.confirm_marketplace_payment(UUID, TEXT, TEXT, TEXT);

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.confirm_marketplace_payment(
            p_transaction_id UUID,
            p_wompi_reference TEXT,
            p_wompi_transaction_id TEXT,
            p_payment_method TEXT DEFAULT 'wompi'
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_tx RECORD;
        BEGIN
            SELECT * INTO v_tx FROM public.marketplace_transactions WHERE id = p_transaction_id FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

            IF v_tx.status = 'paid' AND v_tx.wompi_transaction_id = p_wompi_transaction_id THEN
                RETURN jsonb_build_object('ok', true, 'idempotent', true, 'checkout_type', v_tx.checkout_type);
            END IF;

            UPDATE public.marketplace_transactions
            SET status = 'paid',
                wompi_reference = p_wompi_reference,
                wompi_transaction_id = p_wompi_transaction_id,
                payment_method = p_payment_method,
                paid_at = NOW(),
                updated_at = NOW()
            WHERE id = p_transaction_id;

            -- Side effects con EXECUTE dinamico (tablas opcionales)
            IF v_tx.checkout_type = 'service' AND v_tx.appointment_id IS NOT NULL
               AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments')
            THEN
                EXECUTE 'UPDATE public.wellness_appointments SET status = ''confirmed'', payment_status = ''paid'', updated_at = NOW() WHERE id = $1'
                    USING v_tx.appointment_id;
            ELSIF v_tx.checkout_type = 'event' AND v_tx.event_registration_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='event_registrations')
            THEN
                EXECUTE 'UPDATE public.event_registrations SET status = ''confirmed'', payment_status = ''paid'', updated_at = NOW() WHERE id = $1'
                    USING v_tx.event_registration_id;
            ELSIF v_tx.checkout_type = 'subscription' AND v_tx.subscription_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='subscriptions')
            THEN
                EXECUTE 'UPDATE public.subscriptions SET status = ''active'', current_period_paid = true, updated_at = NOW() WHERE id = $1'
                    USING v_tx.subscription_id;
            END IF;

            RETURN jsonb_build_object('ok', true, 'transaction_id', p_transaction_id, 'checkout_type', v_tx.checkout_type);
        END;
        $body$;
    $func$;

    GRANT EXECUTE ON FUNCTION public.confirm_marketplace_payment(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. RLS — orders, order_items
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Cliente: ve sus propias ordenes
DROP POLICY IF EXISTS "orders_owner_read" ON public.orders;
CREATE POLICY "orders_owner_read" ON public.orders
    FOR SELECT
    USING (auth.uid() = user_id);

-- Vendor: ve ordenes que contienen sus productos
DROP POLICY IF EXISTS "orders_vendor_read" ON public.orders;
CREATE POLICY "orders_vendor_read" ON public.orders
    FOR SELECT
    USING (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1 FROM public.order_items oi
            WHERE oi.order_id = orders.id AND oi.vendor_id = auth.uid()
        )
    );

-- Vendor: puede actualizar status (envío, tracking) en sus ordenes
DROP POLICY IF EXISTS "orders_vendor_update" ON public.orders;
CREATE POLICY "orders_vendor_update" ON public.orders
    FOR UPDATE
    USING (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1 FROM public.order_items oi
            WHERE oi.order_id = orders.id AND oi.vendor_id = auth.uid()
        )
    );

-- INSERT en orders/order_items SOLO via BFF (service_role). RLS bloquea al cliente
-- para evitar manipulacion de vendor_id, precios o subtotales desde supabase-js.
DROP POLICY IF EXISTS "orders_owner_insert" ON public.orders;

-- Items: lectura para cliente y vendor de los items
DROP POLICY IF EXISTS "order_items_read" ON public.order_items;
CREATE POLICY "order_items_read" ON public.order_items
    FOR SELECT
    USING (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "order_items_owner_insert" ON public.order_items;

-- Admin bypass
DROP POLICY IF EXISTS "orders_admin_all" ON public.orders;
CREATE POLICY "orders_admin_all" ON public.orders
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

DROP POLICY IF EXISTS "order_items_admin_all" ON public.order_items;
CREATE POLICY "order_items_admin_all" ON public.order_items
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. RLS — product_variants (solo si la tabla existe)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='product_variants') THEN
        RAISE NOTICE 'product_variants no existe; saltando RLS de product_variants.';
        RETURN;
    END IF;

    EXECUTE 'ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "product_variants_public_read" ON public.product_variants';
    EXECUTE 'CREATE POLICY "product_variants_public_read" ON public.product_variants FOR SELECT USING (is_active = true)';
    EXECUTE 'DROP POLICY IF EXISTS "product_variants_vendor_all" ON public.product_variants';
    EXECUTE 'CREATE POLICY "product_variants_vendor_all" ON public.product_variants FOR ALL USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.vendor_id = auth.uid()))';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. RLS — shipping_zones
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

-- Publico: lectura para calcular envio en checkout
DROP POLICY IF EXISTS "shipping_zones_public_read" ON public.shipping_zones;
CREATE POLICY "shipping_zones_public_read" ON public.shipping_zones
    FOR SELECT
    USING (is_active = true);

-- Admin: CRUD
DROP POLICY IF EXISTS "shipping_zones_admin_all" ON public.shipping_zones;
CREATE POLICY "shipping_zones_admin_all" ON public.shipping_zones
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. RLS — inventory_logs
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- Vendor: lectura solo de sus productos
DROP POLICY IF EXISTS "inventory_logs_vendor_read" ON public.inventory_logs;
CREATE POLICY "inventory_logs_vendor_read" ON public.inventory_logs
    FOR SELECT
    USING (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = inventory_logs.product_id AND p.vendor_id = auth.uid()
        )
    );

-- Admin: full access
DROP POLICY IF EXISTS "inventory_logs_admin_all" ON public.inventory_logs;
CREATE POLICY "inventory_logs_admin_all" ON public.inventory_logs
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. RLS — product_images
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_images_public_read" ON public.product_images;
CREATE POLICY "product_images_public_read" ON public.product_images
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "product_images_vendor_all" ON public.product_images;
CREATE POLICY "product_images_vendor_all" ON public.product_images
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_images.product_id AND p.vendor_id = auth.uid()
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. Vista: my_orders (cliente ve historial)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.my_orders_view AS
SELECT
    o.id,
    o.user_id,
    o.vendor_id,
    o.total_amount,
    o.tax_total,
    o.shipping_cost,
    o.status,
    o.payment_method,
    o.wompi_reference,
    o.tracking_number,
    o.carrier,
    o.shipping_address,
    o.contact_phone,
    o.contact_email,
    o.customer_name,
    o.notes,
    o.paid_at,
    o.created_at,
    o.updated_at,
    (
        SELECT jsonb_agg(jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'variant_id', oi.variant_id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'subtotal', oi.subtotal,
            'product_name', p.name,
            'product_image', p.image_url
        ))
        FROM public.order_items oi
        LEFT JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
    ) AS items
FROM public.orders o
WHERE o.user_id = auth.uid()
   OR o.vendor_id = auth.uid()
   OR EXISTS (
       SELECT 1 FROM public.order_items oi
       WHERE oi.order_id = o.id AND oi.vendor_id = auth.uid()
   )
   OR EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
   );

GRANT SELECT ON public.my_orders_view TO authenticated;

COMMIT;
