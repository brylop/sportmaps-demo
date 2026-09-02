-- =============================================================================
-- 20260902110253_coach_attendance_teams_only_setting.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902104919
-- Objetivo: la pantalla de asistencia del coach mostraba "Planes" (todo el
-- catálogo activo de `offerings` de la escuela, SIN filtrar por coach) al lado
-- de "Equipos". En Dynasty (grande, multi-disciplina) era puro ruido — un
-- coach de vóley veía los planes de golf, gimnasio, etc. — y además rompía la
-- auto-selección de sesión (docs/specs/asistencia-rapida-checkin.md §1.2):
-- un coach con un solo equipo nunca se auto-seleccionaba porque `offerings`
-- nunca estaba vacío.
--
-- Se probó ocultar "Planes" para TODOS los coaches, pero se revirtió: otras
-- escuelas pueden organizar la asistencia por PLAN, no por equipo — ocultarlo
-- ahí les rompe el flujo real. Es un setting por escuela, no una regla global.
-- Mismo patrón que `late_fee_enabled`/`reminder_enabled`/`hours_plan_enabled`
-- en esta misma tabla: default `false` (no cambia nada para nadie), y se
-- prende explícitamente para las escuelas que lo piden — hoy, Dynasty.
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

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS coach_attendance_teams_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.coach_attendance_teams_only IS
    'true = la pantalla de asistencia del coach (CoachAttendancePage) solo muestra "Equipos", '
    'oculta "Planes" (offerings sin filtrar por coach). Escuelas que organizan la asistencia por '
    'plan y no por equipo deben dejarlo en false (default). Prendido para Dynasty 2026-09-02.';

-- Dynasty: el caso que lo pidió.
UPDATE public.school_settings
   SET coach_attendance_teams_only = true
 WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT school_id, coach_attendance_teams_only
  FROM public.school_settings
 WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226';
