-- ============================================================
-- SPORTMAPS — Campos de cobro completos en school_settings
--
-- El onboarding unificado pide a la escuela datos bancarios + Nequi +
-- Bre-B + WhatsApp + tipo de cuenta. Estas columnas no existian en
-- school_settings (table original solo tenia politicas de cobro).
--
-- Ademas: en staging subscription_plans tira 404 al insertar desde
-- el wizard "Primer Plan". Confirmamos GRANT + NOTIFY para forzar a
-- PostgREST a refrescar el cache.
-- ============================================================

BEGIN;

-- 1. Agregar columnas de cobro a school_settings
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS bank_name           text,
    ADD COLUMN IF NOT EXISTS bank_account_number text,
    ADD COLUMN IF NOT EXISTS bank_account_type   text
        CHECK (bank_account_type IS NULL OR bank_account_type IN ('ahorros','corriente','billetera_digital')),
    ADD COLUMN IF NOT EXISTS bank_account_holder text,
    ADD COLUMN IF NOT EXISTS nequi_number        text,
    ADD COLUMN IF NOT EXISTS breb_key            text,
    ADD COLUMN IF NOT EXISTS whatsapp_number     text;

COMMENT ON COLUMN public.school_settings.bank_name IS
    'Codigo de banco colombiano segun COLOMBIAN_BANKS catalogo en frontend.';
COMMENT ON COLUMN public.school_settings.bank_account_type IS
    'Tipo de cuenta: ahorros, corriente o billetera_digital (Nequi/Daviplata como cuenta principal).';
COMMENT ON COLUMN public.school_settings.nequi_number IS
    'Numero Nequi de 10 digitos para cobros instantaneos.';
COMMENT ON COLUMN public.school_settings.breb_key IS
    'Llave Bre-B (Banco de la Republica) para transferencias instantaneas. Puede ser celular, email, NIT, CC, o alias custom.';
COMMENT ON COLUMN public.school_settings.whatsapp_number IS
    'WhatsApp de contacto para coordinar pagos con familias.';


-- 2. Asegurar GRANT y reload schema para subscription_plans
-- (existe desde 20260417000003 pero el cache de PostgREST puede
-- haberse quedado stale)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO service_role;
GRANT SELECT ON public.subscription_plans TO anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
