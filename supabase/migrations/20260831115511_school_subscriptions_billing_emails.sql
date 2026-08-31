-- =============================================================================
-- 20260831115511_school_subscriptions_billing_emails.sql
-- Autor: brylop   Fecha: 2026-08-31   Versión anterior: 20260831095348
-- Objetivo: hoy la factura SaaS solo llega a los profiles con rol owner/admin
-- en school_members (loadSchoolAdmins en saasInvoicing.service.ts). Para
-- tratos comerciales (GYM RM, Dynasty) el contacto de facturación real —
-- contabilidad, un tercero — no siempre tiene cuenta en la escuela. Se agrega
-- billing_emails a school_subscriptions: correos ADICIONALES que se suman a
-- los admins de la escuela (no los reemplazan), configurables desde el mismo
-- panel "Precio negociado" de AdminSubscriptionsPage.
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
-- 1. Columna nueva: lista de correos adicionales para la factura SaaS.
--    NULL = nunca se configuró (comportamiento de hoy, sin cambios).
--    '{}' = se configuró y se vació a propósito (botón "Quitar" del frontend).
-- ============================================================================

ALTER TABLE public.school_subscriptions
    ADD COLUMN IF NOT EXISTS billing_emails text[];

COMMENT ON COLUMN public.school_subscriptions.billing_emails IS
    'Correos adicionales para la factura SaaS de esta escuela (se SUMAN a los '
    'admins/owners de school_members, no los reemplazan). NULL = sin '
    'configurar. Pensado para el contacto de facturación de un trato '
    'comercial (contabilidad externa, etc.) que no tiene cuenta en la '
    'escuela. Lo consume sendSaasInvoice() en saasInvoicing.service.ts.';

-- ============================================================================
-- 2. admin_set_school_custom_price: nuevo parámetro p_billing_emails al
--    final con DEFAULT NULL — mismo patrón ya usado para agregar
--    p_billing_cycle y p_period_start en migraciones anteriores. NULL =
--    no tocar el valor guardado; ARRAY[]::text[] = vaciar la lista.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_set_school_custom_price(
    p_school_id          uuid,
    p_custom_price_cents integer,
    p_billing_cycle      text DEFAULT NULL,
    p_period_start       date DEFAULT NULL,
    p_billing_emails     text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_effective_cycle text;
    v_period_end      date;
    v_email           text;
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

    IF p_billing_emails IS NOT NULL THEN
        FOREACH v_email IN ARRAY p_billing_emails LOOP
            IF v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
                RAISE EXCEPTION 'correo de facturación inválido: %', v_email USING ERRCODE = '22023';
            END IF;
        END LOOP;
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
           billing_emails       = COALESCE(p_billing_emails, billing_emails),
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
        'current_period_end', (SELECT current_period_end FROM public.school_subscriptions WHERE school_id = p_school_id),
        'billing_emails', (SELECT billing_emails FROM public.school_subscriptions WHERE school_id = p_school_id)
    );
END;
$$;

COMMENT ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text, date, text[]) IS
    'Super-admin (o el proceso del BFF) fija/quita el precio negociado de la '
    'factura SaaS de una escuela, su billing_cycle (monthly/quarterly/'
    'semiannual/annual), opcionalmente reinicia el período vigente, y '
    'opcionalmente fija los correos adicionales (billing_emails) que se SUMAN '
    'a los admins de la escuela al enviar la factura. NO genera factura '
    'nueva por sí sola.';

REVOKE ALL ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text, date, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text, date, text[]) TO authenticated, service_role;

-- La versión de 4 parámetros (anterior a esta migración) queda huérfana: nadie
-- la llama ya (frontend y BFF apuntan al mismo nombre con 5 argumentos, y
-- Postgres resuelve por firma completa), pero se limpia para no dejar dos
-- RPCs activas con el mismo nombre y comportamiento parcialmente distinto.
DROP FUNCTION IF EXISTS public.admin_set_school_custom_price(uuid, integer, text, date);

COMMIT;

NOTIFY pgrst, 'reload schema';
