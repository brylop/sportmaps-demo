-- ============================================================
-- SPORTMAPS — Motor de mora (recargo por pago vencido)
--
-- PROBLEMA QUE RESUELVE:
--   school_settings.late_fee_enabled / late_fee_percentage se configuraban
--   en el panel de Automatización de Pagos pero NADIE los leía: ningún job
--   marcaba pagos como vencidos ni aplicaba el recargo. El padre/atleta
--   siempre pagaba la mensualidad base -> "la mora no se cobra".
--
-- QUÉ HACE:
--   1. Agrega payments.late_fee_amount (recargo aplicado) y
--      payments.late_fee_applied_at (marca de idempotencia).
--   2. apply_late_fees(): recorre los pagos 'pending'/'partial' cuya
--      due_date + payment_grace_days ya venció (fecha Colombia) y:
--        - los marca 'overdue' (si estaban 'pending');
--        - si la escuela tiene late_fee_enabled, suma UNA sola vez un
--          recargo = late_fee_percentage% sobre el SALDO pendiente
--          (amount - amount_paid) a payments.amount, y lo registra en
--          late_fee_amount. Al folear el recargo dentro de `amount`, todo
--          el flujo de cobro (checkout, OCR, recibos) refleja el total real
--          sin tocar el frontend de pago.
--   3. Programa apply_late_fees() a diario vía pg_cron (07:00 UTC = 02:00 COT),
--      justo después del cron de cobros recurrentes.
--
-- DECISIONES:
--   - Recargo ÚNICO (no compuesto por día). late_fee_applied_at evita re-aplicar.
--   - Base de cálculo = SALDO pendiente, respeta abonos parciales previos.
--   - Escuelas sin mora igual reciben el marcado 'overdue' (badges/recordatorios).
-- ============================================================

-- 1. Columnas de recargo en payments -------------------------------------------
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS late_fee_amount     numeric NOT NULL DEFAULT 0
        CHECK (late_fee_amount >= 0),
    ADD COLUMN IF NOT EXISTS late_fee_applied_at timestamptz;

COMMENT ON COLUMN public.payments.late_fee_amount IS
    'Recargo por mora ya incluido dentro de amount. 0 si no aplica.';
COMMENT ON COLUMN public.payments.late_fee_applied_at IS
    'Cuándo se aplicó el recargo por mora. NULL = aún no aplicado (idempotencia).';

-- 2. Función del motor de mora -------------------------------------------------
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
            -- 'pending' pasa a 'overdue'.
            status              = CASE WHEN p.status = 'pending' THEN 'overdue'::public.pay_status
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

COMMENT ON FUNCTION public.apply_late_fees() IS
    'Marca pagos vencidos como overdue y aplica el recargo por mora (una sola vez) según school_settings. Ejecutado a diario por pg_cron.';

-- El motor recorre TODAS las escuelas y muta pagos: sólo lo invoca el cron
-- (postgres) o el service_role del BFF. Nunca un usuario autenticado.
REVOKE ALL ON FUNCTION public.apply_late_fees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_late_fees() TO service_role;

-- 3. Programación diaria vía pg_cron -------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    PERFORM cron.unschedule('apply-late-fees-daily');
EXCEPTION WHEN OTHERS THEN
    NULL; -- el job no existía
END $$;

-- 07:00 UTC = 02:00 COT, tras 'recurring-charges-daily' (06:00 UTC).
SELECT cron.schedule(
    'apply-late-fees-daily',
    '0 7 * * *',
    $cron$ SELECT public.apply_late_fees(); $cron$
);
