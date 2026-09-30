-- =============================================================================
-- 20260929183752_saas_factura_adicionales_y_ciclo.sql
-- Autor: brylop   Fecha: 2026-09-29   Versión anterior: 20260926131340
-- Objetivo: tres fallas de la facturación SaaS SportMaps → escuelas.
--
--   1. EL CICLO DIARIO NUNCA CORRIÓ. run_saas_billing_cycle(),
--      generate_school_subscription_invoice() y admin_set_school_custom_price()
--      reconocían al BFF con `session_user IN ('service_role', …)`. Por
--      PostgREST, session_user es SIEMPRE `authenticator` (el rol se cambia con
--      SET ROLE, que mueve current_user, no session_user). Resultado: 403 todos
--      los días a las 06:20 desde 2026-08-24 — ninguna factura pasó a
--      `overdue`, no salió un solo recordatorio y el 1-oct no se iba a generar
--      la factura de octubre de Dynasty. El gate correcto es auth.role(), que
--      lee el claim del JWT (el patrón que ya usan fn_cancel_pt_session y
--      compañía). Se conserva session_user para postgres/supabase_admin (SQL
--      editor y migraciones), donde sí es cierto.
--
--   2. LO CORREN TRES BFF A LA VEZ (dev, stg y prod comparten esta base). Con
--      el gate arreglado, dos llamadas simultáneas avanzaban el período dos
--      veces (el UPDATE no revisaba de nuevo la condición) y mandaban el mismo
--      recordatorio por triplicado. Candado pg_try_advisory_xact_lock: el que
--      no lo consigue sale sin hacer nada; y cada UPDATE revalida su condición
--      y solo devuelve fila si de verdad escribió.
--
--   3. LA FACTURA NO SUMABA ADICIONALES. Solo cobraba el plan. Ahora el total
--      es plan (custom_price_cents o lista) + cada addon ENCENDIDO con
--      monthly_price_cents > 0, y el detalle queda congelado en
--      `line_items` al generar (cambiar un precio después no reescribe
--      facturas ya emitidas). Radio medido el 2026-09-29: el único addon con
--      precio es `invoicing` de Dynasty ($69.000, desde octubre). Las facturas
--      existentes quedan con line_items = '[]' y el consumidor cae al plan.
--
--   Además: run_saas_billing_cycle era ejecutable por PUBLIC y anon. El gate
--   las frenaba, pero no hay razón para exponerla.
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
-- 1. Detalle de la factura
-- ============================================================================
-- Cada elemento: {"kind": "plan"|"addon", "code": text, "amount_cents": int,
--                 "negotiated": bool (solo plan)}.
-- La suma de amount_cents es amount_cents de la factura. Los nombres visibles
-- los resuelve quien muestra (BFF / frontend), igual que ya se hacía con
-- plan_code.

ALTER TABLE public.school_subscription_invoices
    ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.school_subscription_invoices
    DROP CONSTRAINT IF EXISTS school_subscription_invoices_line_items_array;
ALTER TABLE public.school_subscription_invoices
    ADD CONSTRAINT school_subscription_invoices_line_items_array
    CHECK (jsonb_typeof(line_items) = 'array');

COMMENT ON COLUMN public.school_subscription_invoices.line_items IS
    'Detalle congelado al generar: plan + addons con precio. Vacío en facturas '
    'anteriores a 20260929183752 (el total es solo el plan).';

-- ============================================================================
-- 2. generate_school_subscription_invoice: gate + adicionales
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_school_subscription_invoice(p_school_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_sub            public.school_subscriptions%ROWTYPE;
    v_plan_cents     integer;
    v_addons_cents   integer;
    v_items          jsonb;
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
        OR auth.role() = 'service_role'
        OR session_user IN ('postgres', 'supabase_admin')
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

    SELECT MAX(period_end) INTO v_ultimo_fin
      FROM public.school_subscription_invoices
     WHERE school_id = p_school_id AND status <> 'cancelled';

    v_period_start := COALESCE(v_ultimo_fin, v_sub.current_period_start::date, CURRENT_DATE);
    v_period_end   := v_period_start + INTERVAL '1 month';
    v_due_date     := v_period_start + INTERVAL '5 days';

    -- Espejo de ACADEMY_TIERS.priceCents (frontend/src/config/saas-plans.ts).
    v_plan_cents := COALESCE(
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

    -- Addons encendidos con precio. El período de la factura es siempre de un
    -- mes (ver v_period_end), así que el precio mensual va una vez.
    SELECT COALESCE(SUM(a.monthly_price_cents), 0)::integer,
           COALESCE(jsonb_agg(jsonb_build_object(
               'kind', 'addon',
               'code', a.addon_key,
               'amount_cents', a.monthly_price_cents
           ) ORDER BY a.addon_key), '[]'::jsonb)
      INTO v_addons_cents, v_items
      FROM public.school_addons a
     WHERE a.school_id = p_school_id
       AND a.enabled
       AND a.monthly_price_cents > 0;

    v_items := jsonb_build_array(jsonb_build_object(
                   'kind', 'plan',
                   'code', v_sub.plan_code,
                   'amount_cents', v_plan_cents,
                   'negotiated', v_sub.custom_price_cents IS NOT NULL
               )) || v_items;

    v_seq := v_sub.next_invoice_number;
    v_invoice_number := 'SM-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_seq::text, 5, '0');

    INSERT INTO public.school_subscription_invoices (
        school_id, invoice_number, plan_code, amount_cents, line_items,
        period_start, period_end, due_date, status
    ) VALUES (
        p_school_id, v_invoice_number, v_sub.plan_code, v_plan_cents + v_addons_cents, v_items,
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

REVOKE ALL ON FUNCTION public.generate_school_subscription_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_school_subscription_invoice(uuid) TO authenticated, service_role;

-- ============================================================================
-- 3. run_saas_billing_cycle: gate + candado + UPDATEs que revalidan
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_saas_billing_cycle()
RETURNS TABLE(invoice_id uuid, kind text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    r record;
    v_new_id uuid;
BEGIN
    IF NOT (
        public.is_super_admin()
        OR auth.role() = 'service_role'
        OR session_user IN ('postgres', 'supabase_admin')
    ) THEN
        RAISE EXCEPTION 'run_saas_billing_cycle es solo para el BFF o super_admin' USING ERRCODE = '42501';
    END IF;

    -- Tres BFF lo disparan a la misma hora contra esta base. El que no consigue
    -- el candado no hace nada: el que lo tiene ya está procesando. El candado
    -- se suelta al terminar la transacción; quien llegue después encuentra
    -- todo hecho (cada paso de abajo revalida su condición).
    IF NOT pg_try_advisory_xact_lock(hashtext('run_saas_billing_cycle')) THEN
        RETURN;
    END IF;

    UPDATE public.school_subscription_invoices
       SET status = 'overdue', updated_at = now()
     WHERE status = 'pending' AND due_date < CURRENT_DATE;

    FOR r IN
        SELECT sub.school_id
          FROM public.school_subscriptions sub
         WHERE sub.saas_billing_enabled = true
           AND sub.billing_cycle = 'monthly'
           AND sub.current_period_end IS NOT NULL
           AND sub.current_period_end <= now()
    LOOP
        UPDATE public.school_subscriptions
           SET current_period_start = current_period_end,
               current_period_end   = current_period_end + INTERVAL '1 month'
         WHERE school_subscriptions.school_id = r.school_id
           AND school_subscriptions.current_period_end <= now();

        IF FOUND THEN
            v_new_id := public.generate_school_subscription_invoice(r.school_id);
            invoice_id := v_new_id;
            kind := 'new';
            RETURN NEXT;
        END IF;
    END LOOP;

    FOR r IN
        SELECT inv.id AS r_id,
               CASE
                   WHEN inv.status = 'overdue' THEN 'reminder_overdue'
                   WHEN inv.due_date = CURRENT_DATE THEN 'reminder_due'
                   ELSE 'reminder_before'
               END AS r_kind
          FROM public.school_subscription_invoices inv
         WHERE inv.status IN ('pending', 'overdue')
           AND inv.due_date <= CURRENT_DATE + INTERVAL '2 days'
           AND (inv.reminder_sent_at IS NULL OR inv.reminder_sent_at < CURRENT_DATE)
    LOOP
        UPDATE public.school_subscription_invoices
           SET reminder_stage   = replace(r.r_kind, 'reminder_', ''),
               reminder_sent_at = now()
         WHERE id = r.r_id
           AND (reminder_sent_at IS NULL OR reminder_sent_at < CURRENT_DATE);

        IF FOUND THEN
            invoice_id := r.r_id;
            kind := r.r_kind;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.run_saas_billing_cycle() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_saas_billing_cycle() TO authenticated, service_role;

-- ============================================================================
-- 4. admin_set_school_custom_price: solo el gate (mismo cuerpo)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_set_school_custom_price(
    p_school_id uuid,
    p_custom_price_cents integer,
    p_billing_cycle text DEFAULT NULL::text,
    p_period_start date DEFAULT NULL::date,
    p_billing_emails text[] DEFAULT NULL::text[]
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
        OR auth.role() = 'service_role'
        OR session_user IN ('postgres', 'supabase_admin')
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

REVOKE ALL ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text, date, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_custom_price(uuid, integer, text, date, text[]) TO authenticated, service_role;

COMMIT;
