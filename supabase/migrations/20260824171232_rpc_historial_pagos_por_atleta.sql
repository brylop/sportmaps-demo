-- =============================================================================
-- 20260824171232_rpc_historial_pagos_por_atleta.sql
-- Autor: brylop   Fecha: 2026-08-24   Versión anterior: 20260824165639
-- Objetivo: hoy `get_payment_aging_report` (mig. 20260824141220) solo lista a
-- quien DEBE algo. Quien está al día no aparece en ningún reporte con su
-- historial — no hay forma de verificar "este atleta pagó agosto, julio y
-- junio, todo correcto" sin ir cobro por cobro. Esta RPC nueva devuelve, para
-- TODO el roster activo (deba o no), una grilla de los últimos N meses con el
-- estado de cada uno, para auditar tanto morosos como al-día en una sola vista.
--
-- Decisiones de diseño (consistentes con get_payment_aging_report):
--   · Roster = enrollments activos, misma identidad que open_month (child_id;
--     si no, COALESCE(user_id, parent_id) para adultos —cubre el legacy en
--     parent_id—; si no, unregistered_athlete_id).
--   · Por atleta y mes: el cobro de ESE período (si hay varios por algún bug de
--     duplicado, se prioriza el que no sea terminal — paid/pending/overdue/
--     partial/awaiting_approval/glosado — sobre cancelled/rejected/failed, y
--     de esos el más reciente). Sin cobro ese mes = 'sin_cobro' (NULL), que NO
--     cuenta como deuda: un atleta nuevo no debe los meses antes de inscribirse.
--   · `al_dia` = true si ninguno de los N meses devueltos quedó en
--     pending/overdue/partial (paid/awaiting_approval/glosado/sin_cobro no
--     cuentan en contra — awaiting_approval y glosado ya actuaron, igual que en
--     get_payment_aging_report).
--   · p_months default 3 (el pedido fue "2-3 meses pagados y todo correcto").
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

CREATE OR REPLACE FUNCTION public.get_school_payment_history_grid(
    p_school_id uuid,
    p_branch_id uuid DEFAULT NULL,
    p_months int DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_today  date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_cy     int  := extract(year  from v_today)::int;
    v_cm     int  := extract(month from v_today)::int;
    v_meses  jsonb;
    v_items  jsonb;
BEGIN
    IF v_caller IS NOT NULL
       AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'No autorizado.';
    END IF;

    IF p_months IS NULL OR p_months < 1 OR p_months > 12 THEN
        p_months := 3;
    END IF;

    WITH meses_lista AS (
        SELECT
            (extract(year  from d))::int AS yy,
            (extract(month from d))::int AS mm,
            to_char(d, 'MM/YYYY')        AS label
        FROM generate_series(0, p_months - 1) AS n
        CROSS JOIN LATERAL (
            SELECT (make_date(v_cy, v_cm, 1) - (n || ' months')::interval)::date AS d
        ) s
    ),
    roster AS (
        SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
            e.child_id,
            e.user_id,
            e.unregistered_athlete_id,
            COALESCE(c.branch_id, t.branch_id)                          AS branch_id,
            COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta') AS athlete_name,
            CASE
                WHEN e.child_id IS NOT NULL THEN 'menor'
                WHEN e.unregistered_athlete_id IS NOT NULL THEN 'no_registrado'
                ELSE 'adulto'
            END AS tipo
        FROM public.enrollments e
        LEFT JOIN public.children              c  ON c.id  = e.child_id
        LEFT JOIN public.profiles              pr ON pr.id = e.user_id
        LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
        LEFT JOIN public.teams                 t  ON t.id  = e.team_id
        WHERE e.school_id = p_school_id
          AND e.status = 'active'
          AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
          AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
        ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id), e.created_at ASC
    ),
    grid AS (
        SELECT
            r.child_id, r.user_id, r.unregistered_athlete_id, r.branch_id, r.athlete_name, r.tipo,
            ml.yy, ml.mm, ml.label,
            (
                SELECT p.status
                FROM public.payments p
                WHERE p.school_id = p_school_id
                  AND p.period_year = ml.yy AND p.period_month = ml.mm
                  AND (
                        (r.child_id IS NOT NULL AND p.child_id = r.child_id)
                     OR (r.child_id IS NULL AND r.unregistered_athlete_id IS NULL
                           AND (p.user_id = r.user_id OR p.parent_id = r.user_id))
                     OR (r.unregistered_athlete_id IS NOT NULL AND p.unregistered_athlete_id = r.unregistered_athlete_id)
                  )
                ORDER BY (p.status NOT IN ('cancelled', 'rejected', 'failed')) DESC, p.created_at DESC
                LIMIT 1
            ) AS status
        FROM roster r
        CROSS JOIN meses_lista ml
    ),
    -- Un solo nivel de agregación por fila (Postgres no permite anidar
    -- jsonb_agg dentro de otro agregado en el mismo SELECT); el jsonb_agg
    -- final que arma el arreglo de atletas va aparte, sobre este resultado.
    por_atleta_hist AS (
        SELECT
            g.athlete_name,
            g.tipo,
            g.branch_id,
            NOT bool_or(COALESCE(g.status, 'sin_cobro') IN ('pending', 'overdue', 'partial')) AS al_dia,
            jsonb_agg(jsonb_build_object(
                'periodo', g.label,
                'status',  COALESCE(g.status, 'sin_cobro')
            ) ORDER BY g.yy DESC, g.mm DESC) AS meses
        FROM grid g
        GROUP BY g.child_id, g.user_id, g.unregistered_athlete_id, g.athlete_name, g.tipo, g.branch_id
    )
    SELECT
        COALESCE(jsonb_agg(jsonb_build_object(
            'athlete',   pa.athlete_name,
            'tipo',      pa.tipo,
            'branch_id', pa.branch_id,
            'al_dia',    pa.al_dia,
            'meses',     pa.meses
        ) ORDER BY pa.athlete_name), '[]'::jsonb)
    INTO v_items
    FROM por_atleta_hist pa;

    SELECT jsonb_agg(jsonb_build_object('year', yy, 'month', mm, 'label', label) ORDER BY yy DESC, mm DESC)
      INTO v_meses
    FROM (
        SELECT (extract(year from d))::int AS yy, (extract(month from d))::int AS mm, to_char(d, 'MM/YYYY') AS label
        FROM generate_series(0, p_months - 1) AS n
        CROSS JOIN LATERAL (SELECT (make_date(v_cy, v_cm, 1) - (n || ' months')::interval)::date AS d) s
    ) m;

    RETURN jsonb_build_object(
        'school_id', p_school_id,
        'branch_id', p_branch_id,
        'meses',     v_meses,
        'count',     jsonb_array_length(v_items),
        'items',     v_items
    );
END;
$$;

COMMENT ON FUNCTION public.get_school_payment_history_grid(uuid, uuid, int) IS
    'Grilla de los últimos N meses (default 3) de estado de pago por atleta, para TODO el roster activo (deba o no). al_dia=true si ningún mes quedó en pending/overdue/partial. Mismo criterio de identidad que open_month/get_payment_aging_report.';

REVOKE ALL ON FUNCTION public.get_school_payment_history_grid(uuid, uuid, int) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_school_payment_history_grid(uuid, uuid, int) TO authenticated;

COMMIT;

-- ── Verificación después de aplicar ────────────────────────────────────────
--   select get_school_payment_history_grid('2d509571-3238-4c04-ac3f-6dfe20539226', NULL, 3);
--   Esperado hoy (2026-08-24): ~468 atletas, meses = [08/2026, 07/2026, 06/2026].
--   Julio y junio no se cobraron (arranque agosto 2026) → 'sin_cobro' en esos
--   dos meses para casi todos, sin que eso los marque como NO al_dia. Quien ya
--   pagó agosto → al_dia=true con [ago:paid, jul:sin_cobro, jun:sin_cobro].
