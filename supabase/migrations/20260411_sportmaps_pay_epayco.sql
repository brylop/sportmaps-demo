-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: SportMaps Pay — ePayco Integration
-- Crea tablas payment_links y payment_splits,
-- agrega columnas de ePayco a payments y school_settings
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas nuevas en payments ──────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS sportmaps_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS epayco_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_channel TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS epayco_ref TEXT,
  ADD COLUMN IF NOT EXISTS epayco_transaction_id TEXT;

COMMENT ON COLUMN public.payments.gross_amount IS 'Monto total cobrado al padre (base + fee). Solo para pagos online.';
COMMENT ON COLUMN public.payments.sportmaps_fee IS 'Fee que gana SportMaps por el procesamiento online.';
COMMENT ON COLUMN public.payments.payment_channel IS 'Canal de pago: online, manual, transfer, cash.';

-- ── 2. Columnas nuevas en school_settings ───────────────────────────────────
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS epayco_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS online_fee_pct NUMERIC(5,2) DEFAULT 3.00,
  ADD COLUMN IF NOT EXISTS fee_payer TEXT DEFAULT 'parent',
  ADD COLUMN IF NOT EXISTS transfer_day TEXT DEFAULT 'monday',
  ADD COLUMN IF NOT EXISTS sportmaps_pay_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sportmaps_pay_terms_accepted_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.school_settings.epayco_enabled IS 'Si la escuela tiene pagos online habilitados.';
COMMENT ON COLUMN public.school_settings.online_fee_pct IS 'Porcentaje de fee de procesamiento (default 3%).';
COMMENT ON COLUMN public.school_settings.fee_payer IS 'Quién paga el fee: parent, school, split.';

-- ── 3. Tabla payment_links ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  epayco_session_id TEXT UNIQUE,
  gross_amount NUMERIC NOT NULL,
  base_amount NUMERIC NOT NULL,
  sportmaps_fee NUMERIC NOT NULL DEFAULT 0,
  fee_pct NUMERIC NOT NULL DEFAULT 3.00,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  failed_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_payment_id ON public.payment_links(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_school_id ON public.payment_links(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_token ON public.payment_links(token);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON public.payment_links(status);

COMMENT ON TABLE public.payment_links IS 'Links de pago online generados para ePayco. Cada link tiene un token público y una sesión temporal.';

-- ── 4. Tabla payment_splits ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  payment_link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
  epayco_ref TEXT NOT NULL UNIQUE,
  epayco_transaction_id TEXT,
  gross_amount NUMERIC NOT NULL,
  school_receives NUMERIC NOT NULL,
  sportmaps_receives NUMERIC NOT NULL DEFAULT 0,
  epayco_fee NUMERIC DEFAULT 0,
  transfer_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (transfer_status IN ('pending', 'transferred', 'failed', 'disputed')),
  transfer_method TEXT
    CHECK (transfer_method IS NULL OR transfer_method IN ('nequi', 'bank_transfer', 'daviplata')),
  transfer_reference TEXT,
  transferred_at TIMESTAMPTZ,
  transferred_by UUID REFERENCES auth.users(id),
  raw_webhook JSONB,
  webhook_signature_valid BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_splits_payment_id ON public.payment_splits(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_epayco_ref ON public.payment_splits(epayco_ref);
CREATE INDEX IF NOT EXISTS idx_payment_splits_transfer_status ON public.payment_splits(transfer_status);

COMMENT ON TABLE public.payment_splits IS 'Registro de distribución de ingresos por pago online. Clave de idempotencia: epayco_ref UNIQUE.';

-- ── 5. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_links_select_by_school" ON public.payment_links
  FOR SELECT USING (
    school_id IN (
      SELECT sm.school_id FROM public.school_members sm
      WHERE sm.profile_id = auth.uid() AND sm.status = 'active'
    )
  );

CREATE POLICY "payment_links_select_by_token" ON public.payment_links
  FOR SELECT USING (true);

CREATE POLICY "payment_splits_select_by_school" ON public.payment_splits
  FOR SELECT USING (
    payment_id IN (
      SELECT p.id FROM public.payments p
      WHERE p.school_id IN (
        SELECT sm.school_id FROM public.school_members sm
        WHERE sm.profile_id = auth.uid() AND sm.status = 'active'
      )
    )
  );
