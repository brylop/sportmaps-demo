-- ============================================================
-- SPORTMAPS — Facturación electrónica · Origen de emisión #3: ÓRDENES (tienda)
--
-- Las ventas de productos de tienda (escolar y externa) viven en `orders`/
-- `order_items` (NO en payments ni marketplace_transactions). Para facturarlas,
-- electronic_invoices gana un enlace opcional a `orders`.
--
--   emisor (owner): producto con school_id → owner_type='school' (tienda escolar)
--                   producto con vendor_profile_id → owner_type='vendor' (externa)
--   comprador:      orders.user_id
--
-- TOLERANTE (guardado con to_regclass) por consistencia, aunque `orders` es
-- tabla core y normalmente existe. Aditivo e idempotente.
-- ============================================================

ALTER TABLE public.electronic_invoices
    ADD COLUMN IF NOT EXISTS order_id uuid;

COMMENT ON COLUMN public.electronic_invoices.order_id IS
    'Origen de emisión tienda (venta de productos vía orders). XOR conceptual con payment_id / marketplace_transaction_id.';

CREATE INDEX IF NOT EXISTS ix_einvoices_order
    ON public.electronic_invoices (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_einvoices_order
    ON public.electronic_invoices (order_id)
    WHERE order_id IS NOT NULL;

DO $ord$
BEGIN
    IF to_regclass('public.orders') IS NULL THEN
        RAISE NOTICE '[einvoicing order] public.orders no existe; se omite FK+RLS de órdenes.';
        RETURN;
    END IF;

    -- FK (idempotente por nombre).
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'electronic_invoices_order_fkey'
    ) THEN
        ALTER TABLE public.electronic_invoices
            ADD CONSTRAINT electronic_invoices_order_fkey
            FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
    END IF;

    -- RLS (política permisiva adicional; se combina con OR con las existentes):
    -- el COMPRADOR de la orden ve la factura de su compra.
    DROP POLICY IF EXISTS einvoices_order_buyer_read ON public.electronic_invoices;
    CREATE POLICY einvoices_order_buyer_read ON public.electronic_invoices
        FOR SELECT TO authenticated
        USING (EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = electronic_invoices.order_id
              AND o.user_id = auth.uid()
        ));

    -- items: política permisiva adicional para el comprador de la orden.
    DROP POLICY IF EXISTS einvoice_items_order_buyer ON public.electronic_invoice_items;
    CREATE POLICY einvoice_items_order_buyer ON public.electronic_invoice_items
        FOR SELECT TO authenticated
        USING (EXISTS (
            SELECT 1 FROM public.electronic_invoices i
            JOIN public.orders o ON o.id = i.order_id
            WHERE i.id = electronic_invoice_items.invoice_id
              AND o.user_id = auth.uid()
        ));
END
$ord$;
