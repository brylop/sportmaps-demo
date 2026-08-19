-- =============================================================================
-- 20260816184104_arreglar_staff_select_policy_lee_auth_users.sql
-- Autor: brylop   Fecha: 2026-08-16   Versión anterior: 20260815141039
-- Objetivo: que school_staff vuelva a ser legible. Hoy revienta para CUALQUIER
--           usuario autenticado, y eso dejó a todos los entrenadores sin poder
--           pasar lista.
--
-- ── El síntoma ──────────────────────────────────────────────────────────────
-- Dynasty reportó que sus entrenadores no pueden tomar asistencia. La pantalla
-- del coach les muestra CERO equipos. La dueña sí puede (entra por la rama de
-- admin, que no filtra por equipo).
--
-- ── Qué pasa de verdad ──────────────────────────────────────────────────────
-- `staff_select_policy` sobre school_staff tiene esto en su USING:
--
--     auth.uid() IN (SELECT users.id FROM auth.users WHERE users.email = school_staff.email)
--
-- El rol `authenticated` NO tiene GRANT SELECT sobre auth.users. Cuando la
-- policy se evalúa, PostgreSQL aborta la consulta entera con
--
--     42501: permission denied for table users
--
-- Ojo con la intuición equivocada: RLS filtra filas, nunca devuelve 403. Un
-- error de permisos saliendo de una tabla con RLS es siempre esto — una policy
-- que revienta por dentro. Y como el error ABORTA, no hay OR que valga: las
-- otras cuatro policies permisivas de SELECT no alcanzan a salvar la consulta.
--
-- ── Por qué recién ahora ────────────────────────────────────────────────────
-- La policy está rota desde que se escribió, pero convivía con
-- "Public select staff" (USING (true)), que el planner resolvía primero y hacía
-- innecesario evaluar el resto. Al cerrarla el 2026-08-14 (migración
-- 20260814185532, correcta y necesaria: exponía correos y teléfonos a anon),
-- quedó al descubierto la que estaba rota. Calza con los datos: los coaches
-- marcaron por última vez el 2026-08-13.
--
-- ── El efecto en cadena hasta la asistencia ─────────────────────────────────
--   useCoachStaffId  →  SELECT sobre school_staff  →  42501  →  staffId = null
--   CoachAttendancePage filtra los equipos con
--       team.coach_id === staffId  ||  tc.coach_id === staffId
--   y `teams.coach_id` / `team_coaches.coach_id` son FK a school_staff.id,
--   nunca al auth.uid(). Con staffId en null no matchea NINGÚN equipo.
--   Resultado: lista vacía, sin un solo mensaje de error.
--
-- ── La solución ─────────────────────────────────────────────────────────────
-- La intención de la policy era "el propio staff se ve por su correo". Eso se
-- escribe sin tocar auth.users: `email = auth.email()`. La segunda rama (los
-- administradores de la escuela) ya está cubierta de sobra por
-- "Staff: manage admin", "Staff: manage own school" y school_members_read_staff,
-- así que no se pierde acceso a nadie.
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

DROP POLICY IF EXISTS staff_select_policy ON public.school_staff;

-- Misma intención, sin leer auth.users. auth.email() sale del JWT: no consulta
-- ninguna tabla, así que no puede fallar por permisos.
CREATE POLICY staff_select_propia_ficha_por_correo
    ON public.school_staff
    FOR SELECT
    TO authenticated
    USING (email = auth.email());

COMMENT ON POLICY staff_select_propia_ficha_por_correo ON public.school_staff IS
    'Reemplaza a staff_select_policy (20260816184104). La anterior hacia '
    'SELECT sobre auth.users, tabla sin GRANT para authenticated: abortaba la '
    'consulta entera con 42501 y dejaba school_staff ilegible para todos. La '
    'rama de administracion que tambien cubria ya vive en "Staff: manage admin" '
    'y school_members_read_staff.';

COMMIT;
