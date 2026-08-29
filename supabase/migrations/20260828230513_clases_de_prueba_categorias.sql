-- =============================================================================
-- 20260828230513_clases_de_prueba_categorias.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260828230512
-- Objetivo: el owner puede crear varias "categorías" de clase de prueba
--   (nombre + descripción + precio propio) en vez de un único precio por
--   escuela — pedido para poder ofrecer, ej. "Clase individual" vs "Clase
--   grupal de bienvenida" con precios distintos. También agrega
--   trial_class_reschedule_booking (reprogramar fecha/hora de una clase ya
--   agendada, sin cambiar cancha ni entrenador) para que BFF pueda notificar
--   por correo + armar el WhatsApp al reprogramar, igual que ya hace al
--   cancelar/crear. Ver docs/specs/clases-de-prueba-agenda-owner.md.
--
--   Estado antes de esta migración (verificado contra la base viva,
--   2026-08-29): 1 sola fila en school_trial_class_settings y 1 solo
--   booking — cero uso real todavía, así que la migración de datos abajo
--   es solo por prolijidad, no por volumen.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
--   · RLS con CERO policies de escritura: toda mutación pasa por RPC
--     SECURITY DEFINER, restringida DIRECTO a service_role (lección de
--     20260827190429/20260827191307: escribirlo bien de una, no revocar
--     anon/authenticated en una migración de hardening aparte).
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. TABLA: trial_class_categories
-- ============================================================

CREATE TABLE public.trial_class_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (btrim(name) <> ''),
  description     text,
  price           numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active       boolean NOT NULL DEFAULT true,
  offering_plan_id uuid REFERENCES public.offering_plans(id),  -- lazy init, un plan $0/1-sesión POR categoría
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trial_class_categories_school ON public.trial_class_categories(school_id);

-- Nombres únicos solo entre las categorías ACTIVAS de una escuela — una
-- desactivada no bloquea reusar su nombre (evita fricción al "borrar y
-- recrear" con el mismo nombre).
CREATE UNIQUE INDEX idx_trial_class_categories_school_active_name
  ON public.trial_class_categories (school_id, lower(name)) WHERE is_active;

CREATE TRIGGER trg_trial_class_categories_touch
  BEFORE UPDATE ON public.trial_class_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_trial_class_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.trial_class_categories
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

ALTER TABLE public.trial_class_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY trial_class_categories_select_admin
  ON public.trial_class_categories FOR SELECT
  USING (public.is_school_admin(school_id));

-- Sin policies de INSERT/UPDATE/DELETE a propósito: solo vía RPC
-- SECURITY DEFINER restringida a service_role (sección 4).

-- ============================================================
-- 2. trial_class_bookings: liga a la categoría elegida
-- ============================================================

ALTER TABLE public.trial_class_bookings
  ADD COLUMN category_id uuid REFERENCES public.trial_class_categories(id) ON DELETE RESTRICT;

-- ============================================================
-- 3. Migración de datos: la config de precio único por escuela pasa a ser
--    una categoría "Clase de Prueba General" con ese mismo precio y el
--    mismo offering_plan_id ya lazy-creado (no se pierde el vínculo con
--    enrollments/offering_plans existentes).
-- ============================================================

DO $$
DECLARE
  v_settings record;
  v_category_id uuid;
BEGIN
  FOR v_settings IN SELECT * FROM public.school_trial_class_settings LOOP
    INSERT INTO public.trial_class_categories (school_id, name, description, price, is_active, offering_plan_id)
    VALUES (
      v_settings.school_id,
      'Clase de Prueba General',
      NULL,
      v_settings.price,
      true,
      v_settings.trial_offering_plan_id
    )
    RETURNING id INTO v_category_id;

    UPDATE public.trial_class_bookings
    SET category_id = v_category_id
    WHERE school_id = v_settings.school_id
      AND category_id IS NULL;
  END LOOP;
END $$;

-- Cualquier booking huérfano (escuela sin fila de settings, no debería
-- existir por el ON CONFLICT DO NOTHING de la RPC de creación, pero se
-- verifica explícito antes de endurecer la columna a NOT NULL).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.trial_class_bookings WHERE category_id IS NULL) THEN
    RAISE EXCEPTION 'Hay trial_class_bookings sin category_id tras la migración de datos — revisar antes de continuar';
  END IF;
END $$;

ALTER TABLE public.trial_class_bookings
  ALTER COLUMN category_id SET NOT NULL;

-- El precio y el plan lazy-creado ahora viven en la categoría; la config de
-- escuela se queda solo con el interruptor global y la aprobación.
ALTER TABLE public.school_trial_class_settings
  DROP COLUMN price,
  DROP COLUMN trial_offering_plan_id;

-- trial_class_save_settings referenciaba la columna price que se acaba de
-- borrar — nuevo signature sin p_price, requiere DROP por cambio de firma.
DROP FUNCTION IF EXISTS public.trial_class_save_settings(uuid, boolean, numeric, boolean);

CREATE OR REPLACE FUNCTION public.trial_class_save_settings(
  p_school_id uuid,
  p_enabled boolean,
  p_requires_approval boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  INSERT INTO public.school_trial_class_settings (school_id, enabled, requires_approval)
  VALUES (p_school_id, p_enabled, p_requires_approval)
  ON CONFLICT (school_id) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        requires_approval = EXCLUDED.requires_approval,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_save_settings(uuid, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_save_settings(uuid, boolean, boolean) TO service_role;

-- ============================================================
-- 4. RPCs — todas SECURITY DEFINER, restringidas DIRECTO a service_role.
--    La autorización (admin vs. coach, qué transición permite cada rol)
--    vive en el BFF (bff/src/routes/trial-classes.ts), igual que el resto
--    de las RPCs trial_class_* desde 20260827191307_clases_de_prueba_fix_bff_auth.
-- ============================================================

-- 4.1 Crear o editar una categoría (upsert por id opcional).
CREATE OR REPLACE FUNCTION public.trial_class_category_upsert(
  p_school_id   uuid,
  p_name        text,
  p_price       numeric,
  p_id          uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_is_active   boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'El nombre de la categoría es obligatorio';
  END IF;
  IF p_price IS NULL OR p_price < 0 THEN
    RAISE EXCEPTION 'El precio no puede ser negativo';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.trial_class_categories (school_id, name, description, price, is_active)
    VALUES (p_school_id, btrim(p_name), NULLIF(btrim(coalesce(p_description, '')), ''), p_price, p_is_active)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.trial_class_categories
    SET name = btrim(p_name),
        description = NULLIF(btrim(coalesce(p_description, '')), ''),
        price = p_price,
        is_active = p_is_active,
        updated_at = now()
    WHERE id = p_id AND school_id = p_school_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Categoría no encontrada';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_category_upsert(uuid, text, numeric, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_category_upsert(uuid, text, numeric, uuid, text, boolean) TO service_role;

-- 4.2 Activar/desactivar sin tocar el resto de los campos (borrado lógico:
--     una categoría con bookings históricos no se puede borrar físico por
--     el ON DELETE RESTRICT de trial_class_bookings.category_id).
CREATE OR REPLACE FUNCTION public.trial_class_category_set_active(
  p_school_id uuid,
  p_id        uuid,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.trial_class_categories
  SET is_active = p_is_active, updated_at = now()
  WHERE id = p_id AND school_id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría no encontrada';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_category_set_active(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_category_set_active(uuid, uuid, boolean) TO service_role;

-- 4.3 trial_class_create_booking: nuevo signature (+p_category_id). Precio y
--     offering_plan salen de la categoría, ya no de school_trial_class_settings.
--     Requiere DROP por cambio de firma.
DROP FUNCTION IF EXISTS public.trial_class_create_booking(uuid, uuid, uuid, date, time, time, text, text, text, uuid, boolean, text);

CREATE OR REPLACE FUNCTION public.trial_class_create_booking(
  p_school_id                uuid,
  p_category_id              uuid,
  p_facility_availability_id uuid,
  p_coach_availability_id    uuid,
  p_scheduled_date           date,
  p_start_time               time,
  p_end_time                 time,
  p_prospect_name            text,
  p_prospect_email           text,
  p_prospect_whatsapp        text,
  p_created_by               uuid,
  p_is_minor                 boolean DEFAULT false,
  p_child_name                text DEFAULT NULL
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
  v_category        record;
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

  SELECT * INTO v_category
  FROM public.trial_class_categories
  WHERE id = p_category_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría de clase de prueba no encontrada';
  END IF;
  IF NOT v_category.is_active THEN
    RAISE EXCEPTION 'Esta categoría de clase de prueba ya no está disponible';
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

  SELECT * INTO v_settings
  FROM public.school_trial_class_settings
  WHERE school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_settings.enabled THEN
    RAISE EXCEPTION 'Las clases de prueba no están habilitadas para esta escuela';
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
  VALUES (p_school_id, v_unregistered_id, v_category.offering_plan_id, 'active', 0)
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
    v_category.price, CASE WHEN v_category.price > 0 THEN 'pending' ELSE 'free' END, NULL
  );

  PERFORM public.move_session_credit(v_enrollment_id, 1, false);

  SELECT name INTO v_school_name FROM public.schools WHERE id = p_school_id;
  SELECT name INTO v_facility_name FROM public.facilities WHERE id = v_facility_avail.facility_id;
  SELECT full_name INTO v_coach_name FROM public.school_staff WHERE id = v_coach_avail.coach_id;

  v_price_line := CASE WHEN v_category.price > 0
    THEN format(' El costo de la clase es $%s.', v_category.price)
    ELSE '' END;

  v_child_line := CASE WHEN p_is_minor THEN format(' de %s', p_child_name) ELSE '' END;

  v_whatsapp_msg := format(
    'Hola %s, confirmamos tu clase de prueba%s en %s el %s a las %s en %s con el entrenador %s.%s ¡Te esperamos!',
    p_prospect_name, v_child_line, coalesce(v_school_name, ''), to_char(p_scheduled_date, 'DD/MM/YYYY'),
    to_char(p_start_time, 'HH24:MI'), coalesce(v_facility_name, ''), coalesce(v_coach_name, ''), v_price_line
  );

  INSERT INTO public.trial_class_bookings (
    school_id, category_id, facility_id, coach_id, attendance_session_id, enrollment_id, unregistered_athlete_id,
    prospect_name, prospect_email, prospect_whatsapp, is_minor, child_name,
    scheduled_date, start_time, end_time, price_charged, status,
    whatsapp_message, created_by
  ) VALUES (
    p_school_id, v_category.id, v_facility_avail.facility_id, v_coach_avail.coach_id, v_session_id, v_enrollment_id, v_unregistered_id,
    p_prospect_name, p_prospect_email, p_prospect_whatsapp, p_is_minor, p_child_name,
    p_scheduled_date, p_start_time, p_end_time, v_category.price, 'agendada',
    v_whatsapp_msg, p_created_by
  )
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT v_booking_id, v_whatsapp_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_create_booking(uuid, uuid, uuid, uuid, date, time, time, text, text, text, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_create_booking(uuid, uuid, uuid, uuid, date, time, time, text, text, text, uuid, boolean, text) TO service_role;

-- 4.4 Reprogramar (solo fecha/hora; cancha y entrenador quedan fijos —
--     cambiarlos es "otra clase", no "editarla"). Solo si sigue 'agendada'.
CREATE OR REPLACE FUNCTION public.trial_class_reschedule_booking(
  p_id                        uuid,
  p_school_id                 uuid,
  p_facility_availability_id  uuid,
  p_coach_availability_id     uuid,
  p_new_date                  date,
  p_new_start_time            time,
  p_new_end_time              time
)
RETURNS TABLE (
  whatsapp_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_booking        record;
  v_facility_avail record;
  v_coach_avail    record;
  v_school_name    text;
  v_facility_name  text;
  v_coach_name     text;
  v_whatsapp_msg   text;
  v_price_line     text;
  v_child_line     text;
BEGIN
  SELECT * INTO v_booking
  FROM public.trial_class_bookings
  WHERE id = p_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clase de prueba no encontrada';
  END IF;
  IF v_booking.status <> 'agendada' THEN
    RAISE EXCEPTION 'Solo se puede reprogramar una clase en estado agendada';
  END IF;

  SELECT * INTO v_facility_avail
  FROM public.facility_availability
  WHERE id = p_facility_availability_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disponibilidad de instalación no encontrada';
  END IF;
  IF v_facility_avail.facility_id <> v_booking.facility_id THEN
    RAISE EXCEPTION 'No se puede cambiar la cancha al reprogramar — cancela y agenda una nueva';
  END IF;

  SELECT * INTO v_coach_avail
  FROM public.coach_availability
  WHERE id = p_coach_availability_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disponibilidad de entrenador no encontrada';
  END IF;
  IF v_coach_avail.coach_id <> v_booking.coach_id THEN
    RAISE EXCEPTION 'No se puede cambiar el entrenador al reprogramar — cancela y agenda una nueva';
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

  SELECT name INTO v_school_name FROM public.schools WHERE id = p_school_id;
  SELECT name INTO v_facility_name FROM public.facilities WHERE id = v_booking.facility_id;
  SELECT full_name INTO v_coach_name FROM public.school_staff WHERE id = v_booking.coach_id;

  v_price_line := CASE WHEN v_booking.price_charged > 0
    THEN format(' El costo de la clase es $%s.', v_booking.price_charged)
    ELSE '' END;
  v_child_line := CASE WHEN v_booking.is_minor THEN format(' de %s', v_booking.child_name) ELSE '' END;

  v_whatsapp_msg := format(
    'Hola %s, tu clase de prueba%s en %s fue reprogramada para el %s a las %s en %s con el entrenador %s.%s ¡Te esperamos!',
    v_booking.prospect_name, v_child_line, coalesce(v_school_name, ''), to_char(p_new_date, 'DD/MM/YYYY'),
    to_char(p_new_start_time, 'HH24:MI'), coalesce(v_facility_name, ''), coalesce(v_coach_name, ''), v_price_line
  );

  RETURN QUERY SELECT v_whatsapp_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.trial_class_reschedule_booking(uuid, uuid, uuid, uuid, date, time, time) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_class_reschedule_booking(uuid, uuid, uuid, uuid, date, time, time) TO service_role;

COMMIT;
