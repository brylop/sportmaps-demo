-- ============================================================
-- SPORTMAPS — Notificaciones · Pago por pasarela → notificar al staff
-- Spec: docs/specs/notifications-unified.md §11.2 (caso escuela) + F5 (sweep)
-- ------------------------------------------------------------
-- GAP detectado: los pagos aprobados por webhook de Wompi/MercadoPago marcan el
-- payment como 'paid' pero NO notificaban al owner/admins de la escuela → el
-- Modo Recepción (F-R) no tenía qué anunciar en pagos por pasarela.
--
-- Este RPC replica el "caso escuela" de auto_approve_payment (mig 000004) para
-- la ruta de pasarela: arma `data` con nombres reales y notifica al staff con
-- category='payment' → dispara el trigger de outbox (F1) y el Realtime (F-R).
--
-- Idempotencia: los webhooks ya cortan por payment_splits antes de llegar al
-- bloque 'paid', así que este RPC se invoca una sola vez por pago.
-- Reusa helpers existentes: _payment_notif_data y _notify_school_staff (mig 000004).
-- Fecha: 2026-07-23
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_school_payment_paid(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_parent_id uuid;
    v_child_id  uuid;
    v_team_id   uuid;
    v_amount    numeric;
    v_discount  numeric;
    v_paid      numeric;
    v_data      jsonb;
BEGIN
    SELECT school_id, parent_id, child_id, team_id, amount,
           COALESCE(early_payment_discount_applied, 0),
           COALESCE(amount_paid, amount)
    INTO v_school_id, v_parent_id, v_child_id, v_team_id, v_amount, v_discount, v_paid
    FROM public.payments
    WHERE id = p_payment_id;

    IF v_school_id IS NULL THEN RETURN; END IF;

    v_data := public._payment_notif_data(v_parent_id, v_child_id, v_team_id, v_school_id, v_paid);

    -- Notifica al owner + admins activos (dispara outbox + Realtime → Recepción).
    PERFORM public._notify_school_staff(
        v_school_id, 'payment', 'success',
        'Pago recibido',
        format('Pago en línea aprobado: %s (%s)',
               v_data->>'payer_name', v_data->>'concept'),
        '/payments-automation',
        v_data
    );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_school_payment_paid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_school_payment_paid(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
