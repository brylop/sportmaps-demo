-- ============================================================
-- SPORTMAPS — Comprobantes v2, Fase 5: auto-aprobación + estado de conciliación
-- Spec: docs/specs/receipt-extraction-v2-glosas.md §3, §4
-- ------------------------------------------------------------
-- Un comprobante VERDE confirmado por doble extracción (server-authoritative en el
-- BFF), en una escuela con auto_approve_enabled y monto ≤ tope, se aprueba solo.
--
-- Modelado (decisión cerrada): el estado "pendiente de conciliación bancaria" es una
-- COLUMNA reconciliation_status, NO un valor nuevo de payments.status. status sigue
-- 'paid' al aprobar → toda la contabilidad (cash_ledger, trigger fee→gasto, analytics,
-- reports, qr paid_count) sigue funcionando sin tocar ~15 sitios.
-- Fecha: 2026-07-21
-- ============================================================

-- ── Columna de conciliación ────────────────────────────────────────────────
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS reconciliation_status text
        CHECK (reconciliation_status IN ('pendiente', 'confirmado', 'no_aparece'));

COMMENT ON COLUMN public.payments.reconciliation_status IS
    'Estado de conciliación bancaria de un pago aprobado. NULL = no aplica (pasarela o pre-F5). pendiente = aprobado, falta cruzar extracto (Fase 6). confirmado = cruzó. no_aparece = no cruzó, se abre glosa.';

CREATE INDEX IF NOT EXISTS idx_payments_reconciliation_pending
    ON public.payments (school_id)
    WHERE reconciliation_status = 'pendiente';

-- ── Origen del hash a texto libre (admite 'server_verified') ────────────────
-- El CHECK de receipt_image_sha256_source (F2) sólo admitía client_original|server_base64.
-- El evaluador server-authoritative recomputa el hash sobre los bytes reales y setea
-- 'server_verified'. Como es columna diagnóstica, se deja como texto libre (drop robusto).
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.payments'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%receipt_image_sha256_source%'
    LOOP
        EXECUTE format('ALTER TABLE public.payments DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

-- ── RPC de auto-aprobación (solo el BFF, service_role) ─────────────────────
-- Idempotente: actúa SOLO si el pago sigue en awaiting_approval (evita doble
-- aprobación y carrera con el admin). Paridad con la aprobación manual/glosa:
-- status='paid' + approved_at + amount_paid + activa enrollment. approved_by=NULL
-- marca "aprobado por el sistema". reconciliation_status='pendiente' para Fase 6.
CREATE OR REPLACE FUNCTION public.auto_approve_payment(p_payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_status    text;
    v_parent_id uuid;
    v_child_id  uuid;
    v_team_id   uuid;
    v_amount    numeric;
    v_discount  numeric;
BEGIN
    SELECT school_id, status, parent_id, child_id, team_id, amount,
           COALESCE(early_payment_discount_applied, 0)
    INTO v_school_id, v_status, v_parent_id, v_child_id, v_team_id, v_amount, v_discount
    FROM public.payments WHERE id = p_payment_id;

    IF v_school_id IS NULL THEN RETURN false; END IF;
    IF v_status <> 'awaiting_approval' THEN RETURN false; END IF;  -- idempotente / no pisa al admin

    UPDATE public.payments
    SET status = 'paid',
        approved_by = NULL,                       -- sistema
        approved_at = now(),
        amount_paid = v_amount - v_discount,
        reconciliation_status = 'pendiente',
        updated_at = now()
    WHERE id = p_payment_id AND status = 'awaiting_approval';

    UPDATE public.enrollments
    SET status = 'active', updated_at = now()
    WHERE school_id = v_school_id
      AND status = 'pending'
      AND (
            (v_child_id IS NOT NULL AND child_id = v_child_id)
         OR (v_child_id IS NULL AND v_parent_id IS NOT NULL AND user_id = v_parent_id)
      )
      AND (v_team_id IS NULL OR team_id = v_team_id);

    IF v_parent_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
        VALUES (v_parent_id, v_school_id, 'Pago aprobado',
                'Validamos tu comprobante automáticamente y tu pago quedó aprobado. ¡Gracias!',
                'success', '/my-payments');
    END IF;

    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.auto_approve_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_approve_payment(uuid) TO service_role;

-- ── resolve_glosa: ACEPTADA también marca pendiente de conciliación ─────────
-- (spec §4: "auto-aprobado O aprobado manual queda pendiente de conciliación").
-- Redefinición idéntica a 20260717000003 + reconciliation_status='pendiente' en ACEPTADA.
CREATE OR REPLACE FUNCTION public.resolve_glosa(
    p_actor           uuid,
    p_glosa_id        uuid,
    p_outcome         text,
    p_resolution_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id  uuid;
    v_status     text;
    v_payment_id uuid;
    v_parent_id  uuid;
    v_child_id   uuid;
    v_team_id    uuid;
    v_amount     numeric;
    v_discount   numeric;
BEGIN
    IF p_outcome NOT IN ('ACEPTADA', 'RATIFICADA') THEN
        RAISE EXCEPTION 'Resultado inválido: %', p_outcome USING ERRCODE = '22023';
    END IF;
    IF p_resolution_note IS NULL OR btrim(p_resolution_note) = '' THEN
        RAISE EXCEPTION 'La nota de resolución es obligatoria' USING ERRCODE = '22023';
    END IF;

    SELECT g.school_id, g.status, g.payment_id
    INTO v_school_id, v_status, v_payment_id
    FROM public.payment_glosas g WHERE g.id = p_glosa_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Glosa no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT public._glosa_actor_is_admin(p_actor, v_school_id) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_status NOT IN ('GLOSADA', 'EN_RESPUESTA', 'EN_CONCILIACION') THEN
        RAISE EXCEPTION 'La glosa ya está resuelta (%)', v_status USING ERRCODE = '22023';
    END IF;

    UPDATE public.payment_glosas
    SET status = p_outcome, resolution_note = p_resolution_note,
        resolved_at = now(), resolved_by = p_actor, updated_at = now()
    WHERE id = p_glosa_id;

    SELECT parent_id, child_id, team_id, amount, COALESCE(early_payment_discount_applied, 0)
    INTO v_parent_id, v_child_id, v_team_id, v_amount, v_discount
    FROM public.payments WHERE id = v_payment_id;

    IF p_outcome = 'ACEPTADA' THEN
        UPDATE public.payments
        SET status = 'paid',
            approved_by = p_actor,
            approved_at = now(),
            amount_paid = v_amount - v_discount,
            reconciliation_status = 'pendiente',
            updated_at = now()
        WHERE id = v_payment_id;

        UPDATE public.enrollments
        SET status = 'active', updated_at = now()
        WHERE school_id = v_school_id
          AND status = 'pending'
          AND (
                (v_child_id IS NOT NULL AND child_id = v_child_id)
             OR (v_child_id IS NULL AND v_parent_id IS NOT NULL AND user_id = v_parent_id)
          )
          AND (v_team_id IS NULL OR team_id = v_team_id);

        PERFORM public._glosa_notify(
            v_parent_id, v_school_id,
            'Pago aprobado',
            'Revisamos tu aclaración y tu pago quedó aprobado. ¡Gracias!',
            '/my-payments'
        );
    ELSE
        UPDATE public.payments
        SET status = 'pending', updated_at = now()
        WHERE id = v_payment_id;

        PERFORM public._glosa_notify(
            v_parent_id, v_school_id,
            'Tu pago sigue pendiente',
            'Revisamos tu aclaración pero el pago sigue pendiente. Comunícate con la escuela para regularizarlo.',
            '/my-payments'
        );
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_glosa(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_glosa(uuid, uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
