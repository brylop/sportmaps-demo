-- =============================================================================
-- 20260828174447_admin_set_custom_price_service_role_guard.sql
-- Autor: brylop   Fecha: 2026-08-28   Versión anterior: 20260828173903
-- Objetivo: admin_set_school_custom_price (20260828173903) solo aceptaba
-- is_super_admin(), que depende de auth.uid() — no hay JWT al aplicarlo desde
-- una sesión de servicio (SQL editor, migraciones, futura automatización del
-- BFF). Se descubrió al intentar setear el precio negociado de Dynasty: el
-- guard rechazaba con 42501 aun corriendo como rol `postgres`. Se agrega el
-- mismo bypass que ya tiene generate_school_subscription_invoice desde
-- 20260824180914 (super_admin O session_user de servicio) — mismo patrón, no
-- uno nuevo.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_set_school_custom_price(
    p_school_id         uuid,
    p_custom_price_cents integer,
    p_billing_cycle     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT (
        public.is_super_admin()
        OR session_user IN ('service_role', 'postgres', 'supabase_admin')
    ) THEN
        RAISE EXCEPTION 'solo super_admin o el proceso del BFF pueden fijar un precio negociado' USING ERRCODE = '42501';
    END IF;

    IF p_custom_price_cents IS NOT NULL AND p_custom_price_cents < 0 THEN
        RAISE EXCEPTION 'custom_price_cents no puede ser negativo' USING ERRCODE = '22023';
    END IF;

    IF p_billing_cycle IS NOT NULL AND p_billing_cycle NOT IN ('monthly', 'annual') THEN
        RAISE EXCEPTION 'billing_cycle debe ser monthly o annual' USING ERRCODE = '22023';
    END IF;

    UPDATE public.school_subscriptions
       SET custom_price_cents = p_custom_price_cents,
           billing_cycle      = COALESCE(p_billing_cycle, billing_cycle),
           updated_at         = now()
     WHERE school_id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id
            USING ERRCODE = '23503';
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'school_id', p_school_id,
        'custom_price_cents', p_custom_price_cents,
        'billing_cycle', COALESCE(p_billing_cycle, (SELECT billing_cycle FROM public.school_subscriptions WHERE school_id = p_school_id))
    );
END;
$$;

COMMENT ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text) IS
    'Super-admin (o el proceso del BFF) fija/quita el precio negociado de la '
    'factura SaaS de una escuela, y opcionalmente su billing_cycle. NO genera '
    'factura nueva por sí sola.';

REVOKE ALL ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
