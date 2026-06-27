-- ════════════════════════════════════════════════════════════════════════════
-- adms_device_log — tráfico crudo del protocolo ADMS (para vista super-admin)
-- ════════════════════════════════════════════════════════════════════════════
-- Reemplaza el debug.log en disco (efímero, sin auth) por una tabla consultable.
-- Captura eventos de PROTOCOLO de bajo volumen (handshake, batches ATTLOG,
-- getrequest, devicecmd, errores) — NO cada PIN (eso ya está en access_events).
-- Se expone solo vía endpoint super-admin (BFF service_role); RLS bloquea acceso
-- directo por PostgREST.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.adms_device_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id   uuid,
  sn          text,
  event_type  text NOT NULL,            -- handshake | attlog_batch | getrequest | devicecmd | operlog | error
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adms_device_log_created_idx
  ON public.adms_device_log (created_at DESC);

CREATE INDEX IF NOT EXISTS adms_device_log_sn_created_idx
  ON public.adms_device_log (sn, created_at DESC);

-- RLS: nadie por PostgREST directo. El BFF (service_role) bypassa y es el único
-- que escribe/lee. Sin policy para authenticated => acceso denegado vía API REST.
ALTER TABLE public.adms_device_log ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
