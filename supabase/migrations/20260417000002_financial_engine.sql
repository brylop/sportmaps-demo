-- ============================================================
-- SPORTMAPS MARKETPLACE — FASE 7: MOTOR FINANCIERO
-- Settlements (liquidaciones), vendor_balances (wallet),
-- payout_requests (retiros), platform_config, escrow flow
-- ============================================================


-- ============================================================
-- 1. TABLA platform_config (configuracion global)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_config (
    key         text        PRIMARY KEY,
    value       jsonb       NOT NULL,
    description text,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Valores iniciales
INSERT INTO public.platform_config (key, value, description) VALUES
    ('default_commission_rate', '{"rate": 0.10}', 'Comision por defecto de SportMaps (10%)'),
    ('gateway_fee_rate', '{"epayco": 0.029, "wompi": 0.025, "manual": 0}', 'Comision de cada pasarela de pago'),
    ('min_payout_amount', '{"amount": 50000, "currency": "COP"}', 'Monto minimo para solicitar retiro'),
    ('escrow_release_days', '{"physical": 7, "digital": 1, "service": 1}', 'Dias post-completado para liberar escrow')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 2. TABLA settlements (liquidaciones por orden)
-- Cada vez que se paga una orden, se crea un settlement
-- por cada vendedor involucrado.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.settlements (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id),
    order_id            uuid        NOT NULL REFERENCES public.orders(id),
    order_item_id       uuid        REFERENCES public.order_items(id),
    gross_amount        numeric     NOT NULL CHECK (gross_amount >= 0),
    platform_fee        numeric     NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    gateway_fee         numeric     NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
    tax_amount          numeric     NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    net_amount          numeric     NOT NULL CHECK (net_amount >= 0),
    status              public.settlement_status NOT NULL DEFAULT 'pending',
    paid_at             timestamptz,
    payment_reference   text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_vendor ON public.settlements(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_settlements_order ON public.settlements(order_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON public.settlements(status);


-- ============================================================
-- 3. TABLA vendor_balances (wallet virtual del vendedor)
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

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_vendor_balances_updated_at ON public.vendor_balances;
CREATE TRIGGER trg_vendor_balances_updated_at
    BEFORE UPDATE ON public.vendor_balances
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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


-- ============================================================
-- 4. TABLA payout_requests (solicitudes de retiro)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payout_requests (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id),
    amount              numeric     NOT NULL CHECK (amount > 0),
    currency            text        NOT NULL DEFAULT 'COP',
    bank_data           jsonb       NOT NULL DEFAULT '{}',
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    processed_at        timestamptz,
    rejection_reason    text,
    payment_reference   text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_vendor ON public.payout_requests(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests(status);


-- ============================================================
-- 5. RLS
-- ============================================================

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- platform_config: lectura publica, escritura solo admin (via service role)
CREATE POLICY "platform_config_select_public"
    ON public.platform_config FOR SELECT
    USING (true);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Vendor ve sus liquidaciones
CREATE POLICY "settlements_select_vendor"
    ON public.settlements FOR SELECT TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );

ALTER TABLE public.vendor_balances ENABLE ROW LEVEL SECURITY;

-- Vendor ve su propio balance
CREATE POLICY "vendor_balances_select_own"
    ON public.vendor_balances FOR SELECT TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- Vendor ve y crea sus solicitudes de retiro
CREATE POLICY "payout_requests_select_own"
    ON public.payout_requests FOR SELECT TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "payout_requests_insert_own"
    ON public.payout_requests FOR INSERT TO authenticated
    WITH CHECK (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );


-- ============================================================
-- 6. FUNCTION: calculate_settlement
-- Al pagar una orden, calcula comision por cada vendor
-- y crea settlement + actualiza pending_balance.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_settlement(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_vendor_profile_id uuid;
    v_commission_rate numeric;
    v_gateway_rate numeric;
    v_gross numeric;
    v_platform_fee numeric;
    v_gateway_fee numeric;
    v_tax numeric;
    v_net numeric;
    v_payment_method text;
    v_total_settled numeric := 0;
    v_settlements_created integer := 0;
BEGIN
    -- Obtener metodo de pago de la orden
    SELECT payment_method INTO v_payment_method FROM orders WHERE id = p_order_id;

    -- Obtener tasa de gateway
    SELECT COALESCE(
        (value->>COALESCE(v_payment_method, 'manual'))::numeric,
        0
    ) INTO v_gateway_rate
    FROM platform_config WHERE key = 'gateway_fee_rate';

    -- Iterar order_items agrupados por vendor
    FOR v_item IN
        SELECT
            oi.vendor_id,
            SUM(oi.unit_price * oi.quantity) AS gross_amount,
            SUM(oi.tax_amount) AS total_tax
        FROM order_items oi
        WHERE oi.order_id = p_order_id
          AND oi.vendor_id IS NOT NULL
        GROUP BY oi.vendor_id
    LOOP
        -- Obtener vendor_profile_id y commission_rate
        SELECT vp.id, vp.commission_rate
        INTO v_vendor_profile_id, v_commission_rate
        FROM vendor_profiles vp
        WHERE vp.user_id = v_item.vendor_id;

        IF v_vendor_profile_id IS NULL THEN
            -- Vendor sin perfil, usar tasa default
            SELECT (value->>'rate')::numeric INTO v_commission_rate
            FROM platform_config WHERE key = 'default_commission_rate';

            v_vendor_profile_id := NULL;
            CONTINUE;
        END IF;

        v_gross := v_item.gross_amount;
        v_platform_fee := v_gross * COALESCE(v_commission_rate, 0.10);
        v_gateway_fee := v_gross * COALESCE(v_gateway_rate, 0);
        v_tax := COALESCE(v_item.total_tax, 0);
        v_net := v_gross - v_platform_fee - v_gateway_fee;

        -- Crear settlement
        INSERT INTO settlements (
            vendor_profile_id, order_id,
            gross_amount, platform_fee, gateway_fee, tax_amount, net_amount,
            status
        ) VALUES (
            v_vendor_profile_id, p_order_id,
            v_gross, v_platform_fee, v_gateway_fee, v_tax, v_net,
            'pending'
        );

        -- Actualizar pending_balance del vendor
        UPDATE vendor_balances
        SET pending_balance = pending_balance + v_net,
            total_earned = total_earned + v_gross,
            total_fees = total_fees + v_platform_fee + v_gateway_fee
        WHERE vendor_profile_id = v_vendor_profile_id;

        v_total_settled := v_total_settled + v_net;
        v_settlements_created := v_settlements_created + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'settlements_created', v_settlements_created,
        'total_settled', v_total_settled
    );
END;
$$;


-- ============================================================
-- 7. TRIGGER: auto_calculate_settlement_on_payment
-- Cuando una orden pasa a 'paid', calcular settlements
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_calculate_settlement_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
        PERFORM calculate_settlement(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_settlement ON public.orders;
CREATE TRIGGER trg_auto_settlement
    AFTER UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_settlement_on_payment();


-- ============================================================
-- 8. FUNCTION: release_escrow
-- Ejecutar como cron diario. Libera settlements donde la
-- orden fue completada hace >= escrow_release_days.
-- Mueve de pending_balance a available_balance.
-- ============================================================

CREATE OR REPLACE FUNCTION public.release_escrow()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config jsonb;
    v_settlement RECORD;
    v_release_days integer;
    v_released integer := 0;
BEGIN
    -- Leer config de escrow
    SELECT value INTO v_config FROM platform_config WHERE key = 'escrow_release_days';

    FOR v_settlement IN
        SELECT s.id, s.vendor_profile_id, s.net_amount, o.fulfillment_type, o.updated_at AS completed_at
        FROM settlements s
        JOIN orders o ON o.id = s.order_id
        WHERE s.status = 'pending'
          AND o.status IN ('completed', 'delivered')
    LOOP
        -- Determinar dias de escrow segun tipo
        v_release_days := COALESCE(
            (v_config->>v_settlement.fulfillment_type::text)::integer,
            (v_config->>'physical')::integer,
            7
        );

        -- Verificar si ya pasaron los dias
        IF v_settlement.completed_at + (v_release_days || ' days')::interval <= now() THEN
            -- Liberar settlement
            UPDATE settlements SET status = 'paid', paid_at = now()
            WHERE id = v_settlement.id;

            -- Mover de pending a available
            UPDATE vendor_balances
            SET pending_balance = GREATEST(pending_balance - v_settlement.net_amount, 0),
                available_balance = available_balance + v_settlement.net_amount
            WHERE vendor_profile_id = v_settlement.vendor_profile_id;

            v_released := v_released + 1;
        END IF;
    END LOOP;

    RETURN v_released;
END;
$$;


-- ============================================================
-- 9. FUNCTION: process_payout
-- Vendedor solicita retirar fondos disponibles.
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_payout(
    p_vendor_profile_id uuid,
    p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available numeric;
    v_min_payout numeric;
    v_bank_data jsonb;
    v_payout_id uuid;
BEGIN
    -- Verificar que el vendor es el caller
    IF NOT EXISTS (
        SELECT 1 FROM vendor_profiles
        WHERE id = p_vendor_profile_id AND user_id = auth.uid()
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
    END IF;

    -- Obtener balance disponible
    SELECT available_balance INTO v_available
    FROM vendor_balances
    WHERE vendor_profile_id = p_vendor_profile_id
    FOR UPDATE;

    IF v_available IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Balance no encontrado');
    END IF;

    -- Verificar monto minimo
    SELECT (value->>'amount')::numeric INTO v_min_payout
    FROM platform_config WHERE key = 'min_payout_amount';

    IF p_amount < COALESCE(v_min_payout, 50000) THEN
        RETURN jsonb_build_object('ok', false, 'error',
            format('El monto minimo de retiro es $%s COP', COALESCE(v_min_payout, 50000)));
    END IF;

    -- Verificar fondos suficientes
    IF p_amount > v_available THEN
        RETURN jsonb_build_object('ok', false, 'error',
            format('Fondos insuficientes. Disponible: $%s COP', v_available));
    END IF;

    -- Obtener datos bancarios del vendor
    SELECT bank_data INTO v_bank_data
    FROM vendor_profiles WHERE id = p_vendor_profile_id;

    -- Crear payout request
    INSERT INTO payout_requests (vendor_profile_id, amount, bank_data)
    VALUES (p_vendor_profile_id, p_amount, COALESCE(v_bank_data, '{}'))
    RETURNING id INTO v_payout_id;

    -- Descontar del balance disponible
    UPDATE vendor_balances
    SET available_balance = available_balance - p_amount,
        total_withdrawn = total_withdrawn + p_amount
    WHERE vendor_profile_id = p_vendor_profile_id;

    RETURN jsonb_build_object(
        'ok', true,
        'payout_id', v_payout_id,
        'amount', p_amount,
        'status', 'pending',
        'message', 'Solicitud de retiro creada. Sera procesada en 1-3 dias habiles.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_payout TO authenticated;


-- ============================================================
-- 10. COMENTARIOS
-- ============================================================

COMMENT ON TABLE public.platform_config IS 'Configuracion global del marketplace: comisiones, escrow, montos minimos.';
COMMENT ON TABLE public.settlements IS 'Liquidaciones por orden. Cada venta genera un settlement pendiente que se libera post-escrow.';
COMMENT ON TABLE public.vendor_balances IS 'Wallet virtual del vendedor. pending_balance = escrow, available_balance = retirable.';
COMMENT ON TABLE public.payout_requests IS 'Solicitudes de retiro de fondos a cuenta bancaria del vendedor.';
COMMENT ON FUNCTION public.calculate_settlement IS 'Calcula comision por orden y crea settlement + actualiza pending_balance.';
COMMENT ON FUNCTION public.release_escrow IS 'Cron diario: libera escrow post-completado segun fulfillment_type. Mueve de pending a available.';
COMMENT ON FUNCTION public.process_payout IS 'Vendedor solicita retiro. Valida fondos, monto minimo, crea request, descuenta balance.';
