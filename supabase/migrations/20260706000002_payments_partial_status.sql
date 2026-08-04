-- ============================================================
-- SPORTMAPS — Pagos: valor 'partial' en pay_status (abonos)
--
-- La aprobación de cobros ahora permite registrar un ABONO parcial: el admin
-- acredita el monto realmente pagado (amount_paid) y el pago queda 'partial'
-- con saldo pendiente hasta completarse. Este valor puede ya existir en la BD
-- (se usa en queries históricas), por eso ADD VALUE IF NOT EXISTS + guard.
--
-- NOTA: no requiere update masivo de datos — los pagos existentes no cambian;
-- solo los abonos nuevos usan 'partial'.
-- ============================================================

DO $$ BEGIN
    ALTER TYPE public.pay_status ADD VALUE IF NOT EXISTS 'partial';
EXCEPTION WHEN duplicate_object THEN null; END $$;
