-- =============================================================================
-- 20261010144558_cobros_f1_guardia_y_notificaciones.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010144557
-- Objetivo: F1 de «Cobros y pagos» (spec cobros-multiples §8.2, §8.3, §12 M7).
--   1. fn_guard_payments_client (trg_zz_guard_payments_client): CREATE OR REPLACE
--      desde el cuerpo VIVO (pg_get_functiondef, 2026-10-10 14:4x). Cambios,
--      marcados «(cobros F1)»:
--      a) Para TODO cliente del navegador (authenticated/anon), staff incluido:
--         charge_batch_id, discount_amount, late_fee_waived_amount y list_amount
--         solo los escriben las RPC. INSERT: charge_batch_id ≠ NULL,
--         discount_amount ≠ 0, late_fee_waived_amount ≠ 0 o list_amount ≠ NULL →
--         PAYMENT_FIELD_LOCKED. UPDATE: cambiar cualquiera de los cuatro →
--         PAYMENT_FIELD_LOCKED. (§8.2: staff navegador no escribe charge_batch_id
--         ni columnas de ajuste.)
--      b) No-staff (acudiente/atleta): created_by y notes a la lista negra de
--         INSERT y UPDATE; sibling_discount_applied a la de INSERT (ya estaba en la
--         de UPDATE). one_time_fee_id NO se agrega: la columna no existe todavía
--         (F4 / pagos-únicos F1 deben sumarla a esta guardia).
--         sibling_discount_applied en INSERT es un agregado al spec: desde M4 ese
--         valor se convierte en un ajuste «hermanos»; un acudiente no debe poder
--         declarárselo (D13). Escritores desde el navegador: 0 (grep).
--      La guardia sigue siendo SECURITY INVOKER (como la viva).
--   2. fn_notify_on_payment_created: CREATE OR REPLACE desde el cuerpo vivo +
--      salida temprana si app.charge_batch_id está puesto (local a la transacción
--      de create_charge_batch): el lote no notifica por fila (§8.3).
--   3. Push y entrega externa respetan notifications.push = false: se recrean los
--      triggers trg_push_on_notification y trg_enqueue_notification_delivery con
--      WHEN (NEW.push IS DISTINCT FROM false). NO se reescriben las funciones:
--      fn_trigger_push_on_notification lleva un secreto embebido en su cuerpo vivo
--      y copiarlo a una migración lo dejaría en git. Mismo efecto, cero cambio en
--      los cuerpos.
--
-- Radio (base viva, 2026-10-10, solo lectura):
--   · Escritores desde el navegador de las columnas bloqueadas en (1a): 0
--     (grep charge_batch_id|discount_amount|late_fee_waived_amount|list_amount en
--     frontend/src = 0; son columnas nuevas salvo list_amount, que nadie escribe).
--   · created_by / notes: columnas nuevas, 0 escritores.
--   · Notificaciones: todas las 5.640 existentes y todas las que se creen sin
--     indicar push quedan push = true → mismo comportamiento que hoy. Solo las
--     RPC de M9 insertan push = false.
--   · fn_notify_on_payment_created: 484 notificaciones en 30 días; ninguna sale de
--     una transacción con app.charge_batch_id (no existía) → 0 cambios.
--   · Policies de payments (pg_policies, trampa #1): sin cambios; esta migración
--     no toca policies.
-- =============================================================================

BEGIN;

-- ── 1. Guardia de escritura desde el navegador ──────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_guard_payments_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_open_states text[] := ARRAY['pending','overdue','partial','rejected','failed','awaiting_approval'];
    v_col text;
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    -- (cobros F1) Columnas que solo escriben las RPC de «Cobros y pagos», para
    -- TODO cliente del navegador (staff incluido).
    IF TG_OP = 'INSERT' THEN
        v_col := CASE
            WHEN NEW.charge_batch_id IS NOT NULL               THEN 'charge_batch_id'
            WHEN COALESCE(NEW.discount_amount, 0) <> 0         THEN 'discount_amount'
            WHEN COALESCE(NEW.late_fee_waived_amount, 0) <> 0  THEN 'late_fee_waived_amount'
            WHEN NEW.list_amount IS NOT NULL                   THEN 'list_amount'
        END;
    ELSE
        v_col := CASE
            WHEN NEW.charge_batch_id        IS DISTINCT FROM OLD.charge_batch_id        THEN 'charge_batch_id'
            WHEN NEW.discount_amount        IS DISTINCT FROM OLD.discount_amount        THEN 'discount_amount'
            WHEN NEW.late_fee_waived_amount IS DISTINCT FROM OLD.late_fee_waived_amount THEN 'late_fee_waived_amount'
            WHEN NEW.list_amount            IS DISTINCT FROM OLD.list_amount            THEN 'list_amount'
        END;
    END IF;
    IF v_col IS NOT NULL THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: %', v_col USING ERRCODE = '42501',
            HINT = 'Descuentos, condonaciones y lotes solo se registran desde «Cobros y pagos».';
    END IF;

    IF NEW.school_id IS NOT NULL
       AND NEW.school_id = ANY (public.user_staff_school_ids())
       AND (TG_OP = 'INSERT' OR OLD.school_id IS NOT DISTINCT FROM NEW.school_id) THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.school_id IS NULL
           OR NOT (
                NEW.school_id = ANY (public.user_school_ids())
                OR EXISTS (SELECT 1 FROM public.children c
                            WHERE c.parent_id = auth.uid() AND c.school_id = NEW.school_id)
           ) THEN
            RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: school_id' USING ERRCODE = '42501',
                HINT = 'Solo puedes registrar pagos en una escuela de la que eres miembro.';
        END IF;
        IF NEW.status NOT IN ('pending', 'awaiting_approval') THEN
            RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: status'
                USING ERRCODE = '42501',
                      HINT = 'Solo la escuela o la pasarela marcan un pago como pagado.';
        END IF;

        v_col := CASE
            WHEN COALESCE(NEW.amount_paid, 0) <> 0      THEN 'amount_paid'
            WHEN NEW.approved_at IS NOT NULL            THEN 'approved_at'
            WHEN NEW.approved_by IS NOT NULL            THEN 'approved_by'
            WHEN COALESCE(NEW.late_fee_amount, 0) <> 0  THEN 'late_fee_amount'
            WHEN NEW.late_fee_applied_at IS NOT NULL    THEN 'late_fee_applied_at'
            WHEN NEW.gross_amount IS NOT NULL           THEN 'gross_amount'
            WHEN NEW.sportmaps_fee IS NOT NULL          THEN 'sportmaps_fee'
            WHEN NEW.epayco_fee IS NOT NULL             THEN 'epayco_fee'
            WHEN NEW.wompi_transaction_id IS NOT NULL   THEN 'wompi_transaction_id'
            WHEN NEW.provider_transaction_id IS NOT NULL THEN 'provider_transaction_id'
            WHEN NEW.cash_session_id IS NOT NULL        THEN 'cash_session_id'
            WHEN NEW.reconciliation_status IS NOT NULL  THEN 'reconciliation_status'
            WHEN NEW.unblocked_at IS NOT NULL           THEN 'unblocked_at'
            WHEN NEW.unblocked_by IS NOT NULL           THEN 'unblocked_by'
            WHEN NEW.discount_pct IS NOT NULL           THEN 'discount_pct'
            WHEN NEW.list_amount IS NOT NULL            THEN 'list_amount'
            -- (cobros F1)
            WHEN COALESCE(NEW.sibling_discount_applied, 0) <> 0 THEN 'sibling_discount_applied'
            WHEN NEW.created_by IS NOT NULL             THEN 'created_by'
            WHEN NEW.notes IS NOT NULL                  THEN 'notes'
        END;
        IF v_col IS NOT NULL THEN
            RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: %', v_col USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    IF OLD.status IN ('paid', 'glosado', 'cancelled')
       AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: status (cobro %)', OLD.status USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (NEW.status = 'awaiting_approval' AND OLD.status = ANY (v_open_states)) THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: status (% -> %)', OLD.status, NEW.status
            USING ERRCODE = '42501';
    END IF;

    v_col := CASE
        WHEN NEW.amount                   IS DISTINCT FROM OLD.amount                   THEN 'amount'
        WHEN NEW.amount_paid              IS DISTINCT FROM OLD.amount_paid              THEN 'amount_paid'
        WHEN NEW.school_id                IS DISTINCT FROM OLD.school_id                THEN 'school_id'
        WHEN NEW.branch_id                IS DISTINCT FROM OLD.branch_id                THEN 'branch_id'
        WHEN NEW.offering_plan_id         IS DISTINCT FROM OLD.offering_plan_id         THEN 'offering_plan_id'
        WHEN NEW.team_id                  IS DISTINCT FROM OLD.team_id                  THEN 'team_id'
        WHEN NEW.child_id                 IS DISTINCT FROM OLD.child_id                 THEN 'child_id'
        WHEN NEW.parent_id                IS DISTINCT FROM OLD.parent_id                THEN 'parent_id'
        WHEN NEW.user_id                  IS DISTINCT FROM OLD.user_id                  THEN 'user_id'
        WHEN NEW.unregistered_athlete_id  IS DISTINCT FROM OLD.unregistered_athlete_id  THEN 'unregistered_athlete_id'
        WHEN NEW.coach_id                 IS DISTINCT FROM OLD.coach_id                 THEN 'coach_id'
        WHEN NEW.late_fee_amount          IS DISTINCT FROM OLD.late_fee_amount          THEN 'late_fee_amount'
        WHEN NEW.late_fee_applied_at      IS DISTINCT FROM OLD.late_fee_applied_at      THEN 'late_fee_applied_at'
        WHEN NEW.approved_at              IS DISTINCT FROM OLD.approved_at              THEN 'approved_at'
        WHEN NEW.approved_by              IS DISTINCT FROM OLD.approved_by              THEN 'approved_by'
        WHEN NEW.rejection_reason         IS DISTINCT FROM OLD.rejection_reason         THEN 'rejection_reason'
        WHEN NEW.gross_amount             IS DISTINCT FROM OLD.gross_amount             THEN 'gross_amount'
        WHEN NEW.sportmaps_fee            IS DISTINCT FROM OLD.sportmaps_fee            THEN 'sportmaps_fee'
        WHEN NEW.epayco_fee               IS DISTINCT FROM OLD.epayco_fee               THEN 'epayco_fee'
        WHEN NEW.payment_category         IS DISTINCT FROM OLD.payment_category         THEN 'payment_category'
        WHEN NEW.period_uniqueness_exempt IS DISTINCT FROM OLD.period_uniqueness_exempt THEN 'period_uniqueness_exempt'
        WHEN NEW.sibling_discount_applied IS DISTINCT FROM OLD.sibling_discount_applied THEN 'sibling_discount_applied'
        WHEN NEW.discount_pct             IS DISTINCT FROM OLD.discount_pct             THEN 'discount_pct'
        WHEN NEW.list_amount              IS DISTINCT FROM OLD.list_amount              THEN 'list_amount'
        WHEN NEW.due_date                 IS DISTINCT FROM OLD.due_date                 THEN 'due_date'
        WHEN NEW.concept                  IS DISTINCT FROM OLD.concept                  THEN 'concept'
        WHEN NEW.payment_type             IS DISTINCT FROM OLD.payment_type             THEN 'payment_type'
        WHEN NEW.provider_transaction_id  IS DISTINCT FROM OLD.provider_transaction_id  THEN 'provider_transaction_id'
        WHEN NEW.wompi_transaction_id     IS DISTINCT FROM OLD.wompi_transaction_id     THEN 'wompi_transaction_id'
        WHEN NEW.wompi_id                 IS DISTINCT FROM OLD.wompi_id                 THEN 'wompi_id'
        WHEN NEW.cash_session_id          IS DISTINCT FROM OLD.cash_session_id          THEN 'cash_session_id'
        WHEN NEW.reconciliation_status    IS DISTINCT FROM OLD.reconciliation_status    THEN 'reconciliation_status'
        WHEN NEW.requires_review          IS DISTINCT FROM OLD.requires_review          THEN 'requires_review'
        WHEN NEW.unblocked_at             IS DISTINCT FROM OLD.unblocked_at             THEN 'unblocked_at'
        WHEN NEW.unblocked_by             IS DISTINCT FROM OLD.unblocked_by             THEN 'unblocked_by'
        -- (cobros F1)
        WHEN NEW.created_by               IS DISTINCT FROM OLD.created_by               THEN 'created_by'
        WHEN NEW.notes                    IS DISTINCT FROM OLD.notes                    THEN 'notes'
        WHEN OLD.period_year  IS NOT NULL AND NEW.period_year  IS DISTINCT FROM OLD.period_year  THEN 'period_year'
        WHEN OLD.period_month IS NOT NULL AND NEW.period_month IS DISTINCT FROM OLD.period_month THEN 'period_month'
        WHEN NEW.status <> 'awaiting_approval'
             AND NEW.payment_date IS DISTINCT FROM OLD.payment_date THEN 'payment_date'
        WHEN NEW.status <> 'awaiting_approval'
             AND NEW.early_payment_discount_applied IS DISTINCT FROM OLD.early_payment_discount_applied
             THEN 'early_payment_discount_applied'
    END;
    IF v_col IS NOT NULL THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: %', v_col USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$function$;

-- Privilegios vivos: postgres + service_role (CREATE OR REPLACE los conserva).
REVOKE ALL ON FUNCTION public.fn_guard_payments_client() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_guard_payments_client() TO service_role;

-- ── 2. Notificación por fila: el lote la suprime ────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_on_payment_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id   uuid;
  v_name      text;
  v_school    text;
  v_amount    text;
BEGIN
  -- (cobros F1) Filas creadas por create_charge_batch: la RPC manda UN aviso
  -- agrupado por familia (sin push). set_config(..., true) es local a esa
  -- transacción: ningún otro camino lo ve.
  IF COALESCE(current_setting('app.charge_batch_id', true), '') <> '' THEN
    RETURN NEW;
  END IF;

  -- Guard: pagos iniciados por el propio pagador (checkout online) llegan
  -- con provider_reference seteado. Eso NO es "la escuela generó un cobro";
  -- es el acudiente pagando. No notificar (si no, cada clic en Pagar avisa).
  IF NEW.provider_reference IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolver el user_id del destinatario según tipo de atleta
  IF NEW.user_id IS NOT NULL THEN
    -- Atleta adulto con cuenta
    v_user_id := NEW.user_id;
    SELECT full_name INTO v_name FROM profiles WHERE id = NEW.user_id;

  ELSIF NEW.child_id IS NOT NULL THEN
    -- Menor → notificar al padre/acudiente si está vinculado
    SELECT parent_id INTO v_user_id FROM children WHERE id = NEW.child_id;
    SELECT full_name INTO v_name FROM children WHERE id = NEW.child_id;

  ELSE
    -- Adulto sin cuenta — no tiene user_id para notificar
    RETURN NEW;
  END IF;

  -- Si no hay destinatario, no hacer nada
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Datos del pago
  SELECT name INTO v_school FROM schools WHERE id = NEW.school_id;
  v_amount := '$' || TO_CHAR(NEW.amount, 'FM999,999,999');

  -- Insertar notificación directamente (sin RPC para evitar restricción de permisos)
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_user_id,
    '💳 Nuevo cobro pendiente',
    v_school || ' ha generado un cobro de ' || v_amount || ' para ' || COALESCE(v_name, 'tu cuenta') || '. Vence el ' || TO_CHAR(NEW.due_date, 'DD/MM/YYYY') || '.',
    'warning',
    '/my-payments'
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_notify_on_payment_created() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notify_on_payment_created() TO service_role;

-- ── 3. Push / entrega externa: respetan notifications.push = false ──────────
-- Definición viva (pg_get_triggerdef, 2026-10-10):
--   CREATE TRIGGER trg_push_on_notification AFTER INSERT ON public.notifications
--     FOR EACH ROW EXECUTE FUNCTION fn_trigger_push_on_notification()
--   CREATE TRIGGER trg_enqueue_notification_delivery AFTER INSERT ON public.notifications
--     FOR EACH ROW EXECUTE FUNCTION enqueue_notification_delivery()
-- Solo se agrega el WHEN; las funciones no cambian.
DROP TRIGGER IF EXISTS trg_push_on_notification ON public.notifications;
CREATE TRIGGER trg_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    WHEN (NEW.push IS DISTINCT FROM false)
    EXECUTE FUNCTION public.fn_trigger_push_on_notification();

DROP TRIGGER IF EXISTS trg_enqueue_notification_delivery ON public.notifications;
CREATE TRIGGER trg_enqueue_notification_delivery
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    WHEN (NEW.push IS DISTINCT FROM false)
    EXECUTE FUNCTION public.enqueue_notification_delivery();

COMMIT;
