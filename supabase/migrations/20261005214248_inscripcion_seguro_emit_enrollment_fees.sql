-- =============================================================================
-- 20261005214248_inscripcion_seguro_emit_enrollment_fees.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005214245
-- Objetivo: F-B del plan docs/specs/dreamers-reglas-completas-plan.md —
-- cobro de inscripción y de seguro de accidentes en el alta (W2, D17-D19).
--
--   · offering_plans.insurance_fee numeric NULL (espejo de registration_fee).
--     NULL / 0 = sin cobro de seguro = comportamiento de hoy en todas las escuelas.
--   · RPC emit_enrollment_fees(...) SECURITY DEFINER, SOLO service_role (el BFF
--     es el único caller). Inserta 0–2 cobros 'one_time':
--       - 'inscripcion' si el plan tiene registration_fee > 0 (D18: en cada alta).
--       - 'seguro' si el plan tiene insurance_fee > 0 y el atleta NO tiene ya un
--         seguro no anulado en esta escuela con due_date dentro de los últimos
--         365 días (dedupe anual).
--     Ambas filas: period_uniqueness_exempt = true (no compiten con la
--     mensualidad del mes en uniq_payment_active_period_*), payment_category
--     explícita, parent_id resuelto del menor, offering_plan_id del plan (solo
--     trazabilidad: 20261005214245 ya hace que pagarlas NO extienda la vigencia
--     ni ocupe el período en open_month).
--     due_date = fecha del alta (NUNCA el 1 del mes siguiente: trg_payments_fill_period
--     estamparía ese período y, sin la exclusión de categoría, open_month se
--     saltaría la mensualidad). El período se estampa explícito desde due_date.
--
-- Arregla B1: chargeRegistrationFeeIfApplicable (BFF) nunca funcionó — insertaba
-- sin período, el trigger lo llenaba desde due_date y chocaba con
-- uniq_payment_active_period_* (23505 silenciado); además no ponía parent_id.
--
-- Radio: columna nueva nullable (0 filas tocadas); función nueva sin callers
-- fuera del BFF. Ninguna escuela cambia hasta que llene insurance_fee.
-- =============================================================================

BEGIN;

ALTER TABLE public.offering_plans
  ADD COLUMN IF NOT EXISTS insurance_fee numeric
    CHECK (insurance_fee IS NULL OR insurance_fee >= 0);

COMMENT ON COLUMN public.offering_plans.insurance_fee IS
  'Seguro de accidentes cobrado en el alta (one_time, categoría seguro, dedupe 365 días por atleta y escuela). NULL = sin cobro de seguro.';

CREATE OR REPLACE FUNCTION public.emit_enrollment_fees(
  p_school_id   uuid,
  p_plan_id     uuid,
  p_child_id    uuid,
  p_user_id     uuid,
  p_unreg_id    uuid,
  p_parent_id   uuid,
  p_branch_id   uuid,
  p_due_date    date,
  p_person_name text
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_plan     record;
  v_due      date := COALESCE(p_due_date, (now() AT TIME ZONE 'America/Bogota')::date);
  v_parent   uuid := p_parent_id;
  v_athlete  uuid := COALESCE(p_child_id, p_user_id, p_unreg_id);
  v_suffix   text := CASE WHEN NULLIF(btrim(p_person_name), '') IS NULL THEN ''
                          ELSE ' — ' || btrim(p_person_name) END;
  v_ids      uuid[] := ARRAY[]::uuid[];
  v_id       uuid;
BEGIN
  IF p_school_id IS NULL OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'emit_enrollment_fees: school_id y plan_id son obligatorios'
      USING ERRCODE = '22023';
  END IF;

  IF (p_child_id IS NOT NULL)::int + (p_user_id IS NOT NULL)::int + (p_unreg_id IS NOT NULL)::int <> 1 THEN
    RAISE EXCEPTION 'emit_enrollment_fees: exactamente uno de child_id / user_id / unreg_id'
      USING ERRCODE = '22023';
  END IF;

  -- El plan tiene que ser de ESTA escuela: es la fuente del monto.
  SELECT op.name, op.registration_fee, op.insurance_fee
    INTO v_plan
    FROM public.offering_plans op
   WHERE op.id = p_plan_id
     AND op.school_id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_no_encontrado: el plan % no pertenece a la escuela', p_plan_id
      USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_plan.registration_fee, 0) <= 0 AND COALESCE(v_plan.insurance_fee, 0) <= 0 THEN
    RETURN v_ids;   -- sin cobros únicos configurados: hoy, todas las escuelas.
  END IF;

  -- Serializa altas concurrentes del mismo atleta (dedupe de seguro sin carrera).
  PERFORM pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || v_athlete::text, 0));

  -- Quién paga: el acudiente del menor (sin esto el cobro es impagable online,
  -- ver enrollmentBilling.ts). Si aún no tiene acudiente, trg_backfill_payment_
  -- payer_on_link lo completa cuando se vincule.
  IF v_parent IS NULL AND p_child_id IS NOT NULL THEN
    SELECT c.parent_id INTO v_parent FROM public.children c WHERE c.id = p_child_id;
  END IF;

  IF COALESCE(v_plan.registration_fee, 0) > 0 THEN
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      offering_plan_id, amount, concept, due_date, status, payment_type,
      period_year, period_month, payment_category, period_uniqueness_exempt
    ) VALUES (
      p_school_id, p_branch_id, v_parent, p_child_id, p_user_id, p_unreg_id,
      p_plan_id, v_plan.registration_fee,
      'Inscripción — ' || v_plan.name || v_suffix,
      v_due, 'pending', 'one_time',
      extract(year FROM v_due)::smallint, extract(month FROM v_due)::smallint,
      'inscripcion', true
    )
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END IF;

  IF COALESCE(v_plan.insurance_fee, 0) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.payments p
        WHERE p.school_id = p_school_id
          AND p.payment_category = 'seguro'
          AND p.status <> 'cancelled'
          AND p.due_date > v_due - 365
          AND (
                (p_child_id IS NOT NULL AND p.child_id = p_child_id)
             OR (p_user_id  IS NOT NULL AND p.user_id  = p_user_id AND p.child_id IS NULL)
             OR (p_unreg_id IS NOT NULL AND p.unregistered_athlete_id = p_unreg_id)
          )
     ) THEN
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      offering_plan_id, amount, concept, due_date, status, payment_type,
      period_year, period_month, payment_category, period_uniqueness_exempt
    ) VALUES (
      p_school_id, p_branch_id, v_parent, p_child_id, p_user_id, p_unreg_id,
      p_plan_id, v_plan.insurance_fee,
      'Seguro de accidentes — ' || v_plan.name || v_suffix,
      v_due, 'pending', 'one_time',
      extract(year FROM v_due)::smallint, extract(month FROM v_due)::smallint,
      'seguro', true
    )
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END IF;

  RETURN v_ids;
END;
$function$;

COMMENT ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text) IS
  'Cobros únicos del alta (inscripción + seguro con dedupe 365 días). Solo service_role (BFF). Fuente única: también la usa create_enrollment_with_payments.';

REVOKE ALL ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text) FROM anon;
REVOKE ALL ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text) TO service_role;

COMMIT;
