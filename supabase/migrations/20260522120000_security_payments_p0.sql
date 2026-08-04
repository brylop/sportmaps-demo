-- ============================================================
-- SPORTMAPS — Seguridad de pagos P0 (Tanda 1)
--
-- Cierra tres huecos identificados en la auditoria de seguridad de pagos
-- (ver respuesta del agente, 2026-05-22):
--
--   C1. DELETE token cancela recurring_subscriptions (lado BFF en otro PR).
--   C5. create_recurring_subscription valida que p_amount coincida con el
--       precio canonico de children.monthly_fee o programs.price_monthly,
--       con tolerancia del 10% (recargo online + IVA). Evita que un admin
--       de escuela o un frontend manipulado meta un amount arbitrario.
--   B5. Tabla payment_consents — prueba durable de que el titular acepto
--       los contratos de Habeas Data + politica de pagos (Ley 1581/2012,
--       Decreto 1377/2013). Sin esto, no podemos defendernos ante SIC si
--       el padre dice "yo nunca firme nada".
--
-- Migracion idempotente (CREATE IF NOT EXISTS / CREATE OR REPLACE).
-- Politica de la casa: search_path = pg_catalog, public, pg_temp en TODA
-- funcion nueva. RLS habilitada por defecto en tablas nuevas.
-- ============================================================


-- ============================================================
-- 1. Tabla payment_consents — prueba legal de aceptacion
-- ============================================================
--
-- Cada vez que un titular acepta Habeas Data + politica para guardar una
-- tarjeta (Wompi POST /payment_sources o MP equivalente), guardamos:
--   - los dos JWT que mandamos al provider
--   - los permalinks PDF que vio el usuario (Wompi los rota; importante
--     guardar la URL especifica que el padre vio en ese momento)
--   - timestamp + IP + user_agent al momento de aceptar
--   - vinculo al payment_token resultante (si la creacion fue exitosa)
--
-- No se borra nunca. Soft-deletes en payment_tokens NO cascadan aqui.

CREATE TABLE IF NOT EXISTS public.payment_consents (
    id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

    -- Provider donde se acepto
    payment_provider         public.payment_provider NOT NULL,

    -- Tokens enviados al provider (Wompi: presigned_acceptance / presigned_personal_data_auth)
    acceptance_token         text        NOT NULL,
    personal_data_auth_token text        NOT NULL,

    -- URLs PDF de los contratos que vio el usuario en ese momento
    acceptance_permalink     text,
    personal_data_permalink  text,

    -- Trazabilidad del consentimiento
    accepted_at              timestamptz NOT NULL DEFAULT now(),
    ip_address               inet,
    user_agent               text,

    -- Resultado: si la tokenizacion se completo, vinculamos
    payment_token_id         uuid        REFERENCES public.payment_tokens(id) ON DELETE SET NULL,

    -- Metadata libre (e.g., merchant_id, ambiente, response del provider sin PII)
    metadata                 jsonb       NOT NULL DEFAULT '{}'::jsonb,

    created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_consents_user   ON public.payment_consents(user_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_consents_token  ON public.payment_consents(payment_token_id) WHERE payment_token_id IS NOT NULL;

ALTER TABLE public.payment_consents ENABLE ROW LEVEL SECURITY;

-- El titular puede LEER sus propios consentimientos (derecho de acceso, Ley 1581).
-- NO puede modificarlos ni borrarlos (prueba durable inalterable).
DROP POLICY IF EXISTS "payment_consents_owner_select" ON public.payment_consents;
CREATE POLICY "payment_consents_owner_select" ON public.payment_consents
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- service_role bypassea RLS — INSERT lo hace el BFF al momento de tokenizar.
-- Ninguna policy de INSERT/UPDATE/DELETE para authenticated: solo el BFF
-- via service_role puede crear consents, y no se modifican.

COMMENT ON TABLE public.payment_consents IS
    'Prueba durable de aceptacion de Habeas Data + politica de pagos (Ley 1581/2012). Inalterable; service_role-only para insertar.';


-- ============================================================
-- 2. create_recurring_subscription — validacion de monto canonico
-- ============================================================
--
-- Mantiene el guard del provider (solo MP por ahora hasta Tanda 2 Wompi)
-- y agrega: si la sub apunta a un child o program con precio configurado,
-- el amount tiene que estar dentro del 10% del precio canonico.
--
-- Tolerancia 10% cubre: recargo online (~5%), IVA si aplica, redondeos.
-- Si el precio canonico es 0 o NULL, no validamos (cobro libre/no config).
--
-- IMPORTANTE: misma firma que la version anterior — los GRANTs siguen vigentes.

CREATE OR REPLACE FUNCTION public.create_recurring_subscription(
    p_school_id        uuid,
    p_child_id         uuid,
    p_payment_token_id uuid,
    p_amount           numeric,
    p_billing_day      smallint DEFAULT 1,
    p_concept          text     DEFAULT 'Mensualidad',
    p_program_id       uuid     DEFAULT NULL,
    p_team_id          uuid     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id          uuid := auth.uid();
    v_token_owner      uuid;
    v_token_provider   public.payment_provider;
    v_canonical_price  numeric;
    v_max_allowed      numeric;
    v_sub_id           uuid;
    v_next             timestamptz;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    -- El token tiene que pertenecer al mismo user que crea la sub.
    SELECT user_id, payment_provider INTO v_token_owner, v_token_provider
      FROM public.payment_tokens
     WHERE id = p_payment_token_id
       AND is_active = true;

    IF v_token_owner IS NULL OR v_token_owner <> v_user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'token_not_owned');
    END IF;

    -- Guard provider: Wompi autopay aun no soportado (ver
    -- project_recurring_charges_status memoria + Tanda 2 del roadmap).
    -- Cuando se destrabe (POST /v1/payment_sources implementado), reemplazar
    -- por: IF v_token_provider = 'wompi' AND <token>.provider_payment_source_id IS NULL
    IF v_token_provider <> 'mercadopago' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'autopay_provider_not_supported',
            'message', 'Por ahora el pago automatico solo esta disponible con MercadoPago.'
        );
    END IF;

    -- Child debe ser hijo del padre.
    IF p_child_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.id = p_child_id AND c.parent_id = v_user_id
        ) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'child_not_owned');
        END IF;
    END IF;

    -- ─── Validacion de monto canonico ───────────────────────────────
    -- Preferencia: program.price_monthly > child.monthly_fee
    -- Si ninguno aplica o es 0, NO validamos (cobro libre o no configurado).

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
        -- Tolerancia 10%: cubre recargo online + IVA + redondeos
        v_max_allowed := v_canonical_price * 1.10;

        IF p_amount > v_max_allowed THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'amount_above_canonical',
                'message', format(
                    'El monto %s excede el precio configurado %s (+10%% tolerancia).',
                    p_amount, v_canonical_price
                ),
                'canonical_price', v_canonical_price,
                'max_allowed', v_max_allowed
            );
        END IF;

        -- Tambien rechazamos amounts muy por debajo: si el plan dice 149000 y
        -- el front mando 100, es muy probable que sea un bug de unidades
        -- (cents vs pesos). Margen 10% inferior tambien.
        IF p_amount < v_canonical_price * 0.90 THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'amount_below_canonical',
                'message', format(
                    'El monto %s esta muy por debajo del precio configurado %s (-10%% tolerancia). Posible error de unidades.',
                    p_amount, v_canonical_price
                ),
                'canonical_price', v_canonical_price
            );
        END IF;
    END IF;
    -- ─── Fin validacion de monto ────────────────────────────────────

    -- Proximo cobro: el dia billing_day del MES SIGUIENTE.
    v_next := date_trunc('month', now()) + interval '1 month'
            + ((p_billing_day - 1) || ' days')::interval;

    INSERT INTO public.recurring_subscriptions (
        school_id, user_id, child_id, program_id, team_id,
        payment_token_id, amount, concept, billing_day, next_charge_at
    ) VALUES (
        p_school_id, v_user_id, p_child_id, p_program_id, p_team_id,
        p_payment_token_id, p_amount, COALESCE(p_concept, 'Mensualidad'),
        COALESCE(p_billing_day, 1), v_next
    )
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object('ok', true, 'subscription_id', v_sub_id, 'next_charge_at', v_next);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_subscribed');
END;
$$;

-- Los GRANTs anteriores siguen vigentes (misma firma).
