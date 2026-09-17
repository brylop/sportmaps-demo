-- =============================================================================
-- 20260914151925_post_entreno_informe_grupal.sql
-- Autor: brylop   Fecha: 2026-09-14   Versión anterior: 20260911125148
-- Objetivo: F4 (segunda mitad) de "Evaluación Post-Entrenamiento" — docs/specs/evaluacion-post-entrenamiento.md §3.5
--
-- El informe POR ATLETA (athlete_reports + metrics_session, ya en F1-F2/F4)
-- responde "cómo estuvo mi hijo". El PDF original de Besser es un informe DE
-- EQUIPO — lo que esta migración agrega: dos tablas nuevas, calcadas del
-- patrón ya probado de athlete_reports (misma máquina de estados mínima,
-- mismas convenciones de RLS/GRANT), NO una reescritura de ese sistema.
--
--   · team_reports         — uno por equipo y periodo. status borrador/publicado.
--   · report_section_notes — el comentario del coach POR BLOQUE del informe
--     (spec: "cada gráfico lleva debajo un párrafo interpretativo"), no una
--     sola nota. Sirve para athlete_reports y team_reports (report_type).
--
-- Deliberadamente MÁS SIMPLE que athlete_reports: sin snapshots archivados
-- (athlete_report_snapshots), sin recipient/sent_at/viewed_at (el informe
-- grupal no tiene "destinatario" individual — lo ven coach/admin, y
-- opcionalmente las familias del equipo vía toggle, spec §7 abierta #1, que
-- sigue sin decidir — por ahora esta migración NO agrega ese toggle ni
-- expone el informe grupal a padres).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · FKs de negocio a public.profiles(id), no a auth.users.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
--   · Escritura de tablas operativas: user_staff_school_ids(), no user_school_ids().
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. team_reports ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_reports (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id        uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    period_year    smallint    NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    period_month   smallint    NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    status         text        NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'publicado')),
    snapshot       jsonb,
    published_at   timestamptz,
    published_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT team_reports_unique_team_period UNIQUE (school_id, team_id, period_year, period_month),
    CONSTRAINT team_reports_published_needs_snapshot   CHECK (status <> 'publicado' OR snapshot IS NOT NULL),
    CONSTRAINT team_reports_published_needs_timestamp  CHECK (status <> 'publicado' OR published_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_team_reports_period ON public.team_reports (school_id, period_year, period_month, status);
CREATE INDEX IF NOT EXISTS idx_team_reports_team    ON public.team_reports (team_id);

DROP TRIGGER IF EXISTS trg_team_reports_touch ON public.team_reports;
CREATE TRIGGER trg_team_reports_touch
    BEFORE UPDATE ON public.team_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.team_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.team_reports FROM anon, authenticated;
-- Igual que athlete_reports: SELECT directo, toda escritura por RPC (abajo).
GRANT SELECT ON public.team_reports TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_reports'
          AND policyname = 'team_reports_select_staff'
    ) THEN
        CREATE POLICY "team_reports_select_staff" ON public.team_reports
            FOR SELECT USING (school_id = ANY (public.user_staff_school_ids()));
    END IF;
END $$;

-- ─── 2. report_section_notes ─────────────────────────────────────────────────
-- school_id denormalizado a propósito: report_id es polimórfico (athlete_reports
-- o team_reports según report_type, igual que performance_entries.subject_id no
-- lleva FK) y la RLS necesita una columna propia para no depender de un JOIN
-- condicional a dos tablas distintas.
CREATE TABLE IF NOT EXISTS public.report_section_notes (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    report_type  text        NOT NULL CHECK (report_type IN ('athlete', 'team')),
    report_id    uuid        NOT NULL,
    section_key  text        NOT NULL CHECK (section_key IN
                     ('rpe_borg', 'task_comprehension', 'self_effort_pct', 'satisfaction',
                      'focus', 'coach_effort_rating', 'general')),
    body         text        NOT NULL CHECK (length(btrim(body)) > 0),
    author_id    uuid        REFERENCES public.school_staff(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT report_section_notes_unique UNIQUE (report_type, report_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_report_section_notes_report
    ON public.report_section_notes (report_type, report_id);

DROP TRIGGER IF EXISTS trg_report_section_notes_touch ON public.report_section_notes;
CREATE TRIGGER trg_report_section_notes_touch
    BEFORE UPDATE ON public.report_section_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.report_section_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.report_section_notes FROM anon, authenticated;
-- Texto plano sin máquina de estados, igual que team_report_notes: el coach
-- escribe directo, la RLS restringe a su escuela. Sin DELETE (se reescribe).
GRANT SELECT, INSERT, UPDATE ON public.report_section_notes TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_section_notes'
          AND policyname = 'report_section_notes_select_staff'
    ) THEN
        CREATE POLICY "report_section_notes_select_staff" ON public.report_section_notes
            FOR SELECT USING (school_id = ANY (public.user_staff_school_ids()));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_section_notes'
          AND policyname = 'report_section_notes_write_staff'
    ) THEN
        CREATE POLICY "report_section_notes_write_staff" ON public.report_section_notes
            FOR INSERT WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_section_notes'
          AND policyname = 'report_section_notes_update_staff'
    ) THEN
        CREATE POLICY "report_section_notes_update_staff" ON public.report_section_notes
            FOR UPDATE USING (school_id = ANY (public.user_staff_school_ids()))
            WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
    END IF;
END $$;

-- ─── 3. generate_team_report_drafts_system ───────────────────────────────────
-- Mismo patrón que generate_report_drafts_system (20260814173709): SIN
-- auth.uid() porque lo llama un cron con service_role. Un borrador por equipo
-- con al menos una medición de sesión (context_type='session') en el mes.
CREATE OR REPLACE FUNCTION public.generate_team_report_drafts_system()
RETURNS TABLE(school_id uuid, created integer, error_msg text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school  record;
    v_year    smallint := EXTRACT(YEAR  FROM (now() AT TIME ZONE 'America/Bogota'))::smallint;
    v_month   smallint := EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Bogota'))::smallint;
    v_creados integer;
BEGIN
    FOR v_school IN SELECT id FROM public.schools LOOP
        BEGIN
            WITH equipos_con_sesiones AS (
                SELECT DISTINCT s.team_id
                  FROM public.attendance_sessions s
                  JOIN public.performance_entries pe
                    ON pe.context_type = 'session' AND pe.context_id = s.id
                 WHERE s.school_id = v_school.id
                   AND s.session_date >= make_date(v_year::int, v_month::int, 1)
                   AND s.session_date <  (make_date(v_year::int, v_month::int, 1) + INTERVAL '1 month')::date
            )
            INSERT INTO public.team_reports (school_id, team_id, period_year, period_month, status)
            SELECT v_school.id, e.team_id, v_year, v_month, 'borrador'
              FROM equipos_con_sesiones e
            ON CONFLICT (school_id, team_id, period_year, period_month) DO NOTHING;

            GET DIAGNOSTICS v_creados = ROW_COUNT;
            school_id := v_school.id; created := v_creados; error_msg := NULL;
            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            school_id := v_school.id; created := 0; error_msg := SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_team_report_drafts_system() IS
    'F4: genera borradores de informe DE EQUIPO del periodo en curso, para todas '
    'las escuelas. Solo service_role.';

REVOKE ALL ON FUNCTION public.generate_team_report_drafts_system() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_team_report_drafts_system() TO service_role;

-- ─── 4. publish_team_report_system ───────────────────────────────────────────
-- El BFF arma el snapshot (buildTeamReportSnapshot, igual que athlete_reports:
-- D-G — el cálculo vive en TS, no en SQL) y llama esto una vez por informe.
CREATE OR REPLACE FUNCTION public.publish_team_report_system(
    p_report_id uuid,
    p_snapshot  jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    r public.team_reports;
BEGIN
    SELECT * INTO r FROM public.team_reports WHERE id = p_report_id FOR UPDATE;

    IF r.id IS NULL THEN
        RAISE EXCEPTION 'Informe de equipo no encontrado.' USING ERRCODE = 'P0002';
    END IF;
    IF r.status = 'publicado' THEN
        RAISE EXCEPTION 'El informe ya fue publicado el %.', r.published_at USING ERRCODE = '55000';
    END IF;
    IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' OR p_snapshot = '{}'::jsonb THEN
        RAISE EXCEPTION 'El snapshot del informe es obligatorio y no puede estar vacío.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.team_reports
       SET status = 'publicado', snapshot = p_snapshot, published_at = now(), published_by = NULL
     WHERE id = p_report_id;

    RETURN p_report_id;
END;
$$;

COMMENT ON FUNCTION public.publish_team_report_system(uuid, jsonb) IS
    'F4: publica un informe de equipo ya armado (snapshot congelado). Solo service_role.';

REVOKE ALL ON FUNCTION public.publish_team_report_system(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_team_report_system(uuid, jsonb) TO service_role;

COMMIT;

-- =============================================================================
-- Qué NO hace esta migración, a propósito (deuda explícita, no descuido):
--   · No expone el informe grupal a los padres — spec §7 abierta #1 sigue sin
--     decidir si se envía a todas las familias del equipo o solo a coach/admin.
--     Mientras no se decida, SOLO coach/admin pueden verlo (RLS de arriba).
--   · No archiva versiones anteriores (sin equivalente a athlete_report_snapshots)
--     — un informe de equipo republicado simplemente no puede (`status='publicado'`
--     ya bloquea `publish_team_report_system`); regenerar exige una migración de
--     soporte si algún día hace falta, igual que se decidió NO sobre-construir F4.
--   · No agrega el job de cron que llame generate_team_report_drafts_system() /
--     publish_team_report_system() — el BFF (report-snapshot.service.ts) ya
--     construye buildTeamReportSnapshot(); cablearlo al ciclo diario de
--     athlete-reports.job.ts es la publicación real, pendiente aparte.
-- =============================================================================
