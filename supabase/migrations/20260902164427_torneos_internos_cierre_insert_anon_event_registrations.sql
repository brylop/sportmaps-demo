-- =============================================================================
-- 20260902164427_torneos_internos_cierre_insert_anon_event_registrations.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902113317
-- Objetivo: cerrar un hueco de seguridad encontrado al revisar RLS/CRUD de la
-- Fase 1/2 de docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md.
--
-- `event_registrations` (tabla original de 20260217000001_schema_refactored.sql,
-- para el flujo viejo de "organizador externo") tiene:
--   1. GRANT de INSERT/UPDATE/DELETE/SELECT a `anon` (sin sesión) a nivel de tabla.
--   2. La policy `event_registrations_insert`:
--        WITH CHECK (user_id = auth.uid() OR user_id IS NULL)
--      Para `anon`, auth.uid() es NULL, así que la primera condición nunca es
--      cierta — pero la segunda (`user_id IS NULL`) la cumple cualquiera con
--      solo omitir ese campo en el payload.
--
-- Resultado: cualquiera SIN CUENTA puede insertar una fila directo contra
-- PostgREST (POST /rest/v1/event_registrations) con el event_id/category_id/
-- child_id/school_id que quiera, saltándose por completo la RPC
-- register_for_internal_tournament() (que sí valida escuela, categoría, cupo
-- y crea el cobro real). Con la Fase 1 ya en producción, una fila así podría
-- terminar asignada a un equipo real por assign_registrants_to_teams() (que
-- confía en event_id+category_id sin verificar quién creó el registro).
--
-- Las otras 5 tablas del mismo módulo (event_teams, event_team_members,
-- event_delegations, event_delegation_payments, event_categories_config,
-- event_price_phases) tienen el MISMO grant amplio a `anon`, pero ahí sí hay
-- policies que exigen auth.uid() en el USING — para `anon` eso es NULL, así
-- que quedan bloqueadas en la práctica. Solo event_registrations tenía el
-- escape `OR user_id IS NULL`.
--
-- Verificado ANTES de este fix que no rompe nada: el único endpoint vivo que
-- usa esta tabla hoy (POST /api/v1/events/:id/register, bff/src/routes/
-- events.route.ts) escribe con el cliente de SERVICE ROLE (bypassa RLS por
-- completo), así que nunca dependió de la rama `user_id IS NULL`.
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

-- Quita el escape `user_id IS NULL` — solo el propio usuario puede insertar
-- como sí mismo. Los flujos de sistema (RPCs SECURITY DEFINER, BFF con
-- service role) no pasan por esta policy de todas formas.
DROP POLICY IF EXISTS event_registrations_insert ON public.event_registrations;
CREATE POLICY event_registrations_insert ON public.event_registrations
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Cierra el acceso de `anon` a nivel de tabla — no hay ningún caso de uso
-- legítimo hoy de alguien SIN CUENTA leyendo o escribiendo esta tabla directo
-- (el flujo público de organizador exige requireAuth en el BFF, y ese BFF usa
-- el cliente de service role, que no necesita el grant de `anon`).
REVOKE INSERT, UPDATE, DELETE, SELECT ON public.event_registrations FROM anon;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT policyname, with_check FROM pg_policies WHERE tablename = 'event_registrations' AND policyname = 'event_registrations_insert';
SELECT grantee, privilege_type FROM information_schema.table_privileges WHERE table_name = 'event_registrations' AND grantee = 'anon';
