-- =============================================================================
-- 20260827214123_dreamers_bridge_local_flag.sql
-- Autor: judegor99   Fecha: 2026-08-27   Versión anterior: 20260827195933
-- Objetivo: extender scripts/dreamers-bridge/dreamers_bridge.py (hoy solo
--   reenvía asistencia ATTLOG) para que también abra la puerta manualmente,
--   igual que scripts/gymrm-door-bridge/. Los lectores de Dreamers (MB360/ID)
--   no soportan HTTPS nativo -- nunca completan un poll ADMS real, así que
--   `open_door` encolado por manual-open hoy no le llega a nadie: se queda
--   `pending` hasta expirar. Marcar has_local_bridge=true habilita que
--   GET /bridge/door-commands (ya genérico por school_id, sin cambios de
--   backend) le sirva estos comandos al bridge local, y excluye `open_door`
--   de getrequest para estos dos dispositivos (no afecta en la práctica: el
--   propio dispositivo nunca llega a hacer ese poll, pero deja todo
--   consistente con el mismo mecanismo de GYM RM). Ver INF-12/scripts/gymrm-door-bridge
--   para el precedente completo.
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

UPDATE public.turnstile_devices
   SET has_local_bridge = true
 WHERE serial_number IN ('CEZU222860004', 'CEZU214960067');

COMMIT;
