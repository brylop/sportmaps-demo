-- ============================================================
-- SMOKE TEST — Inscripción + seguro en el alta (F-A + F-B). NO es una migración.
-- Correr con psql tras aplicar 20261005214245, 20261005214248 y 20261010124934 (exoneración):
--   psql "$DATABASE_URL" \
--     -v school_id="'<uuid escuela cualquiera>'" \
--     -v user_id="'<profiles.id de un adulto (atleta) cualquiera>'" \
--     -f supabase/migrations/_smoke/enrollment_fees_smoke.sql
--
-- Todo corre en UNA transacción con ROLLBACK final: no persiste nada.
-- Las fixtures (sede, offering, planes, menores, no registrado) se crean dentro.
-- Los cobros de prueba usan el período 2099-01 para no chocar con cobros reales
-- del adulto. open_month se acota a la sede de prueba (p_branch_id), así que no
-- toca a los demás atletas de la escuela (y de todos modos hay ROLLBACK).
-- Cada assert usa RAISE EXCEPTION → si algo falla, la corrida aborta con el motivo.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _p (school_id uuid, user_id uuid);
INSERT INTO _p VALUES (:school_id, :user_id);

DO $$
DECLARE
    v_school uuid; v_user uuid;
    v_branch uuid; v_off uuid; v_plan uuid; v_plan_nofee uuid;
    v_child uuid; v_child2 uuid; v_child3 uuid; v_child4 uuid; v_unreg uuid;
    v_enr uuid; v_ids uuid[]; v_n int; v_exp_before date; v_exp_after date;
    v_due date := DATE '2099-01-15';
    v_fee_id uuid; v_res jsonb;
BEGIN
    SELECT school_id, user_id INTO v_school, v_user FROM _p;

    -- ── Fixtures ──────────────────────────────────────────────────────────
    INSERT INTO public.school_branches (school_id, name) VALUES (v_school, 'SMOKE sede fees') RETURNING id INTO v_branch;
    INSERT INTO public.offerings (school_id, name, offering_type) VALUES (v_school, 'SMOKE offering fees', 'membership') RETURNING id INTO v_off;
    INSERT INTO public.offering_plans (school_id, offering_id, name, price, registration_fee, insurance_fee)
        VALUES (v_school, v_off, 'SMOKE PG8x3', 723000, 120000, 150000) RETURNING id INTO v_plan;
    INSERT INTO public.offering_plans (school_id, offering_id, name, price)
        VALUES (v_school, v_off, 'SMOKE sin cobros', 300000) RETURNING id INTO v_plan_nofee;

    INSERT INTO public.children (full_name, school_id, branch_id, is_active)
        VALUES ('SMOKE Fees Menor ' || gen_random_uuid(), v_school, v_branch, true) RETURNING id INTO v_child;
    INSERT INTO public.children (full_name, school_id, branch_id, is_active)
        VALUES ('SMOKE Fees Solo Cobros ' || gen_random_uuid(), v_school, v_branch, true) RETURNING id INTO v_child2;
    INSERT INTO public.children (full_name, school_id, branch_id, is_active)
        VALUES ('SMOKE Fees Sin Plan Fee ' || gen_random_uuid(), v_school, v_branch, true) RETURNING id INTO v_child3;
    INSERT INTO public.unregistered_athletes (school_id, full_name, branch_id, is_active)
        VALUES (v_school, 'SMOKE Fees No Registrado ' || gen_random_uuid(), v_branch, true) RETURNING id INTO v_unreg;

    -- ── 1) Menor: mensualidad + inscripción + seguro en el MISMO período, sin 23505 ──
    INSERT INTO public.enrollments (school_id, child_id, offering_plan_id, offering_id, status, start_date)
        VALUES (v_school, v_child, v_plan, v_off, 'active', v_due) RETURNING id INTO v_enr;
    INSERT INTO public.payments (school_id, branch_id, child_id, offering_plan_id, amount, concept, due_date, status,
                                 payment_type, period_year, period_month)
        VALUES (v_school, v_branch, v_child, v_plan, 723000, 'SMOKE mensualidad', v_due, 'pending', 'subscription', 2099, 1);
    v_ids := public.emit_enrollment_fees(v_school, v_plan, v_child, NULL, NULL, NULL, v_branch, v_due, 'Menor');
    IF array_length(v_ids, 1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'FAIL menor: % cobros únicos (esperaba 2)', array_length(v_ids, 1); END IF;
    SELECT count(*) INTO v_n FROM public.payments WHERE child_id = v_child AND status = 'pending';
    IF v_n <> 3 THEN RAISE EXCEPTION 'FAIL menor: % filas (esperaba 3)', v_n; END IF;
    IF EXISTS (SELECT 1 FROM public.payments WHERE id = ANY (v_ids)
               AND NOT (period_uniqueness_exempt AND payment_type = 'one_time' AND period_year = 2099 AND period_month = 1
                        AND due_date = v_due AND payment_category IN ('inscripcion', 'seguro'))) THEN
        RAISE EXCEPTION 'FAIL menor: forma de los cobros únicos';
    END IF;

    -- ── 2) Adulto: mismo caso (antes de 20261005214245 chocaba en _per_adult) ──
    INSERT INTO public.payments (school_id, user_id, offering_plan_id, amount, concept, due_date, status,
                                 payment_type, period_year, period_month)
        VALUES (v_school, v_user, v_plan, 723000, 'SMOKE mensualidad adulto', v_due, 'pending', 'subscription', 2099, 1);
    v_ids := public.emit_enrollment_fees(v_school, v_plan, NULL, v_user, NULL, NULL, NULL, v_due, 'Adulto');
    IF array_length(v_ids, 1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'FAIL adulto: % cobros únicos (esperaba 2)', array_length(v_ids, 1); END IF;

    -- ── 3) No registrado: mismo caso (antes chocaba en _per_unreg) ──
    INSERT INTO public.payments (school_id, unregistered_athlete_id, offering_plan_id, amount, concept, due_date, status,
                                 payment_type, period_year, period_month)
        VALUES (v_school, v_unreg, v_plan, 723000, 'SMOKE mensualidad unreg', v_due, 'pending', 'subscription', 2099, 1);
    v_ids := public.emit_enrollment_fees(v_school, v_plan, NULL, NULL, v_unreg, NULL, NULL, v_due, 'No registrado');
    IF array_length(v_ids, 1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'FAIL unreg: % cobros únicos (esperaba 2)', array_length(v_ids, 1); END IF;

    -- ── 4) Una 2ª mensualidad del mismo período SIGUE chocando (la unicidad no se aflojó para mensualidades) ──
    BEGIN
        INSERT INTO public.payments (school_id, unregistered_athlete_id, amount, concept, due_date, status,
                                     payment_type, period_year, period_month)
            VALUES (v_school, v_unreg, 1000, 'SMOKE dup', v_due, 'pending', 'subscription', 2099, 1);
        RAISE EXCEPTION 'FAIL unicidad: permitió 2ª mensualidad del período';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- ── 5) Pagar la inscripción NO cambia expires_at ──
    SELECT expires_at INTO v_exp_before FROM public.enrollments WHERE id = v_enr;
    SELECT id INTO v_fee_id FROM public.payments WHERE child_id = v_child AND payment_category = 'inscripcion';
    UPDATE public.payments SET status = 'paid', payment_date = v_due WHERE id = v_fee_id;
    SELECT expires_at INTO v_exp_after FROM public.enrollments WHERE id = v_enr;
    IF v_exp_after IS DISTINCT FROM v_exp_before THEN
        RAISE EXCEPTION 'FAIL B3: pagar la inscripción movió expires_at % → %', v_exp_before, v_exp_after;
    END IF;

    -- ── 6) Re-alta dentro de 365 días: inscripción sí, seguro NO ──
    v_ids := public.emit_enrollment_fees(v_school, v_plan, v_child, NULL, NULL, NULL, v_branch, v_due + 30, 'Menor');
    IF array_length(v_ids, 1) IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'FAIL dedupe seguro: % filas (esperaba 1)', array_length(v_ids, 1); END IF;
    IF (SELECT payment_category FROM public.payments WHERE id = v_ids[1]) <> 'inscripcion' THEN
        RAISE EXCEPTION 'FAIL dedupe seguro: la única fila no es la inscripción';
    END IF;
    -- …y pasado el año, el seguro vuelve
    v_ids := public.emit_enrollment_fees(v_school, v_plan, v_child, NULL, NULL, NULL, v_branch, v_due + 400, 'Menor');
    IF array_length(v_ids, 1) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'FAIL seguro anual: % filas (esperaba 2)', array_length(v_ids, 1); END IF;

    -- ── 7) Plan sin inscripción ni seguro → 0 cobros únicos (exactamente 1 fila: la mensualidad) ──
    INSERT INTO public.enrollments (school_id, child_id, offering_plan_id, offering_id, status, start_date)
        VALUES (v_school, v_child3, v_plan_nofee, v_off, 'active', v_due);
    INSERT INTO public.payments (school_id, branch_id, child_id, offering_plan_id, amount, concept, due_date, status,
                                 payment_type, period_year, period_month)
        VALUES (v_school, v_branch, v_child3, v_plan_nofee, 300000, 'SMOKE mensualidad sin fees', v_due, 'pending', 'subscription', 2099, 1);
    v_ids := public.emit_enrollment_fees(v_school, v_plan_nofee, v_child3, NULL, NULL, NULL, v_branch, v_due, 'Sin fees');
    IF COALESCE(array_length(v_ids, 1), 0) <> 0 THEN RAISE EXCEPTION 'FAIL sin fees: % filas', array_length(v_ids, 1); END IF;
    SELECT count(*) INTO v_n FROM public.payments WHERE child_id = v_child3;
    IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL sin fees: % filas totales (esperaba 1)', v_n; END IF;

    -- ── 8) open_month: un menor con SOLO inscripción/seguro en 2099-01 igual recibe su mensualidad ──
    INSERT INTO public.enrollments (school_id, child_id, offering_plan_id, offering_id, status, start_date)
        VALUES (v_school, v_child2, v_plan, v_off, 'active', v_due);
    PERFORM public.emit_enrollment_fees(v_school, v_plan, v_child2, NULL, NULL, NULL, v_branch, v_due, 'Solo cobros');
    v_res := public.open_month(v_school, 2099, 1, v_branch);
    IF NOT EXISTS (SELECT 1 FROM public.payments WHERE child_id = v_child2 AND period_year = 2099 AND period_month = 1
                   AND payment_category = 'mensualidad') THEN
        RAISE EXCEPTION 'FAIL open_month: la inscripción/seguro ocuparon el período (%).', v_res;
    END IF;
    -- …y no duplicó la del menor que ya tenía mensualidad de 2099-01
    SELECT count(*) INTO v_n FROM public.payments WHERE child_id = v_child AND period_year = 2099 AND period_month = 1
       AND NOT period_uniqueness_exempt AND status <> 'cancelled';
    IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL open_month: menor 1 tiene % mensualidades de 2099-01', v_n; END IF;

    -- ── 9) open_month del mes siguiente sigue creando la mensualidad ──
    v_res := public.open_month(v_school, 2099, 2, v_branch);
    IF NOT EXISTS (SELECT 1 FROM public.payments WHERE child_id = v_child AND period_year = 2099 AND period_month = 2
                   AND payment_category = 'mensualidad') THEN
        RAISE EXCEPTION 'FAIL open_month 2099-02 no generó la mensualidad (%).', v_res;
    END IF;

    -- ── 10) Plan de OTRA escuela → error, no cobro ──
    BEGIN
        PERFORM public.emit_enrollment_fees(gen_random_uuid(), v_plan, v_child, NULL, NULL, NULL, NULL, v_due, 'x');
        RAISE EXCEPTION 'FAIL: aceptó un plan de otra escuela';
    EXCEPTION WHEN no_data_found THEN NULL;
    END;

    -- ── 11) Permisos: solo service_role (firma de 11 argumentos, 20261010124934) ──
    IF has_function_privilege('authenticated', 'public.emit_enrollment_fees(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,text,boolean,boolean)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.emit_enrollment_fees(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,text,boolean,boolean)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL grants: emit_enrollment_fees ejecutable por authenticated/anon';
    END IF;
    IF NOT has_function_privilege('service_role', 'public.emit_enrollment_fees(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,text,boolean,boolean)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL grants: service_role sin EXECUTE en emit_enrollment_fees';
    END IF;
    -- Sin sobrecarga: la firma de 9 ya no existe (si quedara, las llamadas de 9 serían ambiguas).
    IF to_regprocedure('public.emit_enrollment_fees(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,text)') IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL firma: sigue viva la sobrecarga de 9 argumentos';
    END IF;

    -- ── 12) Exoneración por alta (20261010124934) ──
    -- Cada caso con un atleta NUEVO (sin seguro previo: el dedupe de 365 días no interfiere)
    -- y en 2099-01 (payments_period_year_range no admite más allá de 2100).
    -- 12a. Inscripción exonerada (posicional): solo el seguro.
    INSERT INTO public.unregistered_athletes (school_id, full_name, branch_id, is_active)
        VALUES (v_school, 'SMOKE Exon ins ' || gen_random_uuid(), v_branch, true) RETURNING id INTO v_unreg;
    v_ids := public.emit_enrollment_fees(v_school, v_plan, NULL, NULL, v_unreg, NULL, NULL, v_due, 'Exon ins', true, false);
    IF array_length(v_ids, 1) IS DISTINCT FROM 1
       OR (SELECT payment_category FROM public.payments WHERE id = v_ids[1]) <> 'seguro' THEN
        RAISE EXCEPTION 'FAIL exoneración inscripción: % filas', array_length(v_ids, 1);
    END IF;
    -- 12b. Seguro exonerado (con nombre, como PostgREST): solo la inscripción.
    INSERT INTO public.unregistered_athletes (school_id, full_name, branch_id, is_active)
        VALUES (v_school, 'SMOKE Exon seg ' || gen_random_uuid(), v_branch, true) RETURNING id INTO v_unreg;
    v_ids := public.emit_enrollment_fees(
        p_school_id => v_school, p_plan_id => v_plan, p_child_id => NULL, p_user_id => NULL,
        p_unreg_id => v_unreg, p_parent_id => NULL, p_branch_id => NULL, p_due_date => v_due,
        p_person_name => 'Exon seg', p_waive_insurance => true);
    IF array_length(v_ids, 1) IS DISTINCT FROM 1
       OR (SELECT payment_category FROM public.payments WHERE id = v_ids[1]) <> 'inscripcion' THEN
        RAISE EXCEPTION 'FAIL exoneración seguro: % filas', array_length(v_ids, 1);
    END IF;
    -- …y como el seguro no se cobró, no cuenta para el dedupe: la próxima alta sí lo cobra.
    v_ids := public.emit_enrollment_fees(v_school, v_plan, NULL, NULL, v_unreg, NULL, NULL, v_due + 30, 'Re-alta');
    IF array_length(v_ids, 1) IS DISTINCT FROM 2 THEN
        RAISE EXCEPTION 'FAIL seguro exonerado no debe contar para el dedupe: % filas', array_length(v_ids, 1);
    END IF;
    -- 12c. Los dos: cero filas.
    INSERT INTO public.unregistered_athletes (school_id, full_name, branch_id, is_active)
        VALUES (v_school, 'SMOKE Exon ambos ' || gen_random_uuid(), v_branch, true) RETURNING id INTO v_unreg;
    v_ids := public.emit_enrollment_fees(v_school, v_plan, NULL, NULL, v_unreg, NULL, NULL, v_due, 'Exon ambos', true, true);
    IF COALESCE(array_length(v_ids, 1), 0) <> 0 THEN RAISE EXCEPTION 'FAIL exoneración ambos: % filas', array_length(v_ids, 1); END IF;
    -- 12d. Alta atómica con el elemento enrollment_fees + waive_registration_fee:
    --      inscripción (enrollments) + mensualidad + seguro, sin cobro de inscripción.
    INSERT INTO public.children (full_name, school_id, branch_id, is_active)
        VALUES ('SMOKE Fees Exonerado ' || gen_random_uuid(), v_school, v_branch, true) RETURNING id INTO v_child4;
    v_res := public.create_enrollment_with_payments(
        v_school,
        jsonb_build_object('child_id', v_child4, 'offering_plan_id', v_plan, 'offering_id', v_off, 'start_date', v_due),
        jsonb_build_array(
            jsonb_build_object('child_id', v_child4, 'branch_id', v_branch, 'offering_plan_id', v_plan,
                               'amount', 723000, 'concept', 'SMOKE mensualidad exon', 'due_date', v_due,
                               'period_year', 2099, 'period_month', 1, 'payment_category', 'mensualidad'),
            jsonb_build_object('kind', 'enrollment_fees', 'plan_id', v_plan, 'child_id', v_child4,
                               'branch_id', v_branch, 'due_date', v_due, 'person_name', 'Exon alta',
                               'waive_registration_fee', true)));
    IF v_res->>'enrollment_id' IS NULL THEN RAISE EXCEPTION 'FAIL alta exonerada: sin inscripción'; END IF;
    SELECT count(*) INTO v_n FROM public.payments WHERE id IN (SELECT jsonb_array_elements_text(v_res->'payment_ids')::uuid);
    IF v_n <> 2 THEN RAISE EXCEPTION 'FAIL alta exonerada: % filas (esperaba mensualidad + seguro)', v_n; END IF;
    IF EXISTS (SELECT 1 FROM public.payments WHERE id IN (SELECT jsonb_array_elements_text(v_res->'payment_ids')::uuid)
               AND payment_category = 'inscripcion') THEN
        RAISE EXCEPTION 'FAIL alta exonerada: se creó la inscripción';
    END IF;
    -- 12e. Sin las llaves waive_* el elemento cobra como siempre (regresión), atleta nuevo.
    INSERT INTO public.unregistered_athletes (school_id, full_name, branch_id, is_active)
        VALUES (v_school, 'SMOKE Sin exon ' || gen_random_uuid(), v_branch, true) RETURNING id INTO v_unreg;
    v_res := public.create_enrollment_with_payments(
        v_school, NULL,
        jsonb_build_array(jsonb_build_object('kind', 'enrollment_fees', 'plan_id', v_plan,
                                             'unregistered_athlete_id', v_unreg,
                                             'due_date', v_due, 'person_name', 'Sin exon')));
    IF jsonb_array_length(v_res->'payment_ids') <> 2 THEN
        RAISE EXCEPTION 'FAIL regresión elemento sin waive_*: % filas (esperaba 2)', jsonb_array_length(v_res->'payment_ids');
    END IF;

    RAISE NOTICE 'SMOKE enrollment fees: OK';
END $$;

ROLLBACK;
