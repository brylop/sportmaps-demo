-- =============================================================================
-- 20260829115629_trial_class_public_create_backend.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260829102825
-- Objetivo: link público NUEVO y separado de /agendar/:slug (facilities +
--   cortesía, SEG-20) para agendar CLASES DE PRUEBA (trial_class_categories)
--   sin necesidad de cuenta. Decisión de producto (conversación): un link
--   distinto, pero reusando el MISMO patrón de identificación por correo+OTP
--   ya auditado — no se toca public-booking.routes.ts, se clona el patrón en
--   un router nuevo (Fase 2, aparte) para no arriesgar SEG-20.
--
--   Para una escuela con categorías de clase de prueba configuradas, este
--   link REEMPLAZA a la cortesía como la opción pública sin cuenta (decisión
--   de producto) — no borra school_courtesy_settings ni /agendar/:slug, que
--   siguen existiendo para instalaciones; este es un camino aparte.
--
--   Los tres escenarios de identificación (mismo criterio que SEG-20 §1):
--   · already_registered (tiene profiles.email) → el BFF no llega a esta RPC,
--     el frontend pide iniciar sesión y redirige a /enrollments, donde el
--     self-service (con el chequeo has_active_plan de 20260829102825) ya
--     resuelve todo. Cero código nuevo para este caso.
--   · enrolled_unregistered (unregistered_athlete con enrollment activo) →
--     esta RPC, con p_unregistered_athlete_id ya resuelto por el BFF.
--   · new (nadie coincide) → esta RPC, crea el unregistered_athlete.
--
--   "¿Ya tiene plan real?" también aplica acá para enrolled_unregistered —
--   alguien sin `profiles` pero con un plan real (session_pack/membership)
--   sin cuenta todavía no tiene a dónde loguearse, así que el mensaje es
--   "contactá a la escuela", no un redirect. trial_class_self_has_active_plan
--   se extiende con un tercer parámetro (default NULL, no rompe los dos
--   callers existentes que lo llaman posicional con 2 argumentos + NULL).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Capacidad protegida por el motor (advisory lock + upsert atómico), no
--     por una validación previa en el BFF.
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. trial_class_bookings.created_by: nullable — un booking público no
--    tiene ningún profile detrás (nadie logueado). El resto de la app
--    (owner, self-service) sigue mandando siempre un valor real.
-- ============================================================

ALTER TABLE public.trial_class_bookings
  ALTER COLUMN created_by DROP NOT NULL;

-- ============================================================
-- 2. trial_class_self_has_active_plan: +1 parámetro (unregistered_athlete_id)
--    para poder chequear también al identificado por el link público.
--    Firma vieja (2 uuid) queda cubierta por el default NULL del nuevo — los
--    dos callers existentes (trial_class_self_create) no cambian.
-- ============================================================

CREATE OR REPLACE FUNCTION public.trial_class_self_has_active_plan(
  p_school_id               uuid,
  p_child_id                uuid DEFAULT NULL,
  p_user_id                 uuid DEFAULT NULL,
  p_unregistered_athlete_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.offering_plans op ON op.id = e.offering_plan_id
    JOIN public.offerings o ON o.id = op.offering_id
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND o.offering_type <> 'single_session'
      AND (
        (p_child_id IS NOT NULL AND e.child_id = p_child_id)
        OR (p_user_id IS NOT NULL AND e.user_id = p_user_id)
        OR (p_unregistered_athlete_id IS NOT NULL AND e.unregistered_athlete_id = p_unregistered_athlete_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.trial_class_self_has_active_plan(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_self_has_active_plan(uuid, uuid, uuid, uuid) TO service_role;

-- ============================================================
-- 3. trial_class_public_create — mismo motor de precio/slot/lazy-plan que
--    trial_class_self_create, sujeto siempre unregistered_athlete_id
--    (resuelto por el BFF tras el OTP), created_by NULL.
-- ============================================================

CREATE OR REPLACE FUNCTION public.trial_class_public_create(
  p_school_id                uuid,
  p_category_id              uuid,
  p_facility_availability_id uuid,
  p_coach_availability_id    uuid,
  p_scheduled_date           date,
  p_start_time               time,
  p_end_time                 time,
  p_unregistered_athlete_id  uuid DEFAULT NULL,
  p_prospect_name            text DEFAULT NULL,
  p_prospect_email           text DEFAULT NULL,
  p_prospect_whatsapp        text DEFAULT NULL,
  p_prospect_dob             date DEFAULT NULL,
  p_is_minor                 boolean DEFAULT false,
  p_child_name                text DEFAULT NULL
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
  v_facility_avail    record;
  v_coach_avail       record;
  v_settings          record;
  v_category          record;
  v_unregistered_id   uuid;
  v_unreg             record;
  v_enrollment_id     uuid;
  v_session_id        uuid;
  v_booking_id        uuid;
  v_is_first          boolean;
  v_price             numeric;
  v_subject_name      text;
  v_prospect_name     text;
  v_prospect_email    text;
  v_prospect_whatsapp text;
  v_final_is_minor    boolean := false;
  v_final_child_name  text;
BEGIN
  SELECT * INTO v_settings
  FROM public.school_trial_class_settings
  WHERE school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_settings.enabled OR NOT v_settings.self_service_enabled THEN
    RAISE EXCEPTION 'El agendamiento público de clases de prueba no está habilitado en esta escuela';
  END IF;

  SELECT * INTO v_category
  FROM public.trial_class_categories
  WHERE id = p_category_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_category.is_active THEN
    RAISE EXCEPTION 'Categoría de clase de prueba no encontrada';
  END IF;

  -- ── Resolver sujeto: unregistered_athlete existente, o crear uno nuevo ──
  IF p_unregistered_athlete_id IS NOT NULL THEN
    SELECT * INTO v_unreg FROM public.unregistered_athletes
    WHERE id = p_unregistered_athlete_id AND school_id = p_school_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Prospecto no encontrado';
    END IF;

    IF public.trial_class_self_has_active_plan(p_school_id, NULL, NULL, p_unregistered_athlete_id) THEN
      RAISE EXCEPTION 'has_active_plan: % ya es miembro con un plan activo en esta escuela — contactá directamente a la escuela para gestionar tus clases', v_unreg.full_name;
    END IF;

    v_unregistered_id   := v_unreg.id;
    v_subject_name       := v_unreg.full_name;
    v_prospect_name      := coalesce(v_unreg.guardian_full_name, v_unreg.full_name);
    v_prospect_email     := coalesce(v_unreg.guardian_email, v_unreg.email);
    v_prospect_whatsapp  := coalesce(v_unreg.guardian_phone, v_unreg.phone);
    v_final_is_minor     := v_unreg.guardian_full_name IS NOT NULL;
    v_final_child_name   := CASE WHEN v_final_is_minor THEN v_unreg.full_name ELSE NULL END;

  ELSE
    IF btrim(coalesce(p_prospect_name, '')) = ''
       OR btrim(coalesce(p_prospect_email, '')) = ''
       OR btrim(coalesce(p_prospect_whatsapp, '')) = '' THEN
      RAISE EXCEPTION 'Nombre, correo y WhatsApp son obligatorios';
    END IF;
    IF p_is_minor AND (p_child_name IS NULL OR btrim(p_child_name) = '') THEN
      RAISE EXCEPTION 'El nombre del hijo/a es obligatorio cuando el prospecto es menor de edad';
    END IF;

    IF p_is_minor THEN
      SELECT id INTO v_unregistered_id FROM public.unregistered_athletes
      WHERE school_id = p_school_id AND guardian_phone = p_prospect_whatsapp AND full_name = p_child_name
      LIMIT 1;
      IF v_unregistered_id IS NULL THEN
        INSERT INTO public.unregistered_athletes (school_id, full_name, guardian_full_name, guardian_email, guardian_phone)
        VALUES (p_school_id, p_child_name, p_prospect_name, p_prospect_email, p_prospect_whatsapp)
        RETURNING id INTO v_unregistered_id;
      END IF;
      v_subject_name := p_child_name;
    ELSE
      SELECT id INTO v_unregistered_id FROM public.unregistered_athletes
      WHERE school_id = p_school_id AND phone = p_prospect_whatsapp AND full_name = p_prospect_name
      LIMIT 1;
      IF v_unregistered_id IS NULL THEN
        INSERT INTO public.unregistered_athletes (school_id, full_name, email, phone, date_of_birth)
        VALUES (p_school_id, p_prospect_name, p_prospect_email, p_prospect_whatsapp, p_prospect_dob)
        RETURNING id INTO v_unregistered_id;
      END IF;
      v_subject_name := p_prospect_name;
    END IF;

    v_prospect_name := p_prospect_name;
    v_prospect_email := p_prospect_email;
    v_prospect_whatsapp := p_prospect_whatsapp;
    v_final_is_minor := p_is_minor;
    v_final_child_name := CASE WHEN p_is_minor THEN p_child_name ELSE NULL END;
  END IF;

  v_is_first := public.trial_class_self_is_first(p_school_id, NULL, NULL, v_unregistered_id);

  IF v_is_first THEN
    v_price := v_category.price;
  ELSE
    IF NOT v_category.allow_repeat THEN
      RAISE EXCEPTION 'Esta categoría no permite agendar otra clase de prueba';
    END IF;
    v_price := coalesce(v_category.repeat_price, 0);
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

  -- Mismo motivo que trial_class_self_create: una repetición reusa el mismo
  -- offering_plan_id de la categoría, y ese enrollment anterior nunca se
  -- cierra solo.
  UPDATE public.enrollments
  SET status = 'completed', updated_at = now()
  WHERE offering_plan_id = v_category.offering_plan_id
    AND status = 'active'
    AND unregistered_athlete_id = v_unregistered_id;

  INSERT INTO public.enrollments (school_id, unregistered_athlete_id, offering_plan_id, status, sessions_used)
  VALUES (p_school_id, v_unregistered_id, v_category.offering_plan_id, 'active', 0)
  RETURNING id INTO v_enrollment_id;

  INSERT INTO public.attendance_sessions (
    school_id, facility_id, facility_availability_id, coach_id,
    offering_id, session_date, start_time, end_time,
    max_capacity, current_bookings, is_bookable, finalized, requires_capacity_check,
    title
  ) VALUES (
    p_school_id, v_facility_avail.facility_id, p_facility_availability_id, v_coach_avail.coach_id,
    (SELECT offering_id FROM public.offering_plans WHERE id = v_category.offering_plan_id),
    p_scheduled_date, p_start_time, p_end_time,
    1, 0, true, false, true,
    'Clase de prueba - ' || v_subject_name
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.session_bookings (
    school_id, session_id, unregistered_athlete_id,
    is_secondary, booking_type, status,
    price, payment_status, payment_provider
  ) VALUES (
    p_school_id, v_session_id, v_unregistered_id,
    false, 'trial_class', 'confirmed',
    v_price, CASE WHEN v_price > 0 THEN 'pending' ELSE 'free' END, NULL
  );

  PERFORM public.move_session_credit(v_enrollment_id, 1, false);

  IF v_price > 0 AND v_settings.payment_mode IN ('manual','gateway') THEN
    BEGIN
      INSERT INTO public.payments (
        school_id, branch_id, unregistered_athlete_id, offering_plan_id,
        amount, concept, due_date, status, payment_type, period_year, period_month
      ) VALUES (
        p_school_id, NULL, v_unregistered_id, v_category.offering_plan_id,
        v_price, 'Clase de prueba — ' || v_category.name || ' — ' || v_subject_name,
        p_scheduled_date, 'pending', 'one_time', NULL, NULL
      );
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'payment_period_conflict: ya hay un cobro activo para % este mes — coordiná el pago directamente con la escuela', v_subject_name;
    END;
  END IF;

  INSERT INTO public.trial_class_bookings (
    school_id, category_id, facility_id, coach_id, attendance_session_id, enrollment_id,
    unregistered_athlete_id,
    prospect_name, prospect_email, prospect_whatsapp,
    is_minor, child_name,
    scheduled_date, start_time, end_time, price_charged, status,
    created_by
  ) VALUES (
    p_school_id, v_category.id, v_facility_avail.facility_id, v_coach_avail.coach_id, v_session_id, v_enrollment_id,
    v_unregistered_id,
    coalesce(v_prospect_name, ''), coalesce(v_prospect_email, ''), coalesce(v_prospect_whatsapp, ''),
    v_final_is_minor, v_final_child_name,
    p_scheduled_date, p_start_time, p_end_time, v_price, 'agendada',
    NULL
  )
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT v_booking_id, v_price, v_is_first, v_settings.payment_mode;
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_public_create(uuid, uuid, uuid, uuid, date, time, time, uuid, text, text, text, date, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_public_create(uuid, uuid, uuid, uuid, date, time, time, uuid, text, text, text, date, boolean, text) TO service_role;

COMMIT;
