-- ============================================================
-- SPORTMAPS — Despachador Unificado de Notificaciones · F0 (1/4)
-- Spec: docs/specs/notifications-unified.md §5
-- ------------------------------------------------------------
-- Columnas `category` + `data` en notifications, backfill CONSERVADOR
-- (solo clasifica lo certero por link; lo dudoso queda NULL) e índices
-- para la campana y para el filtro del Modo Recepción (F-R, por school_id).
-- Aditivo e idempotente. No toca RLS de notifications (own-row ya existente).
-- Fecha: 2026-07-22
-- ============================================================

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS category text
        CHECK (category IN (
            'payment','installment','glosa','enrollment',
            'access','qr','marketplace','equipment','system'
        )),
    ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.notifications.category IS
    'Categoría normalizada (canal/presentación). NULL = sin clasificar (pre-F5). El dispatcher (F1) y el Modo Recepción (F-R) mapean category→canal/animación.';
COMMENT ON COLUMN public.notifications.data IS
    'Metadata estructurada para push/recepción (payer_name, athlete_name, amount, concept, school_id, sede_id...). Nunca parsear `message`; leer siempre de aquí.';

-- ── Backfill CONSERVADOR ────────────────────────────────────────────────────
-- Solo se clasifica lo que el link identifica con certeza. Todo lo demás queda
-- NULL a propósito (se clasificará explícito desde F5 por cada productor).
UPDATE public.notifications
   SET category = 'payment'
 WHERE category IS NULL
   AND link IN ('/my-payments', '/payments-automation');

UPDATE public.notifications
   SET category = 'glosa'
 WHERE category IS NULL
   AND link ILIKE '%glosa%';

-- ── Índices ─────────────────────────────────────────────────────────────────
-- Campana: no-leídas del usuario, recientes primero.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, read, created_at DESC);

-- Modo Recepción (F-R): admin filtra sus notificaciones por escuela (data.school_id).
CREATE INDEX IF NOT EXISTS idx_notifications_data_school
    ON public.notifications (user_id, (data->>'school_id'))
    WHERE data ? 'school_id';

NOTIFY pgrst, 'reload schema';
