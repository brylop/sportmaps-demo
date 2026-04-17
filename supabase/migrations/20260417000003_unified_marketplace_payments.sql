-- ============================================================
-- SPORTMAPS MARKETPLACE — FASE 8: PAGOS UNIFICADOS
-- Extiende el motor financiero (fase 7) para soportar pagos
-- de SERVICIOS (fisios, coaches, psicologos), EVENTOS
-- (inscripcion individual), SUSCRIPCIONES (escuelas),
-- CORTESIAS y REEMBOLSOS.
--
-- Dependencias:
--   20260416000001_marketplace_core_tables.sql
--   20260417000001_inventory_engine.sql
--   20260417000002_financial_engine.sql
-- ============================================================


-- ============================================================
-- 1. NUEVOS ENUMS
-- ============================================================

DO $$ BEGIN
    CREATE TYPE public.checkout_type AS ENUM (
        'product',       -- compra de producto fisico/digital
        'service',       -- reserva de cita (fisio, coach, psico)
        'event',         -- inscripcion individual a evento
        'subscription',  -- suscripcion mensual escuela/servicio
        'courtesy'       -- sesion de cortesia ($0)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.refund_status AS ENUM (
        'requested', 'approved', 'processing', 'completed', 'rejected'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.subscription_status AS ENUM (
        'active', 'paused', 'cancelled', 'expired', 'past_due'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================
-- 2. TABLA marketplace_transactions (LEDGER UNIFICADO)
-- Cada transaccion del marketplace queda aqui, sin importar
-- si fue producto, servicio, evento o suscripcion.
-- Es el "single source of truth" financiero.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketplace_transactions (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    checkout_type       public.checkout_type NOT NULL,
    user_id             uuid            NOT NULL REFERENCES auth.users(id),
    vendor_profile_id   uuid            REFERENCES public.vendor_profiles(id),

    -- Referencias polimorficas — solo una se llena segun checkout_type
    order_id            uuid            REFERENCES public.orders(id),
    appointment_id      uuid            REFERENCES public.wellness_appointments(id),
    event_registration_id uuid          REFERENCES public.event_registrations(id),
    subscription_id     uuid,           -- FK added after subscription table creation

    -- Montos
    gross_amount        numeric         NOT NULL CHECK (gross_amount >= 0),
    platform_fee        numeric         NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    gateway_fee         numeric         NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
    tax_amount          numeric         NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    net_amount          numeric         NOT NULL CHECK (net_amount >= 0),
    currency            text            NOT NULL DEFAULT 'COP',

    -- ePayco
    epayco_ref          text            UNIQUE,
    epayco_session_id   text,
    payment_method      text,

    -- Estado
    status              text            NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending','processing','paid','failed','refunded','cancelled')),

    -- Metadata
    description         text,
    metadata            jsonb           NOT NULL DEFAULT '{}',
    paid_at             timestamptz,
    created_at          timestamptz     NOT NULL DEFAULT now(),
    updated_at          timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_tx_user ON public.marketplace_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mkt_tx_vendor ON public.marketplace_transactions(vendor_profile_id) WHERE vendor_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_tx_type ON public.marketplace_transactions(checkout_type);
CREATE INDEX IF NOT EXISTS idx_mkt_tx_status ON public.marketplace_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mkt_tx_order ON public.marketplace_transactions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_tx_appointment ON public.marketplace_transactions(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_tx_event_reg ON public.marketplace_transactions(event_registration_id) WHERE event_registration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_tx_epayco_ref ON public.marketplace_transactions(epayco_ref) WHERE epayco_ref IS NOT NULL;

DROP TRIGGER IF EXISTS trg_mkt_tx_updated_at ON public.marketplace_transactions;
CREATE TRIGGER trg_mkt_tx_updated_at
    BEFORE UPDATE ON public.marketplace_transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 3. ALTER wellness_appointments — columnas de pago
-- Permite vincular una cita con su pago y con la cortesia
-- ============================================================

ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS service_listing_id uuid REFERENCES public.service_listings(id);

ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS service_variation_id uuid REFERENCES public.service_variations(id);

ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0 CHECK (price >= 0);

ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'COP';

ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'courtesy', 'refunded', 'not_required'));

ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS is_courtesy boolean NOT NULL DEFAULT false;

ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS booking_source text NOT NULL DEFAULT 'direct'
        CHECK (booking_source IN ('direct', 'marketplace', 'referral'));

ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.wellness_appointments
    ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_wellness_apt_service ON public.wellness_appointments(service_listing_id) WHERE service_listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wellness_apt_payment ON public.wellness_appointments(payment_status);


-- ============================================================
-- 4. ALTER event_registrations — columnas de pago marketplace
-- ============================================================

ALTER TABLE public.event_registrations
    ADD COLUMN IF NOT EXISTS price_paid numeric NOT NULL DEFAULT 0 CHECK (price_paid >= 0);

ALTER TABLE public.event_registrations
    ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'COP';

ALTER TABLE public.event_registrations
    ADD COLUMN IF NOT EXISTS epayco_ref text;

ALTER TABLE public.event_registrations
    ADD COLUMN IF NOT EXISTS registration_source text NOT NULL DEFAULT 'direct'
        CHECK (registration_source IN ('direct', 'marketplace', 'delegation'));


-- ============================================================
-- 5. TABLA subscription_plans (planes recurrentes)
-- Para escuelas (mensualidad) y servicios (paquetes sesiones)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    name                text        NOT NULL,
    description         text,
    plan_type           text        NOT NULL CHECK (plan_type IN ('school_monthly', 'service_package', 'event_season_pass')),
    price               numeric     NOT NULL CHECK (price > 0),
    currency            text        NOT NULL DEFAULT 'COP',
    billing_period      text        NOT NULL DEFAULT 'monthly'
                                    CHECK (billing_period IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
    sessions_included   integer,    -- NULL = ilimitado, para paquetes de sesiones
    features            jsonb       NOT NULL DEFAULT '[]',
    trial_days          integer     NOT NULL DEFAULT 0,
    is_active           boolean     NOT NULL DEFAULT true,
    max_subscribers     integer,    -- NULL = sin limite
    tax_rate            numeric     NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 1),
    metadata            jsonb       NOT NULL DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_plans_vendor ON public.subscription_plans(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_sub_plans_type ON public.subscription_plans(plan_type);
CREATE INDEX IF NOT EXISTS idx_sub_plans_active ON public.subscription_plans(is_active);

DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trg_subscription_plans_updated_at
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 6. TABLA subscriptions (suscripciones activas)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_plan_id    uuid        NOT NULL REFERENCES public.subscription_plans(id),
    user_id                 uuid        NOT NULL REFERENCES auth.users(id),
    vendor_profile_id       uuid        NOT NULL REFERENCES public.vendor_profiles(id),
    status                  public.subscription_status NOT NULL DEFAULT 'active',
    current_period_start    timestamptz NOT NULL DEFAULT now(),
    current_period_end      timestamptz NOT NULL,
    trial_end               timestamptz,
    sessions_remaining      integer,    -- para paquetes de sesiones
    cancel_at_period_end    boolean     NOT NULL DEFAULT false,
    cancelled_at            timestamptz,
    cancellation_reason     text,
    last_payment_at         timestamptz,
    next_payment_at         timestamptz,
    total_paid              numeric     NOT NULL DEFAULT 0,
    payment_failures        integer     NOT NULL DEFAULT 0,
    metadata                jsonb       NOT NULL DEFAULT '{}',
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_vendor ON public.subscriptions(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_pay ON public.subscriptions(next_payment_at) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Agregar FK en marketplace_transactions ahora que subscriptions existe
ALTER TABLE public.marketplace_transactions
    ADD CONSTRAINT fk_mkt_tx_subscription
    FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);

CREATE INDEX IF NOT EXISTS idx_mkt_tx_subscription ON public.marketplace_transactions(subscription_id)
    WHERE subscription_id IS NOT NULL;


-- ============================================================
-- 7. TABLA refunds (reembolsos)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.refunds (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id          uuid        NOT NULL REFERENCES public.marketplace_transactions(id),
    requested_by            uuid        NOT NULL REFERENCES auth.users(id),
    amount                  numeric     NOT NULL CHECK (amount > 0),
    reason                  text        NOT NULL,
    status                  public.refund_status NOT NULL DEFAULT 'requested',
    reviewed_by             uuid        REFERENCES auth.users(id),
    reviewed_at             timestamptz,
    rejection_reason        text,
    epayco_refund_ref       text,
    refunded_at             timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_transaction ON public.refunds(transaction_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_user ON public.refunds(requested_by);

DROP TRIGGER IF EXISTS trg_refunds_updated_at ON public.refunds;
CREATE TRIGGER trg_refunds_updated_at
    BEFORE UPDATE ON public.refunds
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 8. PLATFORM CONFIG — nuevas claves para servicios/eventos
-- ============================================================

INSERT INTO public.platform_config (key, value, description) VALUES
    ('service_commission_rate', '{"default": 0.10, "fisioterapia": 0.08, "nutricion": 0.10, "psicologia": 0.10, "entrenamiento": 0.12}',
     'Comision por tipo de servicio. Fisio tiene descuento por demanda alta.'),
    ('event_commission_rate', '{"default": 0.05, "max": 0.15}',
     'Comision para eventos con inscripcion individual. Mas baja para incentivar organizadores.'),
    ('courtesy_limits', '{"max_per_professional_per_month": 5, "max_per_athlete_per_professional": 1}',
     'Limites de sesiones de cortesia para evitar abuso.'),
    ('cancellation_refund_policy', '{"full_refund_hours": 48, "partial_refund_hours": 24, "partial_refund_pct": 50, "no_refund_hours": 0}',
     'Politica de reembolso por cancelacion: >48h=100%, 24-48h=50%, <24h=0%'),
    ('subscription_grace_period_days', '{"days": 3}',
     'Dias de gracia despues de fallo de pago antes de pausar suscripcion.'),
    ('epayco_split_config', '{"enabled": true, "min_split_amount": 5000}',
     'Configuracion de split de pagos via ePayco. min_split_amount en COP.')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 9. RLS — TODAS LAS NUEVAS TABLAS
-- ============================================================

-- 9a. marketplace_transactions
ALTER TABLE public.marketplace_transactions ENABLE ROW LEVEL SECURITY;

-- Comprador ve sus transacciones
CREATE POLICY "mkt_tx_select_buyer"
    ON public.marketplace_transactions FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Vendedor ve transacciones donde es vendor
CREATE POLICY "mkt_tx_select_vendor"
    ON public.marketplace_transactions FOR SELECT TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );

-- 9b. subscription_plans
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Publico: ver planes activos
CREATE POLICY "sub_plans_select_public"
    ON public.subscription_plans FOR SELECT
    USING (is_active = true);

-- Owner: CRUD completo
CREATE POLICY "sub_plans_owner"
    ON public.subscription_plans FOR ALL TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );

-- 9c. subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Suscriptor ve sus suscripciones
CREATE POLICY "subscriptions_select_user"
    ON public.subscriptions FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Vendor ve suscripciones de su plan
CREATE POLICY "subscriptions_select_vendor"
    ON public.subscriptions FOR SELECT TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );

-- Suscriptor puede crear suscripcion
CREATE POLICY "subscriptions_insert_user"
    ON public.subscriptions FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Suscriptor puede cancelar
CREATE POLICY "subscriptions_update_user"
    ON public.subscriptions FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- 9d. refunds
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Usuario ve sus solicitudes de reembolso
CREATE POLICY "refunds_select_requester"
    ON public.refunds FOR SELECT TO authenticated
    USING (requested_by = auth.uid());

-- Vendor ve reembolsos de sus transacciones
CREATE POLICY "refunds_select_vendor"
    ON public.refunds FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.marketplace_transactions mt
            WHERE mt.id = refunds.transaction_id
              AND mt.vendor_profile_id IN (
                  SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
              )
        )
    );

-- Usuario puede solicitar reembolso
CREATE POLICY "refunds_insert_requester"
    ON public.refunds FOR INSERT TO authenticated
    WITH CHECK (requested_by = auth.uid());


-- ============================================================
-- 10. RPC: create_service_checkout
-- Crea una transaccion de pago para una cita de servicio.
-- Retorna el transaction_id para luego iniciar ePayco.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_service_checkout(
    p_appointment_id uuid,
    p_service_listing_id uuid DEFAULT NULL,
    p_service_variation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_appointment RECORD;
    v_service RECORD;
    v_vendor_profile_id uuid;
    v_price numeric;
    v_commission_rate numeric;
    v_platform_fee numeric;
    v_gateway_fee numeric;
    v_net_amount numeric;
    v_tx_id uuid;
    v_is_courtesy boolean;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
    END IF;

    -- Obtener la cita
    SELECT * INTO v_appointment
    FROM wellness_appointments
    WHERE id = p_appointment_id
      AND athlete_id = v_user_id
      AND status IN ('pending', 'confirmed');

    IF v_appointment IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Cita no encontrada o no pertenece al usuario');
    END IF;

    -- Ya tiene pago?
    IF v_appointment.payment_status IN ('paid', 'courtesy') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Esta cita ya fue pagada');
    END IF;

    -- Obtener servicio y precio
    IF p_service_variation_id IS NOT NULL THEN
        SELECT sv.price, sv.duration_minutes, sl.vendor_profile_id
        INTO v_price, v_appointment.duration_minutes, v_vendor_profile_id
        FROM service_variations sv
        JOIN service_listings sl ON sl.id = sv.service_listing_id
        WHERE sv.id = p_service_variation_id AND sv.is_active = true;
    ELSIF p_service_listing_id IS NOT NULL THEN
        SELECT sl.price, sl.duration_minutes, sl.vendor_profile_id
        INTO v_price, v_appointment.duration_minutes, v_vendor_profile_id
        FROM service_listings sl
        WHERE sl.id = p_service_listing_id AND sl.is_active = true;
    ELSE
        -- Precio viene directamente de la cita
        v_price := v_appointment.price;
        SELECT vp.id INTO v_vendor_profile_id
        FROM vendor_profiles vp
        WHERE vp.user_id = v_appointment.professional_id;
    END IF;

    IF v_vendor_profile_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Profesional no tiene perfil de vendedor');
    END IF;

    -- Cortesia? ($0)
    v_is_courtesy := (v_price = 0 OR v_appointment.is_courtesy = true);

    IF v_is_courtesy THEN
        -- Verificar limites de cortesia
        DECLARE
            v_courtesy_config jsonb;
            v_month_count integer;
        BEGIN
            SELECT value INTO v_courtesy_config FROM platform_config WHERE key = 'courtesy_limits';

            SELECT COUNT(*) INTO v_month_count
            FROM wellness_appointments
            WHERE professional_id = v_appointment.professional_id
              AND is_courtesy = true
              AND created_at >= date_trunc('month', now());

            IF v_month_count >= COALESCE((v_courtesy_config->>'max_per_professional_per_month')::integer, 5) THEN
                RETURN jsonb_build_object('ok', false, 'error',
                    'El profesional alcanzó el limite mensual de cortesias');
            END IF;
        END;

        -- Marcar cita como cortesia
        UPDATE wellness_appointments
        SET payment_status = 'courtesy',
            is_courtesy = true,
            price = 0,
            service_listing_id = COALESCE(p_service_listing_id, service_listing_id),
            service_variation_id = COALESCE(p_service_variation_id, service_variation_id),
            status = 'confirmed'
        WHERE id = p_appointment_id;

        -- Crear transaccion $0 para registro
        INSERT INTO marketplace_transactions (
            checkout_type, user_id, vendor_profile_id, appointment_id,
            gross_amount, platform_fee, gateway_fee, net_amount,
            status, description, paid_at
        ) VALUES (
            'courtesy', v_user_id, v_vendor_profile_id, p_appointment_id,
            0, 0, 0, 0,
            'paid', 'Sesión de cortesía', now()
        ) RETURNING id INTO v_tx_id;

        RETURN jsonb_build_object(
            'ok', true,
            'transaction_id', v_tx_id,
            'is_courtesy', true,
            'amount', 0,
            'message', 'Sesión de cortesía confirmada'
        );
    END IF;

    -- Calcular comisiones
    SELECT COALESCE(
        (SELECT (value->>COALESCE(
            (SELECT lower(sl.service_type) FROM service_listings sl WHERE sl.id = COALESCE(p_service_listing_id, v_appointment.service_listing_id)),
            'default'
        ))::numeric FROM platform_config WHERE key = 'service_commission_rate'),
        0.10
    ) INTO v_commission_rate;

    v_platform_fee := ROUND(v_price * v_commission_rate, 2);
    v_gateway_fee := ROUND(v_price * COALESCE(
        (SELECT (value->>'epayco')::numeric FROM platform_config WHERE key = 'gateway_fee_rate'),
        0.029
    ), 2);
    v_net_amount := v_price - v_platform_fee - v_gateway_fee;

    -- Actualizar cita con precio y servicio
    UPDATE wellness_appointments
    SET price = v_price,
        service_listing_id = COALESCE(p_service_listing_id, service_listing_id),
        service_variation_id = COALESCE(p_service_variation_id, service_variation_id),
        booking_source = 'marketplace'
    WHERE id = p_appointment_id;

    -- Crear transaccion pendiente
    INSERT INTO marketplace_transactions (
        checkout_type, user_id, vendor_profile_id, appointment_id,
        gross_amount, platform_fee, gateway_fee, net_amount,
        status, description
    ) VALUES (
        'service', v_user_id, v_vendor_profile_id, p_appointment_id,
        v_price, v_platform_fee, v_gateway_fee, v_net_amount,
        'pending',
        format('Cita %s — %s',
            COALESCE((SELECT name FROM service_listings WHERE id = p_service_listing_id), v_appointment.service_type),
            to_char(v_appointment.appointment_date, 'DD/MM/YYYY')
        )
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object(
        'ok', true,
        'transaction_id', v_tx_id,
        'is_courtesy', false,
        'amount', v_price,
        'platform_fee', v_platform_fee,
        'net_to_professional', v_net_amount,
        'vendor_profile_id', v_vendor_profile_id,
        'message', 'Checkout creado. Proceder con ePayco.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_service_checkout TO authenticated;


-- ============================================================
-- 11. RPC: create_event_checkout
-- Crea transaccion de pago para inscripcion individual a evento.
-- Valida cupo, precio, permisos del organizador.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_event_checkout(
    p_event_registration_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_reg RECORD;
    v_event RECORD;
    v_vendor_profile_id uuid;
    v_commission_rate numeric;
    v_platform_fee numeric;
    v_gateway_fee numeric;
    v_net_amount numeric;
    v_tx_id uuid;
    v_current_count integer;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
    END IF;

    -- Obtener registro
    SELECT * INTO v_reg
    FROM event_registrations
    WHERE id = p_event_registration_id
      AND user_id = v_user_id;

    IF v_reg IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Registro de evento no encontrado');
    END IF;

    -- Ya pagado?
    IF v_reg.payment_status IN ('verified', 'not_required') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Este registro ya fue pagado');
    END IF;

    -- Obtener evento
    SELECT * INTO v_event FROM events WHERE id = v_reg.event_id;

    IF v_event IS NULL OR v_event.status != 'active' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Evento no disponible');
    END IF;

    IF NOT v_event.registrations_open THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Las inscripciones estan cerradas');
    END IF;

    -- Verificar cupo
    SELECT COUNT(*) INTO v_current_count
    FROM event_registrations
    WHERE event_id = v_event.id
      AND status IN ('pending', 'approved');

    IF v_current_count >= v_event.capacity THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Evento lleno — no hay cupos disponibles');
    END IF;

    -- Evento gratuito?
    IF v_event.price = 0 THEN
        UPDATE event_registrations
        SET payment_status = 'not_required',
            status = 'approved',
            price_paid = 0,
            registration_source = 'marketplace'
        WHERE id = p_event_registration_id;

        INSERT INTO marketplace_transactions (
            checkout_type, user_id, event_registration_id,
            gross_amount, platform_fee, gateway_fee, net_amount,
            status, description, paid_at
        ) VALUES (
            'event', v_user_id, p_event_registration_id,
            0, 0, 0, 0,
            'paid', format('Inscripción gratuita — %s', v_event.title), now()
        ) RETURNING id INTO v_tx_id;

        RETURN jsonb_build_object(
            'ok', true,
            'transaction_id', v_tx_id,
            'is_free', true,
            'message', 'Inscripción gratuita confirmada'
        );
    END IF;

    -- Buscar vendor_profile del organizador
    SELECT vp.id INTO v_vendor_profile_id
    FROM vendor_profiles vp
    WHERE vp.user_id = v_event.creator_id;

    -- Calcular comisiones
    SELECT COALESCE(
        (SELECT (value->>'default')::numeric FROM platform_config WHERE key = 'event_commission_rate'),
        0.05
    ) INTO v_commission_rate;

    v_platform_fee := ROUND(v_event.price * v_commission_rate, 2);
    v_gateway_fee := ROUND(v_event.price * COALESCE(
        (SELECT (value->>'epayco')::numeric FROM platform_config WHERE key = 'gateway_fee_rate'),
        0.029
    ), 2);
    v_net_amount := v_event.price - v_platform_fee - v_gateway_fee;

    -- Actualizar registro con source
    UPDATE event_registrations
    SET registration_source = 'marketplace'
    WHERE id = p_event_registration_id;

    -- Crear transaccion pendiente
    INSERT INTO marketplace_transactions (
        checkout_type, user_id, vendor_profile_id, event_registration_id,
        gross_amount, platform_fee, gateway_fee, net_amount,
        status, description
    ) VALUES (
        'event', v_user_id, v_vendor_profile_id, p_event_registration_id,
        v_event.price, v_platform_fee, v_gateway_fee, v_net_amount,
        'pending',
        format('Inscripción — %s (%s)', v_event.title, to_char(v_event.event_date, 'DD/MM/YYYY'))
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object(
        'ok', true,
        'transaction_id', v_tx_id,
        'is_free', false,
        'amount', v_event.price,
        'platform_fee', v_platform_fee,
        'net_to_organizer', v_net_amount,
        'vendor_profile_id', v_vendor_profile_id,
        'message', 'Checkout creado. Proceder con ePayco.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_event_checkout TO authenticated;


-- ============================================================
-- 12. RPC: create_subscription
-- Crea una suscripcion y la primera transaccion de cobro.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_subscription(
    p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_plan RECORD;
    v_vendor_profile_id uuid;
    v_period_end timestamptz;
    v_trial_end timestamptz;
    v_sub_id uuid;
    v_tx_id uuid;
    v_commission_rate numeric;
    v_platform_fee numeric;
    v_gateway_fee numeric;
    v_net_amount numeric;
    v_current_subs integer;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
    END IF;

    -- Obtener plan
    SELECT * INTO v_plan FROM subscription_plans WHERE id = p_plan_id AND is_active = true;
    IF v_plan IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Plan no encontrado o inactivo');
    END IF;

    v_vendor_profile_id := v_plan.vendor_profile_id;

    -- Verificar que no tenga suscripcion activa al mismo plan
    IF EXISTS (
        SELECT 1 FROM subscriptions
        WHERE subscription_plan_id = p_plan_id
          AND user_id = v_user_id
          AND status IN ('active', 'paused')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Ya tienes una suscripción activa a este plan');
    END IF;

    -- Verificar cupo maximo de suscriptores
    IF v_plan.max_subscribers IS NOT NULL THEN
        SELECT COUNT(*) INTO v_current_subs
        FROM subscriptions
        WHERE subscription_plan_id = p_plan_id AND status = 'active';

        IF v_current_subs >= v_plan.max_subscribers THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Este plan ha alcanzado su cupo máximo');
        END IF;
    END IF;

    -- Calcular periodo
    v_period_end := now() + CASE v_plan.billing_period
        WHEN 'weekly' THEN interval '7 days'
        WHEN 'biweekly' THEN interval '14 days'
        WHEN 'monthly' THEN interval '1 month'
        WHEN 'quarterly' THEN interval '3 months'
        WHEN 'yearly' THEN interval '1 year'
        ELSE interval '1 month'
    END;

    -- Trial?
    IF v_plan.trial_days > 0 THEN
        v_trial_end := now() + (v_plan.trial_days || ' days')::interval;
    END IF;

    -- Crear suscripcion
    INSERT INTO subscriptions (
        subscription_plan_id, user_id, vendor_profile_id,
        status, current_period_start, current_period_end,
        trial_end, sessions_remaining, next_payment_at
    ) VALUES (
        p_plan_id, v_user_id, v_vendor_profile_id,
        CASE WHEN v_plan.trial_days > 0 THEN 'active' ELSE 'active' END,
        now(), v_period_end,
        v_trial_end, v_plan.sessions_included,
        CASE WHEN v_plan.trial_days > 0 THEN v_trial_end ELSE v_period_end END
    ) RETURNING id INTO v_sub_id;

    -- Si hay trial, no cobrar ahora
    IF v_plan.trial_days > 0 THEN
        RETURN jsonb_build_object(
            'ok', true,
            'subscription_id', v_sub_id,
            'is_trial', true,
            'trial_end', v_trial_end,
            'message', format('Periodo de prueba de %s dias activado', v_plan.trial_days)
        );
    END IF;

    -- Calcular comisiones para el primer cobro
    SELECT COALESCE(vp.commission_rate, 0.10) INTO v_commission_rate
    FROM vendor_profiles vp WHERE vp.id = v_vendor_profile_id;

    v_platform_fee := ROUND(v_plan.price * v_commission_rate, 2);
    v_gateway_fee := ROUND(v_plan.price * COALESCE(
        (SELECT (value->>'epayco')::numeric FROM platform_config WHERE key = 'gateway_fee_rate'),
        0.029
    ), 2);
    v_net_amount := v_plan.price - v_platform_fee - v_gateway_fee;

    -- Crear transaccion de primer cobro
    INSERT INTO marketplace_transactions (
        checkout_type, user_id, vendor_profile_id, subscription_id,
        gross_amount, platform_fee, gateway_fee, net_amount,
        status, description
    ) VALUES (
        'subscription', v_user_id, v_vendor_profile_id, v_sub_id,
        v_plan.price, v_platform_fee, v_gateway_fee, v_net_amount,
        'pending',
        format('Suscripción %s — %s', v_plan.name, v_plan.billing_period)
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object(
        'ok', true,
        'subscription_id', v_sub_id,
        'transaction_id', v_tx_id,
        'is_trial', false,
        'amount', v_plan.price,
        'platform_fee', v_platform_fee,
        'net_to_vendor', v_net_amount,
        'message', 'Suscripción creada. Proceder con pago.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_subscription TO authenticated;


-- ============================================================
-- 13. RPC: confirm_marketplace_payment
-- Llamado por el webhook de ePayco cuando se confirma el pago.
-- Actualiza la transaccion, crea settlement, mueve fondos.
-- Funciona para TODOS los checkout_type.
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_marketplace_payment(
    p_transaction_id uuid,
    p_epayco_ref text,
    p_payment_method text DEFAULT 'epayco'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tx RECORD;
    v_settlement_id uuid;
BEGIN
    -- Obtener transaccion
    SELECT * INTO v_tx
    FROM marketplace_transactions
    WHERE id = p_transaction_id AND status = 'pending'
    FOR UPDATE;

    IF v_tx IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Transacción no encontrada o ya procesada');
    END IF;

    -- Idempotencia
    IF p_epayco_ref IS NOT NULL AND EXISTS (
        SELECT 1 FROM marketplace_transactions WHERE epayco_ref = p_epayco_ref AND id != p_transaction_id
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ePayco ref ya procesada');
    END IF;

    -- 1. Actualizar transaccion
    UPDATE marketplace_transactions
    SET status = 'paid',
        epayco_ref = p_epayco_ref,
        payment_method = p_payment_method,
        paid_at = now()
    WHERE id = p_transaction_id;

    -- 2. Acciones segun tipo de checkout
    CASE v_tx.checkout_type
        WHEN 'service' THEN
            -- Confirmar cita y marcar como pagada
            UPDATE wellness_appointments
            SET payment_status = 'paid', status = 'confirmed'
            WHERE id = v_tx.appointment_id;

        WHEN 'event' THEN
            -- Aprobar registro y marcar pago
            UPDATE event_registrations
            SET payment_status = 'verified',
                status = 'approved',
                price_paid = v_tx.gross_amount,
                epayco_ref = p_epayco_ref
            WHERE id = v_tx.event_registration_id;

        WHEN 'subscription' THEN
            -- Actualizar suscripcion con fecha de pago
            UPDATE subscriptions
            SET last_payment_at = now(),
                total_paid = total_paid + v_tx.gross_amount,
                payment_failures = 0
            WHERE id = v_tx.subscription_id;

        ELSE
            NULL; -- product checkout ya se maneja por el trigger existente en orders
    END CASE;

    -- 3. Crear settlement si hay vendor
    IF v_tx.vendor_profile_id IS NOT NULL AND v_tx.net_amount > 0 THEN
        -- Crear settlement vinculado a esta transaccion
        INSERT INTO settlements (
            vendor_profile_id,
            order_id,
            gross_amount, platform_fee, gateway_fee, tax_amount, net_amount,
            status
        ) VALUES (
            v_tx.vendor_profile_id,
            v_tx.order_id,  -- NULL para servicios/eventos, ok
            v_tx.gross_amount, v_tx.platform_fee, v_tx.gateway_fee, v_tx.tax_amount, v_tx.net_amount,
            'pending'
        ) RETURNING id INTO v_settlement_id;

        -- Mover a pending_balance (escrow)
        UPDATE vendor_balances
        SET pending_balance = pending_balance + v_tx.net_amount,
            total_earned = total_earned + v_tx.gross_amount,
            total_fees = total_fees + v_tx.platform_fee + v_tx.gateway_fee
        WHERE vendor_profile_id = v_tx.vendor_profile_id;
    END IF;

    -- 4. Notificar al vendedor
    IF v_tx.vendor_profile_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, message, type, link)
        SELECT vp.user_id,
               'Nuevo pago recibido',
               format('Has recibido un pago de $%s COP por %s', v_tx.gross_amount, v_tx.description),
               'success',
               '/vendor/finances'
        FROM vendor_profiles vp WHERE vp.id = v_tx.vendor_profile_id;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'transaction_id', p_transaction_id,
        'checkout_type', v_tx.checkout_type,
        'settlement_id', v_settlement_id,
        'amount', v_tx.gross_amount,
        'message', 'Pago confirmado exitosamente'
    );
END;
$$;


-- ============================================================
-- 14. RPC: request_refund
-- El usuario solicita reembolso. Aplica politica de cancelacion.
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_refund(
    p_transaction_id uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_tx RECORD;
    v_policy jsonb;
    v_hours_until numeric;
    v_refund_pct numeric;
    v_refund_amount numeric;
    v_refund_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
    END IF;

    -- Obtener transaccion
    SELECT * INTO v_tx
    FROM marketplace_transactions
    WHERE id = p_transaction_id
      AND user_id = v_user_id
      AND status = 'paid';

    IF v_tx IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Transacción no encontrada o no elegible');
    END IF;

    -- Ya tiene reembolso activo?
    IF EXISTS (
        SELECT 1 FROM refunds
        WHERE transaction_id = p_transaction_id
          AND status IN ('requested', 'approved', 'processing')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Ya existe una solicitud de reembolso activa');
    END IF;

    -- Obtener politica de cancelacion
    SELECT value INTO v_policy FROM platform_config WHERE key = 'cancellation_refund_policy';

    -- Calcular horas hasta el servicio/evento
    CASE v_tx.checkout_type
        WHEN 'service' THEN
            SELECT EXTRACT(EPOCH FROM (
                (wa.appointment_date + wa.appointment_time) - now()
            )) / 3600.0 INTO v_hours_until
            FROM wellness_appointments wa WHERE wa.id = v_tx.appointment_id;

        WHEN 'event' THEN
            SELECT EXTRACT(EPOCH FROM (
                (e.event_date + e.start_time) - now()
            )) / 3600.0 INTO v_hours_until
            FROM event_registrations er
            JOIN events e ON e.id = er.event_id
            WHERE er.id = v_tx.event_registration_id;

        ELSE
            v_hours_until := 999; -- productos: siempre aplicar politica completa
    END CASE;

    -- Aplicar politica escalonada
    IF v_hours_until >= COALESCE((v_policy->>'full_refund_hours')::numeric, 48) THEN
        v_refund_pct := 100;
    ELSIF v_hours_until >= COALESCE((v_policy->>'partial_refund_hours')::numeric, 24) THEN
        v_refund_pct := COALESCE((v_policy->>'partial_refund_pct')::numeric, 50);
    ELSE
        v_refund_pct := 0;
    END IF;

    IF v_refund_pct = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'No es posible obtener reembolso. La política requiere al menos 24 horas de anticipación.',
            'hours_until', v_hours_until
        );
    END IF;

    v_refund_amount := ROUND(v_tx.gross_amount * (v_refund_pct / 100.0), 2);

    -- Crear solicitud de reembolso
    INSERT INTO refunds (
        transaction_id, requested_by, amount, reason,
        status
    ) VALUES (
        p_transaction_id, v_user_id, v_refund_amount, p_reason,
        CASE WHEN v_refund_pct = 100 THEN 'approved' ELSE 'requested' END
    ) RETURNING id INTO v_refund_id;

    RETURN jsonb_build_object(
        'ok', true,
        'refund_id', v_refund_id,
        'refund_amount', v_refund_amount,
        'refund_pct', v_refund_pct,
        'hours_until_event', ROUND(v_hours_until::numeric, 1),
        'auto_approved', v_refund_pct = 100,
        'message', CASE
            WHEN v_refund_pct = 100 THEN 'Reembolso completo aprobado automáticamente'
            ELSE format('Reembolso parcial (%s%%) solicitado. Pendiente de aprobación.', v_refund_pct)
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_refund TO authenticated;


-- ============================================================
-- 15. RPC: process_refund
-- Admin/vendor aprueba y procesa el reembolso.
-- Revierte el settlement y ajusta balances.
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_refund(p_refund_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refund RECORD;
    v_tx RECORD;
BEGIN
    SELECT * INTO v_refund FROM refunds WHERE id = p_refund_id AND status IN ('approved', 'requested');
    IF v_refund IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Reembolso no encontrado o no procesable');
    END IF;

    SELECT * INTO v_tx FROM marketplace_transactions WHERE id = v_refund.transaction_id;

    -- Marcar reembolso como completado
    UPDATE refunds
    SET status = 'completed', refunded_at = now()
    WHERE id = p_refund_id;

    -- Marcar transaccion como reembolsada
    UPDATE marketplace_transactions
    SET status = 'refunded'
    WHERE id = v_refund.transaction_id;

    -- Revertir settlement si existe vendor
    IF v_tx.vendor_profile_id IS NOT NULL THEN
        -- Reducir pending o available balance
        UPDATE vendor_balances
        SET pending_balance = GREATEST(pending_balance - v_tx.net_amount, 0),
            total_earned = GREATEST(total_earned - v_tx.gross_amount, 0),
            total_fees = GREATEST(total_fees - v_tx.platform_fee - v_tx.gateway_fee, 0)
        WHERE vendor_profile_id = v_tx.vendor_profile_id;

        -- Marcar settlement como failed
        UPDATE settlements
        SET status = 'failed'
        WHERE vendor_profile_id = v_tx.vendor_profile_id
          AND order_id = v_tx.order_id
          AND status = 'pending';
    END IF;

    -- Cancelar cita/registro segun tipo
    CASE v_tx.checkout_type
        WHEN 'service' THEN
            UPDATE wellness_appointments
            SET status = 'cancelled',
                payment_status = 'refunded',
                cancellation_reason = 'Reembolso procesado',
                cancelled_at = now()
            WHERE id = v_tx.appointment_id;

        WHEN 'event' THEN
            UPDATE event_registrations
            SET status = 'cancelled', payment_status = 'rejected'
            WHERE id = v_tx.event_registration_id;

        WHEN 'subscription' THEN
            UPDATE subscriptions
            SET status = 'cancelled', cancelled_at = now(),
                cancellation_reason = 'Reembolso procesado'
            WHERE id = v_tx.subscription_id;

        ELSE NULL;
    END CASE;

    -- Notificar al comprador
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
        v_tx.user_id,
        'Reembolso procesado',
        format('Tu reembolso de $%s COP ha sido procesado.', v_refund.amount),
        'success',
        '/mis-compras'
    );

    RETURN jsonb_build_object(
        'ok', true,
        'refund_id', p_refund_id,
        'amount', v_refund.amount,
        'message', 'Reembolso procesado exitosamente'
    );
END;
$$;


-- ============================================================
-- 16. RPC: get_vendor_financial_summary
-- Dashboard financiero para el vendedor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_vendor_financial_summary(
    p_vendor_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance RECORD;
    v_monthly_sales jsonb;
    v_recent_transactions jsonb;
    v_pending_payouts jsonb;
BEGIN
    -- Verificar owner
    IF NOT EXISTS (
        SELECT 1 FROM vendor_profiles
        WHERE id = p_vendor_profile_id AND user_id = auth.uid()
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
    END IF;

    -- Balance actual
    SELECT * INTO v_balance FROM vendor_balances WHERE vendor_profile_id = p_vendor_profile_id;

    -- Ventas del mes actual por tipo
    SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]') INTO v_monthly_sales
    FROM (
        SELECT checkout_type, COUNT(*) AS count, SUM(gross_amount) AS total
        FROM marketplace_transactions
        WHERE vendor_profile_id = p_vendor_profile_id
          AND status = 'paid'
          AND paid_at >= date_trunc('month', now())
        GROUP BY checkout_type
    ) sub;

    -- Ultimas 10 transacciones
    SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]') INTO v_recent_transactions
    FROM (
        SELECT id, checkout_type, gross_amount, net_amount, status, description, paid_at, created_at
        FROM marketplace_transactions
        WHERE vendor_profile_id = p_vendor_profile_id
        ORDER BY created_at DESC
        LIMIT 10
    ) sub;

    -- Payouts pendientes
    SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]') INTO v_pending_payouts
    FROM (
        SELECT id, amount, status, created_at
        FROM payout_requests
        WHERE vendor_profile_id = p_vendor_profile_id
          AND status IN ('pending', 'processing')
        ORDER BY created_at DESC
    ) sub;

    RETURN jsonb_build_object(
        'ok', true,
        'balance', jsonb_build_object(
            'total_earned', COALESCE(v_balance.total_earned, 0),
            'total_fees', COALESCE(v_balance.total_fees, 0),
            'available', COALESCE(v_balance.available_balance, 0),
            'pending', COALESCE(v_balance.pending_balance, 0),
            'withdrawn', COALESCE(v_balance.total_withdrawn, 0)
        ),
        'monthly_sales', v_monthly_sales,
        'recent_transactions', v_recent_transactions,
        'pending_payouts', v_pending_payouts
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_financial_summary TO authenticated;


-- ============================================================
-- 17. FUNCTION: process_subscription_renewals
-- Cron diario: identifica suscripciones que necesitan cobro,
-- crea transaccion pendiente y notifica al usuario.
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_subscription_renewals()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub RECORD;
    v_plan RECORD;
    v_commission_rate numeric;
    v_platform_fee numeric;
    v_gateway_fee numeric;
    v_net_amount numeric;
    v_new_period_end timestamptz;
    v_processed integer := 0;
    v_grace_days integer;
BEGIN
    -- Obtener grace period
    SELECT COALESCE((value->>'days')::integer, 3) INTO v_grace_days
    FROM platform_config WHERE key = 'subscription_grace_period_days';

    FOR v_sub IN
        SELECT s.* FROM subscriptions s
        WHERE s.status = 'active'
          AND s.cancel_at_period_end = false
          AND s.next_payment_at <= now()
    LOOP
        SELECT * INTO v_plan FROM subscription_plans WHERE id = v_sub.subscription_plan_id;
        IF v_plan IS NULL OR NOT v_plan.is_active THEN
            CONTINUE;
        END IF;

        -- Calcular nuevo periodo
        v_new_period_end := v_sub.current_period_end + CASE v_plan.billing_period
            WHEN 'weekly' THEN interval '7 days'
            WHEN 'biweekly' THEN interval '14 days'
            WHEN 'monthly' THEN interval '1 month'
            WHEN 'quarterly' THEN interval '3 months'
            WHEN 'yearly' THEN interval '1 year'
            ELSE interval '1 month'
        END;

        -- Comisiones
        SELECT COALESCE(vp.commission_rate, 0.10) INTO v_commission_rate
        FROM vendor_profiles vp WHERE vp.id = v_sub.vendor_profile_id;

        v_platform_fee := ROUND(v_plan.price * v_commission_rate, 2);
        v_gateway_fee := ROUND(v_plan.price * COALESCE(
            (SELECT (value->>'epayco')::numeric FROM platform_config WHERE key = 'gateway_fee_rate'),
            0.029
        ), 2);
        v_net_amount := v_plan.price - v_platform_fee - v_gateway_fee;

        -- Crear transaccion de renovacion
        INSERT INTO marketplace_transactions (
            checkout_type, user_id, vendor_profile_id, subscription_id,
            gross_amount, platform_fee, gateway_fee, net_amount,
            status, description
        ) VALUES (
            'subscription', v_sub.user_id, v_sub.vendor_profile_id, v_sub.id,
            v_plan.price, v_platform_fee, v_gateway_fee, v_net_amount,
            'pending',
            format('Renovación %s — %s', v_plan.name, v_plan.billing_period)
        );

        -- Actualizar periodo de la suscripcion
        UPDATE subscriptions
        SET current_period_start = current_period_end,
            current_period_end = v_new_period_end,
            next_payment_at = v_new_period_end,
            sessions_remaining = v_plan.sessions_included -- resetear sesiones
        WHERE id = v_sub.id;

        -- Notificar al usuario
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_sub.user_id,
            'Renovación de suscripción',
            format('Tu suscripción "%s" se ha renovado. Monto: $%s COP', v_plan.name, v_plan.price),
            'info',
            '/mis-suscripciones'
        );

        v_processed := v_processed + 1;
    END LOOP;

    -- Pausar suscripciones con pagos fallidos fuera del grace period
    UPDATE subscriptions
    SET status = 'past_due'
    WHERE status = 'active'
      AND next_payment_at < now() - (v_grace_days || ' days')::interval
      AND payment_failures > 0;

    RETURN v_processed;
END;
$$;


-- ============================================================
-- 18. EXTEND release_escrow para servicios y eventos
-- Los servicios se liberan 1 dia despues de la cita.
-- Los eventos se liberan 1 dia despues del evento.
-- ============================================================

CREATE OR REPLACE FUNCTION public.release_marketplace_escrow()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tx RECORD;
    v_released integer := 0;
    v_should_release boolean;
BEGIN
    FOR v_tx IN
        SELECT mt.*, s.id AS settlement_id
        FROM marketplace_transactions mt
        JOIN settlements s ON s.vendor_profile_id = mt.vendor_profile_id
            AND s.status = 'pending'
            AND s.gross_amount = mt.gross_amount
        WHERE mt.status = 'paid'
          AND mt.vendor_profile_id IS NOT NULL
          AND mt.checkout_type IN ('service', 'event', 'subscription')
    LOOP
        v_should_release := false;

        CASE v_tx.checkout_type
            WHEN 'service' THEN
                -- Liberar 1 dia despues de la cita completada
                SELECT (wa.appointment_date + interval '1 day') <= now()::date
                INTO v_should_release
                FROM wellness_appointments wa
                WHERE wa.id = v_tx.appointment_id
                  AND wa.status IN ('completed', 'confirmed');

            WHEN 'event' THEN
                -- Liberar 1 dia despues del evento
                SELECT (e.event_date + interval '1 day') <= now()::date
                INTO v_should_release
                FROM event_registrations er
                JOIN events e ON e.id = er.event_id
                WHERE er.id = v_tx.event_registration_id;

            WHEN 'subscription' THEN
                -- Liberar inmediatamente (ya es ingreso recurrente)
                v_should_release := true;

            ELSE
                v_should_release := false;
        END CASE;

        IF COALESCE(v_should_release, false) THEN
            UPDATE settlements SET status = 'paid', paid_at = now()
            WHERE id = v_tx.settlement_id;

            UPDATE vendor_balances
            SET pending_balance = GREATEST(pending_balance - v_tx.net_amount, 0),
                available_balance = available_balance + v_tx.net_amount
            WHERE vendor_profile_id = v_tx.vendor_profile_id;

            v_released := v_released + 1;
        END IF;
    END LOOP;

    RETURN v_released;
END;
$$;


-- ============================================================
-- 19. COMENTARIOS DE DOCUMENTACION
-- ============================================================

COMMENT ON TABLE public.marketplace_transactions IS 'Ledger unificado de todas las transacciones del marketplace: productos, servicios, eventos y suscripciones.';
COMMENT ON TABLE public.subscription_plans IS 'Planes de suscripcion ofrecidos por vendedores: mensualidades de escuelas, paquetes de sesiones, pases de temporada.';
COMMENT ON TABLE public.subscriptions IS 'Suscripciones activas de usuarios a planes. Maneja periodos, trials, sesiones restantes y renovaciones.';
COMMENT ON TABLE public.refunds IS 'Solicitudes de reembolso con politica escalonada: >48h=100%, 24-48h=50%, <24h=0%.';

COMMENT ON FUNCTION public.create_service_checkout IS 'Crea checkout para cita de servicio. Soporta cortesias ($0) con limites mensuales. Retorna transaction_id para ePayco.';
COMMENT ON FUNCTION public.create_event_checkout IS 'Crea checkout para inscripcion individual a evento. Valida cupo y precio. Eventos gratis se aprueban automaticamente.';
COMMENT ON FUNCTION public.create_subscription IS 'Crea suscripcion a un plan. Soporta trials y limites de suscriptores. Retorna transaction_id para primer cobro.';
COMMENT ON FUNCTION public.confirm_marketplace_payment IS 'Webhook handler unificado. Confirma pago, crea settlement, actualiza entidad y notifica vendor. Funciona para todos los checkout_type.';
COMMENT ON FUNCTION public.request_refund IS 'Solicitud de reembolso con politica escalonada automatica basada en horas hasta el servicio/evento.';
COMMENT ON FUNCTION public.process_refund IS 'Procesa reembolso aprobado: revierte settlement, ajusta balances, cancela cita/registro, notifica.';
COMMENT ON FUNCTION public.get_vendor_financial_summary IS 'Dashboard financiero del vendedor: balance, ventas mensuales por tipo, transacciones recientes, payouts.';
COMMENT ON FUNCTION public.process_subscription_renewals IS 'Cron diario: renueva suscripciones, crea transacciones de cobro, pausa morosos fuera del grace period.';
COMMENT ON FUNCTION public.release_marketplace_escrow IS 'Cron diario: libera escrow de servicios (1 dia post-cita), eventos (1 dia post-evento), suscripciones (inmediato).';
