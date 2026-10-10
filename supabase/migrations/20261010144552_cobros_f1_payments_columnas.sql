-- =============================================================================
-- 20261010144552_cobros_f1_payments_columnas.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010144551
-- Objetivo: F1 de «Cobros y pagos» (spec cobros-multiples §6.2, §6.5, §8.3, §12 M2).
--   1. payments: charge_batch_id, created_by, notes, discount_amount,
--      late_fee_waived_amount (ADD COLUMN IF NOT EXISTS: pagos-unicos-por-plan F1
--      comparte created_by/notes; quien llegue primero las crea, §6.3).
--      one_time_fee_id NO se crea aquí: depende de plan_one_time_fees (F4 /
--      pagos-únicos F1).
--   2. enrollments: fee_discount_origin ('militar') + fee_discount_pct, marca
--      estructurada del descuento militar (Q-D15) + backfill desde fee_reason.
--   3. notifications.push (DEFAULT true): una notificación con push = false no
--      dispara push ni entrega externa (M7 lo respeta en los triggers).
--
-- Radio (base viva, 2026-10-10, solo lectura):
--   · payments: 5.497 filas. Las columnas nuevas nacen NULL / 0 (DEFAULT
--     constante: sin reescritura de la tabla en PG ≥ 11). Ningún lector cambia.
--     information_schema: charge_batch_id, created_by, notes, discount_amount,
--     late_fee_waived_amount NO existen hoy.
--   · enrollments con fee_reason = 'Descuento Fuerza Militar 10%': 0 → el
--     backfill toca 0 filas. Escuelas con military_discount_enabled: 1 (Besser).
--   · notifications: 5.640 filas → push = true (comportamiento de hoy).
-- =============================================================================

BEGIN;

-- ── 1. payments ──────────────────────────────────────────────────────────────
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS charge_batch_id uuid NULL
        REFERENCES public.charge_batches(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS created_by uuid NULL
        REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS notes text NULL,
    ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS late_fee_waived_amount numeric(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.payments'::regclass
                      AND conname = 'payments_notes_length') THEN
        ALTER TABLE public.payments
            ADD CONSTRAINT payments_notes_length
            CHECK (notes IS NULL OR length(notes) <= 500);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.payments'::regclass
                      AND conname = 'payments_discount_amount_check') THEN
        ALTER TABLE public.payments
            ADD CONSTRAINT payments_discount_amount_check
            CHECK (discount_amount >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.payments'::regclass
                      AND conname = 'payments_late_fee_waived_amount_check') THEN
        ALTER TABLE public.payments
            ADD CONSTRAINT payments_late_fee_waived_amount_check
            CHECK (late_fee_waived_amount >= 0);
    END IF;
END $$;

COMMENT ON COLUMN public.payments.charge_batch_id IS
    'Operación del modal «Cobros y pagos» que creó el cobro (NULL = no salió de un lote). Solo la escribe create_charge_batch.';
COMMENT ON COLUMN public.payments.discount_amount IS
    'Caché: suma vigente de los ajustes que bajan amount (militar, hermanos, solo este mes, modal). '
    'Invariante (M6): list_amount IS NULL OR amount = list_amount - discount_amount + late_fee_amount.';
COMMENT ON COLUMN public.payments.late_fee_waived_amount IS
    'Caché: recargo de mora condonado (se resta de late_fee_amount, que queda neto).';
COMMENT ON COLUMN public.payments.list_amount IS
    'Valor de lista antes de cualquier descuento (rev. 2 de cobros-multiples §6.2).';

CREATE INDEX IF NOT EXISTS ix_payments_charge_batch
    ON public.payments (charge_batch_id)
    WHERE charge_batch_id IS NOT NULL;

-- ── 2. enrollments: marca estructurada del descuento militar ────────────────
ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS fee_discount_origin text NULL,
    ADD COLUMN IF NOT EXISTS fee_discount_pct numeric(5,2) NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.enrollments'::regclass
                      AND conname = 'enrollments_fee_discount_origin_check') THEN
        ALTER TABLE public.enrollments
            ADD CONSTRAINT enrollments_fee_discount_origin_check
            CHECK (fee_discount_origin IS NULL OR fee_discount_origin IN ('militar'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.enrollments'::regclass
                      AND conname = 'enrollments_fee_discount_pct_check') THEN
        ALTER TABLE public.enrollments
            ADD CONSTRAINT enrollments_fee_discount_pct_check
            CHECK (fee_discount_pct IS NULL OR (fee_discount_pct > 0 AND fee_discount_pct <= 100));
    END IF;
END $$;

-- Índice diminuto: el trigger de descuentos automáticos (M4) lo consulta en cada
-- mensualidad con plan; con 0 filas marcadas la consulta sale del índice vacío.
CREATE INDEX IF NOT EXISTS ix_enrollments_fee_discount_origin
    ON public.enrollments (school_id)
    WHERE fee_discount_origin IS NOT NULL;

-- Backfill (0 filas hoy). Idempotente.
UPDATE public.enrollments
   SET fee_discount_origin = 'militar',
       fee_discount_pct    = 10
 WHERE fee_reason = 'Descuento Fuerza Militar 10%'
   AND fee_discount_origin IS NULL;

-- ── 3. notifications.push ───────────────────────────────────────────────────
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS push boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notifications.push IS
    'false = solo in-app: no dispara push (trg_push_on_notification) ni entrega externa '
    '(trg_enqueue_notification_delivery). La usan los avisos agrupados de «Cobros y pagos» (§8.3).';

COMMIT;
