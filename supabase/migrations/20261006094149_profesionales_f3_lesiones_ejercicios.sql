-- =============================================================================
-- 20261006094149_profesionales_f3_lesiones_ejercicios.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006094147
-- Objetivo: F3 de docs/specs/profesionales-salud-fisioterapia.md.
--   · athlete_injuries: registro de lesiones + estado de disponibilidad y etapa
--     de vuelta al juego, con historial de cambios.
--   · Programa de ejercicios en casa: biblioteca (global + propia), asignación
--     por paciente y registro "lo hice" del atleta/acudiente.
--   · get_my_health_summary(): lo que ve el paciente/acudiente (sin notas).
--   · get_school_athlete_availability(): lo único que ven coach y escuela —
--     disponibilidad, restricción y fecha de regreso; nunca diagnóstico. Solo
--     con consentimiento 'compartir_disponibilidad' vigente.
--   Depende de 20261006094147.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Lesiones
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.athlete_injuries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    patient_id          uuid NOT NULL REFERENCES public.clinical_patients(id) ON DELETE RESTRICT,
    episode_id          uuid REFERENCES public.clinical_episodes(id) ON DELETE SET NULL,
    body_region         text NOT NULL CHECK (body_region IN (
                          'cabeza','cuello','hombro','brazo','codo','antebrazo','muneca','mano',
                          'torax','abdomen','espalda_alta','espalda_baja','cadera','ingle','muslo_anterior',
                          'muslo_posterior','rodilla','pierna','tobillo','pie','otra')),
    side                text NOT NULL DEFAULT 'na' CHECK (side IN ('izquierdo','derecho','bilateral','na')),
    injury_type         text NOT NULL CHECK (injury_type IN (
                          'muscular','ligamentosa','tendinosa','osea','articular','contusion',
                          'meniscal','neurologica','conmocion','otra')),
    mechanism           text NOT NULL DEFAULT 'desconocido' CHECK (mechanism IN ('contacto','sin_contacto','sobreuso','desconocido')),
    context             text NOT NULL DEFAULT 'desconocido' CHECK (context IN ('entrenamiento','partido','fuera_deporte','desconocido')),
    severity            text NOT NULL DEFAULT 'leve' CHECK (severity IN ('minima','leve','moderada','grave')),
    is_recurrence       boolean NOT NULL DEFAULT false,
    description         text,
    occurred_on         date NOT NULL,
    status              text NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','resuelta')),
    availability_status text NOT NULL DEFAULT 'no_disponible'
                        CHECK (availability_status IN ('no_disponible','restringido','disponible')),
    rtp_stage           text NOT NULL DEFAULT 'reposo' CHECK (rtp_stage IN (
                          'reposo','rehabilitacion','entrenamiento_modificado','entrenamiento_completo','competencia')),
    restrictions        text,      -- PUBLICABLE al coach: "sin saltos ni sprints"
    expected_return     date,
    returned_on         date,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT athlete_injuries_fechas_chk CHECK (returned_on IS NULL OR returned_on >= occurred_on)
);
CREATE INDEX IF NOT EXISTS idx_ai_patient ON public.athlete_injuries (patient_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_ai_prof_status ON public.athlete_injuries (professional_id, status);

CREATE TABLE IF NOT EXISTS public.athlete_injury_events (
    id          bigserial PRIMARY KEY,
    injury_id   uuid NOT NULL REFERENCES public.athlete_injuries(id) ON DELETE CASCADE,
    actor_id    uuid,
    status      text,
    availability_status text,
    rtp_stage   text,
    restrictions text,
    expected_return date,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aie_injury ON public.athlete_injury_events (injury_id, created_at);

ALTER TABLE public.athlete_injuries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_injury_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_select_own ON public.athlete_injuries;
DROP POLICY IF EXISTS ai_insert_own ON public.athlete_injuries;
DROP POLICY IF EXISTS ai_update_own ON public.athlete_injuries;
CREATE POLICY ai_select_own ON public.athlete_injuries FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
CREATE POLICY ai_insert_own ON public.athlete_injuries FOR INSERT TO authenticated
    WITH CHECK (professional_id = (SELECT auth.uid()));
CREATE POLICY ai_update_own ON public.athlete_injuries FOR UPDATE TO authenticated
    USING (professional_id = (SELECT auth.uid())) WITH CHECK (professional_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS aie_select_own ON public.athlete_injury_events;
CREATE POLICY aie_select_own ON public.athlete_injury_events FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.athlete_injuries i
                   WHERE i.id = injury_id AND i.professional_id = (SELECT auth.uid())));
REVOKE ALL ON public.athlete_injuries, public.athlete_injury_events FROM anon;
REVOKE DELETE ON public.athlete_injuries FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.athlete_injury_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.athlete_injuries TO authenticated;
GRANT SELECT ON public.athlete_injury_events TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_athlete_injuries_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_pat record;
BEGIN
    IF TG_OP = 'INSERT' OR NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
        SELECT * INTO v_pat FROM public.clinical_patients WHERE id = NEW.patient_id;
        IF v_pat.id IS NULL OR v_pat.professional_id <> NEW.professional_id THEN
            RAISE EXCEPTION 'PACIENTE_DE_OTRO_PROFESIONAL' USING ERRCODE = '42501';
        END IF;
        IF NOT public.clinical_patient_has_consent(NEW.patient_id, 'datos_sensibles') THEN
            RAISE EXCEPTION 'CONSENTIMIENTO_REQUERIDO' USING ERRCODE = '42501';
        END IF;
    END IF;
    IF NEW.episode_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.clinical_episodes e WHERE e.id = NEW.episode_id AND e.patient_id = NEW.patient_id) THEN
        RAISE EXCEPTION 'EPISODIO_INVALIDO' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.professional_id, NEW.created_at) IS DISTINCT FROM (OLD.professional_id, OLD.created_at) THEN
        RAISE EXCEPTION 'LESION_INMUTABLE' USING ERRCODE = '42501';
    END IF;
    -- Resuelta = disponible y en competencia.
    IF NEW.status = 'resuelta' THEN
        NEW.availability_status := 'disponible';
        NEW.rtp_stage := 'competencia';
        NEW.returned_on := COALESCE(NEW.returned_on, (now() AT TIME ZONE 'America/Bogota')::date);
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_athlete_injuries_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_athlete_injuries_guard ON public.athlete_injuries;
CREATE TRIGGER trg_athlete_injuries_guard BEFORE INSERT OR UPDATE ON public.athlete_injuries
    FOR EACH ROW EXECUTE FUNCTION public.fn_athlete_injuries_guard();

CREATE OR REPLACE FUNCTION public.fn_athlete_injuries_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT'
       OR (NEW.status, NEW.availability_status, NEW.rtp_stage, NEW.restrictions, NEW.expected_return)
          IS DISTINCT FROM (OLD.status, OLD.availability_status, OLD.rtp_stage, OLD.restrictions, OLD.expected_return) THEN
        INSERT INTO public.athlete_injury_events (injury_id, actor_id, status, availability_status, rtp_stage, restrictions, expected_return)
        VALUES (NEW.id, auth.uid(), NEW.status, NEW.availability_status, NEW.rtp_stage, NEW.restrictions, NEW.expected_return);
        PERFORM public._clinical_log(NEW.patient_id, 'lesion', jsonb_build_object(
            'lesion', NEW.id, 'estado', NEW.status, 'disponibilidad', NEW.availability_status, 'etapa', NEW.rtp_stage));
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_athlete_injuries_history() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_athlete_injuries_history ON public.athlete_injuries;
CREATE TRIGGER trg_athlete_injuries_history AFTER INSERT OR UPDATE ON public.athlete_injuries
    FOR EACH ROW EXECUTE FUNCTION public.fn_athlete_injuries_history();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Ejercicios en casa
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercise_library (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,   -- NULL = catálogo SportMaps
    name            text NOT NULL CHECK (length(btrim(name)) >= 3),
    description     text,
    body_region     text,
    category        text CHECK (category IN ('movilidad','fortalecimiento','estiramiento','propiocepcion','cardio','respiracion','otro')),
    video_url       text CHECK (video_url IS NULL OR video_url ~* '^https://'),
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_exlib_global_name ON public.exercise_library (lower(name)) WHERE professional_id IS NULL;
ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exlib_select ON public.exercise_library;
DROP POLICY IF EXISTS exlib_insert_own ON public.exercise_library;
DROP POLICY IF EXISTS exlib_update_own ON public.exercise_library;
CREATE POLICY exlib_select ON public.exercise_library FOR SELECT TO authenticated
    USING (professional_id IS NULL OR professional_id = (SELECT auth.uid()));
CREATE POLICY exlib_insert_own ON public.exercise_library FOR INSERT TO authenticated
    WITH CHECK (professional_id = (SELECT auth.uid()));
CREATE POLICY exlib_update_own ON public.exercise_library FOR UPDATE TO authenticated
    USING (professional_id = (SELECT auth.uid())) WITH CHECK (professional_id = (SELECT auth.uid()));
REVOKE ALL ON public.exercise_library FROM anon;
REVOKE DELETE ON public.exercise_library FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exercise_library TO authenticated;

INSERT INTO public.exercise_library (professional_id, name, category, body_region, description) VALUES
(NULL, 'Puente de glúteo', 'fortalecimiento', 'cadera', 'Boca arriba, rodillas flexionadas. Eleva la cadera apretando glúteos, sostén 2 s y baja controlado.'),
(NULL, 'Sentadilla a cajón', 'fortalecimiento', 'rodilla', 'Siéntate y levántate de un cajón o silla sin impulso, rodillas alineadas con los pies.'),
(NULL, 'Elevación de talones', 'fortalecimiento', 'pierna', 'De pie, sube a puntas de pie despacio y baja en 3 s. Progresar a una pierna.'),
(NULL, 'Excéntrico de gemelo en escalón', 'fortalecimiento', 'pierna', 'Sube con las dos piernas y baja el talón por debajo del escalón con una sola, en 3-4 s.'),
(NULL, 'Isométrico de cuádriceps', 'fortalecimiento', 'rodilla', 'Sentado con la pierna estirada, aprieta el muslo empujando la rodilla hacia abajo 10 s.'),
(NULL, 'Elevación de pierna recta', 'fortalecimiento', 'rodilla', 'Boca arriba, la otra rodilla flexionada. Eleva la pierna estirada hasta la altura de la otra rodilla.'),
(NULL, 'Nórdico de isquiotibiales asistido', 'fortalecimiento', 'muslo_posterior', 'De rodillas con los tobillos sujetos, deja caer el tronco hacia adelante lo más lento posible.'),
(NULL, 'Copenhague corto', 'fortalecimiento', 'ingle', 'Plancha lateral con la rodilla de arriba apoyada en un banco; sostén y progresa a pie.'),
(NULL, 'Plancha frontal', 'fortalecimiento', 'abdomen', 'Apoyo en antebrazos y puntas de pie, cuerpo alineado, sin hundir la zona lumbar.'),
(NULL, 'Plancha lateral', 'fortalecimiento', 'abdomen', 'Apoyo en un antebrazo, cadera arriba y alineada. Alterna lados.'),
(NULL, 'Bird-dog (cuadrupedia)', 'fortalecimiento', 'espalda_baja', 'En cuatro apoyos, estira brazo y pierna contrarios sin rotar la pelvis.'),
(NULL, 'Rotación externa de hombro con banda', 'fortalecimiento', 'hombro', 'Codo pegado al cuerpo a 90°, rota el antebrazo hacia afuera contra la banda.'),
(NULL, 'Retracción escapular con banda', 'fortalecimiento', 'espalda_alta', 'Tira la banda hacia atrás juntando las escápulas, sin subir los hombros.'),
(NULL, 'Equilibrio monopodal', 'propiocepcion', 'tobillo', 'Sobre una pierna 30 s. Progresar con ojos cerrados o sobre superficie inestable.'),
(NULL, 'Alfabeto con el tobillo', 'movilidad', 'tobillo', 'Sentado, dibuja las letras del alfabeto con la punta del pie.'),
(NULL, 'Movilidad de tobillo en pared', 'movilidad', 'tobillo', 'Pie a un palmo de la pared, lleva la rodilla a tocarla sin levantar el talón.'),
(NULL, 'Gato-camello', 'movilidad', 'espalda_baja', 'En cuatro apoyos, alterna redondear y arquear la columna lentamente.'),
(NULL, 'Péndulo de Codman', 'movilidad', 'hombro', 'Inclinado, deja colgar el brazo y haz pequeños círculos relajados.'),
(NULL, 'Estiramiento de isquiotibiales', 'estiramiento', 'muslo_posterior', 'Talón apoyado al frente, espalda recta, inclínate desde la cadera. 30 s.'),
(NULL, 'Estiramiento de cuádriceps', 'estiramiento', 'muslo_anterior', 'De pie, lleva el talón al glúteo sujetando el tobillo, rodillas juntas. 30 s.'),
(NULL, 'Estiramiento de flexores de cadera', 'estiramiento', 'cadera', 'Rodilla atrás en el piso, avanza la pelvis hasta sentir el estiramiento adelante. 30 s.'),
(NULL, 'Estiramiento de gemelo en pared', 'estiramiento', 'pierna', 'Manos en la pared, pierna atrás estirada y talón apoyado. 30 s.'),
(NULL, 'Respiración diafragmática', 'respiracion', 'abdomen', 'Boca arriba, inhala inflando el abdomen 4 s y exhala lento 6 s.'),
(NULL, 'Hielo local', 'otro', 'otra', 'Hielo envuelto en una toalla 15 min sobre la zona, sin contacto directo con la piel.')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.exercise_assignments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    patient_id          uuid NOT NULL REFERENCES public.clinical_patients(id) ON DELETE RESTRICT,
    episode_id          uuid REFERENCES public.clinical_episodes(id) ON DELETE SET NULL,
    exercise_id         uuid NOT NULL REFERENCES public.exercise_library(id) ON DELETE RESTRICT,
    sets                smallint CHECK (sets IS NULL OR sets BETWEEN 1 AND 20),
    reps                smallint CHECK (reps IS NULL OR reps BETWEEN 1 AND 200),
    hold_seconds        smallint CHECK (hold_seconds IS NULL OR hold_seconds BETWEEN 1 AND 600),
    frequency_per_week  smallint NOT NULL DEFAULT 3 CHECK (frequency_per_week BETWEEN 1 AND 14),
    instructions        text,
    start_date          date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota')::date,
    end_date            date,
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT exercise_assignments_fechas_chk CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_ea_patient ON public.exercise_assignments (patient_id) WHERE is_active;
ALTER TABLE public.exercise_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ea_select_own ON public.exercise_assignments;
DROP POLICY IF EXISTS ea_insert_own ON public.exercise_assignments;
DROP POLICY IF EXISTS ea_update_own ON public.exercise_assignments;
CREATE POLICY ea_select_own ON public.exercise_assignments FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
CREATE POLICY ea_insert_own ON public.exercise_assignments FOR INSERT TO authenticated
    WITH CHECK (professional_id = (SELECT auth.uid()));
CREATE POLICY ea_update_own ON public.exercise_assignments FOR UPDATE TO authenticated
    USING (professional_id = (SELECT auth.uid())) WITH CHECK (professional_id = (SELECT auth.uid()));
REVOKE ALL ON public.exercise_assignments FROM anon;
REVOKE DELETE ON public.exercise_assignments FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exercise_assignments TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_exercise_assignments_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.clinical_patients p
                   WHERE p.id = NEW.patient_id AND p.professional_id = NEW.professional_id) THEN
        RAISE EXCEPTION 'PACIENTE_DE_OTRO_PROFESIONAL' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.exercise_library e
                   WHERE e.id = NEW.exercise_id AND (e.professional_id IS NULL OR e.professional_id = NEW.professional_id)) THEN
        RAISE EXCEPTION 'EJERCICIO_INVALIDO' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'INSERT' AND NOT public.clinical_patient_has_consent(NEW.patient_id, 'tratamiento') THEN
        RAISE EXCEPTION 'CONSENTIMIENTO_REQUERIDO' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_exercise_assignments_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_exercise_assignments_guard ON public.exercise_assignments;
CREATE TRIGGER trg_exercise_assignments_guard BEFORE INSERT OR UPDATE ON public.exercise_assignments
    FOR EACH ROW EXECUTE FUNCTION public.fn_exercise_assignments_guard();

CREATE TABLE IF NOT EXISTS public.exercise_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   uuid NOT NULL REFERENCES public.exercise_assignments(id) ON DELETE CASCADE,
    professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id      uuid NOT NULL REFERENCES public.clinical_patients(id) ON DELETE CASCADE,
    done_on         date NOT NULL,
    done_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    pain            smallint CHECK (pain BETWEEN 0 AND 10),
    comment         text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (assignment_id, done_on)
);
CREATE INDEX IF NOT EXISTS idx_el_patient ON public.exercise_logs (patient_id, done_on DESC);
ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS el_select_own ON public.exercise_logs;
CREATE POLICY el_select_own ON public.exercise_logs FOR SELECT TO authenticated
    USING (professional_id = (SELECT auth.uid()));
REVOKE ALL ON public.exercise_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.exercise_logs FROM authenticated;
GRANT SELECT ON public.exercise_logs TO authenticated;

CREATE OR REPLACE FUNCTION public.log_exercise_done(
    p_assignment_id uuid, p_done_on date DEFAULT NULL, p_pain smallint DEFAULT NULL, p_comment text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a   record;
    v_day date := COALESCE(p_done_on, (now() AT TIME ZONE 'America/Bogota')::date);
    v_id  uuid;
BEGIN
    SELECT * INTO v_a FROM public.exercise_assignments WHERE id = p_assignment_id AND is_active;
    IF v_a.id IS NULL OR v_a.patient_id NOT IN (SELECT public.clinical_viewer_patient_ids()) THEN
        RAISE EXCEPTION 'EJERCICIO_NO_ENCONTRADO' USING ERRCODE = '42501';
    END IF;
    IF v_day > (now() AT TIME ZONE 'America/Bogota')::date OR v_day < v_a.start_date
       OR v_day < (now() AT TIME ZONE 'America/Bogota')::date - 7 THEN
        RAISE EXCEPTION 'FECHA_INVALIDA' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.exercise_logs (assignment_id, professional_id, patient_id, done_on, done_by, pain, comment)
    VALUES (v_a.id, v_a.professional_id, v_a.patient_id, v_day, auth.uid(), p_pain, left(p_comment, 500))
    ON CONFLICT (assignment_id, done_on) DO UPDATE
        SET pain = EXCLUDED.pain, comment = EXCLUDED.comment, done_by = EXCLUDED.done_by
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlog_exercise_done(p_assignment_id uuid, p_done_on date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    DELETE FROM public.exercise_logs l
     WHERE l.assignment_id = p_assignment_id AND l.done_on = p_done_on
       AND l.patient_id IN (SELECT public.clinical_viewer_patient_ids());
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Lo que ve el paciente / acudiente (sin notas clínicas)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_health_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'patient_name'), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
            'patient_id',   p.id,
            'patient_name', p.full_name,
            'child_id',     p.child_id,
            'is_self',      p.profile_id = auth.uid(),
            'professional', jsonb_build_object(
                'id', p.professional_id,
                'name', pr.full_name,
                'practice', vp.display_name,
                'specialty', vp.professional_specialty,
                'phone', vp.phone,
                'avatar_url', pr.avatar_url),
            'consents', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', c.id, 'type', c.consent_type, 'version', c.version,
                    'granted_at', c.granted_at, 'granted_by', c.granted_by_name)), '[]'::jsonb)
                FROM public.clinical_consents c WHERE c.patient_id = p.id AND c.revoked_at IS NULL),
            'pending_consents', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'type', t.consent_type, 'version', t.version, 'title', t.title, 'body', t.body, 'required', t.required)
                    ORDER BY t.required DESC), '[]'::jsonb)
                FROM public.clinical_consent_texts t
                WHERE t.is_current AND NOT public.clinical_patient_has_consent(p.id, t.consent_type)),
            'episodes', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', e.id, 'specialty', e.specialty, 'reason', e.reason, 'status', e.status,
                    'treatment_goals', e.treatment_goals, 'planned_sessions', e.planned_sessions,
                    'frequency', e.frequency, 'opened_at', e.opened_at, 'closed_at', e.closed_at,
                    'discharge_summary', e.discharge_summary,
                    'sessions_done', (SELECT count(*) FROM public.clinical_notes n
                                      WHERE n.episode_id = e.id AND n.note_type IN ('valoracion_inicial','evolucion')))
                    ORDER BY e.opened_at DESC), '[]'::jsonb)
                FROM public.clinical_episodes e WHERE e.patient_id = p.id),
            'injuries', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', i.id, 'body_region', i.body_region, 'side', i.side, 'status', i.status,
                    'availability_status', i.availability_status, 'rtp_stage', i.rtp_stage,
                    'restrictions', i.restrictions, 'expected_return', i.expected_return,
                    'occurred_on', i.occurred_on, 'returned_on', i.returned_on)
                    ORDER BY i.occurred_on DESC), '[]'::jsonb)
                FROM public.athlete_injuries i WHERE i.patient_id = p.id),
            'exercises', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'assignment_id', a.id, 'name', l.name, 'description', l.description, 'video_url', l.video_url,
                    'sets', a.sets, 'reps', a.reps, 'hold_seconds', a.hold_seconds,
                    'frequency_per_week', a.frequency_per_week, 'instructions', a.instructions,
                    'start_date', a.start_date, 'end_date', a.end_date,
                    'done_dates', (SELECT COALESCE(jsonb_agg(g.done_on ORDER BY g.done_on DESC), '[]'::jsonb)
                                   FROM public.exercise_logs g
                                   WHERE g.assignment_id = a.id AND g.done_on >= (now() AT TIME ZONE 'America/Bogota')::date - 13))
                    ORDER BY l.name), '[]'::jsonb)
                FROM public.exercise_assignments a JOIN public.exercise_library l ON l.id = a.exercise_id
                WHERE a.patient_id = p.id AND a.is_active
                  AND (a.end_date IS NULL OR a.end_date >= (now() AT TIME ZONE 'America/Bogota')::date)),
            'upcoming_appointments', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', wa.id, 'date', wa.appointment_date, 'time', to_char(wa.appointment_time, 'HH24:MI'),
                    'duration_minutes', wa.duration_minutes, 'service_type', wa.service_type, 'status', wa.status,
                    'modality', wa.modality, 'location', wa.location, 'meeting_url', wa.meeting_url)
                    ORDER BY wa.appointment_date, wa.appointment_time), '[]'::jsonb)
                FROM public.wellness_appointments wa
                WHERE wa.patient_id = p.id AND wa.status IN ('pending','confirmed')
                  AND wa.appointment_date >= (now() AT TIME ZONE 'America/Bogota')::date)
        ) AS x
        FROM public.clinical_patients p
        JOIN public.profiles pr ON pr.id = p.professional_id
        LEFT JOIN public.vendor_profiles vp ON vp.user_id = p.professional_id
        WHERE p.id IN (SELECT public.clinical_viewer_patient_ids())
          AND p.status <> 'archivado'
    ) s;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Lo que ven coach y escuela: disponibilidad, nunca diagnóstico
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_school_athlete_availability(p_school_id uuid)
RETURNS TABLE (
    child_id            uuid,
    profile_id          uuid,
    athlete_name        text,
    availability_status text,
    rtp_stage           text,
    restrictions        text,
    expected_return     date,
    body_region         text,
    updated_at          timestamptz,
    professional_name   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT DISTINCT ON (COALESCE(p.child_id, p.profile_id))
           p.child_id, p.profile_id, p.full_name,
           i.availability_status, i.rtp_stage, i.restrictions, i.expected_return,
           i.body_region,  -- zona general ("rodilla"), no diagnóstico: el coach la necesita para adaptar
           i.updated_at, pr.full_name
      FROM public.athlete_injuries i
      JOIN public.clinical_patients p ON p.id = i.patient_id
      JOIN public.profiles pr ON pr.id = i.professional_id
     WHERE p_school_id = ANY (public.user_staff_school_ids())
       AND i.status = 'activa'
       AND public.clinical_patient_has_consent(p.id, 'compartir_disponibilidad')
       AND EXISTS (
            SELECT 1 FROM public.enrollments en
             WHERE en.school_id = p_school_id AND en.status = 'active'
               AND ((p.child_id IS NOT NULL AND en.child_id = p.child_id)
                 OR (p.profile_id IS NOT NULL AND en.user_id = p.profile_id)))
     ORDER BY COALESCE(p.child_id, p.profile_id),
              CASE i.availability_status WHEN 'no_disponible' THEN 0 WHEN 'restringido' THEN 1 ELSE 2 END,
              i.updated_at DESC;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Purga de datos clínicos de CUENTAS DE PRUEBA (scripts/rls-pruebas-clinicas.mjs)
--    La historia clínica es inmutable; esta es la única vía de borrado y solo
--    acepta profesionales cuyo correo es del dominio de pruebas desechables.
--    Solo service_role.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_clinical_test_data(p_professional_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_email text;
    v_n     integer;
BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = p_professional_id;
    IF v_email IS NULL OR v_email NOT LIKE '%@rls-pruebas-negativas.invalid' THEN
        RAISE EXCEPTION 'SOLO_CUENTAS_DE_PRUEBA' USING ERRCODE = '42501';
    END IF;
    PERFORM set_config('sportmaps.clinical_purge', 'on', true);
    DELETE FROM public.exercise_logs        WHERE professional_id = p_professional_id;
    DELETE FROM public.exercise_assignments WHERE professional_id = p_professional_id;
    DELETE FROM public.exercise_library     WHERE professional_id = p_professional_id;
    DELETE FROM public.athlete_injuries     WHERE professional_id = p_professional_id;
    DELETE FROM public.clinical_attachments WHERE professional_id = p_professional_id;
    DELETE FROM public.clinical_diagnoses   WHERE professional_id = p_professional_id;
    DELETE FROM public.clinical_notes       WHERE professional_id = p_professional_id AND addendum_of IS NOT NULL;
    DELETE FROM public.clinical_notes       WHERE professional_id = p_professional_id;
    DELETE FROM public.clinical_episodes    WHERE professional_id = p_professional_id;
    DELETE FROM public.clinical_consents    WHERE professional_id = p_professional_id;
    DELETE FROM public.clinical_patient_invites WHERE professional_id = p_professional_id;
    DELETE FROM public.clinical_access_log  WHERE professional_id = p_professional_id;
    DELETE FROM public.wellness_appointments WHERE professional_id = p_professional_id;
    DELETE FROM public.clinical_patients    WHERE professional_id = p_professional_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_clinical_test_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_clinical_test_data(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. GRANTs
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.log_exercise_done(uuid, date, smallint, text)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unlog_exercise_done(uuid, date)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_health_summary()                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_school_athlete_availability(uuid)          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_exercise_done(uuid, date, smallint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlog_exercise_done(uuid, date)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_health_summary()                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_athlete_availability(uuid)         TO authenticated;

COMMIT;
