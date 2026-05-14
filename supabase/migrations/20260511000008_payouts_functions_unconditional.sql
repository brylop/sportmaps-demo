-- ============================================================
-- SPORTMAPS MARKETPLACE — R5.1a correctiva (renumerado de 06 -> 08
-- por colision con 20260511000006_lock_down_identity_documents_bucket)
--
-- Crea/recrea SIEMPRE las funciones de payout con runtime guards.
-- Si las tablas base existen, las funciones devuelven datos reales.
-- Si faltan, devuelven jsonb con error explicativo.
--
-- Todas devuelven jsonb (no row types) para no atar la firma a tablas.
--
-- IMPORTANTE: la migracion 20260511000005 creo algunas de estas funciones
-- con RETURNS public.vendor_payouts (no jsonb). Postgres no permite
-- cambiar el return type con CREATE OR REPLACE — hay que DROP primero.
-- Por eso cada funcion arranca con DROP FUNCTION IF EXISTS.
-- ============================================================


-- DROP de todas las firmas previas (idempotente). CASCADE para arrastrar
-- triggers/dependencias que las usen — los recreamos despues.
DROP FUNCTION IF EXISTS public.release_settlements_for_vendor(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.release_settlements_all()            CASCADE;
DROP FUNCTION IF EXISTS public.request_payout(numeric)              CASCADE;
DROP FUNCTION IF EXISTS public.admin_generate_pending_payouts()     CASCADE;
DROP FUNCTION IF EXISTS public.vendor_payout_summary()              CASCADE;
DROP FUNCTION IF EXISTS public.trg_release_on_delivered()           CASCADE;


-- ============================================================
-- 0. Aflojar constraint one_origin en vendor_payouts
--    Original: exige order_id O transaction_id (exactamente uno).
--    Nuevo:    permite ambos NULL (payout agregado de varios settlements)
--              y sigue prohibiendo que ambos esten setados a la vez.
--    Se hace dentro de DO para que no rompa si el constraint no existe.
-- ============================================================

DO $$
BEGIN
    IF to_regclass('public.vendor_payouts') IS NOT NULL THEN
        -- Drop si existe con el nombre original
        EXECUTE 'ALTER TABLE public.vendor_payouts DROP CONSTRAINT IF EXISTS one_origin';

        -- Re-add con semantica relajada: <= 1 (permite 0 = agregado)
        EXECUTE $sql$
            ALTER TABLE public.vendor_payouts
            ADD CONSTRAINT one_origin
            CHECK ((order_id IS NOT NULL)::int + (transaction_id IS NOT NULL)::int <= 1)
        $sql$;
    END IF;
END $$;


-- ============================================================
-- 1. release_settlements_for_vendor(uuid) → jsonb
-- ============================================================

CREATE FUNCTION public.release_settlements_for_vendor(p_vendor_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_physical_days integer;
    v_digital_days  integer;
    v_service_days  integer;
    v_released      integer := 0;
    v_released_net  numeric := 0;
BEGIN
    IF to_regclass('public.settlements')      IS NULL
    OR to_regclass('public.orders')           IS NULL
    OR to_regclass('public.vendor_balances')  IS NULL THEN
        RETURN jsonb_build_object(
            'error', 'missing_dependencies',
            'message', 'Faltan tablas base (settlements/orders/vendor_balances).'
        );
    END IF;

    IF to_regclass('public.platform_config') IS NOT NULL THEN
        SELECT (value->>'physical')::int, (value->>'digital')::int, (value->>'service')::int
          INTO v_physical_days, v_digital_days, v_service_days
          FROM public.platform_config
         WHERE key = 'escrow_release_days';
    END IF;
    v_physical_days := COALESCE(v_physical_days, 7);
    v_digital_days  := COALESCE(v_digital_days, 1);
    v_service_days  := COALESCE(v_service_days, 1);

    EXECUTE $q$
        WITH eligible AS (
            SELECT s.id, s.net_amount
              FROM public.settlements s
              JOIN public.orders o ON o.id = s.order_id
             WHERE s.vendor_profile_id = $1
               AND s.status            = 'pending'
               AND o.status            = 'delivered'
               AND o.updated_at <= now() - (
                    CASE COALESCE(o.fulfillment_type, 'physical')
                        WHEN 'digital' THEN $2
                        WHEN 'service' THEN $3
                        ELSE $4
                    END || ' days'
               )::interval
        )
        UPDATE public.settlements
           SET status = 'processing'
          FROM eligible
         WHERE settlements.id = eligible.id
    $q$ USING p_vendor_profile_id, v_digital_days, v_service_days, v_physical_days;

    GET DIAGNOSTICS v_released = ROW_COUNT;

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
        'released_count',  v_released,
        'released_amount', v_released_net
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_settlements_for_vendor(uuid) TO authenticated;


-- ============================================================
-- 2. release_settlements_all() → jsonb
-- ============================================================

CREATE FUNCTION public.release_settlements_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vendor         RECORD;
    v_total_released integer := 0;
    v_total_amount   numeric := 0;
    v_result         jsonb;
BEGIN
    IF to_regclass('public.settlements') IS NULL THEN
        RETURN jsonb_build_object('error','missing_dependencies','message','Tabla settlements no existe.');
    END IF;

    FOR v_vendor IN
        EXECUTE 'SELECT DISTINCT vendor_profile_id FROM public.settlements WHERE status = ''pending'''
    LOOP
        v_result := public.release_settlements_for_vendor(v_vendor.vendor_profile_id);
        v_total_released := v_total_released + COALESCE((v_result->>'released_count')::int, 0);
        v_total_amount   := v_total_amount   + COALESCE((v_result->>'released_amount')::numeric, 0);
    END LOOP;

    RETURN jsonb_build_object(
        'released_count',  v_total_released,
        'released_amount', v_total_amount
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_settlements_all() TO authenticated;


-- ============================================================
-- 3. request_payout(numeric) → jsonb
-- ============================================================

CREATE FUNCTION public.request_payout(p_amount numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id           uuid := auth.uid();
    v_vendor_profile_id uuid;
    v_available         numeric;
    v_min_amount        numeric;
    v_bank_id           uuid;
    v_payout_row        jsonb;
    v_amount_to_payout  numeric;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
    END IF;

    IF to_regclass('public.vendor_profiles') IS NULL
    OR to_regclass('public.vendor_payouts')  IS NULL
    OR to_regclass('public.vendor_balances') IS NULL THEN
        RAISE EXCEPTION 'Faltan tablas base de pagos.' USING ERRCODE = '42P01';
    END IF;

    SELECT id INTO v_vendor_profile_id
      FROM public.vendor_profiles
     WHERE user_id = v_user_id;

    IF v_vendor_profile_id IS NULL THEN
        RAISE EXCEPTION 'No tienes vendor_profile activo.' USING ERRCODE = '42501';
    END IF;

    IF to_regclass('public.vendor_bank_accounts') IS NOT NULL THEN
        SELECT id INTO v_bank_id
          FROM public.vendor_bank_accounts
         WHERE vendor_profile_id = v_vendor_profile_id
           AND is_default = true
           AND is_active  = true
         LIMIT 1;

        IF v_bank_id IS NULL THEN
            RAISE EXCEPTION 'Debes configurar una cuenta bancaria antes de solicitar liquidacion.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT available_balance INTO v_available
      FROM public.vendor_balances
     WHERE vendor_profile_id = v_vendor_profile_id;
    v_available := COALESCE(v_available, 0);

    IF to_regclass('public.platform_config') IS NOT NULL THEN
        SELECT (value->>'amount')::numeric INTO v_min_amount
          FROM public.platform_config WHERE key = 'min_payout_amount';
    END IF;
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

    EXECUTE $q$
        INSERT INTO public.vendor_payouts (
            vendor_id, gross_amount, sportmaps_fee, wompi_fee, net_amount, currency, status, notes
        ) VALUES ($1, $2, 0, 0, $2, 'COP', 'pending', 'Solicitado por vendor.')
        RETURNING to_jsonb(vendor_payouts.*)
    $q$ INTO v_payout_row USING v_user_id, v_amount_to_payout;

    UPDATE public.vendor_balances
       SET available_balance = available_balance - v_amount_to_payout,
           total_withdrawn   = total_withdrawn   + v_amount_to_payout,
           updated_at        = now()
     WHERE vendor_profile_id = v_vendor_profile_id;

    IF to_regclass('public.settlements') IS NOT NULL THEN
        UPDATE public.settlements
           SET status = 'paid', paid_at = now()
         WHERE vendor_profile_id = v_vendor_profile_id
           AND status = 'processing';
    END IF;

    RETURN v_payout_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_payout(numeric) TO authenticated;


-- ============================================================
-- 4. admin_generate_pending_payouts() → jsonb
-- ============================================================

CREATE FUNCTION public.admin_generate_pending_payouts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role text;
    v_vendor      RECORD;
    v_min_amount  numeric;
    v_created     integer := 0;
    v_total       numeric := 0;
BEGIN
    IF to_regclass('public.profiles')         IS NULL
    OR to_regclass('public.vendor_balances')  IS NULL
    OR to_regclass('public.vendor_profiles')  IS NULL
    OR to_regclass('public.vendor_payouts')   IS NULL THEN
        RETURN jsonb_build_object('error','missing_dependencies','message','Faltan tablas base.');
    END IF;

    SELECT role::text INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('admin','super_admin') THEN
        RAISE EXCEPTION 'Solo admin.' USING ERRCODE = '42501';
    END IF;

    IF to_regclass('public.platform_config') IS NOT NULL THEN
        SELECT (value->>'amount')::numeric INTO v_min_amount
          FROM public.platform_config WHERE key = 'min_payout_amount';
    END IF;
    v_min_amount := COALESCE(v_min_amount, 50000);

    FOR v_vendor IN
        EXECUTE $q$
            SELECT vb.vendor_profile_id, vp.user_id, vb.available_balance
              FROM public.vendor_balances vb
              JOIN public.vendor_profiles vp ON vp.id = vb.vendor_profile_id
             WHERE vb.available_balance >= $1
               AND ( $2::boolean = false
                  OR EXISTS (
                      SELECT 1 FROM public.vendor_bank_accounts
                       WHERE vendor_profile_id = vb.vendor_profile_id
                         AND is_default = true AND is_active = true
                  ) )
        $q$ USING v_min_amount, (to_regclass('public.vendor_bank_accounts') IS NOT NULL)
    LOOP
        EXECUTE $q$
            INSERT INTO public.vendor_payouts (
                vendor_id, gross_amount, sportmaps_fee, wompi_fee, net_amount, currency, status, notes
            ) VALUES ($1, $2, 0, 0, $2, 'COP', 'pending', 'Auto-generado por admin_generate_pending_payouts.')
        $q$ USING v_vendor.user_id, v_vendor.available_balance;

        UPDATE public.vendor_balances
           SET available_balance = 0,
               total_withdrawn   = total_withdrawn + v_vendor.available_balance,
               updated_at        = now()
         WHERE vendor_profile_id = v_vendor.vendor_profile_id;

        IF to_regclass('public.settlements') IS NOT NULL THEN
            UPDATE public.settlements
               SET status = 'paid', paid_at = now()
             WHERE vendor_profile_id = v_vendor.vendor_profile_id
               AND status = 'processing';
        END IF;

        v_created := v_created + 1;
        v_total   := v_total   + v_vendor.available_balance;
    END LOOP;

    RETURN jsonb_build_object('payouts_created', v_created, 'total_amount', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_generate_pending_payouts() TO authenticated;


-- ============================================================
-- 5. vendor_payout_summary() → jsonb
-- ============================================================

CREATE FUNCTION public.vendor_payout_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id    uuid := auth.uid();
    v_vp_id      uuid;
    v_pending    numeric := 0;
    v_available  numeric := 0;
    v_earned     numeric := 0;
    v_fees       numeric := 0;
    v_withdrawn  numeric := 0;
    v_min        numeric;
    v_has_bank   boolean := false;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'not_authenticated');
    END IF;

    IF to_regclass('public.vendor_profiles') IS NULL THEN
        RETURN jsonb_build_object('error', 'no_marketplace');
    END IF;

    SELECT id INTO v_vp_id FROM public.vendor_profiles WHERE user_id = v_user_id;
    IF v_vp_id IS NULL THEN
        RETURN jsonb_build_object('error', 'no_vendor_profile');
    END IF;

    IF to_regclass('public.vendor_balances') IS NOT NULL THEN
        SELECT
            COALESCE(pending_balance, 0),
            COALESCE(available_balance, 0),
            COALESCE(total_earned, 0),
            COALESCE(total_fees, 0),
            COALESCE(total_withdrawn, 0)
          INTO v_pending, v_available, v_earned, v_fees, v_withdrawn
          FROM public.vendor_balances
         WHERE vendor_profile_id = v_vp_id;
    END IF;

    IF to_regclass('public.platform_config') IS NOT NULL THEN
        SELECT (value->>'amount')::numeric INTO v_min
          FROM public.platform_config WHERE key = 'min_payout_amount';
    END IF;
    v_min := COALESCE(v_min, 50000);

    IF to_regclass('public.vendor_bank_accounts') IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.vendor_bank_accounts
             WHERE vendor_profile_id = v_vp_id
               AND is_default = true
               AND is_active  = true
        ) INTO v_has_bank;
    END IF;

    RETURN jsonb_build_object(
        'vendor_profile_id',  v_vp_id,
        'pending_balance',    v_pending,
        'available_balance',  v_available,
        'total_earned',       v_earned,
        'total_fees',         v_fees,
        'total_withdrawn',    v_withdrawn,
        'min_payout_amount',  v_min,
        'has_bank_account',   v_has_bank,
        'can_request_payout', v_has_bank AND v_available >= v_min
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_payout_summary() TO authenticated;


-- ============================================================
-- 6. Trigger: on order.status -> 'delivered' libera escrow
-- ============================================================

DO $$
BEGIN
    IF to_regclass('public.orders') IS NOT NULL THEN
        EXECUTE $func$
            CREATE FUNCTION public.trg_release_on_delivered()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $body$
            DECLARE
                v_vendor RECORD;
            BEGIN
                IF NEW.status = 'delivered'
                   AND OLD.status IS DISTINCT FROM 'delivered'
                   AND to_regclass('public.settlements') IS NOT NULL THEN
                    FOR v_vendor IN
                        SELECT DISTINCT s.vendor_profile_id
                          FROM public.settlements s
                         WHERE s.order_id = NEW.id
                           AND s.status   = 'pending'
                    LOOP
                        PERFORM public.release_settlements_for_vendor(v_vendor.vendor_profile_id);
                    END LOOP;
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
    END IF;
END $$;
