-- =============================================================================
-- 20260921120707_fix_org_enumeration_functions.sql
-- Autor: brylop   Fecha: 2026-09-21   Versión anterior: 20260921120611
-- Objetivo: linter de Supabase (anon_security_definer_function_executable)
-- marcó 6 funciones que reciben un `_user_id`/`user_id`/`p_uid` arbitrario
-- como parámetro y devuelven a qué escuelas/sedes pertenece o qué rol tiene
-- ESE usuario, sin validar que sea el propio caller. Cualquiera (autenticado
-- o, en algunos casos, ni eso) podía enumerar el organigrama de cualquier
-- escuela de la plataforma.
--
-- Verificado antes de tocar nada: grep sobre frontend/ y bff/ — ninguna
-- confirma llamado directo desde la app a get_user_admin_school_ids,
-- get_user_school_ids, has_school_role, is_branch_admin ni
-- get_personal_trainer_school_id. Tampoco aparecen en ninguna policy de
-- pg_policies. Son huérfanas de un diseño de RBAC anterior
-- (frontend/supabase/migrations_backup/*multi_sede_rbac*,
-- *multi_branch_rls*) — se revoca EXECUTE de anon/authenticated sin riesgo
-- funcional, service_role/postgres las conserva.
--
-- is_school_admin_of SÍ está viva: la usan 2 policies reales
-- (events.events_school_admin_manage, "School admins read their email log")
-- pero SIEMPRE con el default (auth.uid()), nunca con un p_uid explícito.
-- Se blinda: solo se confía en p_uid si coincide con auth.uid() o el caller
-- es super_admin — las 2 policies siguen funcionando igual (usan el default).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_user_admin_school_ids(uuid)      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_school_ids(uuid)            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_school_role(uuid, uuid, text)    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_branch_admin(uuid, uuid)          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_personal_trainer_school_id(uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_school_admin_of(p_school_id uuid, p_uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
    SELECT p_school_id IS NOT NULL
       AND (p_uid = auth.uid() OR public.is_super_admin())
       AND EXISTS (
        SELECT 1 FROM public.school_members sm
        WHERE sm.school_id  = p_school_id
          AND sm.profile_id = p_uid
          AND sm.role   = ANY (ARRAY['owner','admin','school_admin'])
          AND sm.status = 'active'
    );
$function$;

COMMIT;
