-- =============================================================================
-- 20260921211509_seg17_revoke_public_5_rpc_identidad.sql
-- Autor: brylop   Fecha: 2026-09-22   Versión anterior: 20260921205815
-- Objetivo: la migración anterior (20260921205815) revocó EXECUTE de `anon`
-- en 5 RPC (fn_delete_self_assigned_session, fn_unassign_gym_session,
-- fn_create_plan_from_routine, unblock_payment, is_school_admin_of), pero
-- las 5 nunca tuvieron un GRANT explícito a `anon` — su proacl solo tenía
-- `=X/postgres` (PUBLIC), `authenticated` y `service_role`. En Postgres, un
-- REVOKE FROM anon es un no-op si el acceso real viene de PUBLIC: cualquier
-- rol, incluido anon, hereda los privilegios de PUBLIC salvo que se le
-- revoquen explícitamente A ÉL TAMBIÉN. Verificado en vivo tras aplicar
-- 20260921205815: las 5 siguen con anon_puede=true (has_function_privilege).
--
-- Mismo patrón que SEG-16 (20260921205001) sí manejó bien con su "cinturón"
-- (REVOKE ... FROM PUBLIC), que esta migración replica para las 5 restantes.
-- Ninguna de las 5 exige `anon`: las 5 validan identidad (auth.uid() o
-- auth.role() = 'service_role') en su propio cuerpo.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.fn_delete_self_assigned_session(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_unassign_gym_session(uuid, uuid)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_create_plan_from_routine(uuid, uuid, text, date, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unblock_payment(text, uuid)                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_school_admin_of(uuid, uuid)             FROM PUBLIC;

-- authenticated y service_role se preservan explícitamente (por si el REVOKE
-- FROM PUBLIC los tocara indirectamente en alguna versión de Postgres, no
-- debería, pero se re-otorga por seguridad y para dejarlo documentado).
GRANT EXECUTE ON FUNCTION public.fn_delete_self_assigned_session(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_unassign_gym_session(uuid, uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_create_plan_from_routine(uuid, uuid, text, date, uuid, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unblock_payment(text, uuid)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_school_admin_of(uuid, uuid)             TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
