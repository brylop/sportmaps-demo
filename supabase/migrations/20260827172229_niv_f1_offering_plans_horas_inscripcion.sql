-- =============================================================================
-- 20260827172229_niv_f1_offering_plans_horas_inscripcion.sql
-- Autor: brylop   Fecha: 2026-08-27   Versión anterior: 20260827170031
-- Objetivo: F1 del spec docs/specs/dreamers-niveles-por-horas-y-progresion.md
--   (D1, D2, D17) — planes por bloque de sesión + días/semana, y cobro de
--   inscripción/matrícula separado de la mensualidad. Las tres columnas son
--   nullable: NULL = comportamiento actual, cero efecto en las demás escuelas.
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

ALTER TABLE public.offering_plans
  ADD COLUMN IF NOT EXISTS session_block_minutes integer,
  ADD COLUMN IF NOT EXISTS included_sessions_per_week integer,
  ADD COLUMN IF NOT EXISTS registration_fee numeric CHECK (registration_fee IS NULL OR registration_fee >= 0);

COMMENT ON COLUMN public.offering_plans.session_block_minutes IS
  'Minutos por sesión de ESTE plan (D1). NULL hereda school_settings.hours_session_block_minutes.';
COMMENT ON COLUMN public.offering_plans.included_sessions_per_week IS
  'Informativa, display-only (D2) — la fuente de verdad de horas sigue siendo included_minutes_per_period.';
COMMENT ON COLUMN public.offering_plans.registration_fee IS
  'Cobro único de inscripción/matrícula, aparte de la mensualidad (D17). NULL = sin cobro de inscripción.';

COMMIT;
