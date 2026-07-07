-- ============================================================
-- SPORTMAPS — Fix motor de mora: payments.status es TEXT, no enum
--
-- La versión de apply_late_fees() en 20260706120000 casteaba
-- 'overdue'::public.pay_status dentro de un CASE cuya rama ELSE (p.status)
-- es de tipo TEXT en esta base -> "CASE types text and pay_status cannot
-- be matched" al ejecutar. Se reemplaza la función usando el literal de
-- texto 'overdue', que unifica con p.status sea text o enum.
--
-- Idempotente: sólo CREATE OR REPLACE de la función. La columna, grants y
-- el cron ya quedaron creados por la migración anterior.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_late_fees()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_today        date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_overdue      integer := 0;
    v_fees_applied integer := 0;
    v_total_fees   numeric := 0;
BEGIN
    WITH candidates AS (
        SELECT
            p.id,
            p.status,
            p.amount,
            p.late_fee_applied_at,
            -- Recargo a aplicar (0 si la escuela no tiene mora o ya se aplicó)
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
          -- Ya pasó el período de gracia posterior al vencimiento
          AND (p.due_date + COALESCE(ss.payment_grace_days, 0)) < v_today
          -- Sólo filas que realmente cambian: marcar 'pending'->'overdue',
          -- o aplicar recargo pendiente cuando la mora está habilitada.
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
            -- 'partial' conserva su estado (aún es un abono con saldo);
            -- 'pending' pasa a 'overdue'. Literal sin cast: unifica con
            -- p.status sea TEXT o enum pay_status.
            status              = CASE WHEN p.status = 'pending' THEN 'overdue'
                                       ELSE p.status END,
            updated_at          = now()
        FROM candidates c
        WHERE p.id = c.id
        RETURNING (c.status = 'pending') AS became_overdue, c.fee
    )
    SELECT
        COUNT(*) FILTER (WHERE became_overdue),
        COUNT(*) FILTER (WHERE fee > 0),
        COALESCE(SUM(fee), 0)
    INTO v_overdue, v_fees_applied, v_total_fees
    FROM updated;

    RAISE NOTICE '[apply_late_fees] fecha=% overdue_marcados=% recargos_aplicados=% total_recargos=%',
        v_today, v_overdue, v_fees_applied, v_total_fees;

    RETURN jsonb_build_object(
        'run_date',       v_today,
        'overdue_marked', v_overdue,
        'fees_applied',   v_fees_applied,
        'total_fees',     v_total_fees
    );
END;
$$;
