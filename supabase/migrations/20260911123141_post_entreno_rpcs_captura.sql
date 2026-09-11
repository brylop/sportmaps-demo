-- =============================================================================
-- 20260911123141_post_entreno_rpcs_captura.sql
-- Autor: brylop   Fecha: 2026-09-11   Versión anterior: 20260911122709
-- Objetivo: F1 de "Evaluación Post-Entrenamiento" — docs/specs/evaluacion-post-entrenamiento.md §3.2-§3.3
--
-- Dos RPCs SECURITY DEFINER que escriben en performance_entries con
-- context_type='session' (ya existía en el CHECK, sin productor real hasta hoy):
--   · submit_post_training_self_eval  — el padre, por su hijo/a (o el atleta
--     adulto por sí mismo), autoevaluación tras cada sesión.
--   · submit_post_training_coach_rating — el coach, por cada atleta presente.
--
-- No dependen de las policies de RLS de performance_entries (ya corregidas en
-- 20260814185120): SECURITY DEFINER + validación interna, mismo patrón que
-- publish_athlete_report_system. Además, columna nueva attendance_sessions.coach_notes
-- (spec §2.5 — nota libre del profe, es propiedad de la SESIÓN, no una métrica).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · FKs de negocio a public.profiles(id), no a auth.users.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. Columna nueva: nota libre del profe, por sesión ──────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'attendance_sessions'
          AND column_name = 'coach_notes'
    ) THEN
        ALTER TABLE public.attendance_sessions ADD COLUMN coach_notes text;
    END IF;
END $$;

COMMENT ON COLUMN public.attendance_sessions.coach_notes IS
    'Nota libre del coach sobre la sesión (spec evaluacion-post-entrenamiento.md '
    '§2.5). Propiedad de la sesión, no una métrica — no va en performance_entries.';

-- ─── 2. Índice único: una respuesta por (sujeto, métrica, sesión) ────────────
-- Garantiza en el ÍNDICE, no solo en la RPC, que dos envíos concurrentes no
-- dupliquen fila (spec §3.2). El ON CONFLICT de ambas RPCs apunta a este índice.
CREATE UNIQUE INDEX IF NOT EXISTS performance_entries_session_unique
    ON public.performance_entries (subject_type, subject_id, metric_key, context_id)
    WHERE context_type = 'session';

-- ─── 3. submit_post_training_self_eval ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_post_training_self_eval(
    p_session_id uuid,
    p_child_id   uuid DEFAULT NULL,
    p_user_id    uuid DEFAULT NULL,
    p_answers    jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_session      record;
    v_subject_type text;
    v_subject_id   uuid;
    v_status       text;
    v_sport_id     uuid;
    v_key          text;
    v_val          jsonb;
    v_num          numeric;
    v_def          record;
    v_focus        jsonb;
    v_focus_key    text;
    v_saved        int := 0;
    v_streak       int := 0;
    v_month_avg    numeric;
    v_rec          record;
BEGIN
    IF (p_child_id IS NULL) = (p_user_id IS NULL) THEN
        RAISE EXCEPTION 'Debe indicarse exactamente uno de p_child_id o p_user_id.'
            USING ERRCODE = '22023';
    END IF;

    IF p_child_id IS NOT NULL THEN
        IF NOT public.is_parent_of_child(p_child_id) THEN
            RAISE EXCEPTION 'No autorizado: no eres el acudiente de este atleta.'
                USING ERRCODE = '42501';
        END IF;
        v_subject_type := 'child';
        v_subject_id := p_child_id;
    ELSE
        IF p_user_id <> auth.uid() THEN
            RAISE EXCEPTION 'No autorizado: solo puedes responder por vos misma.'
                USING ERRCODE = '42501';
        END IF;
        v_subject_type := 'profile';
        v_subject_id := p_user_id;
    END IF;

    SELECT s.*, sc.category_id AS sport_category_id
      INTO v_session
      FROM public.attendance_sessions s
      JOIN public.schools sc ON sc.id = s.school_id
     WHERE s.id = p_session_id
     FOR UPDATE OF s;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesión no encontrada.' USING ERRCODE = 'P0002';
    END IF;
    IF v_session.finalized IS NOT TRUE THEN
        RAISE EXCEPTION 'La sesión todavía no se ha cerrado.' USING ERRCODE = '55000';
    END IF;
    IF v_session.finalized_at IS NOT NULL AND now() > v_session.finalized_at + interval '24 hours' THEN
        RAISE EXCEPTION 'Ya pasaron 24 horas desde el cierre de la sesión.' USING ERRCODE = '55000';
    END IF;

    SELECT ar.status INTO v_status
      FROM public.attendance_records ar
     WHERE ar.session_id = p_session_id
       AND ((v_subject_type = 'child'   AND ar.child_id = v_subject_id)
         OR (v_subject_type = 'profile' AND ar.user_id  = v_subject_id));

    IF v_status IS NULL OR v_status NOT IN ('present', 'late') THEN
        RAISE EXCEPTION 'El atleta no asistió a esta sesión.' USING ERRCODE = '55000';
    END IF;

    v_sport_id := v_session.sport_category_id;
    IF v_sport_id IS NULL THEN
        RAISE EXCEPTION 'La escuela no tiene deporte configurado.' USING ERRCODE = '55000';
    END IF;

    -- Todas las obligatorias del catálogo (menos focus_*) deben venir en p_answers.
    FOR v_def IN
        SELECT metric_key
          FROM public.sport_metric_definitions
         WHERE sport_category_id = v_sport_id
           AND required = true
           AND metric_key IN ('rpe_borg', 'task_comprehension', 'self_effort_pct', 'satisfaction')
    LOOP
        IF NOT (p_answers ? v_def.metric_key) THEN
            RAISE EXCEPTION 'Falta responder: %.', v_def.metric_key USING ERRCODE = '22023';
        END IF;
    END LOOP;

    -- Respuestas simples (todo lo que no sea focus / focus_other_text).
    FOR v_key, v_val IN SELECT * FROM jsonb_each(p_answers)
    LOOP
        CONTINUE WHEN v_key IN ('focus', 'focus_other_text');

        SELECT * INTO v_def
          FROM public.sport_metric_definitions
         WHERE sport_category_id = v_sport_id AND metric_key = v_key;

        IF v_def.metric_key IS NULL THEN
            RAISE EXCEPTION 'Métrica desconocida para este deporte: %.', v_key USING ERRCODE = '22023';
        END IF;
        IF jsonb_typeof(v_val) <> 'number' THEN
            RAISE EXCEPTION 'Valor inválido para %: se esperaba un número.', v_key USING ERRCODE = '22023';
        END IF;

        v_num := (v_val #>> '{}')::numeric;
        IF (v_def.min_value IS NOT NULL AND v_num < v_def.min_value)
           OR (v_def.max_value IS NOT NULL AND v_num > v_def.max_value) THEN
            RAISE EXCEPTION 'Valor fuera de rango para %: %.', v_key, v_num USING ERRCODE = '22023';
        END IF;
        IF v_def.options IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_def.options) o WHERE (o->>'value')::numeric = v_num
        ) THEN
            RAISE EXCEPTION 'Valor no está en las opciones válidas para %: %.', v_key, v_num USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.performance_entries
            (school_id, subject_type, subject_id, metric_key, value, context_type, context_id, recorded_by)
        VALUES
            (v_session.school_id, v_subject_type, v_subject_id, v_key, v_num, 'session', p_session_id, auth.uid())
        ON CONFLICT (subject_type, subject_id, metric_key, context_id) WHERE context_type = 'session'
        DO UPDATE SET value = EXCLUDED.value, recorded_at = now();

        v_saved := v_saved + 1;
    END LOOP;

    -- Aspectos a mejorar: multi-select opcional + "otro" en texto libre.
    v_focus := COALESCE(p_answers -> 'focus', '[]'::jsonb);
    IF jsonb_typeof(v_focus) <> 'array' THEN
        RAISE EXCEPTION '"focus" debe ser un arreglo de claves.' USING ERRCODE = '22023';
    END IF;
    IF p_answers ? 'focus_other_text' AND NOT (v_focus ? 'focus_other') THEN
        RAISE EXCEPTION '"focus_other_text" solo aplica si "focus" incluye "focus_other".'
            USING ERRCODE = '22023';
    END IF;

    FOR v_focus_key IN SELECT jsonb_array_elements_text(v_focus)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.sport_metric_definitions
             WHERE sport_category_id = v_sport_id AND metric_key = v_focus_key
        ) THEN
            RAISE EXCEPTION '"aspectos a mejorar" no existe en el catálogo: %.', v_focus_key
                USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.performance_entries
            (school_id, subject_type, subject_id, metric_key, value, context_type, context_id, recorded_by, notes)
        VALUES
            (v_session.school_id, v_subject_type, v_subject_id, v_focus_key, 1, 'session', p_session_id, auth.uid(),
             CASE WHEN v_focus_key = 'focus_other' THEN left(btrim(p_answers ->> 'focus_other_text'), 200) END)
        ON CONFLICT (subject_type, subject_id, metric_key, context_id) WHERE context_type = 'session'
        DO UPDATE SET value = EXCLUDED.value, notes = EXCLUDED.notes, recorded_at = now();

        v_saved := v_saved + 1;
    END LOOP;

    -- Racha: sesiones consecutivas del equipo (más reciente primero, incluye la
    -- de hoy, ya insertada arriba en esta misma transacción) con rpe_borg cargado.
    FOR v_rec IN
        SELECT EXISTS (
            SELECT 1 FROM public.performance_entries pe
             WHERE pe.context_type = 'session' AND pe.context_id = s.id
               AND pe.subject_type = v_subject_type AND pe.subject_id = v_subject_id
               AND pe.metric_key = 'rpe_borg'
        ) AS respondida
          FROM public.attendance_sessions s
          JOIN public.attendance_records ar ON ar.session_id = s.id
         WHERE s.team_id = v_session.team_id
           AND s.finalized = true
           AND ar.status IN ('present', 'late')
           AND ((v_subject_type = 'child'   AND ar.child_id = v_subject_id)
             OR (v_subject_type = 'profile' AND ar.user_id  = v_subject_id))
         ORDER BY s.session_date DESC
    LOOP
        EXIT WHEN NOT v_rec.respondida;
        v_streak := v_streak + 1;
    END LOOP;

    SELECT round(avg(value)) INTO v_month_avg
      FROM public.performance_entries
     WHERE subject_type = v_subject_type AND subject_id = v_subject_id
       AND metric_key = 'rpe_borg' AND context_type = 'session'
       AND recorded_at >= date_trunc('month', now());

    RETURN jsonb_build_object('saved', v_saved, 'streak', v_streak, 'month_avg_borg', v_month_avg);
END;
$$;

COMMENT ON FUNCTION public.submit_post_training_self_eval(uuid, uuid, uuid, jsonb) IS
    'Autoevaluación post-entrenamiento de la deportista (la llena el padre o la '
    'atleta adulta). SECURITY DEFINER: valida parentesco/identidad y asistencia '
    'internamente, no depende de RLS de performance_entries.';

REVOKE ALL ON FUNCTION public.submit_post_training_self_eval(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_post_training_self_eval(uuid, uuid, uuid, jsonb) TO authenticated;

-- ─── 4. submit_post_training_coach_rating ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_post_training_coach_rating(
    p_session_id  uuid,
    p_ratings     jsonb,
    p_coach_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_session      record;
    v_coach_id     uuid;
    v_sport_id     uuid;
    v_def          record;
    v_item         jsonb;
    v_child_id     uuid;
    v_user_id      uuid;
    v_subject_type text;
    v_subject_id   uuid;
    v_status       text;
    v_num          numeric;
    v_saved        int := 0;
    v_pending      int := 0;
BEGIN
    SELECT s.*, sc.category_id AS sport_category_id
      INTO v_session
      FROM public.attendance_sessions s
      JOIN public.schools sc ON sc.id = s.school_id
     WHERE s.id = p_session_id
     FOR UPDATE OF s;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesión no encontrada.' USING ERRCODE = 'P0002';
    END IF;
    IF v_session.finalized IS NOT TRUE THEN
        RAISE EXCEPTION 'La sesión todavía no se ha cerrado.' USING ERRCODE = '55000';
    END IF;

    SELECT ss.id INTO v_coach_id
      FROM public.school_staff ss
     WHERE ss.coach_auth_id = auth.uid()
       AND ss.school_id = v_session.school_id
       AND ss.status = 'active';

    IF v_coach_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.team_coaches tc
         WHERE tc.team_id = v_session.team_id AND tc.coach_id = v_coach_id
    ) THEN
        RAISE EXCEPTION 'No autorizado: no eres coach de este equipo.' USING ERRCODE = '42501';
    END IF;

    v_sport_id := v_session.sport_category_id;

    SELECT * INTO v_def
      FROM public.sport_metric_definitions
     WHERE sport_category_id = v_sport_id AND metric_key = 'coach_effort_rating';

    IF v_def.metric_key IS NULL THEN
        RAISE EXCEPTION 'La escuela no tiene configurada la métrica de rating del coach.'
            USING ERRCODE = '55000';
    END IF;
    IF jsonb_typeof(p_ratings) <> 'array' THEN
        RAISE EXCEPTION 'p_ratings debe ser un arreglo.' USING ERRCODE = '22023';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_ratings)
    LOOP
        v_child_id := NULLIF(v_item ->> 'child_id', '')::uuid;
        v_user_id  := NULLIF(v_item ->> 'user_id', '')::uuid;

        IF (v_child_id IS NULL) = (v_user_id IS NULL) THEN
            RAISE EXCEPTION 'Cada ítem de p_ratings necesita exactamente uno de child_id/user_id.'
                USING ERRCODE = '22023';
        END IF;

        IF v_child_id IS NOT NULL THEN
            v_subject_type := 'child';   v_subject_id := v_child_id;
        ELSE
            v_subject_type := 'profile'; v_subject_id := v_user_id;
        END IF;

        SELECT ar.status INTO v_status
          FROM public.attendance_records ar
         WHERE ar.session_id = p_session_id
           AND ((v_subject_type = 'child'   AND ar.child_id = v_subject_id)
             OR (v_subject_type = 'profile' AND ar.user_id  = v_subject_id));

        IF v_status IS NULL OR v_status NOT IN ('present', 'late') THEN
            RAISE EXCEPTION 'El atleta % no asistió a esta sesión.', v_subject_id USING ERRCODE = '55000';
        END IF;

        IF NOT (v_item ? 'effort_pct') THEN
            RAISE EXCEPTION 'Falta effort_pct para %.', v_subject_id USING ERRCODE = '22023';
        END IF;

        v_num := (v_item -> 'effort_pct' #>> '{}')::numeric;
        IF (v_def.min_value IS NOT NULL AND v_num < v_def.min_value)
           OR (v_def.max_value IS NOT NULL AND v_num > v_def.max_value) THEN
            RAISE EXCEPTION 'effort_pct fuera de rango para %: %.', v_subject_id, v_num USING ERRCODE = '22023';
        END IF;
        IF v_def.options IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_def.options) o WHERE (o ->> 'value')::numeric = v_num
        ) THEN
            RAISE EXCEPTION 'effort_pct no está en las opciones válidas para %: %.', v_subject_id, v_num
                USING ERRCODE = '22023';
        END IF;

        -- No se sobreescribe un informe ya publicado del periodo de esta sesión.
        IF EXISTS (
            SELECT 1 FROM public.athlete_reports r
             WHERE r.school_id = v_session.school_id
               AND r.subject_type = v_subject_type AND r.subject_id = v_subject_id
               AND r.period_year  = EXTRACT(YEAR  FROM v_session.session_date)::smallint
               AND r.period_month = EXTRACT(MONTH FROM v_session.session_date)::smallint
               AND r.status = 'publicado'
        ) THEN
            RAISE EXCEPTION 'El informe de este periodo ya fue publicado para %.', v_subject_id
                USING ERRCODE = '55000';
        END IF;

        INSERT INTO public.performance_entries
            (school_id, subject_type, subject_id, metric_key, value, context_type, context_id, recorded_by)
        VALUES
            (v_session.school_id, v_subject_type, v_subject_id, 'coach_effort_rating',
             v_num, 'session', p_session_id, auth.uid())
        ON CONFLICT (subject_type, subject_id, metric_key, context_id) WHERE context_type = 'session'
        DO UPDATE SET value = EXCLUDED.value, recorded_at = now();

        v_saved := v_saved + 1;
    END LOOP;

    IF p_coach_notes IS NOT NULL THEN
        UPDATE public.attendance_sessions
           SET coach_notes = NULLIF(left(btrim(p_coach_notes), 2000), '')
         WHERE id = p_session_id;
    END IF;

    SELECT count(*) INTO v_pending
      FROM public.attendance_records ar
     WHERE ar.session_id = p_session_id
       AND ar.status IN ('present', 'late')
       AND NOT EXISTS (
           SELECT 1 FROM public.performance_entries pe
            WHERE pe.context_type = 'session' AND pe.context_id = p_session_id
              AND pe.metric_key = 'coach_effort_rating'
              AND ((ar.child_id IS NOT NULL AND pe.subject_type = 'child'   AND pe.subject_id = ar.child_id)
                OR (ar.user_id  IS NOT NULL AND pe.subject_type = 'profile' AND pe.subject_id = ar.user_id))
       );

    RETURN jsonb_build_object('saved', v_saved, 'pending', v_pending);
END;
$$;

COMMENT ON FUNCTION public.submit_post_training_coach_rating(uuid, jsonb, text) IS
    'Rating del coach por atleta, tras cerrar la sesión. SECURITY DEFINER: valida '
    'que el caller sea coach del equipo vía team_coaches, no depende de RLS.';

REVOKE ALL ON FUNCTION public.submit_post_training_coach_rating(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_post_training_coach_rating(uuid, jsonb, text) TO authenticated;

COMMIT;

-- =============================================================================
-- Qué NO hace esta migración, a propósito:
--   · No dispara notificaciones al padre/coach — eso es F2 (trigger sobre
--     attendance_sessions.finalized).
--   · No toca report-snapshot.service.ts (agregados de sesión) — F4.
--   · No agrega tests de concurrencia en SQL — van como parte de F1 en el
--     repo de QA/CI, ejercitando el índice único de §2 con envíos simultáneos.
-- =============================================================================
