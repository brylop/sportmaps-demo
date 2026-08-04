-- ============================================================
-- SPORTMAPS — Incluir atletas no registrados en cobros automáticos
-- ------------------------------------------------------------
-- CONTEXTO (detectado en auditoría 2026-07-17, continuación del fix de
-- expires_at en 20260717171018):
--   generate_monthly_charges() excluía explícitamente a los atletas con
--   unregistered_athlete_id (comentario original: "se OMITEN... esos
--   los sigue generando el backfill manual"). En la práctica esto
--   significaba que un atleta no registrado solo recibía UN cobro (el
--   inicial, creado a mano) y nunca más — nadie volvía a facturarlo. De
--   los 31 enrollments no registrados vencidos encontrados en la
--   auditoría, todos dependían 100% de que un humano recordara cobrarles
--   cada mes manualmente.
--
--   Decisión (con Julian, 2026-07-17): incluirlos en la generación
--   automática. generate_monthly_charges() solo crea filas 'pending' en
--   payments — no cobra ni mueve dinero — así que el riesgo es el mismo
--   que ya se asume hoy para menores y adultos registrados.
--
-- QUÉ CAMBIA respecto a la versión anterior (20260717171019):
--   1. Se quita la exclusión de unregistered_athlete_id del WHERE.
--   2. payer_id (payments.parent_id) queda NULL para estos casos —
--      payments.unregistered_athlete_id es el identificador del deudor,
--      no un auth.user.
--   3. El concept ahora también resuelve el nombre desde
--      unregistered_athletes.full_name.
--   4. last_due_date y el dedup mensual (NOT EXISTS) ahora distinguen
--      por unregistered_athlete_id cuando aplica, en vez de asumir
--      siempre child_id/parent_id.
--   5. Anti-duplicado: si un atleta no registrado se migra a perfil
--      completo (fn migrate_unregistered_athlete_to_profile) a mitad de
--      mes, su enrollment pasa a tener child_id/user_id y deja de
--      matchear por unregistered_athlete_id — no hay doble cobro porque
--      cada rama del WHERE/dedup es mutuamente excluyente por el estado
--      *actual* de la fila de enrollments en el momento en que corre el
--      cron.
--
-- Fecha: 2026-07-17
-- Conector: aplicado en base y listo para subirse
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
            -- payer_id: hijo -> parent_id del padre; adulto self-pay -> el mismo user_id;
            -- no registrado -> NULL (se identifica por unregistered_athlete_id, no por auth.user)
            CASE
                WHEN e.unregistered_athlete_id IS NOT NULL THEN NULL
                ELSE COALESCE(c.parent_id, e.user_id)
            END AS payer_id,
            e.child_id,
            e.team_id,
            e.offering_plan_id,
            e.unregistered_athlete_id,
            e.start_date,
            'Mensualidad ' || to_char(v_today, 'MM/YYYY') || ' - '
                || COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta') AS concept,
            fee.amount,
            ss.billing_cycle_type,
            ss.payment_cutoff_day,
            (
                SELECT max(p2.due_date)
                FROM public.payments p2
                WHERE p2.school_id = e.school_id
                  AND (
                        (e.unregistered_athlete_id IS NOT NULL AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
                        OR
                        (e.unregistered_athlete_id IS NULL
                         AND p2.child_id IS NOT DISTINCT FROM e.child_id
                         AND (e.child_id IS NOT NULL OR p2.parent_id IS NOT DISTINCT FROM e.user_id))
                      )
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
        LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
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
          -- antes se excluían por completo los no registrados; ahora se incluyen
          AND (
                e.unregistered_athlete_id IS NOT NULL
                OR COALESCE(c.parent_id, e.user_id) IS NOT NULL
              )
          AND fee.amount > 0
    ),
    to_charge AS (
        SELECT
            candidates.*,
            CASE
                WHEN billing_cycle_type = 'rolling_30' AND last_due_date IS NOT NULL THEN
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
            offering_plan_id, unregistered_athlete_id, concept, amount, due_date, status, payment_type
        )
        SELECT
            school_id, branch_id, payer_id, child_id, team_id,
            offering_plan_id, unregistered_athlete_id, concept, amount, computed_due_date,
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
                               (to_charge.unregistered_athlete_id IS NOT NULL AND p4.unregistered_athlete_id = to_charge.unregistered_athlete_id)
                            OR (to_charge.unregistered_athlete_id IS NULL AND to_charge.child_id IS NOT NULL AND p4.child_id = to_charge.child_id)
                            OR (to_charge.unregistered_athlete_id IS NULL AND to_charge.child_id IS NULL AND p4.child_id IS NULL AND p4.unregistered_athlete_id IS NULL AND p4.parent_id = to_charge.payer_id)
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
