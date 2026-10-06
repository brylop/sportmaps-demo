-- ============================================================
-- SMOKE TEST — F-D cobranza: auto_cancel_overdue_enabled +
-- pending_proof_counts_as_paid (+ hueco C en apply_late_fees). NO es una migración.
-- Correr con psql tras aplicar 20261005214253:
--   psql "$DATABASE_URL" \
--     -v school_id="'<uuid escuela con al menos un equipo>'" \
--     -v child_id="'<children.id de esa escuela>'" \
--     -v parent_id="'<parent_id de ese child>'" \
--     -f supabase/migrations/_smoke/autocancel_flags_smoke.sql
--
-- Todo corre en una transacción con ROLLBACK final: no persiste nada (ni los
-- flags de la escuela, ni lo que los crons toquen de otras escuelas).
-- Los periodos de los cobros de prueba son de 2020 (mínimo del CHECK payments_period_year_range) para no chocar con los
-- índices únicos de periodo de cobros reales del mismo atleta.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _p (school_id uuid, child_id uuid, parent_id uuid, team_id uuid);
INSERT INTO _p (school_id, child_id, parent_id) VALUES (:school_id, :child_id, :parent_id);
UPDATE _p SET team_id = (SELECT t.id FROM public.teams t WHERE t.school_id = _p.school_id LIMIT 1);

-- Fila de settings garantizada (ON CONFLICT: la escuela ya puede tenerla).
INSERT INTO public.school_settings (school_id) SELECT school_id FROM _p
ON CONFLICT (school_id) DO NOTHING;

-- ── 0. Columnas y defaults ──────────────────────────────────────────────────
DO $$
DECLARE v_a boolean; v_b boolean;
BEGIN
    SELECT auto_cancel_overdue_enabled, pending_proof_counts_as_paid INTO v_a, v_b
    FROM public.school_settings WHERE school_id = (SELECT school_id FROM _p);
    IF v_a IS DISTINCT FROM true OR v_b IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'FAIL defaults: auto_cancel=% pending_proof=% (esperaba true/false)', v_a, v_b;
    END IF;
    IF (SELECT team_id FROM _p) IS NULL THEN
        RAISE EXCEPTION 'SETUP: la escuela no tiene equipos (enrollments_active_needs_target)';
    END IF;
    RAISE NOTICE 'OK defaults true/false ✓';
END $$;

-- ── 1. fn_expire_overdue_enrollments ────────────────────────────────────────
DO $$
DECLARE
    v_school uuid; v_child uuid; v_parent uuid; v_team uuid;
    v_eid uuid; v_pid uuid; v_res jsonb; v_status text;
    v_old date := current_date - 60;
BEGIN
    SELECT school_id, child_id, parent_id, team_id INTO v_school, v_child, v_parent, v_team FROM _p;
    -- Limpia inscripciones activas del niño en ese equipo (índice único).
    UPDATE public.enrollments SET status = 'cancelled'
    WHERE child_id = v_child AND team_id = v_team AND status = 'active';

    -- 1a) defaults → se cancela, como siempre.
    INSERT INTO public.enrollments (school_id, child_id, team_id, status, expires_at)
    VALUES (v_school, v_child, v_team, 'active', v_old) RETURNING id INTO v_eid;
    v_res := public.fn_expire_overdue_enrollments();
    SELECT status INTO v_status FROM public.enrollments WHERE id = v_eid;
    IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL 1a defaults: %', v_status; END IF;
    IF NOT (v_res ? 'skipped_flag' AND v_res ? 'skipped_proof') THEN
        RAISE EXCEPTION 'FAIL 1a: faltan contadores en %', v_res;
    END IF;
    RAISE NOTICE 'OK 1a defaults → cancelada ✓ %', v_res;

    -- 1b) auto_cancel_overdue_enabled = false → NO se cancela.
    UPDATE public.school_settings SET auto_cancel_overdue_enabled = false WHERE school_id = v_school;
    INSERT INTO public.enrollments (school_id, child_id, team_id, status, expires_at)
    VALUES (v_school, v_child, v_team, 'active', v_old) RETURNING id INTO v_eid;
    v_res := public.fn_expire_overdue_enrollments();
    SELECT status INTO v_status FROM public.enrollments WHERE id = v_eid;
    IF v_status <> 'active' THEN RAISE EXCEPTION 'FAIL 1b flag off: %', v_status; END IF;
    IF (v_res->>'skipped_flag')::int < 1 THEN RAISE EXCEPTION 'FAIL 1b skipped_flag: %', v_res; END IF;
    RAISE NOTICE 'OK 1b auto_cancel=false → sigue activa ✓ %', v_res;
    UPDATE public.enrollments SET status = 'cancelled' WHERE id = v_eid;
    UPDATE public.school_settings SET auto_cancel_overdue_enabled = true WHERE school_id = v_school;

    -- 1c) pending_proof_counts_as_paid + comprobante en revisión → NO se cancela.
    UPDATE public.school_settings SET pending_proof_counts_as_paid = true WHERE school_id = v_school;
    INSERT INTO public.enrollments (school_id, child_id, team_id, status, expires_at)
    VALUES (v_school, v_child, v_team, 'active', v_old) RETURNING id INTO v_eid;
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date, payment_date,
                                 status, payment_type, period_year, period_month)
    VALUES (v_school, v_parent, v_child, 'SMOKE F-D proof', 100000, v_old, current_date,
            'awaiting_approval', 'one_time', 2020, 1)
    RETURNING id INTO v_pid;
    IF NOT public.enrollment_has_pending_proof(v_eid) THEN RAISE EXCEPTION 'FAIL 1c helper enrollment'; END IF;
    IF NOT public.payment_has_pending_proof(v_pid) THEN RAISE EXCEPTION 'FAIL 1c helper payment'; END IF;
    v_res := public.fn_expire_overdue_enrollments();
    SELECT status INTO v_status FROM public.enrollments WHERE id = v_eid;
    IF v_status <> 'active' THEN RAISE EXCEPTION 'FAIL 1c proof: %', v_status; END IF;
    IF (v_res->>'skipped_proof')::int < 1 THEN RAISE EXCEPTION 'FAIL 1c skipped_proof: %', v_res; END IF;
    RAISE NOTICE 'OK 1c comprobante pendiente → sigue activa ✓ %', v_res;

    -- 1d) mismo comprobante pasa a glosado → sigue contando.
    UPDATE public.payments SET status = 'glosado' WHERE id = v_pid;
    PERFORM public.fn_expire_overdue_enrollments();
    SELECT status INTO v_status FROM public.enrollments WHERE id = v_eid;
    IF v_status <> 'active' THEN RAISE EXCEPTION 'FAIL 1d glosado: %', v_status; END IF;
    RAISE NOTICE 'OK 1d glosado → sigue activa ✓';

    -- 1e) comprobante rechazado → ya no cuenta → se cancela.
    UPDATE public.payments SET status = 'rejected' WHERE id = v_pid;
    IF public.payment_has_pending_proof(v_pid) THEN RAISE EXCEPTION 'FAIL 1e helper payment rejected'; END IF;
    PERFORM public.fn_expire_overdue_enrollments();
    SELECT status INTO v_status FROM public.enrollments WHERE id = v_eid;
    IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL 1e rejected: %', v_status; END IF;
    RAISE NOTICE 'OK 1e rechazado → cancelada ✓';
    DELETE FROM public.payments WHERE id = v_pid;

    -- 1f) flag de comprobante APAGADO + comprobante pendiente → se cancela (hoy).
    UPDATE public.school_settings SET pending_proof_counts_as_paid = false WHERE school_id = v_school;
    INSERT INTO public.enrollments (school_id, child_id, team_id, status, expires_at)
    VALUES (v_school, v_child, v_team, 'active', v_old) RETURNING id INTO v_eid;
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date, payment_date,
                                 status, payment_type, period_year, period_month)
    VALUES (v_school, v_parent, v_child, 'SMOKE F-D proof off', 100000, v_old, current_date,
            'awaiting_approval', 'one_time', 2020, 2);
    PERFORM public.fn_expire_overdue_enrollments();
    SELECT status INTO v_status FROM public.enrollments WHERE id = v_eid;
    IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL 1f proof flag off: %', v_status; END IF;
    RAISE NOTICE 'OK 1f flag apagado → cancelada como hoy ✓';
END $$;

-- ── 2. apply_late_fees — hueco C ────────────────────────────────────────────
DO $$
DECLARE
    v_school uuid; v_child uuid; v_parent uuid;
    v_off uuid; v_on uuid; v_sib uuid; v_dup1 uuid; v_dup2 uuid;
    v_res jsonb; v_s text; v_fee numeric; v_old date := current_date - 60;
    v_old_ts timestamptz := now() - interval '60 days';
BEGIN
    SELECT school_id, child_id, parent_id INTO v_school, v_child, v_parent FROM _p;
    DELETE FROM public.payments WHERE concept LIKE 'SMOKE F-D%';

    -- 2a) flag apagado: el rechazado se queda rechazado.
    UPDATE public.school_settings SET pending_proof_counts_as_paid = false WHERE school_id = v_school;
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date, status,
                                 payment_type, period_year, period_month, created_at)
    VALUES (v_school, v_parent, v_child, 'SMOKE F-D rej off', 100000, v_old, 'rejected',
            'one_time', 2020, 3, v_old_ts) RETURNING id INTO v_off;
    v_res := public.apply_late_fees();
    SELECT status INTO v_s FROM public.payments WHERE id = v_off;
    IF v_s <> 'rejected' THEN RAISE EXCEPTION 'FAIL 2a flag off: %', v_s; END IF;
    IF (v_res->>'rejected_reopened')::int <> 0 AND NOT EXISTS (
        SELECT 1 FROM public.school_settings WHERE pending_proof_counts_as_paid AND school_id <> v_school) THEN
        RAISE EXCEPTION 'FAIL 2a reabrió algo sin ninguna escuela con flag: %', v_res;
    END IF;
    RAISE NOTICE 'OK 2a flag apagado → sigue rejected ✓ %', v_res;

    -- 2b) flag prendido: vencido + gracia → overdue (+ recargo si hay mora).
    UPDATE public.school_settings
    SET pending_proof_counts_as_paid = true, late_fee_enabled = true, late_fee_percentage = 10
    WHERE school_id = v_school;
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date, status,
                                 payment_type, period_year, period_month, created_at)
    VALUES (v_school, v_parent, v_child, 'SMOKE F-D rej on', 100000, v_old, 'rejected',
            'one_time', 2020, 4, v_old_ts) RETURNING id INTO v_on;

    -- 2c) con hermano activo del mismo periodo → NO se reabre.
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date, status,
                                 payment_type, period_year, period_month, created_at)
    VALUES (v_school, v_parent, v_child, 'SMOKE F-D rej sib', 100000, v_old, 'rejected',
            'one_time', 2020, 5, v_old_ts) RETURNING id INTO v_sib;
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date, status,
                                 payment_type, period_year, period_month)
    VALUES (v_school, v_parent, v_child, 'SMOKE F-D re-subido', 100000, v_old, 'awaiting_approval',
            'one_time', 2020, 5);

    -- 2d) dos rechazados del mismo periodo sin hermano: uno se reabre, el otro
    --     choca con el índice único y se SALTA sin tumbar el cron.
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date, status,
                                 payment_type, period_year, period_month, created_at)
    VALUES (v_school, v_parent, v_child, 'SMOKE F-D dup1', 100000, v_old, 'rejected',
            'one_time', 2020, 6, v_old_ts) RETURNING id INTO v_dup1;
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date, status,
                                 payment_type, period_year, period_month, created_at)
    VALUES (v_school, v_parent, v_child, 'SMOKE F-D dup2', 100000, v_old, 'rejected',
            'one_time', 2020, 6, v_old_ts + interval '1 minute') RETURNING id INTO v_dup2;

    v_res := public.apply_late_fees();

    SELECT status INTO v_s FROM public.payments WHERE id = v_on;
    IF v_s <> 'overdue' THEN RAISE EXCEPTION 'FAIL 2b flag on: %', v_s; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.payments
                   WHERE id = v_on AND late_fee_amount = 10000 AND amount = 110000
                     AND late_fee_applied_at IS NOT NULL) THEN
        RAISE EXCEPTION 'FAIL 2b: recargo del 10%% no aplicado al reabrir';
    END IF;
    RAISE NOTICE 'OK 2b flag prendido → overdue ✓';

    SELECT status INTO v_s FROM public.payments WHERE id = v_sib;
    IF v_s <> 'rejected' THEN RAISE EXCEPTION 'FAIL 2c hermano: %', v_s; END IF;
    RAISE NOTICE 'OK 2c con re-subida en otra fila → sigue rejected ✓';

    IF (SELECT count(*) FROM public.payments WHERE id IN (v_dup1, v_dup2) AND status = 'overdue') <> 1 THEN
        RAISE EXCEPTION 'FAIL 2d: esperaba exactamente 1 reabierto de los 2 duplicados';
    END IF;
    IF (v_res->>'rejected_reopen_skipped')::int < 1 THEN RAISE EXCEPTION 'FAIL 2d skipped: %', v_res; END IF;
    RAISE NOTICE 'OK 2d choque de índice único → se salta sin abortar ✓ %', v_res;

    -- 2e) idempotencia: una segunda corrida no vuelve a cobrar recargo.
    v_fee := (SELECT late_fee_amount FROM public.payments WHERE id = v_on);
    PERFORM public.apply_late_fees();
    IF (SELECT late_fee_amount FROM public.payments WHERE id = v_on) <> v_fee THEN
        RAISE EXCEPTION 'FAIL 2e: la segunda corrida cambió el recargo';
    END IF;
    RAISE NOTICE 'OK 2e segunda corrida idempotente ✓';
END $$;

-- ── 3. Permisos: solo service_role ──────────────────────────────────────────
DO $$
BEGIN
    IF has_function_privilege('authenticated', 'public.enrollment_has_pending_proof(uuid)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.enrollment_has_pending_proof(uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.payment_has_pending_proof(uuid)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.payment_has_pending_proof(uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.fn_expire_overdue_enrollments()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.apply_late_fees()', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL grants: authenticated/anon con EXECUTE';
    END IF;
    IF NOT has_function_privilege('service_role', 'public.enrollment_has_pending_proof(uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL grants: service_role sin EXECUTE';
    END IF;
    RAISE NOTICE 'OK grants solo service_role ✓';
END $$;

ROLLBACK;  -- no persistir nada del smoke
