-- =============================================================================
-- 20260914221557_revertir_team_availability_usar_coach_availability_del_equipo.sql
-- Autor: judegor99   Fecha: 2026-09-15   Versión anterior: 20260912103828
-- Objetivo: corrección de diseño del piloto "agendar por equipo" — el dueño
-- de dice el usuario, con razón: si el horario vive en una tabla aparte
-- (team_availability), un coach que renuncia o no puede ese día deja el
-- horario mostrando cupos que nadie va a dictar. El horario debe seguir
-- siendo el de CADA coach (coach_availability, ya existente) — el equipo
-- (team_coaches) solo dice CUÁLES coaches cuentan para ese grupo. Si un
-- coach sale del equipo, sus horarios dejan de contar automáticamente, sin
-- tocar nada más.
--
-- Se revierte lo aplicado en 20260912102517/20260912102940:
--   · attendance_sessions.team_availability_id — ya no aplica, las sesiones
--     de equipo se vinculan por coach_availability_id como cualquier otra.
--   · team_availability — tabla completa, sin filas cargadas (piloto nunca
--     llegó a usarse en producción).
-- Se CONSERVA (sigue siendo correcto):
--   · enrollments.scheduling_team_id — sigue siendo el campo que dice "esta
--     inscripción agenda por este equipo", solo cambia de dónde sale el
--     horario resultante.
--   · school_settings.team_scheduling_enabled — mismo flag piloto.
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

ALTER TABLE public.attendance_sessions DROP COLUMN IF EXISTS team_availability_id;
DROP TABLE IF EXISTS public.team_availability;

COMMIT;
