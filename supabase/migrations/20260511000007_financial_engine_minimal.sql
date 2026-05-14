-- ============================================================
-- SPORTMAPS MARKETPLACE — Financial engine MINIMAL
--
-- Tu DB tiene: vendor_profiles, vendor_payouts, vendor_bank_accounts, orders.
-- Le faltan:    platform_config, vendor_balances, settlements.
--
-- Esta migracion las crea con RLS + trigger auto_create_vendor_balance
-- + RPC compute_settlements_for_order (acreedita pending_balance al pago)
-- + backfill de vendor_balances para vendor_profiles existentes.
--
-- Tras aplicar esta, las RPCs de la migracion 20260511000006 (release,
-- request_payout, summary, generate) ya tienen tablas sobre las que operar.
-- ============================================================


-- ============================================================
-- 0. Asegurar tipos enum requeridos
-- ============================================================

DO $$ BEGIN
    CREATE TYPE public.settlement_status AS ENUM ('pending', 'processing', 'paid', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.fulfillment_type AS ENUM ('physical', 'digital', 'service');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================
-- 1. platform_config — pares clave/valor de config global
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_config (
    key         text        PRIMARY KEY,
    value       jsonb       NOT NULL,
    description text,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_config (key, value, description) VALUES
    ('default_commission_rate',
     '{"rate": 0.10}'::jsonb,
     'Comision por defecto de SportMaps (10%) si vendor_profiles.commission_rate es NULL.'),
    ('gateway_fee_rate',
     '{"epayco": 0.029, "wompi": 0.025, "mercadopago": 0.029, "manual": 0}'::jsonb,
     'Comision de cada pasarela de pago (fraction).'),
    ('min_payout_amount',
     '{"amount": 50000, "currency": "COP"}'::jsonb,
     'Monto minimo para que un vendor pueda solicitar liquidacion.'),
    ('escrow_release_days',
     '{"physical": 7, "digital": 1, "service": 1}'::jsonb,
     'Dias post-delivered antes de liberar settlements al available_balance.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Config visible publicamente" ON public.platform_config;
CREATE POLICY "Config visible publicamente"
    ON public.platform_config FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Solo admin modifica config" ON public.platform_config;
CREATE POLICY "Solo admin modifica config"
    ON public.platform_config FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role::text IN ('admin','super_admin')
        )
    );


-- ============================================================
-- 2. vendor_balances — running totals por vendor_profile
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_balances (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id   uuid        NOT NULL UNIQUE REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    total_earned        numeric     NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
    total_fees          numeric     NOT NULL DEFAULT 0 CHECK (total_fees >= 0),
    available_balance   numeric     NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    pending_balance     numeric     NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
    total_withdrawn     numeric     NOT NULL DEFAULT 0 CHECK (total_withdrawn >= 0),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_balances_vendor ON public.vendor_balances(vendor_profile_id);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_vendor_balances_updated_at ON public.vendor_balances $tr$;
        EXECUTE $tr$
            CREATE TRIGGER trg_vendor_balances_updated_at
            BEFORE UPDATE ON public.vendor_balances
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
        $tr$;
    END IF;
END $$;

-- Auto-crear balance al crear vendor_profile
CREATE OR REPLACE FUNCTION public.auto_create_vendor_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.vendor_balances (vendor_profile_id)
    VALUES (NEW.id)
    ON CONFLICT (vendor_profile_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_vendor_balance ON public.vendor_profiles;
CREATE TRIGGER trg_auto_vendor_balance
    AFTER INSERT ON public.vendor_profiles
    FOR EACH ROW EXECUTE FUNCTION public.auto_create_vendor_balance();

-- Backfill: crear vendor_balance para vendor_profiles existentes
INSERT INTO public.vendor_balances (vendor_profile_id)
SELECT vp.id
  FROM public.vendor_profiles vp
 WHERE NOT EXISTS (
       SELECT 1 FROM public.vendor_balances vb WHERE vb.vendor_profile_id = vp.id
 );

ALTER TABLE public.vendor_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor lee su balance" ON public.vendor_balances;
CREATE POLICY "Vendor lee su balance"
    ON public.vendor_balances FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
            WHERE vp.id = vendor_balances.vendor_profile_id
              AND vp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admin lee balances" ON public.vendor_balances;
CREATE POLICY "Admin lee balances"
    ON public.vendor_balances FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role::text IN ('admin','super_admin')
        )
    );


-- ============================================================
-- 3. settlements — un settlement por (order, vendor) al pagar
-- ============================================================

CREATE TABLE IF NOT EXISTS public.settlements (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id),
    order_id            uuid        NOT NULL REFERENCES public.orders(id),
    order_item_id       uuid,
    gross_amount        numeric     NOT NULL CHECK (gross_amount >= 0),
    platform_fee        numeric     NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    gateway_fee         numeric     NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
    tax_amount          numeric     NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    net_amount          numeric     NOT NULL CHECK (net_amount >= 0),
    status              public.settlement_status NOT NULL DEFAULT 'pending',
    paid_at             timestamptz,
    payment_reference   text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_vendor  ON public.settlements(vendor_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_settlements_order   ON public.settlements(order_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status  ON public.settlements(status);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_settlements_updated_at ON public.settlements $tr$;
        EXECUTE $tr$
            CREATE TRIGGER trg_settlements_updated_at
            BEFORE UPDATE ON public.settlements
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
        $tr$;
    END IF;
END $$;

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor lee sus settlements" ON public.settlements;
CREATE POLICY "Vendor lee sus settlements"
    ON public.settlements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
            WHERE vp.id = settlements.vendor_profile_id
              AND vp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admin lee settlements" ON public.settlements;
CREATE POLICY "Admin lee settlements"
    ON public.settlements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role::text IN ('admin','super_admin')
        )
    );


-- ============================================================
-- 4. Asegurar columnas en orders necesarias para escrow
--    (fulfillment_type controla escrow_release_days)
-- ============================================================

DO $$
BEGIN
    IF to_regclass('public.orders') IS NOT NULL THEN
        EXECUTE $sql$
            ALTER TABLE public.orders
            ADD COLUMN IF NOT EXISTS fulfillment_type public.fulfillment_type DEFAULT 'physical'
        $sql$;
        EXECUTE $sql$ ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0 $sql$;
        EXECUTE $sql$ ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_total numeric NOT NULL DEFAULT 0 $sql$;
    END IF;
END $$;


-- ============================================================
-- 5. RPC compute_settlements_for_order(order_id)
--    Llamada por el flujo de pago: cuando una order se paga,
--    crea settlements por cada vendor involucrado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_settlements_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item              RECORD;
    v_vendor_profile_id uuid;
    v_commission_rate   numeric;
    v_gateway_rate      numeric;
    v_gross             numeric;
    v_platform_fee      numeric;
    v_gateway_fee       numeric;
    v_tax               numeric;
    v_net               numeric;
    v_payment_method    text;
    v_total_settled     numeric := 0;
    v_settlements_count integer := 0;
BEGIN
    IF to_regclass('public.orders') IS NULL OR to_regclass('public.order_items') IS NULL THEN
        RETURN jsonb_build_object('error', 'missing_dependencies');
    END IF;

    SELECT payment_method INTO v_payment_method FROM public.orders WHERE id = p_order_id;

    SELECT COALESCE((value->>COALESCE(v_payment_method, 'manual'))::numeric, 0)
      INTO v_gateway_rate
      FROM public.platform_config WHERE key = 'gateway_fee_rate';
    v_gateway_rate := COALESCE(v_gateway_rate, 0);

    -- Iterar order_items agrupados por vendor
    FOR v_item IN
        SELECT
            oi.vendor_id,
            SUM(oi.unit_price * oi.quantity)                          AS gross_amount,
            COALESCE(SUM(oi.tax_amount), 0)                           AS total_tax
          FROM public.order_items oi
         WHERE oi.order_id = p_order_id
         GROUP BY oi.vendor_id
    LOOP
        SELECT vp.id, vp.commission_rate
          INTO v_vendor_profile_id, v_commission_rate
          FROM public.vendor_profiles vp
         WHERE vp.user_id = v_item.vendor_id;

        IF v_vendor_profile_id IS NULL THEN
            CONTINUE;
        END IF;

        IF v_commission_rate IS NULL THEN
            SELECT (value->>'rate')::numeric INTO v_commission_rate
              FROM public.platform_config WHERE key = 'default_commission_rate';
            v_commission_rate := COALESCE(v_commission_rate, 0.10);
        END IF;

        v_gross         := v_item.gross_amount;
        v_platform_fee  := v_gross * v_commission_rate;
        v_gateway_fee   := v_gross * v_gateway_rate;
        v_tax           := COALESCE(v_item.total_tax, 0);
        v_net           := v_gross - v_platform_fee - v_gateway_fee;

        -- Evitar duplicados si la RPC se llama dos veces para la misma order
        IF EXISTS (
            SELECT 1 FROM public.settlements
            WHERE order_id = p_order_id AND vendor_profile_id = v_vendor_profile_id
        ) THEN
            CONTINUE;
        END IF;

        INSERT INTO public.settlements (
            vendor_profile_id, order_id,
            gross_amount, platform_fee, gateway_fee, tax_amount, net_amount,
            status
        ) VALUES (
            v_vendor_profile_id, p_order_id,
            v_gross, v_platform_fee, v_gateway_fee, v_tax, v_net,
            'pending'
        );

        UPDATE public.vendor_balances
           SET pending_balance = pending_balance + v_net,
               total_earned    = total_earned    + v_gross,
               total_fees      = total_fees      + v_platform_fee + v_gateway_fee,
               updated_at      = now()
         WHERE vendor_profile_id = v_vendor_profile_id;

        v_total_settled    := v_total_settled + v_net;
        v_settlements_count := v_settlements_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'settlements_created', v_settlements_count,
        'total_net_amount',    v_total_settled
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_settlements_for_order(uuid) TO authenticated;


-- ============================================================
-- 6. Comentarios
-- ============================================================

COMMENT ON TABLE public.platform_config IS 'Pares clave/valor de config global. Lectura publica, escritura admin.';
COMMENT ON TABLE public.vendor_balances IS 'Running totals por vendor_profile. Pending = en escrow. Available = listo para retirar.';
COMMENT ON TABLE public.settlements    IS 'Un settlement por (order, vendor) al pagar. status: pending -> processing -> paid.';
COMMENT ON FUNCTION public.compute_settlements_for_order(uuid) IS
    'Llamar tras pago aprobado de una order. Crea settlements y acredita pending_balance. Idempotente.';
