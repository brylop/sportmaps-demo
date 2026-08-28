-- =============================================================================
-- 20260827221826_cierre_de_mes_rpcs.sql
-- Autor: brylop   Fecha: 2026-08-27   Versión anterior: 20260827221640
-- Objetivo: F1 del módulo Ciclo de Mes (docs/plan-f1-cierre-de-mes.md §3) —
--   las RPCs del botón "Cerrar mes" sobre monthly_closes (mig. anterior).
--
--   preview_close_month / close_month calculan 7 totales AGREGADOS (facturado,
--   cobrado, cartera residual, mora, y sus 3 conteos) — NO el detalle nominal:
--   quién debe se sigue viendo con get_payment_aging_report y quién pagó con
--   el tab Historial, ambos ya existentes y sin tocar. total_open/count_open
--   son residuales (expected - settled), a propósito más simples que la
--   cartera "real" de get_payment_aging_report (que excluye awaiting_approval/
--   glosado) — el residuo es para el snapshot agregado del año, no para
--   perseguir cobranza.
--
--   close_month reutiliza el MISMO advisory lock que open_month
--   (hashtextextended(school:year:month, 0)) a propósito: cerrar y abrir el
--   mismo período nunca corren en simultáneo, evita leer payments a mitad de
--   una generación. Recerrar (close_month sobre un mes ya 'cerrado') recalcula
--   y sobreescribe directo — decisión de producto del 27-ago, no exige pasar
--   por reopen_month primero.
--
--   get_athlete_payment_timeline es el drill-down por atleta: v1 devuelve el
--   cruce CRUDO de pagos + asistencia del período, sin resolver todavía si
--   una sesión quedó "cubierta" o no por el pago — eso es una iteración
--   posterior, pospuesta explícitamente. Recibe la identidad ya desarmada
--   (child_id / user_id / unregistered_athlete_id) en vez de una key
--   empaquetada, igual que el resto de las RPCs de pagos del repo.
--
--   get_payment_aging_report se REEMPLAZA (mismo contrato + 3 campos nuevos:
--   los ids de identidad) para que el frontend pueda pasarle esos ids a
--   get_athlete_payment_timeline al hacer clic en una fila — hoy esa RPC solo
--   devuelve el nombre para mostrar, no una forma de identificar a quién se
--   clickeó. Cambio aditivo: nadie que ya consuma el jsonb se rompe por 3
--   campos de más.
--
--   get_school_year_closes_report arma el reporte anual con una simple
--   lectura de monthly_closes — cada cierre ya trae sus totales, no hay
--   agregación nueva que calcular.
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

-- ─── 1. preview_close_month — solo lectura ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_close_month(
    p_school_id uuid,
    p_year      int,
    p_month     int,
    p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_caller IS NOT NULL
       AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'No autorizado para ver el cierre de esta escuela.';
    END IF;

    IF p_year IS NULL OR p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
        RAISE EXCEPTION 'Periodo inválido.';
    END IF;

    SELECT jsonb_build_object(
        'school_id',       p_school_id,
        'branch_id',       p_branch_id,
        'period_year',     p_year,
        'period_month',    p_month,
        'count_expected',  count(*) FILTER (WHERE status NOT IN ('cancelled','rejected')),
        'total_expected',  COALESCE(sum(amount) FILTER (WHERE status NOT IN ('cancelled','rejected')), 0),
        'count_settled',   count(*) FILTER (WHERE status IN ('paid','partial')),
        'total_settled',   COALESCE(sum(amount) FILTER (WHERE status = 'paid'), 0)
                            + COALESCE(sum(amount_paid) FILTER (WHERE status = 'partial'), 0),
        'total_late_fees', COALESCE(sum(late_fee_amount) FILTER (WHERE status NOT IN ('cancelled','rejected')), 0)
    )
    INTO v_result
    FROM public.payments
    WHERE school_id = p_school_id
      AND period_year = p_year AND period_month = p_month
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

    -- count_open/total_open son residuales: expected - settled. A propósito
    -- más simples que la cartera "real" de get_payment_aging_report.
    RETURN v_result || jsonb_build_object(
        'count_open', (v_result->>'count_expected')::int - (v_result->>'count_settled')::int,
        'total_open', (v_result->>'total_expected')::numeric - (v_result->>'total_settled')::numeric
    );
END;
$$;

COMMENT ON FUNCTION public.preview_close_month(uuid, int, int, uuid) IS
    'F1 Cierre de Mes: totales agregados que congelaría close_month, sin escribir nada. total_open/count_open son residuales (expected-settled). Ver docs/plan-f1-cierre-de-mes.md §3.1.';

REVOKE ALL ON FUNCTION public.preview_close_month(uuid, int, int, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.preview_close_month(uuid, int, int, uuid) TO authenticated;

-- ─── 2. close_month — escribe/recalcula el snapshot ─────────────────────────
CREATE OR REPLACE FUNCTION public.close_month(
    p_school_id uuid,
    p_year      int,
    p_month     int,
    p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_totals jsonb;
    v_row    public.monthly_closes;
BEGIN
    IF v_caller IS NOT NULL
       AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'No autorizado para cerrar el mes de esta escuela.';
    END IF;

    IF p_year IS NULL OR p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
        RAISE EXCEPTION 'Periodo inválido.';
    END IF;

    -- Mismo lock que open_month (F0): cerrar y abrir el mismo periodo nunca
    -- corren en simultáneo.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
    );

    v_totals := public.preview_close_month(p_school_id, p_year, p_month, p_branch_id);

    -- El ON CONFLICT de abajo solo tiene como árbitro el índice parcial
    -- WHERE branch_id IS NULL (v1 nunca manda p_branch_id — multi-sede real es
    -- F2+, fuera de este plan). Un p_branch_id no NULL sí queda protegido por
    -- el otro índice único (uniq_monthly_close_branch), pero recerrar ese caso
    -- no hace UPDATE — chocaría con un 23505 sin manejar. No se resuelve acá
    -- a propósito: nada en v1 ejercita esa rama.
    INSERT INTO public.monthly_closes (
        school_id, branch_id, period_year, period_month, scope, status,
        closed_by, closed_at,
        total_expected, total_settled, total_open, total_late_fees,
        count_expected, count_settled, count_open
    ) VALUES (
        p_school_id, p_branch_id, p_year, p_month, 'cobros', 'cerrado',
        v_caller, now(),
        (v_totals->>'total_expected')::numeric, (v_totals->>'total_settled')::numeric,
        (v_totals->>'total_open')::numeric, (v_totals->>'total_late_fees')::numeric,
        (v_totals->>'count_expected')::int, (v_totals->>'count_settled')::int,
        (v_totals->>'count_open')::int
    )
    ON CONFLICT (school_id, period_year, period_month, scope) WHERE branch_id IS NULL
    DO UPDATE SET
        status          = 'cerrado',
        closed_by       = v_caller,
        closed_at       = now(),
        total_expected  = EXCLUDED.total_expected,
        total_settled   = EXCLUDED.total_settled,
        total_open      = EXCLUDED.total_open,
        total_late_fees = EXCLUDED.total_late_fees,
        count_expected  = EXCLUDED.count_expected,
        count_settled   = EXCLUDED.count_settled,
        count_open      = EXCLUDED.count_open,
        updated_at      = now()
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION public.close_month(uuid, int, int, uuid) IS
    'F1 Cierre de Mes: congela los totales del periodo en monthly_closes (scope=cobros). Soft-close (D5): no bloquea pagos ni open_month. Idempotente: recerrar un mes ya cerrado recalcula y sobreescribe directo, sin exigir reopen_month. Ver docs/plan-f1-cierre-de-mes.md §3.2.';

REVOKE ALL ON FUNCTION public.close_month(uuid, int, int, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.close_month(uuid, int, int, uuid) TO authenticated;

-- ─── 3. reopen_month — motivo obligatorio (D6 del spec) ─────────────────────
CREATE OR REPLACE FUNCTION public.reopen_month(
    p_school_id uuid,
    p_year      int,
    p_month     int,
    p_reason    text,
    p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_row    public.monthly_closes;
BEGIN
    IF v_caller IS NOT NULL
       AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'No autorizado para reabrir el mes de esta escuela.';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'Reabrir un cierre requiere un motivo.';
    END IF;

    UPDATE public.monthly_closes
    SET status        = 'reabierto',
        reopened_by   = v_caller,
        reopened_at   = now(),
        reopen_reason = p_reason,
        updated_at    = now()
    WHERE school_id = p_school_id AND period_year = p_year AND period_month = p_month
      AND scope = 'cobros' AND branch_id IS NOT DISTINCT FROM p_branch_id
      AND status = 'cerrado'
    RETURNING * INTO v_row;

    IF v_row IS NULL THEN
        RAISE EXCEPTION 'No hay un cierre "cerrado" para ese periodo — nada que reabrir.';
    END IF;

    RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION public.reopen_month(uuid, int, int, text, uuid) IS
    'F1 Cierre de Mes: reabre un cierre "cerrado" (motivo obligatorio, D6 del spec). No borra el snapshot previo — queda como último valor conocido hasta el próximo close_month. Ver docs/plan-f1-cierre-de-mes.md §3.3.';

REVOKE ALL ON FUNCTION public.reopen_month(uuid, int, int, text, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reopen_month(uuid, int, int, text, uuid) TO authenticated;

-- ─── 4. get_school_year_closes_report — reporte anual ───────────────────────
CREATE OR REPLACE FUNCTION public.get_school_year_closes_report(
    p_school_id uuid,
    p_year      int,
    p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_meses  jsonb;
BEGIN
    IF v_caller IS NOT NULL
       AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'No autorizado para ver el reporte anual de esta escuela.';
    END IF;

    -- Los 12 meses del año, con el cierre si existe o 'sin_cierre' en 0 si no
    -- — para que el reporte no tenga huecos silenciosos.
    WITH meses AS (
        SELECT generate_series(1, 12) AS period_month
    )
    SELECT jsonb_agg(jsonb_build_object(
        'period_month',    m.period_month,
        'status',          COALESCE(mc.status, 'sin_cierre'),
        'total_expected',  COALESCE(mc.total_expected, 0),
        'total_settled',   COALESCE(mc.total_settled, 0),
        'total_open',      COALESCE(mc.total_open, 0),
        'total_late_fees', COALESCE(mc.total_late_fees, 0),
        'count_expected',  COALESCE(mc.count_expected, 0),
        'count_settled',   COALESCE(mc.count_settled, 0),
        'count_open',      COALESCE(mc.count_open, 0),
        'closed_at',       mc.closed_at
    ) ORDER BY m.period_month)
    INTO v_meses
    FROM meses m
    LEFT JOIN public.monthly_closes mc
           ON mc.school_id = p_school_id
          AND mc.period_year = p_year
          AND mc.period_month = m.period_month
          AND mc.scope = 'cobros'
          AND mc.branch_id IS NOT DISTINCT FROM p_branch_id;

    RETURN jsonb_build_object(
        'school_id', p_school_id,
        'branch_id', p_branch_id,
        'year',      p_year,
        'meses',     v_meses
    );
END;
$$;

COMMENT ON FUNCTION public.get_school_year_closes_report(uuid, int, uuid) IS
    'F1 Cierre de Mes: reporte anual — los 12 meses del año con su cierre (o sin_cierre si nunca se cerró). Lectura directa de monthly_closes, sin agregación nueva. Ver docs/plan-f1-cierre-de-mes.md §3.5.';

REVOKE ALL ON FUNCTION public.get_school_year_closes_report(uuid, int, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_school_year_closes_report(uuid, int, uuid) TO authenticated;

-- ─── 5. get_athlete_payment_timeline — drill-down por atleta ────────────────
-- Identidad desarmada (child_id / user_id / unregistered_athlete_id), igual
-- que el resto de las RPCs de pagos del repo — exactamente uno de los tres
-- viene poblado. v1 devuelve pagos + sesiones del período CRUDOS, sin marcar
-- todavía si una sesión quedó cubierta por el pago (pospuesto, conversación
-- 27-ago).
CREATE OR REPLACE FUNCTION public.get_athlete_payment_timeline(
    p_school_id                uuid,
    p_year                     int,
    p_month                    int,
    p_child_id                 uuid DEFAULT NULL,
    p_user_id                  uuid DEFAULT NULL,
    p_unregistered_athlete_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_caller  uuid := auth.uid();
    v_desde   date;
    v_hasta   date;
    v_events  jsonb;
BEGIN
    IF v_caller IS NOT NULL
       AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'No autorizado para ver el historial de este atleta.';
    END IF;

    IF p_child_id IS NULL AND p_user_id IS NULL AND p_unregistered_athlete_id IS NULL THEN
        RAISE EXCEPTION 'Se necesita child_id, user_id o unregistered_athlete_id.';
    END IF;

    v_desde := make_date(p_year, p_month, 1);
    v_hasta := (v_desde + interval '1 month' - interval '1 day')::date;

    WITH pagos AS (
        SELECT
            'pago'          AS tipo,
            COALESCE(p.payment_date, p.due_date) AS fecha,
            p.status,
            p.amount,
            p.amount_paid,
            p.period_year,
            p.period_month,
            NULL::text AS attendance_status
        FROM public.payments p
        WHERE p.school_id = p_school_id
          AND (
                (p_child_id IS NOT NULL AND p.child_id = p_child_id)
             OR (p_child_id IS NULL AND p_unregistered_athlete_id IS NULL
                   AND p_user_id IS NOT NULL AND (p.user_id = p_user_id OR p.parent_id = p_user_id))
             OR (p_unregistered_athlete_id IS NOT NULL AND p.unregistered_athlete_id = p_unregistered_athlete_id)
          )
          -- El mes pedido + el anterior, para ver si ya venía debiendo al entrar el período.
          AND (p.period_year, p.period_month) IN (
                (p_year, p_month),
                (extract(year from v_desde - interval '1 month')::int, extract(month from v_desde - interval '1 month')::int)
              )
    ),
    sesiones AS (
        SELECT
            'sesion'        AS tipo,
            a.attendance_date AS fecha,
            NULL::text AS status,
            NULL::numeric AS amount,
            NULL::numeric AS amount_paid,
            NULL::int AS period_year,
            NULL::int AS period_month,
            a.status AS attendance_status
        FROM public.attendance_records a
        WHERE a.school_id = p_school_id
          AND (
                (p_child_id IS NOT NULL AND a.child_id = p_child_id)
             OR (p_unregistered_athlete_id IS NOT NULL AND a.unregistered_athlete_id = p_unregistered_athlete_id)
             OR (p_child_id IS NULL AND p_unregistered_athlete_id IS NULL
                   AND p_user_id IS NOT NULL AND a.user_id = p_user_id)
          )
          AND a.attendance_date BETWEEN v_desde AND v_hasta
    ),
    todo AS (
        SELECT * FROM pagos
        UNION ALL
        SELECT * FROM sesiones
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'tipo',               t.tipo,
        'fecha',              t.fecha,
        'status',             t.status,
        'amount',             t.amount,
        'amount_paid',        t.amount_paid,
        'period_year',        t.period_year,
        'period_month',       t.period_month,
        'attendance_status',  t.attendance_status
    ) ORDER BY t.fecha, t.tipo), '[]'::jsonb)
    INTO v_events
    FROM todo t;

    RETURN jsonb_build_object(
        'school_id', p_school_id,
        'year',      p_year,
        'month',     p_month,
        'events',    v_events
    );
END;
$$;

COMMENT ON FUNCTION public.get_athlete_payment_timeline(uuid, int, int, uuid, uuid, uuid) IS
    'F1 Cierre de Mes: drill-down por atleta — pagos + sesiones del mes (y el anterior, para pagos) CRUDOS, ordenados por fecha. v1 NO resuelve si una sesión quedó cubierta por el pago — pospuesto. Ver docs/plan-f1-cierre-de-mes.md §3.4.';

REVOKE ALL ON FUNCTION public.get_athlete_payment_timeline(uuid, int, int, uuid, uuid, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_payment_timeline(uuid, int, int, uuid, uuid, uuid) TO authenticated;

-- ─── 6. get_payment_aging_report — se agregan los ids de identidad ──────────
-- Mismo contrato de 20260824141220 + 3 campos nuevos por item (child_id,
-- adult_id, unregistered_athlete_id) para que el frontend pueda pasarle esa
-- identidad a get_athlete_payment_timeline al hacer clic en una fila. Cambio
-- puramente aditivo — nada que ya lea este jsonb se rompe por 3 campos de más.
CREATE OR REPLACE FUNCTION public.get_payment_aging_report(
    p_school_id uuid,
    p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_caller  uuid := auth.uid();
    v_today   date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_cy      int  := extract(year  from v_today)::int;
    v_cm      int  := extract(month from v_today)::int;
    v_items   jsonb;
    v_sin_atleta int;
    v_en_revision jsonb;
    v_en_disputa  jsonb;
    v_sin_canal   jsonb;
BEGIN
    IF v_caller IS NOT NULL
       AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'No autorizado para ver la cartera de esta escuela.';
    END IF;

    WITH deuda AS (
        SELECT
            p.*,
            CASE
                WHEN p.child_id IS NOT NULL THEN 'child:' || p.child_id::text
                WHEN p.unregistered_athlete_id IS NOT NULL THEN 'unreg:' || p.unregistered_athlete_id::text
                WHEN COALESCE(p.user_id, p.parent_id) IS NOT NULL THEN 'adult:' || COALESCE(p.user_id, p.parent_id)::text
                ELSE NULL
            END AS akey
        FROM public.payments p
        WHERE p.school_id = p_school_id
          AND p.status IN ('pending', 'overdue', 'partial')
          AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id)
          AND NOT (
                p.period_year IS NOT NULL AND p.period_month IS NOT NULL
                AND (p.period_year::int * 12 + p.period_month::int) > (v_cy * 12 + v_cm)
              )
    ),
    por_atleta AS (
        SELECT
            akey,
            max(child_id::text)::uuid                    AS child_id,
            max(unregistered_athlete_id::text)::uuid     AS unregistered_athlete_id,
            max(COALESCE(user_id, parent_id)::text)::uuid AS adult_id,
            max(branch_id::text)::uuid                    AS branch_id,
            count(*)                          AS cuotas_debidas,
            min(make_date(
                COALESCE(period_year::int,  extract(year  from due_date)::int),
                COALESCE(period_month::int, extract(month from due_date)::int),
                1
            ))                                 AS periodo_mas_antiguo,
            jsonb_agg(to_char(make_date(
                COALESCE(period_year::int,  extract(year  from due_date)::int),
                COALESCE(period_month::int, extract(month from due_date)::int),
                1
            ), 'MM/YYYY') ORDER BY make_date(
                COALESCE(period_year::int,  extract(year  from due_date)::int),
                COALESCE(period_month::int, extract(month from due_date)::int),
                1
            ))                                 AS periodos_debidos,
            sum(amount - COALESCE(amount_paid, 0)) AS monto_pendiente,
            min(due_date)                      AS vencimiento_mas_antiguo
        FROM deuda
        WHERE akey IS NOT NULL
        GROUP BY akey
    )
    SELECT
        COALESCE(jsonb_agg(jsonb_build_object(
            'athlete',            COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta'),
            'tipo',                CASE
                                       WHEN pa.child_id IS NOT NULL THEN 'menor'
                                       WHEN pa.unregistered_athlete_id IS NOT NULL THEN 'no_registrado'
                                       ELSE 'adulto'
                                   END,
            -- Ids de identidad — nuevos (para el drill-down, §3.4).
            'child_id',                  pa.child_id,
            'adult_id',                  pa.adult_id,
            'unregistered_athlete_id',   pa.unregistered_athlete_id,
            'branch_id',           pa.branch_id,
            'cuotas_debidas',      pa.cuotas_debidas,
            'periodo_mas_antiguo', to_char(pa.periodo_mas_antiguo, 'MM/YYYY'),
            'periodos_debidos',    pa.periodos_debidos,
            'monto_pendiente',     pa.monto_pendiente,
            'bucket',              CASE
                                       WHEN pa.cuotas_debidas = 1 THEN '1 mes'
                                       WHEN pa.cuotas_debidas = 2 THEN '2 meses'
                                       ELSE '3+ meses'
                                   END,
            'canal_automatico',    CASE
                                       WHEN pa.child_id IS NOT NULL THEN c.parent_id IS NOT NULL
                                       WHEN pa.unregistered_athlete_id IS NOT NULL THEN false
                                       ELSE true
                                   END,
            'contacto_manual',     CASE
                                       WHEN pa.child_id IS NOT NULL AND c.parent_id IS NULL THEN
                                           jsonb_build_object(
                                               'nombre',   c.parent_name_temp,
                                               'telefono', c.parent_phone_temp,
                                               'email',    c.parent_email_temp
                                           )
                                       WHEN pa.unregistered_athlete_id IS NOT NULL THEN
                                           jsonb_build_object('nombre', NULL, 'telefono', ua.phone, 'email', ua.email)
                                       ELSE NULL
                                   END,
            'clases_desde_vencimiento', (
                SELECT count(*)
                FROM public.attendance_records ar
                WHERE ar.school_id = p_school_id
                  AND ar.status IN ('present', 'late')
                  AND ar.attendance_date > pa.vencimiento_mas_antiguo
                  AND (
                        (pa.child_id IS NOT NULL AND ar.child_id = pa.child_id)
                     OR (pa.unregistered_athlete_id IS NOT NULL AND ar.unregistered_athlete_id = pa.unregistered_athlete_id)
                     OR (pa.child_id IS NULL AND pa.unregistered_athlete_id IS NULL AND ar.user_id = pa.adult_id)
                  )
            )
        ) ORDER BY pa.cuotas_debidas DESC, pa.monto_pendiente DESC), '[]'::jsonb)
    INTO v_items
    FROM por_atleta pa
    LEFT JOIN public.children              c  ON c.id  = pa.child_id
    LEFT JOIN public.profiles              pr ON pr.id = pa.adult_id
    LEFT JOIN public.unregistered_athletes ua ON ua.id = pa.unregistered_athlete_id;

    SELECT count(*) INTO v_sin_atleta
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND p.status IN ('pending', 'overdue', 'partial')
      AND p.child_id IS NULL AND p.user_id IS NULL
      AND p.parent_id IS NULL AND p.unregistered_athlete_id IS NULL;

    SELECT jsonb_build_object('count', count(*), 'monto', COALESCE(sum(p.amount - COALESCE(p.amount_paid, 0)), 0))
      INTO v_en_revision
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND p.status = 'awaiting_approval'
      AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id);

    SELECT jsonb_build_object('count', count(*), 'monto', COALESCE(sum(p.amount - COALESCE(p.amount_paid, 0)), 0))
      INTO v_en_disputa
    FROM public.payments p
    WHERE p.school_id = p_school_id
      AND p.status = 'glosado'
      AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id);

    SELECT jsonb_build_object(
               'atletas', count(*) FILTER (WHERE NOT (i->>'canal_automatico')::boolean),
               'monto',   COALESCE(sum((i->>'monto_pendiente')::numeric)
                                    FILTER (WHERE NOT (i->>'canal_automatico')::boolean), 0)
           )
      INTO v_sin_canal
    FROM jsonb_array_elements(v_items) i;

    RETURN jsonb_build_object(
        'school_id',           p_school_id,
        'branch_id',           p_branch_id,
        'generated_at',        v_today,
        'count',               jsonb_array_length(v_items),
        'items',               v_items,
        'sin_atleta_identificable', v_sin_atleta,
        'en_revision',         v_en_revision,
        'en_disputa',          v_en_disputa,
        'sin_canal_automatico', v_sin_canal
    );
END;
$$;

COMMENT ON FUNCTION public.get_payment_aging_report(uuid, uuid) IS
    'Cartera vencida/pendiente agrupada por atleta con bucket de antigüedad (1 mes / 2 meses / 3+ meses). Desde 20260827221826: cada item incluye child_id/adult_id/unregistered_athlete_id para alimentar el drill-down de get_athlete_payment_timeline (F1 Cierre de Mes). Deuda = pending/overdue/partial únicamente; awaiting_approval y glosado se reportan aparte. Excluye período futuro.';

REVOKE ALL ON FUNCTION public.get_payment_aging_report(uuid, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_payment_aging_report(uuid, uuid) TO authenticated;

COMMIT;
