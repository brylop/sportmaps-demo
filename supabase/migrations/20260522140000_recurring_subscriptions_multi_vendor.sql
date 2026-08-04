-- ============================================================
-- SPORTMAPS — Recurring subscriptions multi-vendor (Tanda 3)
--
-- Hasta hoy el motor de cobro recurrente (recurring_subscriptions) solo
-- aceptaba pagos padre -> escuela. La RPC create_recurring_subscription
-- exigia school_id NOT NULL y validaba contra children.monthly_fee o
-- programs.price_monthly. Esto deja afuera a:
--   - Coach independiente vendiendo paquete mensual de sesiones
--   - Wellness pro (fisio, nutri) con plan recurrente
--   - Personal trainer con membresia mensual
--   - Organizador con membresia anual de club
--
-- Esta migracion generaliza el motor para aceptar tambien subs a un
-- vendor_profile (con subscription_plans.price como precio canonico) sin
-- romper el flujo padre->escuela existente. El runner del BFF se actualiza
-- en codigo aparte (recurring-charges.service.ts) para diferenciar:
--   - school mode: cobro va a school_payment_providers + payments
--   - vendor mode: cobro va a vendor_payment_providers + marketplace_transactions
--
-- Decisiones de diseno acordadas con el negocio (2026-05-22):
--   1. Primer cobro inmediato (next_charge_at = now()). El BFF dispara el
--      cobro sincronamente despues de crear la sub. Los siguientes cobros
--      se calculan segun subscription_plans.billing_period.
--   2. Registro contable en marketplace_transactions con
--      checkout_type='subscription'. Reusa el pipeline de vendor_payouts.
--   3. XOR estricto: una sub es de escuela O de vendor, nunca ambos.
--
-- Migracion idempotente (CREATE IF NOT EXISTS / CREATE OR REPLACE). RLS
-- heredada — solo agregamos una policy nueva para staff del vendor.
-- Politica de la casa: search_path = pg_catalog, public, pg_temp en TODA
-- funcion nueva.
-- ============================================================


-- ============================================================
-- 1. ALTER recurring_subscriptions — nuevas columnas y constraint XOR
-- ============================================================

ALTER TABLE public.recurring_subscriptions
    ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE public.recurring_subscriptions
    ADD COLUMN IF NOT EXISTS vendor_profile_id     uuid REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS subscription_plan_id  uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS billing_period        text NOT NULL DEFAULT 'monthly';

-- Constraint del periodo (matchea subscription_plans.billing_period). Lo
-- agregamos en bloque DO porque ADD CONSTRAINT IF NOT EXISTS no existe
-- en Postgres y queremos idempotencia.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'recurring_subscriptions_billing_period_check'
    ) THEN
        ALTER TABLE public.recurring_subscriptions
            ADD CONSTRAINT recurring_subscriptions_billing_period_check
            CHECK (billing_period IN ('weekly','biweekly','monthly','quarterly','yearly'));
    END IF;
END $$;

-- XOR: exactamente uno de school_id o vendor_profile_id no nulo. Sin esto
-- una sub podria quedar huerfana o, peor, apuntar a ambos y duplicar la
-- atribucion contable.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'recurring_subscriptions_actor_xor'
    ) THEN
        ALTER TABLE public.recurring_subscriptions
            ADD CONSTRAINT recurring_subscriptions_actor_xor
            CHECK (
                (school_id IS NOT NULL AND vendor_profile_id IS NULL)
             OR (school_id IS NULL     AND vendor_profile_id IS NOT NULL)
            );
    END IF;
END $$;

-- Indices: el unique existente (school, child) sigue valido para school mode.
-- Para vendor mode, una unica sub no-cancelada por (vendor, user, plan).
CREATE UNIQUE INDEX IF NOT EXISTS uq_rec_subs_active_per_vendor_user_plan
    ON public.recurring_subscriptions(vendor_profile_id, user_id, subscription_plan_id)
    WHERE status IN ('active','paused','suspended')
      AND vendor_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rec_subs_vendor
    ON public.recurring_subscriptions(vendor_profile_id)
    WHERE vendor_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rec_subs_plan
    ON public.recurring_subscriptions(subscription_plan_id)
    WHERE subscription_plan_id IS NOT NULL;


-- ============================================================
-- 2. RLS — el dueno del vendor_profile lee sus suscriptores
-- ============================================================
--
-- Padre/atleta: rec_subs_owner (existente) aplica igual — user_id = auth.uid().
-- Staff escuela: rec_subs_school_staff_select (existente) sigue para sus subs.
-- NUEVO: dueno del vendor_profile (coach, wellness, organizer, store_owner)
--        ve las subs donde figura como vendor.
--
-- No le damos UPDATE/DELETE — el vendor no puede cancelar la sub del
-- cliente unilateralmente (eso es disputa, abre soporte). Solo lectura.

DROP POLICY IF EXISTS "rec_subs_vendor_owner_select" ON public.recurring_subscriptions;
CREATE POLICY "rec_subs_vendor_owner_select" ON public.recurring_subscriptions
    FOR SELECT TO authenticated
    USING (
        vendor_profile_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
             WHERE vp.id = recurring_subscriptions.vendor_profile_id
               AND vp.user_id = auth.uid()
        )
    );


-- ============================================================
-- 3. create_recurring_subscription — soporta school O vendor
--
-- Misma firma anterior (school_id, child_id, ...) + 3 parametros nuevos
-- opcionales al final: vendor_profile_id, subscription_plan_id, billing_period.
-- El caller envia UNO de los dos modos:
--
--   SCHOOL mode (legacy):  p_school_id IS NOT NULL
--      - Valida contra children.monthly_fee o programs.price_monthly
--      - next_charge_at = primer dia billing_day del MES SIGUIENTE
--        (el padre tiene "mes gratis" desde la suscripcion — comportamiento
--        existente, no cambia)
--      - billing_period implicito = 'monthly'
--
--   VENDOR mode (nuevo):   p_vendor_profile_id IS NOT NULL
--      - Requiere p_subscription_plan_id (sin plan no hay precio canonico)
--      - Valida contra subscription_plans.price (±10%)
--      - Verifica plan pertenece al vendor_profile y esta is_active
--      - next_charge_at = now() (primer cobro inmediato — el BFF lo dispara
--        sincronamente despues del INSERT via runDueRecurringCharges).
--        Los siguientes cobros usan billing_period del plan.
--
-- Guard Wompi: sigue exigiendo provider_payment_source_id para tokens Wompi.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_recurring_subscription(
    p_school_id            uuid,
    p_child_id             uuid,
    p_payment_token_id     uuid,
    p_amount               numeric,
    p_billing_day          smallint DEFAULT 1,
    p_concept              text     DEFAULT 'Mensualidad',
    p_program_id           uuid     DEFAULT NULL,
    p_team_id              uuid     DEFAULT NULL,
    -- Nuevos params para vendor mode (todos NULL = school mode)
    p_vendor_profile_id    uuid     DEFAULT NULL,
    p_subscription_plan_id uuid     DEFAULT NULL,
    p_billing_period       text     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id                  uuid := auth.uid();
    v_token_owner              uuid;
    v_token_provider           public.payment_provider;
    v_token_payment_source_id  bigint;
    v_canonical_price          numeric;
    v_max_allowed              numeric;
    v_plan                     RECORD;
    v_sub_id                   uuid;
    v_next                     timestamptz;
    v_effective_period         text;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    -- Modo: exactamente uno
    IF (p_school_id IS NULL) = (p_vendor_profile_id IS NULL) THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'invalid_actor',
            'message', 'Debes enviar school_id O vendor_profile_id, no ambos ni ninguno.'
        );
    END IF;

    -- Token: pertenece al user, esta activo
    SELECT user_id, payment_provider, provider_payment_source_id
      INTO v_token_owner, v_token_provider, v_token_payment_source_id
      FROM public.payment_tokens
     WHERE id = p_payment_token_id AND is_active = true;

    IF v_token_owner IS NULL OR v_token_owner <> v_user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'token_not_owned');
    END IF;

    -- Guard Wompi: tokens Wompi sin payment_source no sirven para recurrente
    IF v_token_provider = 'wompi' AND v_token_payment_source_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'wompi_payment_source_missing',
            'message', 'Esta tarjeta Wompi no esta lista para cobros automaticos. Por favor agrega la tarjeta de nuevo desde el modal de pago.'
        );
    END IF;

    -- ─── VENDOR MODE ────────────────────────────────────────────────
    IF p_vendor_profile_id IS NOT NULL THEN
        IF p_subscription_plan_id IS NULL THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'subscription_plan_required',
                'message', 'Para suscribirse a un vendor necesitas un subscription_plan_id.'
            );
        END IF;

        -- Plan existe, pertenece al vendor, esta activo
        SELECT id, price, billing_period, is_active, vendor_profile_id, plan_type
          INTO v_plan
          FROM public.subscription_plans
         WHERE id = p_subscription_plan_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'error', 'plan_not_found');
        END IF;

        IF v_plan.vendor_profile_id <> p_vendor_profile_id THEN
            RETURN jsonb_build_object('ok', false, 'error', 'plan_does_not_belong_to_vendor');
        END IF;

        IF NOT v_plan.is_active THEN
            RETURN jsonb_build_object('ok', false, 'error', 'plan_inactive');
        END IF;

        -- Precio canonico: el del plan, tolerancia 10% recargo online + IVA
        v_canonical_price := v_plan.price;
        v_max_allowed := v_canonical_price * 1.10;

        IF p_amount > v_max_allowed THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'amount_above_canonical',
                'message', format('El monto %s excede el precio del plan %s (+10%% tolerancia).', p_amount, v_canonical_price),
                'canonical_price', v_canonical_price,
                'max_allowed', v_max_allowed
            );
        END IF;
        IF p_amount < v_canonical_price * 0.90 THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'amount_below_canonical',
                'message', format('El monto %s esta muy por debajo del precio del plan %s (-10%% tolerancia). Posible error de unidades.', p_amount, v_canonical_price),
                'canonical_price', v_canonical_price
            );
        END IF;

        -- Primer cobro inmediato: el BFF dispara runDueRecurringCharges
        -- sincronamente despues del INSERT y el cron registra el resultado.
        v_next := now();
        v_effective_period := COALESCE(p_billing_period, v_plan.billing_period, 'monthly');

        INSERT INTO public.recurring_subscriptions (
            user_id, vendor_profile_id, subscription_plan_id,
            payment_token_id, amount, concept,
            billing_day, billing_period, next_charge_at
        ) VALUES (
            v_user_id, p_vendor_profile_id, p_subscription_plan_id,
            p_payment_token_id, p_amount,
            COALESCE(p_concept, 'Suscripcion'),
            -- billing_day legacy: lo usamos como dia-del-mes solo en monthly.
            -- Para weekly/biweekly/quarterly/yearly se ignora.
            COALESCE(p_billing_day, EXTRACT(DAY FROM now())::smallint),
            v_effective_period,
            v_next
        )
        RETURNING id INTO v_sub_id;

        RETURN jsonb_build_object(
            'ok', true,
            'subscription_id', v_sub_id,
            'mode', 'vendor',
            'billing_period', v_effective_period,
            'next_charge_at', v_next,
            'immediate_charge_due', true
        );
    END IF;

    -- ─── SCHOOL MODE (legacy) ───────────────────────────────────────
    -- Comportamiento heredado: mes "gratis" hasta el dia billing_day del
    -- mes siguiente. NO se modifica para no romper expectativas del padre.

    IF p_child_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.id = p_child_id AND c.parent_id = v_user_id
        ) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'child_not_owned');
        END IF;
    END IF;

    -- Precio canonico: program.price_monthly > children.monthly_fee
    IF p_program_id IS NOT NULL THEN
        SELECT NULLIF(price_monthly, 0) INTO v_canonical_price
          FROM public.programs
         WHERE id = p_program_id AND school_id = p_school_id;
    END IF;

    IF v_canonical_price IS NULL AND p_child_id IS NOT NULL THEN
        SELECT NULLIF(monthly_fee, 0) INTO v_canonical_price
          FROM public.children
         WHERE id = p_child_id;
    END IF;

    IF v_canonical_price IS NOT NULL THEN
        v_max_allowed := v_canonical_price * 1.10;
        IF p_amount > v_max_allowed THEN
            RETURN jsonb_build_object(
                'ok', false, 'error', 'amount_above_canonical',
                'message', format('El monto %s excede el precio configurado %s (+10%% tolerancia).', p_amount, v_canonical_price),
                'canonical_price', v_canonical_price, 'max_allowed', v_max_allowed
            );
        END IF;
        IF p_amount < v_canonical_price * 0.90 THEN
            RETURN jsonb_build_object(
                'ok', false, 'error', 'amount_below_canonical',
                'message', format('El monto %s esta muy por debajo del precio configurado %s (-10%% tolerancia). Posible error de unidades.', p_amount, v_canonical_price),
                'canonical_price', v_canonical_price
            );
        END IF;
    END IF;

    v_next := date_trunc('month', now()) + interval '1 month'
            + ((p_billing_day - 1) || ' days')::interval;

    INSERT INTO public.recurring_subscriptions (
        school_id, user_id, child_id, program_id, team_id,
        payment_token_id, amount, concept, billing_day, billing_period, next_charge_at
    ) VALUES (
        p_school_id, v_user_id, p_child_id, p_program_id, p_team_id,
        p_payment_token_id, p_amount,
        COALESCE(p_concept, 'Mensualidad'),
        COALESCE(p_billing_day, 1),
        'monthly',
        v_next
    )
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object(
        'ok', true,
        'subscription_id', v_sub_id,
        'mode', 'school',
        'billing_period', 'monthly',
        'next_charge_at', v_next,
        'immediate_charge_due', false
    );
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_subscribed');
END;
$$;

-- GRANT a la firma extendida. Postgres considera la firma con DEFAULTs como
-- una sola; basta REVOKE/GRANT sobre los 11 parametros (incluye los nuevos).
REVOKE ALL ON FUNCTION public.create_recurring_subscription(
    uuid, uuid, uuid, numeric, smallint, text, uuid, uuid, uuid, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_recurring_subscription(
    uuid, uuid, uuid, numeric, smallint, text, uuid, uuid, uuid, uuid, text
) TO authenticated;


-- ============================================================
-- 4. claim_due_recurring_subscriptions — agrega vendor_profile_id y plan
--
-- DROP + CREATE porque cambia el RETURN TABLE.
-- ============================================================

DROP FUNCTION IF EXISTS public.claim_due_recurring_subscriptions(integer);

CREATE OR REPLACE FUNCTION public.claim_due_recurring_subscriptions(p_limit integer DEFAULT 50)
RETURNS TABLE (
    subscription_id            uuid,
    school_id                  uuid,
    vendor_profile_id          uuid,
    subscription_plan_id       uuid,
    user_id                    uuid,
    child_id                   uuid,
    amount                     numeric,
    currency                   text,
    concept                    text,
    billing_period             text,
    payment_token_id           uuid,
    payment_provider           public.payment_provider,
    provider_token             text,
    provider_customer_id       text,
    provider_card_id           text,
    provider_payment_source_id bigint,
    user_email                 text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH due AS (
        SELECT s.id
          FROM public.recurring_subscriptions s
          JOIN public.payment_tokens t ON t.id = s.payment_token_id
         WHERE s.status = 'active'
           AND s.next_charge_at <= now()
           AND t.is_active = true
           AND (t.expires_at IS NULL OR t.expires_at >= CURRENT_DATE)
         ORDER BY s.next_charge_at
         FOR UPDATE SKIP LOCKED
         LIMIT GREATEST(p_limit, 1)
    )
    SELECT
        s.id,
        s.school_id,
        s.vendor_profile_id,
        s.subscription_plan_id,
        s.user_id,
        s.child_id,
        s.amount,
        s.currency,
        s.concept,
        s.billing_period,
        s.payment_token_id,
        t.payment_provider,
        t.provider_token,
        t.provider_customer_id,
        t.provider_card_id,
        t.provider_payment_source_id,
        u.email
      FROM due
      JOIN public.recurring_subscriptions s ON s.id = due.id
      JOIN public.payment_tokens t          ON t.id = s.payment_token_id
      JOIN auth.users u                     ON u.id = s.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_recurring_subscriptions(integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_due_recurring_subscriptions(integer) TO service_role;


-- ============================================================
-- 5. claim_single_due_recurring_subscription — para cobro inmediato
--
-- Variante de claim_due restringida a una sub especifica. La usa el BFF
-- justo despues de create_recurring_subscription en vendor mode para
-- ejecutar el primer cobro sincronamente. FOR UPDATE SKIP LOCKED evita
-- que el cron paralelamente la tome y haya doble cobro.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_single_due_recurring_subscription(p_sub_id uuid)
RETURNS TABLE (
    subscription_id            uuid,
    school_id                  uuid,
    vendor_profile_id          uuid,
    subscription_plan_id       uuid,
    user_id                    uuid,
    child_id                   uuid,
    amount                     numeric,
    currency                   text,
    concept                    text,
    billing_period             text,
    payment_token_id           uuid,
    payment_provider           public.payment_provider,
    provider_token             text,
    provider_customer_id       text,
    provider_card_id           text,
    provider_payment_source_id bigint,
    user_email                 text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH due AS (
        SELECT s.id
          FROM public.recurring_subscriptions s
          JOIN public.payment_tokens t ON t.id = s.payment_token_id
         WHERE s.id = p_sub_id
           AND s.status = 'active'
           AND s.next_charge_at <= now()
           AND t.is_active = true
           AND (t.expires_at IS NULL OR t.expires_at >= CURRENT_DATE)
         FOR UPDATE SKIP LOCKED
    )
    SELECT
        s.id,
        s.school_id,
        s.vendor_profile_id,
        s.subscription_plan_id,
        s.user_id,
        s.child_id,
        s.amount,
        s.currency,
        s.concept,
        s.billing_period,
        s.payment_token_id,
        t.payment_provider,
        t.provider_token,
        t.provider_customer_id,
        t.provider_card_id,
        t.provider_payment_source_id,
        u.email
      FROM due
      JOIN public.recurring_subscriptions s ON s.id = due.id
      JOIN public.payment_tokens t          ON t.id = s.payment_token_id
      JOIN auth.users u                     ON u.id = s.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_single_due_recurring_subscription(uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_single_due_recurring_subscription(uuid) TO service_role;


-- ============================================================
-- 6. record_recurring_attempt — calcula next_charge_at segun billing_period
--
-- La version anterior asumia mensual (date_trunc month + 1 month). Ahora
-- avanza segun billing_period de la sub. CREATE OR REPLACE — misma firma.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_recurring_attempt(
    p_subscription_id     uuid,
    p_status              text,
    p_amount              numeric,
    p_payment_provider    public.payment_provider,
    p_provider_payment_id text  DEFAULT NULL,
    p_error_code          text  DEFAULT NULL,
    p_error_message       text  DEFAULT NULL,
    p_idempotency_key     text  DEFAULT NULL,
    p_raw_response        jsonb DEFAULT NULL,
    p_payment_id          uuid  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_sub        RECORD;
    v_new_next   timestamptz;
    v_new_status text;
    v_new_failed integer;
    v_step       interval;
BEGIN
    SELECT * INTO v_sub FROM public.recurring_subscriptions WHERE id = p_subscription_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'subscription_not_found');
    END IF;

    INSERT INTO public.recurring_charge_attempts (
        subscription_id, amount, currency, payment_provider, status,
        provider_payment_id, error_code, error_message,
        idempotency_key, raw_response, payment_id
    ) VALUES (
        p_subscription_id, p_amount, v_sub.currency, p_payment_provider,
        CASE WHEN p_status = 'success' THEN 'success' ELSE 'failed' END,
        p_provider_payment_id, p_error_code, p_error_message,
        p_idempotency_key, p_raw_response, p_payment_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    IF p_status = 'success' THEN
        -- Avanzar segun billing_period
        v_step := CASE COALESCE(v_sub.billing_period, 'monthly')
            WHEN 'weekly'    THEN interval '7 days'
            WHEN 'biweekly'  THEN interval '14 days'
            WHEN 'monthly'   THEN interval '1 month'
            WHEN 'quarterly' THEN interval '3 months'
            WHEN 'yearly'    THEN interval '1 year'
            ELSE interval '1 month'
        END;

        -- Para monthly conservamos el anclaje al billing_day (mes calendario)
        -- como hacia la version previa — relevante para escuelas que cobran
        -- el dia 1 todos los meses sin importar cuando se aprobo.
        IF COALESCE(v_sub.billing_period, 'monthly') = 'monthly' AND v_sub.school_id IS NOT NULL THEN
            v_new_next := (
                date_trunc('month', v_sub.next_charge_at) + interval '1 month'
                + ((v_sub.billing_day - 1) || ' days')::interval
            );
        ELSE
            v_new_next := v_sub.next_charge_at + v_step;
            -- Si v_sub.next_charge_at quedo en el pasado (cobro inmediato +
            -- corrida demorada), partir de now() para no acumular atrasos.
            IF v_new_next < now() THEN
                v_new_next := now() + v_step;
            END IF;
        END IF;

        UPDATE public.recurring_subscriptions
           SET next_charge_at  = v_new_next,
               last_charge_at  = now(),
               last_payment_id = p_payment_id,
               failed_attempts = 0,
               updated_at      = now()
         WHERE id = p_subscription_id;
    ELSE
        v_new_failed := v_sub.failed_attempts + 1;
        IF v_new_failed >= v_sub.max_attempts THEN
            v_new_status := 'suspended';
            v_new_next   := v_sub.next_charge_at;
        ELSE
            v_new_status := 'active';
            v_new_next   := now() + (v_sub.retry_backoff_hours || ' hours')::interval;
        END IF;
        UPDATE public.recurring_subscriptions
           SET status          = v_new_status,
               next_charge_at  = v_new_next,
               failed_attempts = v_new_failed,
               updated_at      = now()
         WHERE id = p_subscription_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'next_charge_at', v_new_next, 'status', COALESCE(v_new_status, v_sub.status));
END;
$$;

-- Misma firma — GRANTs anteriores siguen vigentes.


-- ============================================================
-- 7. Comentarios
-- ============================================================

COMMENT ON COLUMN public.recurring_subscriptions.vendor_profile_id IS
    'Receptor del cobro cuando la sub es a un vendor del marketplace (coach, wellness, organizer, store). XOR con school_id.';
COMMENT ON COLUMN public.recurring_subscriptions.subscription_plan_id IS
    'Plan que define precio y periodicidad cuando la sub es a un vendor. NULL para subs padre->escuela.';
COMMENT ON COLUMN public.recurring_subscriptions.billing_period IS
    'Periodicidad del cobro: weekly/biweekly/monthly/quarterly/yearly. School mode = monthly siempre.';
COMMENT ON CONSTRAINT recurring_subscriptions_actor_xor ON public.recurring_subscriptions IS
    'Una sub es de escuela o de vendor, nunca ambos. Previene atribucion contable duplicada.';
