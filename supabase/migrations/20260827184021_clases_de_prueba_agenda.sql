-- =============================================================================
-- 20260827184021_clases_de_prueba_agenda.sql
-- Autor: judegor99   Fecha: 2026-08-27   Versión anterior: 20260827144226
-- Objetivo: Fase 1 (backend) de "Agenda de Clases de Prueba" — permite al
--   owner/admin agendar, desde el módulo de instalaciones, una clase de
--   prueba para un prospecto, atada a la disponibilidad de una cancha
--   (facility_availability) Y de un entrenador (coach_availability) a la
--   vez. Ver spec: docs/specs/clases-de-prueba-agenda-owner.md
--
--   Es hermano de school_courtesy_settings, no lo reemplaza ni lo toca:
--   la cortesía es pública/gratis/sin coach; la prueba es owner-iniciada,
--   con precio configurable por escuela, y sí queda ligada a un coach.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
--   · RLS con CERO policies de escritura: toda mutación pasa por RPC
--     SECURITY DEFINER (mismo patrón que school_signup_leads).
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. TABLAS
-- ============================================================

-- 1.1 Config por escuela (precio + habilitación del módulo)
CREATE TABLE public.school_trial_class_settings (
  school_id               uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  enabled                 boolean NOT NULL DEFAULT true,
  price                   numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  requires_approval       boolean NOT NULL DEFAULT false,  -- reservado para un futuro flujo público; sin efecto en v1 (owner-iniciado)
  trial_offering_plan_id  uuid REFERENCES public.offering_plans(id),  -- lazy init, mismo patrón que school_courtesy_settings.courtesy_offering_plan_id
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.2 Agenda de pruebas
CREATE TABLE public.trial_class_bookings (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                 uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  facility_id               uuid NOT NULL REFERENCES public.facilities(id) ON DELETE RESTRICT,
  coach_id                  uuid NOT NULL REFERENCES public.school_staff(id) ON DELETE RESTRICT,
  attendance_session_id     uuid REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
  enrollment_id             uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  unregistered_athlete_id   uuid REFERENCES public.unregistered_athletes(id) ON DELETE SET NULL,
  prospect_name             text NOT NULL,
  prospect_email            text NOT NULL,
  prospect_whatsapp         text NOT NULL,
  scheduled_date            date NOT NULL,
  start_time                time NOT NULL,
  end_time                  time NOT NULL,
  price_charged             numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_charged >= 0),
  status                    text NOT NULL DEFAULT 'agendada'
                              CHECK (status IN ('agendada','realizada','no_show','cancelada','convertida')),
  cancel_reason             text,
  confirmation_email_sent_at timestamptz,
  whatsapp_message          text,
  created_by                uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trial_bookings_school_date   ON public.trial_class_bookings(school_id, scheduled_date);
CREATE INDEX idx_trial_bookings_coach_date    ON public.trial_class_bookings(coach_id, scheduled_date);
CREATE INDEX idx_trial_bookings_school_status ON public.trial_class_bookings(school_id, status);

-- ============================================================
-- 2. TRIGGERS (updated_at + auditoría genérica)
-- ============================================================

CREATE TRIGGER trg_school_trial_class_settings_touch
  BEFORE UPDATE ON public.school_trial_class_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sin trigger de audit_trigger_func() en esta tabla: es school_id-keyed sin
-- columna id propia, y audit_trigger_func() hace NEW.id/OLD.id sin condicional
-- (falla con "record has no field id"). Mismo patrón que su hermana
-- school_courtesy_settings, que tampoco lleva auditoría genérica. Verificado
-- en vivo: intentarlo revienta el INSERT/UPDATE completo.

CREATE TRIGGER trg_trial_class_bookings_touch
  BEFORE UPDATE ON public.trial_class_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_trial_class_bookings
  AFTER INSERT OR UPDATE OR DELETE ON public.trial_class_bookings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ============================================================
-- 3. RLS — solo lectura por policy; toda escritura vía RPC SECURITY DEFINER
-- ============================================================

ALTER TABLE public.school_trial_class_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_trial_class_settings_select_admin
  ON public.school_trial_class_settings FOR SELECT
  USING (public.is_school_admin(school_id));

ALTER TABLE public.trial_class_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY trial_class_bookings_select_admin_or_coach
  ON public.trial_class_bookings FOR SELECT
  USING (
    public.is_school_admin(school_id)
    OR EXISTS (
      SELECT 1 FROM public.school_staff ss
      WHERE ss.id = trial_class_bookings.coach_id
        AND ss.coach_auth_id = auth.uid()
    )
  );

-- Sin policies de INSERT/UPDATE/DELETE a propósito: authenticated no puede
-- escribir estas tablas directo. Todo pasa por las RPCs de la sección 4,
-- que corren SECURITY DEFINER (bypass de RLS como dueño de la función).

-- ============================================================
-- 4. RPCs
-- ============================================================

-- 4.1 Configuración (solo admin)
CREATE OR REPLACE FUNCTION public.trial_class_save_settings(
  p_school_id uuid,
  p_enabled boolean,
  p_price numeric,
  p_requires_approval boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.is_school_admin(p_school_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_price < 0 THEN
    RAISE EXCEPTION 'El precio no puede ser negativo';
  END IF;

  INSERT INTO public.school_trial_class_settings (school_id, enabled, price, requires_approval)
  VALUES (p_school_id, p_enabled, p_price, p_requires_approval)
  ON CONFLICT (school_id) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        price = EXCLUDED.price,
        requires_approval = EXCLUDED.requires_approval,
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.trial_class_save_settings(uuid, boolean, numeric, boolean) TO authenticated;

-- 4.2 Slots conjuntos: intersecta facility_availability x coach_availability,
--     y descarta lo ya ocupado en attendance_sessions (por cancha o por coach).
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
  IF NOT public.is_school_admin(p_school_id) THEN
    RAISE EXCEPTION 'No autorizado';
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

GRANT EXECUTE ON FUNCTION public.trial_class_get_joint_slots(uuid, uuid, uuid, date, date) TO authenticated;

-- 4.3 Crear la reserva — transaccional, con locks explícitos para que dos
--     intentos de agendar el mismo slot cancha+coach no puedan chocar.
CREATE OR REPLACE FUNCTION public.trial_class_create_booking(
  p_school_id uuid,
  p_facility_availability_id uuid,
  p_coach_availability_id uuid,
  p_scheduled_date date,
  p_start_time time,
  p_end_time time,
  p_prospect_name text,
  p_prospect_email text,
  p_prospect_whatsapp text
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
BEGIN
  IF NOT public.is_school_admin(p_school_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_prospect_name IS NULL OR btrim(p_prospect_name) = ''
     OR p_prospect_email IS NULL OR btrim(p_prospect_email) = ''
     OR p_prospect_whatsapp IS NULL OR btrim(p_prospect_whatsapp) = '' THEN
    RAISE EXCEPTION 'Nombre, correo y WhatsApp del prospecto son obligatorios';
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

  -- Cierra la ventana de carrera para cualquier otro intento sobre esta
  -- misma combinación cancha+coach+fecha, sin depender de un índice único
  -- de attendance_sessions que no está garantizado en el historial de
  -- migraciones (posible drift — ver docs/gotchas-tecnicos.md).
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
        (ases.facility_id = v_facility_avail.facility_id AND ases.start_time < p_end_time AND ases.end_time > p_start_time)
        OR
        (ases.coach_id = v_coach_avail.coach_id AND ases.start_time < p_end_time AND ases.end_time > p_start_time)
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

  -- Lazy init del plan de prueba — precio SIEMPRE $0 en el plan: el precio
  -- real que cobra la escuela en persona vive solo en price_charged (v1 no
  -- integra cobro, ver spec §7/§9).
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

  -- Dedupe del prospecto por escuela + WhatsApp (mismo criterio que el flujo
  -- público de cortesía en public-booking.routes.ts)
  SELECT id INTO v_unregistered_id
  FROM public.unregistered_athletes
  WHERE school_id = p_school_id AND phone = p_prospect_whatsapp
  LIMIT 1;

  IF v_unregistered_id IS NULL THEN
    INSERT INTO public.unregistered_athletes (school_id, full_name, email, phone)
    VALUES (p_school_id, p_prospect_name, p_prospect_email, p_prospect_whatsapp)
    RETURNING id INTO v_unregistered_id;
  END IF;

  -- Un enrollment nuevo por cada prueba agendada (no se reusa entre pruebas
  -- del mismo prospecto — cada una es su propio plan de 1 sesión)
  INSERT INTO public.enrollments (school_id, unregistered_athlete_id, offering_plan_id, status, sessions_used)
  VALUES (p_school_id, v_unregistered_id, v_plan_id, 'active', 0)
  RETURNING id INTO v_enrollment_id;

  -- NOTA de drift (verificado contra la base viva antes de aplicar):
  -- attendance_sessions tiene CHECK chk_resource_exclusive — no puede llevar
  -- coach_availability_id Y facility_availability_id a la vez. Esta sesión
  -- nace de la instalación (facility_availability_id); el vínculo con el
  -- coach queda solo por coach_id (columna libre de esa restricción).
  INSERT INTO public.attendance_sessions (
    school_id, facility_id, facility_availability_id, coach_id,
    offering_id, session_date, start_time, end_time,
    max_capacity, current_bookings, is_bookable, finalized, requires_capacity_check,
    title, created_by
  ) VALUES (
    p_school_id, v_facility_avail.facility_id, p_facility_availability_id, v_coach_avail.coach_id,
    v_offering_id, p_scheduled_date, p_start_time, p_end_time,
    1, 0, true, false, true,
    'Clase de prueba - ' || p_prospect_name, auth.uid()
  )
  RETURNING id INTO v_session_id;

  -- NOTA de drift: session_bookings tiene CHECK chk_booking_identity — si
  -- unregistered_athlete_id va seteado, enrollment_id/user_id/child_id deben
  -- ser NULL (son modos mutuamente excluyentes). El trigger vigente
  -- trg_process_session_booking valida aforo (FOR UPDATE sobre la sesión) y
  -- trg_sync_session_capacity incrementa current_bookings al insertar.
  INSERT INTO public.session_bookings (
    school_id, session_id, unregistered_athlete_id,
    is_secondary, booking_type, status,
    price, payment_status, payment_provider
  ) VALUES (
    p_school_id, v_session_id, v_unregistered_id,
    false, 'trial_class', 'confirmed',
    v_settings.price, CASE WHEN v_settings.price > 0 THEN 'pending' ELSE 'free' END, NULL
  );

  -- El descuento de sessions_used no lo hace ningún trigger (ver comentario
  -- vigente en fn_deduct_sessions_on_finalize) — el mecanismo actual es esta
  -- RPC, ya usada por el flujo de cortesía público, con su propio FOR UPDATE.
  PERFORM public.move_session_credit(v_enrollment_id, 1, false);

  SELECT name INTO v_school_name FROM public.schools WHERE id = p_school_id;
  SELECT name INTO v_facility_name FROM public.facilities WHERE id = v_facility_avail.facility_id;
  SELECT full_name INTO v_coach_name FROM public.school_staff WHERE id = v_coach_avail.coach_id;

  v_price_line := CASE WHEN v_settings.price > 0
    THEN format(' El costo de la clase es $%s.', v_settings.price)
    ELSE '' END;

  v_whatsapp_msg := format(
    'Hola %s, confirmamos tu clase de prueba en %s el %s a las %s en %s con el entrenador %s.%s ¡Te esperamos!',
    p_prospect_name, coalesce(v_school_name, ''), to_char(p_scheduled_date, 'DD/MM/YYYY'),
    to_char(p_start_time, 'HH24:MI'), coalesce(v_facility_name, ''), coalesce(v_coach_name, ''), v_price_line
  );

  INSERT INTO public.trial_class_bookings (
    school_id, facility_id, coach_id, attendance_session_id, enrollment_id, unregistered_athlete_id,
    prospect_name, prospect_email, prospect_whatsapp,
    scheduled_date, start_time, end_time, price_charged, status,
    whatsapp_message, created_by
  ) VALUES (
    p_school_id, v_facility_avail.facility_id, v_coach_avail.coach_id, v_session_id, v_enrollment_id, v_unregistered_id,
    p_prospect_name, p_prospect_email, p_prospect_whatsapp,
    p_scheduled_date, p_start_time, p_end_time, v_settings.price, 'agendada',
    v_whatsapp_msg, auth.uid()
  )
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT v_booking_id, v_whatsapp_msg;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trial_class_create_booking(uuid, uuid, uuid, date, time, time, text, text, text) TO authenticated;

-- 4.4 Transiciones de estado (agendada -> realizada|no_show|cancelada; realizada -> convertida)
CREATE OR REPLACE FUNCTION public.trial_class_update_status(
  p_id uuid,
  p_new_status text,
  p_cancel_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_booking       record;
  v_is_admin      boolean;
  v_is_owner_coach boolean;
BEGIN
  IF p_new_status NOT IN ('realizada','no_show','cancelada','convertida') THEN
    RAISE EXCEPTION 'Transición de estado inválida: %', p_new_status;
  END IF;

  SELECT * INTO v_booking FROM public.trial_class_bookings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clase de prueba no encontrada';
  END IF;

  v_is_admin := public.is_school_admin(v_booking.school_id);
  v_is_owner_coach := EXISTS (
    SELECT 1 FROM public.school_staff ss
    WHERE ss.id = v_booking.coach_id AND ss.coach_auth_id = auth.uid()
  );

  IF NOT v_is_admin AND NOT v_is_owner_coach THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- cancelada/convertida son decisiones de negocio: solo admin.
  -- realizada/no_show las puede marcar también el propio coach.
  IF p_new_status IN ('cancelada','convertida') AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo un administrador puede realizar esta transición';
  END IF;

  IF p_new_status IN ('realizada','no_show','cancelada') AND v_booking.status <> 'agendada' THEN
    RAISE EXCEPTION 'Esta clase ya no está en estado agendada';
  END IF;

  IF p_new_status = 'convertida' AND v_booking.status <> 'realizada' THEN
    RAISE EXCEPTION 'Solo se puede convertir una clase ya marcada como realizada';
  END IF;

  UPDATE public.trial_class_bookings
  SET status = p_new_status,
      cancel_reason = CASE WHEN p_new_status = 'cancelada' THEN p_cancel_reason ELSE cancel_reason END,
      updated_at = now()
  WHERE id = p_id;

  -- Mantiene sincronizado attendance_sessions/session_bookings, que es lo
  -- que leen los reportes de asistencia existentes.
  IF p_new_status = 'realizada' THEN
    -- Dispara fn_deduct_sessions_on_finalize (trigger existente): marca el
    -- session_booking 'attended'. No vuelve a tocar sessions_used (ya se
    -- descontó al agendar, vía move_session_credit en 4.3).
    UPDATE public.attendance_sessions SET finalized = true WHERE id = v_booking.attendance_session_id;
  ELSIF p_new_status = 'no_show' THEN
    UPDATE public.session_bookings SET status = 'no_show', updated_at = now()
    WHERE session_id = v_booking.attendance_session_id;
  ELSIF p_new_status = 'cancelada' THEN
    -- Dispara trg_sync_session_capacity (trigger existente sobre UPDATE OF
    -- status): libera current_bookings de la sesión.
    UPDATE public.session_bookings
    SET status = 'cancelled', cancelled_reason = p_cancel_reason, cancelled_at = now()
    WHERE session_id = v_booking.attendance_session_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trial_class_update_status(uuid, text, text) TO authenticated;

COMMIT;
