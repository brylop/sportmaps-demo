-- =============================================================================
-- 20260828224354_admin_set_custom_price_period_start.sql
-- Autor: brylop   Fecha: 2026-08-28   Versión anterior: 20260828174447
-- Objetivo: admin_set_school_custom_price fija precio/ciclo pero no el
-- período. Dynasty cierra su trato anual hoy (2026-08-28) con
-- current_period_start/end todavía en el ciclo mensual viejo (27-jun a
-- 27-jul, vencido) — sin poder fijar el período, la próxima factura saldría
-- con esas fechas en vez de arrancar en septiembre 2026, que es cuando
-- realmente arranca el año contratado.
-- Se agrega p_period_start (date, DEFAULT NULL — no rompe llamadas
-- existentes). Con valor, fija current_period_start = p_period_start y
-- current_period_end = +1 mes o +1 año según el billing_cycle EFECTIVO
-- (el que se pasa en esta misma llamada, o si no el que ya tenía la fila).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

-- CREATE OR REPLACE con un parámetro nuevo NO reemplaza la función anterior:
-- Postgres distingue funciones por firma completa (nombre + tipos), así que
-- (uuid,integer,text) y (uuid,integer,text,date) quedarían como DOS funciones
-- sobrecargadas — ambigüedad segura para PostgREST al llamar con 3 args.
-- Se dropea la firma vieja explícitamente antes de crear la nueva.
DROP FUNCTION IF EXISTS public.admin_set_school_custom_price(uuid, integer, text);

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

    IF p_billing_cycle IS NOT NULL AND p_billing_cycle NOT IN ('monthly', 'annual') THEN
        RAISE EXCEPTION 'billing_cycle debe ser monthly o annual' USING ERRCODE = '22023';
    END IF;

    IF p_period_start IS NOT NULL THEN
        SELECT COALESCE(p_billing_cycle, billing_cycle) INTO v_effective_cycle
          FROM public.school_subscriptions
         WHERE school_id = p_school_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id
                USING ERRCODE = '23503';
        END IF;

        v_period_end := p_period_start + CASE v_effective_cycle WHEN 'annual' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END;
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
    'factura SaaS de una escuela, su billing_cycle, y opcionalmente reinicia '
    'el período vigente (current_period_start/end) — útil cuando el trato '
    'arranca en un mes distinto al que quedó del ciclo anterior. NO genera '
    'factura nueva por sí sola.';

REVOKE ALL ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text, date) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
