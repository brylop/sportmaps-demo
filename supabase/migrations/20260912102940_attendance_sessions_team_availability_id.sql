-- =============================================================================
-- 20260912102940_attendance_sessions_team_availability_id.sql
-- Autor: judegor99   Fecha: 2026-09-12   Versión anterior: 20260912102517
-- Objetivo: vínculo attendance_sessions → team_availability, mismo patrón que
-- ya existe para coach_availability_id/facility_availability_id. Necesario
-- para el piloto "agendar por equipo" (20260912102517): al materializar una
-- sesión real desde un slot de team_availability, este vínculo es lo que
-- permite (a) encontrar la sesión ya creada para esa fecha exacta y (b)
-- contar cupo por fecha, igual que hoy con coach/facility.
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

ALTER TABLE public.attendance_sessions
    ADD COLUMN team_availability_id uuid REFERENCES public.team_availability(id) ON DELETE SET NULL;

CREATE INDEX idx_attendance_sessions_team_availability_id
    ON public.attendance_sessions(team_availability_id) WHERE team_availability_id IS NOT NULL;

COMMENT ON COLUMN public.attendance_sessions.team_availability_id IS
    'Vínculo al slot de team_availability que generó esta sesión real (piloto "agendar por equipo"). NULL para sesiones creadas por cualquier otro camino.';

COMMIT;
