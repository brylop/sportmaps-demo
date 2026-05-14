-- ============================================================
-- SPORTMAPS MARKETPLACE — R5.1a Pipeline de pagos al vendor
--
-- Ya existe:
--   - settlements (per-order por vendor: gross, platform_fee, gateway_fee, net)
--   - vendor_balances (running totals por vendor)
--   - vendor_payouts (disbursement record)
--   - platform_config (commission_rate, gateway_fees, escrow_release_days,
--                      min_payout_amount)
--
-- Esta migracion agrega:
--   1. vendor_bank_accounts (donde se le paga al vendor)
--   2. RPC release_settlements (mueve settlements pending -> available
--                               tras cumplir escrow_release_days)
--   3. RPC request_payout (vendor crea payout desde su available_balance)
--   4. RPC admin_generate_pending_payouts (cron job: crea payout
--                                          automatico cuando >= min_payout_amount)
--   5. Trigger: on order.status='delivered' -> recalcular settlements del order
--
-- Defensivo: skip si tablas base no existen.
-- ============================================================


-- ============================================================
-- 1. Tabla vendor_bank_accounts
--    Multiples cuentas posibles, una `is_default`.
--    Datos en claro (no PCI — no son tarjetas).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_bank_accounts (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,

    -- Datos bancarios (Colombia)
    bank_name           text        NOT NULL,
    account_type        text        NOT NULL CHECK (account_type IN ('ahorros','corriente','nequi','daviplata','bancolombia_a_la_mano')),
    account_number      text        NOT NULL,

    -- Titular y documento (necesario para emitir transferencias)
    account_holder      text        NOT NULL,
    document_type       text        NOT NULL CHECK (document_type IN ('CC','CE','NIT','PASS','PEP')),
    document_number     text        NOT NULL,

    -- Opcional
    email               text,
    phone               text,

    is_default          boolean     NOT NULL DEFAULT true,
    is_active           boolean     NOT NULL DEFAULT true,

    -- Verificacion (admin marca true tras micro-deposito o validacion manual)
    verified_at         timestamptz,
    verified_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_bank_accounts_vendor ON public.vendor_bank_accounts(vendor_profile_id, is_default);
CREATE INDEX IF NOT EXISTS idx_vendor_bank_accounts_active ON public.vendor_bank_accounts(is_active);

-- Solo una cuenta default por vendor
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_bank_accounts_one_default
    ON public.vendor_bank_accounts(vendor_profile_id)
    WHERE is_default = true AND is_active = true;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_vendor_bank_accounts_updated_at ON public.vendor_bank_accounts $tr$;
        EXECUTE $tr$
            CREATE TRIGGER trg_vendor_bank_accounts_updated_at
            BEFORE UPDATE ON public.vendor_bank_accounts
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
        $tr$;
    END IF;
END $$;

ALTER TABLE public.vendor_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor maneja sus cuentas bancarias" ON public.vendor_bank_accounts;
CREATE POLICY "Vendor maneja sus cuentas bancarias"
    ON public.vendor_bank_accounts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
            WHERE vp.id = vendor_bank_accounts.vendor_profile_id
              AND vp.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
            WHERE vp.id = vendor_bank_accounts.vendor_profile_id
              AND vp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admin lee todas las cuentas bancarias" ON public.vendor_bank_accounts;
CREATE POLICY "Admin lee todas las cuentas bancarias"
    ON public.vendor_bank_accounts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role::text IN ('admin','super_admin')
        )
    );


-- ============================================================
-- 2. RPC release_settlements_for_vendor
--    Mueve settlements del vendor de 'pending' -> 'processing'
--    si han pasado escrow_release_days desde la orden delivered.
--    Tambien recalcula vendor_balances (pending->available).
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'settlements'
    ) THEN
        RAISE NOTICE 'Skip release_settlements: tabla settlements no existe.';
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.release_settlements_for_vendor(p_vendor_profile_id uuid)
        RETURNS jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_physical_days integer;
            v_digital_days  integer;
            v_service_days  integer;
            v_released      integer := 0;
            v_released_net  numeric := 0;
        BEGIN
            -- Leer config de escrow
            SELECT (value->>'physical')::int, (value->>'digital')::int, (value->>'service')::int
              INTO v_physical_days, v_digital_days, v_service_days
              FROM public.platform_config
             WHERE key = 'escrow_release_days';

            v_physical_days := COALESCE(v_physical_days, 7);
            v_digital_days  := COALESCE(v_digital_days, 1);
            v_service_days  := COALESCE(v_service_days, 1);

            -- Pasar a 'processing' los settlements cuya orden este delivered
            -- y haya cumplido escrow_release_days.
            WITH eligible AS (
                SELECT s.id, s.net_amount
                  FROM public.settlements s
                  JOIN public.orders o ON o.id = s.order_id
                 WHERE s.vendor_profile_id = p_vendor_profile_id
                   AND s.status            = 'pending'
                   AND o.status            = 'delivered'
                   AND o.updated_at <= now() - (
                        CASE COALESCE(o.fulfillment_type, 'physical')
                            WHEN 'digital' THEN v_digital_days
                            WHEN 'service' THEN v_service_days
                            ELSE v_physical_days
                        END || ' days'
                   )::interval
            )
            UPDATE public.settlements
               SET status = 'processing'
              FROM eligible
             WHERE settlements.id = eligible.id;

            GET DIAGNOSTICS v_released = ROW_COUNT;

            -- Mover net_amount de pending_balance -> available_balance
            SELECT COALESCE(SUM(net_amount), 0)
              INTO v_released_net
              FROM public.settlements
             WHERE vendor_profile_id = p_vendor_profile_id
               AND status            = 'processing';

            UPDATE public.vendor_balances
               SET pending_balance   = GREATEST(pending_balance - v_released_net, 0),
                   available_balance = available_balance + v_released_net,
                   updated_at        = now()
             WHERE vendor_profile_id = p_vendor_profile_id;

            RETURN jsonb_build_object(
                'released_count', v_released,
                'released_amount', v_released_net
            );
        END;
        $body$;
    $func$;

    EXECUTE $sql$
        GRANT EXECUTE ON FUNCTION public.release_settlements_for_vendor(uuid) TO authenticated;
    $sql$;

    -- Variante admin: libera para TODOS los vendors
    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.release_settlements_all()
        RETURNS jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_vendor RECORD;
            v_total_released integer := 0;
            v_total_amount   numeric := 0;
            v_result         jsonb;
        BEGIN
            FOR v_vendor IN
                SELECT DISTINCT vendor_profile_id FROM public.settlements WHERE status = 'pending'
            LOOP
                v_result := public.release_settlements_for_vendor(v_vendor.vendor_profile_id);
                v_total_released := v_total_released + COALESCE((v_result->>'released_count')::int, 0);
                v_total_amount   := v_total_amount + COALESCE((v_result->>'released_amount')::numeric, 0);
            END LOOP;

            RETURN jsonb_build_object(
                'released_count', v_total_released,
                'released_amount', v_total_amount
            );
        END;
        $body$;
    $func$;
END $$;


-- ============================================================
-- 3. RPC request_payout — vendor crea payout desde available_balance
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_payouts'
    ) THEN
        RAISE NOTICE 'Skip request_payout: tabla vendor_payouts no existe.';
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.request_payout(p_amount numeric DEFAULT NULL)
        RETURNS public.vendor_payouts
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_user_id           uuid := auth.uid();
            v_vendor_profile_id uuid;
            v_available         numeric;
            v_min_amount        numeric;
            v_bank_id           uuid;
            v_currency          text  := 'COP';
            v_payout            public.vendor_payouts;
            v_amount_to_payout  numeric;
        BEGIN
            IF v_user_id IS NULL THEN
                RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
            END IF;

            -- Resolver vendor_profile del caller
            SELECT id INTO v_vendor_profile_id
              FROM public.vendor_profiles
             WHERE user_id = v_user_id;

            IF v_vendor_profile_id IS NULL THEN
                RAISE EXCEPTION 'No tienes vendor_profile activo.' USING ERRCODE = '42501';
            END IF;

            -- Verificar bank account
            SELECT id INTO v_bank_id
              FROM public.vendor_bank_accounts
             WHERE vendor_profile_id = v_vendor_profile_id
               AND is_default        = true
               AND is_active         = true
             LIMIT 1;

            IF v_bank_id IS NULL THEN
                RAISE EXCEPTION 'Debes configurar una cuenta bancaria antes de solicitar liquidacion.' USING ERRCODE = '42501';
            END IF;

            -- Leer available_balance y min_amount
            SELECT available_balance INTO v_available
              FROM public.vendor_balances
             WHERE vendor_profile_id = v_vendor_profile_id;
            v_available := COALESCE(v_available, 0);

            SELECT (value->>'amount')::numeric INTO v_min_amount
              FROM public.platform_config WHERE key = 'min_payout_amount';
            v_min_amount := COALESCE(v_min_amount, 50000);

            v_amount_to_payout := COALESCE(p_amount, v_available);

            IF v_amount_to_payout <= 0 THEN
                RAISE EXCEPTION 'Monto invalido.' USING ERRCODE = '22023';
            END IF;
            IF v_amount_to_payout > v_available THEN
                RAISE EXCEPTION 'Monto solicitado (%) supera available_balance (%).', v_amount_to_payout, v_available
                    USING ERRCODE = '22023';
            END IF;
            IF v_amount_to_payout < v_min_amount THEN
                RAISE EXCEPTION 'Monto minimo de liquidacion: %.', v_min_amount USING ERRCODE = '22023';
            END IF;

            -- Crear payout
            INSERT INTO public.vendor_payouts (
                vendor_id, gross_amount, sportmaps_fee, wompi_fee, net_amount, currency, status, notes
            ) VALUES (
                v_user_id,
                v_amount_to_payout,
                0, 0,
                v_amount_to_payout,
                v_currency,
                'pending',
                'Solicitado por vendor.'
            )
            RETURNING * INTO v_payout;

            -- Reducir available_balance e incrementar total_withdrawn (en pending)
            UPDATE public.vendor_balances
               SET available_balance = available_balance - v_amount_to_payout,
                   total_withdrawn   = total_withdrawn + v_amount_to_payout,
                   updated_at        = now()
             WHERE vendor_profile_id = v_vendor_profile_id;

            -- Marcar settlements processing -> paid (asociados a este payout)
            UPDATE public.settlements
               SET status  = 'paid',
                   paid_at = now()
             WHERE vendor_profile_id = v_vendor_profile_id
               AND status            = 'processing';

            RETURN v_payout;
        END;
        $body$;
    $func$;

    EXECUTE $sql$ GRANT EXECUTE ON FUNCTION public.request_payout(numeric) TO authenticated $sql$;
END $$;


-- ============================================================
-- 4. RPC admin_generate_pending_payouts
--    Cron-friendly. Para cada vendor con available_balance >= min,
--    crea automatico un payout pending.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_payouts'
    ) THEN
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.admin_generate_pending_payouts()
        RETURNS jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_caller_role text;
            v_vendor      RECORD;
            v_min_amount  numeric;
            v_created     integer := 0;
            v_total       numeric := 0;
        BEGIN
            -- Solo admin
            SELECT role::text INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
            IF v_caller_role NOT IN ('admin','super_admin') THEN
                RAISE EXCEPTION 'Solo admin.' USING ERRCODE = '42501';
            END IF;

            SELECT (value->>'amount')::numeric INTO v_min_amount
              FROM public.platform_config WHERE key = 'min_payout_amount';
            v_min_amount := COALESCE(v_min_amount, 50000);

            FOR v_vendor IN
                SELECT vb.vendor_profile_id, vp.user_id, vb.available_balance
                  FROM public.vendor_balances vb
                  JOIN public.vendor_profiles vp ON vp.id = vb.vendor_profile_id
                 WHERE vb.available_balance >= v_min_amount
                   AND EXISTS (
                       SELECT 1 FROM public.vendor_bank_accounts
                        WHERE vendor_profile_id = vb.vendor_profile_id
                          AND is_default = true AND is_active = true
                   )
            LOOP
                INSERT INTO public.vendor_payouts (
                    vendor_id, gross_amount, sportmaps_fee, wompi_fee, net_amount, currency, status, notes
                ) VALUES (
                    v_vendor.user_id,
                    v_vendor.available_balance, 0, 0,
                    v_vendor.available_balance,
                    'COP', 'pending',
                    'Auto-generado por admin_generate_pending_payouts.'
                );

                UPDATE public.vendor_balances
                   SET available_balance = 0,
                       total_withdrawn   = total_withdrawn + v_vendor.available_balance,
                       updated_at        = now()
                 WHERE vendor_profile_id = v_vendor.vendor_profile_id;

                UPDATE public.settlements
                   SET status  = 'paid', paid_at = now()
                 WHERE vendor_profile_id = v_vendor.vendor_profile_id
                   AND status            = 'processing';

                v_created := v_created + 1;
                v_total   := v_total + v_vendor.available_balance;
            END LOOP;

            RETURN jsonb_build_object('payouts_created', v_created, 'total_amount', v_total);
        END;
        $body$;
    $func$;

    EXECUTE $sql$ GRANT EXECUTE ON FUNCTION public.admin_generate_pending_payouts() TO authenticated $sql$;
END $$;


-- ============================================================
-- 5. Trigger: on order.status -> 'delivered'
--    Disparar release_settlements_for_vendor (deferred via cron OK,
--    pero aqui hacemos un release inmediato para UX).
--    Nota: si tienen funcion compute_settlements para create al pago
--    (la vi antes), el accrual inicial ya pasa al pagar la orden.
--    Este trigger solo intenta liberar al delivered.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'orders'
    ) THEN
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.trg_release_on_delivered()
        RETURNS trigger
        LANGUAGE plpgsql
        SET search_path = pg_catalog, public, pg_temp
        AS $body$
        DECLARE
            v_vendor RECORD;
        BEGIN
            IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
                -- Best effort: si la funcion existe la llamamos.
                IF EXISTS (
                    SELECT 1 FROM pg_proc
                    WHERE proname = 'release_settlements_for_vendor'
                ) THEN
                    FOR v_vendor IN
                        SELECT DISTINCT s.vendor_profile_id
                          FROM public.settlements s
                         WHERE s.order_id = NEW.id
                           AND s.status   = 'pending'
                    LOOP
                        PERFORM public.release_settlements_for_vendor(v_vendor.vendor_profile_id);
                    END LOOP;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $body$;
    $func$;

    EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_orders_release_on_delivered ON public.orders $tr$;
    EXECUTE $tr$
        CREATE TRIGGER trg_orders_release_on_delivered
            AFTER UPDATE OF status ON public.orders
            FOR EACH ROW
            WHEN (NEW.status = 'delivered')
            EXECUTE FUNCTION public.trg_release_on_delivered();
    $tr$;
END $$;


-- ============================================================
-- 6. RPC publica: vendor_payout_summary
--    Resumen para el dashboard del vendor: balance + ultimos payouts.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_balances'
    ) THEN
        RETURN;
    END IF;

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.vendor_payout_summary()
        RETURNS jsonb
        LANGUAGE plpgsql
        STABLE
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_user_id   uuid := auth.uid();
            v_vp_id     uuid;
            v_bal       RECORD;
            v_min       numeric;
            v_has_bank  boolean := false;
        BEGIN
            IF v_user_id IS NULL THEN
                RETURN jsonb_build_object('error', 'not_authenticated');
            END IF;

            SELECT id INTO v_vp_id FROM public.vendor_profiles WHERE user_id = v_user_id;
            IF v_vp_id IS NULL THEN
                RETURN jsonb_build_object('error', 'no_vendor_profile');
            END IF;

            SELECT * INTO v_bal FROM public.vendor_balances WHERE vendor_profile_id = v_vp_id;

            SELECT (value->>'amount')::numeric INTO v_min
              FROM public.platform_config WHERE key = 'min_payout_amount';

            SELECT EXISTS (
                SELECT 1 FROM public.vendor_bank_accounts
                WHERE vendor_profile_id = v_vp_id
                  AND is_default        = true
                  AND is_active         = true
            ) INTO v_has_bank;

            RETURN jsonb_build_object(
                'vendor_profile_id',  v_vp_id,
                'pending_balance',    COALESCE(v_bal.pending_balance, 0),
                'available_balance',  COALESCE(v_bal.available_balance, 0),
                'total_earned',       COALESCE(v_bal.total_earned, 0),
                'total_fees',         COALESCE(v_bal.total_fees, 0),
                'total_withdrawn',    COALESCE(v_bal.total_withdrawn, 0),
                'min_payout_amount',  COALESCE(v_min, 50000),
                'has_bank_account',   v_has_bank,
                'can_request_payout', v_has_bank AND COALESCE(v_bal.available_balance, 0) >= COALESCE(v_min, 50000)
            );
        END;
        $body$;
    $func$;

    EXECUTE $sql$ GRANT EXECUTE ON FUNCTION public.vendor_payout_summary() TO authenticated $sql$;
END $$;


-- ============================================================
-- 7. Comentarios
-- ============================================================

COMMENT ON TABLE public.vendor_bank_accounts IS
    'Cuentas bancarias de vendors para recibir liquidaciones. Solo una is_default activa por vendor.';
