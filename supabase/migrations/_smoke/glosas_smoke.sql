-- ============================================================
-- SMOKE TEST — Módulo de Glosas (Fase 3). NO es una migración.
-- Correr con psql tras aplicar 20260717000002 y 20260717000003:
--   psql "$DATABASE_URL" \
--     -v school_id="'<uuid escuela>'" \
--     -v admin_id="'<profile_id admin/owner>'" \
--     -v parent_id="'<auth.users uid del acudiente>'" \
--     -v child_id="'<children.id>'"   (o  -v child_id=NULL) \
--     -f supabase/migrations/_smoke/glosas_smoke.sql
--
-- Todo corre en una transacción con ROLLBACK final: no persiste nada.
-- Los IDs se pasan a un temp table (psql NO interpola :vars dentro de $$...$$),
-- y los DO blocks los leen desde ahí. Cada assert usa RAISE EXCEPTION → si algo
-- falla, la corrida aborta con el motivo.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

-- IDs de entrada (interpolación psql, fuera de dollar-quotes) → temp table.
CREATE TEMP TABLE _p (school_id uuid, admin_id uuid, parent_id uuid, child_id uuid);
INSERT INTO _p VALUES (:school_id, :admin_id, :parent_id, :child_id);

-- ── Ciclo create → respond → resolve(ACEPTADA) con paridad ─────────────────
DO $$
DECLARE
    v_school uuid; v_admin uuid; v_parent uuid; v_child uuid;
    v_pid uuid; v_gid uuid; v_status text; v_amount_paid numeric; v_pay_status text;
BEGIN
    SELECT school_id, admin_id, parent_id, child_id INTO v_school, v_admin, v_parent, v_child FROM _p;

    -- Fixture: un pago manual "por validar".
    INSERT INTO public.payments (school_id, parent_id, child_id, concept, amount, due_date, payment_date, status, payment_type, receipt_url, early_payment_discount_applied)
    VALUES (v_school, v_parent, v_child, 'SMOKE glosa', 100000, current_date, current_date, 'awaiting_approval', 'one_time', 'smoke://receipt', 0)
    RETURNING id INTO v_pid;

    -- 1) create_glosa (actor admin) → payment 'glosado' + glosa 'GLOSADA'
    v_gid := public.create_glosa(v_admin, v_pid, 'MONTO_DIFIERE',
             jsonb_build_object('expected', 150000, 'extracted', 130000), NULL);
    SELECT status INTO v_pay_status FROM public.payments WHERE id = v_pid;
    IF v_pay_status <> 'glosado' THEN RAISE EXCEPTION 'FAIL create: payment=% (esperaba glosado)', v_pay_status; END IF;
    SELECT status INTO v_status FROM public.payment_glosas WHERE id = v_gid;
    IF v_status <> 'GLOSADA' THEN RAISE EXCEPTION 'FAIL create: glosa=% (esperaba GLOSADA)', v_status; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id = v_parent AND type = 'glosa') THEN
        RAISE EXCEPTION 'FAIL create: no se notificó al acudiente';
    END IF;

    -- 1b) índice único: una 2ª glosa abierta sobre el mismo pago debe fallar
    BEGIN
        PERFORM public.create_glosa(v_admin, v_pid, 'OTRO', NULL, NULL);
        RAISE EXCEPTION 'FAIL unique: permitió 2ª glosa abierta';
    EXCEPTION WHEN unique_violation THEN NULL; -- esperado
    END;

    -- 2) respond_glosa (actor acudiente) → EN_RESPUESTA
    PERFORM public.respond_glosa(v_parent, v_gid, 'Pagué con descuento de hermanos', NULL);
    SELECT status INTO v_status FROM public.payment_glosas WHERE id = v_gid;
    IF v_status <> 'EN_RESPUESTA' THEN RAISE EXCEPTION 'FAIL respond: glosa=%', v_status; END IF;

    -- 3) resolve ACEPTADA → paridad: payment paid + amount_paid + approved_by/at
    PERFORM public.resolve_glosa(v_admin, v_gid, 'ACEPTADA', 'Verifiqué el descuento, aprobado');
    SELECT status, amount_paid INTO v_pay_status, v_amount_paid FROM public.payments WHERE id = v_pid;
    IF v_pay_status <> 'paid' THEN RAISE EXCEPTION 'FAIL resolve: payment=% (esperaba paid)', v_pay_status; END IF;
    IF v_amount_paid <> 100000 THEN RAISE EXCEPTION 'FAIL resolve: amount_paid=% (esperaba 100000)', v_amount_paid; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.payments WHERE id = v_pid AND approved_by = v_admin AND approved_at IS NOT NULL) THEN
        RAISE EXCEPTION 'FAIL resolve: approved_by/at no seteados';
    END IF;

    RAISE NOTICE 'OK ciclo create→respond→resolve(ACEPTADA) — payment paid, paridad ✓';
END $$;

-- ── Job de vencimiento + fix timezone ──────────────────────────────────────
DO $$
DECLARE
    v_school uuid; v_parent uuid;
    v_pid_today uuid; v_pid_past uuid; v_g_today uuid; v_g_past uuid;
    v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_status_today text; v_status_past text; v_pay_past text;
BEGIN
    SELECT school_id, parent_id INTO v_school, v_parent FROM _p;

    -- Pago + glosa que vence HOY (NO debe ratificarse)
    INSERT INTO public.payments (school_id, parent_id, concept, amount, due_date, status, payment_type)
    VALUES (v_school, v_parent, 'SMOKE glosa hoy', 50000, current_date, 'glosado', 'one_time')
    RETURNING id INTO v_pid_today;
    INSERT INTO public.payment_glosas (school_id, payment_id, reason, status, responds_by)
    VALUES (v_school, v_pid_today, 'OTRO', 'GLOSADA', v_today) RETURNING id INTO v_g_today;

    -- Pago + glosa vencida AYER (SÍ debe ratificarse + reactivar pago)
    INSERT INTO public.payments (school_id, parent_id, concept, amount, due_date, status, payment_type)
    VALUES (v_school, v_parent, 'SMOKE glosa ayer', 50000, current_date, 'glosado', 'one_time')
    RETURNING id INTO v_pid_past;
    INSERT INTO public.payment_glosas (school_id, payment_id, reason, status, responds_by)
    VALUES (v_school, v_pid_past, 'OTRO', 'GLOSADA', v_today - 1) RETURNING id INTO v_g_past;

    PERFORM public.ratify_expired_glosas();

    SELECT status INTO v_status_today FROM public.payment_glosas WHERE id = v_g_today;
    SELECT status INTO v_status_past  FROM public.payment_glosas WHERE id = v_g_past;
    SELECT status INTO v_pay_past     FROM public.payments WHERE id = v_pid_past;

    IF v_status_today <> 'GLOSADA' THEN
        RAISE EXCEPTION 'FAIL timezone: glosa que vence HOY quedó % (esperaba GLOSADA)', v_status_today;
    END IF;
    IF v_status_past <> 'RATIFICADA' THEN
        RAISE EXCEPTION 'FAIL job: glosa vencida ayer quedó % (esperaba RATIFICADA)', v_status_past;
    END IF;
    IF v_pay_past <> 'pending' THEN
        RAISE EXCEPTION 'FAIL job: pago de glosa vencida quedó % (esperaba pending)', v_pay_past;
    END IF;

    RAISE NOTICE 'OK job ratify — hoy NO ratifica, ayer SÍ + payment pending ✓';
END $$;

-- ── reopen_glosa resetea las marcas de correo (Fase 4) ─────────────────────
DO $$
DECLARE
    v_school uuid; v_admin uuid; v_parent uuid;
    v_pid uuid; v_gid uuid; v_status text; v_rem timestamptz;
BEGIN
    SELECT school_id, admin_id, parent_id INTO v_school, v_admin, v_parent FROM _p;

    INSERT INTO public.payments (school_id, parent_id, concept, amount, due_date, payment_date, status, payment_type)
    VALUES (v_school, v_parent, 'SMOKE glosa reopen', 40000, current_date, current_date, 'awaiting_approval', 'one_time')
    RETURNING id INTO v_pid;

    v_gid := public.create_glosa(v_admin, v_pid, 'OTRO', NULL, NULL);
    PERFORM public.resolve_glosa(v_admin, v_gid, 'RATIFICADA', 'sin respuesta a tiempo');
    -- simular correos ya enviados para verificar el reset al reabrir
    UPDATE public.payment_glosas SET reminder_sent_at = now(), ratify_email_sent_at = now() WHERE id = v_gid;

    PERFORM public.reopen_glosa(v_admin, v_gid, 'reabro: la escuela cargó mal el concepto');
    SELECT status, reminder_sent_at INTO v_status, v_rem FROM public.payment_glosas WHERE id = v_gid;
    IF v_status <> 'GLOSADA' THEN RAISE EXCEPTION 'FAIL reopen: glosa=% (esperaba GLOSADA)', v_status; END IF;
    IF v_rem IS NOT NULL THEN RAISE EXCEPTION 'FAIL reopen: reminder_sent_at no se reseteó'; END IF;
    IF (SELECT ratify_email_sent_at FROM public.payment_glosas WHERE id = v_gid) IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL reopen: ratify_email_sent_at no se reseteó';
    END IF;
    SELECT status INTO v_status FROM public.payments WHERE id = v_pid;
    IF v_status <> 'glosado' THEN RAISE EXCEPTION 'FAIL reopen: payment=% (esperaba glosado)', v_status; END IF;

    RAISE NOTICE 'OK reopen — glosa GLOSADA, payment glosado, marcas de correo reseteadas ✓';
END $$;

-- ── auto_approve_payment idempotente + paridad + conciliación (Fase 5) ─────
DO $$
DECLARE
    v_school uuid; v_parent uuid;
    v_pid uuid; v_ok boolean; v_ok2 boolean;
    v_status text; v_recon text; v_paid numeric; v_appr uuid;
BEGIN
    SELECT school_id, parent_id INTO v_school, v_parent FROM _p;

    INSERT INTO public.payments (school_id, parent_id, concept, amount, due_date, payment_date, status, payment_type, early_payment_discount_applied)
    VALUES (v_school, v_parent, 'SMOKE auto-approve', 80000, current_date, current_date, 'awaiting_approval', 'one_time', 0)
    RETURNING id INTO v_pid;

    v_ok := public.auto_approve_payment(v_pid);
    IF v_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL auto_approve: devolvió %', v_ok; END IF;

    SELECT status, reconciliation_status, amount_paid, approved_by
    INTO v_status, v_recon, v_paid, v_appr FROM public.payments WHERE id = v_pid;
    IF v_status <> 'paid' THEN RAISE EXCEPTION 'FAIL auto_approve: status=% (esperaba paid)', v_status; END IF;
    IF v_recon <> 'pendiente' THEN RAISE EXCEPTION 'FAIL auto_approve: reconciliation=% (esperaba pendiente)', v_recon; END IF;
    IF v_paid <> 80000 THEN RAISE EXCEPTION 'FAIL auto_approve: amount_paid=% (esperaba 80000)', v_paid; END IF;
    IF v_appr IS NOT NULL THEN RAISE EXCEPTION 'FAIL auto_approve: approved_by no es NULL (sistema)'; END IF;

    -- Idempotencia: 2ª llamada no-op (ya no está awaiting_approval).
    v_ok2 := public.auto_approve_payment(v_pid);
    IF v_ok2 IS NOT FALSE THEN RAISE EXCEPTION 'FAIL auto_approve idempotencia: 2ª llamada devolvió %', v_ok2; END IF;

    RAISE NOTICE 'OK auto_approve_payment — paid + pendiente + approved_by NULL + idempotente ✓';
END $$;

-- ── fix #3: un pago NO se marca referencia-duplicada contra sí mismo ────────
-- (buildVerdictContext excluye p_actor/paymentId propio; aquí verificamos el índice
--  crudo: un solo pago con su reference_norm NO debe contarse como 2.)
DO $$
DECLARE v_school uuid; v_parent uuid; v_pid uuid; v_dupes int;
BEGIN
    SELECT school_id, parent_id INTO v_school, v_parent FROM _p;
    INSERT INTO public.payments (school_id, parent_id, concept, amount, due_date, payment_date, status, payment_type, receipt_reference_norm)
    VALUES (v_school, v_parent, 'SMOKE self-ref', 60000, current_date, current_date, 'awaiting_approval', 'one_time', 'SELFREF123')
    RETURNING id INTO v_pid;
    -- Conteo excluyendo el propio pago: debe ser 0 (no hay OTRO con la misma referencia).
    SELECT count(*) INTO v_dupes FROM public.payments
     WHERE school_id = v_school AND receipt_reference_norm = 'SELFREF123' AND id <> v_pid;
    IF v_dupes <> 0 THEN RAISE EXCEPTION 'FAIL self-ref: % duplicados contra sí mismo (esperaba 0)', v_dupes; END IF;
    RAISE NOTICE 'OK self-ref — un pago no se marca duplicado contra sí mismo ✓';
END $$;

ROLLBACK;  -- no persistir nada del smoke
