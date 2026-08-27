-- =============================================================================
-- 20260825151250_school_trial_class_slots.sql
-- Autor: brylop   Fecha: 2026-08-25   Versión anterior: 20260820125510
-- Objetivo: cupos de "clase de prueba" que la escuela carga a mano y el
--   prospecto reserva desde /inscripcion/:slug, con control de capacidad real.
-- =============================================================================
-- Por qué NO se reusa attendance_sessions/coach_availability/session_bookings:
--
-- Esa maquinaria SÍ soporta "sesión reservable con cupo" (is_bookable,
-- max_capacity, current_bookings) pero es la del marketplace de entrenadores
-- personales — session_bookings carga columnas de cobro Wompi
-- (wompi_reference, payment_provider, price) que no aplican a una clase de
-- prueba gratis. Y en la práctica, para DYNASTY (school_id
-- 2d509571-3238-4c04-ac3f-6dfe20539226) esa tabla no tiene NADA que reservar:
-- 0 filas en coach_availability, 0 attendance_sessions futuras o bookable. Sus
-- 43 sesiones existentes son asistencia tomada el mismo día, no una agenda
-- armada con anticipación. No hay "disponibilidad real" ahí para engancharse.
--
-- Por qué NO se reusa el flujo SlotPicker/BookingConfirmation/TrialConfirmation
-- (frontend/src/components/athlete/*): es código huérfano. Nada lo importa en
-- ninguna página, y el comentario de `booking_holds` en la base es explícito:
-- "La define 20260311000001 §4, que quedó sin aplicar: SlotPicker fallaba
-- siempre al elegir horario."
--
-- Por eso: tabla propia y chica. La escuela carga 3-5 fechas/horas puntuales a
-- mano (no un horario recurrente — eso es otra feature, más grande, para
-- cuando haga falta) y el prospecto elige una desde el mismo formulario de
-- school_signup_leads.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC — y REVOKE explícito de anon,
--     authenticated Y public (el default de Postgres es EXECUTE a PUBLIC; ver
--     20260820125510 para el bug real que causó cuando esto se olvidó).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Stock/contadores: mutar solo dentro de RPC SECURITY DEFINER con
--     SELECT … FOR UPDATE. Nunca UPDATE de stock desde el cliente.
-- =============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Tabla
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_trial_slots (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id         uuid REFERENCES public.teams(id) ON DELETE SET NULL,  -- opcional: a qué categoría aplica
    label           text NOT NULL,          -- lo que ve el prospecto, ej. "Sub-15" o "Clase abierta"
    slot_date       date NOT NULL,
    start_time      time NOT NULL,
    end_time        time,
    location        text,
    max_capacity    integer NOT NULL DEFAULT 5 CHECK (max_capacity > 0),
    reserved_count  integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
    is_open         boolean NOT NULL DEFAULT true,   -- la escuela puede cerrarlo a mano sin borrarlo
    created_by      uuid REFERENCES public.profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT chk_school_trial_slots_capacity CHECK (reserved_count <= max_capacity)
);

CREATE INDEX IF NOT EXISTS idx_school_trial_slots_public
    ON public.school_trial_slots(school_id, slot_date)
    WHERE is_open = true;

COMMENT ON TABLE public.school_trial_slots IS
    'Cupos de clase de prueba cargados a mano por la escuela. NO es un horario recurrente ni usa attendance_sessions/coach_availability (esas cargan cobro Wompi del marketplace de entrenadores). reserved_count se muta solo desde submit_school_lead con FOR UPDATE.';

ALTER TABLE public.school_trial_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_trial_slots FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_school_trial_slots_touch ON public.school_trial_slots;
CREATE TRIGGER trg_school_trial_slots_touch
    BEFORE UPDATE ON public.school_trial_slots
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_school_trial_slots ON public.school_trial_slots;
CREATE TRIGGER trg_audit_school_trial_slots
    AFTER INSERT OR UPDATE OR DELETE ON public.school_trial_slots
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ────────────────────────────────────────────────────────────────────────────
-- 2. school_signup_leads: enlace opcional al cupo reservado
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.school_signup_leads
    ADD COLUMN IF NOT EXISTS trial_slot_id uuid REFERENCES public.school_trial_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_school_signup_leads_trial_slot
    ON public.school_signup_leads(trial_slot_id) WHERE trial_slot_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. list_open_trial_slots_public — anon. Cupos abiertos, futuros, con lugar.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_open_trial_slots_public(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_rows      jsonb;
BEGIN
    SELECT id INTO v_school_id FROM public.schools WHERE slug = p_slug;
    IF v_school_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.slot_date, t.start_time), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT id, label, slot_date, start_time, end_time, location,
               (max_capacity - reserved_count) AS spots_left
          FROM public.school_trial_slots
         WHERE school_id = v_school_id
           AND is_open = true
           AND slot_date >= CURRENT_DATE
           AND reserved_count < max_capacity
         ORDER BY slot_date, start_time
         LIMIT 20
    ) t;

    RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.list_open_trial_slots_public(text) IS
    'Cupos de clase de prueba abiertos y con lugar para /inscripcion/:slug. Anon-accesible, sin datos sensibles.';

GRANT EXECUTE ON FUNCTION public.list_open_trial_slots_public(text) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. submit_school_lead — se reemplaza para aceptar p_trial_slot_id.
--
--    OJO: agregar un parámetro cambia la lista de tipos, y Postgres identifica
--    funciones por (nombre, tipos de argumentos). CREATE OR REPLACE con un
--    parámetro nuevo NO reemplaza la función vieja de 11 args — crea un
--    SEGUNDO overload de 12 y deja el viejo vivo. Cualquier llamada que no
--    mande p_trial_slot_id quedaría ambigua entre los dos ("function is not
--    unique", 42725). Por eso el DROP explícito del signature viejo primero.
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.submit_school_lead(text, text, text, text, text, date, text, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.submit_school_lead(
    p_slug          text,
    p_full_name     text,
    p_phone         text,
    p_email         text DEFAULT NULL,
    p_gender        text DEFAULT NULL,
    p_birth_date    date DEFAULT NULL,
    p_guardian_name text DEFAULT NULL,
    p_how_heard     text DEFAULT NULL,
    p_notes         text DEFAULT NULL,
    p_source_detail jsonb DEFAULT NULL,
    p_website       text DEFAULT NULL,
    p_trial_slot_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id  uuid;
    v_phone      text;
    v_age_years  int;
    v_category   text;
    v_lead_id    uuid;
    v_existing   uuid;
    v_slot       record;
BEGIN
    IF COALESCE(TRIM(p_website), '') <> '' THEN
        RETURN jsonb_build_object('ok', true);
    END IF;

    SELECT id INTO v_school_id FROM public.schools WHERE slug = p_slug;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Escuela no encontrada' USING ERRCODE = '02000';
    END IF;

    IF COALESCE(TRIM(p_full_name), '') = '' THEN
        RAISE EXCEPTION 'Nombre requerido' USING ERRCODE = '22023';
    END IF;

    v_phone := NULLIF(regexp_replace(COALESCE(p_phone, ''), '[^0-9+]', '', 'g'), '');
    IF v_phone IS NULL OR length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 THEN
        RAISE EXCEPTION 'Teléfono inválido' USING ERRCODE = '22023';
    END IF;

    -- Cupo de clase de prueba: lock de fila para que dos prospectos no se
    -- lleven el último lugar a la vez (mismo patrón que el stock de equipment).
    IF p_trial_slot_id IS NOT NULL THEN
        SELECT id, max_capacity, reserved_count, is_open, slot_date
          INTO v_slot
          FROM public.school_trial_slots
         WHERE id = p_trial_slot_id AND school_id = v_school_id
         FOR UPDATE;

        IF v_slot.id IS NULL THEN
            RAISE EXCEPTION 'Ese cupo no existe para esta escuela' USING ERRCODE = '22023';
        END IF;
        IF NOT v_slot.is_open OR v_slot.slot_date < CURRENT_DATE THEN
            RAISE EXCEPTION 'Ese cupo ya no está disponible' USING ERRCODE = '22023';
        END IF;
        IF v_slot.reserved_count >= v_slot.max_capacity THEN
            RAISE EXCEPTION 'Ese cupo ya se llenó, elige otro horario' USING ERRCODE = '22023';
        END IF;
    END IF;

    IF p_birth_date IS NOT NULL THEN
        v_age_years := EXTRACT(YEAR FROM age(CURRENT_DATE, p_birth_date))::int;
        v_category := CASE
            WHEN v_age_years <= 10 THEN 'Sub-11'
            WHEN v_age_years <= 12 THEN 'Sub-13'
            WHEN v_age_years <= 14 THEN 'Sub-15'
            WHEN v_age_years <= 16 THEN 'Sub-17'
            WHEN v_age_years <= 19 THEN 'Sub-20'
            ELSE 'Senior'
        END;
    END IF;

    SELECT id INTO v_existing
      FROM public.school_signup_leads
     WHERE school_id = v_school_id
       AND phone = v_phone
       AND created_at > now() - interval '24 hours'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'lead_id', v_existing, 'duplicate', true);
    END IF;

    INSERT INTO public.school_signup_leads (
        school_id, source_slug, full_name, guardian_name, phone, email, gender,
        birth_date, suggested_category, how_heard, notes, source_detail, trial_slot_id
    ) VALUES (
        v_school_id, p_slug, TRIM(p_full_name), NULLIF(TRIM(p_guardian_name), ''), v_phone,
        NULLIF(TRIM(p_email), ''), NULLIF(TRIM(p_gender), ''), p_birth_date, v_category,
        NULLIF(TRIM(p_how_heard), ''), NULLIF(TRIM(p_notes), ''), p_source_detail, p_trial_slot_id
    ) RETURNING id INTO v_lead_id;

    IF p_trial_slot_id IS NOT NULL THEN
        UPDATE public.school_trial_slots
           SET reserved_count = reserved_count + 1
         WHERE id = p_trial_slot_id;
    END IF;

    INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
    SELECT sm.profile_id, v_school_id,
           CASE WHEN p_trial_slot_id IS NOT NULL THEN 'Nueva reserva de clase de prueba' ELSE 'Nuevo prospecto' END,
           TRIM(p_full_name) || ' dejó sus datos vía "' || p_slug || '"'
               || CASE WHEN p_trial_slot_id IS NOT NULL THEN ' — reservó clase de prueba' ELSE '' END,
           'success', NULL
    FROM public.school_members sm
    WHERE sm.school_id = v_school_id AND sm.role IN ('owner', 'admin') AND sm.status = 'active';

    RETURN jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'duplicate', false);
END;
$$;

COMMENT ON FUNCTION public.submit_school_lead(text, text, text, text, text, date, text, text, text, jsonb, text, uuid) IS
    'Captura de prospecto sin login para /inscripcion/:slug. Honeypot p_website + dedupe 24h por school_id+phone + reserva opcional de cupo de clase de prueba con lock de fila. Nunca escribe en children/enrollments.';

GRANT EXECUTE ON FUNCTION public.submit_school_lead(text, text, text, text, text, date, text, text, text, jsonb, text, uuid) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. create_school_trial_slot / list_school_trial_slots — admin de la escuela.
--    Sin UI todavía (llega con el listado de prospectos en Fase 1); por ahora
--    es la vía para cargar cupos reales.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_school_trial_slot(
    p_school_id  uuid,
    p_label      text,
    p_slot_date  date,
    p_start_time time,
    p_end_time   time DEFAULT NULL,
    p_location   text DEFAULT NULL,
    p_max_capacity integer DEFAULT 5,
    p_team_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(TRIM(p_label), '') = '' THEN
        RAISE EXCEPTION 'Label requerido' USING ERRCODE = '22023';
    END IF;
    IF p_slot_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'La fecha debe ser futura' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.school_trial_slots (
        school_id, team_id, label, slot_date, start_time, end_time, location, max_capacity, created_by
    ) VALUES (
        p_school_id, p_team_id, TRIM(p_label), p_slot_date, p_start_time, p_end_time,
        NULLIF(TRIM(p_location), ''), GREATEST(1, p_max_capacity), auth.uid()
    ) RETURNING id INTO v_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

COMMENT ON FUNCTION public.create_school_trial_slot(uuid, text, date, time, time, text, integer, uuid) IS
    'Crea un cupo de clase de prueba. Admin de la escuela. Sin UI aún — Fase 1.';

REVOKE ALL ON FUNCTION public.create_school_trial_slot(uuid, text, date, time, time, text, integer, uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.create_school_trial_slot(uuid, text, date, time, time, text, integer, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.list_school_trial_slots(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_rows jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.slot_date DESC, t.start_time), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT id, team_id, label, slot_date, start_time, end_time, location,
               max_capacity, reserved_count, is_open, created_at
          FROM public.school_trial_slots
         WHERE school_id = p_school_id
    ) t;

    RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.list_school_trial_slots(uuid) IS
    'Listado de cupos de clase de prueba para el admin de la escuela. Sin UI aún — Fase 1.';

REVOKE ALL ON FUNCTION public.list_school_trial_slots(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.list_school_trial_slots(uuid) TO authenticated;

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación después de aplicar
-- ────────────────────────────────────────────────────────────────────────────
-- SELECT has_function_privilege('anon', 'public.create_school_trial_slot(uuid,text,date,time,time,text,integer,uuid)', 'EXECUTE'); -- false
-- SELECT has_function_privilege('anon', 'public.list_school_trial_slots(uuid)', 'EXECUTE');   -- false
-- SELECT has_function_privilege('anon', 'public.list_open_trial_slots_public(text)', 'EXECUTE'); -- true
-- SELECT has_function_privilege('anon', 'public.submit_school_lead(text,text,text,text,text,date,text,text,text,jsonb,text,uuid)', 'EXECUTE'); -- true
--
-- Concurrencia (2 sesiones, mismo p_trial_slot_id con max_capacity=1): la
-- segunda debe fallar con "Ese cupo ya se llenó, elige otro horario".
