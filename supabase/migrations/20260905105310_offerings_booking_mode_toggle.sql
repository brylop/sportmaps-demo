-- =============================================================================
-- 20260905105310_offerings_booking_mode_toggle.sql
-- Autor: judegor99   Fecha: 2026-09-05   Versión anterior: 20260904131122
-- Objetivo: dar al owner/admin un toggle por plan (offering) para elegir si
-- sus clases se agendan por disponibilidad de ENTRENADOR, de INSTALACIÓN, o
-- ambas. Antes de esto, coach_availability era la única superficie para
-- agendar clases de plan (facility_availability quedó reservada para
-- clases de prueba/cortesía, ver 20260902190708 y el fix en
-- session-bookings.ts que sacó "instalación" de /athlete/available).
-- No toca RLS: son columnas nuevas sobre una tabla que ya scopea por
-- school_id via las policies existentes de `offerings`.
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

ALTER TABLE public.offerings
    ADD COLUMN booking_mode text NOT NULL DEFAULT 'coach',
    ADD COLUMN facility_id  uuid REFERENCES public.facilities(id) ON DELETE SET NULL;

ALTER TABLE public.offerings
    ADD CONSTRAINT offerings_booking_mode_check
        CHECK (booking_mode IN ('coach', 'facility', 'both'));

-- Un offering en modo 'facility' o 'both' necesita saber CUÁL instalación usar
-- (a diferencia de coach, donde offering_coaches ya resuelve el "cuál").
ALTER TABLE public.offerings
    ADD CONSTRAINT offerings_facility_required_for_facility_mode
        CHECK (booking_mode = 'coach' OR facility_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_offerings_facility_id
    ON public.offerings(facility_id) WHERE facility_id IS NOT NULL;

COMMENT ON COLUMN public.offerings.booking_mode IS
    'coach (default): agenda solo por coach_availability de los entrenadores asignados (offering_coaches) o de todos si no hay restricción. '
    'facility: agenda solo por facility_availability de facility_id. '
    'both: ofrece ambas superficies al atleta al agendar.';
COMMENT ON COLUMN public.offerings.facility_id IS
    'Instalación usada para generar horarios cuando booking_mode IN (facility, both). NULL cuando booking_mode = coach.';

COMMIT;
