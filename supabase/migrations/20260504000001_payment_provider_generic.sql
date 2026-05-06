-- ============================================================================
-- Payment Provider Generic — soporte multi-gateway (Wompi + MercadoPago).
--
-- Foundation para la integracion de MercadoPago en paralelo a Wompi:
--  1. Enum public.payment_provider
--  2. Columnas genericas (payment_provider, provider_reference, provider_transaction_id)
--     en cada tabla de pagos. wompi_* queda como columna legacy (backfill +
--     mirror desde provider_* cuando provider='wompi').
--  3. payment_tokens: soporta MP (customer_id + card_id) ademas de Wompi (token unico).
--  4. refunds: agrega provider_void_id ademas de wompi_void_id.
--  5. Tablas school_payment_providers y vendor_payment_providers — config
--     por escuela/vendor (cada uno tiene su propia cuenta merchant; el dinero
--     llega a la cuenta del merchant, no a SportMaps).
--  6. RPCs helper para resolver providers desde el BFF.
--
-- Idempotente: usa IF NOT EXISTS / DO $$ ... pg_tables checks.
-- No destructiva: wompi_* se conserva intacta para no romper queries legacy.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enum payment_provider
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
        CREATE TYPE public.payment_provider AS ENUM ('wompi', 'mercadopago');
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Columnas genericas en tablas de pago
--    Cada tabla recibe: payment_provider, provider_reference, provider_transaction_id
--    Backfill desde wompi_* cuando aplique. wompi_* queda intacto.
-- ─────────────────────────────────────────────────────────────────────────────

-- payments
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider DEFAULT 'wompi',
    ADD COLUMN IF NOT EXISTS provider_reference TEXT,
    ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

UPDATE public.payments
SET provider_reference = wompi_reference,
    provider_transaction_id = wompi_transaction_id,
    payment_provider = COALESCE(payment_provider, 'wompi'::public.payment_provider)
WHERE provider_reference IS NULL AND wompi_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_ref
    ON public.payments (payment_provider, provider_reference)
    WHERE provider_reference IS NOT NULL;

-- payment_links
ALTER TABLE public.payment_links
    ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider DEFAULT 'wompi',
    ADD COLUMN IF NOT EXISTS provider_reference TEXT;

UPDATE public.payment_links
SET provider_reference = wompi_reference,
    payment_provider = COALESCE(payment_provider, 'wompi'::public.payment_provider)
WHERE provider_reference IS NULL AND wompi_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_links_provider_ref
    ON public.payment_links (payment_provider, provider_reference)
    WHERE provider_reference IS NOT NULL;

-- payment_splits
ALTER TABLE public.payment_splits
    ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider DEFAULT 'wompi',
    ADD COLUMN IF NOT EXISTS provider_reference TEXT,
    ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS provider_fee NUMERIC(12,2) DEFAULT 0;

UPDATE public.payment_splits
SET provider_reference = wompi_reference,
    provider_transaction_id = wompi_transaction_id,
    provider_fee = COALESCE(wompi_fee, 0),
    payment_provider = COALESCE(payment_provider, 'wompi'::public.payment_provider)
WHERE provider_reference IS NULL AND wompi_reference IS NOT NULL;

-- orders
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider DEFAULT 'wompi',
    ADD COLUMN IF NOT EXISTS provider_reference TEXT,
    ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

UPDATE public.orders
SET provider_reference = wompi_reference,
    provider_transaction_id = wompi_transaction_id,
    payment_provider = COALESCE(payment_provider, 'wompi'::public.payment_provider)
WHERE provider_reference IS NULL AND wompi_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_ref
    ON public.orders (payment_provider, provider_reference)
    WHERE provider_reference IS NOT NULL;

-- marketplace_transactions (opcional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
        EXECUTE $sql$
            ALTER TABLE public.marketplace_transactions
                ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider DEFAULT 'wompi',
                ADD COLUMN IF NOT EXISTS provider_reference TEXT,
                ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT
        $sql$;

        EXECUTE $sql$
            UPDATE public.marketplace_transactions
            SET provider_reference = wompi_reference,
                provider_transaction_id = wompi_transaction_id,
                payment_provider = COALESCE(payment_provider, 'wompi'::public.payment_provider)
            WHERE provider_reference IS NULL AND wompi_reference IS NOT NULL
        $sql$;

        EXECUTE $sql$
            CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_tx_provider_ref
                ON public.marketplace_transactions (payment_provider, provider_reference)
                WHERE provider_reference IS NOT NULL
        $sql$;
    END IF;
END $$;

-- session_bookings (opcional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='session_bookings') THEN
        EXECUTE $sql$
            ALTER TABLE public.session_bookings
                ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider DEFAULT 'wompi',
                ADD COLUMN IF NOT EXISTS provider_reference TEXT,
                ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT
        $sql$;

        EXECUTE $sql$
            UPDATE public.session_bookings
            SET provider_reference = wompi_reference,
                provider_transaction_id = wompi_transaction_id,
                payment_provider = COALESCE(payment_provider, 'wompi'::public.payment_provider)
            WHERE provider_reference IS NULL AND wompi_reference IS NOT NULL
        $sql$;

        EXECUTE $sql$
            CREATE UNIQUE INDEX IF NOT EXISTS idx_session_bookings_provider_ref
                ON public.session_bookings (payment_provider, provider_reference)
                WHERE provider_reference IS NOT NULL
        $sql$;
    END IF;
END $$;

-- refunds: agregar provider_void_id (mantiene wompi_void_id legacy)
ALTER TABLE public.refunds
    ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider DEFAULT 'wompi',
    ADD COLUMN IF NOT EXISTS provider_void_id TEXT;

UPDATE public.refunds
SET provider_void_id = wompi_void_id,
    payment_provider = COALESCE(payment_provider, 'wompi'::public.payment_provider)
WHERE provider_void_id IS NULL AND wompi_void_id IS NOT NULL;

-- vendor_payouts: provider_fee paralelo a wompi_fee
ALTER TABLE public.vendor_payouts
    ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider DEFAULT 'wompi',
    ADD COLUMN IF NOT EXISTS provider_fee NUMERIC(12,2) DEFAULT 0;

UPDATE public.vendor_payouts
SET provider_fee = COALESCE(wompi_fee, 0),
    payment_provider = COALESCE(payment_provider, 'wompi'::public.payment_provider)
WHERE provider_fee = 0 AND wompi_fee IS NOT NULL AND wompi_fee > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. payment_tokens — soporte multi-provider
--    MP usa customer_id + card_id (vs Wompi token unico). Anadimos columnas
--    nuevas; wompi_token deja de ser NOT NULL para permitir tokens MP.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_tokens
    ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider DEFAULT 'wompi',
    ADD COLUMN IF NOT EXISTS provider_token TEXT,
    ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS provider_card_id TEXT;

-- Backfill: wompi_token → provider_token, payment_provider='wompi'
UPDATE public.payment_tokens
SET provider_token = wompi_token,
    payment_provider = COALESCE(payment_provider, 'wompi'::public.payment_provider)
WHERE provider_token IS NULL AND wompi_token IS NOT NULL;

-- Permitir wompi_token NULL (MP no lo usa)
ALTER TABLE public.payment_tokens ALTER COLUMN wompi_token DROP NOT NULL;

-- Nuevo unique partial: (provider, provider_token) — reemplaza el unique de wompi_token
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname='public' AND tablename='payment_tokens' AND indexname='payment_tokens_wompi_token_key'
    ) THEN
        ALTER TABLE public.payment_tokens DROP CONSTRAINT IF EXISTS payment_tokens_wompi_token_key;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_tokens_provider_token
    ON public.payment_tokens (payment_provider, provider_token)
    WHERE provider_token IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. school_payment_providers — config por escuela
--    Cada escuela puede tener Wompi y/o MercadoPago. is_default define
--    cual aparece por defecto en el checkout cuando el padre tiene opciones.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.school_payment_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    provider public.payment_provider NOT NULL,
    -- Credenciales del merchant. En produccion deberian estar cifradas con
    -- pgsodium o Supabase Vault. Para demo se almacenan en claro y service_role
    -- es el unico rol que puede leer access_token / webhook_secret.
    public_key TEXT NOT NULL,
    access_token TEXT NOT NULL,
    webhook_secret TEXT,
    integrity_secret TEXT,                          -- solo Wompi (Widget Checkout)
    sandbox BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_school_payment_providers_school_enabled
    ON public.school_payment_providers (school_id) WHERE enabled = true;

ALTER TABLE public.school_payment_providers ENABLE ROW LEVEL SECURITY;

-- Solo school_owner / school_admin / admin pueden leer la config; el access_token
-- nunca se expone al frontend (el BFF lo lee con service_role y solo devuelve
-- public_key + provider al cliente).
DROP POLICY IF EXISTS "school_payment_providers_owner_read" ON public.school_payment_providers;
CREATE POLICY "school_payment_providers_owner_read" ON public.school_payment_providers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.schools s
            WHERE s.id = school_payment_providers.school_id
              AND (
                s.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid() AND p.role::text IN ('admin', 'school_admin', 'owner')
                )
              )
        )
    );

DROP POLICY IF EXISTS "school_payment_providers_owner_write" ON public.school_payment_providers;
CREATE POLICY "school_payment_providers_owner_write" ON public.school_payment_providers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.schools s
            WHERE s.id = school_payment_providers.school_id
              AND (
                s.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid() AND p.role::text = 'admin'
                )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.schools s
            WHERE s.id = school_payment_providers.school_id
              AND (
                s.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid() AND p.role::text = 'admin'
                )
              )
        )
    );

-- Trigger para garantizar que solo un provider por escuela es is_default=true
CREATE OR REPLACE FUNCTION public.school_payment_providers_enforce_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE public.school_payment_providers
        SET is_default = false, updated_at = NOW()
        WHERE school_id = NEW.school_id
          AND id != NEW.id
          AND is_default = true;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_pp_single_default ON public.school_payment_providers;
CREATE TRIGGER trg_school_pp_single_default
    BEFORE INSERT OR UPDATE ON public.school_payment_providers
    FOR EACH ROW
    EXECUTE FUNCTION public.school_payment_providers_enforce_single_default();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. vendor_payment_providers — config por vendor (productos / servicios / eventos)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_payment_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider public.payment_provider NOT NULL,
    public_key TEXT NOT NULL,
    access_token TEXT NOT NULL,
    webhook_secret TEXT,
    integrity_secret TEXT,
    sandbox BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (vendor_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_vendor_payment_providers_vendor_enabled
    ON public.vendor_payment_providers (vendor_id) WHERE enabled = true;

ALTER TABLE public.vendor_payment_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_payment_providers_owner_all" ON public.vendor_payment_providers;
CREATE POLICY "vendor_payment_providers_owner_all" ON public.vendor_payment_providers
    FOR ALL USING (
        auth.uid() = vendor_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin')
    )
    WITH CHECK (
        auth.uid() = vendor_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin')
    );

CREATE OR REPLACE FUNCTION public.vendor_payment_providers_enforce_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE public.vendor_payment_providers
        SET is_default = false, updated_at = NOW()
        WHERE vendor_id = NEW.vendor_id
          AND id != NEW.id
          AND is_default = true;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_pp_single_default ON public.vendor_payment_providers;
CREATE TRIGGER trg_vendor_pp_single_default
    BEFORE INSERT OR UPDATE ON public.vendor_payment_providers
    FOR EACH ROW
    EXECUTE FUNCTION public.vendor_payment_providers_enforce_single_default();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPCs helper para que el BFF resuelva providers
--    Devuelven SOLO public_key + provider + sandbox + is_default.
--    NUNCA exponen access_token / webhook_secret (esos los lee el BFF
--    con service_role directo a la tabla).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_payment_providers_for_school(p_school_id UUID)
RETURNS TABLE (
    provider public.payment_provider,
    public_key TEXT,
    sandbox BOOLEAN,
    is_default BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT spp.provider, spp.public_key, spp.sandbox, spp.is_default
    FROM public.school_payment_providers spp
    WHERE spp.school_id = p_school_id AND spp.enabled = true
    ORDER BY spp.is_default DESC, spp.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_providers_for_school(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_payment_providers_for_vendor(p_vendor_id UUID)
RETURNS TABLE (
    provider public.payment_provider,
    public_key TEXT,
    sandbox BOOLEAN,
    is_default BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT vpp.provider, vpp.public_key, vpp.sandbox, vpp.is_default
    FROM public.vendor_payment_providers vpp
    WHERE vpp.vendor_id = p_vendor_id AND vpp.enabled = true
    ORDER BY vpp.is_default DESC, vpp.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_providers_for_vendor(UUID) TO authenticated, service_role;

COMMIT;
