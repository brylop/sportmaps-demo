-- =============================================================================
-- 20260911124834_post_entreno_disparo_notificacion.sql
-- Autor: brylop   Fecha: 2026-09-11   Versión anterior: 20260911123141
-- Objetivo: F2 de "Evaluación Post-Entrenamiento" — docs/specs/evaluacion-post-entrenamiento.md §4
--
-- Trigger sobre el cierre de sesión (attendance_sessions.finalized false→true,
-- que YA EXISTE) que avisa al padre (o a la atleta adulta) a responder la
-- autoevaluación. Inserta directo en `public.notifications` — NO usa
-- notify_user(), que exige auth.uid() de un caller autorizado y por diseño no
-- sirve desde un trigger de sistema (mismo patrón que attendance.ts en el BFF,
-- que también inserta directo con service_role).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. Opt-out por atleta (D3/§4) ────────────────────────────────────────────
-- Solo la columna de datos. NO hay UI todavía para prenderla/apagarla (mismo
-- gap que ya tiene el propio informe mensual: "recordatorios... queda para una
-- segunda pasada", ver athlete-reports.job.ts). El gate ya es real en la base;
-- falta el toggle en el perfil — se anota, no se inventa.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'children'
          AND column_name = 'post_training_opt_out'
    ) THEN
        ALTER TABLE public.children
            ADD COLUMN post_training_opt_out boolean NOT NULL DEFAULT false;
    END IF;
END $$;

COMMENT ON COLUMN public.children.post_training_opt_out IS
    'Si es true, no se avisa al padre a responder la autoevaluación post-entreno '
    '(sigue recibiendo el informe mensual). Para atletas adultos el equivalente '
    'es profiles.preferences->>''post_training_opt_out''.';

-- ─── 2. category 'post_training' en notifications ────────────────────────────
-- El CHECK de notifications.category es una lista cerrada; se agrega el valor
-- nuevo sin tocar los existentes.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'notifications_category_check'
           AND conrelid = 'public.notifications'::regclass
           AND pg_get_constraintdef(oid) LIKE '%post_training%'
    ) THEN
        ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
        ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check
            CHECK (category = ANY (ARRAY[
                'payment','installment','glosa','enrollment','access','qr',
                'marketplace','equipment','system','support','tournament',
                'post_training'
            ]));
    END IF;
END $$;

-- ─── 3. Trigger: aviso al padre al cerrar la sesión ──────────────────────────
CREATE OR REPLACE FUNCTION public.post_training_notify_on_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rec       record;
    v_recipient uuid;
    v_opted_out boolean;
    v_team_name text;
BEGIN
    SELECT t.name INTO v_team_name FROM public.teams t WHERE t.id = NEW.team_id;

    FOR v_rec IN
        SELECT ar.child_id, ar.user_id
          FROM public.attendance_records ar
         WHERE ar.session_id = NEW.id
           AND ar.status IN ('present', 'late')
    LOOP
        v_recipient := NULL;
        v_opted_out := false;

        IF v_rec.child_id IS NOT NULL THEN
            SELECT c.parent_id, COALESCE(c.post_training_opt_out, false)
              INTO v_recipient, v_opted_out
              FROM public.children c
             WHERE c.id = v_rec.child_id;
        ELSIF v_rec.user_id IS NOT NULL THEN
            SELECT p.id, COALESCE((p.preferences ->> 'post_training_opt_out')::boolean, false)
              INTO v_recipient, v_opted_out
              FROM public.profiles p
             WHERE p.id = v_rec.user_id;
        END IF;

        -- Sin destinatario (padre no vinculado aún) u opt-out: se salta, no error.
        CONTINUE WHEN v_recipient IS NULL OR v_opted_out;

        -- Idempotencia: reabrir/cerrar la sesión no duplica el aviso (spec §4).
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM public.notifications n
             WHERE n.user_id = v_recipient
               AND n.category = 'post_training'
               AND n.data ->> 'session_id' = NEW.id::text
               AND n.data ->> 'child_id' IS NOT DISTINCT FROM v_rec.child_id::text
               AND n.data ->> 'user_id_athlete' IS NOT DISTINCT FROM v_rec.user_id::text
        );

        INSERT INTO public.notifications (user_id, title, message, type, category, data, link)
        VALUES (
            v_recipient,
            '¿Cómo estuvo el entreno de hoy?',
            'Responde en menos de 30 segundos cómo se sintió en el entrenamiento de '
                || COALESCE(v_team_name, 'hoy') || '.',
            'info',
            'post_training',
            jsonb_build_object(
                'session_id', NEW.id,
                'team_id', NEW.team_id,
                'child_id', v_rec.child_id,
                'user_id_athlete', v_rec.user_id
            ),
            '/post-entreno/' || NEW.id::text
                || CASE WHEN v_rec.child_id IS NOT NULL THEN '?child_id=' || v_rec.child_id::text ELSE '' END
        );
    END LOOP;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.post_training_notify_on_finalize() IS
    'Trigger AFTER UPDATE OF finalized ON attendance_sessions (false→true). '
    'Avisa a cada padre/atleta presente o tarde a responder la autoevaluación. '
    'Inserta directo en notifications (no vía notify_user, que exige un caller '
    'autorizado). Al coach NO se le notifica acá: es su propia acción de '
    'finalizar la que dispara, en el frontend, la pantalla de rating (spec §4).';

DROP TRIGGER IF EXISTS trg_post_training_notify ON public.attendance_sessions;
CREATE TRIGGER trg_post_training_notify
    AFTER UPDATE OF finalized ON public.attendance_sessions
    FOR EACH ROW
    WHEN (NEW.finalized IS TRUE AND OLD.finalized IS NOT TRUE)
    EXECUTE FUNCTION public.post_training_notify_on_finalize();

COMMIT;

-- =============================================================================
-- Qué NO hace esta migración, a propósito:
--   · No agrega recordatorio al padre (20h) ni al coach (sesión sin cerrar +1
--     día) en SQL — van como job del BFF (bff/src/jobs/post-training.job.ts),
--     mismo patrón que athlete-reports.job.ts, en el mismo commit de F2 pero
--     fuera de esta migración (es código, no DB).
--   · No agrega UI de opt-out — deuda anotada en el comentario de la columna.
-- =============================================================================
