-- =============================================================================
-- 20261003230016_tienda_v2_factura_y_eventos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003230013
-- Objetivo: M-F0-8 de docs/specs/tienda-v2-f0-plan-migraciones.md, ajustada al
--   contrato de contabilidad (docs/specs/contabilidad-v2-f0-plan-migraciones.md
--   §6): la tienda NO agrega ramas a cash_ledger ni escribe tablas contables;
--   su única salida contable son eventos idempotentes a accounting_outbox
--   (20261003202429), emitidos en la MISMA transacción que cambia el estado.
--
--   1. Guard de emisión (T20): una factura (document_type='invoice') con
--      order_id exige orden en estado cobrado (paid…delivered) CON prueba de
--      pago (transacción de pasarela, o transferencia/efectivo aprobados por
--      alguien) y emisor = dueño de la venta (escuela por su tienda; externo
--      por sí mismo; nunca la escuela por un externo).
--   2. order_invoice_payload(order): líneas con IVA incluido (§6.3) + línea de
--      ENVÍO aparte (excluida de IVA, D-11 provisional). La usa el BFF
--      (invoicing.service emitInvoiceForOrder).
--   3. orders_pending_invoice(): candidatas del cron autoEmitPendingOrders
--      (tienda prendida + estado cobrado + prueba de pago).
--   4. _store_emit_order_events (reemplaza el STUB de 230007): al pagarse una
--      orden emite commerce_sale (+ commerce_commission y commerce_gateway_fee
--      si son > 0). Un evento por vendedor y por momento (D-2 → uno por orden).
--   5. Reembolso completado de una orden → commerce_refund (proporcional) y,
--      si es total, reverso de settlements (trigger sobre refunds; no toca
--      complete_refund, cuya rama payment_id sigue idéntica).
--
--   DECISIONES PROVISIONALES (2026-10-03):
--   · source_kind de venta/comisión/fee = 'order' (uno por vendedor; el
--     contrato listaba 'order_item'/'settlement', pero pide "un evento por
--     vendedor" y el envío no pertenece a ningún ítem). idempotency_key =
--     '<event_kind>:<order_id>'; reembolso '<commerce_refund>:<refund_id>'.
--   · settlement_mode = 'direct' (D-5 = A: el vendedor cobró).
--   · D-1 IVA incluido; D-11 envío excluido de IVA.
--   · Reembolso parcial: evento proporcional, settlements sin reversar.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

DO $pre$
BEGIN
    IF to_regprocedure('public.accounting_emit_event(text,uuid,text,text,uuid,jsonb,text)') IS NULL THEN
        RAISE EXCEPTION 'Falta la bandeja contable (20261003202429): aplicarla antes.';
    END IF;
    IF to_regclass('public.store_payment_settings') IS NULL
       OR to_regprocedure('public._store_reverse_settlements(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Faltan 20261003230011 / 20261003230013: aplicarlas antes.';
    END IF;
END
$pre$;

-- ─── Helpers ─────────────────────────────────────────────────────────────────
-- ¿La orden está cobrada y con prueba? (lo mismo que exige trg_orders_paid_requires_proof)
CREATE OR REPLACE FUNCTION public._store_order_has_payment_proof(p_order public.orders)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT p_order.status IN ('paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered')
       AND p_order.paid_at IS NOT NULL
       AND (p_order.provider_transaction_id IS NOT NULL
            OR p_order.wompi_transaction_id IS NOT NULL
            OR (p_order.payment_method IN ('transfer', 'cash_pickup') AND p_order.approved_by IS NOT NULL));
$fn$;

-- Dueño de la venta: (school, school_id) para tienda escolar; (vendor, vp.id) si no.
CREATE OR REPLACE FUNCTION public._store_order_owner(p_order_id uuid)
RETURNS TABLE (owner_type text, owner_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT COALESCE(oi.owner_type,
                    CASE WHEN vp.vendor_type::text = 'school' AND vp.school_id IS NOT NULL THEN 'school' ELSE 'vendor' END),
           COALESCE(oi.owner_id,
                    CASE WHEN vp.vendor_type::text = 'school' AND vp.school_id IS NOT NULL THEN vp.school_id ELSE vp.id END)
      FROM public.orders o
      LEFT JOIN public.vendor_profiles vp ON vp.id = o.vendor_profile_id
      LEFT JOIN LATERAL (SELECT x.owner_type, x.owner_id FROM public.order_items x
                          WHERE x.order_id = o.id AND x.owner_type IS NOT NULL LIMIT 1) oi ON true
     WHERE o.id = p_order_id AND (oi.owner_type IS NOT NULL OR vp.id IS NOT NULL);
$fn$;

-- ─── 1. Guard de emisión de factura de órdenes ───────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_invoice_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o     public.orders%ROWTYPE;
    v_owner record;
BEGIN
    IF NEW.order_id IS NULL OR NEW.document_type <> 'invoice' THEN
        RETURN NEW;
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = NEW.order_id FOR SHARE;
    IF v_o.id IS NULL OR NOT public._store_order_has_payment_proof(v_o) THEN
        RAISE EXCEPTION 'INVOICE_ORDER_NOT_PAID: %', COALESCE(v_o.status, 'inexistente')
            USING ERRCODE = '55000',
                  HINT = 'Solo se factura una orden cobrada con prueba de pago (pasarela o aprobación del vendedor).';
    END IF;
    SELECT * INTO v_owner FROM public._store_order_owner(NEW.order_id);
    IF v_owner.owner_type IS NULL
       OR NEW.owner_type IS DISTINCT FROM v_owner.owner_type
       OR NEW.owner_id IS DISTINCT FROM v_owner.owner_id THEN
        RAISE EXCEPTION 'INVOICE_ORDER_WRONG_OWNER' USING ERRCODE = '55000',
              HINT = 'El emisor es el dueño de la venta (escuela por su tienda, externo por sí mismo).';
    END IF;
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_factura_orden_pagada ON public.electronic_invoices;
CREATE TRIGGER trg_guard_factura_orden_pagada
    BEFORE INSERT ON public.electronic_invoices
    FOR EACH ROW
    WHEN (NEW.order_id IS NOT NULL)
    EXECUTE FUNCTION public.guard_invoice_order_paid();

-- ─── 2. Payload de factura (IVA incluido + envío) ────────────────────────────
CREATE OR REPLACE FUNCTION public.order_invoice_payload(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o     public.orders%ROWTYPE;
    v_owner record;
    v_lines jsonb;
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    IF v_o.id IS NULL THEN
        RETURN jsonb_build_object('invoiceable', false, 'reason', 'order_not_found');
    END IF;
    IF NOT public._store_order_has_payment_proof(v_o) THEN
        RETURN jsonb_build_object('invoiceable', false, 'reason', 'order_not_paid', 'status', v_o.status);
    END IF;
    IF v_o.user_id IS NULL THEN
        RETURN jsonb_build_object('invoiceable', false, 'reason', 'order_without_buyer');
    END IF;
    SELECT * INTO v_owner FROM public._store_order_owner(p_order_id);
    IF v_owner.owner_type IS NULL THEN
        RETURN jsonb_build_object('invoiceable', false, 'reason', 'cannot_resolve_owner');
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'code', 'ORD-' || left(v_o.id::text, 8) || '-' || rn,
               'name', name,
               'quantity', quantity,
               'unit_price', unit_price,                 -- IVA incluido
               'tax_rate_pct', round(tax_rate * 100, 2),
               'is_excluded', tax_rate = 0,
               'line_total', line_total,
               'line_base', line_base,
               'line_tax', line_tax) ORDER BY rn), '[]'::jsonb)
      INTO v_lines
      FROM (SELECT row_number() OVER (ORDER BY oi.created_at, oi.id) AS rn,
                   p.name || COALESCE(' · ' || v.name, '') AS name,
                   oi.quantity, oi.unit_price,
                   COALESCE(oi.tax_rate, public._store_norm_tax_rate(p.tax_rate)) AS tax_rate,
                   COALESCE(oi.line_total, round(oi.unit_price * oi.quantity)) AS line_total,
                   oi.line_base, COALESCE(oi.tax_amount, 0) AS line_tax
              FROM public.order_items oi
              JOIN public.products p ON p.id = oi.product_id
              LEFT JOIN public.product_variants v ON v.id = oi.variant_id
             WHERE oi.order_id = p_order_id) x;

    IF COALESCE(v_o.shipping_cost, 0) > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'code', 'ORD-' || left(v_o.id::text, 8) || '-ENVIO',
            'name', 'Envío', 'quantity', 1, 'unit_price', v_o.shipping_cost,
            'tax_rate_pct', 0, 'is_excluded', true,                    -- D-11 provisional
            'line_total', v_o.shipping_cost, 'line_base', v_o.shipping_cost, 'line_tax', 0,
            'is_shipping', true);
    END IF;

    RETURN jsonb_build_object(
        'invoiceable', true,
        'order_id', v_o.id,
        'reference', v_o.reference,
        'owner_type', v_owner.owner_type,
        'owner_id', v_owner.owner_id,
        'buyer_id', v_o.user_id,
        'payment_method', v_o.payment_method,
        'total', v_o.total_amount,
        'lines', v_lines);
END;
$fn$;

-- Candidatas al cron de facturación: tienda prendida + cobradas con prueba.
CREATE OR REPLACE FUNCTION public.orders_pending_invoice(p_since timestamptz, p_limit integer DEFAULT 100)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT o.id
      FROM public.orders o
     WHERE public.store_enabled()
       AND o.paid_at >= p_since
       AND public._store_order_has_payment_proof(o)
       AND NOT EXISTS (SELECT 1 FROM public.electronic_invoices ei
                        WHERE ei.order_id = o.id AND ei.document_type = 'invoice'
                          AND ei.status IN ('queued', 'sent', 'accepted') AND ei.voided_at IS NULL)
     ORDER BY o.paid_at DESC
     LIMIT GREATEST(LEAST(COALESCE(p_limit, 100), 500), 1);
$fn$;

-- ─── 3. Eventos contables de la orden ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._store_order_event_payload(p_order_id uuid, p_ratio numeric, p_effective timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o      public.orders%ROWTYPE;
    v_base   numeric;
    v_vat    numeric;
    v_lines  numeric;
    v_comm   numeric;
    v_gwfee  numeric;
    v_rates  numeric[];
    v_crate  numeric;
    v_ship   numeric;
    v_gross  numeric;
    v_est    boolean;
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    SELECT COALESCE(sum(COALESCE(oi.line_base, oi.line_total - COALESCE(oi.tax_amount, 0))), 0),
           COALESCE(sum(COALESCE(oi.tax_amount, 0)), 0),
           COALESCE(sum(COALESCE(oi.line_total, round(oi.unit_price * oi.quantity))), 0),
           array_agg(DISTINCT oi.tax_rate),
           max(oi.commission_rate)
      INTO v_base, v_vat, v_lines, v_rates, v_crate
      FROM public.order_items oi WHERE oi.order_id = p_order_id;
    SELECT COALESCE(sum(s.platform_fee), 0), COALESCE(sum(s.gateway_fee), 0), COALESCE(bool_or(s.gateway_fee_estimated), false)
      INTO v_comm, v_gwfee, v_est
      FROM public.settlements s WHERE s.order_id = p_order_id AND s.status <> 'reversed';

    v_ship := COALESCE(v_o.shipping_cost, 0);
    IF p_ratio < 1 THEN
        v_base  := round(v_base * p_ratio);
        v_vat   := round(v_vat * p_ratio);
        v_ship  := round(v_ship * p_ratio);
        v_comm  := round(v_comm * p_ratio);
        v_gwfee := round(v_gwfee * p_ratio);
    END IF;
    v_gross := v_base + v_vat + v_ship;   -- cuadra por construcción (contrato §6.2)

    RETURN jsonb_build_object(
        'order_id', v_o.id,
        'reference', v_o.reference,
        'gross', v_gross,
        'base', v_base,
        'vat', v_vat,
        'vat_rate', CASE WHEN array_length(v_rates, 1) = 1 THEN v_rates[1] END,
        'shipping', v_ship,
        'commission', v_comm,
        'commission_rate', v_crate,
        'gateway_fee', v_gwfee,
        'gateway_fee_estimated', v_est,
        'net', v_gross - v_comm - v_gwfee,
        'currency', 'COP',
        'settlement_mode', 'direct',                 -- D-5 = A: el vendedor cobró
        'payout_batch_id', NULL,
        'payment_method', v_o.payment_method,
        'buyer_party', jsonb_build_object('type', 'profile', 'id', v_o.user_id),
        'electronic_invoice_id', NULL,
        'ratio', p_ratio,
        'effective_date', to_char((p_effective AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD'));
END;
$fn$;

CREATE OR REPLACE FUNCTION public._store_emit_order_events(p_order_id uuid, p_kind text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o       public.orders%ROWTYPE;
    v_owner   record;
    v_payload jsonb;
    v_n       integer := 0;
BEGIN
    IF p_kind <> 'sale' THEN
        RAISE EXCEPTION 'INVALID_EVENT_KIND' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    IF v_o.id IS NULL OR v_o.paid_at IS NULL THEN
        RETURN 0;
    END IF;
    SELECT * INTO v_owner FROM public._store_order_owner(p_order_id);
    IF v_owner.owner_type IS NULL THEN
        RETURN 0;   -- orden legacy sin tienda: nada que postear
    END IF;

    v_payload := public._store_order_event_payload(p_order_id, 1, v_o.paid_at);

    PERFORM public.accounting_emit_event('order', p_order_id, 'commerce_sale',
                                         v_owner.owner_type, v_owner.owner_id, v_payload,
                                         'commerce_sale:' || p_order_id);
    v_n := 1;
    IF (v_payload ->> 'commission')::numeric > 0 THEN
        PERFORM public.accounting_emit_event('order', p_order_id, 'commerce_commission',
                                             v_owner.owner_type, v_owner.owner_id, v_payload,
                                             'commerce_commission:' || p_order_id);
        v_n := v_n + 1;
    END IF;
    IF (v_payload ->> 'gateway_fee')::numeric > 0 THEN
        PERFORM public.accounting_emit_event('order', p_order_id, 'commerce_gateway_fee',
                                             v_owner.owner_type, v_owner.owner_id, v_payload,
                                             'commerce_gateway_fee:' || p_order_id);
        v_n := v_n + 1;
    END IF;
    RETURN v_n;
END;
$fn$;

-- ─── 4. Reembolso de orden completado → reverso + evento ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_store_refund_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o       public.orders%ROWTYPE;
    v_owner   record;
    v_ratio   numeric;
    v_payload jsonb;
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = NEW.order_id;
    IF v_o.id IS NULL OR v_o.total_amount IS NULL OR v_o.total_amount <= 0 THEN
        RETURN NULL;
    END IF;
    v_ratio := LEAST(COALESCE(NEW.refund_amount, 0) / v_o.total_amount, 1);

    -- El payload se arma ANTES de reversar (lleva la comisión original, prorrateada).
    SELECT * INTO v_owner FROM public._store_order_owner(NEW.order_id);
    IF v_owner.owner_type IS NOT NULL AND v_o.paid_at IS NOT NULL THEN
        v_payload := public._store_order_event_payload(NEW.order_id, v_ratio,
                                                       COALESCE(NEW.processed_at, now()))
                  || jsonb_build_object('refund_id', NEW.id, 'refund_amount', NEW.refund_amount);
        PERFORM public.accounting_emit_event('refund', NEW.id, 'commerce_refund',
                                             v_owner.owner_type, v_owner.owner_id, v_payload,
                                             'commerce_refund:' || NEW.id);
    END IF;

    IF v_ratio >= 1 THEN
        PERFORM public._store_reverse_settlements(NEW.order_id);
    END IF;
    RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_store_refund_completed ON public.refunds;
CREATE TRIGGER trg_store_refund_completed
    AFTER UPDATE OF status ON public.refunds
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.order_id IS NOT NULL)
    EXECUTE FUNCTION public.fn_store_refund_completed();

-- ─── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public._store_order_has_payment_proof(public.orders)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_order_owner(uuid)                             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_invoice_order_paid()                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_invoice_payload(uuid)                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orders_pending_invoice(timestamptz, integer)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_order_event_payload(uuid, numeric, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_emit_order_events(uuid, text)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_store_refund_completed()                          FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.order_invoice_payload(uuid)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.orders_pending_invoice(timestamptz, integer) TO service_role;

COMMIT;
