-- =============================================================================
-- 20261011101750_dreamers_primer_cobro_sin_recargo.sql
-- Objetivo: en Dreamers, el cobro del MES DE ALTA no genera recargo y vence en el
-- corte del mes siguiente. El recargo (5 %) arranca con la mensualidad siguiente,
-- que se genera el 1 y vence el 5.
--
-- Problema: el alta con fecha después del corte emite el cobro con vencimiento = día
-- del alta (dueInEntryMonth, "un cobro no nace vencido"). Con 0 días de gracia, el cron
-- apply_late_fees del día siguiente (02:00 COT) lo pasa a «overdue» y le suma 5 %.
-- Pasó el 2026-10-11 con Zoe Barrera ($11.638) y Avril Salomé Aguilar ($12.250), ambas
-- inscritas el 10. Además «overdue» alimenta el bloqueo automático del torniquete.
--
-- Solución (solo escuelas con school_settings.late_fee_skip_signup_month = true):
--   1. fn_is_first_monthly_charge: ¿es la primera mensualidad del atleta en la
--      escuela (sin mensualidad vigente de un período anterior)?
--   2. Trigger BEFORE INSERT en payments: el primer cobro mensual cuyo vencimiento
--      cae dentro de su propio período pasa a vencer el día de corte del mes siguiente
--      (y el texto «vence día N» del concepto se actualiza). Un solo punto para todos los
--      caminos de alta (alta de estudiante, POST /enrollments, cambio de equipo/plan).
--   3. apply_late_fees: ese primer cobro nunca recibe recargo (sí pasa a «overdue» al
--      llegar su vencimiento). CREATE OR REPLACE desde el cuerpo VIVO (2026-10-11),
--      sin otro cambio. Se conserva el ACL.
--
-- Radio: solo Dreamers (único colegio con el flag en true). Las demás escuelas no
-- cambian: el flag nace en false y ambas rutas lo consultan antes de actuar.
-- No hay columna nueva en payments (evita ampliar la guardia fn_guard_payments_client).
-- =============================================================================

BEGIN;

-- ── 1. Flag por escuela ──────────────────────────────────────────────────────
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS late_fee_skip_signup_month boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.late_fee_skip_signup_month IS
    'true = la primera mensualidad del atleta (mes de alta) vence en el corte del mes '
    'siguiente y nunca recibe recargo por mora. El recargo aplica desde la mensualidad '
    'siguiente. Dreamers (2026-10-11).';

UPDATE public.school_settings ss
   SET late_fee_skip_signup_month = true
  FROM public.schools s
 WHERE s.id = ss.school_id
   AND s.name ILIKE 'Dreamers%';

-- ── 2. ¿Es la primera mensualidad del atleta? ────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_is_first_monthly_charge(
    p_school_id  uuid,
    p_child_id   uuid,
    p_user_id    uuid,
    p_unreg_id   uuid,
    p_year       integer,
    p_month      integer,
    p_exclude_id uuid DEFAULT NULL
) RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT p_year IS NOT NULL
       AND p_month IS NOT NULL
       AND COALESCE(p_child_id, p_user_id, p_unreg_id) IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
              FROM public.payments q
             WHERE q.school_id = p_school_id
               AND q.id IS DISTINCT FROM p_exclude_id
               AND COALESCE(q.payment_category, 'mensualidad') = 'mensualidad'
               AND q.status <> 'cancelled'
               AND q.period_year  IS NOT NULL
               AND q.period_month IS NOT NULL
               AND make_date(q.period_year::int, q.period_month::int, 1)
                   < make_date(p_year, p_month, 1)
               AND (
                    (p_child_id IS NOT NULL AND q.child_id = p_child_id)
                    OR (p_unreg_id IS NOT NULL AND q.unregistered_athlete_id = p_unreg_id)
                    OR (p_child_id IS NULL AND p_user_id IS NOT NULL
                        AND q.child_id IS NULL AND q.user_id = p_user_id)
               )
       );
$$;

-- Solo la usan funciones SECURITY DEFINER (cron y trigger): nadie la llama desde el
-- navegador. REVOKE explícito de authenticated/anon (default privileges de funciones).
REVOKE ALL ON FUNCTION public.fn_is_first_monthly_charge(uuid, uuid, uuid, uuid, integer, integer, uuid)
    FROM PUBLIC, anon, authenticated;

-- ── 3. Trigger: el primer cobro vence en el corte del mes siguiente ──────────
CREATE OR REPLACE FUNCTION public.fn_payments_primer_cobro_vence_prox_corte()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_flag        boolean;
    v_cutoff      integer;
    v_next_start  date;
    v_next_days   integer;
    v_due         date;
BEGIN
    -- Sin período explícito no se toca: trg_payments_fill_period lo derivaría del
    -- due_date y movería el cobro al mes equivocado.
    IF NEW.period_year IS NULL OR NEW.period_month IS NULL
       OR NEW.due_date IS NULL
       OR NEW.status IS DISTINCT FROM 'pending'
       OR COALESCE(NEW.payment_category, 'mensualidad') <> 'mensualidad'
       OR NEW.school_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT ss.late_fee_skip_signup_month, ss.payment_cutoff_day
      INTO v_flag, v_cutoff
      FROM public.school_settings ss
     WHERE ss.school_id = NEW.school_id;

    IF NOT COALESCE(v_flag, false) THEN
        RETURN NEW;
    END IF;

    v_next_start := (make_date(NEW.period_year::int, NEW.period_month::int, 1) + interval '1 month')::date;

    -- Solo el cobro que vence DENTRO de su propio período (el del mes de alta).
    IF NEW.due_date >= v_next_start THEN
        RETURN NEW;
    END IF;

    IF NOT public.fn_is_first_monthly_charge(
            NEW.school_id, NEW.child_id, NEW.user_id, NEW.unregistered_athlete_id,
            NEW.period_year::int, NEW.period_month::int, NEW.id) THEN
        RETURN NEW;
    END IF;

    v_next_days := EXTRACT(day FROM (v_next_start + interval '1 month - 1 day'))::int;
    v_due := v_next_start + (GREATEST(1, LEAST(COALESCE(v_cutoff, 5), v_next_days)) - 1);

    NEW.due_date := v_due;
    IF NEW.concept IS NOT NULL THEN
        NEW.concept := regexp_replace(NEW.concept, 'vence día [0-9]+',
                                      'vence el ' || to_char(v_due, 'DD/MM'));
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_payments_primer_cobro_vence_prox_corte() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_payments_primer_cobro_prox_corte ON public.payments;
CREATE TRIGGER trg_payments_primer_cobro_prox_corte
    BEFORE INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_payments_primer_cobro_vence_prox_corte();

-- ── 4. apply_late_fees: el primer cobro nunca recibe recargo ─────────────────
-- Cuerpo VIVO (2026-10-11). Cambios marcados «(primer cobro)».
CREATE OR REPLACE FUNCTION public.apply_late_fees()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_today        date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_overdue      integer := 0;
    v_fees_applied integer := 0;
    v_total_fees   numeric := 0;
    v_reopened     integer := 0;
    v_reopen_skip  integer := 0;
    r              record;
BEGIN
    FOR r IN
        SELECT
            p.id,
            CASE
                WHEN ss.late_fee_enabled IS TRUE
                     AND p.late_fee_applied_at IS NULL
                     AND NOT x.exempt   -- (primer cobro)
                THEN round(
                        COALESCE(ss.late_fee_percentage, 0)::numeric / 100
                        * GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0)
                     )
                ELSE 0
            END AS fee
        FROM public.payments p
        JOIN public.school_settings ss ON ss.school_id = p.school_id
        CROSS JOIN LATERAL (   -- (primer cobro)
            SELECT (ss.late_fee_skip_signup_month IS TRUE
                    AND public.fn_is_first_monthly_charge(
                            p.school_id, p.child_id, p.user_id, p.unregistered_athlete_id,
                            p.period_year::int, p.period_month::int, p.id)) AS exempt
        ) x
        WHERE p.status = 'rejected'
          AND ss.pending_proof_counts_as_paid IS TRUE
          AND NOT (ss.overdue_hold_until IS NOT NULL AND v_today <= ss.overdue_hold_until)
          AND COALESCE(p.child_id, p.unregistered_athlete_id, p.user_id) IS NOT NULL
          -- (20261010143132) solo la mensualidad entra en mora; todo cobro único queda fuera.
          AND COALESCE(p.payment_category, 'mensualidad') = 'mensualidad'
          AND (p.due_date + COALESCE(ss.payment_grace_days, 0)) < v_today
          AND (p.period_year IS NULL
               OR p.period_month IS NULL
               OR make_date(p.period_year::int, p.period_month::int, 1)
                  <= date_trunc('month', v_today)::date)
          AND ((COALESCE(p.created_at, now()) AT TIME ZONE 'America/Bogota')::date
               + COALESCE(ss.payment_grace_days, 0)) < v_today
          AND NOT EXISTS (
                SELECT 1 FROM public.payments q
                WHERE q.id <> p.id
                  AND q.school_id = p.school_id
                  AND q.status IN ('pending', 'awaiting_approval', 'paid', 'partial', 'overdue', 'glosado')
                  AND q.period_year  IS NOT DISTINCT FROM p.period_year
                  AND q.period_month IS NOT DISTINCT FROM p.period_month
                  AND (p.period_year IS NOT NULL
                       OR q.offering_plan_id IS NOT DISTINCT FROM p.offering_plan_id)
                  AND (
                        (p.child_id IS NOT NULL AND q.child_id = p.child_id)
                        OR (p.unregistered_athlete_id IS NOT NULL
                            AND q.unregistered_athlete_id = p.unregistered_athlete_id)
                        OR (p.child_id IS NULL AND p.user_id IS NOT NULL
                            AND q.child_id IS NULL AND q.user_id = p.user_id)
                      )
              )
        ORDER BY p.created_at DESC
    LOOP
        BEGIN
            UPDATE public.payments p
            SET late_fee_amount     = p.late_fee_amount + r.fee,
                amount              = p.amount + r.fee,
                late_fee_applied_at = CASE WHEN r.fee > 0 THEN now()
                                           ELSE p.late_fee_applied_at END,
                status              = 'overdue',
                updated_at          = now()
            WHERE p.id = r.id
              AND p.status = 'rejected';
            IF FOUND THEN
                v_reopened := v_reopened + 1;
                IF r.fee > 0 THEN
                    v_fees_applied := v_fees_applied + 1;
                    v_total_fees   := v_total_fees + r.fee;
                END IF;
            END IF;
        EXCEPTION WHEN unique_violation THEN
            v_reopen_skip := v_reopen_skip + 1;
        END;
    END LOOP;

    WITH candidates AS (
        SELECT
            p.id,
            p.status,
            p.amount,
            p.late_fee_applied_at,
            CASE
                WHEN ss.late_fee_enabled IS TRUE
                     AND p.late_fee_applied_at IS NULL
                     AND NOT x.exempt   -- (primer cobro)
                THEN round(
                        COALESCE(ss.late_fee_percentage, 0)::numeric / 100
                        * GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0)
                     )
                ELSE 0
            END AS fee
        FROM public.payments p
        JOIN public.school_settings ss ON ss.school_id = p.school_id
        CROSS JOIN LATERAL (   -- (primer cobro)
            SELECT (ss.late_fee_skip_signup_month IS TRUE
                    AND public.fn_is_first_monthly_charge(
                            p.school_id, p.child_id, p.user_id, p.unregistered_athlete_id,
                            p.period_year::int, p.period_month::int, p.id)) AS exempt
        ) x
        WHERE p.status IN ('pending', 'partial')
          AND NOT (ss.overdue_hold_until IS NOT NULL AND v_today <= ss.overdue_hold_until)
          -- (20261010143132) solo la mensualidad entra en mora; todo cobro único queda fuera.
          AND COALESCE(p.payment_category, 'mensualidad') = 'mensualidad'
          AND (p.due_date + COALESCE(ss.payment_grace_days, 0)) < v_today
          AND (p.period_year IS NULL
               OR p.period_month IS NULL
               OR make_date(p.period_year::int, p.period_month::int, 1)
                  <= date_trunc('month', v_today)::date)
          AND ((COALESCE(p.created_at, now()) AT TIME ZONE 'America/Bogota')::date
               + COALESCE(ss.payment_grace_days, 0)) < v_today
          AND (
                p.status = 'pending'
                OR (ss.late_fee_enabled IS TRUE AND p.late_fee_applied_at IS NULL
                    AND NOT x.exempt)   -- (primer cobro) sin esto un parcial exento se reescribiría cada noche
              )
    ), updated AS (
        UPDATE public.payments p
        SET
            late_fee_amount     = p.late_fee_amount + c.fee,
            amount              = p.amount + c.fee,
            late_fee_applied_at = CASE WHEN c.fee > 0 THEN now()
                                       ELSE p.late_fee_applied_at END,
            status              = CASE WHEN p.status = 'pending' THEN 'overdue'
                                       ELSE p.status END,
            updated_at          = now()
        FROM candidates c
        WHERE p.id = c.id
        RETURNING (c.status = 'pending') AS became_overdue, c.fee
    )
    SELECT
        COUNT(*) FILTER (WHERE became_overdue),
        v_fees_applied + COUNT(*) FILTER (WHERE fee > 0),
        v_total_fees + COALESCE(SUM(fee), 0)
    INTO v_overdue, v_fees_applied, v_total_fees
    FROM updated;

    RETURN jsonb_build_object(
        'run_date',                v_today,
        'overdue_marked',          v_overdue,
        'fees_applied',            v_fees_applied,
        'total_fees',              v_total_fees,
        'rejected_reopened',       v_reopened,
        'rejected_reopen_skipped', v_reopen_skip
    );
END;
$function$;

COMMIT;
