-- =============================================================================
-- 20261010130733_cobros_unicos_sin_mora_ni_bloqueo.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010130450
-- Objetivo: la inscripción y el seguro (cobros únicos del alta, categorías
-- 'inscripcion' y 'seguro') NO pasan a 'overdue' ni reciben recargo por mora.
--
-- Por qué: decisión del usuario 2026-10-10 (P17/P18 de
-- docs/specs/pagos-unicos-por-plan.md): mora y bloqueo solo por la mensualidad.
-- Hoy apply_late_fees (pg_cron 07:00 UTC), fn_expire_overdue_payments y
-- _mark_overdue_payments_impl toman CUALQUIER cobro vencido. Dreamers tiene
-- recargo 5 % y gracia 0, y sus inscripciones/seguros del alta vencen el mismo
-- día: al día siguiente quedaban 'overdue' + 5 %, y 'overdue' es lo que leen el
-- trigger del torniquete (fn_sync_access_group_on_payment), el bloqueo
-- automático (access-auto-block.job.ts), el control de acceso
-- (access-adms.ts) y el correo de pago vencido.
--
-- Cómo: un filtro más en los tres barridos. El cobro único sigue 'pending'
-- (deuda normal, se puede pagar, aparece en cartera); solo deja de vencerse.
-- Los cuerpos son copia exacta de lo vivo al 2026-10-10 (pg_get_functiondef)
-- más la condición nueva, marcada con «(20261010130733)».
--
-- Radio: hoy 6 cobros pendientes en esas categorías, todos de Dreamers
-- (creados 2026-10-10). Ningún cobro de esas categorías está hoy 'overdue'.
-- Las demás categorías y escuelas: sin cambio.
-- CREATE OR REPLACE conserva los privilegios (postgres + service_role).
-- =============================================================================

BEGIN;

-- ── 1. apply_late_fees ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_late_fees()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
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
                THEN round(
                        COALESCE(ss.late_fee_percentage, 0)::numeric / 100
                        * GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0)
                     )
                ELSE 0
            END AS fee
        FROM public.payments p
        JOIN public.school_settings ss ON ss.school_id = p.school_id
        WHERE p.status = 'rejected'
          AND ss.pending_proof_counts_as_paid IS TRUE
          AND NOT (ss.overdue_hold_until IS NOT NULL AND v_today <= ss.overdue_hold_until)
          AND COALESCE(p.child_id, p.unregistered_athlete_id, p.user_id) IS NOT NULL
          -- (20261010130733) inscripción y seguro no entran en mora.
          AND COALESCE(p.payment_category, '') NOT IN ('inscripcion', 'seguro')
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
                THEN round(
                        COALESCE(ss.late_fee_percentage, 0)::numeric / 100
                        * GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0)
                     )
                ELSE 0
            END AS fee
        FROM public.payments p
        JOIN public.school_settings ss ON ss.school_id = p.school_id
        WHERE p.status IN ('pending', 'partial')
          AND NOT (ss.overdue_hold_until IS NOT NULL AND v_today <= ss.overdue_hold_until)
          -- (20261010130733) inscripción y seguro no entran en mora.
          AND COALESCE(p.payment_category, '') NOT IN ('inscripcion', 'seguro')
          AND (p.due_date + COALESCE(ss.payment_grace_days, 0)) < v_today
          AND (p.period_year IS NULL
               OR p.period_month IS NULL
               OR make_date(p.period_year::int, p.period_month::int, 1)
                  <= date_trunc('month', v_today)::date)
          AND ((COALESCE(p.created_at, now()) AT TIME ZONE 'America/Bogota')::date
               + COALESCE(ss.payment_grace_days, 0)) < v_today
          AND (
                p.status = 'pending'
                OR (ss.late_fee_enabled IS TRUE AND p.late_fee_applied_at IS NULL)
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

-- ── 2. fn_expire_overdue_payments ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_expire_overdue_payments()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
    UPDATE public.payments p
       SET status     = 'overdue',
           updated_at = now()
     WHERE p.status = 'pending'
       AND p.due_date IS NOT NULL
       -- (20261010130733) inscripción y seguro no se vencen.
       AND COALESCE(p.payment_category, '') NOT IN ('inscripcion', 'seguro')
       -- Días de gracia de la escuela. Subconsulta y no JOIN: una escuela sin
       -- fila en school_settings no debe quedar fuera del barrido.
       AND (p.due_date + COALESCE(
               (SELECT ss.payment_grace_days
                  FROM public.school_settings ss
                 WHERE ss.school_id = p.school_id),
               0)) < v_today
       -- Un cobro cuyo período todavía no empieza no está vencido, aunque su
       -- due_date sea viejo.
       AND (p.period_year IS NULL
            OR p.period_month IS NULL
            OR make_date(p.period_year::int, p.period_month::int, 1)
               <= date_trunc('month', v_today)::date);
END;
$function$;

-- ── 3. _mark_overdue_payments_impl ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._mark_overdue_payments_impl(p_school_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_today     date;
  v_grace_days integer;
  v_threshold  date;
  v_count      integer;
BEGIN
  v_today := (NOW() AT TIME ZONE 'America/Bogota')::date;

  SELECT COALESCE(payment_grace_days, 0)
  INTO v_grace_days
  FROM school_settings
  WHERE school_id = p_school_id;

  v_grace_days := COALESCE(v_grace_days, 0);
  v_threshold := v_today - v_grace_days;

  UPDATE payments
  SET status = 'overdue'
  WHERE school_id = p_school_id
    AND status   = 'pending'
    -- (20261010130733) inscripción y seguro no se vencen.
    AND COALESCE(payment_category, '') NOT IN ('inscripcion', 'seguro')
    AND due_date < v_threshold;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

COMMIT;
