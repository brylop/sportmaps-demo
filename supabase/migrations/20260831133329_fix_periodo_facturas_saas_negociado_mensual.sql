-- =============================================================================
-- 20260831133329_fix_periodo_facturas_saas_negociado_mensual.sql
-- Autor: brylop   Fecha: 2026-08-31   Versión anterior: 20260831115511
-- Objetivo: generate_school_subscription_invoice() facturaba TODO el rango de
-- current_period_start/current_period_end como un solo cobro — para un ciclo
-- semestral eso generó una factura de $100.000 "por 6 meses" en vez de 6
-- facturas de $100.000, una por mes. Confirmado con GYM RM (real, primer caso
-- de ciclo semestral): el precio negociado se factura CADA MES; el
-- billing_cycle (quarterly/semiannual/annual) solo define cuánto tiempo ese
-- precio queda CONGELADO antes de poder revisarse — no es un cobro único por
-- todo el período. current_period_start/end de school_subscriptions sigue
-- representando la vigencia del precio negociado (eso no cambia); lo que
-- cambia es que una factura individual ya no copia ese rango completo.
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
-- 1. UNIQUE(school_id, period_start) → índice único PARCIAL que ignora las
--    canceladas. Sin esto, cancelar una factura mal generada (como pasó hoy
--    con GYM RM, dos veces) deja el período "tomado" para siempre: cualquier
--    intento de regenerar para ese mismo mes choca contra la fila cancelada
--    y ON CONFLICT DO NOTHING devuelve la vieja en vez de crear la correcta.
-- ============================================================================

ALTER TABLE public.school_subscription_invoices
    DROP CONSTRAINT IF EXISTS school_subscription_invoices_school_id_period_start_key;

CREATE UNIQUE INDEX IF NOT EXISTS school_subscription_invoices_school_period_activa
    ON public.school_subscription_invoices (school_id, period_start)
    WHERE status <> 'cancelled';

COMMENT ON INDEX public.school_subscription_invoices_school_period_activa IS
    'Reemplaza al UNIQUE(school_id, period_start) plano: una factura cancelada '
    'no bloquea regenerar otra para el mismo period_start (2026-08-31, caso '
    'real GYM RM — la primera y segunda factura semestral se cancelaron por '
    'período mal calculado, y hacía falta poder generar la correcta para el '
    'mismo mes).';

-- ============================================================================
-- 2. generate_school_subscription_invoice(): el período de CADA factura es
--    siempre 1 mes, avanzando desde la última factura activa (no cancelada)
--    de la escuela — no desde current_period_start/end, que ahora solo
--    describe la vigencia del precio negociado, no el rango de una factura.
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
    v_ultimo_fin     date;
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

    -- Punto de partida: el fin de la última factura ACTIVA (no cancelada) de
    -- esta escuela. Si no hay ninguna todavía, arranca en current_period_start
    -- (o hoy, si tampoco eso está seteado) — igual que antes para el primer
    -- ciclo. Cada factura siguiente avanza 1 mes exacto desde la anterior,
    -- sin importar el billing_cycle: mensual, trimestral, semestral o anual
    -- se facturan todos mes a mes, la diferencia es solo cuánto dura el
    -- precio congelado antes de poder revisarse.
    SELECT MAX(period_end) INTO v_ultimo_fin
      FROM public.school_subscription_invoices
     WHERE school_id = p_school_id AND status <> 'cancelled';

    v_period_start := COALESCE(v_ultimo_fin, v_sub.current_period_start::date, CURRENT_DATE);
    v_period_end   := v_period_start + INTERVAL '1 month';
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
    ON CONFLICT (school_id, period_start) WHERE status <> 'cancelled' DO NOTHING
    RETURNING id INTO v_invoice_id;

    IF v_invoice_id IS NULL THEN
        SELECT id INTO v_invoice_id
          FROM public.school_subscription_invoices
         WHERE school_id = p_school_id AND period_start = v_period_start AND status <> 'cancelled';
        RETURN v_invoice_id;
    END IF;

    UPDATE public.school_subscriptions
       SET next_invoice_number = v_seq + 1
     WHERE school_id = p_school_id;

    RETURN v_invoice_id;
END;
$$;

COMMENT ON FUNCTION public.generate_school_subscription_invoice(uuid) IS
    'Crea (o devuelve la ya existente y activa) la factura SaaS del próximo mes '
    'sin facturar para esta escuela. SIEMPRE 1 mes, avanzando desde el fin de '
    'la última factura activa — el billing_cycle de school_subscriptions no '
    'cambia el rango de la factura, solo cuánto dura congelado el precio '
    'negociado (current_period_end). Idempotente por período vía el índice '
    'parcial que ignora canceladas.';

COMMIT;

NOTIFY pgrst, 'reload schema';
