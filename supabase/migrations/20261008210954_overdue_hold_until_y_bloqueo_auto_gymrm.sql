-- =============================================================================
-- 20261008210954_overdue_hold_until_y_bloqueo_auto_gymrm.sql
-- Autor: judegor99   Fecha: 2026-10-09   Versión anterior: 20261005221257
-- Objetivo: congelar por escuela el paso pending -> overdue (y el recargo) hasta
--   una fecha (school_settings.overdue_hold_until), y dejar programado para GYM RM
--   el bloqueo automático por mora a partir del cron del 17-oct-2026.
-- =============================================================================
-- Contexto: GYM RM validará quién falta por pagar antes de que apply_late_fees()
--   (pg_cron 07:00 UTC = 02:00 Colombia) marque los cobros de octubre (vencen el
--   10-oct, gracia 5 días) como 'overdue'. La regla es temporal y se apaga sola:
--   con overdue_hold_until = 2026-10-16 el cron del 16 no toca a GYM RM y el del
--   17 corre normal. Escuelas con la columna en NULL (todas las demás): sin cambio.
-- =============================================================================

BEGIN;

-- 1. Bandera de congelamiento (NULL = sin congelar)
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS overdue_hold_until date;

COMMENT ON COLUMN public.school_settings.overdue_hold_until IS
  'Si no es NULL, apply_late_fees() omite la escuela mientras hoy (America/Bogota) <= esta fecha: no pasa pending a overdue ni aplica recargo. Temporal; NULL = comportamiento normal.';

-- 2. apply_late_fees(): idéntica a la vigente salvo el filtro de congelamiento en
--    sus dos consultas (reapertura de rechazados y pending/partial -> overdue).
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
    -- 0. Hueco C (20261005214253): en escuelas con pending_proof_counts_as_paid,
    --    un comprobante RECHAZADO deja la deuda viva. Si el cobro ya pasó
    --    due_date + gracia (mismas condiciones que un pending de abajo), pasa
    --    DIRECTO a 'overdue' con su recargo único. No se reabre si el atleta ya
    --    tiene otro cobro activo del mismo periodo (re-subió en otra fila).
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
          -- Congelamiento temporal por escuela (20261008210954)
          AND NOT (ss.overdue_hold_until IS NOT NULL AND v_today <= ss.overdue_hold_until)
          AND COALESCE(p.child_id, p.unregistered_athlete_id, p.user_id) IS NOT NULL
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
            -- Otra fila activa ya ocupa ese periodo / ese hash de comprobante.
            v_reopen_skip := v_reopen_skip + 1;
        END;
    END LOOP;

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
          -- Congelamiento temporal por escuela (20261008210954)
          AND NOT (ss.overdue_hold_until IS NOT NULL AND v_today <= ss.overdue_hold_until)
          -- Ya pasó el período de gracia posterior al vencimiento
          AND (p.due_date + COALESCE(ss.payment_grace_days, 0)) < v_today
          -- Un cobro de un mes que todavía no empieza no está en mora, sin
          -- importar qué diga su due_date (cobros del QR generados por
          -- adelantado, ver migración 20260804125644).
          AND (p.period_year IS NULL
               OR p.period_month IS NULL
               OR make_date(p.period_year::int, p.period_month::int, 1)
                  <= date_trunc('month', v_today)::date)
          -- FIX 2026-10-05 (H-01): la gracia también corre desde que el cobro
          -- EXISTE. Un cobro que nace hoy con un vencimiento ya pasado (alta
          -- tardía, registro por otra vía, mes abierto a destiempo) no se marca
          -- overdue ni recibe recargo el mismo día: la familia tiene los mismos
          -- días de gracia que cualquier otra para enterarse y pagar.
          AND ((COALESCE(p.created_at, now()) AT TIME ZONE 'America/Bogota')::date
               + COALESCE(ss.payment_grace_days, 0)) < v_today
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

-- 3. GYM RM: congelado hasta el 16-oct (el cron del 17 corre normal).
UPDATE public.school_settings
   SET overdue_hold_until = DATE '2026-10-16',
       updated_at = now()
 WHERE school_id = '2137182d-a695-4695-8e5a-61151fc59196';

-- 4. GYM RM: bloqueo automático por mora desde el 17-oct (03:15 Colombia = 08:15
--    UTC, después de apply_late_fees de las 02:00). Se enciende UNA vez y el job
--    se desprograma solo. No se enciende hoy porque, sin cobros vencidos, el job
--    desbloquearía de inmediato a quienes hoy están bloqueados.
SELECT cron.schedule(
  'gymrm-bloqueo-auto-2026-10-17',
  '15 8 17 10 *',
  $job$
    UPDATE public.school_settings
       SET access_auto_block_overdue_enabled = true,
           overdue_hold_until = NULL,
           updated_at = now()
     WHERE school_id = '2137182d-a695-4695-8e5a-61151fc59196';
    SELECT cron.unschedule('gymrm-bloqueo-auto-2026-10-17');
  $job$
);

COMMIT;
