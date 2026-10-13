-- =============================================================================
-- 20261010144554_cobros_f1_payment_adjustments.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010144552
-- Objetivo: F1 de «Cobros y pagos» (spec cobros-multiples §6.5, §8.1b, §12 M3).
--   Tabla public.payment_adjustments (solo inserción): un evento por descuento,
--   condonación de recargo, exoneración o reversión, con su origen (D16), orden
--   (sequence), quién, cuándo, antes y después. payments.discount_amount y
--   payments.late_fee_waived_amount son su caché (la escriben las mismas RPC en la
--   misma transacción).
--   + trigger de coherencia de school_id (= el del cobro).
--   + trigger que prohíbe UPDATE (corregir = insertar 'reversion').
--   + RLS padj_select_finance.
--   + vista v_payment_adjustments_familia (columnas publicables para la familia).
--
-- DESVÍO DEL SPEC (documentado en «Contrato final F1»):
--   · La vista NO es security_invoker. Con security_invoker la familia leería
--     payment_adjustments con su propio rol y la RLS (solo finanzas) le devolvería
--     0 filas; crear padj_select_family para que funcione le dejaría pedir la
--     tabla base con created_by y reason_text (RLS filtra filas, no columnas:
--     trampa #4 de CLAUDE.md). Se sigue el patrón vivo de v_school_staff_publico /
--     v_school_settings_publico: vista con dueño postgres, security_barrier, que
--     filtra por auth.uid() (pagador del cobro, atleta adulto o acudiente del
--     menor) y expone solo tipo, origen, motivo humanizado, monto y fecha.
--     No se crea la policy padj_select_family.
--   · CHECK de charge_batch_id: el spec pide «NULL solo en context alta/backfill»,
--     pero los ajustes automáticos de open_month (hermanos, context 'al_crear') y
--     el pronto pago al aprobar (context 'al_pagar') nacen fuera de un lote, y la
--     reversión (revert_payment_adjustment) no tiene lote. La regla queda:
--     origin <> 'modal' OR kind = 'reversion' OR charge_batch_id IS NOT NULL.
--   · Motivo del militar: el catálogo de reason_code no tiene 'militar'; el
--     trigger de M4 lo registra con reason_code 'convenio' + reason_text
--     'Descuento Fuerza Militar' (origin = 'militar' es lo que lo distingue).
--
-- Radio (base viva, 2026-10-10, solo lectura): la tabla no existe; 0 filas.
--   El backfill de los 5 cobros con descuento automático va en M5.
--
-- RLS (§8.1b, línea por línea):
--   padj_select_finance  SELECT  authenticated
--     USING (school_id = ANY ((SELECT public.finance_read_school_ids())::uuid[]))
--   INSERT / UPDATE / DELETE: sin policy (solo RPC/trigger SECURITY DEFINER).
--   Vista v_payment_adjustments_familia: SELECT a authenticated, nada a anon.
--   Invariantes: I1 (sin anon), I2/I3 no aplican, I4 (funciones con search_path).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_adjustments (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    payment_id       uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    charge_batch_id  uuid NULL REFERENCES public.charge_batches(id),
    kind             text NOT NULL,
    origin           text NOT NULL,
    applies_to       text NOT NULL DEFAULT 'monto',
    sequence         smallint NOT NULL,
    basis            text NULL,
    pct              numeric(5,2) NULL,
    amount           numeric(12,2) NOT NULL,
    scope            text NOT NULL DEFAULT 'linea',
    context          text NOT NULL,
    reason_code      text NOT NULL,
    reason_text      text NULL,
    amount_before    numeric(12,2) NOT NULL,
    amount_after     numeric(12,2) NOT NULL,
    amount_paid_at   numeric(12,2) NOT NULL DEFAULT 0,
    reverts_id       uuid NULL REFERENCES public.payment_adjustments(id),
    created_by       uuid NULL REFERENCES public.profiles(id),
    created_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT padj_kind_check
        CHECK (kind IN ('descuento', 'condonacion_recargo', 'exoneracion', 'reversion')),
    CONSTRAINT padj_origin_check
        CHECK (origin IN ('militar', 'hermanos', 'alta_solo_este_mes', 'pronto_pago', 'modal')),
    CONSTRAINT padj_applies_to_check
        CHECK (applies_to IN ('monto', 'pago')),
    -- Solo el pronto pago se resta al pagar sin tocar amount.
    CONSTRAINT padj_applies_to_pago_solo_pronto_pago
        CHECK (applies_to = 'monto' OR origin = 'pronto_pago'),
    CONSTRAINT padj_sequence_check
        CHECK (sequence > 0),
    CONSTRAINT padj_basis_check
        CHECK (basis IS NULL OR basis IN ('porcentaje', 'valor')),
    CONSTRAINT padj_basis_required
        CHECK ((kind = 'reversion') = (basis IS NULL)),
    CONSTRAINT padj_pct_check
        CHECK (pct IS NULL OR (pct > 0 AND pct <= 100)),
    CONSTRAINT padj_pct_required
        CHECK (basis IS DISTINCT FROM 'porcentaje' OR pct IS NOT NULL),
    CONSTRAINT padj_amount_positive
        CHECK (amount > 0),
    CONSTRAINT padj_scope_check
        CHECK (scope IN ('linea', 'general')),
    CONSTRAINT padj_context_check
        CHECK (context IN ('al_crear', 'al_pagar', 'sobre_pendiente', 'alta', 'backfill')),
    CONSTRAINT padj_reason_code_check
        CHECK (reason_code IN ('pronto_pago', 'varios_meses', 'hermanos', 'beca', 'convenio',
                               'cortesia', 'ajuste_de_precio', 'error_de_cobro',
                               'condonacion_mora', 'descuento_alta', 'otro')),
    CONSTRAINT padj_reason_text_check
        CHECK (reason_text IS NULL OR length(btrim(reason_text)) BETWEEN 3 AND 300),
    CONSTRAINT padj_reason_text_required
        CHECK ((reason_code <> 'otro' AND kind <> 'exoneracion') OR reason_text IS NOT NULL),
    CONSTRAINT padj_reverts_only_reversion
        CHECK ((kind = 'reversion') = (reverts_id IS NOT NULL)),
    CONSTRAINT padj_modal_has_actor
        CHECK (created_by IS NOT NULL OR origin <> 'modal'),
    CONSTRAINT padj_modal_has_batch
        CHECK (origin <> 'modal' OR kind = 'reversion' OR charge_batch_id IS NOT NULL),
    CONSTRAINT padj_amounts_non_negative
        CHECK (amount_before >= 0 AND amount_after >= 0 AND amount_paid_at >= 0)
);

COMMENT ON TABLE public.payment_adjustments IS
    'Ajustes de un cobro (spec cobros-multiples §6.5). Solo inserción: corregir = insertar kind=reversion. '
    'payments.discount_amount / late_fee_waived_amount son su caché.';

-- Un ajuste se revierte una sola vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_padj_reverts_id
    ON public.payment_adjustments (reverts_id)
    WHERE reverts_id IS NOT NULL;

-- Orden de aplicación único por cobro (defensa ante dos escritores sin FOR UPDATE).
CREATE UNIQUE INDEX IF NOT EXISTS uq_padj_payment_sequence
    ON public.payment_adjustments (payment_id, sequence);

CREATE INDEX IF NOT EXISTS ix_padj_payment
    ON public.payment_adjustments (payment_id);
CREATE INDEX IF NOT EXISTS ix_padj_school_created
    ON public.payment_adjustments (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_padj_batch
    ON public.payment_adjustments (charge_batch_id)
    WHERE charge_batch_id IS NOT NULL;

-- ── Coherencia de school_id y append-only ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_padj_coherencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_school uuid;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Solo inserción: corregir un ajuste es insertar kind = 'reversion'.
        RAISE EXCEPTION 'AJUSTE_INMUTABLE: payment_adjustments no admite UPDATE; inserta una reversión'
            USING ERRCODE = '42501';
    END IF;

    SELECT p.school_id INTO v_school FROM public.payments p WHERE p.id = NEW.payment_id;
    IF v_school IS NULL OR v_school IS DISTINCT FROM NEW.school_id THEN
        RAISE EXCEPTION 'AJUSTE_ESCUELA: school_id (%) no coincide con el del cobro (%)',
            NEW.school_id, v_school
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_padj_coherencia() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_padj_coherencia() TO service_role;

DROP TRIGGER IF EXISTS trg_padj_coherencia ON public.payment_adjustments;
CREATE TRIGGER trg_padj_coherencia
    BEFORE INSERT OR UPDATE ON public.payment_adjustments
    FOR EACH ROW EXECUTE FUNCTION public.fn_padj_coherencia();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS padj_select_finance ON public.payment_adjustments;
CREATE POLICY padj_select_finance ON public.payment_adjustments
    FOR SELECT
    TO authenticated
    USING (school_id = ANY ((SELECT public.finance_read_school_ids())::uuid[]));

REVOKE ALL ON public.payment_adjustments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_adjustments TO authenticated;
GRANT ALL ON public.payment_adjustments TO service_role;

-- ── Vista para la familia (Q-D7: ve el descuento y el motivo, no quién) ─────
-- Dueño postgres (igual que v_school_staff_publico): lee la tabla base sin la
-- RLS de finanzas y filtra ella misma por auth.uid(). security_barrier impide que
-- un predicado del cliente se evalúe antes del filtro.
CREATE OR REPLACE VIEW public.v_payment_adjustments_familia
WITH (security_barrier = true) AS
SELECT
    a.id,
    a.payment_id,
    a.kind,
    a.origin,
    a.applies_to,
    a.sequence,
    a.basis,
    a.pct,
    a.amount,
    a.reason_code,
    CASE a.reason_code
        WHEN 'pronto_pago'      THEN 'Pronto pago'
        WHEN 'varios_meses'     THEN 'Pago de varios meses'
        WHEN 'hermanos'         THEN 'Hermanos'
        WHEN 'beca'             THEN 'Beca'
        WHEN 'convenio'         THEN CASE WHEN a.origin = 'militar' THEN 'Fuerza Militar' ELSE 'Convenio' END
        WHEN 'cortesia'         THEN 'Cortesía'
        WHEN 'ajuste_de_precio' THEN 'Ajuste de precio'
        WHEN 'error_de_cobro'   THEN 'Ajuste'
        WHEN 'condonacion_mora' THEN 'Mora condonada'
        WHEN 'descuento_alta'   THEN 'Descuento de ingreso'
        ELSE 'Descuento'
    END AS reason_label,
    EXISTS (SELECT 1 FROM public.payment_adjustments r WHERE r.reverts_id = a.id) AS reverted,
    a.created_at
FROM public.payment_adjustments a
JOIN public.payments p ON p.id = a.payment_id
WHERE a.kind <> 'reversion'
  AND (
        p.parent_id = auth.uid()
     OR p.user_id   = auth.uid()
     OR p.child_id IN (SELECT c.id FROM public.children c WHERE c.parent_id = auth.uid())
  );

COMMENT ON VIEW public.v_payment_adjustments_familia IS
    'Ajustes de los cobros propios (acudiente / atleta adulto), sin quién ni nota (spec §8.1b, Q-D7).';

REVOKE ALL ON public.v_payment_adjustments_familia FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_payment_adjustments_familia TO authenticated;
GRANT SELECT ON public.v_payment_adjustments_familia TO service_role;

COMMIT;
