-- ============================================================
-- SPORTMAPS — Campos de cobro completos + subscription_plans defensivo
--
-- Esta migracion:
--   1. Crea public.subscription_plans si no existe (puede haberse
--      perdido en staging: el GRANT del wizard "Primer Plan" fallaba
--      con "relation does not exist", confirmando que 20260417000003
--      nunca se aplico completo en ese ambiente).
--   2. Agrega columnas de cobro a school_settings (bank_*, nequi,
--      breb_key, whatsapp).
--   3. GRANTs y NOTIFY pgrst reload para refrescar el cache de
--      PostgREST y exponer todo correctamente.
--
-- 100% IDEMPOTENTE — todas las clausulas usan IF NOT EXISTS / IF EXISTS.
-- Aplicarla sobre un ambiente que ya tenga las tablas no rompe nada.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. subscription_plans (defensivo)
--
-- En ambientes con 20260417000003 ya aplicado, este bloque es no-op.
-- En staging donde se perdio la migracion, crea la tabla con el mismo
-- schema original para que el wizard "Primer Plan" pueda insertar.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    name                text        NOT NULL,
    description         text,
    plan_type           text        NOT NULL CHECK (plan_type IN ('school_monthly', 'service_package', 'event_season_pass')),
    price               numeric     NOT NULL CHECK (price > 0),
    currency            text        NOT NULL DEFAULT 'COP',
    billing_period      text        NOT NULL DEFAULT 'monthly'
                                    CHECK (billing_period IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
    sessions_included   integer,    -- NULL = ilimitado
    features            jsonb       NOT NULL DEFAULT '[]',
    trial_days          integer     NOT NULL DEFAULT 0,
    is_active           boolean     NOT NULL DEFAULT true,
    max_subscribers     integer,
    tax_rate            numeric     NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 1),
    metadata            jsonb       NOT NULL DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_plans_vendor ON public.subscription_plans(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_sub_plans_type   ON public.subscription_plans(plan_type);
CREATE INDEX IF NOT EXISTS idx_sub_plans_active ON public.subscription_plans(is_active);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_plans_select_public" ON public.subscription_plans;
CREATE POLICY "sub_plans_select_public"
    ON public.subscription_plans
    FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "sub_plans_owner" ON public.subscription_plans;
CREATE POLICY "sub_plans_owner"
    ON public.subscription_plans
    FOR ALL
    TO authenticated
    USING (
        vendor_profile_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
    )
    WITH CHECK (
        vendor_profile_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
    );

-- Trigger updated_at (reusa set_updated_at del schema base)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON public.subscription_plans';
        EXECUTE 'CREATE TRIGGER trg_subscription_plans_updated_at
                 BEFORE UPDATE ON public.subscription_plans
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;


-- ============================================================
-- 2. Columnas de cobro en school_settings
-- ============================================================

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS bank_name           text,
    ADD COLUMN IF NOT EXISTS bank_account_number text,
    ADD COLUMN IF NOT EXISTS bank_account_type   text,
    ADD COLUMN IF NOT EXISTS bank_account_holder text,
    ADD COLUMN IF NOT EXISTS nequi_number        text,
    ADD COLUMN IF NOT EXISTS breb_key            text,
    ADD COLUMN IF NOT EXISTS whatsapp_number     text;

-- CHECK por separado para que no rompa si la columna ya tenia un valor
-- previo no contemplado. Se aplica solo a inserts/updates nuevos.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'school_settings_bank_account_type_check'
    ) THEN
        ALTER TABLE public.school_settings
            ADD CONSTRAINT school_settings_bank_account_type_check
            CHECK (bank_account_type IS NULL OR bank_account_type IN ('ahorros','corriente','billetera_digital'));
    END IF;
END $$;

COMMENT ON COLUMN public.school_settings.bank_name IS
    'Codigo de banco colombiano segun COLOMBIAN_BANKS catalogo en frontend.';
COMMENT ON COLUMN public.school_settings.bank_account_type IS
    'Tipo de cuenta: ahorros, corriente o billetera_digital (Nequi/Daviplata como cuenta principal).';
COMMENT ON COLUMN public.school_settings.nequi_number IS
    'Numero Nequi de 10 digitos para cobros instantaneos.';
COMMENT ON COLUMN public.school_settings.breb_key IS
    'Llave Bre-B (Banco de la Republica) para transferencias instantaneas.';
COMMENT ON COLUMN public.school_settings.whatsapp_number IS
    'WhatsApp de contacto para coordinar pagos con familias.';


-- ============================================================
-- 3. GRANTs y reload de schema
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO service_role;
GRANT SELECT                         ON public.subscription_plans TO anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
