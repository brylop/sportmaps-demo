-- =============================================================================
-- 20261002125957_guard_payments_escritura_cliente.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-02   Versión anterior: 20261002125955
-- Objetivo: A1 de docs/auditoria-contabilidad-tienda-2026-10-02.md. Un padre o
--   atleta podía insertar un pago ya 'paid', con el monto que quisiera, o pasar
--   a 'paid' un cobro suyo: las policies de INSERT/UPDATE solo exigen
--   parent_id/user_id = auth.uid() y ningún trigger protegía status ni amount.
--   'paid' extiende la vigencia (trg_extend_enrollment_on_payment_paid), abre el
--   torniquete (trg_sync_access_group_on_payment) y suma en cash_ledger.
--   Además dos veces (30-sep, 01-oct) un padre revirtió un pago aprobado a
--   'awaiting_approval' (cobro 3490fed0…).
--
--   Este trigger congela, para quien NO es staff de la escuela y escribe directo
--   por PostgREST, todo lo que es dinero o estado. Deja pasar el envío de
--   comprobante (→ awaiting_approval) tal como lo hace hoy el frontend.
--   Spec: docs/specs/blindaje-dinero-pagos-tienda-nomina.md §1.2.
--
--   Por qué así:
--   · Solo actúa si current_user IN ('authenticated','anon'). Las 35 RPC que
--     escriben payments son SECURITY DEFINER de postgres y el BFF usa
--     service_role: ninguna pasa por el guard.
--   · La función es SECURITY INVOKER a propósito. Si fuera DEFINER, current_user
--     sería siempre postgres y no protegería nada.
--   · Staff = user_staff_school_ids() (incluye schools.owner_id). NO
--     staff_school_ids(), que deja por fuera a los owners.
--   · Se compara con IS DISTINCT FROM: reescribir el mismo valor no falla.
--   · Nombre trg_zz_…: los BEFORE corren en orden alfabético; este va último y
--     ve el NEW final (después de clear_payment_review_on_settle y fill_period).
--
--   ⚠️ Desplegar ANTES el frontend que deja de escribir 'paid' (ParentCheckoutPage
--   en Wompi). Si no, el padre que paga en línea ve un error aunque el webhook
--   sí registre el pago.
--   Residual conocido (F2): el monto del INSERT lo sigue mandando el cliente (A2),
--   y un coach cuenta como staff (user_staff_school_ids lo incluye).
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

CREATE OR REPLACE FUNCTION public.fn_guard_payments_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_open_states text[] := ARRAY['pending','overdue','partial','rejected','failed','awaiting_approval'];
    v_col text;
BEGIN
    -- RPC SECURITY DEFINER (postgres), BFF (service_role), SQL editor: no aplica.
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    -- Staff de la escuela del cobro: opera como hoy.
    IF NEW.school_id IS NOT NULL
       AND NEW.school_id = ANY (public.user_staff_school_ids())
       AND (TG_OP = 'INSERT' OR OLD.school_id IS NOT DISTINCT FROM NEW.school_id) THEN
        RETURN NEW;
    END IF;

    -- ── INSERT ───────────────────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN
        -- Solo en una escuela de la que es miembro activo (padre/atleta) o donde
        -- tiene un hijo. La policy solo exige parent_id = auth.uid(), así que sin
        -- esto un padre de otra escuela podía crear cobros aquí. Radio medido:
        -- los 103 INSERT no-staff de los últimos 60 días cumplen.
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
        END;
        IF v_col IS NOT NULL THEN
            RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: %', v_col USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    -- ── UPDATE ───────────────────────────────────────────────────────────────
    -- Un cobro cerrado no se reabre desde el navegador.
    -- Sin updated_at: trg_updated_at corre antes (orden alfabético) y lo cambia
    -- siempre, así que una reescritura idéntica igual se vería "distinta".
    IF OLD.status IN ('paid', 'glosado', 'cancelled')
       AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: status (cobro %)', OLD.status USING ERRCODE = '42501';
    END IF;

    -- La única transición permitida es enviar un comprobante.
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
        -- Período: el modal lo estampa al reusar un cobro que no lo tenía.
        WHEN OLD.period_year  IS NOT NULL AND NEW.period_year  IS DISTINCT FROM OLD.period_year  THEN 'period_year'
        WHEN OLD.period_month IS NOT NULL AND NEW.period_month IS DISTINCT FROM OLD.period_month THEN 'period_month'
        -- Fecha del comprobante y descuento por pronto pago: solo al enviar un
        -- comprobante, que la escuela revisa antes de aprobar.
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
$fn$;

COMMENT ON FUNCTION public.fn_guard_payments_client() IS
  'Congela dinero y estado de payments para escrituras directas (PostgREST) de quien no es staff de la escuela. SECURITY INVOKER a propósito. Spec blindaje-dinero §1.2.';

-- Es función de trigger: nadie la invoca directo.
REVOKE ALL ON FUNCTION public.fn_guard_payments_client() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_zz_guard_payments_client ON public.payments;
CREATE TRIGGER trg_zz_guard_payments_client
    BEFORE INSERT OR UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_payments_client();

COMMIT;
