-- =============================================================================
-- 20261014133326_mora_vence_enlaces_y_autopay_cobra_vencidos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014125527
-- Objetivo: la mora se COBRA por todos los canales, débito automático incluido.
--
--   Regla de producto (2026-10-14, revierte la D1 del 2026-09-02): la mora NUNCA
--   cancela inscripciones ni cobros. Si la escuela tiene late_fee_enabled,
--   apply_late_fees() suma el recargo dentro de payments.amount, y TODO canal de
--   pago tiene que cobrar el monto CON el recargo. Dos huecos lo impedían:
--
--   1. apply_late_fees() subía payments.amount pero dejaba vivos los payment_links
--      'pending' del cobro, firmados con el monto SIN recargo. create-session y el
--      enlace público reusan un link pendiente vigente → la familia pagaba el monto
--      viejo y el webhook dejaba el cobro 'paid' (el recargo se perdía).
--      Ahora, en la MISMA transacción, todo cobro que recibe recargo > 0 (tanto el
--      bucle de 'rejected' reabiertos como el CTE de pending/partial) expira sus
--      links 'pending' (status 'expired', valor admitido por
--      payment_links_status_check desde 20260819083012). El próximo checkout firma
--      uno nuevo con el monto vigente.
--      EXCEPCIÓN: el link origin='autopay' de un intento de débito EN VUELO
--      (recurring_charge_attempts.status IN ('processing','pending_provider')) no se
--      toca: la transacción ya está en Wompi con el monto anterior; expirarlo no la
--      frena y solo rompería la conciliación del intento.
--      La función conserva su forma de retorno y agrega el contador 'links_expired'.
--
--   2. El débito automático nunca cobraba lo vencido. La D14 del spec
--      docs/specs/debito-automatico.md decía «Lo `overdue` nunca entra al débito
--      programado»: plan_cycles solo planificaba 'pending', y claim_due/plan_cycles
--      CANCELABAN el ciclo cuando el cobro pasaba a 'overdue' (y lo daban por
--      «pagado por otra vía» si quedaba 'partial').
--      >>> D14 REVERTIDA POR EL DUEÑO DE PRODUCTO el 2026-10-14 en lo que toca a lo
--      >>> vencido: un cobro 'overdue' o 'partial' del periodo de la suscripción SÍ
--      >>> se debita, por el SALDO (amount − amount_paid) que ya incluye la mora,
--      >>> más el recargo online según autopay_surcharge_mode.
--      Se mantiene de la D14: solo periodos >= first_period (lo anterior al alta no
--      entra solo) y el aviso previo (D4): como la mora sube el total por encima de
--      lo anunciado, la regla C.5 existente re-avisa antes de debitar.
--      Cambios:
--        · autopay_payment_total: base = saldo (amount − amount_paid), no amount.
--        · autopay_plan_cycles: planifica pending/overdue/partial; un ciclo que se
--          había cancelado porque el cobro venció (o fue rechazado y luego
--          reabierto como overdue) vuelve a 'scheduled' si la suscripción sigue
--          activa; solo paid/awaiting_approval cuentan como «pagado por otra vía».
--        · autopay_claim_due: debita pending/overdue/partial; saldo 0 → paid_elsewhere.
--        · autopay_create_subscription: la casilla «Debitar también la mensualidad
--          de <mes>» acepta ese cobro si está pending, overdue o partial (antes solo
--          pending no vencido).
--        · autopay_update_subscription: al reactivar, re-planifica el mes omitido si
--          el cobro sigue pending/overdue/partial (antes solo pending no vencido).
--      El BFF (bff/src/services/autopay.service.ts) arma el enlace con base = saldo.
--
--   NO incluye fn_expire_overdue_enrollments ni la reactivación: van en
--   20261014130128 (otra sesión).
--   Cuerpos tomados de la definición más nueva en el repo:
--     apply_late_fees              ← 20261011101750
--     autopay_payment_total, autopay_create_subscription, autopay_plan_cycles,
--     autopay_claim_due            ← 20261005133733
--     autopay_update_subscription  ← 20261007163321
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

-- ════════════════════════════════════════════════════════════════════════════
-- 1. apply_late_fees: el recargo expira los links pendientes del cobro
-- ════════════════════════════════════════════════════════════════════════════
-- Base: 20261011101750. Cambios marcados «(links)».
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
    v_links        integer := 0;   -- (links)
    v_n            integer;        -- (links)
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

                    -- (links) Un link pendiente quedó firmado con el monto sin recargo.
                    UPDATE public.payment_links l
                       SET status = 'expired', updated_at = now()
                     WHERE l.payment_id = r.id
                       AND l.status = 'pending'
                       AND NOT (l.origin = 'autopay'
                                AND EXISTS (SELECT 1 FROM public.recurring_charge_attempts a
                                             WHERE a.id = l.recurring_attempt_id
                                               AND a.status IN ('processing', 'pending_provider')));
                    GET DIAGNOSTICS v_n = ROW_COUNT;
                    v_links := v_links + v_n;
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
        RETURNING p.id, (c.status = 'pending') AS became_overdue, c.fee
    ), expired_links AS (   -- (links) mismo criterio que en el bucle de 'rejected'
        UPDATE public.payment_links l
           SET status = 'expired', updated_at = now()
          FROM updated u
         WHERE l.payment_id = u.id
           AND u.fee > 0
           AND l.status = 'pending'
           AND NOT (l.origin = 'autopay'
                    AND EXISTS (SELECT 1 FROM public.recurring_charge_attempts a
                                 WHERE a.id = l.recurring_attempt_id
                                   AND a.status IN ('processing', 'pending_provider')))
        RETURNING l.id
    )
    SELECT
        COUNT(*) FILTER (WHERE became_overdue),
        v_fees_applied + COUNT(*) FILTER (WHERE fee > 0),
        v_total_fees + COALESCE(SUM(fee), 0),
        v_links + (SELECT COUNT(*) FROM expired_links)   -- (links)
    INTO v_overdue, v_fees_applied, v_total_fees, v_links
    FROM updated;

    RETURN jsonb_build_object(
        'run_date',                v_today,
        'overdue_marked',          v_overdue,
        'fees_applied',            v_fees_applied,
        'total_fees',              v_total_fees,
        'rejected_reopened',       v_reopened,
        'rejected_reopen_skipped', v_reopen_skip,
        'links_expired',           v_links   -- (links)
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_late_fees() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_late_fees() TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Débito automático: lo vencido (y lo parcial) se debita por su saldo
-- ════════════════════════════════════════════════════════════════════════════

-- 2.1 Total a debitar = saldo (amount − amount_paid, ya con la mora) + recargo online
-- según la escuela. Base: 20261005133733 (sumaba sobre amount entero).
CREATE OR REPLACE FUNCTION public.autopay_payment_total(p_payment_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT b.saldo
       + CASE WHEN COALESCE(ss.autopay_surcharge_mode, 'same_as_online') = 'same_as_online'
              THEN round(b.saldo * COALESCE(ss.online_fee_pct, 3) / 100)
              ELSE 0 END
    FROM public.payments p
    CROSS JOIN LATERAL (SELECT GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0) AS saldo) b
    LEFT JOIN public.school_settings ss ON ss.school_id = p.school_id
   WHERE p.id = p_payment_id;
$$;

REVOKE ALL ON FUNCTION public.autopay_payment_total(uuid) FROM PUBLIC, anon, authenticated;

-- 2.2 Alta. Único cambio: la casilla acepta el último cobro pending/overdue/partial
-- (D14 revertida en lo vencido). Base: 20261005133733.
CREATE OR REPLACE FUNCTION public.autopay_create_subscription(
  p_user_id                 uuid,
  p_school_id               uuid,
  p_child_id                uuid,
  p_athlete_user_id         uuid,
  p_token_id                uuid,
  p_max_amount              numeric,
  p_consent_id              uuid,
  p_include_current_period  boolean DEFAULT false,
  p_today                   date    DEFAULT (now() AT TIME ZONE 'America/Bogota')::date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_tok      public.payment_tokens;
  v_last     public.payments;
  v_year     int;
  v_month    int;
  v_total    numeric;
  v_sub_id   uuid;
BEGIN
  IF (p_child_id IS NULL) = (p_athlete_user_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'athlete_required');
  END IF;

  IF NOT COALESCE((SELECT autopay_enabled FROM public.school_settings WHERE school_id = p_school_id), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'autopay_not_offered');
  END IF;

  -- Quién puede: el acudiente del menor, o el atleta adulto sobre sí mismo.
  IF p_child_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.children c WHERE c.id = p_child_id AND c.parent_id = p_user_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_guardian');
    END IF;
  ELSIF p_athlete_user_id <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_guardian');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
     WHERE e.school_id = p_school_id AND e.status = 'active'
       AND ((p_child_id IS NOT NULL AND e.child_id = p_child_id)
         OR (p_athlete_user_id IS NOT NULL AND e.user_id = p_athlete_user_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_enrollment');
  END IF;

  SELECT * INTO v_tok FROM public.payment_tokens WHERE id = p_token_id;
  IF NOT FOUND OR v_tok.user_id <> p_user_id OR v_tok.school_id IS DISTINCT FROM p_school_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_owned');
  END IF;
  IF v_tok.status IS DISTINCT FROM 'available' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_available');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.payment_consents pc WHERE pc.id = p_consent_id AND pc.user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'consent_not_found');
  END IF;

  IF p_max_amount IS NULL OR p_max_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_max_amount');
  END IF;

  -- Último cobro de mensualidad generado para el atleta en la escuela (D14).
  SELECT p.* INTO v_last
    FROM public.payments p
   WHERE p.school_id = p_school_id AND p.payment_category = 'mensualidad'
     AND p.period_year IS NOT NULL AND p.status <> 'cancelled'
     AND ((p_child_id IS NOT NULL AND p.child_id = p_child_id)
       OR (p_athlete_user_id IS NOT NULL AND p.child_id IS NULL AND p.unregistered_athlete_id IS NULL
           AND (p.user_id = p_athlete_user_id OR (p.user_id IS NULL AND p.parent_id = p_athlete_user_id))))
   ORDER BY p.period_year DESC, p.period_month DESC, p.created_at DESC
   LIMIT 1;

  IF v_last.id IS NULL THEN
    v_year  := extract(year FROM p_today);
    v_month := extract(month FROM p_today);
  ELSIF p_include_current_period AND v_last.status IN ('pending', 'overdue', 'partial') THEN
    -- "Debitar también la mensualidad de <mes>": se debita su saldo, con la mora si
    -- ya venció (D14 revertida en lo vencido, 2026-10-14).
    v_year  := v_last.period_year;
    v_month := v_last.period_month;
    v_total := public.autopay_payment_total(v_last.id);
  ELSE
    v_year  := v_last.period_year + CASE WHEN v_last.period_month = 12 THEN 1 ELSE 0 END;
    v_month := CASE WHEN v_last.period_month = 12 THEN 1 ELSE v_last.period_month + 1 END;
    v_total := public.autopay_payment_total(v_last.id);  -- referencia del total vigente
  END IF;

  -- D5: el tope tiene que cubrir el total vigente.
  IF v_total IS NOT NULL AND p_max_amount < v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_amount_below_current', 'current_total', v_total);
  END IF;

  BEGIN
    INSERT INTO public.recurring_subscriptions (
      school_id, payer_user_id, child_id, athlete_user_id, payment_token_id, consent_id,
      max_amount, first_period_year, first_period_month
    ) VALUES (
      p_school_id, p_user_id, p_child_id, p_athlete_user_id, p_token_id, p_consent_id,
      p_max_amount, v_year, v_month
    ) RETURNING id INTO v_sub_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_subscribed');
  END;

  RETURN jsonb_build_object('ok', true, 'subscription_id', v_sub_id,
                            'first_period_year', v_year, 'first_period_month', v_month);
END;
$$;

-- 2.3 Planificar y decidir avisos. Base: 20261005133733. Cambios marcados «(vencidos)».
CREATE OR REPLACE FUNCTION public.autopay_plan_cycles(p_today date DEFAULT (now() AT TIME ZONE 'America/Bogota')::date)
RETURNS TABLE (
  cycle_id        uuid,
  subscription_id uuid,
  payment_id      uuid,
  payer_user_id   uuid,
  school_id       uuid,
  action          text,
  total           numeric,
  first_attempt_on date
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  r       record;
  v_total numeric;
  v_n     int;
BEGIN
  -- A. Un ciclo por cada mensualidad por cobrar del atleta (pending, overdue o
  --    partial — (vencidos)), periodo >= first_period.
  --    (vencidos) Un ciclo que se canceló porque el cobro venció o lo rechazaron
  --    (y apply_late_fees lo reabrió como overdue) vuelve a planificarse si su
  --    suscripción sigue activa. Uno cancelado por baja de la suscripción no: esa
  --    suscripción ya no es 'active' y no aparece en el SELECT.
  INSERT INTO public.autopay_cycles (payment_id, subscription_id, school_id, first_attempt_on)
  SELECT p.id, s.id, s.school_id,
         p.due_date - COALESCE(ss.autopay_days_before_due, 3)
    FROM public.recurring_subscriptions s
    JOIN public.payments p
      ON p.school_id = s.school_id
     AND p.payment_category = 'mensualidad'
     AND p.status IN ('pending', 'overdue', 'partial')   -- (vencidos)
     AND p.period_year IS NOT NULL
     AND (p.period_year, p.period_month) >= (s.first_period_year, s.first_period_month)
     AND public.autopay_payment_matches(s, p)
    LEFT JOIN public.school_settings ss ON ss.school_id = s.school_id
   WHERE s.status = 'active'
  ON CONFLICT (payment_id) DO UPDATE
     SET state = 'scheduled', skip_reason = NULL, skipped_by = NULL,
         notice_sent_at = NULL, announced_total = NULL,
         first_attempt_on = EXCLUDED.first_attempt_on, next_attempt_on = NULL,
         hold_reason = NULL, hold_at = NULL, updated_at = now()
   WHERE autopay_cycles.state = 'cancelled'
     AND autopay_cycles.subscription_id = EXCLUDED.subscription_id;

  -- Cobros que dejaron de estar por cobrar antes de avisar o de debitar.
  FOR r IN
    SELECT c.id, c.subscription_id, p.status AS pay_status
      FROM public.autopay_cycles c JOIN public.payments p ON p.id = c.payment_id
     WHERE c.state IN ('scheduled', 'noticed')
       AND p.status NOT IN ('pending', 'overdue', 'partial')   -- (vencidos)
       FOR UPDATE OF c
  LOOP
    IF r.pay_status IN ('paid', 'awaiting_approval') THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'paid_elsewhere',
             hold_reason = NULL, hold_at = NULL, updated_at = now() WHERE id = r.id;
      PERFORM public.autopay_reset_cycles_without_debit(r.subscription_id);
    ELSE
      -- cancelled / failed / rejected / glosado: no hay nada que debitar.
      -- (vencidos) overdue y partial ya no caen acá: se debitan con la mora.
      UPDATE public.autopay_cycles SET state = 'cancelled', hold_reason = NULL, hold_at = NULL,
             updated_at = now() WHERE id = r.id;
    END IF;
  END LOOP;

  -- B. Avisos de hoy.
  FOR r IN
    SELECT c.id, c.subscription_id, c.payment_id, c.school_id, c.renotice_count,
           s.payer_user_id, s.max_amount, s.status AS sub_status,
           t.status AS tok_status,
           p.due_date, p.created_at AS pay_created,
           COALESCE(ss.autopay_days_before_due, 3) AS n_days
      FROM public.autopay_cycles c
      JOIN public.recurring_subscriptions s ON s.id = c.subscription_id
      JOIN public.payments p                ON p.id = c.payment_id
      JOIN public.payment_tokens t          ON t.id = s.payment_token_id
      LEFT JOIN public.school_settings ss   ON ss.school_id = c.school_id
     WHERE c.state = 'scheduled' AND s.status = 'active'
       FOR UPDATE OF c
  LOOP
    v_n := r.n_days;
    IF p_today < GREATEST((r.pay_created AT TIME ZONE 'America/Bogota')::date, r.due_date - v_n - 2) THEN
      CONTINUE;
    END IF;

    v_total := public.autopay_payment_total(r.payment_id);

    -- (vencidos) Saldo en cero (un parcial que ya se completó): nada que avisar.
    IF COALESCE(v_total, 0) <= 0 THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'paid_elsewhere',
             hold_reason = NULL, hold_at = NULL, updated_at = now() WHERE id = r.id;
      PERFORM public.autopay_reset_cycles_without_debit(r.subscription_id);
      CONTINUE;
    END IF;

    IF v_total > r.max_amount THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'over_max_amount', updated_at = now()
       WHERE id = r.id;
      PERFORM public.autopay_count_cycle_without_debit(r.subscription_id, 'over_max_amount');
      cycle_id := r.id; subscription_id := r.subscription_id; payment_id := r.payment_id;
      payer_user_id := r.payer_user_id; school_id := r.school_id; action := 'over_max_amount';
      total := v_total; first_attempt_on := NULL;
      RETURN NEXT;
    ELSIF r.tok_status IS DISTINCT FROM 'available' THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'token_not_available', updated_at = now()
       WHERE id = r.id;
      PERFORM public.autopay_count_cycle_without_debit(r.subscription_id, 'token_not_available');
      cycle_id := r.id; subscription_id := r.subscription_id; payment_id := r.payment_id;
      payer_user_id := r.payer_user_id; school_id := r.school_id; action := 'token_not_available';
      total := v_total; first_attempt_on := NULL;
      RETURN NEXT;
    ELSE
      cycle_id := r.id; subscription_id := r.subscription_id; payment_id := r.payment_id;
      payer_user_id := r.payer_user_id; school_id := r.school_id; action := 'notice';
      total := v_total; first_attempt_on := GREATEST(r.due_date - v_n, p_today + 2);
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- 2.4 Claim. Base: 20261005133733. Cambios marcados «(vencidos)».
CREATE OR REPLACE FUNCTION public.autopay_claim_due(
  p_limit          int  DEFAULT 50,
  p_lease_seconds  int  DEFAULT 300,
  p_today          date DEFAULT (now() AT TIME ZONE 'America/Bogota')::date
) RETURNS TABLE (
  attempt_id                 uuid,
  cycle_id                   uuid,
  payment_id                 uuid,
  subscription_id            uuid,
  school_id                  uuid,
  payer_user_id              uuid,
  amount                     numeric,
  attempt_no                 smallint,
  payment_token_id           uuid,
  provider_payment_source_id bigint,
  payment_method_type        text,
  provider_merchant_id       text,
  manual_link_id             uuid,
  manual_link_reference      text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  r          record;
  v_total    numeric;
  v_attempt  uuid;
  v_no       smallint;
  v_recent   boolean;
  v_old_link public.payment_links;
BEGIN
  -- C.1 Interruptor global.
  IF NOT COALESCE((SELECT (value->>'debits_enabled')::boolean FROM public.platform_config
                    WHERE key = 'autopay_kill_switch'), false) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT c.id, c.subscription_id, c.payment_id, c.school_id, c.announced_total, c.attempts_used,
           s.payer_user_id, s.status AS sub_status, s.payment_token_id,
           t.status AS tok_status, t.provider_payment_source_id, t.payment_method_type, t.provider_merchant_id,
           p.status AS pay_status,
           COALESCE(ss.autopay_debits_paused, false) AS paused
      FROM public.autopay_cycles c
      JOIN public.recurring_subscriptions s ON s.id = c.subscription_id
      JOIN public.payments p                ON p.id = c.payment_id
      JOIN public.payment_tokens t          ON t.id = s.payment_token_id
      LEFT JOIN public.school_settings ss   ON ss.school_id = c.school_id
     WHERE c.state = 'noticed'                 -- C.3
       AND c.notice_sent_at IS NOT NULL
       AND c.next_attempt_on <= p_today
       AND c.attempts_used < 3                  -- C.7
       AND s.status = 'active'
     ORDER BY c.next_attempt_on, c.created_at
     LIMIT p_limit
       FOR UPDATE OF c SKIP LOCKED
  LOOP
    -- C.2 Débitos pausados por la escuela: retención, sin consumir intento.
    IF r.paused THEN
      UPDATE public.autopay_cycles SET hold_reason = 'debits_paused', hold_at = now(), updated_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;

    -- C.4 El cobro ya no está por cobrar. (vencidos) overdue y partial SÍ se debitan.
    IF r.pay_status IN ('paid', 'awaiting_approval') THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'paid_elsewhere',
             hold_reason = NULL, hold_at = NULL, updated_at = now() WHERE id = r.id;
      PERFORM public.autopay_reset_cycles_without_debit(r.subscription_id);
      CONTINUE;
    ELSIF r.pay_status NOT IN ('pending', 'overdue', 'partial') THEN
      UPDATE public.autopay_cycles SET state = 'cancelled', hold_reason = NULL, hold_at = NULL,
             updated_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;

    -- Medio que dejó de servir después del aviso.
    IF r.tok_status IS DISTINCT FROM 'available' THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'token_not_available',
             hold_reason = NULL, hold_at = NULL, updated_at = now() WHERE id = r.id;
      PERFORM public.autopay_count_cycle_without_debit(r.subscription_id, 'token_not_available');
      CONTINUE;
    END IF;

    v_total := public.autopay_payment_total(r.payment_id);

    -- (vencidos) Saldo en cero: el parcial se completó por otra vía.
    IF COALESCE(v_total, 0) <= 0 THEN
      UPDATE public.autopay_cycles SET state = 'skipped', skip_reason = 'paid_elsewhere',
             hold_reason = NULL, hold_at = NULL, updated_at = now() WHERE id = r.id;
      PERFORM public.autopay_reset_cycles_without_debit(r.subscription_id);
      CONTINUE;
    END IF;

    -- C.5 Nunca por encima de lo anunciado: si subió (cambio de plan o MORA), re-aviso.
    IF v_total > r.announced_total THEN
      UPDATE public.autopay_cycles
         SET state = 'scheduled', renotice_count = renotice_count + 1,
             hold_reason = NULL, hold_at = NULL, updated_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;

    -- C.7 Sin intento vivo (el índice único lo garantiza; esto evita el error).
    IF EXISTS (SELECT 1 FROM public.recurring_charge_attempts a
                WHERE a.payment_id = r.payment_id AND a.status IN ('processing', 'pending_provider')) THEN
      CONTINUE;
    END IF;

    -- C.8 / §7.3 Checkout manual pendiente del mismo cobro.
    SELECT EXISTS (SELECT 1 FROM public.payment_links l
                    WHERE l.payment_id = r.payment_id AND l.status = 'pending' AND l.origin = 'checkout'
                      AND l.created_at > now() - interval '2 hours')
      INTO v_recent;
    IF v_recent THEN
      UPDATE public.autopay_cycles SET hold_reason = 'manual_checkout_open', hold_at = now(), updated_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;
    SELECT * INTO v_old_link FROM public.payment_links l
     WHERE l.payment_id = r.payment_id AND l.status = 'pending' AND l.origin = 'checkout'
     ORDER BY l.created_at DESC LIMIT 1;

    -- Intento real.
    v_no := r.attempts_used + 1;
    INSERT INTO public.recurring_charge_attempts (cycle_id, payment_id, attempt_no, status, amount, lease_until)
    VALUES (r.id, r.payment_id, v_no, 'processing', v_total, now() + make_interval(secs => p_lease_seconds))
    RETURNING id INTO v_attempt;

    UPDATE public.autopay_cycles
       SET state = 'in_progress', attempts_used = v_no, hold_reason = NULL, hold_at = NULL, updated_at = now()
     WHERE id = r.id;

    attempt_id := v_attempt; cycle_id := r.id; payment_id := r.payment_id;
    subscription_id := r.subscription_id; school_id := r.school_id; payer_user_id := r.payer_user_id;
    amount := v_total; attempt_no := v_no; payment_token_id := r.payment_token_id;
    provider_payment_source_id := r.provider_payment_source_id;
    payment_method_type := r.payment_method_type; provider_merchant_id := r.provider_merchant_id;
    manual_link_id := v_old_link.id; manual_link_reference := COALESCE(v_old_link.provider_reference, v_old_link.wompi_reference);
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 2.5 Cambio de tope/medio. Base: 20261007163321. Único cambio: el mes omitido se
-- re-planifica si el cobro sigue por cobrar (pending/overdue/partial), vencido o no.
-- p_today se conserva en la firma (el BFF la llama así), aunque ya no filtra.
CREATE OR REPLACE FUNCTION public.autopay_update_subscription(
  p_user_id          uuid,
  p_subscription_id  uuid,
  p_max_amount       numeric DEFAULT NULL,
  p_token_id         uuid    DEFAULT NULL,
  p_today            date    DEFAULT (now() AT TIME ZONE 'America/Bogota')::date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_sub   public.recurring_subscriptions;
  v_tok   public.payment_tokens;
  v_react boolean := false;
BEGIN
  IF p_max_amount IS NULL AND p_token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nothing_to_change');
  END IF;

  SELECT * INTO v_sub FROM public.recurring_subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_sub.payer_user_id <> p_user_id THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF v_sub.status = 'cancelled' THEN RETURN jsonb_build_object('ok', false, 'error', 'cancelled'); END IF;
  IF v_sub.status = 'suspended' AND v_sub.suspend_reason = 'duplicate_charge' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'suspended_duplicate_charge');
  END IF;

  IF p_max_amount IS NOT NULL AND p_max_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_max_amount');
  END IF;

  IF p_token_id IS NOT NULL THEN
    SELECT * INTO v_tok FROM public.payment_tokens WHERE id = p_token_id;
    IF NOT FOUND OR v_tok.user_id <> p_user_id OR v_tok.school_id IS DISTINCT FROM v_sub.school_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'token_not_owned');
    END IF;
    IF v_tok.status IS DISTINCT FROM 'available' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'token_not_available');
    END IF;
  END IF;

  v_react := v_sub.status = 'suspended';

  UPDATE public.recurring_subscriptions
     SET max_amount           = COALESCE(p_max_amount, max_amount),
         payment_token_id     = COALESCE(p_token_id, payment_token_id),
         status               = 'active',
         suspend_reason       = NULL,
         suspended_at         = NULL,
         cycles_without_debit = CASE WHEN v_react THEN 0 ELSE cycles_without_debit END,
         updated_at           = now()
   WHERE id = p_subscription_id;

  -- El mes que se omitió por tope o por medio vuelve a planificarse si el cobro
  -- sigue por cobrar (pending, overdue o partial). Sale un aviso nuevo (D4).
  UPDATE public.autopay_cycles c
     SET state = 'scheduled', skip_reason = NULL, notice_sent_at = NULL, announced_total = NULL,
         first_attempt_on = NULL, next_attempt_on = NULL, updated_at = now()
    FROM public.payments p
   WHERE c.subscription_id = p_subscription_id
     AND c.state = 'skipped' AND c.skip_reason IN ('over_max_amount', 'token_not_available')
     AND p.id = c.payment_id AND p.status IN ('pending', 'overdue', 'partial');

  RETURN jsonb_build_object('ok', true, 'reactivated', v_react);
END;
$$;

-- GRANTs explícitos (CREATE OR REPLACE conserva los de antes; se repiten por convención).
REVOKE ALL ON FUNCTION public.autopay_create_subscription(uuid, uuid, uuid, uuid, uuid, numeric, uuid, boolean, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_plan_cycles(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_claim_due(int, int, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_update_subscription(uuid, uuid, numeric, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.autopay_create_subscription(uuid, uuid, uuid, uuid, uuid, numeric, uuid, boolean, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.autopay_plan_cycles(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.autopay_claim_due(int, int, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.autopay_update_subscription(uuid, uuid, numeric, uuid, date) TO service_role;

COMMIT;
