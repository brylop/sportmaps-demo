-- =============================================================================
-- 20261003202429_contabilidad_bandeja_eventos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202426
-- Objetivo: Contabilidad v2 · F0 · M6 (U9 = sí). Adelanta de F1 SOLO la bandeja
--   de eventos contables (accounting_outbox) y su función de emisión, para que
--   la tienda v2 emita desde su F0 sin una segunda pasada.
--   DECISIÓN (plan §6.1): la tienda NO agrega ramas a cash_ledger ni escribe en
--   tablas contables. Su única salida contable es accounting_emit_event(),
--   llamada dentro de la misma transacción de la RPC SECURITY DEFINER que cambia
--   el estado (pago confirmado, liquidación, payout, reembolso, contracargo).
--   El procesador process_accounting_outbox() y su job siguen en F1.
-- Contrato: docs/specs/contabilidad-v2-f0-plan-migraciones.md §6.2.
--   · idempotency_key = '<event_kind>:<source_id>[:<seq>]' (los reintentos del
--     webhook reusan la clave).
--   · Misma clave + mismo evento → devuelve el id existente (no duplica).
--   · Misma clave + OTRO evento/payload → excepción (es un bug del emisor).
--   · No valida negocio (montos que no cuadran los marca 'failed' el procesador).
-- Rollback: DROP FUNCTION + DROP TABLE (si no tiene filas).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.accounting_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind     text NOT NULL CHECK (source_kind IN ('payment','order','order_item','settlement','payout',
                                                       'refund','reservation_payment','delegation_payment')),
  source_id       uuid NOT NULL,
  event_kind      text NOT NULL CHECK (event_kind IN ('payment_income','payment_reversal','commerce_sale',
                                                      'commerce_commission','commerce_gateway_fee','commerce_payout',
                                                      'commerce_refund','commerce_chargeback','reservation_payment',
                                                      'delegation_payment')),
  owner_type      text NOT NULL CHECK (owner_type IN ('school','vendor','organizer')),
  owner_id        uuid NOT NULL,
  payload         jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  idempotency_key text NOT NULL UNIQUE CHECK (length(btrim(idempotency_key)) > 0),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','failed','skipped')),
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  posted_at       timestamptz
);

COMMENT ON TABLE public.accounting_outbox IS
  'Bandeja de eventos contables (Contabilidad v2 §3.4/§6). Solo se escribe con accounting_emit_event() desde RPC DEFINER o service_role. El procesador (F1) postea al mayor.';

-- Para el procesador de F1 (FOR UPDATE SKIP LOCKED sobre pendientes) y para
-- consultar por dueño / por origen.
CREATE INDEX IF NOT EXISTS idx_accounting_outbox_pending
  ON public.accounting_outbox (created_at) WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS idx_accounting_outbox_owner
  ON public.accounting_outbox (owner_type, owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_outbox_source
  ON public.accounting_outbox (source_kind, source_id);

-- Sin policies: nadie la lee ni la escribe por PostgREST.
ALTER TABLE public.accounting_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accounting_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounting_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.accounting_emit_event(
    p_source_kind text, p_source_id uuid, p_event_kind text,
    p_owner_type text, p_owner_id uuid, p_payload jsonb, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_id  uuid;
  v_old public.accounting_outbox;
BEGIN
  INSERT INTO public.accounting_outbox (source_kind, source_id, event_kind, owner_type, owner_id,
                                        payload, idempotency_key)
  VALUES (p_source_kind, p_source_id, p_event_kind, p_owner_type, p_owner_id,
          p_payload, p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- La clave ya existía: si es el MISMO evento, idempotente; si no, es un bug.
  SELECT * INTO v_old FROM public.accounting_outbox WHERE idempotency_key = p_idempotency_key;
  IF v_old.source_kind IS DISTINCT FROM p_source_kind
     OR v_old.source_id IS DISTINCT FROM p_source_id
     OR v_old.event_kind IS DISTINCT FROM p_event_kind
     OR v_old.owner_type IS DISTINCT FROM p_owner_type
     OR v_old.owner_id IS DISTINCT FROM p_owner_id
     OR v_old.payload IS DISTINCT FROM p_payload THEN
    RAISE EXCEPTION 'ACCOUNTING_EVENT_CONFLICT: la clave % ya existe con otro evento', p_idempotency_key
      USING ERRCODE = '23505';
  END IF;
  RETURN v_old.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accounting_emit_event(text, uuid, text, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_emit_event(text, uuid, text, text, uuid, jsonb, text) TO service_role;

COMMIT;
