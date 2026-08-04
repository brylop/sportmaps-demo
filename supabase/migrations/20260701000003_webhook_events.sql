-- ============================================================
-- SPORTMAPS — Fix H-03/H-04 (auditoria de duplicacion de pagos)
--
-- Problema:
--  H-03: un webhook que llega ANTES de que exista el registro local se
--        responde 200 "ignored" y la pasarela no reintenta -> confirmacion
--        perdida -> el usuario re-paga.
--  H-04: no hay dedup persistente de eventos ni base para conciliacion.
--
-- Solucion: log persistente de eventos de webhook, con dedup por
-- (provider, event_id) y estado que habilita reproceso de huerfanos y
-- conciliacion posterior. El handler registra el evento ANTES de procesar;
-- si la entidad local aun no existe, marca 'orphan' (no lo pierde) y un
-- cron de reproceso lo reintenta.
--
-- Solo service_role escribe/lee (los webhooks corren con service role).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider      text        NOT NULL,          -- 'wompi' | 'mercadopago' | 'epayco'
    event_id      text        NOT NULL,          -- id estable del evento (txId:status, x-request-id, etc)
    reference     text,                           -- reference de la tx para correlacion/conciliacion
    event_type    text,
    status        text        NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received','processed','orphan','failed','ignored')),
    attempts      integer     NOT NULL DEFAULT 0,
    last_error    text,
    next_retry_at timestamptz,
    payload       jsonb,
    processed_at  timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    -- Dedup real de eventos, independiente de las tablas de entidad.
    UNIQUE (provider, event_id)
);

-- Reproceso: buscar huerfanos/fallidos elegibles por reintento.
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry
    ON public.webhook_events (next_retry_at)
    WHERE status IN ('orphan', 'failed');

-- Conciliacion / soporte: buscar por referencia.
CREATE INDEX IF NOT EXISTS idx_webhook_events_reference
    ON public.webhook_events (reference)
    WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_status
    ON public.webhook_events (provider, status);

-- Trigger updated_at (si existe el helper estandar del proyecto).
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_webhook_events_updated_at ON public.webhook_events';
        EXECUTE 'CREATE TRIGGER trg_webhook_events_updated_at BEFORE UPDATE ON public.webhook_events
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Sin policies para authenticated/anon: solo service_role (que bypassea RLS)
-- escribe y lee. Los webhooks nunca corren en contexto de usuario.

COMMENT ON TABLE public.webhook_events IS
    'Fix H-03/H-04: log persistente de eventos de webhook de pasarelas. Dedup por (provider,event_id); status orphan habilita reproceso; base de conciliacion.';
