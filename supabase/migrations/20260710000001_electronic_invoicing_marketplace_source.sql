-- ============================================================
-- SPORTMAPS — Facturación electrónica · Origen de emisión #2: MARKETPLACE
--
-- Las ventas de tiendas (escolar y externa), servicios, eventos y suscripciones
-- del marketplace NO viven en `payments` (flujo escuela) sino en
-- `marketplace_transactions`. Para poder facturarlas, electronic_invoices gana
-- un enlace opcional a esa tabla, análogo a payment_id.
--
--   emisor (owner): vendor_profile_id → owner_type='vendor'
--                   producto con school_id (tienda escolar) → owner_type='school'
--   comprador:      marketplace_transactions.user_id
--
-- Reusa el mismo adaptador/PAC y todo el modelo multi-owner de la Fase 1.
-- ============================================================

ALTER TABLE public.electronic_invoices
    ADD COLUMN IF NOT EXISTS marketplace_transaction_id uuid
        REFERENCES public.marketplace_transactions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.electronic_invoices.marketplace_transaction_id IS
    'Origen de emisión marketplace (tiendas/servicios/eventos). XOR conceptual con payment_id.';

CREATE INDEX IF NOT EXISTS ix_einvoices_mtx
    ON public.electronic_invoices (marketplace_transaction_id);
-- Una sola factura viva por transacción de marketplace.
CREATE UNIQUE INDEX IF NOT EXISTS uq_einvoices_mtx
    ON public.electronic_invoices (marketplace_transaction_id)
    WHERE marketplace_transaction_id IS NOT NULL;

-- RLS: el COMPRADOR de una transacción de marketplace puede ver su factura.
-- Se consulta marketplace_transactions (no electronic_invoices) → sin recursión.
DROP POLICY IF EXISTS einvoices_mtx_payer_read ON public.electronic_invoices;
CREATE POLICY einvoices_mtx_payer_read ON public.electronic_invoices
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.marketplace_transactions mt
        WHERE mt.id = electronic_invoices.marketplace_transaction_id
          AND mt.user_id = auth.uid()
    ));

-- items: extiende la lectura al comprador de marketplace (además de dueño y
-- pagador de payments). Se consulta invoices/mtx, no la propia tabla.
DROP POLICY IF EXISTS einvoice_items_read ON public.electronic_invoice_items;
CREATE POLICY einvoice_items_read ON public.electronic_invoice_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.electronic_invoices i
        WHERE i.id = electronic_invoice_items.invoice_id
          AND (
              public.can_manage_finances(i.owner_type, i.owner_id)
              OR EXISTS (
                  SELECT 1 FROM public.payments p
                  WHERE p.id = i.payment_id AND p.parent_id = auth.uid()
              )
              OR EXISTS (
                  SELECT 1 FROM public.marketplace_transactions mt
                  WHERE mt.id = i.marketplace_transaction_id AND mt.user_id = auth.uid()
              )
          )
    ));
