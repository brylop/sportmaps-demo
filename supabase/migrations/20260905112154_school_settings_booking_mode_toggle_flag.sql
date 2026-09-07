-- =============================================================================
-- 20260905112154_school_settings_booking_mode_toggle_flag.sql
-- Autor: judegor99   Fecha: 2026-09-05   Versión anterior: 20260905111458
-- Objetivo: gatear el toggle booking_mode (20260905105310) detrás de un flag
-- por escuela para lanzarlo primero como piloto (Dreamers + Academia Superior
-- Bogotá) antes de habilitarlo global. Sigue el mismo patrón que ya usan
-- hours_plan_enabled / merchandise_enabled / self_service_enabled en esta
-- tabla — un booleano por escuela, default false, sin RLS nueva (school_settings
-- ya scopea por school_id via las policies existentes).
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
    ADD COLUMN booking_mode_toggle_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.booking_mode_toggle_enabled IS
    'Piloto: habilita en OfferingsManagement el selector de booking_mode (coach/facility/both) '
    'para esta escuela. Default false — el BFF (offerings.ts) también lo revalida en '
    'POST/PATCH /offerings antes de aceptar un booking_mode distinto de coach.';

COMMIT;
