-- =============================================================================
-- 20260924100845_team_coaches_select_staff_scoped.sql
-- Autor: brylop   Fecha: 2026-09-24   Versión anterior: 20260923113401
-- Objetivo: devolverle la LECTURA de team_coaches / team_branches al coach de
-- una escuela con coach_can_create_teams = true (hoy, solo Carmel Club).
--
-- Regresión de 20260831191515: esa migración reescribió las policies
-- "..._manage_staff" (FOR ALL) de teams / team_coaches / team_branches con
-- `AND NOT is_scoped_coach_school(school_id)` para que el coach acotado no
-- pudiera reasignar entrenador ni sede. Correcto para ESCRIBIR, pero como
-- eran FOR ALL también eran la ÚNICA vía de SELECT que tenía un coach sobre
-- esas dos tablas — y no se dejó carril de lectura de reemplazo. `teams` no
-- se rompió porque tiene sus propias policies FOR SELECT ("Teams: select
-- staff" / "Teams: select members"); team_coaches y team_branches no tienen
-- ninguna.
--
-- Síntoma medido contra la base viva (2026-09-24) simulando la sesión de
-- Víctor Alfonso Melo (coach de Carmel, auth 75e25e2b-…): ve 7 teams y 7
-- school_staff, pero 0 filas de team_coaches. El frontend (TeamsPage,
-- CoachAttendancePage, CalendarPage, useDashboardStats, students.ts,
-- classes.ts) decide "mis equipos" con `team_coaches.some(coach.id ===
-- staffId) || teams.coach_id === staffId`, así que el coach que es
-- ADICIONAL (está en team_coaches pero no es teams.coach_id) ve "Mis
-- Equipos (0)". Afectados hoy: 3 coaches de Carmel (Víctor Melo en
-- "Categoria 2020-21", Gerardo García en "Categoria 2018-19", Carlos Ruiz
-- en "Categoría 2014-2015"). El admin/owner no lo sufre porque para él
-- is_scoped_coach_school() es false y sigue leyendo por "..._manage_staff".
--
-- Fix: una policy FOR SELECT para cualquier staff activo de la escuela
-- (`user_staff_school_ids()`: quien TRABAJA en la escuela, sin padres ni
-- atletas). Es exactamente el alcance de lectura que ya tiene un coach en
-- toda escuela SIN el flag vía "..._manage_staff", así que para esas
-- escuelas es redundante (permisivas, se suman con OR) y para Carmel
-- restaura lo que se quitó por accidente. No toca escritura: reasignar
-- entrenador o sede sigue siendo admin-only para el coach acotado.
--
-- Radio: 1 escuela con el flag (Carmel). Lectura únicamente. Sin GRANT nuevo
-- (authenticated ya tiene SELECT en ambas tablas).
--
-- Forma `= ANY((SELECT fn())::uuid[])`: el helper envuelto en subquery se
-- evalúa una sola vez por statement en vez de una vez por fila (ver
-- 20260923113401 y docs/gotchas-tecnicos.md).
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

-- ── team_coaches: carril de LECTURA para todo el staff de la escuela ─────────
DROP POLICY IF EXISTS "team_coaches_select_staff" ON public.team_coaches;
CREATE POLICY "team_coaches_select_staff" ON public.team_coaches
FOR SELECT
TO authenticated
USING (school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));

COMMENT ON POLICY "team_coaches_select_staff" ON public.team_coaches IS
    'Lectura para cualquier staff activo de la escuela. Restaura el SELECT '
    'que 20260831191515 le quitó al coach acotado (Carmel) al reescribir '
    'team_coaches_manage_staff con NOT is_scoped_coach_school(). Sin esto, '
    'el coach que es ADICIONAL de un equipo (team_coaches sin ser '
    'teams.coach_id) ve "Mis Equipos (0)".';

-- ── team_branches: mismo hueco, mismo carril ─────────────────────────────────
DROP POLICY IF EXISTS "team_branches_select_staff" ON public.team_branches;
CREATE POLICY "team_branches_select_staff" ON public.team_branches
FOR SELECT
TO authenticated
USING (school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));

COMMENT ON POLICY "team_branches_select_staff" ON public.team_branches IS
    'Lectura para cualquier staff activo de la escuela. Mismo motivo que '
    'team_coaches_select_staff (regresión de 20260831191515).';

COMMIT;
