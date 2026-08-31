-- =============================================================================
-- 20260829020235_trial_class_self_service_backend.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260829011715
-- Objetivo: Fase 1 (backend) de "Agendamiento unificado desde Mis Inscripciones"
--   — permite a un padre/atleta YA LOGUEADO agendar una clase de prueba desde
--   Mis Inscripciones, sin depender del owner ni del link público anónimo.
--   Ver spec: docs/specs/mis-inscripciones-agenda-clases-prueba.md
--
--   Es la tercera vía de agendar una prueba, hermana pero separada de:
--   · trial_class_create_booking (owner, autenticado como admin)
--   · public_booking_confirm_reservation (prospecto anónimo, OTP)
--   Ninguna de las dos se toca acá.
--
--   Decisiones de producto resueltas en conversación (spec §3):
--   1. Sujeto: hijo/atleta YA registrado probando otra disciplina, el propio
--      adulto logueado, o un hermano NUEVO sin registrar — los tres caminos.
--   2. Reprogramar sí, pero con ventana de corte configurable por escuela
--      (reschedule_cutoff_hours) — pasado ese punto, se gestiona con el owner.
--   3. "Primera prueba" es por ESCUELA, no por categoría/disciplina — un
--      atleta puede probar varias disciplinas, pero solo la primera de TODAS
--      cuenta como "primera vez". Repetir cae bajo allow_repeat_trial /
--      repeat_trial_price, que la escuela configura.
--   4. Cobro con 3 modos por escuela (payment_mode): gateway, manual (mismo
--      flujo que un pago manual de hoy — nace `payments` pending) o en_sede
--      (sin registro, como ya hace v1 del owner).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · RLS con CERO policies de escritura nuevas: toda mutación pasa por RPC
--     SECURITY DEFINER, restringida DIRECTO a service_role — mismo patrón que
--     el resto de la familia trial_class_* desde 20260828230513 (autorización
--     vive en el BFF, no acá, porque service_role no tiene auth.uid()). Por
--     eso cada RPC de escritura recibe `p_created_by` explícito.
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. school_trial_class_settings: 5 columnas nuevas
-- ============================================================

ALTER TABLE public.school_trial_class_settings
  ADD COLUMN self_service_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN reschedule_cutoff_hours integer NOT NULL DEFAULT 12
                                     CHECK (reschedule_cutoff_hours >= 0),
  ADD COLUMN payment_mode            text NOT NULL DEFAULT 'en_sede'
                                     CHECK (payment_mode IN ('gateway','manual','en_sede')),
  ADD COLUMN allow_repeat_trial      boolean NOT NULL DEFAULT false,
  ADD COLUMN repeat_trial_price      numeric(10,2)
                                     CHECK (repeat_trial_price IS NULL OR repeat_trial_price >= 0);

-- self_service_enabled apagado por default: opt-in por escuela, nadie ve
-- nada nuevo hasta que el owner lo prenda desde Ajustes (Fase 3, frontend).

-- ============================================================
-- 2. trial_class_bookings: sujeto ya registrado (child_id / user_id)
-- ============================================================

ALTER TABLE public.trial_class_bookings
  ADD COLUMN child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  ADD COLUMN user_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Mismo patrón de identidad excluyente que session_bookings
-- (chk_booking_identity / check_hybrid_booking): exactamente uno de los tres.
ALTER TABLE public.trial_class_bookings
  ADD CONSTRAINT chk_trial_booking_subject
  CHECK (num_nonnulls(child_id, user_id, unregistered_athlete_id) = 1);

CREATE INDEX idx_trial_bookings_child ON public.trial_class_bookings(child_id) WHERE child_id IS NOT NULL;
CREATE INDEX idx_trial_bookings_user  ON public.trial_class_bookings(user_id)  WHERE user_id IS NOT NULL;

-- ============================================================
-- 3. RPCs — todas SECURITY DEFINER, restringidas DIRECTO a service_role.
--    Las llama bff/src/routes/trial-classes-self.routes.ts (Fase 2), con
--    requireAuth y p_created_by = auth.uid() del JWT verificado.
-- ============================================================

-- 3.1 Configuración del self-service (owner/admin, vía BFF)
CREATE OR REPLACE FUNCTION public.trial_class_self_service_save_settings(
  p_school_id               uuid,
  p_self_service_enabled    boolean,
  p_reschedule_cutoff_hours integer DEFAULT 12,
  p_payment_mode            text DEFAULT 'en_sede',
  p_allow_repeat_trial      boolean DEFAULT false,
  p_repeat_trial_price      numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_payment_mode NOT IN ('gateway','manual','en_sede') THEN
    RAISE EXCEPTION 'payment_mode inválido: %', p_payment_mode;
  END IF;
  IF p_reschedule_cutoff_hours < 0 THEN
    RAISE EXCEPTION 'reschedule_cutoff_hours no puede ser negativo';
  END IF;
  IF p_repeat_trial_price IS NOT NULL AND p_repeat_trial_price < 0 THEN
    RAISE EXCEPTION 'repeat_trial_price no puede ser negativo';
  END IF;

  INSERT INTO public.school_trial_class_settings (school_id, self_service_enabled, reschedule_cutoff_hours, payment_mode, allow_repeat_trial, repeat_trial_price)
  VALUES (p_school_id, p_self_service_enabled, p_reschedule_cutoff_hours, p_payment_mode, p_allow_repeat_trial, p_repeat_trial_price)
  ON CONFLICT (school_id) DO UPDATE
    SET self_service_enabled    = EXCLUDED.self_service_enabled,
        reschedule_cutoff_hours = EXCLUDED.reschedule_cutoff_hours,
        payment_mode            = EXCLUDED.payment_mode,
        allow_repeat_trial      = EXCLUDED.allow_repeat_trial,
        repeat_trial_price      = EXCLUDED.repeat_trial_price,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_self_service_save_settings(uuid, boolean, integer, text, boolean, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_self_service_save_settings(uuid, boolean, integer, text, boolean, numeric) TO service_role;

-- 3.2 ¿Es la primera prueba de este sujeto EN ESTA ESCUELA (cualquier
--     categoría)? Reusable desde el BFF para previsualizar el precio antes
--     de confirmar, y desde 3.4 para decidirlo de verdad.
CREATE OR REPLACE FUNCTION public.trial_class_self_is_first(
  p_school_id uuid,
  p_child_id  uuid DEFAULT NULL,
  p_user_id   uuid DEFAULT NULL,
  p_unregistered_athlete_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.trial_class_bookings tcb
    WHERE tcb.school_id = p_school_id
      AND tcb.status IN ('agendada','realizada','convertida')
      AND (
        (p_child_id IS NOT NULL AND tcb.child_id = p_child_id)
        OR (p_user_id IS NOT NULL AND tcb.user_id = p_user_id)
        OR (p_unregistered_athlete_id IS NOT NULL AND tcb.unregistered_athlete_id = p_unregistered_athlete_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.trial_class_self_is_first(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_self_is_first(uuid, uuid, uuid, uuid) TO service_role;

-- 3.3 Slots conjuntos cancha+coach, disponibles para self-service (sin el
--     is_school_admin de la versión del owner — el gate acá es
--     self_service_enabled, no ser staff).
CREATE OR REPLACE FUNCTION public.trial_class_self_get_joint_slots(
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
  IF NOT EXISTS (
    SELECT 1 FROM public.school_trial_class_settings
    WHERE school_id = p_school_id AND enabled AND self_service_enabled
  ) THEN
    RAISE EXCEPTION 'El agendamiento de clases de prueba desde Mis Inscripciones no está habilitado en esta escuela';
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
        (ases.facility_id = p_facility_id AND ases.start_time < ov.ov_end AND ases.end_time > ov.ov_start)
        OR
        (ases.coach_id = p_coach_id AND ases.start_time < ov.ov_end AND ases.end_time > ov.ov_start)
      )
  )
  ORDER BY ov.the_date, ov.ov_start;
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_self_get_joint_slots(uuid, uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_self_get_joint_slots(uuid, uuid, uuid, date, date) TO service_role;

-- 3.4 Crear la reserva self-service — mismo motor que trial_class_create_booking
--     (owner) para slot/lazy-init de plan/attendance_sessions/session_bookings/
--     move_session_credit, más: resolución de sujeto (child_id/self/nuevo),
--     precio primera-vez-por-escuela vs repetición, y el cobro pendiente
--     cuando payment_mode lo pide.
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

  -- ── Resolver sujeto + autorización ────────────────────────────────────
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

    -- Anti-abuso: solo agrega un prospecto nuevo quien YA tiene una relación
    -- con la escuela (un hijo ahí, o es staff/miembro activo) — no cualquier
    -- logueado de la plataforma.
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

  -- ── Precio: primera vez por ESCUELA (no por categoría) vs repetición ──
  v_is_first := public.trial_class_self_is_first(p_school_id, v_child_id, v_user_id, v_unregistered_id);

  IF v_is_first THEN
    v_price := v_category.price;
  ELSE
    IF NOT v_settings.allow_repeat_trial THEN
      RAISE EXCEPTION 'Ya se usó la clase de prueba de esta persona en esta escuela';
    END IF;
    v_price := coalesce(v_settings.repeat_trial_price, 0);
  END IF;

  -- ── Slot: mismo motor que trial_class_create_booking (owner) ──────────
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

  -- ── Lazy init del plan de la categoría (mismo patrón que el owner) ─────
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

  -- ── Cobro pendiente si el modo de la escuela lo pide (spec §3.4) ───────
  -- 'gateway' también nace acá como `payments` pending: el checkout real lo
  -- orquesta el BFF/frontend (Fase 2/3) contra esta misma fila — la RPC no
  -- llama pasarelas.
  IF v_price > 0 AND v_settings.payment_mode IN ('manual','gateway') THEN
    INSERT INTO public.payments (
      school_id, branch_id, child_id, user_id, unregistered_athlete_id, offering_plan_id,
      amount, concept, due_date, status, payment_type, period_year, period_month
    ) VALUES (
      p_school_id, NULL, v_child_id, v_user_id, v_unregistered_id, v_category.offering_plan_id,
      v_price, 'Clase de prueba — ' || v_category.name || ' — ' || v_subject_name,
      p_scheduled_date, 'pending', 'one_time', NULL, NULL
    );
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

REVOKE ALL ON FUNCTION public.trial_class_self_create(uuid, uuid, uuid, uuid, uuid, date, time, time, uuid, boolean, text, text, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_self_create(uuid, uuid, uuid, uuid, uuid, date, time, time, uuid, boolean, text, text, text, date) TO service_role;

-- 3.5 Reprogramar — mismo motor que trial_class_reschedule_booking (owner),
--     más el chequeo de reschedule_cutoff_hours (spec §3.2/§4.2), sobre la
--     fecha VIEJA (¿todavía hay margen para tocarla?) y la NUEVA (¿el
--     horario elegido tampoco cae dentro de la ventana de corte?).
CREATE OR REPLACE FUNCTION public.trial_class_self_reschedule(
  p_id                        uuid,
  p_school_id                 uuid,
  p_created_by                uuid,
  p_facility_availability_id  uuid,
  p_coach_availability_id     uuid,
  p_new_date                  date,
  p_new_start_time            time,
  p_new_end_time              time
)
RETURNS TABLE (facility_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_booking        record;
  v_settings       record;
  v_facility_avail record;
  v_coach_avail    record;
BEGIN
  SELECT * INTO v_booking
  FROM public.trial_class_bookings
  WHERE id = p_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clase de prueba no encontrada';
  END IF;

  IF v_booking.created_by IS DISTINCT FROM p_created_by THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_booking.status <> 'agendada' THEN
    RAISE EXCEPTION 'Solo se puede reprogramar una clase en estado agendada';
  END IF;

  SELECT * INTO v_settings FROM public.school_trial_class_settings WHERE school_id = p_school_id;

  IF (v_booking.scheduled_date + v_booking.start_time) - now() < make_interval(hours => v_settings.reschedule_cutoff_hours) THEN
    RAISE EXCEPTION 'too_late_to_reschedule: quedan menos de % horas para tu clase — contactá directamente a la escuela', v_settings.reschedule_cutoff_hours;
  END IF;

  SELECT * INTO v_facility_avail
  FROM public.facility_availability
  WHERE id = p_facility_availability_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disponibilidad de instalación no encontrada';
  END IF;
  IF v_facility_avail.facility_id <> v_booking.facility_id THEN
    RAISE EXCEPTION 'No se puede cambiar la cancha al reprogramar — cancelá y agendá una nueva';
  END IF;

  SELECT * INTO v_coach_avail
  FROM public.coach_availability
  WHERE id = p_coach_availability_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disponibilidad de entrenador no encontrada';
  END IF;
  IF v_coach_avail.coach_id <> v_booking.coach_id THEN
    RAISE EXCEPTION 'No se puede cambiar el entrenador al reprogramar — cancelá y agendá una nueva';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_facility_avail.facility_id::text || ':' || v_coach_avail.coach_id::text || ':' || p_new_date::text, 0)
  );

  IF v_facility_avail.day_of_week <> EXTRACT(DOW FROM p_new_date)::int
     OR v_coach_avail.day_of_week <> EXTRACT(DOW FROM p_new_date)::int THEN
    RAISE EXCEPTION 'La fecha no corresponde al día de la disponibilidad elegida';
  END IF;

  IF p_new_start_time < v_facility_avail.start_time OR p_new_end_time > v_facility_avail.end_time
     OR p_new_start_time < v_coach_avail.start_time OR p_new_end_time > v_coach_avail.end_time THEN
    RAISE EXCEPTION 'El horario elegido está fuera de la disponibilidad de la cancha o el entrenador';
  END IF;

  IF (p_new_date + p_new_start_time) - now() < make_interval(hours => v_settings.reschedule_cutoff_hours) THEN
    RAISE EXCEPTION 'too_late_to_reschedule: el horario elegido queda a menos de % horas — elegí uno más adelante', v_settings.reschedule_cutoff_hours;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance_sessions ases
    WHERE ases.session_date = p_new_date
      AND ases.id <> v_booking.attendance_session_id
      AND (
        ases.facility_availability_id = p_facility_availability_id
        OR (ases.facility_id = v_facility_avail.facility_id AND ases.start_time < p_new_end_time AND ases.end_time > p_new_start_time)
        OR (ases.coach_id = v_coach_avail.coach_id AND ases.start_time < p_new_end_time AND ases.end_time > p_new_start_time)
      )
  ) THEN
    RAISE EXCEPTION 'Este horario ya no está disponible';
  END IF;

  UPDATE public.attendance_sessions
  SET facility_availability_id = p_facility_availability_id,
      session_date = p_new_date,
      start_time = p_new_start_time,
      end_time = p_new_end_time
  WHERE id = v_booking.attendance_session_id;

  UPDATE public.trial_class_bookings
  SET scheduled_date = p_new_date,
      start_time = p_new_start_time,
      end_time = p_new_end_time,
      updated_at = now()
  WHERE id = p_id;

  RETURN QUERY SELECT v_booking.facility_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_self_reschedule(uuid, uuid, uuid, uuid, uuid, date, time, time) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_self_reschedule(uuid, uuid, uuid, uuid, uuid, date, time, time) TO service_role;

-- 3.6 Cancelar (sin ventana de corte — cancelar siempre libera el cupo para
--     otro, a diferencia de reprogramar que podría malgastarlo a último
--     momento; el owner sigue viendo la cancelación tardía en su agenda).
CREATE OR REPLACE FUNCTION public.trial_class_self_cancel(
  p_id         uuid,
  p_school_id  uuid,
  p_created_by uuid,
  p_reason     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_booking record;
BEGIN
  SELECT * INTO v_booking
  FROM public.trial_class_bookings
  WHERE id = p_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clase de prueba no encontrada';
  END IF;

  IF v_booking.created_by IS DISTINCT FROM p_created_by THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_booking.status <> 'agendada' THEN
    RAISE EXCEPTION 'Esta clase ya no está en estado agendada';
  END IF;

  UPDATE public.trial_class_bookings
  SET status = 'cancelada', cancel_reason = p_reason, updated_at = now()
  WHERE id = p_id;

  -- Dispara trg_sync_session_capacity (trigger existente sobre UPDATE OF
  -- status): libera current_bookings de la sesión. Mismo efecto que la
  -- cancelación del owner en trial_class_update_status.
  UPDATE public.session_bookings
  SET status = 'cancelled', cancelled_reason = p_reason, cancelled_at = now()
  WHERE session_id = v_booking.attendance_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_self_cancel(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_self_cancel(uuid, uuid, uuid, text) TO service_role;

COMMIT;
