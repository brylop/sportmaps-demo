-- =============================================================================
-- 20260903130555_auditoria_inscripciones_activas_sin_vigencia.sql
-- Autor: brylop   Fecha: 2026-09-03   Versión anterior: 20260903130451
-- Objetivo: detección proactiva de "atleta activo sin ninguna inscripción
-- activa" (el patrón exacto detrás del incidente de Dynasty/GYM RM del
-- 2026-09-02: septiembre les aparecía en $0 porque no había de dónde sacar
-- la cuota). Hasta hoy la única forma de encontrar esto era una auditoría
-- manual disparada por el reclamo de una escuela. Objetivo: que aparezca
-- solo, ANTES de que la escuela lo note.
--
-- Diseño (ver conversación 2026-09-02/03, root cause en
-- docs/specs/vigencia-cobranza-y-sesiones-unificado.md):
--   1. Tabla enrollment_integrity_findings — un hallazgo por atleta, con
--      snapshot de la última inscripción conocida (equipo/plan/cuota) para
--      que quien revise no tenga que ir a buscarlo a mano como hicimos hoy.
--   2. detect_enrollment_integrity_issues() — SECURITY DEFINER, solo
--      service_role (cron). UPSERT por (school_id, athlete_col, athlete_id):
--      si ya estaba 'open' o 'ignored' no lo toca (respeta la decisión
--      humana already tomada, ej. Blair Team = piloto abandonado, no bug);
--      si estaba 'resolved' y volvió a aparecer, lo reabre (señal real de
--      que el problema recurrió).
--   3. admin_run_enrollment_integrity_check() — RPC delgada gateada por
--      is_super_admin(), para el botón "Revisar ahora" del panel.
--   4. admin_list_enrollment_integrity_findings() / admin_resolve_...() —
--      RPCs de lectura/resolución para el panel, mismo gate.
--   5. Cron semanal (no mensual): un problema real como el de Dynasty no
--      debería esperar hasta el corte de facturación para notarse.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- 1. Tabla de hallazgos ------------------------------------------------------
CREATE TABLE public.enrollment_integrity_findings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid NOT NULL REFERENCES public.schools(id),
    athlete_col         text NOT NULL CHECK (athlete_col IN ('child_id', 'user_id', 'unregistered_athlete_id')),
    athlete_id          uuid NOT NULL,
    athlete_name        text NOT NULL,
    -- Snapshot de la ÚLTIMA inscripción conocida del atleta (activa o no),
    -- para que quien revise vea de un vistazo qué equipo/plan/cuota tenía
    -- antes de romperse — el mismo dato que tuve que buscar a mano hoy.
    last_team_name      text,
    last_plan_name      text,
    last_monthly_fee    numeric,
    last_enrollment_status text,
    status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
    resolution_note     text,
    resolved_by         uuid REFERENCES public.profiles(id),
    resolved_at         timestamptz,
    detected_at         timestamptz NOT NULL DEFAULT now(),
    last_seen_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, athlete_col, athlete_id)
);

COMMENT ON TABLE public.enrollment_integrity_findings IS
    'Un hallazgo por atleta activo sin ninguna inscripción activa (ni equipo ni plan) — '
    'el patrón detrás del incidente Dynasty/GYM RM 2026-09-02. Poblada por '
    'detect_enrollment_integrity_issues() (cron semanal). RLS habilitado sin policies: '
    'acceso únicamente vía las RPCs admin_* de esta migración.';

CREATE INDEX idx_enrollment_integrity_findings_open
    ON public.enrollment_integrity_findings (school_id)
    WHERE status = 'open';

-- Sin policies a propósito (deny-by-default): el acceso es solo vía las RPCs
-- SECURITY DEFINER de abajo, todas gateadas por is_super_admin().
ALTER TABLE public.enrollment_integrity_findings ENABLE ROW LEVEL SECURITY;

-- 2. Detección (cron-only) ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.detect_enrollment_integrity_issues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_row record;
    v_last record;
    v_was_insert boolean;
    v_new_count integer := 0;
    v_reopened_count integer := 0;
BEGIN
    FOR v_row IN
        SELECT sa.school_id, sa.id AS athlete_id, sa.full_name,
               CASE sa.athlete_type
                   WHEN 'child' THEN 'child_id'
                   WHEN 'adult' THEN 'user_id'
                   ELSE 'unregistered_athlete_id'
               END AS athlete_col
        FROM public.school_athletes sa
        WHERE sa.is_active = true
          AND sa.enrollment_id IS NULL
          -- Hay perfiles huérfanos sin escuela (ej. "Juanito Alimana", dato de
          -- prueba suelto) — sin school_id no hay nada que auditar ni a quién
          -- avisarle, y violaría el NOT NULL de la tabla.
          AND sa.school_id IS NOT NULL
    LOOP
        -- Última inscripción conocida (cualquier estado), para el snapshot.
        SELECT t.name AS team_name, op.name AS plan_name, e.monthly_fee, e.status
        INTO v_last
        FROM public.enrollments e
        LEFT JOIN public.teams t ON t.id = e.team_id
        LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
        WHERE (v_row.athlete_col = 'child_id' AND e.child_id = v_row.athlete_id)
           OR (v_row.athlete_col = 'user_id' AND e.user_id = v_row.athlete_id)
           OR (v_row.athlete_col = 'unregistered_athlete_id' AND e.unregistered_athlete_id = v_row.athlete_id)
        ORDER BY e.updated_at DESC LIMIT 1;

        INSERT INTO public.enrollment_integrity_findings AS f (
            school_id, athlete_col, athlete_id, athlete_name,
            last_team_name, last_plan_name, last_monthly_fee, last_enrollment_status
        ) VALUES (
            v_row.school_id, v_row.athlete_col, v_row.athlete_id, v_row.full_name,
            v_last.team_name, v_last.plan_name, v_last.monthly_fee, v_last.status
        )
        ON CONFLICT (school_id, athlete_col, athlete_id) DO UPDATE
        SET last_seen_at = now(),
            athlete_name = EXCLUDED.athlete_name,
            last_team_name = EXCLUDED.last_team_name,
            last_plan_name = EXCLUDED.last_plan_name,
            last_monthly_fee = EXCLUDED.last_monthly_fee,
            last_enrollment_status = EXCLUDED.last_enrollment_status,
            -- 'ignored' es una decisión humana ya tomada (ej. Blair Team =
            -- piloto abandonado, no un bug): no la pisamos. 'resolved' que
            -- reaparece SÍ se reabre — es señal de que el problema recurrió.
            status = CASE WHEN f.status = 'resolved' THEN 'open' ELSE f.status END,
            resolved_by = CASE WHEN f.status = 'resolved' THEN NULL ELSE f.resolved_by END,
            resolved_at = CASE WHEN f.status = 'resolved' THEN NULL ELSE f.resolved_at END
        RETURNING (xmax = 0) INTO v_was_insert;

        IF v_was_insert THEN
            v_new_count := v_new_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'checked_at', now(),
        'new_findings', v_new_count,
        'open_findings', (SELECT count(*) FROM public.enrollment_integrity_findings WHERE status = 'open')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.detect_enrollment_integrity_issues() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_enrollment_integrity_issues() TO service_role;

COMMENT ON FUNCTION public.detect_enrollment_integrity_issues() IS
    'Cron semanal: busca atletas activos (school_athletes.is_active) sin ninguna inscripción activa '
    '(school_athletes.enrollment_id IS NULL) y los registra/actualiza en enrollment_integrity_findings. '
    'No cancela ni repara nada — solo detecta y deja rastro para revisión humana.';

-- 3. RPC "Revisar ahora" (botón del panel) -----------------------------------
CREATE OR REPLACE FUNCTION public.admin_run_enrollment_integrity_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    RETURN public.detect_enrollment_integrity_issues();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_run_enrollment_integrity_check() TO authenticated;

-- 4. Listado para el panel ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_enrollment_integrity_findings(
    p_status text DEFAULT 'open',
    p_limit  int  DEFAULT 100,
    p_offset int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rows  jsonb;
    v_total bigint;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    SELECT count(*) INTO v_total
    FROM public.enrollment_integrity_findings f
    WHERE (p_status IS NULL OR f.status = p_status);

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.detected_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT f.id, f.school_id, s.name AS school_name, f.athlete_col, f.athlete_id,
               f.athlete_name, f.last_team_name, f.last_plan_name, f.last_monthly_fee,
               f.last_enrollment_status, f.status, f.resolution_note,
               f.detected_at, f.last_seen_at, f.resolved_at
        FROM public.enrollment_integrity_findings f
        JOIN public.schools s ON s.id = f.school_id
        WHERE (p_status IS NULL OR f.status = p_status)
        ORDER BY f.detected_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_enrollment_integrity_findings(text, int, int) TO authenticated;

-- 5. Resolver/ignorar un hallazgo ---------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_resolve_enrollment_integrity_finding(
    p_finding_id uuid,
    p_status     text,
    p_note       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden: super-admin only' USING ERRCODE = '42501';
    END IF;

    IF p_status NOT IN ('resolved', 'ignored') THEN
        RAISE EXCEPTION 'p_status debe ser resolved o ignored' USING ERRCODE = '22023';
    END IF;

    UPDATE public.enrollment_integrity_findings
    SET status = p_status,
        resolution_note = p_note,
        resolved_by = auth.uid(),
        resolved_at = now()
    WHERE id = p_finding_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Hallazgo no encontrado' USING ERRCODE = '02000';
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_enrollment_integrity_finding(uuid, text, text) TO authenticated;

-- 6. Cron semanal -------------------------------------------------------------
-- Lunes 08:00 UTC (03:00 COT) — antes de que arranque cualquier ciclo de
-- facturación del mes (el borrador de "Ciclo de Mes" dispara el día 5).
-- Semanal, no mensual: un caso como el de Dynasty no debería esperar a que
-- se abra el mes para notarse.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    PERFORM cron.unschedule('weekly-enrollment-integrity-check');
EXCEPTION WHEN OTHERS THEN
    NULL; -- el job no existía todavía; no es error
END $$;

SELECT cron.schedule(
    'weekly-enrollment-integrity-check',
    '0 8 * * 1',
    $cron$ SELECT public.detect_enrollment_integrity_issues(); $cron$
);

COMMIT;
