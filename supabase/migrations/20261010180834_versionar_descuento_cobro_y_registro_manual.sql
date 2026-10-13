-- =============================================================================
-- 20261010180834_versionar_descuento_cobro_y_registro_manual.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10
-- Objetivo: versionar en el repo dos cambios que otra sesión aplicó hoy
-- directo en la base (vía MCP) sin archivo en supabase/migrations/:
--   · 20261010140528 payments_descuento_viaja_con_el_cobro → aquí SOLO las
--     columnas payments.discount_pct / list_amount y su CHECK. Las funciones
--     que también tocó ya las reemplazaron archivos posteriores
--     (create_enrollment_with_payments → 20261010124934;
--      fn_guard_payments_client → 20261010144558), por eso NO se repiten aquí.
--   · 20261010143454 register_manual_payments_rpc → cuerpo idéntico al vivo.
--
-- Idempotente: en la base viva es un no-op (columnas IF NOT EXISTS, CHECK solo
-- si falta, CREATE OR REPLACE con el mismo cuerpo). Sirve para reconstruir una
-- base desde cero. Copia de lo vivo en docs/migraciones-aplicadas-solo-en-vivo/.
-- =============================================================================

BEGIN;

-- ── 1. Columnas del descuento que viaja con el cobro (de 20261010140528) ─────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS list_amount  numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.payments'::regclass
                    AND conname = 'payments_discount_pct_range') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_discount_pct_range
      CHECK (discount_pct IS NULL OR (discount_pct > 0 AND discount_pct <= 100));
  END IF;
END $$;

-- ── 2. register_manual_payments (de 20261010143454, cuerpo vivo) ─────────────
CREATE OR REPLACE FUNCTION public.register_manual_payments(
  p_school_id      uuid,
  p_payment_ids    uuid[],
  p_method         text,
  p_payment_date   date,
  p_reference_base text,
  p_receipt_url    text  DEFAULT NULL,
  p_receipt_fields jsonb DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_ids       uuid[];
  v_found     integer;
  v_bad       integer;
  v_athletes  integer;
  v_row       record;
  v_rf        public.payments;
  v_i         integer := 0;
  v_total     numeric := 0;
  v_paid_ids  uuid[] := ARRAY[]::uuid[];
  v_ref       text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no_autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'school_id obligatorio' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.is_school_admin(p_school_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'sin_permiso: solo el owner o los administradores de la escuela pueden registrar pagos'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.school_is_operational(p_school_id) THEN
    RAISE EXCEPTION 'escuela_no_operativa: la cuenta de la escuela está bloqueada para esta operación'
      USING ERRCODE = '42501';
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('cash', 'transfer') THEN
    RAISE EXCEPTION 'metodo_invalido: debe ser cash o transfer' USING ERRCODE = '22023';
  END IF;
  IF p_reference_base IS NULL OR length(btrim(p_reference_base)) = 0 THEN
    RAISE EXCEPTION 'referencia_obligatoria' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[]) INTO v_ids
    FROM unnest(COALESCE(p_payment_ids, ARRAY[]::uuid[])) AS x;
  IF cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'sin_cobros: selecciona al menos un cobro' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_ids) > 50 THEN
    RAISE EXCEPTION 'demasiados_cobros: máximo 50 por operación' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.payments
   WHERE id = ANY (v_ids) AND school_id = p_school_id
   FOR UPDATE;

  SELECT count(*),
         count(*) FILTER (WHERE status NOT IN ('pending', 'overdue')),
         count(DISTINCT COALESCE(child_id, user_id, unregistered_athlete_id))
    INTO v_found, v_bad, v_athletes
    FROM public.payments
   WHERE id = ANY (v_ids) AND school_id = p_school_id;

  IF v_found <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'cobro_no_encontrado: alguno de los cobros no existe en esta escuela' USING ERRCODE = 'P0002';
  END IF;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'cobro_no_pagable: solo se registran cobros pendientes o atrasados' USING ERRCODE = 'P0001';
  END IF;
  IF v_athletes <> 1 THEN
    RAISE EXCEPTION 'atletas_distintos: los cobros deben ser de un mismo deportista' USING ERRCODE = 'P0001';
  END IF;

  v_rf := jsonb_populate_record(NULL::public.payments, COALESCE(p_receipt_fields, '{}'::jsonb));

  FOR v_row IN
    SELECT id, amount FROM public.payments
     WHERE id = ANY (v_ids) AND school_id = p_school_id
     ORDER BY due_date, created_at, id
  LOOP
    v_i := v_i + 1;
    v_ref := CASE WHEN cardinality(v_ids) = 1 THEN p_reference_base ELSE p_reference_base || '-' || v_i END;

    UPDATE public.payments SET
      status           = 'paid',
      payment_method   = p_method,
      payment_channel  = p_method,
      payment_date     = p_payment_date,
      approved_by      = v_uid,
      approved_at      = now(),
      reference        = v_ref,
      amount_paid      = amount,
      requires_review  = false,
      unblocked_at     = now(),
      unblocked_by     = v_uid,
      receipt_url      = CASE WHEN p_method = 'transfer' THEN p_receipt_url ELSE receipt_url END
    WHERE id = v_row.id;

    IF v_i = 1 AND p_method = 'transfer' AND p_receipt_fields IS NOT NULL THEN
      UPDATE public.payments SET
        ocr_amount                  = v_rf.ocr_amount,
        ocr_currency                = v_rf.ocr_currency,
        ocr_date                    = v_rf.ocr_date,
        ocr_bank                    = v_rf.ocr_bank,
        ocr_reference               = v_rf.ocr_reference,
        ocr_provider                = v_rf.ocr_provider,
        ocr_destination             = v_rf.ocr_destination,
        ocr_destination_name        = v_rf.ocr_destination_name,
        ocr_origin_name             = v_rf.ocr_origin_name,
        ocr_time                    = v_rf.ocr_time,
        ocr_raw_response            = v_rf.ocr_raw_response,
        receipt_verdict             = v_rf.receipt_verdict,
        receipt_verdict_reasons     = v_rf.receipt_verdict_reasons,
        receipt_reference_norm      = v_rf.receipt_reference_norm,
        receipt_image_sha256        = v_rf.receipt_image_sha256,
        receipt_image_sha256_source = v_rf.receipt_image_sha256_source,
        receipt_verdict_at          = v_rf.receipt_verdict_at
      WHERE id = v_row.id;
    END IF;

    v_total    := v_total + COALESCE(v_row.amount, 0);
    v_paid_ids := v_paid_ids || v_row.id;
  END LOOP;

  RETURN jsonb_build_object('payment_ids', to_jsonb(v_paid_ids), 'count', v_i, 'total', v_total);
END;
$function$;

REVOKE ALL ON FUNCTION public.register_manual_payments(uuid, uuid[], text, date, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_manual_payments(uuid, uuid[], text, date, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_manual_payments(uuid, uuid[], text, date, text, text, jsonb) TO authenticated, service_role;

COMMIT;
