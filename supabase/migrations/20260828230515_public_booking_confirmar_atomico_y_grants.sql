-- =============================================================================
-- 20260828230515_public_booking_confirmar_atomico_y_grants.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260828230514
-- Objetivo: cierra dos hallazgos menores de la revisión del flujo público de
--   reserva (bff/src/routes/public-booking.routes.ts, /agendar/:slug):
--
--   1) Carrera de capacidad en POST /confirm. La validación de cupo era
--      lectura-luego-escritura desde Node (contar session_bookings, comparar
--      contra max_capacity, recién ahí insertar) sin FOR UPDATE ni advisory
--      lock — dos requests concurrentes para el mismo bloque podían pasar el
--      chequeo a la vez y sobrevender el cupo. Viola la doctrina propia del
--      repo (CLAUDE.md / architecture/concurrencia-y-reservas.md: "nada que
--      consuma cupo se protege con una validación previa en el BFF").
--      Fix: se mueve todo el tramo "resolver/crear attendance_session +
--      chequear cupo + insertar session_booking + mover el crédito" a una
--      sola RPC SECURITY DEFINER con pg_advisory_xact_lock por
--      facility_availability_id+fecha (mismo patrón que
--      trial_class_create_booking) + upsert atómico de la sesión (antes era
--      INSERT y capturar el 23505 a mano desde JS).
--
--   2) `await supabase.rpc('move_session_credit', ...)` sin revisar `error`
--      en el código anterior — si esa RPC fallaba, el booking igual se
--      reportaba como éxito (201) al público. Al mover move_session_credit
--      DENTRO de la nueva RPC (PERFORM, no un rpc() suelto desde JS), un
--      fallo ahí revierte toda la transacción — incluido el session_booking
--      recién insertado — y el error sí le llega al BFF.
--
--   3) public_booking_verifications tenía GRANT de INSERT/SELECT/UPDATE/
--      DELETE a anon y authenticated a nivel de tabla. Verificado en vivo
--      que hoy es inofensivo (RLS activo con CERO policies deniega todo:
--      `set local role anon; select count(*)` → 0 filas), pero es un grant
--      inerte y peligroso: si alguien agrega una policy permisiva a futuro
--      sin revisar esto, el grant ya está ahí esperando. Se revoca explícito,
--      mismo patrón que ya se aplicó en trial_class_*.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

-- ── 3) Revocar el grant inerte de anon/authenticated ────────────────────────
REVOKE ALL ON public.public_booking_verifications FROM PUBLIC, anon, authenticated;

-- ── 1) + 2) RPC atómica para el tramo final de /confirm ─────────────────────
-- Restringida DIRECTO a service_role: el BFF es el único caller (usa
-- service_role, sin JWT de usuario — mismo patrón que trial_class_* desde
-- 20260827191307_clases_de_prueba_fix_bff_auth). La autorización (token
-- verificado, escenario válido, ventana de anticipación, estado del
-- enrollment) ya la resolvió el BFF antes de llamar esta RPC.
CREATE OR REPLACE FUNCTION public.public_booking_confirm_reservation(
  p_school_id                uuid,
  p_facility_id              uuid,
  p_facility_availability_id uuid,
  p_date                     date,
  p_start_time               time,
  p_end_time                 time,
  p_max_group_capacity       integer,
  p_enrollment_id            uuid,
  p_unregistered_athlete_id  uuid
)
RETURNS TABLE (
  session_id uuid,
  booking_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_session_id   uuid;
  v_max_capacity integer;
  v_active_count integer;
  v_booking_id   uuid;
BEGIN
  -- Serializa todos los /confirm concurrentes para este mismo bloque de
  -- cancha+fecha — nadie más avanza hasta que esta transacción termine
  -- (commit o rollback libera el lock automáticamente).
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_facility_availability_id::text || ':' || p_date::text, 0)
  );

  -- Upsert atómico de la sesión: si ya existe para este bloque+fecha, la
  -- reusa; si no, la crea. Reemplaza el INSERT + captura manual del 23505
  -- + retry que vivía en JS — el árbitro es
  -- idx_attendance_sessions_unique_facility_slot, que es PARCIAL
  -- (WHERE facility_availability_id IS NOT NULL) — Postgres exige repetir
  -- el mismo predicado acá o el ON CONFLICT no encuentra el índice
  -- (verificado en vivo con un BEGIN...ROLLBACK antes de confiar en esto).
  INSERT INTO public.attendance_sessions (
    school_id, facility_id, facility_availability_id, coach_id, offering_id,
    session_date, start_time, end_time,
    max_capacity, current_bookings, is_bookable, finalized
  ) VALUES (
    p_school_id, p_facility_id, p_facility_availability_id, NULL, NULL,
    p_date, p_start_time, p_end_time,
    coalesce(p_max_group_capacity, 10), 0, true, false
  )
  ON CONFLICT (facility_availability_id, session_date) WHERE facility_availability_id IS NOT NULL
  DO UPDATE SET facility_availability_id = EXCLUDED.facility_availability_id
  RETURNING id, max_capacity INTO v_session_id, v_max_capacity;

  -- Seguro de contar acá: el advisory lock impide que otro /confirm para
  -- este mismo bloque corra en paralelo mientras esta transacción sigue
  -- abierta. session_bookings.session_id calificado explícito: RETURNS
  -- TABLE(session_id, ...) mete "session_id" en scope como parámetro de
  -- salida, y colisiona con la columna del mismo nombre (detectado en el
  -- mismo BEGIN...ROLLBACK de prueba).
  SELECT count(*) INTO v_active_count
  FROM public.session_bookings sb
  WHERE sb.session_id = v_session_id AND sb.status <> 'cancelled';

  IF v_active_count >= v_max_capacity THEN
    RAISE EXCEPTION 'CAPACITY_FULL: Este horario ya alcanzó su cupo máximo.';
  END IF;

  INSERT INTO public.session_bookings (
    school_id, session_id, unregistered_athlete_id,
    is_secondary, booking_type, status
  ) VALUES (
    p_school_id, v_session_id, p_unregistered_athlete_id,
    false, 'reservation', 'confirmed'
  )
  RETURNING id INTO v_booking_id;

  -- PERFORM, no un rpc() suelto desde JS: si esto falla, revierte también
  -- el session_booking recién insertado.
  PERFORM public.move_session_credit(p_enrollment_id, 1, false);

  RETURN QUERY SELECT v_session_id, v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.public_booking_confirm_reservation(uuid, uuid, uuid, date, time, time, integer, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_booking_confirm_reservation(uuid, uuid, uuid, date, time, time, integer, uuid, uuid) TO service_role;

COMMIT;
