-- =============================================================================
-- 20260828232516_session_booking_reschedule_y_notificaciones.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260828230515
-- Objetivo: pedido del owner — que llegue un correo de confirmación cuando
--   se cancela o se reprograma una reserva desde la pestaña "Reservas".
--
--   Alcance (dos tipos de reserva, mismo pedido):
--   · facility_reservations (alquiler manual del owner, OwnerReservationModal):
--     cancelar/reprogramar YA existía (cambia estado o fecha/hora), y ya
--     tiene protección de motor contra choques (trigger
--     trg_check_facility_overlap / fn_check_facility_reservation_overlap).
--     No hace falta RPC nueva acá — el fix es mover el UPDATE de "cancelar
--     directo desde el navegador" (útil solo por su read, useFacilityReservations
--     escribía Supabase directo) a un endpoint del BFF para poder mandar el
--     correo del lado del servidor.
--   · session_bookings de clases de cortesía (creadas desde /agendar/:slug):
--     acá SÍ había un hueco real — solo se les podía cambiar el `status`
--     (cancelar), no la fecha/hora. "Reprogramar" no existía. Esta migración
--     agrega la RPC que lo hace, mismo patrón de
--     public_booking_confirm_reservation (advisory lock + upsert atómico de
--     attendance_sessions + chequeo de cupo) — misma cancha, no se puede
--     cambiar (eso es "otra reserva", no una edición).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

-- Restringida DIRECTO a service_role: el BFF (bff/src/routes/reservations-admin.routes.ts)
-- es el único caller, sin JWT de usuario — mismo patrón que
-- public_booking_confirm_reservation y trial_class_*.
CREATE OR REPLACE FUNCTION public.session_booking_reschedule(
  p_id                        uuid,
  p_school_id                 uuid,
  p_facility_availability_id  uuid,
  p_new_date                  date,
  p_new_start_time            time,
  p_new_end_time              time
)
RETURNS TABLE (
  facility_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_booking        record;
  v_old_facility_id uuid;
  v_avail          record;
  v_new_session_id uuid;
  v_max_capacity   integer;
  v_active_count   integer;
BEGIN
  SELECT * INTO v_booking
  FROM public.session_bookings
  WHERE id = p_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;
  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Solo se puede reprogramar una reserva confirmada';
  END IF;

  SELECT ases.facility_id INTO v_old_facility_id
  FROM public.attendance_sessions ases
  WHERE ases.id = v_booking.session_id;

  SELECT * INTO v_avail
  FROM public.facility_availability
  WHERE id = p_facility_availability_id AND school_id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disponibilidad de instalación no encontrada';
  END IF;
  IF v_avail.facility_id <> v_old_facility_id THEN
    RAISE EXCEPTION 'No se puede cambiar la cancha al reprogramar — cancela y reserva de nuevo';
  END IF;

  IF v_avail.day_of_week <> EXTRACT(DOW FROM p_new_date)::int THEN
    RAISE EXCEPTION 'La fecha no corresponde al día de la disponibilidad elegida';
  END IF;
  IF p_new_start_time < v_avail.start_time OR p_new_end_time > v_avail.end_time THEN
    RAISE EXCEPTION 'El horario elegido está fuera de la disponibilidad de la cancha';
  END IF;

  -- Serializa reprogramaciones/confirmaciones concurrentes contra este mismo
  -- bloque de cancha+fecha (mismo criterio que public_booking_confirm_reservation).
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_facility_availability_id::text || ':' || p_new_date::text, 0)
  );

  INSERT INTO public.attendance_sessions (
    school_id, facility_id, facility_availability_id, coach_id, offering_id,
    session_date, start_time, end_time,
    max_capacity, current_bookings, is_bookable, finalized
  ) VALUES (
    p_school_id, v_avail.facility_id, p_facility_availability_id, NULL, NULL,
    p_new_date, p_new_start_time, p_new_end_time,
    coalesce(v_avail.max_group_capacity, 10), 0, true, false
  )
  ON CONFLICT (facility_availability_id, session_date) WHERE facility_availability_id IS NOT NULL
  DO UPDATE SET facility_availability_id = EXCLUDED.facility_availability_id
  RETURNING id, max_capacity INTO v_new_session_id, v_max_capacity;

  SELECT count(*) INTO v_active_count
  FROM public.session_bookings sb
  WHERE sb.session_id = v_new_session_id AND sb.status <> 'cancelled' AND sb.id <> p_id;

  IF v_active_count >= v_max_capacity THEN
    RAISE EXCEPTION 'CAPACITY_FULL: Este horario ya alcanzó su cupo máximo.';
  END IF;

  UPDATE public.session_bookings
  SET session_id = v_new_session_id, updated_at = now()
  WHERE id = p_id;

  RETURN QUERY SELECT v_avail.facility_id;
END;
$$;

REVOKE ALL ON FUNCTION public.session_booking_reschedule(uuid, uuid, uuid, date, time, time) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.session_booking_reschedule(uuid, uuid, uuid, date, time, time) TO service_role;

COMMIT;
