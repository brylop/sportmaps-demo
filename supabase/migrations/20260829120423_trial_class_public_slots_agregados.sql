-- =============================================================================
-- 20260829120423_trial_class_public_slots_agregados.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260829115629
-- Objetivo: en el link público (sin cuenta) no tiene sentido pedirle al
--   visitante que elija cancha Y entrenador por separado — más fricción, y
--   expondría identidad de staff sin necesidad (el patrón de cortesía ya
--   evita esto: coach_id siempre null ahí). Esta RPC devuelve TODOS los
--   horarios disponibles de una categoría, cruzando cada cancha con cada
--   entrenador — el visitante solo ve fecha/hora/cancha, nunca el nombre
--   del entrenador. El entrenador se resuelve solo puertas adentro
--   (facility_availability_id + coach_availability_id ya identifican la
--   combinación exacta que trial_class_public_create necesita).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.trial_class_public_get_slots(
  p_school_id  uuid,
  p_category_id uuid,
  p_from_date  date,
  p_to_date    date
)
RETURNS TABLE (
  slot_date date,
  slot_start_time time,
  slot_end_time time,
  facility_availability_id uuid,
  coach_availability_id uuid,
  facility_id uuid,
  facility_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.school_trial_class_settings
    WHERE school_id = p_school_id AND enabled AND self_service_enabled
  ) THEN
    RAISE EXCEPTION 'El agendamiento público de clases de prueba no está habilitado en esta escuela';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trial_class_categories
    WHERE id = p_category_id AND school_id = p_school_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Categoría de clase de prueba no encontrada';
  END IF;

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
      ca.id AS ca_id,
      fa.facility_id AS facility_id,
      f.name AS facility_name
    FROM days dd
    JOIN public.facility_availability fa
      ON fa.school_id = p_school_id
     AND fa.day_of_week = EXTRACT(DOW FROM dd.the_date)::int
    JOIN public.facilities f ON f.id = fa.facility_id AND f.booking_enabled = true
    JOIN public.coach_availability ca
      ON ca.school_id = p_school_id
     AND ca.day_of_week = EXTRACT(DOW FROM dd.the_date)::int
    WHERE GREATEST(fa.start_time, ca.start_time) < LEAST(fa.end_time, ca.end_time)
  )
  SELECT ov.the_date, ov.ov_start, ov.ov_end, ov.fa_id, ov.ca_id, ov.facility_id, ov.facility_name
  FROM joint_windows ov
  WHERE NOT EXISTS (
    SELECT 1 FROM public.attendance_sessions ases
    WHERE ases.session_date = ov.the_date
      AND (
        (ases.facility_id = ov.facility_id AND ases.start_time < ov.ov_end AND ases.end_time > ov.ov_start)
        OR
        (ases.coach_id = (SELECT coach_id FROM public.coach_availability WHERE id = ov.ca_id) AND ases.start_time < ov.ov_end AND ases.end_time > ov.ov_start)
      )
  )
  ORDER BY ov.the_date, ov.ov_start;
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_public_get_slots(uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_public_get_slots(uuid, uuid, date, date) TO service_role;

COMMIT;
