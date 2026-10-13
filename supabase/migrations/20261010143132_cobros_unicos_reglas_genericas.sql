-- =============================================================================
-- 20261010143132_cobros_unicos_reglas_genericas.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010130733
-- Objetivo: F0 «reglas comunes de cobros únicos» (docs/specs/pagos-unicos-por-plan.md
-- §12 F0 ≡ docs/specs/cobros-multiples.md §2.1, I24, I25). Un cobro es
-- MENSUALIDAD si y solo si COALESCE(payment_category,'mensualidad') = 'mensualidad'.
-- Todo lo demás (inscripcion, seguro, excedente, articulos, torneo, clase_extra,
-- vacacional, viaje, otro y cualquier categoría futura) es cobro único y:
--   · nunca pasa a 'overdue',
--   · nunca recibe recargo por mora,
--   · nunca mueve al atleta de grupo en el torniquete.
--
-- Por qué: 20261010130733 excluyó SOLO ('inscripcion','seguro') —lista negra—.
-- Un torneo, un artículo o un viaje vencido seguía pasando a 'overdue' con 5 %
-- de recargo y, por ser 'overdue', lo leían el torniquete, el auto-bloqueo y el
-- control de acceso. Se cambia a lista blanca: solo la mensualidad entra en mora.
-- Una categoría nueva queda fuera de la mora sin tocar estas funciones.
-- payment_category NULL (filas viejas, 4.138 hoy) sigue contando como
-- mensualidad: igual que antes (COALESCE(..,'') NOT IN (...) también las tomaba).
--
-- Cómo: CREATE OR REPLACE copiando el cuerpo VIVO al 2026-10-10 14:31
-- (pg_get_functiondef) y cambiando solo el filtro, marcado «(20261010143132)».
--   1. apply_late_fees              — las dos pasadas (rechazados reabiertos y pendientes/parciales).
--   2. fn_expire_overdue_payments
--   3. _mark_overdue_payments_impl
--   4. fn_sync_access_group_on_payment (trigger trg_sync_access_group_on_payment,
--      AFTER UPDATE OF status): sale sin hacer nada si el cobro no es mensualidad.
--      Ni bloquea (→ overdue) ni desbloquea (overdue → paid).
-- CREATE OR REPLACE conserva los privilegios vivos (postgres + service_role,
-- sin authenticated ni anon); se reafirman abajo por si acaso.
--
-- Radio (medido 2026-10-10, solo lectura, toda la base compartida):
--   Cobros abiertos NO mensualidad (pending/partial/overdue/rejected/awaiting_approval):
--     inscripcion  pending            2  (sin vencer, sin recargo)
--     seguro       pending            2  (sin vencer, sin recargo)
--     articulos    awaiting_approval  1  (Club Campestre Demo; el barrido no toca awaiting_approval)
--     torneo       overdue            1  (Club Campestre Demo, a4ebb93b-a8e3-451b-8174-da7dc945cf23,
--                                         «Torneos: INCRIPCION COMPETENCIA VALLEDUPAR», vence 2026-09-14,
--                                         recargo 17.050 aplicado 2026-09-20; monto 341.000 → 358.050;
--                                         el atleta no tiene PIN de torniquete).
--   Ningún 'rejected' no-mensualidad (no hay reapertura que cambie).
--   Efecto en el próximo barrido: 0 filas cambian de estado. Ningún cobro único
--   pendiente está vencido hoy.
--   ESTA MIGRACIÓN NO CORRIGE DATOS: el torneo 'overdue' con recargo queda como
--   está. Si se quiere revertir, es decisión del usuario (volver a 'pending',
--   amount -= late_fee_amount, late_fee_amount = 0, late_fee_applied_at = NULL).
--   Histórico: 1 torneo con recargo (el mismo); 'otro' 1 cobro cerrado sin recargo.
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
       -- (20261010143132) solo la mensualidad se vence; todo cobro único queda fuera.
       AND COALESCE(p.payment_category, 'mensualidad') = 'mensualidad'
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
    -- (20261010143132) solo la mensualidad se vence; todo cobro único queda fuera.
    AND COALESCE(payment_category, 'mensualidad') = 'mensualidad'
    AND due_date < v_threshold;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- ── 4. fn_sync_access_group_on_payment (trigger del torniquete) ─────────────
CREATE OR REPLACE FUNCTION public.fn_sync_access_group_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_zk_pin INTEGER;
  v_target_group INTEGER;
  v_device RECORD;
BEGIN
  -- (20261010143132) el acceso solo lo mueve la mensualidad. Un cobro único
  -- (torneo, artículo, inscripción…) ni bloquea ni desbloquea.
  IF COALESCE(NEW.payment_category, 'mensualidad') <> 'mensualidad' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'overdue' AND (OLD.status IS DISTINCT FROM 'overdue') THEN
    v_target_group := 2;
  ELSIF OLD.status = 'overdue' AND NEW.status = 'paid' THEN
    v_target_group := 1;
  ELSE
    RETURN NEW;
  END IF;

  SELECT zk_pin INTO v_zk_pin
  FROM zk_user_mappings
  WHERE school_id = NEW.school_id
    AND (
      (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
      OR (NEW.unregistered_athlete_id IS NOT NULL AND unregistered_athlete_id = NEW.unregistered_athlete_id)
    )
  LIMIT 1;

  IF v_zk_pin IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_device IN
    SELECT id, direction FROM turnstile_devices
    WHERE school_id = NEW.school_id AND is_active = true
  LOOP
    INSERT INTO device_commands (school_id, device_id, command_type, direction, status, expires_at, metadata)
    VALUES (
      NEW.school_id, v_device.id, 'set_group',
      CASE WHEN v_device.direction = 'both' THEN 'entry' ELSE v_device.direction END,
      'pending', NOW() + interval '24 hours',
      jsonb_build_object('pin', v_zk_pin, 'group', v_target_group)
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ── 5. Privilegios: iguales a lo vivo (postgres + service_role) ─────────────
-- Los default privileges del esquema dan EXECUTE a authenticated/anon en
-- funciones NUEVAS; CREATE OR REPLACE conserva el ACL, pero se reafirma.
REVOKE ALL ON FUNCTION public.apply_late_fees()                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_expire_overdue_payments()         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._mark_overdue_payments_impl(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sync_access_group_on_payment()    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_late_fees()                 TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_expire_overdue_payments()      TO service_role;
GRANT EXECUTE ON FUNCTION public._mark_overdue_payments_impl(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_sync_access_group_on_payment() TO service_role;

COMMIT;

-- Verificación (solo lectura, después de aplicar):
--   select proname, proacl from pg_proc where proname in ('apply_late_fees',
--     'fn_expire_overdue_payments','_mark_overdue_payments_impl','fn_sync_access_group_on_payment');
--   select proname from pg_proc where prosrc like '%''inscripcion'', ''seguro''%'
--     and proname in ('apply_late_fees','fn_expire_overdue_payments','_mark_overdue_payments_impl');  -- 0 filas
