-- =============================================================================
-- 20260829123314_school_subscriptions_billing_cycle_options.sql
-- Autor: brylop   Fecha: 2026-08-29   Versión anterior: 20260828224354
-- Objetivo: billing_cycle solo aceptaba 'monthly'/'annual'. GYM RM negoció un
-- trato a 6 meses — ni mensual ni anual. Se amplía el CHECK a 'monthly' /
-- 'quarterly' (3 meses) / 'semiannual' (6 meses) / 'annual', y
-- admin_set_school_custom_price aprende a calcular el fin de período para los
-- dos ciclos nuevos.
-- run_saas_billing_cycle() NO se toca: sigue auto-renovando solo 'monthly'
-- (decisión ya tomada — todo lo demás se reenvía a mano desde el panel, igual
-- que 'annual' hoy). Un ciclo de 3/6 meses manual es exactamente el mismo
-- patrón que ya existe para anual, no una feature nueva.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
-- =============================================================================

BEGIN;

-- ============================================================================
-- 1. Ampliar el CHECK de billing_cycle
-- ============================================================================

ALTER TABLE public.school_subscriptions
    DROP CONSTRAINT IF EXISTS school_subscriptions_billing_cycle_check;
ALTER TABLE public.school_subscriptions
    ADD CONSTRAINT school_subscriptions_billing_cycle_check
    CHECK (billing_cycle = ANY (ARRAY['monthly', 'quarterly', 'semiannual', 'annual']));

COMMENT ON COLUMN public.school_subscriptions.billing_cycle IS
    'Periodicidad de facturación SaaS: monthly (único que auto-renueva vía '
    'run_saas_billing_cycle), quarterly (3 meses), semiannual (6 meses), '
    'annual — estos tres últimos se generan/reenvían a mano desde '
    'AdminSubscriptionsPage (mismo patrón que ya tenía annual).';

-- ============================================================================
-- 2. admin_set_school_custom_price: validar y calcular fin de período para
--    los ciclos nuevos. Mismo signature (uuid, integer, text, date) — CREATE
--    OR REPLACE sí reemplaza acá porque no cambian los tipos de parámetro.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_set_school_custom_price(
    p_school_id          uuid,
    p_custom_price_cents integer,
    p_billing_cycle      text DEFAULT NULL,
    p_period_start       date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_effective_cycle text;
    v_period_end      date;
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

    IF p_billing_cycle IS NOT NULL AND p_billing_cycle NOT IN ('monthly', 'quarterly', 'semiannual', 'annual') THEN
        RAISE EXCEPTION 'billing_cycle debe ser monthly, quarterly, semiannual o annual' USING ERRCODE = '22023';
    END IF;

    IF p_period_start IS NOT NULL THEN
        SELECT COALESCE(p_billing_cycle, billing_cycle) INTO v_effective_cycle
          FROM public.school_subscriptions
         WHERE school_id = p_school_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id
                USING ERRCODE = '23503';
        END IF;

        v_period_end := p_period_start + CASE v_effective_cycle
            WHEN 'quarterly'   THEN INTERVAL '3 months'
            WHEN 'semiannual'  THEN INTERVAL '6 months'
            WHEN 'annual'      THEN INTERVAL '1 year'
            ELSE INTERVAL '1 month'
        END;
    END IF;

    UPDATE public.school_subscriptions
       SET custom_price_cents   = p_custom_price_cents,
           billing_cycle        = COALESCE(p_billing_cycle, billing_cycle),
           current_period_start = COALESCE(p_period_start::timestamptz, current_period_start),
           current_period_end   = COALESCE(v_period_end::timestamptz, current_period_end),
           updated_at           = now()
     WHERE school_id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id
            USING ERRCODE = '23503';
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'school_id', p_school_id,
        'custom_price_cents', p_custom_price_cents,
        'billing_cycle', COALESCE(p_billing_cycle, (SELECT billing_cycle FROM public.school_subscriptions WHERE school_id = p_school_id)),
        'current_period_start', (SELECT current_period_start FROM public.school_subscriptions WHERE school_id = p_school_id),
        'current_period_end', (SELECT current_period_end FROM public.school_subscriptions WHERE school_id = p_school_id)
    );
END;
$$;

COMMENT ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text, date) IS
    'Super-admin (o el proceso del BFF) fija/quita el precio negociado de la '
    'factura SaaS de una escuela, su billing_cycle (monthly/quarterly/'
    'semiannual/annual), y opcionalmente reinicia el período vigente. NO '
    'genera factura nueva por sí sola.';

REVOKE ALL ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text, date) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
