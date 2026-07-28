-- ============================================================
-- SPORTMAPS — Despachador Unificado de Notificaciones · F1 (go-live)
-- Spec: docs/specs/notifications-unified.md §2 (#4), §10
-- ------------------------------------------------------------
-- ⚠️ APLICAR SOLO EN EL GO-LIVE DE F1, en la MISMA ventana que se enciende el
-- dispatcher (notification_settings.dispatch_enabled = true + envs en Render).
--
-- Motivo: existe un trigger legacy `trg_push_on_notification` (creado fuera del
-- repo, ACTIVO) que en cada INSERT a notifications hace POST a la Edge Function
-- `send-push-notification` (web push viejo, sin preferencias/nativo/reintentos/
-- limpieza de tokens). El despachador F1 lo reemplaza con creces. Si ambos quedan
-- activos a la vez → DOBLE web push. Por eso:
--   • NO aplicar antes de tener F1 desplegado y encendido (quedarías sin web push).
--   • NO dejar ambos activos (doble envío).
--
-- Se DESHABILITA (no se borra) para backout inmediato: si hay que revertir F1,
-- `ENABLE TRIGGER` restaura el mecanismo viejo sin perder nada.
--
-- La Edge Function `send-push-notification` se retira por separado, DESPUÉS de
-- validar F1 en prod (no en este deploy).
-- Fecha: 2026-07-22
-- ============================================================

ALTER TABLE public.notifications DISABLE TRIGGER trg_push_on_notification;

-- Backout (si hay que revertir F1):
--   ALTER TABLE public.notifications ENABLE TRIGGER trg_push_on_notification;
