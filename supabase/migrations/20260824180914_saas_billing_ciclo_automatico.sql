-- =============================================================================
-- 20260824180914_saas_billing_ciclo_automatico.sql
-- Autor: brylop   Fecha: 2026-08-24   Versión anterior: 20260824173813
-- Objetivo: Fase 1 de facturación SaaS SportMaps → escuelas. La Fase 0
-- (20260824173813) dejó el interruptor manual + la primera factura; esta
-- migración agrega el ciclo automático mensual y los recordatorios de 3
-- etapas (antes de vencer / el día que vence / en mora).
--
-- DECISIÓN DE ARQUITECTURA — por qué NO hay pg_cron + Edge Function acá:
-- El patrón "pg_cron -> net.http_post -> Edge Function -> BFF" existe en el
-- repo (recurring-charges-daily, supabase/functions/run-recurring-charges)
-- pero se verificó contra la base viva que ESE job NO está en cron.job hoy
-- (no aparece en el listado de jobs activos) y las GUCs que necesita
-- (app.supabase_url, app.supabase_anon_key) tampoco están seteadas —
-- construir Fase 1 sobre el mismo mecanismo habría heredado una cadena sin
-- probar. TODOS los jobs que sí están activos en cron.job son SQL puro
-- (generate-monthly-charges-daily, apply-late-fees-daily, etc.), y todo lo
-- que necesita Node (emails, PDFs) ya usa un `node-cron` DENTRO del proceso
-- del BFF (bff/src/jobs/maintenance.job.ts) — exactamente como
-- notifications-dispatch.job.ts drena el outbox de push cada minuto. Esta
-- fase sigue ESE patrón: el cron diario vive en maintenance.job.ts
-- (saas-billing-cycle.job.ts) y llama a las RPCs de acá.
--
-- Qué agrega esta migración (solo DB — el cron Node va en el mismo commit
-- del lado bff/src/jobs):
--   1. generate_school_subscription_invoice: se reemplaza el guard para que
--      además de super_admin, pase el propio proceso del BFF (session_user
--      = service_role), igual que enforce_branding_via_rpc.
--   2. run_saas_billing_cycle(): SQL puro — flip a overdue de lo vencido,
--      avanza el período y genera la próxima factura de las escuelas con
--      saas_billing_enabled=true, y calcula qué facturas necesitan
--      recordatorio hoy. Devuelve (invoice_id, kind) para que el BFF sepa
--      qué mandar por email; el push in-app NO depende de esto — se inserta
--      directo en notifications, que ya tiene su propio dispatcher.
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
-- 1. generate_school_subscription_invoice: permitir también al BFF
--    (session_user = service_role), no solo al super_admin autenticado.
--    Mismo idioma que enforce_branding_via_rpc (20260528000002).
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

    v_price_cents := CASE v_sub.plan_code
        WHEN 'starter'     THEN 0
        WHEN 'start'       THEN 6900000
        WHEN 'crecimiento' THEN 9900000
        WHEN 'profesional' THEN 15900000
        WHEN 'elite'       THEN 34900000
        ELSE 0
    END;

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
    'una escuela. Idempotente por UNIQUE(school_id, period_start). La llaman '
    'admin_set_saas_billing_enabled (super_admin, primera factura) y '
    'run_saas_billing_cycle (BFF/service_role, ciclo automático).';

GRANT EXECUTE ON FUNCTION public.generate_school_subscription_invoice(uuid) TO authenticated, service_role;

-- ============================================================================
-- 2. run_saas_billing_cycle(): el cron diario del BFF llama a esto.
--    Puro SQL — no envía nada, solo deja la base lista y dice qué mandar.
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
        OR session_user IN ('service_role', 'postgres', 'supabase_admin')
    ) THEN
        RAISE EXCEPTION 'run_saas_billing_cycle es solo para el BFF o super_admin' USING ERRCODE = '42501';
    END IF;

    -- 2a. Lo que seguía pending y ya venció pasa a overdue.
    UPDATE public.school_subscription_invoices
       SET status = 'overdue', updated_at = now()
     WHERE status = 'pending' AND due_date < CURRENT_DATE;

    -- 2b. Escuelas cuyo período terminó: avanzar período y generar la próxima
    --     factura. Solo billing_cycle='monthly' — 'annual' queda fuera de esta
    --     fase (no hay ninguna escuela real en annual hoy; se atiende cuando
    --     aparezca la primera, no antes).
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
         WHERE school_subscriptions.school_id = r.school_id;

        v_new_id := public.generate_school_subscription_invoice(r.school_id);
        invoice_id := v_new_id;
        kind := 'new';
        RETURN NEXT;
    END LOOP;

    -- 2c. Recordatorios de 3 etapas: 2 días antes de vencer, el día que vence,
    --     y en mora. Uno por día por factura (reminder_sent_at < hoy).
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
         WHERE id = r.r_id;
        invoice_id := r.r_id;
        kind := r.r_kind;
        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.run_saas_billing_cycle() IS
    'Ciclo diario de facturación SaaS: flip a overdue, genera la próxima '
    'factura de escuelas con período vencido, y calcula recordatorios de 3 '
    'etapas. Devuelve (invoice_id, kind) para que el BFF (bff/src/jobs/'
    'saas-billing-cycle.job.ts) genere el PDF y mande email — el push in-app '
    'no depende de esto. Llamado por node-cron dentro del proceso del BFF, '
    'NO por pg_cron (ver comentario de cabecera de esta migración).';

GRANT EXECUTE ON FUNCTION public.run_saas_billing_cycle() TO service_role, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
