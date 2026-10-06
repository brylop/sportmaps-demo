-- ============================================================
-- SMOKE TEST — Alta atómica + clases restantes (F-C). NO es una migración.
-- Correr con psql tras aplicar 20261005214245, 20261005214248 y 20261005214250:
--   psql "$DATABASE_URL" \
--     -v school_id="'<uuid escuela cualquiera>'" \
--     -f supabase/migrations/_smoke/alta_clases_restantes_smoke.sql
--
-- Una transacción con ROLLBACK final: no persiste nada. Período de prueba 2099.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _p (school_id uuid);
INSERT INTO _p VALUES (:school_id);

DO $$
DECLARE
    v_school uuid; v_branch uuid; v_off uuid; v_plan uuid; v_child uuid;
    v_res jsonb; v_enr uuid; v_n int; v_mode text; v_enr_before int;
BEGIN
    SELECT school_id INTO v_school FROM _p;

    INSERT INTO public.school_branches (school_id, name) VALUES (v_school, 'SMOKE sede F7') RETURNING id INTO v_branch;
    INSERT INTO public.offerings (school_id, name, offering_type) VALUES (v_school, 'SMOKE offering F7', 'membership') RETURNING id INTO v_off;
    INSERT INTO public.offering_plans (school_id, offering_id, name, price, registration_fee, insurance_fee,
                                       included_minutes_per_period, session_block_minutes, max_sessions)
        VALUES (v_school, v_off, 'SMOKE PGC8x3', 723000, 120000, 150000, 1440, 180, 8) RETURNING id INTO v_plan;
    INSERT INTO public.children (full_name, school_id, branch_id, is_active)
        VALUES ('SMOKE F7 Menor ' || gen_random_uuid(), v_school, v_branch, true) RETURNING id INTO v_child;

    -- ── 1) Alta con clases restantes: inscripción + parcial + mes siguiente + inscripción/seguro ──
    v_res := public.create_enrollment_with_payments(
        v_school,
        jsonb_build_object('child_id', v_child, 'offering_plan_id', v_plan, 'offering_id', v_off,
                           'start_date', '2099-08-24', 'status', 'active', 'monthly_fee', 723000,
                           'first_payment_mode', 'remaining_classes'),
        jsonb_build_array(
            jsonb_build_object('child_id', v_child, 'branch_id', v_branch, 'offering_plan_id', v_plan,
                               'amount', 180750, 'concept', 'SMOKE parcial', 'due_date', '2099-08-24',
                               'payment_type', 'subscription', 'period_year', 2099, 'period_month', 8,
                               'payment_category', 'mensualidad'),
            jsonb_build_object('child_id', v_child, 'branch_id', v_branch, 'offering_plan_id', v_plan,
                               'amount', 723000, 'concept', 'SMOKE septiembre', 'due_date', '2099-09-05',
                               'payment_type', 'subscription', 'period_year', 2099, 'period_month', 9,
                               'payment_category', 'mensualidad'),
            jsonb_build_object('kind', 'enrollment_fees', 'plan_id', v_plan, 'child_id', v_child,
                               'branch_id', v_branch, 'due_date', '2099-08-24', 'person_name', 'SMOKE')
        )
    );
    v_enr := (v_res->>'enrollment_id')::uuid;
    IF v_enr IS NULL THEN RAISE EXCEPTION 'FAIL: no devolvió enrollment_id (%)', v_res; END IF;
    SELECT first_payment_mode INTO v_mode FROM public.enrollments WHERE id = v_enr;
    IF v_mode IS DISTINCT FROM 'remaining_classes' THEN RAISE EXCEPTION 'FAIL: first_payment_mode=%', v_mode; END IF;
    IF jsonb_array_length(v_res->'payment_ids') <> 4 THEN RAISE EXCEPTION 'FAIL: % cobros (esperaba 4)', v_res->'payment_ids'; END IF;
    SELECT count(*) INTO v_n FROM public.payments WHERE child_id = v_child AND status = 'pending';
    IF v_n <> 4 THEN RAISE EXCEPTION 'FAIL: % filas en payments (esperaba 4)', v_n; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.payments WHERE child_id = v_child AND period_year = 2099 AND period_month = 8
                   AND amount = 180750 AND NOT period_uniqueness_exempt) THEN
        RAISE EXCEPTION 'FAIL: falta el parcial de 2099-08';
    END IF;

    -- ── 2) periodo_ocupado: un 2º alta con cobro de 2099-09 aborta TODO (ni inscripción ni cobros) ──
    SELECT count(*) INTO v_enr_before FROM public.enrollments WHERE child_id = v_child;
    BEGIN
        PERFORM public.create_enrollment_with_payments(
            v_school,
            jsonb_build_object('child_id', v_child, 'offering_plan_id', v_plan, 'offering_id', v_off,
                               'start_date', '2099-09-02', 'status', 'active'),
            jsonb_build_array(jsonb_build_object('child_id', v_child, 'amount', 723000, 'concept', 'SMOKE dup',
                               'due_date', '2099-09-05', 'payment_type', 'subscription',
                               'period_year', 2099, 'period_month', 9)));
        RAISE EXCEPTION 'FAIL: aceptó un cobro de un período ocupado';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM NOT LIKE 'periodo_ocupado:2099-09%' THEN RAISE; END IF;
    END;
    SELECT count(*) INTO v_n FROM public.enrollments WHERE child_id = v_child;
    IF v_n <> v_enr_before THEN RAISE EXCEPTION 'FAIL atomicidad: quedó una inscripción huérfana'; END IF;

    -- ── 3) Plan de otra escuela → error ──
    BEGIN
        PERFORM public.create_enrollment_with_payments(
            gen_random_uuid(),
            jsonb_build_object('child_id', v_child, 'offering_plan_id', v_plan, 'offering_id', v_off, 'start_date', '2099-10-01'),
            '[]'::jsonb);
        RAISE EXCEPTION 'FAIL: aceptó un plan de otra escuela';
    EXCEPTION WHEN no_data_found THEN NULL;
    END;

    -- ── 4) CHECK de first_payment_mode ──
    BEGIN
        PERFORM public.create_enrollment_with_payments(
            v_school,
            jsonb_build_object('child_id', v_child, 'team_id', NULL, 'offering_plan_id', v_plan, 'offering_id', v_off,
                               'start_date', '2099-10-01', 'first_payment_mode', 'otra_cosa'),
            '[]'::jsonb);
        RAISE EXCEPTION 'FAIL: aceptó first_payment_mode inválido';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- ── 5) El flag existe y está apagado por defecto ──
    IF EXISTS (SELECT 1 FROM public.school_settings WHERE remaining_classes_billing_enabled) THEN
        RAISE NOTICE 'Aviso: hay escuelas con remaining_classes_billing_enabled = true (esperado solo tras activarlo a mano).';
    END IF;

    -- ── 6) Permisos: solo service_role ──
    IF has_function_privilege('authenticated', 'public.create_enrollment_with_payments(uuid,jsonb,jsonb)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.create_enrollment_with_payments(uuid,jsonb,jsonb)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL grants: create_enrollment_with_payments ejecutable por authenticated/anon';
    END IF;

    RAISE NOTICE 'SMOKE alta clases restantes: OK';
END $$;

ROLLBACK;
