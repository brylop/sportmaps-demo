-- =============================================================================
-- 20261003202426_factura_electronica_guard_pago.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202424
-- Objetivo: Contabilidad v2 · F0 · M5. Guard DIAN en la base (H6 / T-07):
--   (a) un cobro 'paid' con factura electrónica VIVA (queued/sent/accepted, sin
--       anular) no sale de 'paid' sin nota crédito antes → 55000 PAYMENT_INVOICED.
--       Lo hace cualquier camino: PostgREST, RPC, BFF con service_role, SQL.
--   (b) no se crea una factura (document_type='invoice') de un cobro que no esté
--       'paid' → 55000 INVOICE_PAYMENT_NOT_PAID (cinturón además del BFF,
--       invoicing.service.ts:380). FOR SHARE serializa con (a).
--   U5: válvula de escape `sportmaps.allow_unpay_invoiced = 'on'`, que SOLO se
--       enciende con SET LOCAL dentro de admin_unpay_invoiced_payment(): RPC de
--       admin de plataforma que exige motivo (≥ 10 caracteres) y deja rastro en
--       audit_logs. El cliente no puede fijar GUCs por PostgREST.
-- Plan: docs/specs/contabilidad-v2-f0-plan-migraciones.md §2 M5 (U5 = sí, U6:
--   3490fed0 se re-aprueba; el guard no mira la entrada a 'paid').
-- Rollback: DROP TRIGGER ×2 (+ DROP FUNCTION de la RPC de escape).
-- =============================================================================

BEGIN;

-- ─── (a) no se sale de 'paid' con factura viva ───────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_payment_invoiced()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF OLD.status = 'paid' AND NEW.status IS DISTINCT FROM 'paid'
     AND current_setting('sportmaps.allow_unpay_invoiced', true) IS DISTINCT FROM 'on'
     AND EXISTS (SELECT 1 FROM public.electronic_invoices ei
                  WHERE ei.payment_id = OLD.id
                    AND ei.document_type = 'invoice'
                    AND ei.status IN ('queued','sent','accepted')
                    AND ei.voided_at IS NULL)
  THEN
    RAISE EXCEPTION 'PAYMENT_INVOICED: el pago tiene factura electrónica vigente; emite la nota crédito antes de anularlo'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_zy_guard_pago_facturado ON public.payments;
CREATE TRIGGER trg_zy_guard_pago_facturado
  BEFORE UPDATE OF status ON public.payments
  FOR EACH ROW
  WHEN (OLD.status = 'paid' AND NEW.status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION public.guard_payment_invoiced();

-- ─── (b) no se factura un pago que no esté 'paid' ───────────────────────────
CREATE OR REPLACE FUNCTION public.guard_invoice_requires_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_status text;
BEGIN
  IF NEW.payment_id IS NOT NULL AND NEW.document_type = 'invoice' THEN
    SELECT p.status INTO v_status FROM public.payments p WHERE p.id = NEW.payment_id FOR SHARE;
    IF v_status IS DISTINCT FROM 'paid' THEN
      RAISE EXCEPTION 'INVOICE_PAYMENT_NOT_PAID: %', COALESCE(v_status, 'inexistente')
        USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_factura_pago_pagado ON public.electronic_invoices;
CREATE TRIGGER trg_guard_factura_pago_pagado
  BEFORE INSERT ON public.electronic_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_invoice_requires_paid();

REVOKE ALL ON FUNCTION public.guard_payment_invoiced()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_invoice_requires_paid() FROM PUBLIC, anon, authenticated;

-- ─── U5: escape auditado para soporte ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unpay_invoiced_payment(p_payment_id uuid, p_new_status text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_old public.payments;
  v_new public.payments;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: solo un admin de plataforma' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'REASON_REQUIRED: el motivo debe tener al menos 10 caracteres' USING ERRCODE = '22023';
  END IF;
  IF p_new_status IS NULL OR p_new_status = 'paid' THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', p_new_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_not_found');
  END IF;
  IF v_old.status IS DISTINCT FROM 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_not_paid', 'status', v_old.status);
  END IF;

  PERFORM set_config('sportmaps.allow_unpay_invoiced', 'on', true);
  UPDATE public.payments SET status = p_new_status WHERE id = p_payment_id
  RETURNING * INTO v_new;
  PERFORM set_config('sportmaps.allow_unpay_invoiced', 'off', true);

  INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)
  VALUES (v_old.school_id,
          (SELECT p.id FROM public.profiles p WHERE p.id = auth.uid()),
          'payments', p_payment_id::text, 'UNPAY_INVOICED',
          jsonb_build_object('status', v_old.status),
          jsonb_build_object('status', v_new.status, 'reason', btrim(p_reason)));

  RETURN jsonb_build_object('ok', true, 'payment_id', p_payment_id, 'status', v_new.status);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_unpay_invoiced_payment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unpay_invoiced_payment(uuid, text, text) TO authenticated;

COMMIT;
