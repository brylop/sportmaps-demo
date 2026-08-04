-- ============================================================
-- SPORTMAPS — Despachador Unificado de Notificaciones · F0 (3/4)
-- Spec: docs/specs/notifications-unified.md §4, §5, D4, D7
-- ------------------------------------------------------------
-- Trigger AFTER INSERT en notifications:
--   1. SIEMPRE encola 1 fila durable en el outbox (idempotente).
--   2. Best-effort: si dispatch_enabled, dispara pg_net al BFF (<2s) con el
--      secreto leído de Vault. NUNCA rompe la tx del productor (envuelto en
--      EXCEPTION). El worker (F1) es la red de seguridad.
--
-- Transaccionalidad: pg_net encola tras el COMMIT; si la tx del productor hace
-- ROLLBACK, ni el outbox ni el POST se materializan (ambos viven en la misma tx).
-- Fecha: 2026-07-22
-- ============================================================

CREATE OR REPLACE FUNCTION public.enqueue_notification_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_enabled bool;
    v_url     text;
    v_secret  text;
BEGIN
    -- 1) Durable SIEMPRE (idempotente por UNIQUE(notification_id)).
    INSERT INTO public.notification_deliveries (notification_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT (notification_id) DO NOTHING;

    -- 2) Acelerador best-effort. Cualquier fallo aquí NO debe abortar el INSERT
    --    del productor (p.ej. aprobación de un pago). El worker reintenta.
    BEGIN
        SELECT dispatch_enabled, bff_dispatch_url
          INTO v_enabled, v_url
          FROM public.notification_settings
         WHERE id = true;

        IF COALESCE(v_enabled, false) AND v_url IS NOT NULL THEN
            SELECT decrypted_secret
              INTO v_secret
              FROM vault.decrypted_secrets
             WHERE name = 'notif_dispatch_secret';

            IF v_secret IS NOT NULL THEN
                PERFORM net.http_post(
                    url     := v_url,
                    body    := jsonb_build_object('notification_id', NEW.id),
                    headers := jsonb_build_object(
                                 'Content-Type',  'application/json',
                                 'x-notif-secret', v_secret
                               ),
                    timeout_milliseconds := 5000
                );
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notif] dispatch best-effort falló (worker lo cubrirá): %', SQLERRM;
    END;

    RETURN NULL;  -- AFTER trigger: valor de retorno ignorado.
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_notification_delivery ON public.notifications;
CREATE TRIGGER trg_enqueue_notification_delivery
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.enqueue_notification_delivery();

NOTIFY pgrst, 'reload schema';
