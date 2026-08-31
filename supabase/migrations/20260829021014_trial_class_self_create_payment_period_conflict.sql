-- =============================================================================
-- 20260829021014_trial_class_self_create_payment_period_conflict.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260829020235
-- Objetivo: fix encontrado probando trial_class_self_create (20260829020235)
--   contra la base real antes de darla por cerrada — no es un fix especulativo.
--
--   uniq_payment_active_period_per_adult es un índice único parcial sobre
--   payments (user_id, period_year, period_month) WHERE child_id IS NULL AND
--   status IN (pending, awaiting_approval, paid, partial, overdue, glosado).
--   Un trigger existente deriva period_year/period_month desde due_date antes
--   del chequeo de unicidad, aunque el INSERT los mande NULL (mismo patrón
--   que ya usa chargeRegistrationFeeIfApplicable en el BFF).
--
--   Consecuencia: cuando el sujeto es el propio adulto logueado (p_self=true,
--   user_id set, sin child_id) y YA tiene un cobro activo ese mes calendario
--   (su mensualidad, por ejemplo), el INSERT de payments para la clase de
--   prueba choca con 23505 duplicate key — un error crudo de Postgres que
--   revienta toda la transacción (correcto que revierta todo; el problema es
--   el mensaje). Reproducido en vivo con IVAN DAVID MANCIPE
--   (ac966353-37f2-4f10-9032-8382cdc34a13) en ACADEMIA SUPERIOR BOGOTA.
--
--   Solo afecta al camino p_self con payment_mode IN ('manual','gateway') —
--   child_id e unregistered_athlete_id no están cubiertos por ese índice
--   (WHERE child_id IS NULL exige justamente que no sea ninguno de esos dos
--   casos con hijo, y el índice exige user_id NOT NULL).
--
--   Fix: atrapar unique_violation puntual y re-lanzar con un prefijo propio
--   (payment_period_conflict:) que el BFF pueda distinguir de un error
--   genérico y mostrar un mensaje claro — mismo patrón que
--   too_late_to_reschedule: en trial_class_self_reschedule. La transacción
--   sigue revirtiendo todo (nada queda a medias), solo cambia el mensaje.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.trial_class_self_create(
  p_school_id                uuid,
  p_created_by               uuid,
  p_category_id              uuid,
  p_facility_availability_id uuid,
  p_coach_availability_id    uuid,
  p_scheduled_date           date,
  p_start_time               time,
  p_end_time                 time,
  p_child_id                 uuid DEFAULT NULL,
  p_self                     boolean DEFAULT false,
  p_prospect_name            text DEFAULT NULL,
  p_prospect_email           text DEFAULT NULL,
  p_prospect_whatsapp        text DEFAULT NULL,
  p_prospect_dob             date DEFAULT NULL
)
RETURNS TABLE (
  booking_id   uuid,
  price        numeric,
  is_first     boolean,
  payment_mode text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_subject_count     integer;
  v_creator           record;
  v_child             record;
  v_facility_avail    record;
  v_coach_avail       record;
  v_settings          record;
  v_category          record;
  v_unregistered_id   uuid;
  v_child_id          uuid;
  v_user_id           uuid;
  v_enrollment_id     uuid;
  v_session_id        uuid;
  v_booking_id        uuid;
  v_is_first          boolean;
  v_price             numeric;
  v_subject_name      text;
  v_is_minor          boolean := false;
BEGIN
  IF p_created_by IS NULL THEN
    RAISE EXCEPTION 'p_created_by es obligatorio';
  END IF;

  SELECT full_name, email, phone INTO v_creator FROM public.profiles WHERE id = p_created_by;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de quien agenda no encontrado';
  END IF;

  v_subject_count := (CASE WHEN p_child_id IS NOT NULL THEN 1 ELSE 0 END)
                    + (CASE WHEN p_self THEN 1 ELSE 0 END)
                    + (CASE WHEN p_prospect_name IS NOT NULL THEN 1 ELSE 0 END);
  IF v_subject_count <> 1 THEN
    RAISE EXCEPTION 'Elegí exactamente un sujeto: p_child_id, p_self=true, o los datos de un hermano/a nuevo';
  END IF;

  SELECT * INTO v_settings
  FROM public.school_trial_class_settings
  WHERE school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_settings.enabled OR NOT v_settings.self_service_enabled THEN
    RAISE EXCEPTION 'El agendamiento de clases de prueba desde Mis Inscripciones no está habilitado en esta escuela';
  END IF;

  SELECT * INTO v_category
  FROM public.trial_class_categories
  WHERE id = p_category_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_category.is_active THEN
    RAISE EXCEPTION 'Categoría de clase de prueba no encontrada';
  END IF;

  IF p_child_id IS NOT NULL THEN
    SELECT * INTO v_child FROM public.children WHERE id = p_child_id;
    IF NOT FOUND OR v_child.parent_id IS DISTINCT FROM p_created_by OR v_child.school_id IS DISTINCT FROM p_school_id THEN
      RAISE EXCEPTION 'No autorizado sobre este hijo/a';
    END IF;
    v_child_id := p_child_id;
    v_subject_name := v_child.full_name;
    v_is_minor := true;

  ELSIF p_self THEN
    v_user_id := p_created_by;
    v_subject_name := v_creator.full_name;

  ELSE
    IF btrim(coalesce(p_prospect_name, '')) = ''
       OR btrim(coalesce(p_prospect_email, '')) = ''
       OR btrim(coalesce(p_prospect_whatsapp, '')) = '' THEN
      RAISE EXCEPTION 'Nombre, correo y WhatsApp del hermano/a son obligatorios';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.children WHERE parent_id = p_created_by AND school_id = p_school_id)
       AND NOT EXISTS (SELECT 1 FROM public.school_members WHERE profile_id = p_created_by AND school_id = p_school_id AND status = 'active') THEN
      RAISE EXCEPTION 'No autorizado para agendar un prospecto nuevo en esta escuela';
    END IF;

    v_is_minor := p_prospect_dob IS NOT NULL AND p_prospect_dob > (CURRENT_DATE - INTERVAL '18 years');

    SELECT id INTO v_unregistered_id
    FROM public.unregistered_athletes
    WHERE school_id = p_school_id AND phone = p_prospect_whatsapp AND full_name = p_prospect_name
    LIMIT 1;

    IF v_unregistered_id IS NULL THEN
      INSERT INTO public.unregistered_athletes (school_id, full_name, email, phone, date_of_birth)
      VALUES (p_school_id, p_prospect_name, p_prospect_email, p_prospect_whatsapp, p_prospect_dob)
      RETURNING id INTO v_unregistered_id;
    END IF;

    v_subject_name := p_prospect_name;
  END IF;

  v_is_first := public.trial_class_self_is_first(p_school_id, v_child_id, v_user_id, v_unregistered_id);

  IF v_is_first THEN
    v_price := v_category.price;
  ELSE
    IF NOT v_settings.allow_repeat_trial THEN
      RAISE EXCEPTION 'Ya se usó la clase de prueba de esta persona en esta escuela';
    END IF;
    v_price := coalesce(v_settings.repeat_trial_price, 0);
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

  IF v_category.offering_plan_id IS NULL THEN
    DECLARE
      v_offering_id uuid;
      v_plan_id     uuid;
    BEGIN
      INSERT INTO public.offerings (school_id, name, offering_type, is_active)
      VALUES (p_school_id, v_category.name, 'single_session', true)
      RETURNING id INTO v_offering_id;

      INSERT INTO public.offering_plans (offering_id, school_id, name, max_sessions, price, is_active)
      VALUES (v_offering_id, p_school_id, v_category.name || ' (1 clase)', 1, 0, true)
      RETURNING id INTO v_plan_id;

      UPDATE public.trial_class_categories
      SET offering_plan_id = v_plan_id, updated_at = now()
      WHERE id = v_category.id;

      v_category.offering_plan_id := v_plan_id;
    END;
  END IF;

  INSERT INTO public.enrollments (school_id, child_id, user_id, unregistered_athlete_id, offering_plan_id, status, sessions_used)
  VALUES (p_school_id, v_child_id, v_user_id, v_unregistered_id, v_category.offering_plan_id, 'active', 0)
  RETURNING id INTO v_enrollment_id;

  INSERT INTO public.attendance_sessions (
    school_id, facility_id, facility_availability_id, coach_id,
    offering_id, session_date, start_time, end_time,
    max_capacity, current_bookings, is_bookable, finalized, requires_capacity_check,
    title, created_by
  ) VALUES (
    p_school_id, v_facility_avail.facility_id, p_facility_availability_id, v_coach_avail.coach_id,
    (SELECT offering_id FROM public.offering_plans WHERE id = v_category.offering_plan_id),
    p_scheduled_date, p_start_time, p_end_time,
    1, 0, true, false, true,
    'Clase de prueba - ' || v_subject_name, p_created_by
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.session_bookings (
    school_id, session_id, child_id, user_id, unregistered_athlete_id,
    is_secondary, booking_type, status,
    price, payment_status, payment_provider
  ) VALUES (
    p_school_id, v_session_id, v_child_id, v_user_id, v_unregistered_id,
    false, 'trial_class', 'confirmed',
    v_price, CASE WHEN v_price > 0 THEN 'pending' ELSE 'free' END, NULL
  );

  PERFORM public.move_session_credit(v_enrollment_id, 1, false);

  -- ── Cobro pendiente si el modo de la escuela lo pide ────────────────────
  -- FIX 20260829021014: uniq_payment_active_period_per_adult (parcial, solo
  -- cuando child_id IS NULL) choca si el adulto (p_self) ya tiene un cobro
  -- activo ese mes calendario. No es un bug de esta RPC, es la protección
  -- anti-duplicados de `payments` haciendo su trabajo — pero el mensaje
  -- crudo de Postgres no sirve para el BFF. Se atrapa y se re-lanza con un
  -- prefijo reconocible, mismo patrón que too_late_to_reschedule más abajo.
  IF v_price > 0 AND v_settings.payment_mode IN ('manual','gateway') THEN
    BEGIN
      INSERT INTO public.payments (
        school_id, branch_id, child_id, user_id, unregistered_athlete_id, offering_plan_id,
        amount, concept, due_date, status, payment_type, period_year, period_month
      ) VALUES (
        p_school_id, NULL, v_child_id, v_user_id, v_unregistered_id, v_category.offering_plan_id,
        v_price, 'Clase de prueba — ' || v_category.name || ' — ' || v_subject_name,
        p_scheduled_date, 'pending', 'one_time', NULL, NULL
      );
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'payment_period_conflict: ya hay un cobro activo para % este mes — coordiná el pago de la prueba directamente con la escuela', v_subject_name;
    END;
  END IF;

  INSERT INTO public.trial_class_bookings (
    school_id, category_id, facility_id, coach_id, attendance_session_id, enrollment_id,
    child_id, user_id, unregistered_athlete_id,
    prospect_name, prospect_email, prospect_whatsapp,
    is_minor, child_name,
    scheduled_date, start_time, end_time, price_charged, status,
    created_by
  ) VALUES (
    p_school_id, v_category.id, v_facility_avail.facility_id, v_coach_avail.coach_id, v_session_id, v_enrollment_id,
    v_child_id, v_user_id, v_unregistered_id,
    coalesce(v_subject_name, v_creator.full_name, ''),
    coalesce(p_prospect_email, v_creator.email, ''),
    coalesce(p_prospect_whatsapp, v_creator.phone, ''),
    v_is_minor, CASE WHEN v_child_id IS NOT NULL THEN v_subject_name ELSE NULL END,
    p_scheduled_date, p_start_time, p_end_time, v_price, 'agendada',
    p_created_by
  )
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT v_booking_id, v_price, v_is_first, v_settings.payment_mode;
END;
$$;

-- Firma sin cambios respecto a 20260829020235 -- no hace falta DROP ni
-- volver a REVOKE/GRANT (los privilegios de una función quedan intactos al
-- hacerle CREATE OR REPLACE con la misma firma).

COMMIT;
