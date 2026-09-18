-- =============================================================================
-- 20260912103828_school_settings_team_scheduling_flag.sql
-- Autor: judegor99   Fecha: 2026-09-12   Versión anterior: 20260912102940
-- Objetivo: gatear el piloto "agendar por equipo" (team_availability,
-- 20260912102517) detrás de un flag por escuela, mismo patrón que
-- booking_mode_toggle_enabled (20260905112154). Habilitado solo para
-- Dreamers Gymnastics y Academia Superior Bogotá — el resto de escuelas no
-- ve el botón de disponibilidad de equipo ni puede asignar scheduling_team_id.
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
    ADD COLUMN team_scheduling_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.team_scheduling_enabled IS
    'Piloto: habilita el botón de disponibilidad de equipo (team_availability) en TeamsPage y la asignación de scheduling_team_id a inscripciones. Default false.';

COMMIT;
