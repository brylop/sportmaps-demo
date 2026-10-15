-- =============================================================================
-- 20261014105210_adms_getrequest_rpc.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014105158
-- Objetivo: colapsar en UNA llamada las tres que hace cada sondeo de
--   GET /iclock/getrequest (los ZKTeco preguntan cada ~10 s):
--     1. PATCH turnstile_devices.last_seen_at      (~1,4 M llamadas)
--     2. SELECT device_commands pendientes          (~860 k)
--     3. PATCH device_commands → 'expired'          (~525 k)
--   public.adms_poll() hace las tres en una transacción y devuelve los
--   comandos pendientes, con la MISMA semántica que el camino viejo:
--     · pendientes = device_id, status='pending', expires_at > now(),
--       ORDER BY issued_at ASC, LIMIT p_limit (5 desde el BFF).
--     · p_exclude_types: el BFF manda ['open_door'] cuando el lector tiene
--       bridge local (has_local_bridge) — ese comando lo ejecuta
--       GET /bridge/door-commands; si saliera por ADMS el F22ID lo marcaría
--       'executed' en falso (VALIDACION-2026-08-25.md, hallazgo 1).
--     · expirar = device_id, status='pending', expires_at < now().
--   Diferencia deliberada: last_seen_at solo se escribe si tiene más de 30 s
--   (o es NULL). Lectores: AccessControlPage (en línea = < 5 min) y
--   alert_offline_access_devices() (15 min). 30 s no cambia ninguno y quita
--   ~2/3 de las escrituras del sondeo.
--   Solo la llama el BFF (service_role). Si no está aplicada, el BFF cae al
--   camino viejo de tres llamadas (PGRST202 / 42883), así que el orden de
--   despliegue código/migración no importa.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.adms_poll(
  p_device_id     uuid,
  p_limit         int    DEFAULT 5,
  p_exclude_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  cmd_seq      bigint,
  command_type text,
  metadata     jsonb
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- 1. Latido (throttled a 30 s).
  UPDATE public.turnstile_devices td
     SET last_seen_at = now()
   WHERE td.id = p_device_id
     AND (td.last_seen_at IS NULL OR td.last_seen_at < now() - interval '30 seconds');

  -- 2. Expirar vencidos (mismo filtro que el PATCH viejo: estricto <).
  UPDATE public.device_commands dc
     SET status = 'expired'
   WHERE dc.device_id = p_device_id
     AND dc.status = 'pending'
     AND dc.expires_at < now();

  -- 3. Pendientes vigentes, en orden de emisión.
  RETURN QUERY
  SELECT dc.id, dc.cmd_seq, dc.command_type, dc.metadata
    FROM public.device_commands dc
   WHERE dc.device_id = p_device_id
     AND dc.status = 'pending'
     AND dc.expires_at > now()
     AND (p_exclude_types IS NULL OR NOT (dc.command_type = ANY (p_exclude_types)))
   ORDER BY dc.issued_at ASC
   LIMIT GREATEST(COALESCE(p_limit, 5), 0);
END;
$$;

COMMENT ON FUNCTION public.adms_poll(uuid, int, text[]) IS
  'Sondeo ADMS (GET /iclock/getrequest): latido last_seen_at (máx. 1 escritura/30 s), expira comandos vencidos y devuelve los pendientes. Solo service_role (BFF).';

REVOKE ALL ON FUNCTION public.adms_poll(uuid, int, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adms_poll(uuid, int, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.adms_poll(uuid, int, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.adms_poll(uuid, int, text[]) TO service_role;

COMMIT;
