-- =============================================================================
-- 20260827231724_athlete_account_statement_rpc.sql
-- Autor: brylop   Fecha: 2026-08-27   Versión anterior: 20260827221826
-- Objetivo: "Estado de Cuenta" por atleta — pedido en la conversación del
--   27-ago como algo distinto del drill-down de un solo mes que ya trae
--   get_athlete_payment_timeline (F1 Cierre de Mes, mig. anterior). Acá se
--   pidió explícitamente: (1) saldo/resumen consolidado — TODO el histórico,
--   no una ventana de meses, (2) cruce con asistencia (igual que el drill-down
--   de un mes, pero para varios meses seguidos), (3) vista imprimible (sin
--   backend de PDF — se resuelve 100% en frontend con window.print(), decisión
--   de la conversación), (4) multi-mes de un vistazo.
--
--   Gate dual a propósito: la MISMA RPC sirve a la escuela (admin viendo a
--   cualquier atleta) y al padre/adulto viendo SU PROPIO estado de cuenta —
--   así hay una sola fuente de verdad en vez de dos RPCs con lógica que se
--   puede desalinear. Un menor nunca es el "yo" de la sesión (no inicia
--   sesión por su cuenta), así que su gate es "soy el padre de ese niño"
--   (children.parent_id = auth.uid()), no "soy yo mismo".
--
--   summary es SIN ventana (todo el histórico) — el saldo pendiente actual no
--   puede excluir deuda vieja solo porque quedó fuera de los últimos N meses.
--   events y meses SÍ usan la ventana p_months (default 12, tope 36 — es un
--   solo atleta, no toda la escuela, así que un rango generoso no pesa).
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

CREATE OR REPLACE FUNCTION public.get_athlete_account_statement(
    p_school_id                uuid,
    p_child_id                 uuid DEFAULT NULL,
    p_user_id                  uuid DEFAULT NULL,
    p_unregistered_athlete_id  uuid DEFAULT NULL,
    p_months                   int  DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_caller   uuid := auth.uid();
    v_es_admin boolean;
    v_es_propio boolean;
    v_desde    date;
    v_summary  jsonb;
    v_events   jsonb;
    v_meses    jsonb;
    v_athlete_name text;
BEGIN
    IF p_child_id IS NULL AND p_user_id IS NULL AND p_unregistered_athlete_id IS NULL THEN
        RAISE EXCEPTION 'Se necesita child_id, user_id o unregistered_athlete_id.';
    END IF;

    v_es_admin := public.is_super_admin() OR public.is_school_admin(p_school_id);
    v_es_propio :=
        (p_user_id IS NOT NULL AND v_caller = p_user_id)
        OR (p_child_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.children c WHERE c.id = p_child_id AND c.parent_id = v_caller
           ));

    IF v_caller IS NOT NULL AND NOT (v_es_admin OR v_es_propio) THEN
        RAISE EXCEPTION 'No autorizado para ver este estado de cuenta.';
    END IF;

    IF p_months IS NULL OR p_months < 1 OR p_months > 36 THEN
        p_months := 12;
    END IF;
    v_desde := date_trunc('month', (now() AT TIME ZONE 'America/Bogota')::date)::date
               - ((p_months - 1) || ' months')::interval;

    SELECT COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta')
      INTO v_athlete_name
      FROM (SELECT 1) dummy
      LEFT JOIN public.children              c  ON c.id  = p_child_id
      LEFT JOIN public.profiles              pr ON pr.id = p_user_id
      LEFT JOIN public.unregistered_athletes ua ON ua.id = p_unregistered_athlete_id;

    -- ── Resumen: TODO el histórico, sin ventana (§ arriba) ──────────────────
    SELECT jsonb_build_object(
        'count_expected',  count(*) FILTER (WHERE status NOT IN ('cancelled','rejected')),
        'total_expected',  COALESCE(sum(amount) FILTER (WHERE status NOT IN ('cancelled','rejected')), 0),
        'count_settled',   count(*) FILTER (WHERE status IN ('paid','partial')),
        'total_settled',   COALESCE(sum(amount) FILTER (WHERE status = 'paid'), 0)
                            + COALESCE(sum(amount_paid) FILTER (WHERE status = 'partial'), 0),
        'total_late_fees', COALESCE(sum(late_fee_amount) FILTER (WHERE status NOT IN ('cancelled','rejected')), 0)
    )
    INTO v_summary
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND (
            (p_child_id IS NOT NULL AND p.child_id = p_child_id)
         OR (p_child_id IS NULL AND p_unregistered_athlete_id IS NULL
               AND p_user_id IS NOT NULL AND (p.user_id = p_user_id OR p.parent_id = p_user_id))
         OR (p_unregistered_athlete_id IS NOT NULL AND p.unregistered_athlete_id = p_unregistered_athlete_id)
      );
    v_summary := v_summary || jsonb_build_object(
        'count_open', (v_summary->>'count_expected')::int - (v_summary->>'count_settled')::int,
        'total_open', (v_summary->>'total_expected')::numeric - (v_summary->>'total_settled')::numeric
    );

    -- ── Timeline: pagos + sesiones, ventana de p_months, intercalados ───────
    WITH pagos AS (
        SELECT 'pago' AS tipo, COALESCE(p.payment_date, p.due_date) AS fecha,
               p.status, p.amount, p.amount_paid, p.period_year, p.period_month,
               NULL::text AS attendance_status
        FROM public.payments p
        WHERE p.school_id = p_school_id
          AND (
                (p_child_id IS NOT NULL AND p.child_id = p_child_id)
             OR (p_child_id IS NULL AND p_unregistered_athlete_id IS NULL
                   AND p_user_id IS NOT NULL AND (p.user_id = p_user_id OR p.parent_id = p_user_id))
             OR (p_unregistered_athlete_id IS NOT NULL AND p.unregistered_athlete_id = p_unregistered_athlete_id)
          )
          AND COALESCE(p.payment_date, p.due_date) >= v_desde
    ),
    sesiones AS (
        SELECT 'sesion' AS tipo, a.attendance_date AS fecha,
               NULL::text AS status, NULL::numeric AS amount, NULL::numeric AS amount_paid,
               NULL::int AS period_year, NULL::int AS period_month,
               a.status AS attendance_status
        FROM public.attendance_records a
        WHERE a.school_id = p_school_id
          AND (
                (p_child_id IS NOT NULL AND a.child_id = p_child_id)
             OR (p_unregistered_athlete_id IS NOT NULL AND a.unregistered_athlete_id = p_unregistered_athlete_id)
             OR (p_child_id IS NULL AND p_unregistered_athlete_id IS NULL
                   AND p_user_id IS NOT NULL AND a.user_id = p_user_id)
          )
          AND a.attendance_date >= v_desde
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'tipo', t.tipo, 'fecha', t.fecha, 'status', t.status,
        'amount', t.amount, 'amount_paid', t.amount_paid,
        'period_year', t.period_year, 'period_month', t.period_month,
        'attendance_status', t.attendance_status
    ) ORDER BY t.fecha, t.tipo), '[]'::jsonb)
    INTO v_events
    FROM (SELECT * FROM pagos UNION ALL SELECT * FROM sesiones) t;

    -- ── Grilla multi-mes: un status por mes dentro de la ventana ────────────
    WITH meses_lista AS (
        SELECT (extract(year  from d))::int AS yy, (extract(month from d))::int AS mm, to_char(d, 'MM/YYYY') AS label
        FROM generate_series(0, p_months - 1) AS n
        CROSS JOIN LATERAL (
            SELECT (date_trunc('month', (now() AT TIME ZONE 'America/Bogota')::date) - (n || ' months')::interval)::date AS d
        ) s
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'periodo', ml.label,
        'status', (
            SELECT p.status
            FROM public.payments p
            WHERE p.school_id = p_school_id
              AND p.period_year = ml.yy AND p.period_month = ml.mm
              AND (
                    (p_child_id IS NOT NULL AND p.child_id = p_child_id)
                 OR (p_child_id IS NULL AND p_unregistered_athlete_id IS NULL
                       AND p_user_id IS NOT NULL AND (p.user_id = p_user_id OR p.parent_id = p_user_id))
                 OR (p_unregistered_athlete_id IS NOT NULL AND p.unregistered_athlete_id = p_unregistered_athlete_id)
              )
            ORDER BY (p.status NOT IN ('cancelled','rejected','failed')) DESC, p.created_at DESC
            LIMIT 1
        )
    ) ORDER BY ml.yy DESC, ml.mm DESC), '[]'::jsonb)
    INTO v_meses
    FROM meses_lista ml;

    RETURN jsonb_build_object(
        'school_id', p_school_id,
        'athlete_name', v_athlete_name,
        'summary', v_summary,
        'events', v_events,
        'meses', v_meses
    );
END;
$$;

COMMENT ON FUNCTION public.get_athlete_account_statement(uuid, uuid, uuid, uuid, int) IS
    'Estado de Cuenta por atleta: resumen histórico SIN ventana (saldo real actual) + timeline de pagos/sesiones y grilla multi-mes acotados a p_months (default 12, tope 36). Gate dual: admin de la escuela O el propio adulto/padre del menor. Ver conversación 27-ago-2026 — distinto de get_athlete_payment_timeline (ese es el drill-down de UN mes dentro del Cierre).';

REVOKE ALL ON FUNCTION public.get_athlete_account_statement(uuid, uuid, uuid, uuid, int) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_account_statement(uuid, uuid, uuid, uuid, int) TO authenticated;

COMMIT;
