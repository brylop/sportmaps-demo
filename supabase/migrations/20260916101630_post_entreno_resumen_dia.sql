-- =============================================================================
-- 20260916101630_post_entreno_resumen_dia.sql
-- Autor: brylop   Fecha: 2026-09-16   Versión anterior: 20260916101241
-- Objetivo: "Evaluación Post-Entrenamiento" — docs/specs/evaluacion-post-entrenamiento.md §7
--
-- Resuelve la pregunta abierta: "¿cómo se envía esto automáticamente después
-- de finalizar la sesión del día?". Decisión de producto: resumen del DÍA
-- puntual — cuando YA existen, para el mismo (sesión, deportista), tanto la
-- autoevaluación del padre (rpe_borg) como la calificación del coach
-- (coach_effort_rating), se le avisa al padre con el resultado de ESE día.
-- No reemplaza al trigger de F2 (post_training_notify_on_finalize, que pide
-- llenar la autoevaluación al cerrar la sesión) ni al informe mensual (F4):
-- es un tercer momento, nuevo, que hoy no existía.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── Trigger: aviso al padre cuando el resumen del día queda completo ───────
-- Dispara sobre performance_entries (no sobre las RPCs directamente) porque
-- las dos piezas pueden llegar en cualquier orden: a veces el padre responde
-- antes que el coach califique, a veces al revés. Cualquiera de las dos
-- filas (rpe_borg o coach_effort_rating) puede ser la que completa el par.
CREATE OR REPLACE FUNCTION public.post_training_check_daily_recap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_has_self  boolean;
    v_has_coach boolean;
    v_recipient uuid;
    v_opted_out boolean;
    v_team_name text;
    v_borg      numeric;
    v_effort    numeric;
    v_nombre    text;
BEGIN
    IF NEW.subject_type NOT IN ('child', 'profile') THEN
        RETURN NEW;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.performance_entries pe
         WHERE pe.context_type = 'session' AND pe.context_id = NEW.context_id
           AND pe.subject_type = NEW.subject_type AND pe.subject_id = NEW.subject_id
           AND pe.metric_key = 'rpe_borg'
    ) INTO v_has_self;

    SELECT EXISTS (
        SELECT 1 FROM public.performance_entries pe
         WHERE pe.context_type = 'session' AND pe.context_id = NEW.context_id
           AND pe.subject_type = NEW.subject_type AND pe.subject_id = NEW.subject_id
           AND pe.metric_key = 'coach_effort_rating'
    ) INTO v_has_coach;

    -- Todavía falta una de las dos piezas: nada que avisar aún.
    IF NOT (v_has_self AND v_has_coach) THEN
        RETURN NEW;
    END IF;

    v_recipient := NULL;
    v_opted_out := false;
    v_nombre := 'tu deportista';

    IF NEW.subject_type = 'child' THEN
        SELECT c.parent_id, COALESCE(c.post_training_opt_out, false), c.full_name
          INTO v_recipient, v_opted_out, v_nombre
          FROM public.children c
         WHERE c.id = NEW.subject_id;
    ELSE
        SELECT p.id, COALESCE((p.preferences ->> 'post_training_opt_out')::boolean, false)
          INTO v_recipient, v_opted_out
          FROM public.profiles p
         WHERE p.id = NEW.subject_id;
    END IF;

    -- Sin destinatario (padre no vinculado) u opt-out: se salta, no error.
    IF v_recipient IS NULL OR v_opted_out THEN
        RETURN NEW;
    END IF;

    -- Idempotencia: reenviar/actualizar una respuesta dentro de las 24h
    -- (ON CONFLICT DO UPDATE en las RPCs de F1) no duplica el aviso.
    IF EXISTS (
        SELECT 1 FROM public.notifications n
         WHERE n.user_id = v_recipient
           AND n.category = 'post_training'
           AND n.data ->> 'kind' = 'daily_recap'
           AND n.data ->> 'session_id' = NEW.context_id::text
           AND n.data ->> 'subject_type' = NEW.subject_type
           AND n.data ->> 'subject_id' = NEW.subject_id::text
    ) THEN
        RETURN NEW;
    END IF;

    SELECT t.name INTO v_team_name
      FROM public.attendance_sessions s
      JOIN public.teams t ON t.id = s.team_id
     WHERE s.id = NEW.context_id;

    SELECT pe.value INTO v_borg
      FROM public.performance_entries pe
     WHERE pe.context_type = 'session' AND pe.context_id = NEW.context_id
       AND pe.subject_type = NEW.subject_type AND pe.subject_id = NEW.subject_id
       AND pe.metric_key = 'rpe_borg';

    SELECT pe.value INTO v_effort
      FROM public.performance_entries pe
     WHERE pe.context_type = 'session' AND pe.context_id = NEW.context_id
       AND pe.subject_type = NEW.subject_type AND pe.subject_id = NEW.subject_id
       AND pe.metric_key = 'coach_effort_rating';

    INSERT INTO public.notifications (user_id, title, message, type, category, data, link)
    VALUES (
        v_recipient,
        'Así le fue hoy a ' || COALESCE(v_nombre, 'tu deportista') || ' en el entreno',
        'Fatiga percibida ' || v_borg::text || '/10 · el entrenador calificó su esfuerzo en '
            || v_effort::text || '% en ' || COALESCE(v_team_name, 'el entrenamiento') || '.',
        'info',
        'post_training',
        jsonb_build_object(
            'kind', 'daily_recap',
            'session_id', NEW.context_id,
            'subject_type', NEW.subject_type,
            'subject_id', NEW.subject_id
        ),
        '/post-entreno/' || NEW.context_id::text || '/resultado'
            || CASE WHEN NEW.subject_type = 'child' THEN '?child_id=' || NEW.subject_id::text ELSE '' END
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.post_training_check_daily_recap() IS
    'Trigger AFTER INSERT OR UPDATE ON performance_entries (rpe_borg / '
    'coach_effort_rating, context_type=session). Cuando ambas piezas del par '
    '(autoevaluación + rating del coach) ya existen para la misma sesión y '
    'deportista, avisa al padre con el resumen de ESE día. Idempotente vía '
    'notifications.data->>''kind''=''daily_recap''. Spec §7.';

DROP TRIGGER IF EXISTS trg_post_training_daily_recap ON public.performance_entries;
CREATE TRIGGER trg_post_training_daily_recap
    AFTER INSERT OR UPDATE ON public.performance_entries
    FOR EACH ROW
    WHEN (NEW.context_type = 'session' AND NEW.metric_key IN ('rpe_borg', 'coach_effort_rating'))
    EXECUTE FUNCTION public.post_training_check_daily_recap();

COMMIT;

-- =============================================================================
-- Qué NO hace esta migración, a propósito:
--   · No agrega la pantalla /post-entreno/:sessionId/resultado (frontend,
--     mismo commit pero fuera de esta migración — es código, no DB).
--   · No notifica al coach (spec §7: el resumen del día es solo para padres).
--   · No toca el trigger de F2 (post_training_notify_on_finalize) ni el
--     informe mensual (F4): son tres avisos distintos, en tres momentos.
-- =============================================================================
