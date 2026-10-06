-- ============================================================
-- SMOKE TEST — F-F niveles (progresión por puntaje + días permitidos).
-- NO es una migración. Correr con psql tras aplicar 20261005214258 y
-- 20261005214300:
--   psql "$DATABASE_URL" \
--     -v school_id="'<uuid escuela>'" \
--     -v staff_id="'<profile_id owner/admin/coach ACTIVO de esa escuela>'" \
--     -v nonstaff_id="'<profile_id que NO es staff de esa escuela (p. ej. un acudiente)>'" \
--     -f supabase/migrations/_smoke/niveles_ff_smoke.sql
--
-- Todo corre en una transacción con ROLLBACK final: no persiste nada.
-- Usa la temporada 2031 para no mezclarse con resultados reales.
-- Cada assert usa RAISE EXCEPTION → si algo falla, la corrida aborta.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _p (school_id uuid, staff_id uuid, nonstaff_id uuid);
INSERT INTO _p VALUES (:school_id, :staff_id, :nonstaff_id);

DO $$
DECLARE
    v_school uuid; v_staff uuid; v_non uuid;
    v_off uuid; p0 uuid; p1 uuid; p2 uuid; p3 uuid;
    v_ua uuid; v_enr uuid;
    r record; n int;
BEGIN
    SELECT school_id, staff_id, nonstaff_id INTO v_school, v_staff, v_non FROM _p;

    -- ── Rango de nivel ─────────────────────────────────────────────────────
    IF public.competition_level_rank('club') <> 1 OR public.competition_level_rank('regional') <> 2
       OR public.competition_level_rank('nacional') <> 3 OR public.competition_level_rank('federacion') <> 4
       OR public.competition_level_rank(NULL) <> 0 THEN
        RAISE EXCEPTION 'FAIL rank: orden club<regional<nacional<federacion, NULL=0';
    END IF;

    -- ── Fixtures ───────────────────────────────────────────────────────────
    INSERT INTO public.offerings (school_id, name, offering_type)
    VALUES (v_school, 'SMOKE niveles', 'membership') RETURNING id INTO v_off;

    INSERT INTO public.offering_plans (offering_id, school_id, name, price)
    VALUES (v_off, v_school, 'SMOKE N0 (sin umbral)', 100) RETURNING id INTO p0;
    INSERT INTO public.offering_plans (offering_id, school_id, name, price, promotion_threshold_points, promotion_min_competition_level)
    VALUES (v_off, v_school, 'SMOKE N1', 200, 30, 'regional') RETURNING id INTO p1;
    INSERT INTO public.offering_plans (offering_id, school_id, name, price, promotion_threshold_points, promotion_min_competition_level)
    VALUES (v_off, v_school, 'SMOKE N2', 300, 34, 'nacional') RETURNING id INTO p2;
    INSERT INTO public.offering_plans (offering_id, school_id, name, price)
    VALUES (v_off, v_school, 'SMOKE N3 (NULL nunca destino)', 50) RETURNING id INTO p3;

    INSERT INTO public.unregistered_athletes (school_id, full_name)
    VALUES (v_school, 'SMOKE Atleta Niveles') RETURNING id INTO v_ua;
    INSERT INTO public.enrollments (school_id, unregistered_athlete_id, offering_plan_id, status)
    VALUES (v_school, v_ua, p0, 'active') RETURNING id INTO v_enr;

    -- Temporada anterior (31-dic-2030): NO cuenta para 2031.
    INSERT INTO public.competition_results (school_id, subject_type, subject_id, competition_date, result_type, points, competition_level, recorded_by)
    VALUES (v_school, 'unregistered', v_ua, '2030-12-31', 'competencia_oficial', 40, 'federacion', v_staff);
    -- Cargado por NO staff (la policy _or_self lo permite): NO cuenta.
    INSERT INTO public.competition_results (school_id, subject_type, subject_id, competition_date, result_type, points, competition_level, recorded_by)
    VALUES (v_school, 'unregistered', v_ua, '2031-03-01', 'competencia_oficial', 99, 'federacion', v_non);
    -- B5: el catálogo de la app ya pasa el CHECK; 1-ene-2031 sí es temporada 2031.
    INSERT INTO public.competition_results (school_id, subject_type, subject_id, competition_date, result_type, points, competition_level, recorded_by)
    VALUES (v_school, 'unregistered', v_ua, '2031-01-01', 'preparatorio', 35, 'regional', v_staff);

    -- ── Caso 1: plan sin umbral → candidato de menor umbral cumplido ───────
    SELECT * INTO r FROM public.get_level_promotion_eligibility(v_school, 2031, v_enr);
    IF r.enrollment_id IS NULL THEN RAISE EXCEPTION 'FAIL 1: sin fila para la inscripción'; END IF;
    IF r.best_points <> 35 THEN RAISE EXCEPTION 'FAIL 1: best_points=% (esperaba 35: ignora 2030 y el no-staff)', r.best_points; END IF;
    IF r.suggested_plan_id IS DISTINCT FROM p1 THEN RAISE EXCEPTION 'FAIL 1: sugerido=% (esperaba N1)', r.suggested_plan_name; END IF;
    IF r.suggested_fee <> 200 THEN RAISE EXCEPTION 'FAIL 1: suggested_fee=%', r.suggested_fee; END IF;

    -- ── Caso 2: 34 en nacional cumple N2 también; sigue sugiriendo el MENOR ─
    INSERT INTO public.competition_results (school_id, subject_type, subject_id, competition_date, result_type, points, competition_level, recorded_by)
    VALUES (v_school, 'unregistered', v_ua, '2031-06-01', 'competencia_oficial', 34, 'nacional', v_staff);
    SELECT * INTO r FROM public.get_level_promotion_eligibility(v_school, 2031, v_enr);
    IF r.suggested_plan_id IS DISTINCT FROM p1 THEN RAISE EXCEPTION 'FAIL 2: sugerido=% (esperaba N1)', r.suggested_plan_name; END IF;

    -- ── Caso 3: ya en N1 (umbral 30) → solo candidatos > 30 → N2 por el 34 nacional
    UPDATE public.enrollments SET offering_plan_id = p1 WHERE id = v_enr;
    SELECT * INTO r FROM public.get_level_promotion_eligibility(v_school, 2031, v_enr);
    IF r.suggested_plan_id IS DISTINCT FROM p2 THEN RAISE EXCEPTION 'FAIL 3: sugerido=% (esperaba N2)', r.suggested_plan_name; END IF;
    IF r.qualifying_points <> 34 THEN RAISE EXCEPTION 'FAIL 3: qualifying=% (el 35 es regional, N2 exige nacional)', r.qualifying_points; END IF;

    -- ── Caso 4: en N2 → no hay destino mayor; N3 (umbral NULL) nunca aparece
    UPDATE public.enrollments SET offering_plan_id = p2 WHERE id = v_enr;
    SELECT * INTO r FROM public.get_level_promotion_eligibility(v_school, 2031, v_enr);
    IF r.enrollment_id IS NULL THEN RAISE EXCEPTION 'FAIL 4: la fila debe seguir (tiene resultados)'; END IF;
    IF r.suggested_plan_id IS NOT NULL THEN RAISE EXCEPTION 'FAIL 4: sugirió % sin destino válido', r.suggested_plan_name; END IF;

    -- ── Caso 5: temporada sin resultados → sin filas ──────────────────────
    SELECT count(*) INTO n FROM public.get_level_promotion_eligibility(v_school, 2032, v_enr);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL 5: 2032 devolvió % filas', n; END IF;

    -- ── Nada se escribió (D4): el plan solo cambió por los UPDATE del test ─
    IF (SELECT offering_plan_id FROM public.enrollments WHERE id = v_enr) <> p2 THEN
        RAISE EXCEPTION 'FAIL D4: la RPC tocó la inscripción';
    END IF;

    -- ── D9: CHECK de días ──────────────────────────────────────────────────
    UPDATE public.offering_plans SET allowed_days_of_week = ARRAY[1,3,5] WHERE id = p1;
    BEGIN
        UPDATE public.offering_plans SET allowed_days_of_week = ARRAY[]::int[] WHERE id = p1;
        RAISE EXCEPTION 'FAIL D9: aceptó arreglo vacío';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.offering_plans SET allowed_days_of_week = ARRAY[7] WHERE id = p1;
        RAISE EXCEPTION 'FAIL D9: aceptó el día 7';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO public.access_events (school_id, direction, access_granted, policy_warning)
        VALUES (v_school, 'entry', true, 'otra_cosa');
        RAISE EXCEPTION 'FAIL D11b: aceptó policy_warning desconocido';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO public.access_events (school_id, direction, access_granted, policy_warning)
    VALUES (v_school, 'entry', true, 'day_not_allowed');

    -- ── Grants: solo service_role ─────────────────────────────────────────
    IF has_function_privilege('authenticated', 'public.get_level_promotion_eligibility(uuid, integer, uuid)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.get_level_promotion_eligibility(uuid, integer, uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL grants: anon/authenticated pueden ejecutar la RPC';
    END IF;

    RAISE NOTICE 'OK niveles F-F: 5 casos de elegibilidad + CHECKs D9/D11b + grants';
END $$;

ROLLBACK;
