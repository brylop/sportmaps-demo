-- ============================================================
-- SPORTMAPS — Generación automática de cobros mensuales (cron)
-- ------------------------------------------------------------
-- PROBLEMA:
--   school_settings.auto_generate_payments ("Generar cobros automáticos") se
--   configuraba en el panel pero NADIE lo leía: no había job que creara los
--   cobros del mes. La escuela dependía del botón manual "Verificar atletas
--   sin cobro" (backfill client-side).
--
-- QUÉ HACE:
--   generate_monthly_charges(): para cada escuela con auto_generate_payments,
--   crea el cobro 'pending' del mes en curso para cada enrollment ACTIVO que
--   aún no tenga un pago en este mes calendario.
--
-- SEGURIDAD ANTI-DUPLICADO (crítico — ver auditoría de duplicación de pagos):
--   Sólo inserta si NO existe ningún payment del atleta en el mes en curso
--   (cualquier status). La sub-generación es segura (el backfill manual la
--   cubre); la sobre-generación NO puede ocurrir por este dedup.
--
-- ALCANCE v1:
--   - Atletas: hijos (child_id) y adultos (user_id). Se OMITEN los
--     unregistered_athlete_id (no tienen auth.user → payments.parent_id es
--     NOT NULL); esos los sigue generando el backfill manual.
--   - Monto: cuota individual del enrollment (enrollments.monthly_fee) manda,
--     luego plan, equipo y por último la denormalizada del hijo. Ver
--     [[project_athlete_fee_source]]. Si el monto resuelto es <= 0, se salta.
--   - due_date: día de corte de la escuela (payment_cutoff_day) del mes actual.
--
--   Programado a diario 06:30 UTC (tras cobros recurrentes 06:00, antes de la
--   mora 07:00). Correr a diario es idempotente por el dedup mensual.
-- Fecha: 2026-07-13
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_monthly_charges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_today    date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_month    date := date_trunc('month', v_today)::date;
    v_created  integer := 0;
BEGIN
    WITH inserted AS (
        INSERT INTO public.payments (
            school_id, branch_id, parent_id, child_id, team_id,
            offering_plan_id, concept, amount, due_date, status, payment_type
        )
        SELECT
            e.school_id,
            COALESCE(c.branch_id, t.branch_id),
            COALESCE(c.parent_id, e.user_id),                 -- parent (hijo) o self (adulto)
            e.child_id,
            e.team_id,
            e.offering_plan_id,
            'Mensualidad ' || to_char(v_today, 'MM/YYYY') || ' - '
                || COALESCE(c.full_name, pr.full_name, 'Atleta'),
            fee.amount,
            -- due_date = día de corte del mes en curso (sin pasarse de fin de mes)
            make_date(
                extract(year  from v_today)::int,
                extract(month from v_today)::int,
                LEAST(
                    COALESCE(ss.payment_cutoff_day, 5),
                    extract(day from (v_month + interval '1 month - 1 day'))::int
                )
            ),
            'pending'::public.pay_status,
            'one_time'::public.pay_type
        FROM public.enrollments e
        JOIN public.school_settings ss
            ON ss.school_id = e.school_id
           AND ss.auto_generate_payments IS TRUE
        LEFT JOIN public.children  c  ON c.id  = e.child_id
        LEFT JOIN public.profiles  pr ON pr.id = e.user_id
        LEFT JOIN public.teams     t  ON t.id  = e.team_id
        -- Monto canónico: enrollment.monthly_fee > plan > equipo > hijo
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
          AND e.unregistered_athlete_id IS NULL     -- se omiten no registrados
          AND COALESCE(c.parent_id, e.user_id) IS NOT NULL   -- payments.parent_id NOT NULL
          AND fee.amount > 0
          AND NOT EXISTS (                          -- dedup: ya hay cobro del mes
              SELECT 1 FROM public.payments p2
              WHERE p2.school_id = e.school_id
                AND p2.due_date >= v_month
                AND p2.due_date <  (v_month + interval '1 month')
                AND (
                     (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
                  OR (e.child_id IS NULL AND p2.child_id IS NULL
                        AND p2.parent_id = e.user_id)
                )
          )
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_created FROM inserted;

    RAISE NOTICE '[generate_monthly_charges] fecha=% cobros_creados=%', v_today, v_created;
    RETURN jsonb_build_object('run_date', v_today, 'charges_created', v_created);
END;
$$;

COMMENT ON FUNCTION public.generate_monthly_charges() IS
    'Crea los cobros pending del mes para escuelas con auto_generate_payments. Dedup mensual anti-duplicado. Ejecutado a diario por pg_cron.';

-- Recorre TODAS las escuelas y crea pagos: sólo el cron (postgres) / service_role.
REVOKE ALL ON FUNCTION public.generate_monthly_charges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_monthly_charges() TO service_role;

-- Programación diaria vía pg_cron -------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    PERFORM cron.unschedule('generate-monthly-charges-daily');
EXCEPTION WHEN OTHERS THEN
    NULL; -- el job no existía
END $$;

-- 06:30 UTC = 01:30 COT, entre cobros recurrentes (06:00) y mora (07:00).
SELECT cron.schedule(
    'generate-monthly-charges-daily',
    '30 6 * * *',
    $cron$ SELECT public.generate_monthly_charges(); $cron$
);

NOTIFY pgrst, 'reload schema';
