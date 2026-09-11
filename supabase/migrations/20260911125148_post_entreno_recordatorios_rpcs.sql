-- =============================================================================
-- 20260911125148_post_entreno_recordatorios_rpcs.sql
-- Autor: brylop   Fecha: 2026-09-11   Versión anterior: 20260911124834
-- Objetivo: F2 (segunda parte) de "Evaluación Post-Entrenamiento" — spec §4.
--
-- Dos RPCs de sistema (solo service_role, mismo patrón que
-- generate_report_drafts_system): un recordatorio al padre que no respondió a
-- las 20h del día del cierre, y un recordatorio al coach con una sesión sin
-- cerrar al día siguiente. El BFF las llama desde un job diario/horario
-- (bff/src/jobs/post-training-reminders.job.ts, mismo patrón que
-- athlete-reports.job.ts) — la lógica pesada vive en SQL, el job solo dispara.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

-- ─── 1. Recordatorio al padre: uno solo, a las 20h (America/Bogota) del día
--        del cierre, si no respondió. Idempotente por notificación original. ──
CREATE OR REPLACE FUNCTION public.post_training_send_parent_reminders_system()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rec   record;
    v_count integer := 0;
BEGIN
    -- Solo tiene sentido correr esto a partir de las 20:00 hora Bogotá.
    IF (now() AT TIME ZONE 'America/Bogota')::time < time '20:00' THEN
        RETURN 0;
    END IF;

    FOR v_rec IN
        SELECT n.id, n.user_id, n.data
          FROM public.notifications n
         WHERE n.category = 'post_training'
           AND NOT (n.data ? 'reminder')
           AND (n.created_at AT TIME ZONE 'America/Bogota')::date
             = (now()          AT TIME ZONE 'America/Bogota')::date
    LOOP
        -- Ya respondió: no hace falta recordatorio.
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM public.performance_entries pe
             WHERE pe.context_type = 'session'
               AND pe.context_id = (v_rec.data ->> 'session_id')::uuid
               AND pe.metric_key = 'rpe_borg'
               AND ((v_rec.data ->> 'child_id' IS NOT NULL
                     AND pe.subject_type = 'child' AND pe.subject_id = (v_rec.data ->> 'child_id')::uuid)
                 OR (v_rec.data ->> 'user_id_athlete' IS NOT NULL
                     AND pe.subject_type = 'profile' AND pe.subject_id = (v_rec.data ->> 'user_id_athlete')::uuid))
        );

        -- Ya se le mandó el recordatorio de esta sesión (no más de uno).
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM public.notifications r
             WHERE r.category = 'post_training' AND r.user_id = v_rec.user_id
               AND r.data ->> 'session_id' = v_rec.data ->> 'session_id'
               AND r.data ->> 'child_id' IS NOT DISTINCT FROM v_rec.data ->> 'child_id'
               AND r.data ->> 'user_id_athlete' IS NOT DISTINCT FROM v_rec.data ->> 'user_id_athlete'
               AND r.data ? 'reminder'
        );

        INSERT INTO public.notifications (user_id, title, message, type, category, data, link)
        VALUES (
            v_rec.user_id,
            'Todavía no respondes el entreno de hoy',
            'Un segundo y listo: cuéntanos cómo se sintió en el entrenamiento de hoy.',
            'info', 'post_training',
            v_rec.data || jsonb_build_object('reminder', true),
            '/post-entreno/' || (v_rec.data ->> 'session_id')
                || CASE WHEN v_rec.data ->> 'child_id' IS NOT NULL
                        THEN '?child_id=' || (v_rec.data ->> 'child_id') ELSE '' END
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.post_training_send_parent_reminders_system() IS
    'F2: recordatorio único al padre que no respondió, a las 20h (America/Bogota) '
    'del día del cierre. Solo service_role — llamado desde el job del BFF.';

REVOKE ALL ON FUNCTION public.post_training_send_parent_reminders_system() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_training_send_parent_reminders_system() TO service_role;

-- ─── 2. Recordatorio al coach: sesión sin cerrar, 1 día después ──────────────
CREATE OR REPLACE FUNCTION public.post_training_send_coach_reminders_system()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rec   record;
    v_count integer := 0;
BEGIN
    FOR v_rec IN
        SELECT DISTINCT s.id AS session_id, s.team_id, s.session_date, ss.coach_auth_id
          FROM public.attendance_sessions s
          JOIN public.team_coaches tc ON tc.team_id = s.team_id
          JOIN public.school_staff ss ON ss.id = tc.coach_id
                                      AND ss.status = 'active'
                                      AND ss.coach_auth_id IS NOT NULL
         WHERE s.finalized IS NOT TRUE
           AND s.session_date BETWEEN (current_date - 3) AND (current_date - 1)
           AND EXISTS (SELECT 1 FROM public.attendance_records ar WHERE ar.session_id = s.id)
    LOOP
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM public.notifications n
             WHERE n.category = 'post_training' AND n.user_id = v_rec.coach_auth_id
               AND n.data ->> 'session_id' = v_rec.session_id::text
               AND n.data ? 'coach_reminder'
        );

        INSERT INTO public.notifications (user_id, title, message, type, category, data, link)
        VALUES (
            v_rec.coach_auth_id,
            'Tienes una sesión sin cerrar',
            'La sesión del ' || to_char(v_rec.session_date, 'DD/MM')
                || ' sigue sin finalizar. Ciérrala para que las familias reciban la evaluación de hoy.',
            'info', 'post_training',
            jsonb_build_object('session_id', v_rec.session_id, 'team_id', v_rec.team_id, 'coach_reminder', true),
            '/coach-attendance'
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.post_training_send_coach_reminders_system() IS
    'F2: recordatorio al coach por cada sesión con asistencia marcada pero sin '
    'finalizar, 1 a 3 días después. Solo service_role — job del BFF.';

REVOKE ALL ON FUNCTION public.post_training_send_coach_reminders_system() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_training_send_coach_reminders_system() TO service_role;

COMMIT;
