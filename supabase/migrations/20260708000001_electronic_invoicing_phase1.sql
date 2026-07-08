-- ============================================================
-- SPORTMAPS — Facturación electrónica DIAN · FASE 1: modelo de datos
--
-- Capa multi-PAC (Factus, Siigo, Alegra, u OTRO cualquiera). El PAC emite la
-- factura ante la DIAN; SportMaps arma el documento canónico y lo envía por
-- API. Este archivo crea SOLO el modelo de datos + RLS. Los adaptadores
-- (bff/src/services/*.adapter.ts) y el invoice-provider.resolver llegan en la
-- Fase 2.
--
-- NAMING: se usa el prefijo `electronic_invoice_*` a propósito. Ya existe una
-- tabla `public.invoices` del dominio de logística/marketplace (facturas de
-- órdenes: order_id, invoice_type purchase/commission/payout — mig
-- 20260418000002). NO es facturación electrónica DIAN. No mezclar.
--
-- MULTI-PAC: `provider` es text libre (SIN check de valores). Agregar un
-- facturador nuevo = un adaptador nuevo en el BFF, CERO cambios de esquema.
-- credentials/config van en jsonb por lo mismo.
--
-- Ejes reutilizados:
--   - Multi-owner del Módulo Contable: owner_type/owner_id + can_manage_finances
--     (migración 20260706000001).
--   - Credenciales por dueño estilo school_payment_providers (pagos).
--
-- Calibrado con respuesta REAL del sandbox Factus (POST /v1/bills/validate):
--   bill.id, number 'SETP990035689', cufe, qr (URL DIAN), qr_image (base64),
--   public_url, document.code '01', taxable_amount/tax_amount/total, validated,
--   errors (notificaciones blandas que igual validan en sandbox).
--
-- Piezas:
--   1. Versiona columnas fiscales de profiles que el frontend YA usa sin
--      migración (billing_address, billing_state_dane, billing_city_dane).
--   2. electronic_invoice_providers — credenciales + config del PAC por dueño.
--   3. electronic_invoices          — documento electrónico emitido.
--   4. electronic_invoice_items     — líneas con base/IVA separados.
--   5. RLS con can_manage_finances. Emisión = solo service_role (BFF).
-- ============================================================

-- 0. Limpieza de un intento fallido previo -------------------------------------
--    Una versión anterior de esta migración usaba los nombres `invoice_providers`
--    / `invoice_items` y falló por colisión con `public.invoices` (logística).
--    Si un run no transaccional dejó esas tablas vacías a medias, se eliminan.
--    NO se toca `public.invoices` (pertenece a logística/marketplace).
DROP TABLE IF EXISTS public.invoice_items     CASCADE;
DROP TABLE IF EXISTS public.invoice_providers CASCADE;

-- 0.1 Guard del helper de permisos ---------------------------------------------
--    Las RLS de abajo usan public.can_manage_finances(text,uuid), creado por la
--    migración del Módulo Contable (20260706000001). Si ESA migración aún no se
--    aplicó en este ambiente, se crea aquí una versión compatible (misma firma)
--    para que la feature sea auto-suficiente. Es plpgsql (difiere la validación
--    de tablas) y guarda vendor_profiles con to_regclass, por si el marketplace
--    no está desplegado. Cuando la migración contable corra, su CREATE OR
--    REPLACE sobreescribe con la versión canónica sin conflicto.
DO $guard$
BEGIN
    IF to_regprocedure('public.can_manage_finances(text, uuid)') IS NULL THEN
        EXECUTE $fn$
            CREATE FUNCTION public.can_manage_finances(p_owner_type text, p_owner_id uuid)
            RETURNS boolean
            LANGUAGE plpgsql STABLE SECURITY DEFINER
            SET search_path = pg_catalog, public, pg_temp
            AS $body$
            DECLARE v_ok boolean := false;
            BEGIN
                IF p_owner_type = 'school' THEN
                    v_ok := public.is_school_admin(p_owner_id);
                ELSIF p_owner_type = 'organizer' THEN
                    v_ok := (p_owner_id = auth.uid());
                ELSIF p_owner_type = 'vendor'
                      AND to_regclass('public.vendor_profiles') IS NOT NULL THEN
                    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.vendor_profiles vp'
                         || ' WHERE vp.id = $1 AND vp.user_id = auth.uid())'
                        INTO v_ok USING p_owner_id;
                END IF;
                RETURN v_ok;
            END;
            $body$;
        $fn$;
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_manage_finances(text, uuid) TO authenticated';
    END IF;
END
$guard$;

-- 1. Columnas fiscales del adquirente (versionar lo que ya existe en la app) ---
--    document_type / document_number vienen de 20260311000001. Estas tres las
--    escribe frontend/src/components/billing/BillingDetailsForm.tsx pero NO
--    estaban en ninguna migración (se aplicaron directo a la DB). Se versionan
--    idempotentemente para que no se pierdan al reconstruir el esquema.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS billing_address    text,
    ADD COLUMN IF NOT EXISTS billing_state_dane text,
    ADD COLUMN IF NOT EXISTS billing_city_dane  text;

COMMENT ON COLUMN public.profiles.billing_state_dane IS
    'Departamento del adquirente para FE DIAN. Hoy texto libre; mapear a código/municipio del PAC en Fase 2.';
COMMENT ON COLUMN public.profiles.billing_city_dane IS
    'Ciudad/municipio del adquirente para FE DIAN. Hoy texto libre; mapear a municipality_id del PAC en Fase 2.';

-- 2. electronic_invoice_providers — un facturador (PAC) por dueño --------------
CREATE TABLE IF NOT EXISTS public.electronic_invoice_providers (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type   text NOT NULL CHECK (owner_type IN ('school','vendor','organizer')),
    owner_id     uuid NOT NULL,
    -- text libre a propósito: cualquier PAC (factus, siigo, alegra, …) sin
    -- tocar el esquema. Ver COMMENT.
    provider     text NOT NULL,
    -- Credenciales del PAC (solo BFF/service_role autentica con ellas). jsonb
    -- para no acoplar el esquema a un PAC: Factus usa
    -- {client_id, client_secret, username, password}; otros difieren.
    credentials  jsonb   NOT NULL DEFAULT '{}'::jsonb,
    -- Config de emisión: numbering_range_id, prefix, resolution_number,
    -- technical_key, defaults de impuesto, etc. Igual jsonb por lo mismo.
    config       jsonb   NOT NULL DEFAULT '{}'::jsonb,
    sandbox      boolean NOT NULL DEFAULT true,
    enabled      boolean NOT NULL DEFAULT true,
    is_default   boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.electronic_invoice_providers IS
    'Facturador electrónico (PAC) por dueño. provider es text libre (factus/siigo/alegra/…); credentials/config en jsonb para soportar cualquier PAC sin cambiar el esquema.';

-- Un solo facturador por defecto por dueño.
CREATE UNIQUE INDEX IF NOT EXISTS uq_einv_providers_default
    ON public.electronic_invoice_providers (owner_type, owner_id)
    WHERE is_default;
-- No repetir el mismo provider para el mismo dueño.
CREATE UNIQUE INDEX IF NOT EXISTS uq_einv_providers_owner_provider
    ON public.electronic_invoice_providers (owner_type, owner_id, provider);

-- 3. electronic_invoices — documento electrónico emitido -----------------------
CREATE TABLE IF NOT EXISTS public.electronic_invoices (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type       text NOT NULL CHECK (owner_type IN ('school','vendor','organizer')),
    owner_id         uuid NOT NULL,
    provider         text NOT NULL,               -- text libre (mismo criterio que providers)
    provider_bill_id text,                         -- id interno del PAC (Factus bill.id, ej '62726')
    payment_id       uuid REFERENCES public.payments(id) ON DELETE SET NULL,
    document_type    text NOT NULL DEFAULT 'invoice'
                          CHECK (document_type IN ('invoice','credit_note','debit_note')),
    dian_code        text,                          -- '01' factura, '91' NC, '92' ND
    prefix           text,                          -- 'SETP'
    number           text,                          -- 'SETP990035689'
    reference_code   text NOT NULL,                 -- idempotencia (generada por nosotros)
    cufe             text,
    qr_url           text,                          -- URL de verificación DIAN
    qr_image         text,                          -- data:image/png;base64,...
    public_url       text,                          -- vista pública del PAC
    pdf_url          text,
    xml_url          text,
    status           text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','queued','sent','accepted','rejected','void')),
    taxable_amount   numeric(14,2),                 -- base gravable
    tax_amount       numeric(14,2),                 -- IVA/impuestos
    total            numeric(14,2),
    currency         text NOT NULL DEFAULT 'COP',
    customer_snapshot jsonb,                        -- datos fiscales del adquirente al emitir
    dian_response    jsonb,                         -- respuesta cruda del PAC (incl. errors)
    error_message    text,
    validated_at     timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.electronic_invoices IS
    'Documento electrónico DIAN (factura/NC/ND) emitido vía un PAC. dian_response guarda la respuesta cruda para diagnóstico. NO confundir con public.invoices (logística/marketplace).';

-- Idempotencia: un reference_code no se emite dos veces por el mismo dueño.
CREATE UNIQUE INDEX IF NOT EXISTS uq_einvoices_owner_reference
    ON public.electronic_invoices (owner_type, owner_id, reference_code);
-- Búsqueda inversa desde callbacks/webhooks del PAC.
CREATE UNIQUE INDEX IF NOT EXISTS uq_einvoices_provider_bill
    ON public.electronic_invoices (provider, provider_bill_id)
    WHERE provider_bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_einvoices_payment ON public.electronic_invoices (payment_id);
CREATE INDEX IF NOT EXISTS ix_einvoices_owner   ON public.electronic_invoices (owner_type, owner_id);

-- 4. electronic_invoice_items — líneas con base/IVA separados ------------------
CREATE TABLE IF NOT EXISTS public.electronic_invoice_items (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id     uuid NOT NULL REFERENCES public.electronic_invoices(id) ON DELETE CASCADE,
    line_no        integer NOT NULL DEFAULT 1,
    code_reference text,
    name           text NOT NULL,
    quantity       numeric(14,4) NOT NULL DEFAULT 1,
    -- Precio unitario tal como lo ve el pagador (IVA incluido, como calcula
    -- Factus: total = price; base e IVA se derivan). Ver nota del sandbox.
    unit_price     numeric(14,2) NOT NULL,
    discount_rate  numeric(6,2)  NOT NULL DEFAULT 0,
    is_excluded    boolean       NOT NULL DEFAULT false,  -- excluido de IVA (educación/deporte)
    tax_rate       numeric(6,2)  NOT NULL DEFAULT 0,       -- 19.00 / 5.00 / 0.00
    tax_code       text          NOT NULL DEFAULT '01',    -- 01=IVA (Factus tributes/products)
    taxable_amount numeric(14,2),                          -- base de esta línea
    tax_amount     numeric(14,2),                          -- IVA de esta línea
    total          numeric(14,2),
    created_at     timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.electronic_invoice_items IS
    'Líneas de la factura electrónica con base/IVA por ítem. unit_price es IVA-incluido salvo is_excluded.';

CREATE INDEX IF NOT EXISTS ix_einvoice_items_invoice ON public.electronic_invoice_items (invoice_id);

-- 5. Triggers updated_at (reusa el set_updated_at() del master_plan) -----------
CREATE OR REPLACE TRIGGER trg_einv_providers_updated_at
    BEFORE UPDATE ON public.electronic_invoice_providers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_einvoices_updated_at
    BEFORE UPDATE ON public.electronic_invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. RLS -----------------------------------------------------------------------
ALTER TABLE public.electronic_invoice_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electronic_invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electronic_invoice_items     ENABLE ROW LEVEL SECURITY;

-- providers: el dueño gestiona su propio facturador (mismo criterio que
-- school_payment_providers: quien administra finanzas entra sus credenciales).
DROP POLICY IF EXISTS einv_providers_owner ON public.electronic_invoice_providers;
CREATE POLICY einv_providers_owner ON public.electronic_invoice_providers
    FOR ALL TO authenticated
    USING (public.can_manage_finances(owner_type, owner_id))
    WITH CHECK (public.can_manage_finances(owner_type, owner_id));

-- electronic_invoices: el dueño (emisor) VE sus facturas. La emisión la hace el
-- BFF con service_role (bypassa RLS), nunca el usuario directamente.
DROP POLICY IF EXISTS einvoices_owner_read ON public.electronic_invoices;
CREATE POLICY einvoices_owner_read ON public.electronic_invoices
    FOR SELECT TO authenticated
    USING (public.can_manage_finances(owner_type, owner_id));

-- electronic_invoices: el PAGADOR (padre/atleta) ve la factura de SU propio
-- pago, para descargarla desde la app. Se consulta payments (no
-- electronic_invoices) → sin self-recursion.
DROP POLICY IF EXISTS einvoices_payer_read ON public.electronic_invoices;
CREATE POLICY einvoices_payer_read ON public.electronic_invoices
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.id = electronic_invoices.payment_id
          AND p.parent_id = auth.uid()
    ));

-- electronic_invoice_items: visibles si la factura padre lo es. Se consulta
-- electronic_invoices (no la propia tabla) → sin self-recursion.
DROP POLICY IF EXISTS einvoice_items_read ON public.electronic_invoice_items;
CREATE POLICY einvoice_items_read ON public.electronic_invoice_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.electronic_invoices i
        WHERE i.id = electronic_invoice_items.invoice_id
          AND (
              public.can_manage_finances(i.owner_type, i.owner_id)
              OR EXISTS (
                  SELECT 1 FROM public.payments p
                  WHERE p.id = i.payment_id AND p.parent_id = auth.uid()
              )
          )
    ));

-- 7. Grants (RLS filtra las filas; service_role bypassa RLS) -------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.electronic_invoice_providers TO authenticated;
GRANT SELECT ON public.electronic_invoices      TO authenticated;
GRANT SELECT ON public.electronic_invoice_items TO authenticated;
GRANT ALL ON public.electronic_invoice_providers,
             public.electronic_invoices,
             public.electronic_invoice_items TO service_role;
