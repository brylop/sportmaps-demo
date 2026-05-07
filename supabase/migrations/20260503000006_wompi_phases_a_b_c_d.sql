-- ============================================================================
-- Wompi — Fases A, B, C, D (idempotente y tolerante a tablas opcionales)
--
-- A. Refunds automatizados (void Wompi + restitucion stock)
-- B. Reserva de cancha/sesiones con cobro Wompi (prefix BKG)
-- C. Liquidacion multi-vendor con vendor_payouts
-- D. Auto-cobro recurrente con tokenizacion (payment_tokens)
--
-- Las RPCs y tablas que dependen de marketplace_transactions, session_bookings,
-- subscriptions o product_variants usan guards `IF EXISTS pg_tables` para que
-- la migracion corra correctamente aunque esas tablas aun no existan.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE A — REFUNDS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID,    -- FK opcional a marketplace_transactions (se agrega abajo)
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    refund_amount NUMERIC(12,2) NOT NULL,
    refund_pct NUMERIC(5,2),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed')),
    wompi_void_id TEXT,
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT one_source CHECK (
        (transaction_id IS NOT NULL)::int +
        (order_id IS NOT NULL)::int +
        (payment_id IS NOT NULL)::int = 1
    )
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions')
       AND NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema='public' AND table_name='refunds'
              AND constraint_name='refunds_transaction_id_fkey'
       )
    THEN
        ALTER TABLE public.refunds
            ADD CONSTRAINT refunds_transaction_id_fkey
            FOREIGN KEY (transaction_id) REFERENCES public.marketplace_transactions(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds (status);
CREATE INDEX IF NOT EXISTS idx_refunds_requested_by ON public.refunds (requested_by);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds (order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_transaction_id ON public.refunds (transaction_id);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refunds_owner_read" ON public.refunds;

-- Politica de lectura tolerante: el subquery a marketplace_transactions se hace via EXISTS
-- que solo evalua si la tabla existe; si no, la subquery falla pero como esta en un OR
-- envuelto en una funcion check creada dinamicamente. Para simplificar, la politica
-- referencia marketplace_transactions directamente; PostgreSQL solo la evalua si la fila
-- de refunds tiene transaction_id IS NOT NULL. Si la tabla no existe, simplemente
-- ningun refund tendra transaction_id, asi que el branch nunca corre.
DO $$
DECLARE
    v_has_mkt BOOLEAN := EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions');
    v_orders_has_vendor BOOLEAN := EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='orders' AND column_name='vendor_id'
    );
    v_orders_clause TEXT;
    v_policy TEXT;
BEGIN
    -- Construir el clause de orders segun si vendor_id existe
    IF v_orders_has_vendor THEN
        v_orders_clause := 'OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND (o.user_id = auth.uid() OR o.vendor_id = auth.uid()))';
    ELSE
        v_orders_clause := 'OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND o.user_id = auth.uid())';
    END IF;

    v_policy := 'CREATE POLICY "refunds_owner_read" ON public.refunds FOR SELECT USING ('
             || 'auth.uid() = requested_by '
             || v_orders_clause || ' '
             || 'OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = ''admin'')';

    IF v_has_mkt THEN
        v_policy := v_policy
                 || ' OR EXISTS (SELECT 1 FROM public.marketplace_transactions mt WHERE mt.id = refunds.transaction_id AND (mt.user_id = auth.uid() OR mt.vendor_id = auth.uid()))';
    END IF;

    v_policy := v_policy || ')';
    EXECUTE v_policy;
END $$;

DROP POLICY IF EXISTS "refunds_owner_insert" ON public.refunds;
CREATE POLICY "refunds_owner_insert" ON public.refunds
    FOR INSERT WITH CHECK (auth.uid() = requested_by);

-- RPC: cliente solicita reembolso. Tolerante a marketplace_transactions opcional.
CREATE OR REPLACE FUNCTION public.request_refund(
    p_order_id UUID DEFAULT NULL,
    p_transaction_id UUID DEFAULT NULL,
    p_payment_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user UUID;
    v_amount NUMERIC;
    v_pct NUMERIC := 100.0;
    v_refund_id UUID;
BEGIN
    v_user := auth.uid();
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reason_too_short');
    END IF;

    IF p_order_id IS NOT NULL THEN
        SELECT total_amount INTO v_amount FROM public.orders
        WHERE id = p_order_id AND user_id = v_user AND status = 'paid';
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'error', 'order_not_eligible');
        END IF;
    ELSIF p_transaction_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
            RETURN jsonb_build_object('ok', false, 'error', 'marketplace_not_available');
        END IF;
        EXECUTE 'SELECT gross_amount FROM public.marketplace_transactions WHERE id = $1 AND user_id = $2 AND status = ''paid'''
            INTO v_amount USING p_transaction_id, v_user;
        IF v_amount IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'error', 'tx_not_eligible');
        END IF;
    ELSIF p_payment_id IS NOT NULL THEN
        SELECT amount INTO v_amount FROM public.payments
        WHERE id = p_payment_id AND user_id = v_user AND status = 'paid';
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'error', 'payment_not_eligible');
        END IF;
    ELSE
        RETURN jsonb_build_object('ok', false, 'error', 'no_source');
    END IF;

    INSERT INTO public.refunds (
        transaction_id, order_id, payment_id, requested_by, reason,
        refund_amount, refund_pct, status
    ) VALUES (
        p_transaction_id, p_order_id, p_payment_id, v_user, p_reason,
        v_amount * (v_pct / 100), v_pct, 'pending'
    ) RETURNING id INTO v_refund_id;

    RETURN jsonb_build_object(
        'ok', true,
        'refund_id', v_refund_id,
        'refund_amount', v_amount * (v_pct / 100),
        'refund_pct', v_pct
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_refund(UUID, UUID, UUID, TEXT) TO authenticated, service_role;

-- RPC: aprobar refund. Tolerante a marketplace_transactions opcional.
CREATE OR REPLACE FUNCTION public.approve_refund(p_refund_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_refund RECORD;
    v_authorized BOOLEAN := false;
    v_actor_role TEXT;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
    END IF;

    SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;

    IF v_refund.status != 'pending' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
    END IF;

    SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor;
    IF v_actor_role = 'admin' THEN v_authorized := true; END IF;

    IF NOT v_authorized AND v_refund.order_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='orders' AND column_name='vendor_id'
        ) THEN
            EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = $1 AND o.vendor_id = $2)'
                INTO v_authorized USING v_refund.order_id, v_actor;
        END IF;
    END IF;

    IF NOT v_authorized AND v_refund.transaction_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions')
    THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.marketplace_transactions mt WHERE mt.id = $1 AND mt.vendor_id = $2)'
            INTO v_authorized USING v_refund.transaction_id, v_actor;
    END IF;

    IF NOT v_authorized AND v_refund.payment_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.payments p
            JOIN public.schools s ON s.id = p.school_id
            WHERE p.id = v_refund.payment_id AND (s.owner_id = v_actor OR v_actor_role IN ('school_admin', 'owner'))
        ) INTO v_authorized;
    END IF;

    IF NOT v_authorized THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;

    UPDATE public.refunds
    SET status = 'processing',
        processed_by = v_actor,
        updated_at = NOW()
    WHERE id = p_refund_id;

    RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_refund(UUID) TO authenticated, service_role;

-- RPC: completar refund + restitucion de stock. Tolerante a product_variants y marketplace_transactions.
CREATE OR REPLACE FUNCTION public.complete_refund(
    p_refund_id UUID,
    p_wompi_void_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refund RECORD;
    v_item RECORD;
    v_stock_before INT;
    v_has_variants BOOLEAN := EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='product_variants');
    v_has_mkt BOOLEAN := EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions');
BEGIN
    SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;

    UPDATE public.refunds
    SET status = 'completed',
        wompi_void_id = p_wompi_void_id,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_refund_id;

    IF v_refund.order_id IS NOT NULL THEN
        UPDATE public.orders SET status = 'refunded', updated_at = NOW() WHERE id = v_refund.order_id;

        FOR v_item IN
            SELECT id, product_id, variant_id, quantity
            FROM public.order_items
            WHERE order_id = v_refund.order_id
            ORDER BY product_id, variant_id NULLS FIRST
        LOOP
            IF v_item.variant_id IS NOT NULL AND v_has_variants THEN
                EXECUTE 'SELECT stock FROM public.product_variants WHERE id = $1 FOR UPDATE'
                    INTO v_stock_before USING v_item.variant_id;
                EXECUTE 'UPDATE public.product_variants SET stock = stock + $1, updated_at = NOW() WHERE id = $2'
                    USING v_item.quantity, v_item.variant_id;
            ELSE
                SELECT stock INTO v_stock_before FROM public.products WHERE id = v_item.product_id FOR UPDATE;
                UPDATE public.products SET stock = stock + v_item.quantity, updated_at = NOW() WHERE id = v_item.product_id;
            END IF;

            INSERT INTO public.inventory_logs (
                product_id, variant_id, vendor_id, delta, stock_before, stock_after, reason, order_id
            ) VALUES (
                v_item.product_id, v_item.variant_id,
                (SELECT vendor_id FROM public.products WHERE id = v_item.product_id),
                v_item.quantity,
                v_stock_before,
                v_stock_before + v_item.quantity,
                'returned',
                v_refund.order_id
            );
        END LOOP;
    ELSIF v_refund.transaction_id IS NOT NULL AND v_has_mkt THEN
        EXECUTE 'UPDATE public.marketplace_transactions SET status = ''refunded'', updated_at = NOW() WHERE id = $1'
            USING v_refund.transaction_id;
    ELSIF v_refund.payment_id IS NOT NULL THEN
        UPDATE public.payments SET status = 'refunded', updated_at = NOW() WHERE id = v_refund.payment_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_refund(UUID, TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE B — RESERVA DE CANCHA / SESSIONS (solo si la tabla existe)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='session_bookings') THEN
        RAISE NOTICE 'session_bookings no existe; saltando FASE B (sessions checkout).';
        RETURN;
    END IF;

    ALTER TABLE public.session_bookings
        ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'free'
            CHECK (payment_status IN ('free', 'pending', 'paid', 'refunded', 'failed')),
        ADD COLUMN IF NOT EXISTS wompi_reference TEXT,
        ADD COLUMN IF NOT EXISTS wompi_transaction_id TEXT,
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_failure_reason TEXT,
        ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS unblocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_session_bookings_wompi_ref
        ON public.session_bookings (wompi_reference)
        WHERE wompi_reference IS NOT NULL;
END $$;

-- RPC para confirmar pago de booking — solo se crea si la tabla existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='session_bookings') THEN
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.confirm_session_booking_payment(
            p_booking_id UUID,
            p_wompi_reference TEXT,
            p_wompi_transaction_id TEXT
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_booking RECORD;
        BEGIN
            SELECT * INTO v_booking FROM public.session_bookings WHERE id = p_booking_id FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;

            IF v_booking.payment_status = 'paid' AND v_booking.wompi_transaction_id = p_wompi_transaction_id THEN
                RETURN jsonb_build_object('ok', true, 'idempotent', true);
            END IF;

            UPDATE public.session_bookings
            SET payment_status = 'paid',
                wompi_reference = p_wompi_reference,
                wompi_transaction_id = p_wompi_transaction_id,
                paid_at = NOW(),
                updated_at = NOW()
            WHERE id = p_booking_id;

            RETURN jsonb_build_object('ok', true, 'booking_id', p_booking_id);
        END;
        $body$;
    $func$;

    GRANT EXECUTE ON FUNCTION public.confirm_session_booking_payment(UUID, TEXT, TEXT) TO service_role;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE C — LIQUIDACION MULTI-VENDOR
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    transaction_id UUID,    -- FK opcional a marketplace_transactions, se agrega abajo
    gross_amount NUMERIC(12,2) NOT NULL,
    sportmaps_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    wompi_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'COP',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'scheduled', 'paid', 'failed', 'on_hold')),
    scheduled_for DATE,
    paid_at TIMESTAMPTZ,
    paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    bank_reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT one_origin CHECK (
        (order_id IS NOT NULL)::int + (transaction_id IS NOT NULL)::int = 1
    )
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions')
       AND NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema='public' AND table_name='vendor_payouts'
              AND constraint_name='vendor_payouts_transaction_id_fkey'
       )
    THEN
        ALTER TABLE public.vendor_payouts
            ADD CONSTRAINT vendor_payouts_transaction_id_fkey
            FOREIGN KEY (transaction_id) REFERENCES public.marketplace_transactions(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor_id ON public.vendor_payouts (vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON public.vendor_payouts (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_order_id ON public.vendor_payouts (order_id);

ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_payouts_owner_read" ON public.vendor_payouts;
CREATE POLICY "vendor_payouts_owner_read" ON public.vendor_payouts
    FOR SELECT USING (
        auth.uid() = vendor_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

CREATE OR REPLACE FUNCTION public.split_order_payment(
    p_order_id UUID,
    p_sportmaps_fee_pct NUMERIC DEFAULT 5.0,
    p_wompi_fee_pct NUMERIC DEFAULT 2.65
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_split RECORD;
    v_count INT := 0;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND OR v_order.status != 'paid' THEN
        RAISE EXCEPTION 'order_not_paid';
    END IF;

    IF EXISTS (SELECT 1 FROM public.vendor_payouts WHERE order_id = p_order_id) THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END IF;

    FOR v_split IN
        SELECT
            oi.vendor_id,
            SUM(COALESCE(oi.subtotal, oi.unit_price * oi.quantity) + COALESCE(oi.tax_amount, 0)) AS gross
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id AND oi.vendor_id IS NOT NULL
        GROUP BY oi.vendor_id
    LOOP
        INSERT INTO public.vendor_payouts (
            vendor_id, order_id, gross_amount,
            sportmaps_fee, wompi_fee, net_amount,
            status, scheduled_for
        ) VALUES (
            v_split.vendor_id,
            p_order_id,
            v_split.gross,
            v_split.gross * (p_sportmaps_fee_pct / 100),
            v_split.gross * (p_wompi_fee_pct / 100),
            v_split.gross - (v_split.gross * ((p_sportmaps_fee_pct + p_wompi_fee_pct) / 100)),
            'pending',
            (CURRENT_DATE + INTERVAL '7 days')::date
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'payouts_created', v_count, 'order_id', p_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.split_order_payment(UUID, NUMERIC, NUMERIC) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE D — AUTO-COBRO RECURRENTE (TOKENIZACION)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wompi_token TEXT NOT NULL UNIQUE,
    payment_method_type TEXT NOT NULL,
    last_four TEXT,
    brand TEXT,
    holder_name TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_tokens_user_id ON public.payment_tokens (user_id, is_active);

ALTER TABLE public.payment_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_tokens_owner_all" ON public.payment_tokens;
CREATE POLICY "payment_tokens_owner_all" ON public.payment_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Subscriptions auto_renew + token (solo si la tabla existe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='subscriptions') THEN
        RAISE NOTICE 'subscriptions no existe; saltando ALTER subscriptions y vista due_for_billing.';
        RETURN;
    END IF;

    ALTER TABLE public.subscriptions
        ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS payment_token_id UUID REFERENCES public.payment_tokens(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS next_billing_date DATE,
        ADD COLUMN IF NOT EXISTS last_billing_attempt_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_billing_error TEXT;
END $$;

-- save_payment_token (siempre disponible — no depende de subscriptions)
CREATE OR REPLACE FUNCTION public.save_payment_token(
    p_user_id UUID,
    p_wompi_token TEXT,
    p_payment_method_type TEXT,
    p_last_four TEXT DEFAULT NULL,
    p_brand TEXT DEFAULT NULL,
    p_holder_name TEXT DEFAULT NULL,
    p_expires_at DATE DEFAULT NULL,
    p_set_default BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_id UUID;
BEGIN
    INSERT INTO public.payment_tokens (
        user_id, wompi_token, payment_method_type, last_four, brand, holder_name, expires_at, is_default
    ) VALUES (
        p_user_id, p_wompi_token, p_payment_method_type, p_last_four, p_brand, p_holder_name, p_expires_at, p_set_default
    )
    ON CONFLICT (wompi_token) DO UPDATE
        SET payment_method_type = EXCLUDED.payment_method_type,
            last_four = COALESCE(EXCLUDED.last_four, payment_tokens.last_four),
            brand = COALESCE(EXCLUDED.brand, payment_tokens.brand),
            updated_at = NOW()
    RETURNING id INTO v_token_id;

    IF p_set_default THEN
        UPDATE public.payment_tokens
        SET is_default = false
        WHERE user_id = p_user_id AND id != v_token_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'token_id', v_token_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_payment_token(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN) TO service_role;

-- Vista subscriptions_due_for_billing — solo si subscriptions y subscription_plans existen
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='subscriptions') THEN
        EXECUTE $sql$
            CREATE OR REPLACE VIEW public.subscriptions_due_for_billing
            WITH (security_invoker = true)
            AS
            SELECT
                s.id AS subscription_id,
                s.user_id,
                s.plan_id,
                s.payment_token_id,
                pt.wompi_token,
                CASE
                    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='subscription_plans')
                    THEN (SELECT sp.price FROM public.subscription_plans sp WHERE sp.id = s.plan_id)
                    ELSE NULL
                END AS price,
                CASE
                    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='subscription_plans')
                    THEN (SELECT sp.name FROM public.subscription_plans sp WHERE sp.id = s.plan_id)
                    ELSE NULL
                END AS plan_name,
                s.next_billing_date
            FROM public.subscriptions s
            JOIN public.payment_tokens pt ON pt.id = s.payment_token_id AND pt.is_active = true
            WHERE s.auto_renew = true
              AND s.status = 'active'
              AND s.next_billing_date <= CURRENT_DATE
              AND (s.last_billing_attempt_at IS NULL OR s.last_billing_attempt_at < (CURRENT_DATE - INTERVAL '6 hours'))
        $sql$;

        EXECUTE 'GRANT SELECT ON public.subscriptions_due_for_billing TO service_role';
    END IF;
END $$;

COMMIT;
