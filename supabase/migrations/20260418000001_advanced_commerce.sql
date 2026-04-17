-- ============================================================
-- SPORTMAPS MARKETPLACE — FASE 8: COMERCIO AVANZADO
-- Cupones, reviews verificadas, vendor metrics (KPIs),
-- disputas con hilo de conversacion, refund requests
-- ============================================================


-- ============================================================
-- 1. TABLA coupons (cupones y promociones)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coupons (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code                text        NOT NULL UNIQUE,
    description         text,
    discount_type       text        NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value      numeric     NOT NULL CHECK (discount_value > 0),
    vendor_profile_id   uuid        REFERENCES public.vendor_profiles(id),
    min_order_amount    numeric,
    max_uses            integer,
    current_uses        integer     NOT NULL DEFAULT 0,
    valid_from          timestamptz NOT NULL DEFAULT now(),
    valid_until         timestamptz NOT NULL,
    applies_to          text        NOT NULL DEFAULT 'all'
                                    CHECK (applies_to IN ('all', 'products', 'services')),
    is_active           boolean     NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_vendor ON public.coupons(vendor_profile_id) WHERE vendor_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active, valid_until);


-- ============================================================
-- 2. TABLA coupon_redemptions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id           uuid        NOT NULL REFERENCES public.coupons(id),
    order_id            uuid        NOT NULL REFERENCES public.orders(id),
    user_id             uuid        NOT NULL REFERENCES auth.users(id),
    discount_applied    numeric     NOT NULL CHECK (discount_applied >= 0),
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON public.coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON public.coupon_redemptions(user_id);


-- ============================================================
-- 3. TABLA marketplace_reviews (resenas verificadas)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id         uuid        NOT NULL REFERENCES auth.users(id),
    vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id),
    order_id            uuid        NOT NULL REFERENCES public.orders(id),
    order_item_id       uuid        REFERENCES public.order_items(id),
    rating              integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title               text,
    comment             text        NOT NULL,
    is_verified         boolean     NOT NULL DEFAULT true,
    vendor_response     text,
    vendor_responded_at timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON public.marketplace_reviews(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.marketplace_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON public.marketplace_reviews(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_per_order ON public.marketplace_reviews(reviewer_id, order_id)
    WHERE order_item_id IS NULL;


-- ============================================================
-- 4. TABLA vendor_metrics (KPIs calculados)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_metrics (
    vendor_profile_id       uuid        PRIMARY KEY REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    total_orders            integer     NOT NULL DEFAULT 0,
    total_completed         integer     NOT NULL DEFAULT 0,
    fulfillment_rate        numeric     NOT NULL DEFAULT 0,
    avg_rating              numeric     NOT NULL DEFAULT 0,
    total_reviews           integer     NOT NULL DEFAULT 0,
    avg_response_time_hours numeric,
    cancellation_rate       numeric     NOT NULL DEFAULT 0,
    updated_at              timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_vendor_metrics_updated_at ON public.vendor_metrics;
CREATE TRIGGER trg_vendor_metrics_updated_at
    BEFORE UPDATE ON public.vendor_metrics
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-crear metrics al crear vendor_profile
CREATE OR REPLACE FUNCTION public.auto_create_vendor_metrics()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.vendor_metrics (vendor_profile_id)
    VALUES (NEW.id) ON CONFLICT (vendor_profile_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_vendor_metrics ON public.vendor_profiles;
CREATE TRIGGER trg_auto_vendor_metrics
    AFTER INSERT ON public.vendor_profiles
    FOR EACH ROW EXECUTE FUNCTION public.auto_create_vendor_metrics();


-- ============================================================
-- 5. TABLA disputes (reclamos y disputas)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.disputes (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid        NOT NULL REFERENCES public.orders(id),
    order_item_id       uuid        REFERENCES public.order_items(id),
    opened_by           uuid        NOT NULL REFERENCES auth.users(id),
    vendor_profile_id   uuid        NOT NULL REFERENCES public.vendor_profiles(id),
    reason              text        NOT NULL
                                    CHECK (reason IN ('defective', 'not_received', 'not_as_described', 'service_not_provided', 'other')),
    description         text        NOT NULL,
    evidence_urls       jsonb       NOT NULL DEFAULT '[]',
    status              text        NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open', 'vendor_responded', 'escalated', 'resolved', 'closed')),
    resolution          text        CHECK (resolution IN ('refund_full', 'refund_partial', 'replacement', 'dismissed')),
    resolution_amount   numeric,
    admin_notes         text,
    resolved_by         uuid        REFERENCES auth.users(id),
    resolved_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_order ON public.disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_vendor ON public.disputes(vendor_profile_id);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_by ON public.disputes(opened_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);


-- ============================================================
-- 6. TABLA dispute_messages (hilo de conversacion)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dispute_messages (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id  uuid        NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    sender_id   uuid        NOT NULL REFERENCES auth.users(id),
    message     text        NOT NULL,
    attachments jsonb       NOT NULL DEFAULT '[]',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON public.dispute_messages(dispute_id);


-- ============================================================
-- 7. TABLA refund_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.refund_requests (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid        NOT NULL REFERENCES public.orders(id),
    order_item_id       uuid        REFERENCES public.order_items(id),
    requester_id        uuid        NOT NULL REFERENCES auth.users(id),
    dispute_id          uuid        REFERENCES public.disputes(id),
    reason              text        NOT NULL,
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
    refund_amount       numeric,
    resolution_notes    text,
    resolved_by         uuid        REFERENCES auth.users(id),
    resolved_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_order ON public.refund_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_requester ON public.refund_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status);


-- ============================================================
-- 8. RLS
-- ============================================================

-- coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_select_public"
    ON public.coupons FOR SELECT
    USING (is_active = true AND valid_until > now());

CREATE POLICY "coupons_owner_all"
    ON public.coupons FOR ALL TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
        )
    );

-- coupon_redemptions
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupon_redemptions_select_own"
    ON public.coupon_redemptions FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "coupon_redemptions_insert_own"
    ON public.coupon_redemptions FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- marketplace_reviews
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_public"
    ON public.marketplace_reviews FOR SELECT
    USING (true);

CREATE POLICY "reviews_insert_auth"
    ON public.marketplace_reviews FOR INSERT TO authenticated
    WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "reviews_update_vendor_response"
    ON public.marketplace_reviews FOR UPDATE TO authenticated
    USING (
        vendor_profile_id IN (
            SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
        )
    );

-- vendor_metrics
ALTER TABLE public.vendor_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_metrics_select_public"
    ON public.vendor_metrics FOR SELECT
    USING (true);

-- disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disputes_select_parties"
    ON public.disputes FOR SELECT TO authenticated
    USING (
        opened_by = auth.uid()
        OR vendor_profile_id IN (
            SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "disputes_insert_buyer"
    ON public.disputes FOR INSERT TO authenticated
    WITH CHECK (opened_by = auth.uid());

-- dispute_messages
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispute_msgs_select_parties"
    ON public.dispute_messages FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM disputes d
            WHERE d.id = dispute_messages.dispute_id
              AND (d.opened_by = auth.uid()
                   OR d.vendor_profile_id IN (
                       SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
                   ))
        )
    );

CREATE POLICY "dispute_msgs_insert_parties"
    ON public.dispute_messages FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid());

-- refund_requests
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_select_own"
    ON public.refund_requests FOR SELECT TO authenticated
    USING (requester_id = auth.uid());

CREATE POLICY "refunds_select_vendor"
    ON public.refund_requests FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = refund_requests.order_id
              AND p.vendor_id = auth.uid()
        )
    );

CREATE POLICY "refunds_insert_buyer"
    ON public.refund_requests FOR INSERT TO authenticated
    WITH CHECK (requester_id = auth.uid());


-- ============================================================
-- 9. TRIGGER: validate_review_eligibility
-- Solo permite resena si la orden esta completada
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_review_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_status text;
BEGIN
    SELECT status INTO v_order_status
    FROM orders WHERE id = NEW.order_id;

    IF v_order_status NOT IN ('completed', 'delivered') THEN
        RAISE EXCEPTION 'Solo puedes calificar despues de que la orden sea completada/entregada.'
            USING ERRCODE = '23514';
    END IF;

    -- Verificar que el reviewer es el comprador
    IF NOT EXISTS (
        SELECT 1 FROM orders WHERE id = NEW.order_id AND user_id = NEW.reviewer_id
    ) THEN
        RAISE EXCEPTION 'Solo el comprador puede calificar esta orden.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_review ON public.marketplace_reviews;
CREATE TRIGGER trg_validate_review
    BEFORE INSERT ON public.marketplace_reviews
    FOR EACH ROW EXECUTE FUNCTION public.validate_review_eligibility();


-- ============================================================
-- 10. TRIGGER: update_vendor_metrics
-- Recalcula KPIs del vendor despues de review o cambio de orden
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_vendor_metrics_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE vendor_metrics
    SET avg_rating = (
            SELECT COALESCE(AVG(rating), 0)
            FROM marketplace_reviews WHERE vendor_profile_id = NEW.vendor_profile_id
        ),
        total_reviews = (
            SELECT COUNT(*)
            FROM marketplace_reviews WHERE vendor_profile_id = NEW.vendor_profile_id
        )
    WHERE vendor_profile_id = NEW.vendor_profile_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_metrics_on_review ON public.marketplace_reviews;
CREATE TRIGGER trg_update_metrics_on_review
    AFTER INSERT OR UPDATE ON public.marketplace_reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_vendor_metrics_on_review();


-- ============================================================
-- 11. RPC: validate_coupon
-- Verifica validez de un cupon y retorna descuento aplicable
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_coupon(
    p_code text,
    p_order_amount numeric DEFAULT 0,
    p_item_type text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coupon RECORD;
    v_discount numeric;
BEGIN
    SELECT * INTO v_coupon
    FROM coupons
    WHERE code = UPPER(TRIM(p_code))
      AND is_active = true
      AND valid_from <= now()
      AND valid_until > now();

    IF v_coupon IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Cupon no valido o expirado');
    END IF;

    -- Verificar usos
    IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Este cupon ya alcanzo el maximo de usos');
    END IF;

    -- Verificar monto minimo
    IF v_coupon.min_order_amount IS NOT NULL AND p_order_amount < v_coupon.min_order_amount THEN
        RETURN jsonb_build_object('ok', false, 'error',
            format('Monto minimo de compra: $%s COP', v_coupon.min_order_amount));
    END IF;

    -- Verificar tipo de aplicacion
    IF v_coupon.applies_to != 'all' AND v_coupon.applies_to != p_item_type THEN
        RETURN jsonb_build_object('ok', false, 'error',
            format('Este cupon solo aplica para %s', v_coupon.applies_to));
    END IF;

    -- Calcular descuento
    IF v_coupon.discount_type = 'percentage' THEN
        v_discount := p_order_amount * (v_coupon.discount_value / 100);
    ELSE
        v_discount := LEAST(v_coupon.discount_value, p_order_amount);
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'coupon_id', v_coupon.id,
        'code', v_coupon.code,
        'discount_type', v_coupon.discount_type,
        'discount_value', v_coupon.discount_value,
        'discount_amount', v_discount,
        'description', v_coupon.description
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon TO authenticated;


-- ============================================================
-- 12. COMENTARIOS
-- ============================================================

COMMENT ON TABLE public.coupons IS 'Cupones globales (vendor_profile_id=null) o de vendedor especifico.';
COMMENT ON TABLE public.marketplace_reviews IS 'Resenas verificadas: solo post-orden completada, una por orden.';
COMMENT ON TABLE public.vendor_metrics IS 'KPIs calculados: rating promedio, tasa de cumplimiento, etc.';
COMMENT ON TABLE public.disputes IS 'Reclamos con flujo: open → vendor_responded → escalated → resolved.';
COMMENT ON TABLE public.refund_requests IS 'Solicitudes de devolucion vinculadas a disputa o directas.';
