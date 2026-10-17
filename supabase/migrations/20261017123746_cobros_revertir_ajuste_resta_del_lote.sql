-- =============================================================================
-- 20261017123746_cobros_revertir_ajuste_resta_del_lote.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-17   Versión anterior: 20261015171131
-- Objetivo: «Quitar descuento» (revert_payment_adjustment) dejaba el total del
--   lote intacto: charge_batches.discount_total / late_fee_waived_total no bajaban
--   y «Operaciones» mostraba «Descuentos −$4.000» con solo $2.000 vigentes.
--   1) La RPC ahora resta del lote el ajuste que revierte.
--   2) Corrige los lotes ya afectados (una sola vez: resta lo ya revertido).
-- Sin cambio de firma ni de permisos (solo service_role ejecuta).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.revert_payment_adjustment(
    p_school_id uuid, p_actor uuid, p_adjustment_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    a        public.payment_adjustments;
    r        public.payments;
    v_role   text;
    v_reason text := btrim(COALESCE(p_reason, ''));
    v_new    numeric;
    v_status text;
    v_seq    integer;
    v_rev    uuid;
BEGIN
    v_role := public._actor_rol_finanzas(p_school_id, p_actor);
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN: el usuario no administra esta escuela' USING ERRCODE = '42501';
    END IF;
    IF length(v_reason) < 3 OR length(v_reason) > 300 THEN
        RAISE EXCEPTION 'MOTIVO_REQUERIDO: el motivo tiene 3 a 300 caracteres' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO a FROM public.payment_adjustments
     WHERE id = p_adjustment_id AND school_id = p_school_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: ajuste % no existe en esta escuela', p_adjustment_id USING ERRCODE = 'P0001';
    END IF;
    IF a.kind = 'reversion' OR a.origin <> 'modal' OR a.applies_to <> 'monto' THEN
        -- Los automáticos (militar, hermanos, alta, pronto pago) son tarifa o
        -- pasarela: se cambian en su origen, no aquí.
        RAISE EXCEPTION 'AJUSTE_NO_REVERSIBLE: solo se quitan ajustes hechos en «Cobros y pagos»' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO r FROM public.payments WHERE id = a.payment_id FOR UPDATE;

    -- Con el cobro bloqueado: un ajuste se revierte una sola vez.
    IF EXISTS (SELECT 1 FROM public.payment_adjustments x WHERE x.reverts_id = a.id) THEN
        RAISE EXCEPTION 'YA_REVERTIDO: este ajuste ya se quitó' USING ERRCODE = 'P0001';
    END IF;
    IF r.payment_category = 'excedente' AND v_role NOT IN ('owner', 'platform_admin') THEN
        RAISE EXCEPTION 'FORBIDDEN: solo el dueño ajusta un cobro de horas de más' USING ERRCODE = '42501';
    END IF;
    IF r.status = 'awaiting_approval'
       OR EXISTS (SELECT 1 FROM public.payment_installments i
                   WHERE i.payment_id = r.id AND i.status = 'pending_review') THEN
        RAISE EXCEPTION 'EN_REVISION: el cobro tiene un comprobante en revisión' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.payment_links l
                WHERE l.payment_id = r.id AND l.status = 'pending' AND l.expires_at > now()) THEN
        RAISE EXCEPTION 'PAGO_EN_CURSO: la familia tiene un pago en curso' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(max(x.sequence), 0) + 1 INTO v_seq
      FROM public.payment_adjustments x WHERE x.payment_id = r.id;
    v_new := r.amount + a.amount;

    IF a.kind = 'exoneracion' THEN
        IF r.status = 'cancelled' THEN
            RAISE EXCEPTION 'AJUSTE_NO_REVERSIBLE: un cobro único exonerado se anuló; crea uno nuevo' USING ERRCODE = 'P0001';
        END IF;
        IF NOT (r.status = 'paid' AND r.payment_channel = 'exoneracion' AND COALESCE(r.amount_paid, 0) = 0) THEN
            RAISE EXCEPTION 'COBRO_CERRADO: el cobro ya no es una beca sin pagos' USING ERRCODE = 'P0001';
        END IF;
        v_status := 'pending';
        UPDATE public.payments
           SET amount          = v_new,
               discount_amount = discount_amount - a.amount,
               status          = 'pending',
               amount_paid     = NULL,
               payment_method  = NULL,
               payment_channel = 'manual',
               payment_date    = NULL,
               approved_by     = NULL,
               approved_at     = NULL,
               updated_at      = now()
         WHERE id = r.id;
    ELSE
        IF r.status NOT IN ('pending', 'overdue', 'partial', 'rejected', 'failed') THEN
            RAISE EXCEPTION 'COBRO_CERRADO: el cobro está %; un cobro pagado es definitivo', r.status USING ERRCODE = 'P0001';
        END IF;
        v_status := r.status;
        IF a.kind = 'descuento' THEN
            UPDATE public.payments
               SET amount = v_new, discount_amount = discount_amount - a.amount, updated_at = now()
             WHERE id = r.id;
        ELSE  -- condonacion_recargo
            UPDATE public.payments
               SET amount = v_new,
                   late_fee_amount = late_fee_amount + a.amount,
                   late_fee_waived_amount = late_fee_waived_amount - a.amount,
                   updated_at = now()
             WHERE id = r.id;
        END IF;
    END IF;

    INSERT INTO public.payment_adjustments (
        school_id, payment_id, charge_batch_id, kind, origin, applies_to, sequence,
        basis, pct, amount, scope, context, reason_code, reason_text,
        amount_before, amount_after, amount_paid_at, reverts_id, created_by)
    VALUES (
        r.school_id, r.id, NULL, 'reversion', a.origin, a.applies_to, v_seq,
        NULL, NULL, a.amount, a.scope, 'sobre_pendiente', a.reason_code, v_reason,
        r.amount, v_new, COALESCE(r.amount_paid, 0), a.id, p_actor)
    RETURNING id INTO v_rev;

    -- Hallazgo 2026-10-17: el total del lote (charge_batches) se guardaba al crear y
    -- nunca bajaba al quitar un descuento/condonación: la tarjeta de «Operaciones»
    -- seguía mostrando el valor viejo. La exoneración se cuenta aparte
    -- (preview: exonerated), no en discount_total.
    IF a.charge_batch_id IS NOT NULL THEN
        IF a.kind = 'descuento' THEN
            UPDATE public.charge_batches
               SET discount_total = GREATEST(0, discount_total - a.amount)
             WHERE id = a.charge_batch_id;
        ELSIF a.kind = 'condonacion_recargo' THEN
            UPDATE public.charge_batches
               SET late_fee_waived_total = GREATEST(0, late_fee_waived_total - a.amount)
             WHERE id = a.charge_batch_id;
        END IF;
    END IF;

    INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)
    VALUES (p_school_id, p_actor, 'payment_adjustments', a.id::text, 'payment_adjustment_reverted',
            jsonb_build_object('amount', r.amount, 'status', r.status),
            jsonb_build_object('amount', v_new, 'status', v_status, 'reversion_id', v_rev, 'reason', v_reason));

    RETURN jsonb_build_object('payment_id', r.id, 'reverted_id', a.id, 'reversion_id', v_rev,
                              'amount_before', r.amount, 'amount_after', v_new, 'status', v_status);
END;
$function$;

REVOKE ALL ON FUNCTION public.revert_payment_adjustment(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revert_payment_adjustment(uuid, uuid, uuid, text) TO service_role;

-- Corrección de lotes existentes: cada reversión pasada nunca restó del lote.
WITH rev AS (
    SELECT a.charge_batch_id AS batch_id,
           sum(a.amount) FILTER (WHERE a.kind = 'descuento')            AS desc_rev,
           sum(a.amount) FILTER (WHERE a.kind = 'condonacion_recargo')  AS waived_rev
      FROM public.payment_adjustments r
      JOIN public.payment_adjustments a ON a.id = r.reverts_id
     WHERE r.kind = 'reversion' AND a.charge_batch_id IS NOT NULL
     GROUP BY a.charge_batch_id
)
UPDATE public.charge_batches b
   SET discount_total        = GREATEST(0, b.discount_total - COALESCE(rev.desc_rev, 0)),
       late_fee_waived_total = GREATEST(0, b.late_fee_waived_total - COALESCE(rev.waived_rev, 0))
  FROM rev
 WHERE rev.batch_id = b.id;

COMMIT;
