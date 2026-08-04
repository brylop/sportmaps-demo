-- ============================================================
-- SPORTMAPS — Sincronización de repo con función REAL en Supabase
-- ------------------------------------------------------------
-- CONTEXTO (detectado en auditoría 2026-07-17):
--   El archivo del repo `20260713000003_auto_generate_monthly_charges.sql`
--   NO coincide con la función que realmente está desplegada en Supabase
--   (proyecto luebjarufsiadojhvxgi). La versión viva soporta
--   school_settings.billing_cycle_type = 'rolling_30' (ciclos de 30 días
--   desde el último pago, con salto de ciclos atrasados) además del
--   modo de corte por día calendario. El archivo del repo solo tiene el
--   modo de corte calendario.
--
--   Esto confirma drift esperado: hay un segundo agente (Gemini/
--   Antigravity) aplicando migraciones directo a Supabase sin siempre
--   dejar el .sql correspondiente en este repo. Ver notas de
--   coordinación del proyecto.
--
--   Este archivo NO cambia nada en la base de datos (CREATE OR REPLACE
--   es idempotente y ya está aplicado) — es documentación para que el
--   repo quede alineado con la realidad. Aplícalo igual para que quede
--   en el historial de migraciones y `supabase db diff` deje de marcar
--   drift en esta función.
--
-- Fecha de detección: 2026-07-17
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_monthly_charges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
    v_today    date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_month    date := date_trunc('month', v_today)::date;
    v_created  integer := 0;
BEGIN
    WITH candidates AS (
        SELECT
            e.id AS enrollment_id,
            e.school_id,
            COALESCE(c.branch_id, t.branch_id) AS branch_id,
            COALESCE(c.parent_id, e.user_id)   AS payer_id,
            e.child_id,
            e.team_id,
            e.offering_plan_id,
            e.start_date,
            'Mensualidad ' || to_char(v_today, 'MM/YYYY') || ' - '
                || COALESCE(c.full_name, pr.full_name, 'Atleta') AS concept,
            fee.amount,
            ss.billing_cycle_type,
            ss.payment_cutoff_day,
            (
                SELECT max(p2.due_date)
                FROM public.payments p2
                WHERE p2.school_id = e.school_id
                  AND p2.child_id  IS NOT DISTINCT FROM e.child_id
                  AND (e.child_id IS NOT NULL OR p2.parent_id IS NOT DISTINCT FROM e.user_id)
                  AND p2.team_id  IS NOT DISTINCT FROM e.team_id
                  AND p2.offering_plan_id IS NOT DISTINCT FROM e.offering_plan_id
            ) AS last_due_date
        FROM public.enrollments e
        JOIN public.school_settings ss
            ON ss.school_id = e.school_id
           AND ss.auto_generate_payments IS TRUE
        LEFT JOIN public.children c  ON c.id  = e.child_id
        LEFT JOIN public.profiles pr ON pr.id = e.user_id
        LEFT JOIN public.teams    t  ON t.id  = e.team_id
        CROSS JOIN LATERAL (
            SELECT COALESCE(
                NULLIF(e.monthly_fee, 0),
                NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
                NULLIF(t.price_monthly, 0),
                NULLIF(c.monthly_fee, 0),
                0
            ) AS amount
        ) fee
        WHERE e.status = 'active'
          AND e.unregistered_athlete_id IS NULL
          AND COALESCE(c.parent_id, e.user_id) IS NOT NULL
          AND fee.amount > 0
    ),
    to_charge AS (
        SELECT
            candidates.*,
            CASE
                WHEN billing_cycle_type = 'rolling_30' AND last_due_date IS NOT NULL THEN
                    -- saltar tantos ciclos de 30 dias como haga falta para
                    -- caer en la primera fecha >= hoy (no factura el atraso)
                    last_due_date + (30 * GREATEST(1, CEIL((v_today - last_due_date)::numeric / 30)))::int
                WHEN billing_cycle_type = 'rolling_30' THEN
                    COALESCE(start_date, v_today) + 30
                ELSE
                    make_date(
                        extract(year  from v_today)::int,
                        extract(month from v_today)::int,
                        LEAST(
                            COALESCE(payment_cutoff_day, 5),
                            extract(day from (v_month + interval '1 month - 1 day'))::int
                        )
                    )
            END AS computed_due_date
        FROM candidates
    ),
    inserted AS (
        INSERT INTO public.payments (
            school_id, branch_id, parent_id, child_id, team_id,
            offering_plan_id, concept, amount, due_date, status, payment_type
        )
        SELECT
            school_id, branch_id, payer_id, child_id, team_id,
            offering_plan_id, concept, amount, computed_due_date,
            'pending'::public.pay_status, 'one_time'::public.pay_type
        FROM to_charge
        WHERE
            CASE
                WHEN billing_cycle_type = 'rolling_30' THEN
                    last_due_date IS NULL OR computed_due_date > last_due_date
                ELSE
                    NOT EXISTS (
                        SELECT 1 FROM public.payments p4
                        WHERE p4.school_id = to_charge.school_id
                          AND p4.due_date >= v_month AND p4.due_date < (v_month + interval '1 month')
                          AND (
                               (to_charge.child_id IS NOT NULL AND p4.child_id = to_charge.child_id)
                            OR (to_charge.child_id IS NULL AND p4.child_id IS NULL AND p4.parent_id = to_charge.payer_id)
                          )
                    )
            END
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_created FROM inserted;

    RAISE NOTICE '[generate_monthly_charges] fecha=% cobros_creados=%', v_today, v_created;
    RETURN jsonb_build_object('run_date', v_today, 'charges_created', v_created);
END;
$$;
