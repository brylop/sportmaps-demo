-- ============================================================
-- SPORTMAPS — Despachador Unificado de Notificaciones · F0 (2/4)
-- Spec: docs/specs/notifications-unified.md §5, §10
-- ------------------------------------------------------------
-- Outbox durable `notification_deliveries` (1 fila por notificación) +
-- config no-secreta `notification_settings` (flag + URL del BFF).
-- RLS deny-all en ambas: SOLO el BFF con service_role (bypass RLS) opera.
-- El SECRETO del endpoint va en Vault (D7), nunca aquí ni en el SQL.
-- Fecha: 2026-07-22
-- ============================================================

-- ── Helper de updated_at (reusable por ambas tablas) ────────────────────────
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- ── Outbox ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UNIQUE = idempotencia: como mucho 1 delivery por notificación.
    notification_id  uuid NOT NULL UNIQUE
                       REFERENCES public.notifications(id) ON DELETE CASCADE,
    user_id          uuid NOT NULL,
    status           text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','sent','failed','skipped')),
    attempts         int  NOT NULL DEFAULT 0,
    max_attempts     int  NOT NULL DEFAULT 5,
    next_attempt_at  timestamptz NOT NULL DEFAULT now(),
    -- Métricas por canal (las llena el dispatcher en F1).
    web_sent         int  NOT NULL DEFAULT 0,
    web_failed       int  NOT NULL DEFAULT 0,
    native_sent      int  NOT NULL DEFAULT 0,
    native_failed    int  NOT NULL DEFAULT 0,
    revoked          int  NOT NULL DEFAULT 0,
    last_error       text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Drenaje del worker (F1): pendientes/fallidos por vencer.
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_drain
    ON public.notification_deliveries (status, next_attempt_at)
    WHERE status IN ('pending','failed');

DROP TRIGGER IF EXISTS trg_notif_deliveries_touch ON public.notification_deliveries;
CREATE TRIGGER trg_notif_deliveries_touch
    BEFORE UPDATE ON public.notification_deliveries
    FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- RLS: deny-all. ENABLE (NO force) + sin policies + REVOKE. Así:
--   • authenticated/anon → 0 filas (sin policy) y sin privilegio de tabla (revoke).
--   • service_role → bypass RLS (BYPASSRLS): el BFF opera el outbox en F1.
--   • el trigger SECURITY DEFINER (owner) inserta aquí; con RLS SIN force el
--     owner no queda sujeto a policies → el enqueue funciona. NO usar FORCE:
--     forzaría RLS al owner y bloquearía el INSERT del trigger.
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_deliveries FROM PUBLIC, authenticated, anon;

-- ── Config no-secreta (singleton) ───────────────────────────────────────────
-- id boolean = true fuerza fila única. F0 despliega con dispatch_enabled=false
-- (INERTE: el trigger solo encola en el outbox, NO llama pg_net). En F1 se
-- flipa a true y se setea bff_dispatch_url.
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id               boolean PRIMARY KEY DEFAULT true CHECK (id),
    dispatch_enabled boolean NOT NULL DEFAULT false,
    bff_dispatch_url text,
    updated_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.notification_settings (id, dispatch_enabled)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_notif_settings_touch ON public.notification_settings;
CREATE TRIGGER trg_notif_settings_touch
    BEFORE UPDATE ON public.notification_settings
    FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Mismo criterio que el outbox: ENABLE sin FORCE (el trigger owner debe poder
-- SELECT dispatch_enabled/url). service_role bypassa; authenticated/anon fuera.
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_settings FROM PUBLIC, authenticated, anon;

NOTIFY pgrst, 'reload schema';
