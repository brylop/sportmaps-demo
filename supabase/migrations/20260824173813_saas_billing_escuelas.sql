-- =============================================================================
-- 20260824173813_saas_billing_escuelas.sql
-- Autor: brylop   Fecha: 2026-08-24   Versión anterior: 20260824171232
-- Objetivo: Fase 0 de facturación SaaS SportMaps → escuelas. Hoy
-- school_subscriptions guarda plan/tier/estado pero nada genera un cobro
-- cuando el ciclo se renueva ("el cobro se gestiona aparte", literal en
-- AdminSubscriptionsPage.tsx). Esta migración agrega:
--   1. Un interruptor `saas_billing_enabled` por escuela, DISTINTO de
--      school_settings.billing_enabled (ese es cobros a familias).
--   2. La tabla school_subscription_invoices: un recibo informal por ciclo,
--      sin pasarela conectada — se concilia a mano (mark-paid), igual que
--      hoy se registran a mano los pagos por transferencia.
--   3. RPC admin_set_saas_billing_enabled: al activar por primera vez,
--      genera y deja lista la primera factura de inmediato.
--   4. RPC generate_school_subscription_invoice: idempotente por
--      UNIQUE(school_id, period_start), la reutiliza el ciclo automático
--      de la Fase 1 (todavía no construida).
--   5. Bucket de Storage privado `saas-invoices` para los PDF.
--   6. Seed en platform_config de la cuenta donde SportMaps recibe el
--      pago (Bre-B Nequi Negocios) — dato editable, no hardcode en el PDF.
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
-- 1. Interruptor de facturación SaaS por escuela
-- ============================================================================

ALTER TABLE public.school_subscriptions
    ADD COLUMN IF NOT EXISTS saas_billing_enabled    boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS saas_billing_enabled_at  timestamptz,
    ADD COLUMN IF NOT EXISTS next_invoice_number      integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.school_subscriptions.saas_billing_enabled IS
    'true = SportMaps le factura la mensualidad SaaS a esta escuela (recibo informal, '
    'no fiscal). NO confundir con school_settings.billing_enabled, que es si la escuela '
    'cobra mensualidades a SUS familias. Lo activa el super admin '
    '(admin_set_saas_billing_enabled); activarlo dispara la primera factura.';

-- ============================================================================
-- 2. Tabla school_subscription_invoices
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.school_subscription_invoices (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    invoice_number      text        NOT NULL,
    plan_code           text        NOT NULL,
    amount_cents        integer     NOT NULL,
    period_start        date        NOT NULL,
    period_end          date        NOT NULL,
    due_date            date        NOT NULL,
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    pdf_object_path     text,
    marked_paid_by      uuid        REFERENCES public.profiles(id),
    marked_paid_at      timestamptz,
    sent_email_at       timestamptz,
    sent_push_at        timestamptz,
    whatsapp_opened_at  timestamptz,
    reminder_stage      text        CHECK (reminder_stage IN ('before', 'due', 'overdue')),
    reminder_sent_at    timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (school_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_school_subscription_invoices_school
    ON public.school_subscription_invoices(school_id);
CREATE INDEX IF NOT EXISTS idx_school_subscription_invoices_pending
    ON public.school_subscription_invoices(status)
    WHERE status IN ('pending', 'overdue');

COMMENT ON TABLE public.school_subscription_invoices IS
    'Recibo informal por ciclo de la mensualidad SaaS que la escuela le paga a '
    'SportMaps. No es factura electrónica DIAN (eso es invoicing.service.ts, para '
    'escuela→padre). Sin pasarela conectada: status pasa a paid por conciliación '
    'manual (mark-paid), igual que los pagos por transferencia que ya se registran '
    'a mano en el resto del producto.';

DROP TRIGGER IF EXISTS school_subscription_invoices_set_updated_at ON public.school_subscription_invoices;
CREATE TRIGGER school_subscription_invoices_set_updated_at
    BEFORE UPDATE ON public.school_subscription_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ── RLS: lectura admin de la escuela + super_admin. Escritura solo por RPC
--    SECURITY DEFINER o BFF con service_role (bypassa RLS) ──
ALTER TABLE public.school_subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_subscription_invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_subscription_invoices_select ON public.school_subscription_invoices;
CREATE POLICY school_subscription_invoices_select
    ON public.school_subscription_invoices
    FOR SELECT
    TO authenticated
    USING (
        (SELECT public.is_school_admin(school_id))
        OR (SELECT public.is_super_admin())
    );

DROP POLICY IF EXISTS school_subscription_invoices_super_admin_all ON public.school_subscription_invoices;
CREATE POLICY school_subscription_invoices_super_admin_all
    ON public.school_subscription_invoices
    FOR ALL
    TO authenticated
    USING ((SELECT public.is_super_admin()))
    WITH CHECK ((SELECT public.is_super_admin()));

-- ============================================================================
-- 3. RPC: generate_school_subscription_invoice
--
-- Idempotente por UNIQUE(school_id, period_start): si ya existe factura para
-- el período vigente, devuelve esa misma fila en vez de duplicar.
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
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede generar facturas SaaS' USING ERRCODE = '42501';
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

    -- Espejo de ACADEMY_TIERS.priceCents (frontend/src/config/saas-plans.ts).
    -- Si cambian los precios ahí, esta tabla se actualiza en la MISMA migración
    -- que ajuste el catálogo — es precio de lista, no config editable en runtime.
    v_price_cents := CASE v_sub.plan_code
        WHEN 'starter'     THEN 0
        WHEN 'start'       THEN 6900000
        WHEN 'crecimiento' THEN 9900000
        WHEN 'profesional' THEN 15900000
        WHEN 'elite'       THEN 34900000
        ELSE 0  -- enterprise: a cotizar, no se autogenera con precio de lista
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
        -- Ya existía factura para este período: devolverla tal cual, sin
        -- consumir un número de factura nuevo.
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
    'una escuela. Idempotente por UNIQUE(school_id, period_start). La usan '
    'admin_set_saas_billing_enabled (primera factura) y el ciclo automático de '
    'Fase 1 (todavía no construido).';

GRANT EXECUTE ON FUNCTION public.generate_school_subscription_invoice(uuid) TO authenticated;

-- ============================================================================
-- 4. RPC: admin_set_saas_billing_enabled
--
-- Al activar por primera vez, genera la primera factura en la misma
-- transacción. Desactivar NO cancela facturas ya emitidas (se concilian o se
-- cancelan a mano vía mark-paid/BFF).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_set_saas_billing_enabled(
    p_school_id uuid,
    p_enabled   boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_was_enabled      boolean;
    v_first_invoice_id uuid;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede activar la facturación SaaS' USING ERRCODE = '42501';
    END IF;

    SELECT saas_billing_enabled INTO v_was_enabled
      FROM public.school_subscriptions
     WHERE school_id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'la escuela % no tiene fila en school_subscriptions', p_school_id
            USING ERRCODE = '23503';
    END IF;

    UPDATE public.school_subscriptions
       SET saas_billing_enabled    = p_enabled,
           saas_billing_enabled_at = CASE WHEN p_enabled THEN now() ELSE saas_billing_enabled_at END,
           updated_at              = now()
     WHERE school_id = p_school_id;

    IF p_enabled AND NOT COALESCE(v_was_enabled, false) THEN
        v_first_invoice_id := public.generate_school_subscription_invoice(p_school_id);
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'school_id', p_school_id,
        'saas_billing_enabled', p_enabled,
        'first_invoice_id', v_first_invoice_id
    );
END;
$$;

COMMENT ON FUNCTION public.admin_set_saas_billing_enabled(uuid, boolean) IS
    'Interruptor del super admin para la facturación SaaS de una escuela. '
    'Activarlo por primera vez genera y deja lista la primera factura '
    '(school_subscription_invoices) en la misma llamada; el BFF se encarga '
    'después de generar el PDF y enviar el email/push.';

GRANT EXECUTE ON FUNCTION public.admin_set_saas_billing_enabled(uuid, boolean) TO authenticated;

-- ============================================================================
-- 5. Storage bucket privado para los PDF de factura
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('saas-invoices', 'saas-invoices', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "saas_invoices_storage_read" ON storage.objects;
CREATE POLICY "saas_invoices_storage_read"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'saas-invoices'
        AND EXISTS (
            SELECT 1 FROM public.school_subscription_invoices inv
             WHERE inv.pdf_object_path = storage.objects.name
               AND (
                    (SELECT public.is_super_admin())
                    OR (SELECT public.is_school_admin(inv.school_id))
               )
        )
    );

-- El INSERT real lo hace el BFF con service_role (bypassa RLS de storage.objects
-- por completo). Esta policy es el cinturón para clientes autenticados directos.
DROP POLICY IF EXISTS "saas_invoices_storage_write_admin" ON storage.objects;
CREATE POLICY "saas_invoices_storage_write_admin"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'saas-invoices'
        AND (SELECT public.is_super_admin())
    );

-- ============================================================================
-- 6. platform_config: cuenta donde SportMaps recibe el pago
--
-- Array (no objeto único) para que agregar/reemplazar cuentas más adelante
-- (ej. una cuenta empresarial con NIT) sea editar un dato, no una migración.
-- Lectura: platform_config ya está cerrada a is_super_admin() por RLS
-- (20260821201424); el BFF la lee sin fricción porque usa service_role.
-- ============================================================================

INSERT INTO public.platform_config (key, value, description) VALUES (
    'platform_payment_accounts',
    '[
        {
            "id": "breb-nequi-negocios",
            "type": "breb_nequi_negocios",
            "label": "Bre-B Nequi Negocios",
            "value": "0092968035",
            "holder_name": "sportmaps · Brayan Lopez",
            "active": true
        }
    ]'::jsonb,
    'Cuentas donde SportMaps recibe el pago de la mensualidad SaaS de las escuelas. Se lee al generar el PDF de school_subscription_invoices — cambiar aquí no requiere deploy.'
) ON CONFLICT (key) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
