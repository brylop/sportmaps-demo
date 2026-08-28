-- =============================================================================
-- 20260827194111_clases_de_prueba_menor_de_edad.sql
-- Autor: judegor99   Fecha: 2026-08-28   Versión anterior: 20260827191307
-- Objetivo: agrega el mismo selector "Menor de Edad / Mayor de Edad" que ya
--   usa el registro de atletas (StudentTypeSelector + CreateChildModal) al
--   flujo de "Agenda de Clases de Prueba". Cuando el prospecto es menor de
--   edad, se captura el nombre del hijo/a por separado, y los campos
--   prospect_name/email/whatsapp pasan a representar al ACUDIENTE — mismo
--   patrón que unregistered_athletes.guardian_* ya usa en el resto del repo.
-- =============================================================================

BEGIN;

-- 1) Columnas nuevas en trial_class_bookings
ALTER TABLE public.trial_class_bookings
  ADD COLUMN is_minor  boolean NOT NULL DEFAULT false,
  ADD COLUMN child_name text;

ALTER TABLE public.trial_class_bookings
  ADD CONSTRAINT chk_trial_child_name_when_minor
  CHECK (NOT is_minor OR child_name IS NOT NULL);

-- 1.5) trial_class_get_joint_slots: mismo fix de drift que create_booking —
--      un slot no es realmente reservable si YA existe cualquier sesión para
--      ese facility_availability_id ese día (columnas sin cambios, solo cuerpo).
CREATE OR REPLACE FUNCTION public.trial_class_get_joint_slots(
  p_school_id uuid,
  p_facility_id uuid,
  p_coach_id uuid,
  p_from_date date,
  p_to_date date
)
RETURNS TABLE (
  slot_date date,
  slot_start_time time,
  slot_end_time time,
  facility_availability_id uuid,
  coach_availability_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_to_date < p_from_date OR p_to_date > p_from_date + INTERVAL '31 days' THEN
    RAISE EXCEPTION 'Rango de fechas inválido (máximo 31 días)';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT d::date AS the_date
    FROM generate_series(p_from_date, p_to_date, INTERVAL '1 day') AS d
  ),
  joint_windows AS (
    SELECT
      dd.the_date,
      GREATEST(fa.start_time, ca.start_time) AS ov_start,
      LEAST(fa.end_time, ca.end_time)        AS ov_end,
      fa.id AS fa_id,
      ca.id AS ca_id
    FROM days dd
    JOIN public.facility_availability fa
      ON fa.facility_id = p_facility_id
     AND fa.school_id = p_school_id
     AND fa.day_of_week = EXTRACT(DOW FROM dd.the_date)::int
    JOIN public.coach_availability ca
      ON ca.coach_id = p_coach_id
     AND ca.school_id = p_school_id
     AND ca.day_of_week = EXTRACT(DOW FROM dd.the_date)::int
    WHERE GREATEST(fa.start_time, ca.start_time) < LEAST(fa.end_time, ca.end_time)
  )
  SELECT ov.the_date, ov.ov_start, ov.ov_end, ov.fa_id, ov.ca_id
  FROM joint_windows ov
  WHERE NOT EXISTS (
    SELECT 1 FROM public.attendance_sessions ases
    WHERE ases.session_date = ov.the_date
      AND (
        ases.facility_availability_id = ov.fa_id
        OR (ases.facility_id = p_facility_id AND ases.start_time < ov.ov_end AND ases.end_time > ov.ov_start)
        OR (ases.coach_id = p_coach_id AND ases.start_time < ov.ov_end AND ases.end_time > ov.ov_start)
      )
  )
  ORDER BY ov.the_date, ov.ov_start;
END;
$$;

-- (sin cambios de GRANT: ya estaba restringida a service_role desde la
-- migración anterior)

-- 2) trial_class_create_booking: nuevo signature (+p_is_minor, +p_child_name
--    al final). Requiere DROP porque cambia la cantidad de parámetros.
DROP FUNCTION IF EXISTS public.trial_class_create_booking(uuid, uuid, uuid, date, time, time, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.trial_class_create_booking(
  p_school_id uuid,
  p_facility_availability_id uuid,
  p_coach_availability_id uuid,
  p_scheduled_date date,
  p_start_time time,
  p_end_time time,
  p_prospect_name text,
  p_prospect_email text,
  p_prospect_whatsapp text,
  p_created_by uuid,
  p_is_minor boolean DEFAULT false,
  p_child_name text DEFAULT NULL
)
RETURNS TABLE (
  booking_id uuid,
  whatsapp_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_facility_avail  record;
  v_coach_avail     record;
  v_settings        record;
  v_offering_id     uuid;
  v_plan_id         uuid;
  v_unregistered_id uuid;
  v_enrollment_id   uuid;
  v_session_id      uuid;
  v_booking_id      uuid;
  v_school_name     text;
  v_facility_name   text;
  v_coach_name      text;
  v_whatsapp_msg    text;
  v_price_line      text;
  v_child_line      text;
BEGIN
  IF p_prospect_name IS NULL OR btrim(p_prospect_name) = ''
     OR p_prospect_email IS NULL OR btrim(p_prospect_email) = ''
     OR p_prospect_whatsapp IS NULL OR btrim(p_prospect_whatsapp) = '' THEN
    RAISE EXCEPTION 'Nombre, correo y WhatsApp del acudiente/prospecto son obligatorios';
  END IF;

  IF p_is_minor AND (p_child_name IS NULL OR btrim(p_child_name) = '') THEN
    RAISE EXCEPTION 'El nombre del hijo/a es obligatorio cuando el prospecto es menor de edad';
  END IF;

  IF p_created_by IS NULL THEN
    RAISE EXCEPTION 'p_created_by es obligatorio';
  END IF;

  SELECT * INTO v_facility_avail
  FROM public.facility_availability
  WHERE id = p_facility_availability_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disponibilidad de instalación no encontrada';
  END IF;

  SELECT * INTO v_coach_avail
  FROM public.coach_availability
  WHERE id = p_coach_availability_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disponibilidad de entrenador no encontrada';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_facility_avail.facility_id::text || ':' || v_coach_avail.coach_id::text || ':' || p_scheduled_date::text, 0)
  );

  IF v_facility_avail.day_of_week <> EXTRACT(DOW FROM p_scheduled_date)::int
     OR v_coach_avail.day_of_week <> EXTRACT(DOW FROM p_scheduled_date)::int THEN
    RAISE EXCEPTION 'La fecha no corresponde al día de la disponibilidad elegida';
  END IF;

  IF p_start_time < v_facility_avail.start_time OR p_end_time > v_facility_avail.end_time
     OR p_start_time < v_coach_avail.start_time OR p_end_time > v_coach_avail.end_time THEN
    RAISE EXCEPTION 'El horario elegido está fuera de la disponibilidad de la cancha o el entrenador';
  END IF;

  -- NOTA de drift (hallado probando esta misma migración): existe un índice
  -- único idx_attendance_sessions_unique_facility_slot sobre
  -- (facility_availability_id, session_date) — no está en el historial de
  -- migraciones. Solo puede haber UNA attendance_session por bloque de
  -- disponibilidad de instalación y día, sin importar el coach ni el
  -- sub-horario. Si dos coaches distintos comparten un mismo bloque ancho de
  -- facility_availability (ej. 11:00-13:00), solo el primero que agende se
  -- queda con el bloque ese día. Este chequeo lo refleja como error de
  -- negocio ANTES del INSERT, para no reventar con el 23505 crudo.
  IF EXISTS (
    SELECT 1 FROM public.attendance_sessions ases
    WHERE ases.session_date = p_scheduled_date
      AND (
        ases.facility_availability_id = p_facility_availability_id
        OR (ases.facility_id = v_facility_avail.facility_id AND ases.start_time < p_end_time AND ases.end_time > p_start_time)
        OR (ases.coach_id = v_coach_avail.coach_id AND ases.start_time < p_end_time AND ases.end_time > p_start_time)
      )
  ) THEN
    RAISE EXCEPTION 'Este horario ya no está disponible';
  END IF;

  INSERT INTO public.school_trial_class_settings (school_id)
  VALUES (p_school_id)
  ON CONFLICT (school_id) DO NOTHING;

  SELECT * INTO v_settings
  FROM public.school_trial_class_settings
  WHERE school_id = p_school_id
  FOR UPDATE;

  IF NOT v_settings.enabled THEN
    RAISE EXCEPTION 'Las clases de prueba no están habilitadas para esta escuela';
  END IF;

  IF v_settings.trial_offering_plan_id IS NULL THEN
    INSERT INTO public.offerings (school_id, name, offering_type, is_active)
    VALUES (p_school_id, 'Clases de Prueba', 'single_session', true)
    RETURNING id INTO v_offering_id;

    INSERT INTO public.offering_plans (offering_id, school_id, name, max_sessions, price, is_active)
    VALUES (v_offering_id, p_school_id, 'Clase de prueba (1 clase)', 1, 0, true)
    RETURNING id INTO v_plan_id;

    UPDATE public.school_trial_class_settings
    SET trial_offering_plan_id = v_plan_id, updated_at = now()
    WHERE school_id = p_school_id;
  ELSE
    v_plan_id := v_settings.trial_offering_plan_id;
    SELECT offering_id INTO v_offering_id FROM public.offering_plans WHERE id = v_plan_id;
  END IF;

  -- Dedupe del prospecto/hijo. Mayor de edad: por escuela + su propio
  -- WhatsApp (igual que antes). Menor de edad: por escuela + WhatsApp DEL
  -- ACUDIENTE + nombre del hijo (un mismo acudiente puede agendar pruebas
  -- para más de un hijo).
  IF p_is_minor THEN
    SELECT id INTO v_unregistered_id
    FROM public.unregistered_athletes
    WHERE school_id = p_school_id AND guardian_phone = p_prospect_whatsapp AND full_name = p_child_name
    LIMIT 1;

    IF v_unregistered_id IS NULL THEN
      INSERT INTO public.unregistered_athletes (school_id, full_name, guardian_full_name, guardian_email, guardian_phone)
      VALUES (p_school_id, p_child_name, p_prospect_name, p_prospect_email, p_prospect_whatsapp)
      RETURNING id INTO v_unregistered_id;
    END IF;
  ELSE
    SELECT id INTO v_unregistered_id
    FROM public.unregistered_athletes
    WHERE school_id = p_school_id AND phone = p_prospect_whatsapp
    LIMIT 1;

    IF v_unregistered_id IS NULL THEN
      INSERT INTO public.unregistered_athletes (school_id, full_name, email, phone)
      VALUES (p_school_id, p_prospect_name, p_prospect_email, p_prospect_whatsapp)
      RETURNING id INTO v_unregistered_id;
    END IF;
  END IF;

  INSERT INTO public.enrollments (school_id, unregistered_athlete_id, offering_plan_id, status, sessions_used)
  VALUES (p_school_id, v_unregistered_id, v_plan_id, 'active', 0)
  RETURNING id INTO v_enrollment_id;

  INSERT INTO public.attendance_sessions (
    school_id, facility_id, facility_availability_id, coach_id,
    offering_id, session_date, start_time, end_time,
    max_capacity, current_bookings, is_bookable, finalized, requires_capacity_check,
    title, created_by
  ) VALUES (
    p_school_id, v_facility_avail.facility_id, p_facility_availability_id, v_coach_avail.coach_id,
    v_offering_id, p_scheduled_date, p_start_time, p_end_time,
    1, 0, true, false, true,
    'Clase de prueba - ' || coalesce(p_child_name, p_prospect_name), p_created_by
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.session_bookings (
    school_id, session_id, unregistered_athlete_id,
    is_secondary, booking_type, status,
    price, payment_status, payment_provider
  ) VALUES (
    p_school_id, v_session_id, v_unregistered_id,
    false, 'trial_class', 'confirmed',
    v_settings.price, CASE WHEN v_settings.price > 0 THEN 'pending' ELSE 'free' END, NULL
  );

  PERFORM public.move_session_credit(v_enrollment_id, 1, false);

  SELECT name INTO v_school_name FROM public.schools WHERE id = p_school_id;
  SELECT name INTO v_facility_name FROM public.facilities WHERE id = v_facility_avail.facility_id;
  SELECT full_name INTO v_coach_name FROM public.school_staff WHERE id = v_coach_avail.coach_id;

  v_price_line := CASE WHEN v_settings.price > 0
    THEN format(' El costo de la clase es $%s.', v_settings.price)
    ELSE '' END;

  v_child_line := CASE WHEN p_is_minor THEN format(' de %s', p_child_name) ELSE '' END;

  v_whatsapp_msg := format(
    'Hola %s, confirmamos tu clase de prueba%s en %s el %s a las %s en %s con el entrenador %s.%s ¡Te esperamos!',
    p_prospect_name, v_child_line, coalesce(v_school_name, ''), to_char(p_scheduled_date, 'DD/MM/YYYY'),
    to_char(p_start_time, 'HH24:MI'), coalesce(v_facility_name, ''), coalesce(v_coach_name, ''), v_price_line
  );

  INSERT INTO public.trial_class_bookings (
    school_id, facility_id, coach_id, attendance_session_id, enrollment_id, unregistered_athlete_id,
    prospect_name, prospect_email, prospect_whatsapp, is_minor, child_name,
    scheduled_date, start_time, end_time, price_charged, status,
    whatsapp_message, created_by
  ) VALUES (
    p_school_id, v_facility_avail.facility_id, v_coach_avail.coach_id, v_session_id, v_enrollment_id, v_unregistered_id,
    p_prospect_name, p_prospect_email, p_prospect_whatsapp, p_is_minor, p_child_name,
    p_scheduled_date, p_start_time, p_end_time, v_settings.price, 'agendada',
    v_whatsapp_msg, p_created_by
  )
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT v_booking_id, v_whatsapp_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_create_booking(uuid, uuid, uuid, date, time, time, text, text, text, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_create_booking(uuid, uuid, uuid, date, time, time, text, text, text, uuid, boolean, text) TO service_role;

COMMIT;
