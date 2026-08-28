-- =============================================================================
-- 20260828173903_school_subscriptions_precio_negociado.sql
-- Autor: brylop   Fecha: 2026-08-28   Versión anterior: 20260827231724
-- Objetivo: generate_school_subscription_invoice (20260824180914) factura SIEMPRE
-- el precio de catálogo del plan_code, hardcodeado en un CASE. Un cliente real
-- con precio negociado (DYNASTY VOLLEY CLUB — Elite pactado en $249.000/año, no
-- el catálogo de $349.000/mes) no tiene forma de facturarse correcto por este
-- mecanismo. Esta migración agrega:
--   1. school_subscriptions.custom_price_cents — override nullable. NULL = usa
--      el precio de catálogo (comportamiento actual, sin cambios). Con valor,
--      generate_school_subscription_invoice lo prefiere sobre el CASE.
--   2. admin_set_school_custom_price(school, custom_price_cents, billing_cycle)
--      — RPC super-admin para setear el override y (opcional) el ciclo desde
--      AdminSubscriptionsPage, en vez de UPDATE suelto.
--   3. generate_school_subscription_invoice: CREATE OR REPLACE, mismo cuerpo +
--      COALESCE(custom_price_cents, CASE...). NO toca el guard (super_admin O
--      service_role, ya correcto desde 20260824180914).
-- No cubre ciclo automático anual (run_saas_billing_cycle ya excluye
-- billing_cycle='annual' a propósito — "se atiende cuando aparezca la primera
-- escuela real en anual, no antes". Dynasty es esa primera, pero el envío
-- sigue siendo manual vía "Activar/reenviar facturación" hasta que se
-- construya el ciclo anual — fuera de alcance acá).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ============================================================================
-- 1. Override de precio negociado
-- ============================================================================

ALTER TABLE public.school_subscriptions
    ADD COLUMN IF NOT EXISTS custom_price_cents integer;

ALTER TABLE public.school_subscriptions
    DROP CONSTRAINT IF EXISTS school_subscriptions_custom_price_cents_check;
ALTER TABLE public.school_subscriptions
    ADD CONSTRAINT school_subscriptions_custom_price_cents_check
    CHECK (custom_price_cents IS NULL OR custom_price_cents >= 0);

COMMENT ON COLUMN public.school_subscriptions.custom_price_cents IS
    'Override de precio negociado para la factura SaaS de esta escuela. NULL '
    '(default, la inmensa mayoría) = usa el precio de catálogo por plan_code '
    '(ACADEMY_TIERS en frontend/src/config/saas-plans.ts, espejado en el CASE '
    'de generate_school_subscription_invoice). Con valor, ese RPC lo prefiere '
    'sobre el catálogo. Se setea vía admin_set_school_custom_price, no a mano.';

-- ============================================================================
-- 2. generate_school_subscription_invoice: preferir el override
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_school_subscription_invoice(p_school_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_sub            public.school_subscriptions%ROWTYPE;
    v_price_cents    integer;
    v_period_start   date;
    v_period_end     date;
    v_due_date       date;
    v_invoice_id     uuid;
    v_invoice_number text;
    v_seq            integer;
BEGIN
    IF NOT (
        public.is_super_admin()
        OR session_user IN ('service_role', 'postgres', 'supabase_admin')
    ) THEN
        RAISE EXCEPTION 'solo super_admin o el proceso del BFF pueden generar facturas SaaS' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_sub
      FROM public.school_subscriptions
     WHERE school_id = p_school_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id
            USING ERRCODE = '23503';
    END IF;

    v_period_start := COALESCE(v_sub.current_period_start::date, CURRENT_DATE);
    v_period_end   := COALESCE(v_sub.current_period_end::date, (CURRENT_DATE + INTERVAL '1 month')::date);
    v_due_date     := v_period_start + INTERVAL '5 days';

    -- Precio negociado primero; si no hay, precio de lista (espejo de
    -- ACADEMY_TIERS.priceCents en frontend/src/config/saas-plans.ts).
    v_price_cents := COALESCE(
        v_sub.custom_price_cents,
        CASE v_sub.plan_code
            WHEN 'starter'     THEN 0
            WHEN 'start'       THEN 6900000
            WHEN 'crecimiento' THEN 9900000
            WHEN 'profesional' THEN 15900000
            WHEN 'elite'       THEN 34900000
            ELSE 0
        END
    );

    v_seq := v_sub.next_invoice_number;
    v_invoice_number := 'SM-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_seq::text, 5, '0');

    INSERT INTO public.school_subscription_invoices (
        school_id, invoice_number, plan_code, amount_cents,
        period_start, period_end, due_date, status
    ) VALUES (
        p_school_id, v_invoice_number, v_sub.plan_code, v_price_cents,
        v_period_start, v_period_end, v_due_date, 'pending'
    )
    ON CONFLICT (school_id, period_start) DO NOTHING
    RETURNING id INTO v_invoice_id;

    IF v_invoice_id IS NULL THEN
        SELECT id INTO v_invoice_id
          FROM public.school_subscription_invoices
         WHERE school_id = p_school_id AND period_start = v_period_start;
        RETURN v_invoice_id;
    END IF;

    UPDATE public.school_subscriptions
       SET next_invoice_number = v_seq + 1
     WHERE school_id = p_school_id;

    RETURN v_invoice_id;
END;
$$;

COMMENT ON FUNCTION public.generate_school_subscription_invoice(uuid) IS
    'Crea (o devuelve la ya existente) la factura SaaS del período vigente para '
    'una escuela. Usa custom_price_cents si está seteado, si no el precio de '
    'catálogo por plan_code. Idempotente por UNIQUE(school_id, period_start). '
    'La llaman admin_set_saas_billing_enabled (super_admin, primera factura), '
    'admin_set_school_custom_price (reenvío tras cambiar el precio) y '
    'run_saas_billing_cycle (BFF/service_role, ciclo automático mensual).';

REVOKE ALL ON FUNCTION public.generate_school_subscription_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_school_subscription_invoice(uuid) TO authenticated, service_role;

-- ============================================================================
-- 3. RPC: admin_set_school_custom_price — setear precio negociado + ciclo
-- ============================================================================

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
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede fijar un precio negociado' USING ERRCODE = '42501';
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
    'Super-admin: fija (o quita, con NULL) el precio negociado de la factura '
    'SaaS de una escuela, y opcionalmente su billing_cycle. NO genera factura '
    'nueva por sí sola — eso lo dispara admin_set_saas_billing_enabled (primera '
    'vez) o el reenvío manual desde AdminSubscriptionsPage.';

REVOKE ALL ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
