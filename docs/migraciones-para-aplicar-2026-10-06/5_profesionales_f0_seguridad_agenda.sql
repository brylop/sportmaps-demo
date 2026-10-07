-- =============================================================================
-- 20261006094145_profesionales_f0_seguridad_agenda.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006092320
-- Objetivo: F0 del spec docs/specs/profesionales-salud-fisioterapia.md.
--   1. Cierra I3 (FOR ALL sin WITH CHECK) en las tres tablas clínicas viejas y
--      en service_availability / service_variations.
--   2. health_records y wellness_evaluations (0 filas) quedan congeladas en solo
--      lectura: la historia clínica nueva vive en clinical_* (migración F1-F2).
--   3. wellness_appointments: el cliente deja de escribir directo (se insertaba
--      citas "confirmed" a nombre de cualquier profesional). Escribe el
--      profesional; el cliente reserva y cancela por RPC (F1-F2).
--   4. Columnas que el código ya usa y nunca se aplicaron (20260417000003 y
--      20260520000001, que NO se re-aplican): se recrean aquí, idempotentes.
--   5. validate_appointment_no_overlap corría con el RLS del que reserva y no
--      veía las citas de otros pacientes: ahora SECURITY DEFINER + lock.
--   6. get_available_slots: zona horaria Colombia, excepciones por fecha, solo
--      profesionales verificados, sin horas pasadas, max_daily_slots.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. health_records / wellness_evaluations → solo lectura
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS health_records_professional_or_athlete ON public.health_records;
CREATE POLICY health_records_select_own ON public.health_records
    FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()) OR athlete_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS wellness_evaluations_professional_or_athlete ON public.wellness_evaluations;
CREATE POLICY wellness_evaluations_select_own ON public.wellness_evaluations
    FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()) OR athlete_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.health_records       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.wellness_evaluations FROM anon, authenticated;
REVOKE ALL ON public.health_records       FROM anon;
REVOKE ALL ON public.wellness_evaluations FROM anon;

COMMENT ON TABLE public.health_records IS
    'CONGELADA 2026-10-06 (0 filas). La historia clínica vive en clinical_episodes / clinical_notes.';
COMMENT ON TABLE public.wellness_evaluations IS
    'CONGELADA 2026-10-06 (0 filas). Las valoraciones viven en clinical_notes (note_type = valoracion_inicial).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. wellness_appointments: columnas
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS child_id             uuid REFERENCES public.children(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS booked_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS service_listing_id   uuid REFERENCES public.service_listings(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS service_variation_id uuid REFERENCES public.service_variations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS price                numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency             text    NOT NULL DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS payment_status       text    NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS is_courtesy          boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS booking_source       text    NOT NULL DEFAULT 'direct',
    ADD COLUMN IF NOT EXISTS modality             text    NOT NULL DEFAULT 'presencial',
    ADD COLUMN IF NOT EXISTS location             text,
    ADD COLUMN IF NOT EXISTS meeting_url          text,
    ADD COLUMN IF NOT EXISTS cancellation_reason  text,
    ADD COLUMN IF NOT EXISTS cancelled_at         timestamptz,
    ADD COLUMN IF NOT EXISTS cancelled_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS confirmed_at         timestamptz,
    ADD COLUMN IF NOT EXISTS completed_at         timestamptz,
    ADD COLUMN IF NOT EXISTS reminder_sent_at     timestamptz,
    -- Lo que escribe el cliente al reservar. `notes` queda para el profesional
    -- y el cliente no la lee (get_my_appointments no la devuelve).
    ADD COLUMN IF NOT EXISTS client_notes         text;

UPDATE public.wellness_appointments SET duration_minutes = 60 WHERE duration_minutes IS NULL;
ALTER TABLE public.wellness_appointments ALTER COLUMN duration_minutes SET DEFAULT 60;
ALTER TABLE public.wellness_appointments ALTER COLUMN duration_minutes SET NOT NULL;

DO $$ BEGIN
    ALTER TABLE public.wellness_appointments ADD CONSTRAINT wellness_appointments_status_chk
        CHECK (status IN ('pending','confirmed','completed','cancelled','no_show'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.wellness_appointments ADD CONSTRAINT wellness_appointments_payment_status_chk
        CHECK (payment_status IN ('not_required','pending','paid','courtesy','refunded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.wellness_appointments ADD CONSTRAINT wellness_appointments_booking_source_chk
        CHECK (booking_source IN ('direct','marketplace','referral','invite'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.wellness_appointments ADD CONSTRAINT wellness_appointments_modality_chk
        CHECK (modality IN ('presencial','virtual','domicilio'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.wellness_appointments ADD CONSTRAINT wellness_appointments_price_chk
        CHECK (price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.wellness_appointments ADD CONSTRAINT wellness_appointments_duration_chk
        CHECK (duration_minutes BETWEEN 5 AND 600);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_wellness_apt_prof_date ON public.wellness_appointments (professional_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_wellness_apt_athlete   ON public.wellness_appointments (athlete_id) WHERE athlete_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wellness_apt_child     ON public.wellness_appointments (child_id)   WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wellness_apt_booked_by ON public.wellness_appointments (booked_by)  WHERE booked_by IS NOT NULL;

-- Embed de PostgREST profesional → profiles (el FK existente va a auth.users).
DO $$ BEGIN
    ALTER TABLE public.wellness_appointments ADD CONSTRAINT wellness_appointments_professional_profile_fkey
        FOREIGN KEY (professional_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. wellness_appointments: RLS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS wellness_appointments_access ON public.wellness_appointments;

CREATE POLICY wellness_appointments_select ON public.wellness_appointments
    FOR SELECT TO authenticated
    USING (
        professional_id = (SELECT auth.uid())
        OR athlete_id   = (SELECT auth.uid())
        OR booked_by    = (SELECT auth.uid())
        OR (child_id IS NOT NULL AND public.is_parent_of_child(child_id))
    );

-- Solo el profesional escribe en su agenda. El cliente reserva y cancela por
-- RPC (request_service_appointment / cancel_my_appointment).
CREATE POLICY wellness_appointments_insert_professional ON public.wellness_appointments
    FOR INSERT TO authenticated
    WITH CHECK (professional_id = (SELECT auth.uid()));

CREATE POLICY wellness_appointments_update_professional ON public.wellness_appointments
    FOR UPDATE TO authenticated
    USING (professional_id = (SELECT auth.uid()))
    WITH CHECK (professional_id = (SELECT auth.uid()));

REVOKE ALL ON public.wellness_appointments FROM anon;
REVOKE DELETE ON public.wellness_appointments FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Antisolapes: SECURITY DEFINER + lock por profesional y día
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_appointment_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_buffer  integer;
    v_overlap integer;
BEGIN
    IF NEW.status IN ('cancelled','no_show') THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND NEW.appointment_date = OLD.appointment_date
       AND NEW.appointment_time = OLD.appointment_time
       AND NEW.duration_minutes = OLD.duration_minutes
       AND OLD.status NOT IN ('cancelled','no_show') THEN
        RETURN NEW;  -- no cambió el horario: nada que validar
    END IF;

    -- Serializa las reservas del mismo profesional en el mismo día: sin esto,
    -- dos inserts simultáneos ven 0 choques y entran los dos.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.professional_id::text || NEW.appointment_date::text, 0));

    SELECT COALESCE((
        SELECT sa.buffer_time_minutes
        FROM public.service_availability sa
        JOIN public.vendor_profiles vp ON vp.id = sa.vendor_profile_id
        WHERE vp.user_id = NEW.professional_id AND sa.is_active
        ORDER BY sa.buffer_time_minutes
        LIMIT 1), 0) INTO v_buffer;

    SELECT count(*) INTO v_overlap
    FROM public.wellness_appointments wa
    WHERE wa.professional_id = NEW.professional_id
      AND wa.appointment_date = NEW.appointment_date
      AND wa.status NOT IN ('cancelled','no_show')
      AND wa.id IS DISTINCT FROM NEW.id
      AND NEW.appointment_time < wa.appointment_time + make_interval(mins => wa.duration_minutes + v_buffer)
      AND NEW.appointment_time + make_interval(mins => NEW.duration_minutes + v_buffer) > wa.appointment_time;

    IF v_overlap > 0 THEN
        RAISE EXCEPTION 'HORARIO_OCUPADO: el profesional ya tiene una cita en ese horario'
            USING ERRCODE = '23P01';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_appointment_no_overlap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_appointment_overlap ON public.wellness_appointments;
CREATE TRIGGER trg_validate_appointment_overlap
    BEFORE INSERT OR UPDATE ON public.wellness_appointments
    FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_no_overlap();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Disponibilidad: I3 + excepciones por fecha
-- ─────────────────────────────────────────────────────────────────────────────
ALTER POLICY service_availability_owner ON public.service_availability
    WITH CHECK (vendor_profile_id IN (SELECT vp.id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));

ALTER POLICY service_variations_owner ON public.service_variations
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.service_listings sl
        JOIN public.vendor_profiles vp ON vp.id = sl.vendor_profile_id
        WHERE sl.id = service_variations.service_listing_id AND vp.user_id = (SELECT auth.uid())));

DO $$ BEGIN
    ALTER TABLE public.service_availability ADD CONSTRAINT service_availability_rango_chk
        CHECK (end_time > start_time AND day_of_week BETWEEN 0 AND 6
               AND slot_duration_minutes BETWEEN 5 AND 600 AND buffer_time_minutes >= 0
               AND max_concurrent >= 1) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.service_availability_exceptions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    exception_date    date NOT NULL,
    start_time        time,           -- NULL = todo el día bloqueado
    end_time          time,
    reason            text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT service_availability_exceptions_rango_chk
        CHECK ((start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time > start_time))
);
CREATE INDEX IF NOT EXISTS idx_sae_vendor_date ON public.service_availability_exceptions (vendor_profile_id, exception_date);
ALTER TABLE public.service_availability_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sae_owner ON public.service_availability_exceptions;
CREATE POLICY sae_owner ON public.service_availability_exceptions
    FOR ALL TO authenticated
    USING      (vendor_profile_id IN (SELECT vp.id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())))
    WITH CHECK (vendor_profile_id IN (SELECT vp.id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));
REVOKE ALL ON public.service_availability_exceptions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_availability_exceptions TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. service_listings: columnas de 20260520000001 (nunca aplicada)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.service_listings
    ADD COLUMN IF NOT EXISTS modality        text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS target_audience text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS includes        text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS requirements    text,
    ADD COLUMN IF NOT EXISTS subcategory     text;
DO $$ BEGIN
    ALTER TABLE public.service_listings ADD CONSTRAINT service_listings_modality_valid
        CHECK (modality <@ ARRAY['presencial','virtual','domicilio','hibrido']::text[]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. get_available_slots
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_available_slots(
    p_vendor_profile_id  uuid,
    p_service_listing_id uuid DEFAULT NULL,
    p_date               date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_vendor     record;
    v_service_dur integer;
    v_max_daily  integer;
    v_block      record;
    v_dur        integer;
    v_start      time;
    v_end        time;
    v_now_local  timestamp := (now() AT TIME ZONE 'America/Bogota');
    v_slots      jsonb := '[]'::jsonb;
    v_taken      integer;
    v_day_count  integer;
BEGIN
    SELECT vp.id, vp.user_id, vp.verification_status, vp.is_active INTO v_vendor
    FROM public.vendor_profiles vp WHERE vp.id = p_vendor_profile_id;

    -- El propio profesional ve sus horarios aunque no esté verificado (para
    -- probar su agenda); el público solo los de verificados y activos.
    IF v_vendor.id IS NULL
       OR (v_vendor.user_id IS DISTINCT FROM auth.uid()
           AND (v_vendor.verification_status <> 'verified' OR NOT v_vendor.is_active)) THEN
        RETURN jsonb_build_object('slots', '[]'::jsonb, 'date', p_date, 'error', 'PROFESIONAL_NO_DISPONIBLE');
    END IF;
    IF p_date < v_now_local::date THEN
        RETURN jsonb_build_object('slots', '[]'::jsonb, 'date', p_date);
    END IF;

    IF p_service_listing_id IS NOT NULL THEN
        SELECT sl.duration_minutes, sl.max_daily_slots INTO v_service_dur, v_max_daily
        FROM public.service_listings sl
        WHERE sl.id = p_service_listing_id AND sl.vendor_profile_id = p_vendor_profile_id AND sl.is_active;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('slots', '[]'::jsonb, 'date', p_date, 'error', 'SERVICIO_NO_DISPONIBLE');
        END IF;
        IF v_max_daily IS NOT NULL THEN
            SELECT count(*) INTO v_day_count FROM public.wellness_appointments wa
            WHERE wa.service_listing_id = p_service_listing_id AND wa.appointment_date = p_date
              AND wa.status NOT IN ('cancelled','no_show');
            IF v_day_count >= v_max_daily THEN
                RETURN jsonb_build_object('slots', '[]'::jsonb, 'date', p_date, 'full', true);
            END IF;
        END IF;
    END IF;

    -- Día completo bloqueado
    IF EXISTS (SELECT 1 FROM public.service_availability_exceptions e
               WHERE e.vendor_profile_id = p_vendor_profile_id AND e.exception_date = p_date
                 AND e.start_time IS NULL) THEN
        RETURN jsonb_build_object('slots', '[]'::jsonb, 'date', p_date, 'blocked', true);
    END IF;

    FOR v_block IN
        SELECT sa.start_time, sa.end_time, sa.slot_duration_minutes, sa.buffer_time_minutes, sa.max_concurrent
        FROM public.service_availability sa
        WHERE sa.vendor_profile_id = p_vendor_profile_id
          AND sa.day_of_week = EXTRACT(DOW FROM p_date)::int
          AND sa.is_active
        ORDER BY sa.start_time
    LOOP
        -- La duración se decide por bloque: antes la del primero contaminaba al resto.
        v_dur   := COALESCE(v_service_dur, v_block.slot_duration_minutes);
        v_start := v_block.start_time;
        WHILE v_start + make_interval(mins => v_dur) <= v_block.end_time
              AND v_start + make_interval(mins => v_dur) > v_start LOOP   -- sin vuelta de medianoche
            v_end := v_start + make_interval(mins => v_dur);

            IF (p_date + v_start) > v_now_local
               AND NOT EXISTS (SELECT 1 FROM public.service_availability_exceptions e
                               WHERE e.vendor_profile_id = p_vendor_profile_id AND e.exception_date = p_date
                                 AND e.start_time IS NOT NULL
                                 AND v_start < e.end_time AND v_end > e.start_time) THEN
                SELECT count(*) INTO v_taken
                FROM public.wellness_appointments wa
                WHERE wa.professional_id = v_vendor.user_id
                  AND wa.appointment_date = p_date
                  AND wa.status NOT IN ('cancelled','no_show')
                  AND wa.appointment_time < v_end + make_interval(mins => v_block.buffer_time_minutes)
                  AND wa.appointment_time + make_interval(mins => wa.duration_minutes + v_block.buffer_time_minutes) > v_start;
                IF v_taken = 0 THEN
                    v_slots := v_slots || jsonb_build_object(
                        'start_time', to_char(v_start, 'HH24:MI'),
                        'end_time', to_char(v_end, 'HH24:MI'),
                        'duration_minutes', v_dur,
                        'available', true);
                END IF;
            END IF;
            v_start := v_start + make_interval(mins => v_dur + v_block.buffer_time_minutes);
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'slots', v_slots, 'date', p_date,
        'day_of_week', EXTRACT(DOW FROM p_date)::int,
        'vendor_profile_id', p_vendor_profile_id,
        'service_listing_id', p_service_listing_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_available_slots(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, date) TO authenticated;

COMMIT;
