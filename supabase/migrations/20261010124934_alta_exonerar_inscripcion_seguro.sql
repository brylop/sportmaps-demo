-- =============================================================================
-- 20261010124934_alta_exonerar_inscripcion_seguro.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261009121558
-- Objetivo: que la escuela pueda NO cobrar la inscripción y/o el seguro de un
-- alta concreta (pedido de una escuela cliente: «la inscripción ni el seguro no
-- los cobre» para algunos atletas nuevos; la mensualidad sí se cobra).
--
--   · emit_enrollment_fees gana dos parámetros al final:
--       p_waive_registration boolean DEFAULT false
--       p_waive_insurance    boolean DEFAULT false
--     Con true, esa fila 'one_time' NO se inserta. Defaults false = hoy.
--     Como cambia la lista de argumentos, se hace DROP de la firma de 9 y
--     CREATE de la de 11: un CREATE OR REPLACE con argumentos nuevos crearía una
--     SOBRECARGA y las llamadas de 9 argumentos quedarían ambiguas
--     («function is not unique»). Las llamadas de 9 argumentos (posicionales o
--     con nombre) resuelven a la nueva por los defaults.
--   · create_enrollment_with_payments: el elemento {"kind":"enrollment_fees"}
--     acepta "waive_registration_fee" / "waive_insurance_fee" (boolean, ausente
--     = false) y los pasa a emit_enrollment_fees. El resto del cuerpo es
--     idéntico al VIVO, que ya incluye discount_pct y list_amount en el INSERT
--     de payments (20261010140528 payments_descuento_viaja_con_el_cobro, aplicada
--     en la base por otra vía, sin archivo en el repo). Rebasado el 2026-10-10 en
--     QA sobre el gemelo: la versión anterior partía de 20261005214250 y al
--     aplicarla habría borrado ese paso de discount_pct/list_amount.
--
-- Quién puede exonerar: el BFF (único caller, service_role) solo lo permite en
-- el alta (POST /students/create-one y POST /enrollments), con la misma
-- autorización que el alta, y deja rastro en audit_logs.
--
-- Radio: 0 filas tocadas. Mismos grants (solo service_role). Sin callers fuera
-- del BFF. Mientras nadie mande los flags, el comportamiento es el de hoy.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text);

CREATE FUNCTION public.emit_enrollment_fees(
  p_school_id          uuid,
  p_plan_id            uuid,
  p_child_id           uuid,
  p_user_id            uuid,
  p_unreg_id           uuid,
  p_parent_id          uuid,
  p_branch_id          uuid,
  p_due_date           date,
  p_person_name        text,
  p_waive_registration boolean DEFAULT false,
  p_waive_insurance    boolean DEFAULT false
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
  v_reg_fee  numeric;
  v_ins_fee  numeric;
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

  -- Exoneración por alta: la escuela decidió no cobrar este concepto.
  v_reg_fee := CASE WHEN COALESCE(p_waive_registration, false) THEN 0
                    ELSE COALESCE(v_plan.registration_fee, 0) END;
  v_ins_fee := CASE WHEN COALESCE(p_waive_insurance, false) THEN 0
                    ELSE COALESCE(v_plan.insurance_fee, 0) END;

  IF v_reg_fee <= 0 AND v_ins_fee <= 0 THEN
    RETURN v_ids;   -- sin cobros únicos configurados (o exonerados los dos).
  END IF;

  -- Serializa altas concurrentes del mismo atleta (dedupe de seguro sin carrera).
  PERFORM pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || v_athlete::text, 0));

  -- Quién paga: el acudiente del menor (sin esto el cobro es impagable online,
  -- ver enrollmentBilling.ts). Si aún no tiene acudiente, trg_backfill_payment_
  -- payer_on_link lo completa cuando se vincule.
  IF v_parent IS NULL AND p_child_id IS NOT NULL THEN
    SELECT c.parent_id INTO v_parent FROM public.children c WHERE c.id = p_child_id;
  END IF;

  IF v_reg_fee > 0 THEN
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      offering_plan_id, amount, concept, due_date, status, payment_type,
      period_year, period_month, payment_category, period_uniqueness_exempt
    ) VALUES (
      p_school_id, p_branch_id, v_parent, p_child_id, p_user_id, p_unreg_id,
      p_plan_id, v_reg_fee,
      'Inscripción — ' || v_plan.name || v_suffix,
      v_due, 'pending', 'one_time',
      extract(year FROM v_due)::smallint, extract(month FROM v_due)::smallint,
      'inscripcion', true
    )
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END IF;

  IF v_ins_fee > 0
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
      p_plan_id, v_ins_fee,
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

COMMENT ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, boolean, boolean) IS
  'Cobros únicos del alta (inscripción + seguro con dedupe 365 días). p_waive_* = la escuela no cobra ese concepto en esta alta. Solo service_role (BFF). Fuente única: también la usa create_enrollment_with_payments.';

REVOKE ALL ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, boolean, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, boolean, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, boolean, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.create_enrollment_with_payments(
  p_school_id  uuid,
  p_enrollment jsonb,
  p_payments   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_enr         public.enrollments;
  v_enr_id      uuid;
  v_elem        jsonb;
  v_pay         public.payments;
  v_athlete     uuid;
  v_ids         uuid[] := ARRAY[]::uuid[];
  v_fee_ids     uuid[];
  v_id          uuid;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'create_enrollment_with_payments: school_id obligatorio' USING ERRCODE = '22023';
  END IF;
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) NOT IN ('array', 'null') THEN
    RAISE EXCEPTION 'create_enrollment_with_payments: p_payments debe ser un arreglo' USING ERRCODE = '22023';
  END IF;

  -- ── 1. Inscripción ─────────────────────────────────────────────────────────
  IF p_enrollment IS NOT NULL AND jsonb_typeof(p_enrollment) = 'object' THEN
    v_enr := jsonb_populate_record(NULL::public.enrollments, p_enrollment);

    IF v_enr.offering_plan_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.offering_plans op
          WHERE op.id = v_enr.offering_plan_id AND op.school_id = p_school_id) THEN
      RAISE EXCEPTION 'plan_no_encontrado: el plan % no pertenece a la escuela', v_enr.offering_plan_id
        USING ERRCODE = 'P0002';
    END IF;

    v_athlete := COALESCE(v_enr.child_id, v_enr.user_id, v_enr.unregistered_athlete_id);
    IF v_athlete IS NOT NULL THEN
      -- Misma llave que emit_enrollment_fees: serializa altas del mismo atleta.
      PERFORM pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || v_athlete::text, 0));
    END IF;

    INSERT INTO public.enrollments (
      school_id, child_id, user_id, unregistered_athlete_id, team_id,
      offering_plan_id, offering_id, start_date, status, monthly_fee, first_payment_mode
    ) VALUES (
      p_school_id, v_enr.child_id, v_enr.user_id, v_enr.unregistered_athlete_id, v_enr.team_id,
      v_enr.offering_plan_id, v_enr.offering_id,
      COALESCE(v_enr.start_date, (now() AT TIME ZONE 'America/Bogota')::date),
      COALESCE(v_enr.status, 'active'), v_enr.monthly_fee, v_enr.first_payment_mode
    )
    RETURNING id INTO v_enr_id;
  END IF;

  -- ── 2. Cobros ──────────────────────────────────────────────────────────────
  FOR v_elem IN SELECT value FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
  LOOP
    -- 2a. Inscripción + seguro: misma función que usa POST /enrollments.
    IF v_elem->>'kind' = 'enrollment_fees' THEN
      v_fee_ids := public.emit_enrollment_fees(
        p_school_id,
        NULLIF(v_elem->>'plan_id', '')::uuid,
        NULLIF(v_elem->>'child_id', '')::uuid,
        NULLIF(v_elem->>'user_id', '')::uuid,
        NULLIF(v_elem->>'unregistered_athlete_id', '')::uuid,
        NULLIF(v_elem->>'parent_id', '')::uuid,
        NULLIF(v_elem->>'branch_id', '')::uuid,
        NULLIF(v_elem->>'due_date', '')::date,
        v_elem->>'person_name',
        COALESCE((v_elem->>'waive_registration_fee')::boolean, false),
        COALESCE((v_elem->>'waive_insurance_fee')::boolean, false)
      );
      v_ids := v_ids || COALESCE(v_fee_ids, ARRAY[]::uuid[]);
      CONTINUE;
    END IF;

    -- 2b. Cobro con período (mensualidad / parcial / mes siguiente).
    v_pay := jsonb_populate_record(NULL::public.payments, v_elem);
    v_athlete := COALESCE(v_pay.child_id, v_pay.user_id, v_pay.unregistered_athlete_id);
    IF v_athlete IS NULL THEN
      RAISE EXCEPTION 'create_enrollment_with_payments: cobro sin atleta' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || v_athlete::text, 0));

    -- Mismo predicado que uniq_payment_active_period_* (por eso sin school_id):
    -- se adelanta al 23505 con un mensaje que el BFF traduce a 409.
    IF v_pay.period_year IS NOT NULL AND v_pay.period_month IS NOT NULL
       AND NOT COALESCE(v_pay.period_uniqueness_exempt, false)
       AND EXISTS (
         SELECT 1 FROM public.payments p
          WHERE p.period_year  = v_pay.period_year
            AND p.period_month = v_pay.period_month
            AND p.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
            AND NOT p.period_uniqueness_exempt
            AND (
                  (v_pay.child_id IS NOT NULL AND p.child_id = v_pay.child_id)
               OR (v_pay.child_id IS NULL AND v_pay.user_id IS NOT NULL
                     AND p.child_id IS NULL AND p.user_id = v_pay.user_id)
               OR (v_pay.unregistered_athlete_id IS NOT NULL
                     AND p.unregistered_athlete_id = v_pay.unregistered_athlete_id)
            )
       ) THEN
      RAISE EXCEPTION 'periodo_ocupado:%', to_char(make_date(v_pay.period_year, v_pay.period_month, 1), 'YYYY-MM')
        USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, amount, concept, due_date, status, payment_type,
      period_year, period_month, payment_category, period_uniqueness_exempt,
      discount_pct, list_amount
    ) VALUES (
      p_school_id, v_pay.branch_id, v_pay.parent_id, v_pay.child_id, v_pay.user_id,
      v_pay.unregistered_athlete_id, v_pay.team_id, v_pay.offering_plan_id,
      v_pay.amount, v_pay.concept, v_pay.due_date, 'pending',
      COALESCE(v_pay.payment_type, 'subscription'),
      v_pay.period_year, v_pay.period_month, v_pay.payment_category,
      COALESCE(v_pay.period_uniqueness_exempt, false),
      v_pay.discount_pct, v_pay.list_amount
    )
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;

  RETURN jsonb_build_object('enrollment_id', v_enr_id, 'payment_ids', to_jsonb(v_ids));
END;
$function$;

COMMENT ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) IS
  'Alta atómica: inscripción + cobros (+ inscripción/seguro vía emit_enrollment_fees; waive_registration_fee / waive_insurance_fee en el elemento enrollment_fees los exoneran). periodo_ocupado:YYYY-MM si el período ya tiene cobro activo. Solo service_role (BFF).';

REVOKE ALL ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) TO service_role;

-- PostgREST: la firma de emit_enrollment_fees cambió.
NOTIFY pgrst, 'reload schema';

COMMIT;
