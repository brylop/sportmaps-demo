-- =============================================================================
-- 20260826220634_bridge_heartbeats.sql
-- Autor: judegor99   Fecha: 2026-08-26   Versión anterior: 20260826190435
-- Objetivo: registrar el último sondeo exitoso de cada bridge local (ej.
--   scripts/gymrm-door-bridge/), para poder avisar al owner si deja de
--   responder (PC apagada, red caída) en vez de que nadie se entere hasta
--   que alguien intente abrir la puerta y falle en silencio.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- Sin RLS: esta tabla solo la toca el BFF con el service role (el endpoint
-- /bridge/door-commands ya se autentica con X-Bridge-Api-Key, no con sesión
-- de usuario, y el cron de chequeo corre server-side). No se expone al cliente.
CREATE TABLE IF NOT EXISTS public.bridge_heartbeats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL,
  bridge_name   text NOT NULL,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  -- NULL = sano o nunca alertado. Se sella al mandar el aviso de "bridge caído"
  -- para no repetir la notificación en cada corrida del cron mientras siga
  -- caído; se vuelve a poner NULL en el próximo latido exitoso (ver
  -- bridge.routes.ts), así que una recuperación y una caída nueva sí alertan.
  alerted_at    timestamptz,
  UNIQUE (school_id, bridge_name)
);

COMMENT ON TABLE public.bridge_heartbeats IS
  'Último sondeo exitoso de cada bridge local (pyzk u otro) por escuela. '
  'Alimentada por GET /bridge/door-commands en cada llamada exitosa. Un cron '
  'del BFF (bridge-heartbeat-check.job.ts) revisa last_seen_at vencido y '
  'notifica al owner una sola vez por caída.';

COMMIT;
