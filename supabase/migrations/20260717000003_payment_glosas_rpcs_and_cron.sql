-- ============================================================
-- SPORTMAPS — Comprobantes v2, Fase 3: RPCs de glosa + job de vencimiento
-- Spec: docs/specs/receipt-extraction-v2-glosas.md §5
-- ------------------------------------------------------------
-- Máquina de estados de payment_glosas vía RPCs SECURITY DEFINER. Seguridad:
-- se otorgan SOLO a service_role y reciben p_actor uuid (el usuario ya validado
-- por el BFF). El BFF es el único caller ("BFF llama create_glosa") y autoriza
-- por p_actor — un cliente autenticado no puede invocarlos ni falsear p_actor.
--
-- Fechas "hoy" SIEMPRE en America/Bogota (nunca CURRENT_DATE, que es UTC).
-- payments.status es TEXT → literales pelados (sin cast a enum).
-- Fecha: 2026-07-17
-- ============================================================

-- Helper interno: ¿p_actor es admin (owner/admin) activo de la escuela? --------
CREATE OR REPLACE FUNCTION public._glosa_actor_is_admin(p_actor uuid, p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.school_members
        WHERE profile_id = p_actor
          AND school_id = p_school_id
          AND role IN ('owner', 'admin')
          AND status = 'active'
    ) OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_actor AND role IN ('admin', 'super_admin')
    );
$$;
REVOKE ALL ON FUNCTION public._glosa_actor_is_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._glosa_actor_is_admin(uuid, uuid) TO service_role;

-- Helper interno: notificación in-app (INSERT directo; notify_user no sirve
-- headless por su guard auth.uid()). ------------------------------------------
CREATE OR REPLACE FUNCTION public._glosa_notify(
    p_user_id uuid, p_school_id uuid, p_title text, p_message text, p_link text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL THEN RETURN; END IF;
    INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
    VALUES (p_user_id, p_school_id, p_title, p_message, 'glosa', p_link);
END;
$$;
REVOKE ALL ON FUNCTION public._glosa_notify(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._glosa_notify(uuid, uuid, text, text, text) TO service_role;

-- ── create_glosa ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_glosa(
    p_actor         uuid,
    p_payment_id    uuid,
    p_reason        text,
    p_reason_detail jsonb DEFAULT NULL,
    p_responds_by   date  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_today      date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_school_id  uuid;
    v_parent_id  uuid;
    v_days       int;
    v_glosa_id   uuid;
BEGIN
    SELECT p.school_id, p.parent_id INTO v_school_id, v_parent_id
    FROM public.payments p WHERE p.id = p_payment_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Pago no encontrado' USING ERRCODE = '02000';
    END IF;

    -- Autoriza: admin de la escuela, o p_actor NULL = creación de sistema
    -- (auto-glosa app-layer / cron). NUNCA un usuario que no sea admin.
    IF p_actor IS NOT NULL AND NOT public._glosa_actor_is_admin(p_actor, v_school_id) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(glosa_response_days, 5) INTO v_days
    FROM public.school_settings WHERE school_id = v_school_id;
    v_days := COALESCE(v_days, 5);

    INSERT INTO public.payment_glosas (
        school_id, payment_id, reason, reason_detail, status,
        responds_by, created_by
    ) VALUES (
        v_school_id, p_payment_id, p_reason, p_reason_detail, 'GLOSADA',
        COALESCE(p_responds_by, v_today + v_days), p_actor
    )
    RETURNING id INTO v_glosa_id;

    -- El pago sale de la cola de aprobación: pasa a 'glosado'.
    UPDATE public.payments SET status = 'glosado', updated_at = now()
    WHERE id = p_payment_id;

    -- Notificar al acudiente (lenguaje simple: nunca "GLOSADA").
    PERFORM public._glosa_notify(
        v_parent_id, v_school_id,
        'Tu comprobante necesita una aclaración',
        'Revisamos tu comprobante y necesitamos que aclares un detalle. Ábrelo para responder.',
        '/my-payments'
    );

    RETURN v_glosa_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_glosa(uuid, uuid, text, jsonb, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_glosa(uuid, uuid, text, jsonb, date) TO service_role;

-- ── respond_glosa (acudiente) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_glosa(
    p_actor         uuid,
    p_glosa_id      uuid,
    p_response_text text,
    p_response_files jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_owner_id  uuid;
    v_status    text;
    v_is_parent boolean;
BEGIN
    SELECT g.school_id, g.status,
           EXISTS (SELECT 1 FROM public.payments p
                   WHERE p.id = g.payment_id AND p.parent_id = p_actor)
    INTO v_school_id, v_status, v_is_parent
    FROM public.payment_glosas g WHERE g.id = p_glosa_id;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Glosa no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT v_is_parent THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_status NOT IN ('GLOSADA', 'EN_RESPUESTA') THEN
        RAISE EXCEPTION 'La glosa no admite respuesta en su estado actual (%)', v_status
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.payment_glosas
    SET status = 'EN_RESPUESTA',
        response_text = p_response_text,
        response_files = COALESCE(p_response_files, response_files),
        responded_at = now(),
        updated_at = now()
    WHERE id = p_glosa_id;

    -- Notificar al owner de la escuela (queda lista para conciliar).
    SELECT owner_id INTO v_owner_id FROM public.schools WHERE id = v_school_id;
    PERFORM public._glosa_notify(
        v_owner_id, v_school_id,
        'Aclaración recibida',
        'Un acudiente respondió una aclaración de comprobante. Ya puedes conciliarla.',
        '/payments-automation'
    );
END;
$$;
REVOKE ALL ON FUNCTION public.respond_glosa(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_glosa(uuid, uuid, text, jsonb) TO service_role;

-- ── conciliate_glosa (admin toma la glosa para revisar) ────────────────────
CREATE OR REPLACE FUNCTION public.conciliate_glosa(p_actor uuid, p_glosa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_status    text;
BEGIN
    SELECT school_id, status INTO v_school_id, v_status
    FROM public.payment_glosas WHERE id = p_glosa_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Glosa no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT public._glosa_actor_is_admin(p_actor, v_school_id) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_status <> 'EN_RESPUESTA' THEN
        RAISE EXCEPTION 'Solo se puede conciliar una glosa EN_RESPUESTA (actual: %)', v_status
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.payment_glosas
    SET status = 'EN_CONCILIACION', updated_at = now()
    WHERE id = p_glosa_id;
END;
$$;
REVOKE ALL ON FUNCTION public.conciliate_glosa(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conciliate_glosa(uuid, uuid) TO service_role;

-- ── resolve_glosa (admin: ACEPTADA | RATIFICADA) ───────────────────────────
-- ACEPTADA replica EXACTAMENTE la aprobación manual (paridad): campos del pago +
-- activación de enrollment. Lo contable (cash_ledger VIEW + trg_payment_fee_to_expense)
-- se dispara solo al pasar status='paid'.
CREATE OR REPLACE FUNCTION public.resolve_glosa(
    p_actor           uuid,
    p_glosa_id        uuid,
    p_outcome         text,      -- 'ACEPTADA' | 'RATIFICADA'
    p_resolution_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id  uuid;
    v_status     text;
    v_payment_id uuid;
    v_parent_id  uuid;
    v_child_id   uuid;
    v_team_id    uuid;
    v_amount     numeric;
    v_discount   numeric;
BEGIN
    IF p_outcome NOT IN ('ACEPTADA', 'RATIFICADA') THEN
        RAISE EXCEPTION 'Resultado inválido: %', p_outcome USING ERRCODE = '22023';
    END IF;
    IF p_resolution_note IS NULL OR btrim(p_resolution_note) = '' THEN
        RAISE EXCEPTION 'La nota de resolución es obligatoria' USING ERRCODE = '22023';
    END IF;

    SELECT g.school_id, g.status, g.payment_id
    INTO v_school_id, v_status, v_payment_id
    FROM public.payment_glosas g WHERE g.id = p_glosa_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Glosa no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT public._glosa_actor_is_admin(p_actor, v_school_id) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_status NOT IN ('GLOSADA', 'EN_RESPUESTA', 'EN_CONCILIACION') THEN
        RAISE EXCEPTION 'La glosa ya está resuelta (%)', v_status USING ERRCODE = '22023';
    END IF;

    UPDATE public.payment_glosas
    SET status = p_outcome, resolution_note = p_resolution_note,
        resolved_at = now(), resolved_by = p_actor, updated_at = now()
    WHERE id = p_glosa_id;

    SELECT parent_id, child_id, team_id, amount, COALESCE(early_payment_discount_applied, 0)
    INTO v_parent_id, v_child_id, v_team_id, v_amount, v_discount
    FROM public.payments WHERE id = v_payment_id;

    IF p_outcome = 'ACEPTADA' THEN
        -- Paridad con la aprobación manual (PaymentsAutomationPage.handleManualAction).
        UPDATE public.payments
        SET status = 'paid',
            approved_by = p_actor,
            approved_at = now(),
            amount_paid = v_amount - v_discount,
            updated_at = now()
        WHERE id = v_payment_id;

        -- Activar el enrollment asociado (mismo match que el front).
        UPDATE public.enrollments
        SET status = 'active', updated_at = now()
        WHERE school_id = v_school_id
          AND status = 'pending'
          AND (
                (v_child_id IS NOT NULL AND child_id = v_child_id)
             OR (v_child_id IS NULL AND v_parent_id IS NOT NULL AND user_id = v_parent_id)
          )
          AND (v_team_id IS NULL OR team_id = v_team_id);

        PERFORM public._glosa_notify(
            v_parent_id, v_school_id,
            'Pago aprobado',
            'Revisamos tu aclaración y tu pago quedó aprobado. ¡Gracias!',
            '/my-payments'
        );
    ELSE  -- RATIFICADA: el cobro se reactiva (vuelve a pending).
        UPDATE public.payments
        SET status = 'pending', updated_at = now()
        WHERE id = v_payment_id;

        PERFORM public._glosa_notify(
            v_parent_id, v_school_id,
            'Tu pago sigue pendiente',
            'Revisamos tu aclaración pero el pago sigue pendiente. Comunícate con la escuela para regularizarlo.',
            '/my-payments'
        );
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_glosa(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_glosa(uuid, uuid, text, text) TO service_role;

-- ── reopen_glosa (admin: reabrir una RATIFICADA) ───────────────────────────
CREATE OR REPLACE FUNCTION public.reopen_glosa(p_actor uuid, p_glosa_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id  uuid;
    v_status     text;
    v_payment_id uuid;
    v_parent_id  uuid;
    v_days       int;
    v_today      date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
    IF p_note IS NULL OR btrim(p_note) = '' THEN
        RAISE EXCEPTION 'La nota de reapertura es obligatoria' USING ERRCODE = '22023';
    END IF;
    SELECT school_id, status, payment_id INTO v_school_id, v_status, v_payment_id
    FROM public.payment_glosas WHERE id = p_glosa_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Glosa no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT public._glosa_actor_is_admin(p_actor, v_school_id) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_status <> 'RATIFICADA' THEN
        RAISE EXCEPTION 'Solo se puede reabrir una glosa RATIFICADA (actual: %)', v_status
            USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(glosa_response_days, 5) INTO v_days
    FROM public.school_settings WHERE school_id = v_school_id;

    UPDATE public.payment_glosas
    SET status = 'GLOSADA',
        responds_by = v_today + COALESCE(v_days, 5),
        resolution_note = p_note,
        resolved_at = NULL, resolved_by = NULL, responded_at = NULL,
        updated_at = now()
    WHERE id = p_glosa_id;

    UPDATE public.payments SET status = 'glosado', updated_at = now()
    WHERE id = v_payment_id;

    SELECT parent_id INTO v_parent_id FROM public.payments WHERE id = v_payment_id;
    PERFORM public._glosa_notify(
        v_parent_id, v_school_id,
        'Reabrimos tu aclaración',
        'Reabrimos la aclaración de tu comprobante. Ábrela para responder de nuevo.',
        '/my-payments'
    );
END;
$$;
REVOKE ALL ON FUNCTION public.reopen_glosa(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_glosa(uuid, uuid, text) TO service_role;

-- ── Job diario: ratificar glosas vencidas ──────────────────────────────────
-- "hoy" en Bogotá (fix día cortado): una glosa que vence HOY NO se ratifica; el
-- acudiente tiene todo su último día. Solo responds_by < hoy.
CREATE OR REPLACE FUNCTION public.ratify_expired_glosas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_count integer := 0;
BEGIN
    WITH candidates AS (
        SELECT g.id, g.payment_id, g.school_id,
               (SELECT p.parent_id FROM public.payments p WHERE p.id = g.payment_id) AS parent_id
        FROM public.payment_glosas g
        WHERE g.status = 'GLOSADA'
          AND g.responds_by < v_today
    ),
    upd_glosa AS (
        UPDATE public.payment_glosas g
        SET status = 'RATIFICADA', resolved_at = now(), updated_at = now()
        WHERE g.id IN (SELECT id FROM candidates)
        RETURNING g.id
    ),
    upd_pay AS (
        UPDATE public.payments p
        SET status = 'pending', updated_at = now()
        WHERE p.id IN (SELECT payment_id FROM candidates)
        RETURNING p.id
    ),
    ins_notif AS (
        INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
        SELECT c.parent_id, c.school_id,
               'Tu pago sigue pendiente',
               'No recibimos tu aclaración a tiempo, así que el pago sigue pendiente. Comunícate con la escuela para regularizarlo.',
               'glosa', '/my-payments'
        FROM candidates c
        WHERE c.parent_id IS NOT NULL
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM upd_glosa;

    RAISE NOTICE '[ratify_expired_glosas] fecha=% ratificadas=%', v_today, v_count;
    RETURN jsonb_build_object('run_date', v_today, 'ratified', v_count);
END;
$$;

COMMENT ON FUNCTION public.ratify_expired_glosas() IS
    'Ratifica glosas GLOSADA cuyo plazo (responds_by) ya pasó y reactiva el cobro. Ejecutado a diario por pg_cron.';
REVOKE ALL ON FUNCTION public.ratify_expired_glosas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ratify_expired_glosas() TO service_role;

-- ── Cron (idempotente, staggered tras late-fees 07:00 UTC) ─────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
    PERFORM cron.unschedule('ratify-expired-glosas-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
    'ratify-expired-glosas-daily',
    '0 8 * * *',
    $cron$ SELECT public.ratify_expired_glosas(); $cron$
);

NOTIFY pgrst, 'reload schema';
