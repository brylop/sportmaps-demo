-- =============================================================================
-- 20260829010122_revocar_execute_funciones_enrollments_expuestas_anon.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260828232516
-- Objetivo: revocar EXECUTE de anon/authenticated en 4 funciones SECURITY
--   DEFINER sobre enrollments/hour_bank que quedaron expuestas por el default
--   privilege del esquema (nunca tuvieron REVOKE explícito). La más grave:
--   move_session_credit(p_enrollment_id, p_delta, p_is_secondary) no valida
--   quién llama — cualquiera sin sesión podía mover sessions_used/
--   secondary_sessions_used de CUALQUIER inscripción vía
--   /rest/v1/rpc/move_session_credit (delta -1 = robarle sesiones pagadas a
--   una familia, delta +1 = auto-restaurarse sesiones gratis). Encontrado en
--   auditoría de Frente B (planes/tarifas a atletas), 2026-08-29.
--   Verificado antes de revocar: todos los callers reales están en bff/src
--   (supabase con SUPABASE_SERVICE_ROLE_KEY, no afectado por este REVOKE) o
--   en pg_cron (corre como owner, tampoco afectado). Nada en frontend/src
--   llama a estas 4 RPCs directo — solo aparecen en el types.ts generado.
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

REVOKE EXECUTE ON FUNCTION public.move_session_credit(uuid, integer, boolean)
  FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.fn_expire_overdue_enrollments()
  FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.merge_split_enrollments(uuid, boolean)
  FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.auto_close_stale_hour_bank_visits()
  FROM anon, authenticated, public;

-- service_role ya tiene EXECUTE (superusuario lógico de Supabase, no pasa por
-- estos GRANT/REVOKE); no hace falta un GRANT explícito para que el BFF y
-- pg_cron sigan funcionando.

COMMIT;
