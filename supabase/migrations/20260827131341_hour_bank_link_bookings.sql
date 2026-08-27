-- =============================================================================
-- 20260827131341_hour_bank_link_bookings.sql
-- Autor: judegor99   Fecha: 2026-08-27   Versión anterior: 20260826220634
-- Objetivo: cerrar el hueco encontrado hoy — la reserva "por plan"
-- (session_bookings, move_session_credit) y la reserva "por instalaciones"
-- (facility_reservations, move_session_credit con is_secondary) no sabían que
-- existe el banco de horas. Una inscripción con `included_minutes_per_period`
-- podía reservar por esas dos vías moviendo `sessions_used`/
-- `secondary_sessions_used` — un contador que ni la escuela ni el padre
-- estaban mirando — sin tocar el saldo real del banco.
--
-- Fix (en el BFF, no acá): al reservar, si la inscripción tiene un plan de
-- horas, se llama a `reserve_hour_bank`/`cancel_hour_bank_reservation` EN VEZ
-- de `move_session_credit`. Esta migración solo agrega la columna que enlaza
-- cada reserva vieja con la fila de `hour_bank_reservations` que le
-- corresponde, para que al cancelar se sepa cuál de los dos sistemas mover.
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

ALTER TABLE public.session_bookings
  ADD COLUMN IF NOT EXISTS hour_bank_reservation_id uuid REFERENCES public.hour_bank_reservations(id);

COMMENT ON COLUMN public.session_bookings.hour_bank_reservation_id IS
  'NULL para el 99% de las reservas (planes por sesiones, el caso normal). '
  'Cuando NO es null, esta reserva se hizo sobre una inscripción con banco de '
  'horas: el crédito real vive en hour_bank_reservations/hour_bank_periods, no '
  'en enrollments.sessions_used — al cancelar hay que mover ESE sistema, no '
  'llamar move_session_credit. Ver docs/specs/dreamers-banco-de-horas-torniquete.md';

ALTER TABLE public.facility_reservations
  ADD COLUMN IF NOT EXISTS hour_bank_reservation_id uuid REFERENCES public.hour_bank_reservations(id);

COMMENT ON COLUMN public.facility_reservations.hour_bank_reservation_id IS
  'Mismo propósito que session_bookings.hour_bank_reservation_id — reserva de '
  'instalación hecha sobre una inscripción con banco de horas.';

COMMIT;

NOTIFY pgrst, 'reload schema';
