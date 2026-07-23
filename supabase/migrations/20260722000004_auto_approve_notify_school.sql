-- ============================================================
-- SPORTMAPS — Despachador Unificado de Notificaciones · F0 (4/4)
-- Spec: docs/specs/notifications-unified.md §11.2 (adelanto caso escuela)
-- ------------------------------------------------------------
-- Prerequisito del Modo Recepción (F-R): la tablet está logueada como admin y
-- por RLS solo ve SUS notificaciones. Hoy los eventos de dinero solo notifican
-- al PADRE → la recepción no tiene qué anunciar. Aquí:
--   • notify_school_staff: notifica al owner + admins activos de la sede.
--   • payment_notif_data:  arma `data` con nombres completos (la discreción es
--     de PRESENTACIÓN, no de datos → decisión (2) del plan).
--   • auto_approve_payment y resolve_glosa: notifican también al staff, con
--     category + data poblado. sede_id = NULL por ahora (branch real luego);
--     data siempre lleva school_id (F-R filtra por school_id) → decisión (3).
--   • _glosa_notify: se le agrega category='glosa' (misma firma → beneficia a
--     todos sus callers existentes sin tocarlos).
--
-- Migraciones inmutables: esto REEMPLAZA funciones vía CREATE OR REPLACE en una
-- migración nueva; no se edita ninguna migración previa.
-- Fecha: 2026-07-22
-- ============================================================

-- ── Helper: arma el `data` de un evento de dinero ───────────────────────────
CREATE OR REPLACE FUNCTION public._payment_notif_data(
    p_parent_id uuid,
    p_child_id  uuid,
    p_team_id   uuid,
    p_school_id uuid,
    p_amount    numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_payer   text;
    v_athlete text;
    v_concept text;
BEGIN
    SELECT full_name INTO v_payer   FROM public.profiles WHERE id = p_parent_id;

    IF p_child_id IS NOT NULL THEN
        SELECT full_name INTO v_athlete FROM public.children WHERE id = p_child_id;
    ELSE
        v_athlete := v_payer;  -- atleta adulto = el propio titular
    END IF;

    IF p_team_id IS NOT NULL THEN
        SELECT name INTO v_concept FROM public.teams WHERE id = p_team_id;
    END IF;

    RETURN jsonb_build_object(
        'payer_name',   v_payer,
        'athlete_name', v_athlete,
        'amount',       p_amount,
        'concept',      COALESCE(v_concept, 'Mensualidad'),
        'school_id',    p_school_id,
        'sede_id',      NULL   -- branch real en fase posterior; F-R filtra por school_id
    );
END;
$$;
REVOKE ALL ON FUNCTION public._payment_notif_data(uuid, uuid, uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._payment_notif_data(uuid, uuid, uuid, uuid, numeric) TO service_role;

-- ── Helper: notifica al owner + admins activos de una escuela ───────────────
-- INSERT directo (headless: no depende de auth.uid()). Cada fila dispara el
-- trigger de outbox individualmente (cada staff = su propio delivery).
CREATE OR REPLACE FUNCTION public._notify_school_staff(
    p_school_id uuid,
    p_category  text,
    p_type      text,
    p_title     text,
    p_message   text,
    p_link      text,
    p_data      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF p_school_id IS NULL THEN RETURN; END IF;

    INSERT INTO public.notifications
        (user_id, school_id, title, message, type, link, category, data)
    SELECT staff_id, p_school_id, p_title, p_message, p_type, p_link,
           p_category, COALESCE(p_data, '{}'::jsonb)
    FROM (
        SELECT owner_id AS staff_id
          FROM public.schools
         WHERE id = p_school_id AND owner_id IS NOT NULL
        UNION
        SELECT profile_id
          FROM public.school_members
         WHERE school_id = p_school_id
           AND role IN ('owner', 'admin')
           AND status = 'active'
           AND profile_id IS NOT NULL
    ) s
    WHERE s.staff_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._notify_school_staff(uuid, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._notify_school_staff(uuid, text, text, text, text, text, jsonb) TO service_role;

-- ── _glosa_notify: clasifica category='glosa' (misma firma) ─────────────────
-- Beneficia a create_glosa y a los crons de recordatorio sin tocarlos.
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
    INSERT INTO public.notifications (user_id, school_id, title, message, type, link, category)
    VALUES (p_user_id, p_school_id, p_title, p_message, 'glosa', p_link, 'glosa');
END;
$$;
REVOKE ALL ON FUNCTION public._glosa_notify(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._glosa_notify(uuid, uuid, text, text, text) TO service_role;

-- ── auto_approve_payment: + notifica staff + category/data ──────────────────
-- Reproduce 20260721000001 con: parent notif ahora con category='payment'+data,
-- y notificación al owner/admins de la sede.
CREATE OR REPLACE FUNCTION public.auto_approve_payment(p_payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_status    text;
    v_parent_id uuid;
    v_child_id  uuid;
    v_team_id   uuid;
    v_amount    numeric;
    v_discount  numeric;
    v_paid      numeric;
    v_data      jsonb;
BEGIN
    SELECT school_id, status, parent_id, child_id, team_id, amount,
           COALESCE(early_payment_discount_applied, 0)
    INTO v_school_id, v_status, v_parent_id, v_child_id, v_team_id, v_amount, v_discount
    FROM public.payments WHERE id = p_payment_id;

    IF v_school_id IS NULL THEN RETURN false; END IF;
    IF v_status <> 'awaiting_approval' THEN RETURN false; END IF;  -- idempotente / no pisa al admin

    v_paid := v_amount - v_discount;

    UPDATE public.payments
    SET status = 'paid',
        approved_by = NULL,                       -- sistema
        approved_at = now(),
        amount_paid = v_paid,
        reconciliation_status = 'pendiente',
        updated_at = now()
    WHERE id = p_payment_id AND status = 'awaiting_approval';

    UPDATE public.enrollments
    SET status = 'active', updated_at = now()
    WHERE school_id = v_school_id
      AND status = 'pending'
      AND (
            (v_child_id IS NOT NULL AND child_id = v_child_id)
         OR (v_child_id IS NULL AND v_parent_id IS NOT NULL AND user_id = v_parent_id)
      )
      AND (v_team_id IS NULL OR team_id = v_team_id);

    v_data := public._payment_notif_data(v_parent_id, v_child_id, v_team_id, v_school_id, v_paid);

    -- Notificación al PADRE (con category + data).
    IF v_parent_id IS NOT NULL THEN
        INSERT INTO public.notifications
            (user_id, school_id, title, message, type, link, category, data)
        VALUES (v_parent_id, v_school_id, 'Pago aprobado',
                'Validamos tu comprobante automáticamente y tu pago quedó aprobado. ¡Gracias!',
                'success', '/my-payments', 'payment', v_data);
    END IF;

    -- Notificación al STAFF de la sede (prerequisito Modo Recepción).
    PERFORM public._notify_school_staff(
        v_school_id, 'payment', 'success',
        'Pago recibido',
        format('Pago aprobado automáticamente: %s (%s)',
               v_data->>'payer_name', v_data->>'concept'),
        '/payments-automation',
        v_data
    );

    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.auto_approve_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_approve_payment(uuid) TO service_role;

-- ── resolve_glosa: + notifica staff + category/data ─────────────────────────
-- Reproduce 20260721000001 con: notificaciones al padre vía INSERT directo con
-- category='glosa' + data, y notificación al staff de la sede.
CREATE OR REPLACE FUNCTION public.resolve_glosa(
    p_actor           uuid,
    p_glosa_id        uuid,
    p_outcome         text,
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
    v_paid       numeric;
    v_data       jsonb;
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

    v_paid := v_amount - v_discount;
    v_data := public._payment_notif_data(v_parent_id, v_child_id, v_team_id, v_school_id, v_paid);

    IF p_outcome = 'ACEPTADA' THEN
        UPDATE public.payments
        SET status = 'paid',
            approved_by = p_actor,
            approved_at = now(),
            amount_paid = v_paid,
            reconciliation_status = 'pendiente',
            updated_at = now()
        WHERE id = v_payment_id;

        UPDATE public.enrollments
        SET status = 'active', updated_at = now()
        WHERE school_id = v_school_id
          AND status = 'pending'
          AND (
                (v_child_id IS NOT NULL AND child_id = v_child_id)
             OR (v_child_id IS NULL AND v_parent_id IS NOT NULL AND user_id = v_parent_id)
          )
          AND (v_team_id IS NULL OR team_id = v_team_id);

        -- PADRE (category='glosa' + data).
        IF v_parent_id IS NOT NULL THEN
            INSERT INTO public.notifications
                (user_id, school_id, title, message, type, link, category, data)
            VALUES (v_parent_id, v_school_id, 'Pago aprobado',
                    'Revisamos tu aclaración y tu pago quedó aprobado. ¡Gracias!',
                    'glosa', '/my-payments', 'glosa', v_data);
        END IF;

        PERFORM public._notify_school_staff(
            v_school_id, 'glosa', 'success',
            'Revisión resuelta: pago aprobado',
            format('%s — %s', v_data->>'payer_name', v_data->>'concept'),
            '/payments-automation', v_data
        );
    ELSE  -- RATIFICADA
        UPDATE public.payments
        SET status = 'pending', updated_at = now()
        WHERE id = v_payment_id;

        IF v_parent_id IS NOT NULL THEN
            INSERT INTO public.notifications
                (user_id, school_id, title, message, type, link, category, data)
            VALUES (v_parent_id, v_school_id, 'Tu pago sigue pendiente',
                    'Revisamos tu aclaración pero el pago sigue pendiente. Comunícate con la escuela para regularizarlo.',
                    'glosa', '/my-payments', 'glosa', v_data);
        END IF;

        PERFORM public._notify_school_staff(
            v_school_id, 'glosa', 'warning',
            'Revisión ratificada: pago pendiente',
            format('%s — %s', v_data->>'payer_name', v_data->>'concept'),
            '/payments-automation', v_data
        );
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_glosa(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_glosa(uuid, uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
