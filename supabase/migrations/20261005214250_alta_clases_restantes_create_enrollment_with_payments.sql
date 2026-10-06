-- =============================================================================
-- 20261005214250_alta_clases_restantes_create_enrollment_with_payments.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005214248
-- Objetivo: F-C del plan docs/specs/dreamers-reglas-completas-plan.md — alta a
-- mitad de mes por clases restantes (W3 / F7, D12/D14/D14b) y alta transaccional
-- (B6: enrollment + cobros dejaban de ser inserts sueltos sin transacción).
--
--   · enrollments.first_payment_mode text NULL CHECK (full_month|remaining_classes).
--     Por alta, elegido por el owner (D12/D14b). NULL = comportamiento de hoy.
--   · school_settings.remaining_classes_billing_enabled boolean NOT NULL DEFAULT false.
--     Apagado en todas las escuelas: sin el flag el BFF rechaza remaining_classes.
--   · RPC create_enrollment_with_payments(p_school_id, p_enrollment, p_payments)
--     SECURITY DEFINER, SOLO service_role. En UNA transacción:
--       1. inserta la inscripción (si p_enrollment no es NULL),
--       2. inserta N cobros; antes de cada cobro CON período (no exento) verifica
--          que el atleta no tenga ya un cobro activo de ese período →
--          RAISE 'periodo_ocupado:YYYY-MM' (el BFF responde 409) y no queda nada,
--       3. los elementos {"kind":"enrollment_fees", …} de p_payments delegan en
--          emit_enrollment_fees (20261005214248): inscripción y seguro salen de
--          la MISMA función por las dos vías (create-one y POST /enrollments).
--     La fórmula de clases restantes NO vive acá: el BFF (utils/remainingClasses.ts)
--     manda las filas ya calculadas.
--
-- Radio: 1 columna nullable + 1 columna con default false (= hoy) + 1 función
-- nueva sin callers fuera del BFF. Ninguna fila existente cambia de valor.
-- =============================================================================

BEGIN;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS first_payment_mode text
    CHECK (first_payment_mode IS NULL OR first_payment_mode IN ('full_month', 'remaining_classes'));

COMMENT ON COLUMN public.enrollments.first_payment_mode IS
  'Cómo se cobró el primer mes del alta: full_month | remaining_classes (D12/D14b). NULL = alta anterior a F7 o sin elección.';

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS remaining_classes_billing_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.remaining_classes_billing_enabled IS
  'Permite el alta a mitad de mes cobrando solo las clases restantes (F7). Default false = como hoy.';

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
        v_elem->>'person_name'
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
      period_year, period_month, payment_category, period_uniqueness_exempt
    ) VALUES (
      p_school_id, v_pay.branch_id, v_pay.parent_id, v_pay.child_id, v_pay.user_id,
      v_pay.unregistered_athlete_id, v_pay.team_id, v_pay.offering_plan_id,
      v_pay.amount, v_pay.concept, v_pay.due_date, 'pending',
      COALESCE(v_pay.payment_type, 'subscription'),
      v_pay.period_year, v_pay.period_month, v_pay.payment_category,
      COALESCE(v_pay.period_uniqueness_exempt, false)
    )
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;

  RETURN jsonb_build_object('enrollment_id', v_enr_id, 'payment_ids', to_jsonb(v_ids));
END;
$function$;

COMMENT ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) IS
  'Alta atómica: inscripción + cobros (+ inscripción/seguro vía emit_enrollment_fees). periodo_ocupado:YYYY-MM si el período ya tiene cobro activo. Solo service_role (BFF).';

REVOKE ALL ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) TO service_role;

COMMIT;
