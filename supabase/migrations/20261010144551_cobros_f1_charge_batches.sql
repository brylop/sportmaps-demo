-- =============================================================================
-- 20261010144551_cobros_f1_charge_batches.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010143743
-- Objetivo: F1 de «Cobros y pagos» (docs/specs/cobros-multiples.md §6.1, §8.1, §12 M1).
--   Tabla public.charge_batches: un registro por CONFIRMACIÓN del modal «Cobros y
--   pagos» (operación). Ancla de idempotencia (school_id, client_request_id) y de
--   auditoría: cobros creados, pagos registrados y ajustes de la operación.
--
-- Depende de: F0 (20261010143132_cobros_unicos_reglas_genericas) aplicada antes
--   que el resto de F1 (criterio de arranque, spec §12 F0). Esta migración en sí
--   no lee nada de F0.
--
-- Radio (base viva, 2026-10-10, solo lectura):
--   · La tabla no existe (pg_class: 0 filas con ese nombre). Nada que migrar.
--   · Nadie la lee todavía: la usan las RPC de M9 (service_role) y el BFF de F2.
--
-- RLS (§8.1, línea por línea):
--   cb_select_finance  SELECT  authenticated
--     USING (school_id = ANY ((SELECT public.finance_read_school_ids())::uuid[]))
--     → owner/admin/school_admin/super_admin/accountant + dueño de schools.
--       Coach, reporter, acudiente y atleta: 0 filas (Q19).
--     Sin self-recursion: la policy no lee charge_batches.
--   INSERT / UPDATE / DELETE: SIN policy → denegado a authenticated. Solo las RPC
--     SECURITY DEFINER (dueño postgres) escriben.
--   Invariantes: I1 no aplica (sin anon), I2 no aplica (sin escritura por policy),
--     I3 no hay FOR ALL, I4 las RPC (M8/M9) llevan search_path.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.charge_batches (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id              uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    client_request_id      uuid NOT NULL,
    mode                   text NOT NULL,
    target                 jsonb NOT NULL,
    lines                  jsonb NOT NULL,
    status                 text NOT NULL DEFAULT 'created',
    rows_created           integer NOT NULL,
    rows_skipped           integer NOT NULL,
    total_amount           numeric(14,2) NOT NULL,
    skipped                jsonb NOT NULL DEFAULT '[]'::jsonb,
    notify_families        boolean NOT NULL DEFAULT false,
    payments_registered    integer NOT NULL DEFAULT 0,
    paid_total             numeric(14,2) NOT NULL DEFAULT 0,
    discount_total         numeric(14,2) NOT NULL DEFAULT 0,
    late_fee_waived_total  numeric(14,2) NOT NULL DEFAULT 0,
    payment                jsonb NULL,
    created_by             uuid NOT NULL REFERENCES public.profiles(id),
    created_at             timestamptz NOT NULL DEFAULT now(),
    annulled_by            uuid NULL REFERENCES public.profiles(id),
    annulled_at            timestamptz NULL,
    annul_reason           text NULL,

    CONSTRAINT charge_batches_mode_check
        CHECK (mode IN ('single', 'multi')),
    CONSTRAINT charge_batches_status_check
        CHECK (status IN ('created', 'partially_annulled', 'annulled')),
    CONSTRAINT charge_batches_rows_check
        CHECK (rows_created >= 0 AND rows_skipped >= 0),
    CONSTRAINT charge_batches_total_check
        CHECK (total_amount >= 0),
    CONSTRAINT charge_batches_payments_registered_check
        CHECK (payments_registered >= 0),
    CONSTRAINT charge_batches_paid_total_check
        CHECK (paid_total >= 0),
    CONSTRAINT charge_batches_discount_total_check
        CHECK (discount_total >= 0),
    CONSTRAINT charge_batches_late_fee_waived_total_check
        CHECK (late_fee_waived_total >= 0),
    -- D11: el modo varios solo genera cobros; nunca registra pagos.
    CONSTRAINT charge_batches_payment_only_single
        CHECK (mode = 'single' OR payment IS NULL),
    CONSTRAINT charge_batches_multi_sin_pagos
        CHECK (mode = 'single' OR payments_registered = 0),
    CONSTRAINT charge_batches_annul_reason_check
        CHECK (annul_reason IS NULL OR length(btrim(annul_reason)) BETWEEN 3 AND 300)
);

COMMENT ON TABLE public.charge_batches IS
    'Operaciones del modal «Cobros y pagos» (spec cobros-multiples §6.1). Solo escriben las RPC '
    'create_charge_batch / annul_charge_batch (service_role). Idempotencia por (school_id, client_request_id).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_charge_batches_request
    ON public.charge_batches (school_id, client_request_id);

CREATE INDEX IF NOT EXISTS ix_charge_batches_school_created
    ON public.charge_batches (school_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.charge_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cb_select_finance ON public.charge_batches;
CREATE POLICY cb_select_finance ON public.charge_batches
    FOR SELECT
    TO authenticated
    USING (school_id = ANY ((SELECT public.finance_read_school_ids())::uuid[]));

-- ── GRANTs ───────────────────────────────────────────────────────────────────
REVOKE ALL ON public.charge_batches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.charge_batches TO authenticated;
GRANT ALL ON public.charge_batches TO service_role;

COMMIT;
