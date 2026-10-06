-- =============================================================================
-- 20261005214253_cobranza_flags_autocancel_y_comprobante_pendiente.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261005135530
-- Objetivo: fase F-D de docs/specs/dreamers-reglas-completas-plan.md.
--   Dos flags por escuela para la cobranza, sin cambiar nada para quien no los
--   prenda:
--     · auto_cancel_overdue_enabled (default TRUE = hoy): con FALSE el cron
--       fn_expire_overdue_enrollments deja de cancelar inscripciones vencidas
--       de esa escuela (la escuela decide a mano).
--     · pending_proof_counts_as_paid (default FALSE = hoy): con TRUE un
--       comprobante enviado y sin resolver (awaiting_approval / glosado) cuenta
--       como pagado: el cron no cancela, y el torniquete (BFF, access-adms.ts)
--       deja pasar aunque expires_at ya haya pasado. Y su contracara (hueco C):
--       un comprobante RECHAZADO vuelve a contar como deuda.
-- =============================================================================
--
-- DEPENDENCIA DE ORDEN: aplicar DESPUÉS de 20261005135525 (cobro no nace
-- vencido). apply_late_fees() de abajo parte del cuerpo de ESA migración (que es
-- el cuerpo vivo al 2026-10-05 + el filtro H-01 de created_at + gracia). Si se
-- aplicara esta antes, el CREATE OR REPLACE de 20261005135525 pisaría el hueco C.
-- fn_expire_overdue_enrollments parte del cuerpo VIVO (pg_get_functiondef,
-- 2026-10-05), idéntico a 20260910082720.
--
-- ── Hueco C: dónde se resuelve y por qué ─────────────────────────────────────
-- Un pago 'rejected' nunca volvía a 'overdue' → ni bloqueo por mora ni recargo.
-- Opciones evaluadas:
--   (a) En el flujo de rechazo (BFF/receipt-approval + frontend
--       PaymentsAutomationPage) devolver el pago a pending/overdue. Descartada:
--       son 2+ caminos de escritura (auto-rechazo por veredicto rojo, rechazo
--       manual desde el navegador) y habría que replicar ahí la regla de
--       vencimiento + gracia + periodo que ya vive en apply_late_fees.
--   (b) ELEGIDA: extender apply_late_fees(). Es el único lugar donde se decide
--       "esto ya está en mora" (due_date + gracia, periodo iniciado, H-01), así
--       que el rechazado sigue exactamente la misma regla que un pending, y el
--       recargo se aplica una sola vez (late_fee_applied_at).
--   El rechazado pasa DIRECTO a 'overdue' (no rejected→pending→overdue: dos
--   transiciones = dos filas de payment_audit_logs y dos disparos de triggers).
--   El acudiente puede volver a subir comprobante sobre esa misma fila:
--   fn_guard_payments_client permite overdue→awaiting_approval, y el checkout
--   (PaymentCheckoutModal) REUTILIZA filas pending/overdue del mismo periodo.
--
-- Salvaguardas del hueco C (solo afecta escuelas con el flag):
--   · Si el acudiente ya re-subió en OTRA fila (el checkout no reutiliza filas
--     'rejected', inserta una nueva), existe un "hermano" activo del mismo
--     atleta + periodo (+ plan si no hay periodo) → el rechazado NO se reabre
--     (sería deuda doble). Medido 2026-10-05: 3 de los 9 rechazados de toda la
--     plataforma tienen hermano activo; Dreamers tiene 0 rechazados.
--   · Reabrir mete la fila en los índices únicos parciales
--     (uniq_payment_active_period_*, uq_payments_school_receipt_hash) que
--     excluyen 'rejected'. Cada reapertura va en su propio sub-bloque con
--     EXCEPTION WHEN unique_violation → se salta esa fila y el cron sigue (un
--     23505 jamás tumba la mora de las demás escuelas).
--
-- Radio (escuelas SIN flags): fn_expire_overdue_enrollments con defaults
-- (true/false) es idéntica a la versión anterior; el bloque del hueco C exige
-- pending_proof_counts_as_paid IS TRUE. Columnas nuevas con default constante:
-- ALTER sin reescritura de tabla.
-- Smoke: supabase/migrations/_smoke/autocancel_flags_smoke.sql
-- =============================================================================

BEGIN;

-- ── 1. Flags por escuela ─────────────────────────────────────────────────────
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS auto_cancel_overdue_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pending_proof_counts_as_paid boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.auto_cancel_overdue_enabled IS
  'TRUE (default, comportamiento histórico): fn_expire_overdue_enrollments cancela inscripciones con expires_at + payment_grace_days + 7 < hoy. FALSE: el cron no cancela nada de esta escuela; la baja es decisión manual de la escuela. Migración 20261005214253.';

COMMENT ON COLUMN public.school_settings.pending_proof_counts_as_paid IS
  'FALSE (default): un comprobante sin resolver no cambia nada. TRUE: un pago en awaiting_approval/glosado cuenta como pagado (el cron no cancela la inscripción y el torniquete deja pasar con expires_at vencido), y un pago rejected vuelve a ser deuda (apply_late_fees lo pasa a overdue + recargo una vez, si ya venció due_date + gracia). Migración 20261005214253.';

-- ── 2. Helpers de "comprobante pendiente" (solo service_role) ────────────────
CREATE OR REPLACE FUNCTION public.payment_has_pending_proof(p_payment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = p_payment_id
      AND p.status IN ('awaiting_approval', 'glosado')
  );
$function$;

COMMENT ON FUNCTION public.payment_has_pending_proof(uuid) IS
  'TRUE si el pago tiene un comprobante enviado y sin resolver (awaiting_approval o glosado). Solo service_role. Migración 20261005214253.';

-- Empareja pago ↔ inscripción EXACTAMENTE como fn_extend_enrollment_on_payment_paid
-- (escuela, plan o pago sin plan, y luego child / unregistered / user∈{user,parent}).
CREATE OR REPLACE FUNCTION public.enrollment_has_pending_proof(p_enrollment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.payments p
      ON p.school_id = e.school_id
     AND (p.offering_plan_id = e.offering_plan_id OR p.offering_plan_id IS NULL)
     AND p.status IN ('awaiting_approval', 'glosado')
     AND (
           (p.child_id IS NOT NULL AND e.child_id = p.child_id)
           OR
           (p.unregistered_athlete_id IS NOT NULL
            AND e.unregistered_athlete_id = p.unregistered_athlete_id)
           OR
           (p.child_id IS NULL AND p.unregistered_athlete_id IS NULL
            AND e.child_id IS NULL AND e.unregistered_athlete_id IS NULL
            AND e.user_id IN (p.user_id, p.parent_id))
         )
    WHERE e.id = p_enrollment_id
  );
$function$;

COMMENT ON FUNCTION public.enrollment_has_pending_proof(uuid) IS
  'TRUE si el atleta de la inscripción tiene un pago (de ese plan o sin plan) con comprobante sin resolver (awaiting_approval/glosado). Mismo emparejamiento que fn_extend_enrollment_on_payment_paid. Solo service_role. Migración 20261005214253.';

REVOKE ALL ON FUNCTION public.payment_has_pending_proof(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payment_has_pending_proof(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.payment_has_pending_proof(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.payment_has_pending_proof(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.enrollment_has_pending_proof(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enrollment_has_pending_proof(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.enrollment_has_pending_proof(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enrollment_has_pending_proof(uuid) TO service_role;

-- ── 3. fn_expire_overdue_enrollments respeta los dos flags ──────────────────
-- Base: cuerpo vivo (= 20260910082720). Paso 1 sin cambios. Paso 2: mismo
-- predicado de vencimiento + dos exclusiones, y conteo de lo saltado.
CREATE OR REPLACE FUNCTION public.fn_expire_overdue_enrollments()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_count        integer;
  v_despausadas  integer;
  v_skipped_flag integer;
  v_skipped_proof integer;
  v_today_col    date;
BEGIN
  v_today_col := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date;

  -- 1. Pausas que ya terminaron solas: se apaga el estado vigente para que la
  --    inscripción vuelva a ser candidata a vencimiento (y para que la UI no
  --    la muestre en pausa). La historia queda en enrollment_pause_requests.
  UPDATE enrollments e
  SET paused_reason    = NULL,
      paused_at        = NULL,
      paused_until     = NULL,
      paused_by        = NULL,
      pause_request_id = NULL,
      updated_at       = now()
  WHERE e.paused_reason IS NOT NULL
    AND e.paused_until IS NOT NULL
    AND (e.paused_until AT TIME ZONE 'America/Bogota')::date <= v_today_col;

  GET DIAGNOSTICS v_despausadas = ROW_COUNT;

  -- 2. Vencimiento (D1: grace de la escuela + 7 días), ahora con dos salidas
  --    por escuela (20261005214253):
  --      · auto_cancel_overdue_enabled = FALSE → no se cancela nada.
  --      · pending_proof_counts_as_paid = TRUE y hay comprobante sin resolver
  --        → no se cancela (cuenta como pagado mientras la escuela lo revisa).
  --    Sin fila en school_settings o con los defaults: idéntico a antes.
  WITH vencidas AS (
    SELECT
      e.id,
      NOT COALESCE(ss.auto_cancel_overdue_enabled, true) AS skip_flag,
      CASE WHEN COALESCE(ss.pending_proof_counts_as_paid, false)
           THEN public.enrollment_has_pending_proof(e.id)
           ELSE false
      END AS skip_proof
    FROM enrollments e
    LEFT JOIN public.school_settings ss ON ss.school_id = e.school_id
    WHERE
      e.status     = 'active'
      AND e.expires_at IS NOT NULL
      AND e.paused_reason IS NULL
      AND (
        e.expires_at
        + COALESCE(
            (SELECT ss2.payment_grace_days FROM public.school_settings ss2 WHERE ss2.school_id = e.school_id),
            0
          )
        + 7
      ) < v_today_col
      AND NOT (
        e.offering_plan_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.offering_plans op
          WHERE op.id = e.offering_plan_id
            AND op.max_sessions IS NOT NULL
            AND COALESCE(e.sessions_used, 0) < op.max_sessions
        )
      )
  ), canceladas AS (
    UPDATE enrollments e
    SET
      status     = 'cancelled',
      updated_at = now()
    FROM vencidas v
    WHERE e.id = v.id
      AND e.status = 'active'
      AND NOT v.skip_flag
      AND NOT v.skip_proof
    RETURNING e.id
  )
  SELECT
    (SELECT count(*) FROM canceladas),
    count(*) FILTER (WHERE skip_flag),
    count(*) FILTER (WHERE skip_proof AND NOT skip_flag)
  INTO v_count, v_skipped_flag, v_skipped_proof
  FROM vencidas;

  RETURN jsonb_build_object(
    'success',       true,
    'expired',       v_count,
    'skipped_flag',  v_skipped_flag,
    'skipped_proof', v_skipped_proof,
    'despausadas',   v_despausadas,
    'ran_at',        now(),
    'date_used',     v_today_col
  );
END;
$function$;

-- Mismos GRANTs que hoy (proacl vivo: postgres + service_role).
REVOKE ALL ON FUNCTION public.fn_expire_overdue_enrollments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_expire_overdue_enrollments() FROM anon;
REVOKE ALL ON FUNCTION public.fn_expire_overdue_enrollments() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_expire_overdue_enrollments() TO service_role;

-- ── 4. apply_late_fees: hueco C (rechazado vuelve a ser deuda, bajo el flag) ─
-- Base: 20261005135525 (vivo + filtro H-01). El CTE original queda intacto;
-- se agrega un paso previo que solo toca escuelas con pending_proof_counts_as_paid.
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

REVOKE ALL ON FUNCTION public.apply_late_fees() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_late_fees() FROM anon;
REVOKE ALL ON FUNCTION public.apply_late_fees() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_late_fees() TO service_role;

COMMIT;
