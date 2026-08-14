-- =============================================================================
-- 20260814173709_athlete_reports_system_cycle.sql
-- Autor: judegor99   Fecha: 2026-08-14   Versión anterior: 20260814125518
-- Objetivo: ciclo diario del Informe Mensual del Atleta (F5, parte 1) — generar
-- borradores y publicar los lotes vencidos desde un cron sin auth.uid().
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- Las RPCs humanas (generate_report_drafts, publish_athlete_report,
-- publish_team_reports, de 20260731163725) exigen can_manage_reports() ->
-- is_school_admin() -> auth.uid(). Bajo el cliente de service_role que usa un
-- cron, auth.uid() es NULL, así que esas RPCs rechazarían con 42501 en cada
-- escuela. Por eso: funciones NUEVAS y paralelas, cuerpo casi idéntico a las
-- auditadas, SIN el chequeo de auth.uid() — la puerta es el GRANT (solo
-- service_role), no un chequeo interno. No se toca ninguna función existente.

BEGIN;

-- ─── 1. generate_report_drafts_system ────────────────────────────────────────
-- Igual que generate_report_drafts, pero recorre TODAS las escuelas en una sola
-- invocación. Idempotente por escuela (ON CONFLICT DO NOTHING heredado); un
-- error en una escuela no aborta las demás (BEGIN/EXCEPTION por iteración).
CREATE OR REPLACE FUNCTION public.generate_report_drafts_system()
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
            WITH medidos AS (
                SELECT DISTINCT pe.subject_type, pe.subject_id
                FROM public.performance_entries pe
                WHERE pe.school_id = v_school.id
                  AND pe.recorded_at >= make_date(v_year::int, v_month::int, 1)
                  AND pe.recorded_at <  (make_date(v_year::int, v_month::int, 1) + INTERVAL '1 month')
            ),
            equipos AS (
                SELECT m.subject_type, m.subject_id, e.team_id,
                       public._report_send_day(v_school.id, e.team_id) AS send_day
                FROM medidos m
                JOIN public.enrollments e
                  ON e.school_id = v_school.id
                 AND e.team_id IS NOT NULL
                 AND e.start_date <= (make_date(v_year::int, v_month::int, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date
                 AND (e.end_date IS NULL OR e.end_date >= make_date(v_year::int, v_month::int, 1))
                 AND e.status::text <> 'cancelled'
                 AND (
                       (m.subject_type = 'child'        AND e.child_id                = m.subject_id)
                    OR (m.subject_type = 'profile'      AND e.user_id                 = m.subject_id)
                    OR (m.subject_type = 'unregistered' AND e.unregistered_athlete_id = m.subject_id)
                     )
            ),
            gobernante AS (
                SELECT DISTINCT ON (subject_type, subject_id)
                       subject_type, subject_id, team_id, send_day
                FROM equipos
                ORDER BY subject_type, subject_id, send_day DESC, team_id ASC
            ),
            final AS (
                SELECT m.subject_type, m.subject_id, g.team_id,
                       COALESCE(g.send_day, public._report_send_day(v_school.id, NULL)) AS send_day
                FROM medidos m
                LEFT JOIN gobernante g
                       ON g.subject_type = m.subject_type AND g.subject_id = m.subject_id
            )
            INSERT INTO public.athlete_reports (
                school_id, team_id, subject_type, subject_id,
                period_year, period_month, status, scheduled_for
            )
            SELECT v_school.id, f.team_id, f.subject_type, f.subject_id,
                   v_year, v_month, 'borrador',
                   public._report_scheduled_for(v_year, v_month, f.send_day)
            FROM final f
            ON CONFLICT (school_id, subject_type, subject_id, period_year, period_month) DO NOTHING;

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

COMMENT ON FUNCTION public.generate_report_drafts_system() IS
    'F5: genera borradores del periodo en curso para TODAS las escuelas. Solo '
    'service_role — el cron no tiene auth.uid() para pasar can_manage_reports().';

REVOKE ALL ON FUNCTION public.generate_report_drafts_system() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_report_drafts_system() TO service_role;


-- ─── 2. publish_athlete_report_system ────────────────────────────────────────
-- Copia de publish_athlete_report sin el bloque de autorización por auth.uid().
-- El job en Node arma el snapshot con buildReportSnapshot() (D-G, ya decidido
-- en el plan de F1) y llama esto una vez por informe.
CREATE OR REPLACE FUNCTION public.publish_athlete_report_system(
    p_report_id     uuid,
    p_snapshot      jsonb,
    p_override_note boolean DEFAULT false,
    p_reason        text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    r            public.athlete_reports;
    v_tiene_nota boolean;
    v_recipient  uuid;
BEGIN
    SELECT * INTO r FROM public.athlete_reports WHERE id = p_report_id FOR UPDATE;

    IF r.id IS NULL THEN
        RAISE EXCEPTION 'Informe no encontrado.' USING ERRCODE = 'P0002';
    END IF;

    IF r.status = 'publicado' THEN
        RAISE EXCEPTION 'El informe ya fue publicado el %.', r.published_at USING ERRCODE = '55000';
    END IF;

    -- El cron nunca fuerza un retenido: eso es del admin, a mano.
    IF r.status = 'retenido' THEN
        RAISE EXCEPTION 'El informe está retenido.' USING ERRCODE = '42501';
    END IF;

    IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' OR p_snapshot = '{}'::jsonb THEN
        RAISE EXCEPTION 'El snapshot del informe es obligatorio y no puede estar vacío.'
            USING ERRCODE = '22023';
    END IF;

    v_tiene_nota := r.team_id IS NULL OR EXISTS (
        SELECT 1 FROM public.team_report_notes n
        WHERE n.team_id = r.team_id AND n.period_year = r.period_year AND n.period_month = r.period_month
    );

    IF NOT v_tiene_nota AND NOT p_override_note THEN
        RAISE EXCEPTION 'Falta la nota del equipo gobernante.' USING ERRCODE = '55000';
    END IF;

    v_recipient := CASE
        WHEN r.subject_type = 'child'   THEN (SELECT c.parent_id FROM public.children c WHERE c.id = r.subject_id)
        WHEN r.subject_type = 'profile' THEN r.subject_id
        ELSE NULL
    END;

    UPDATE public.athlete_reports
       SET status = 'publicado', snapshot = p_snapshot, published_at = now(),
           published_by = NULL,  -- NULL = publicado por el sistema, no por un humano
           published_without_note = NOT v_tiene_nota, recipient_id = v_recipient,
           hold_reason = CASE WHEN NOT v_tiene_nota THEN btrim(p_reason) ELSE hold_reason END
     WHERE id = p_report_id;

    RETURN p_report_id;
END;
$$;

COMMENT ON FUNCTION public.publish_athlete_report_system(uuid, jsonb, boolean, text) IS
    'F5: variante de publish_athlete_report invocable SOLO por service_role. '
    'published_by queda NULL = publicado por el sistema.';

REVOKE ALL ON FUNCTION public.publish_athlete_report_system(uuid, jsonb, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_athlete_report_system(uuid, jsonb, boolean, text) TO service_role;


-- ─── 3. publish_team_reports_system ──────────────────────────────────────────
-- Copia de publish_team_reports que llama a la variante _system de arriba.
CREATE OR REPLACE FUNCTION public.publish_team_reports_system(
    p_school_id uuid, p_team_id uuid, p_year smallint, p_month smallint,
    p_snapshots jsonb, p_override_note boolean DEFAULT false, p_reason text DEFAULT NULL
)
RETURNS TABLE (report_id uuid, resultado text, detalle text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_snap jsonb;
BEGIN
    FOR v_rec IN
        SELECT ar.id, ar.status FROM public.athlete_reports ar
        WHERE ar.school_id = p_school_id AND ar.team_id = p_team_id
          AND ar.period_year = p_year AND ar.period_month = p_month
        ORDER BY ar.id
    LOOP
        IF v_rec.status = 'publicado' THEN
            RETURN QUERY SELECT v_rec.id, 'saltado'::text, 'ya estaba publicado'::text; CONTINUE;
        END IF;
        IF v_rec.status IN ('retenido','omitido') THEN
            RETURN QUERY SELECT v_rec.id, 'saltado'::text, ('estado ' || v_rec.status)::text; CONTINUE;
        END IF;

        v_snap := p_snapshots -> v_rec.id::text;
        IF v_snap IS NULL THEN
            RETURN QUERY SELECT v_rec.id, 'error'::text, 'sin snapshot en p_snapshots'::text; CONTINUE;
        END IF;

        BEGIN
            PERFORM public.publish_athlete_report_system(v_rec.id, v_snap, p_override_note, p_reason);
            RETURN QUERY SELECT v_rec.id, 'publicado'::text, NULL::text;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT v_rec.id, 'error'::text, SQLERRM::text;
        END;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.publish_team_reports_system(uuid, uuid, smallint, smallint, jsonb, boolean, text) IS
    'F5: variante de publish_team_reports invocable SOLO por service_role. '
    'Un informe con problema no aborta el lote.';

REVOKE ALL ON FUNCTION public.publish_team_reports_system(uuid, uuid, smallint, smallint, jsonb, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_team_reports_system(uuid, uuid, smallint, smallint, jsonb, boolean, text) TO service_role;

COMMIT;
