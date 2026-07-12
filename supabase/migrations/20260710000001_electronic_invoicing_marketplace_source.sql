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
-- TOLERANTE: `marketplace_transactions` puede NO existir en un ambiente donde
-- el marketplace aún no se desplegó (mig 20260417000003 no aplicada). Por eso:
--   - la columna se agrega SIEMPRE (sin FK) → el BFF funciona;
--   - FK + políticas RLS que dependen de esa tabla se crean SOLO si existe
--     (guardadas con to_regclass). Al desplegar el marketplace, re-ejecutar
--     este archivo activa el cableado que faltaba (todo es idempotente).
--
-- Reusa el mismo adaptador/PAC y el modelo multi-owner de la Fase 1.
-- ============================================================

-- Columna de enlace (sin FK: no depende de que exista la tabla).
ALTER TABLE public.electronic_invoices
    ADD COLUMN IF NOT EXISTS marketplace_transaction_id uuid;

COMMENT ON COLUMN public.electronic_invoices.marketplace_transaction_id IS
    'Origen de emisión marketplace (tiendas/servicios/eventos). XOR conceptual con payment_id.';

CREATE INDEX IF NOT EXISTS ix_einvoices_mtx
    ON public.electronic_invoices (marketplace_transaction_id);
-- Una sola factura viva por transacción de marketplace.
CREATE UNIQUE INDEX IF NOT EXISTS uq_einvoices_mtx
    ON public.electronic_invoices (marketplace_transaction_id)
    WHERE marketplace_transaction_id IS NOT NULL;

-- Todo lo que referencia marketplace_transactions: solo si la tabla existe.
DO $mkt$
BEGIN
    IF to_regclass('public.marketplace_transactions') IS NULL THEN
        RAISE NOTICE '[einvoicing mtx] marketplace_transactions no existe; se omite FK+RLS de marketplace (se activan al desplegar el marketplace).';
        RETURN;
    END IF;

    -- FK (idempotente por nombre de constraint).
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'electronic_invoices_mtx_fkey'
    ) THEN
        ALTER TABLE public.electronic_invoices
            ADD CONSTRAINT electronic_invoices_mtx_fkey
            FOREIGN KEY (marketplace_transaction_id)
            REFERENCES public.marketplace_transactions(id) ON DELETE SET NULL;
    END IF;

    -- RLS: el COMPRADOR de una transacción de marketplace ve su factura.
    DROP POLICY IF EXISTS einvoices_mtx_payer_read ON public.electronic_invoices;
    CREATE POLICY einvoices_mtx_payer_read ON public.electronic_invoices
        FOR SELECT TO authenticated
        USING (EXISTS (
            SELECT 1 FROM public.marketplace_transactions mt
            WHERE mt.id = electronic_invoices.marketplace_transaction_id
              AND mt.user_id = auth.uid()
        ));

    -- items: lectura para dueño, pagador de payments, o comprador de marketplace.
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
END
$mkt$;
