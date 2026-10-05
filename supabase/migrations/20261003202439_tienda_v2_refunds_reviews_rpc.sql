-- =============================================================================
-- 20261003202439_tienda_v2_refunds_reviews_rpc.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202436
-- Objetivo: M-F0-6 de docs/specs/tienda-v2-f0-plan-migraciones.md.
--   T9: cualquier usuario insertaba un reembolso con monto y estado libres
--       (refunds_owner_insert TO public), y request_refund/approve_refund usan
--       auth.uid(), que con el BFF (service role) es NULL → nunca funcionaban.
--   T10: el vendedor reescribía rating/estado de las reseñas y el texto de las
--       preguntas (UPDATE sin WITH CHECK, todas las columnas).
--   T11/I3: shipments_vendor FOR ALL sin WITH CHECK.
--   R13/R14: el kardex (inventory_logs) se podía borrar.
--
--   1. refunds sin escritura del cliente. request_order_refund /
--      approve_order_refund (service_role, actor explícito). Las viejas
--      request_refund / approve_refund siguen intactas para payments y
--      marketplace_transactions; para órdenes devuelven USE_*_order_refund.
--   2. complete_refund idempotente (FOR UPDATE; completed → no repite nada) y
--      reembolso parcial → partially_refunded. Rama payment_id idéntica.
--   3. Reseñas/preguntas: sin UPDATE del vendedor por PostgREST; RPC
--      respond_review / answer_question (solo escriben la respuesta) y
--      create_review (exige compra entregada, que el service role se saltaba).
--      can_review_product recibe p_user_id para el BFF.
--   4. shipments_vendor por can_manage_store con WITH CHECK.
--   5. inventory_logs append-only: super admin solo lee.
--
--   NO va acá: reversar settlements al reembolsar. settlements.status es el
--   enum settlement_status sin 'reversed'; lo decide M-F0-5 (convertir a text).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

DO $pre$
BEGIN
    IF to_regclass('public.order_status_history') IS NULL THEN
        RAISE EXCEPTION 'Falta M-F0-3 (20261003202436): aplicarla antes.';
    END IF;
END
$pre$;

-- ─── 1. refunds: sin escritura directa ───────────────────────────────────────
DROP POLICY IF EXISTS refunds_owner_insert ON public.refunds;
REVOKE INSERT, UPDATE, DELETE ON public.refunds FROM anon, authenticated;

-- Reembolso de una orden de tienda. Lo pide el comprador (el BFF valida la
-- sesión y pasa p_actor). Solo service_role.
CREATE OR REPLACE FUNCTION public.request_order_refund(p_order_id uuid, p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_order     record;
    v_refund_id uuid;
BEGIN
    IF p_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
    END IF;
    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reason_too_short');
    END IF;

    SELECT id, user_id, total_amount, status INTO v_order
      FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'order_not_eligible');
    END IF;
    IF v_order.user_id IS DISTINCT FROM p_actor THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
    IF v_order.status NOT IN ('paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'order_not_eligible');
    END IF;
    IF EXISTS (SELECT 1 FROM public.refunds
                WHERE order_id = p_order_id AND status IN ('pending', 'approved', 'processing')) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'refund_already_open');
    END IF;

    INSERT INTO public.refunds (order_id, requested_by, reason, refund_amount, refund_pct, status)
    VALUES (p_order_id, p_actor, left(trim(p_reason), 1000), v_order.total_amount, 100, 'pending')
    RETURNING id INTO v_refund_id;

    RETURN jsonb_build_object('ok', true, 'refund_id', v_refund_id,
                              'refund_amount', v_order.total_amount, 'refund_pct', 100);
END;
$fn$;

COMMENT ON FUNCTION public.request_order_refund(uuid, text, uuid) IS
  'Tienda v2 M-F0-6: el comprador (p_actor, validado por el BFF) pide el reembolso total de su orden pagada. Solo service_role.';

-- Lo aprueba quien administra la tienda (o un admin de plataforma).
CREATE OR REPLACE FUNCTION public.approve_order_refund(p_refund_id uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_refund record;
    v_order  record;
BEGIN
    IF p_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
    END IF;

    SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
    IF v_refund.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    IF v_refund.order_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_an_order_refund');
    END IF;
    IF v_refund.status <> 'pending' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
    END IF;

    SELECT id, vendor_profile_id, vendor_id INTO v_order FROM public.orders WHERE id = v_refund.order_id;
    IF NOT (public.can_manage_store_as(v_order.vendor_profile_id, p_actor)
            OR (v_order.vendor_profile_id IS NULL AND v_order.vendor_id = p_actor)
            OR EXISTS (SELECT 1 FROM public.platform_admins pa
                        WHERE pa.profile_id = p_actor AND pa.is_active = true)) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;

    UPDATE public.refunds
       SET status = 'processing', processed_by = p_actor, updated_at = now()
     WHERE id = p_refund_id;

    RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id);
END;
$fn$;

COMMENT ON FUNCTION public.approve_order_refund(uuid, uuid) IS
  'Tienda v2 M-F0-6: quien administra la tienda (p_actor) aprueba el reembolso de una orden. Solo service_role.';

-- Las viejas: idénticas para payments / marketplace_transactions; las órdenes
-- van por las nuevas. (search_path estándar.)
CREATE OR REPLACE FUNCTION public.request_refund(
    p_order_id uuid DEFAULT NULL, p_transaction_id uuid DEFAULT NULL,
    p_payment_id uuid DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_user UUID;
    v_amount NUMERIC;
    v_pct NUMERIC := 100.0;
    v_refund_id UUID;
BEGIN
    IF p_order_id IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'USE_request_order_refund');
    END IF;

    v_user := auth.uid();
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'reason_too_short');
    END IF;

    IF p_transaction_id IS NOT NULL THEN
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
        p_transaction_id, NULL, p_payment_id, v_user, p_reason,
        v_amount * (v_pct / 100), v_pct, 'pending'
    ) RETURNING id INTO v_refund_id;

    RETURN jsonb_build_object(
        'ok', true,
        'refund_id', v_refund_id,
        'refund_amount', v_amount * (v_pct / 100),
        'refund_pct', v_pct
    );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.approve_refund(p_refund_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor UUID := auth.uid();
    v_refund RECORD;
    v_authorized BOOLEAN := false;
BEGIN
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
    END IF;

    SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;

    IF v_refund.order_id IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'USE_approve_order_refund');
    END IF;

    IF v_refund.status != 'pending' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
    END IF;

    IF public.is_platform_admin() THEN v_authorized := true; END IF;

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
            WHERE p.id = v_refund.payment_id AND (s.owner_id = v_actor OR public.is_school_admin(s.id))
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
$fn$;

-- ─── 2. complete_refund idempotente ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_refund(p_refund_id uuid, p_wompi_void_id text, p_provider text DEFAULT 'wompi'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_refund RECORD;
    v_item RECORD;
    v_stock_before INT;
    v_order_total NUMERIC;
    v_has_mkt BOOLEAN := EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions');
    v_provider public.payment_provider := public.resolve_payment_provider(p_provider);
    v_is_wompi BOOLEAN := v_provider = 'wompi';
BEGIN
    -- FOR UPDATE: dos llamadas concurrentes se serializan; la segunda ve 'completed'.
    SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;

    IF v_refund.status = 'completed' THEN
        RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id,
                                  'provider', v_refund.payment_provider, 'idempotent', true);
    END IF;

    UPDATE public.refunds
    SET status = 'completed',
        payment_provider = v_provider,
        provider_void_id = p_wompi_void_id,
        wompi_void_id = CASE WHEN v_is_wompi THEN p_wompi_void_id ELSE wompi_void_id END,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_refund_id;

    IF v_refund.order_id IS NOT NULL THEN
        SELECT total_amount INTO v_order_total FROM public.orders WHERE id = v_refund.order_id FOR UPDATE;
        UPDATE public.orders
           SET status = CASE WHEN v_refund.refund_amount < v_order_total
                             THEN 'partially_refunded' ELSE 'refunded' END,
               updated_at = NOW()
         WHERE id = v_refund.order_id;

        -- Stock: solo en reembolso total (el parcial no dice qué unidades vuelven).
        IF v_refund.refund_amount >= v_order_total THEN
            FOR v_item IN
                SELECT id, product_id, variant_id, quantity
                FROM public.order_items
                WHERE order_id = v_refund.order_id
                ORDER BY product_id, variant_id NULLS FIRST
            LOOP
                IF v_item.variant_id IS NOT NULL THEN
                    SELECT stock INTO v_stock_before FROM public.product_variants WHERE id = v_item.variant_id FOR UPDATE;
                    UPDATE public.product_variants SET stock = stock + v_item.quantity, updated_at = NOW() WHERE id = v_item.variant_id;
                ELSE
                    SELECT stock INTO v_stock_before FROM public.products WHERE id = v_item.product_id FOR UPDATE;
                    UPDATE public.products SET stock = stock + v_item.quantity, updated_at = NOW() WHERE id = v_item.product_id;
                END IF;

                INSERT INTO public.inventory_logs (
                    product_id, variant_id, vendor_id, delta, stock_before, stock_after, reason, order_id
                ) VALUES (
                    v_item.product_id, v_item.variant_id,
                    (SELECT vendor_id FROM public.products WHERE id = v_item.product_id),
                    v_item.quantity, v_stock_before, v_stock_before + v_item.quantity,
                    'returned', v_refund.order_id
                );
            END LOOP;
        END IF;
    ELSIF v_refund.transaction_id IS NOT NULL AND v_has_mkt THEN
        EXECUTE 'UPDATE public.marketplace_transactions SET status = ''refunded'', updated_at = NOW() WHERE id = $1'
            USING v_refund.transaction_id;
    ELSIF v_refund.payment_id IS NOT NULL THEN
        UPDATE public.payments SET status = 'refunded', updated_at = NOW() WHERE id = v_refund.payment_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id, 'provider', v_provider);
END;
$fn$;

-- ─── 3. Reseñas y preguntas ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Vendor responde a sus reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Vendor responde su producto"   ON public.product_questions;

REVOKE INSERT, UPDATE, DELETE ON public.product_reviews, public.product_questions FROM anon;
-- El autor edita su reseña 24 h (policy viva) pero solo el contenido: ni la
-- respuesta del vendedor, ni el estado de moderación, ni los contadores.
REVOKE UPDATE ON public.product_reviews FROM authenticated;
GRANT UPDATE (rating, title, body, sport_used_for, level, usage_duration, fit_feedback,
              recommended, updated_at)
    ON public.product_reviews TO authenticated;
-- product_questions: ya no queda ninguna policy de UPDATE para el cliente.
REVOKE UPDATE ON public.product_questions FROM authenticated;

-- ¿Puede p_user reseñar? (orden entregada con ese producto y sin reseña previa)
-- Se reemplaza la de 1 argumento por una con p_user_id opcional (el BFF usa
-- service role). Misma forma de respuesta.
DROP FUNCTION IF EXISTS public.can_review_product(uuid);
CREATE FUNCTION public.can_review_product(p_product_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_user_id   uuid := public._store_actor(p_user_id);
    v_existing  uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('can', false, 'reason', 'not_authenticated');
    END IF;

    SELECT id INTO v_existing FROM public.product_reviews
     WHERE product_id = p_product_id AND user_id = v_user_id;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('can', false, 'reason', 'already_reviewed', 'review_id', v_existing);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.orders o
          JOIN public.order_items oi ON oi.order_id = o.id
         WHERE oi.product_id = p_product_id AND o.user_id = v_user_id AND o.status = 'delivered'
    ) THEN
        RETURN jsonb_build_object('can', false, 'reason', 'not_delivered');
    END IF;

    RETURN jsonb_build_object('can', true);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.create_review(p_product_id uuid, p_review jsonb, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_order uuid;
    v_row   public.product_reviews%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;

    SELECT o.id INTO v_order
      FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id
     WHERE oi.product_id = p_product_id AND o.user_id = v_actor AND o.status = 'delivered'
     ORDER BY o.created_at DESC LIMIT 1;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'NOT_DELIVERED' USING ERRCODE = '42501',
              HINT = 'Solo compradores con orden entregada pueden reseñar este producto.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.product_reviews WHERE product_id = p_product_id AND user_id = v_actor) THEN
        RAISE EXCEPTION 'ALREADY_REVIEWED' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.product_reviews (
        product_id, variant_id, order_id, user_id, rating, title, body,
        sport_used_for, level, usage_duration, fit_feedback, recommended
    ) VALUES (
        p_product_id,
        NULLIF(p_review ->> 'variant_id', '')::uuid,
        v_order,
        v_actor,
        (p_review ->> 'rating')::int,
        NULLIF(p_review ->> 'title', ''),
        p_review ->> 'body',
        NULLIF(p_review ->> 'sport_used_for', ''),
        NULLIF(p_review ->> 'level', ''),
        NULLIF(p_review ->> 'usage_duration', ''),
        NULLIF(p_review ->> 'fit_feedback', ''),
        (p_review ->> 'recommended')::boolean
    )
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
END;
$fn$;

COMMENT ON FUNCTION public.create_review(uuid, jsonb, uuid) IS
  'Tienda v2 M-F0-6: crea la reseña solo con compra entregada (lo que la RLS pedía y el service role se saltaba).';

CREATE OR REPLACE FUNCTION public.respond_review(p_review_id uuid, p_text text, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_prod  record;
    v_row   public.product_reviews%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF p_text IS NULL OR length(btrim(p_text)) < 1 OR length(p_text) > 2000 THEN
        RAISE EXCEPTION 'INVALID_TEXT' USING ERRCODE = '22023';
    END IF;

    SELECT p.vendor_profile_id, p.vendor_id INTO v_prod
      FROM public.product_reviews r JOIN public.products p ON p.id = r.product_id
     WHERE r.id = p_review_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF NOT (public.can_manage_store_as(v_prod.vendor_profile_id, v_actor)
            OR (v_prod.vendor_profile_id IS NULL AND v_prod.vendor_id = v_actor)) THEN
        RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
    END IF;

    UPDATE public.product_reviews
       SET vendor_response     = btrim(p_text),
           vendor_responded_at = now(),
           vendor_responded_by = (SELECT u.id FROM auth.users u WHERE u.id = v_actor)
     WHERE id = p_review_id
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.answer_question(p_question_id uuid, p_text text, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_prod  record;
    v_row   public.product_questions%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF p_text IS NULL OR length(btrim(p_text)) < 1 OR length(p_text) > 2000 THEN
        RAISE EXCEPTION 'INVALID_TEXT' USING ERRCODE = '22023';
    END IF;

    SELECT p.vendor_profile_id, p.vendor_id INTO v_prod
      FROM public.product_questions q JOIN public.products p ON p.id = q.product_id
     WHERE q.id = p_question_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF NOT (public.can_manage_store_as(v_prod.vendor_profile_id, v_actor)
            OR (v_prod.vendor_profile_id IS NULL AND v_prod.vendor_id = v_actor)) THEN
        RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
    END IF;

    UPDATE public.product_questions
       SET vendor_answer      = btrim(p_text),
           vendor_answered_at = now(),
           vendor_answered_by = (SELECT u.id FROM auth.users u WHERE u.id = v_actor)
     WHERE id = p_question_id
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
END;
$fn$;

-- ─── 4. shipments_vendor con WITH CHECK (I3) ─────────────────────────────────
-- La orden del envío tiene que ser de esa tienda. DEFINER: no depende de la
-- RLS de orders/order_items.
CREATE OR REPLACE FUNCTION public.order_belongs_to_store(p_order_id uuid, p_vendor_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT p_vendor_profile_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.orders o
         WHERE o.id = p_order_id
           AND (o.vendor_profile_id = p_vendor_profile_id
                OR EXISTS (SELECT 1 FROM public.order_items oi
                             LEFT JOIN public.products p ON p.id = oi.product_id
                            WHERE oi.order_id = o.id
                              AND (oi.vendor_profile_id = p_vendor_profile_id
                                   OR p.vendor_profile_id = p_vendor_profile_id)))
    );
$fn$;

DROP POLICY IF EXISTS shipments_vendor ON public.shipments;
CREATE POLICY shipments_vendor ON public.shipments
    FOR ALL TO authenticated
    USING (public.can_manage_store(vendor_profile_id))
    WITH CHECK (public.can_manage_store(vendor_profile_id)
                AND public.order_belongs_to_store(order_id, vendor_profile_id));

REVOKE INSERT, UPDATE, DELETE ON public.shipments FROM anon;

-- ─── 5. Kardex append-only ───────────────────────────────────────────────────
DROP POLICY IF EXISTS inventory_logs_admin_all ON public.inventory_logs;
DROP POLICY IF EXISTS inventory_logs_admin_read ON public.inventory_logs;
CREATE POLICY inventory_logs_admin_read ON public.inventory_logs
    FOR SELECT TO authenticated
    USING ((SELECT public.is_super_admin()));

-- El vendedor lee el kardex de sus productos (también el admin de la escuela).
DROP POLICY IF EXISTS inventory_logs_vendor_read ON public.inventory_logs;
CREATE POLICY inventory_logs_vendor_read ON public.inventory_logs
    FOR SELECT TO authenticated
    USING (vendor_id = (SELECT auth.uid()) OR public.store_can_manage_product(product_id));

REVOKE INSERT, UPDATE, DELETE ON public.inventory_logs FROM anon, authenticated;
REVOKE ALL ON public.inventory_logs FROM anon;

-- ─── Grants de funciones ─────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.request_order_refund(uuid, text, uuid)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_order_refund(uuid, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_refund(uuid, uuid, uuid, text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_refund(uuid)                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_refund(uuid, text, text)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_review_product(uuid, uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_review(uuid, jsonb, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.respond_review(uuid, text, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.answer_question(uuid, text, uuid)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_belongs_to_store(uuid, uuid)            FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.request_order_refund(uuid, text, uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_order_refund(uuid, uuid)        TO service_role;
GRANT EXECUTE ON FUNCTION public.request_refund(uuid, uuid, uuid, text)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_refund(uuid)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_refund(uuid, text, text)       TO service_role;
GRANT EXECUTE ON FUNCTION public.can_review_product(uuid, uuid)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_review(uuid, jsonb, uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_review(uuid, text, uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.answer_question(uuid, text, uuid)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.order_belongs_to_store(uuid, uuid)      TO authenticated, service_role;

COMMIT;
