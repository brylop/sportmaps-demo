-- =============================================================================
-- 20261003230007_tienda_v2_motor_orden.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202439
-- Objetivo: M-F0-4 de docs/specs/tienda-v2-f0-plan-migraciones.md (motor de la
--   orden). Hoy (docs/qa/tienda-baseline-padre-2026-10-03.md) el BFF arma la
--   orden con N inserts sueltos sin transacción, IVA sumado encima (T16), sin
--   reserva de stock (B6: 4 gorras con stock 1) y con dos sobrecargas de
--   confirm_order_payment (T8). Esta migración deja UN camino transaccional:
--
--   1. products.reserved / product_variants.reserved (caché de reservas
--      activas; el cliente no lo escribe) y stock_holds (sin acceso del cliente).
--   2. order_items: foto por ítem de comisión y dueño (contrato de contabilidad
--      §6.3) + orders.seller_gateway_kind.
--   3. CHECK de orders.payment_method (D-17): solo el canal
--      (wompi|mercadopago|transfer|cash_pickup). El submétodo (CARD, PSE…) va
--      en payment_method_detail. Valores viejos se normalizan.
--   4. create_cart_order (contrato DEFINITIVO, 9 args) + quote_cart: precio,
--      IVA y total salen de la base (§6.3 IVA incluido), FOR UPDATE ordenado
--      por id, reserva, idempotency_key, un vendedor por checkout (D-2),
--      cupones → COUPONS_NOT_AVAILABLE.
--   5. _settle_order_paid (interna) y confirm_order_payment(5 args) reescrita:
--      consume holds, kardex, settlements, eventos contables. Pago tardío sin
--      stock → payment_review (PAID_WITHOUT_STOCK), nunca stock negativo.
--      DROP de confirm_order_payment(4 args): la llamada de Wompi con 4 args
--      con nombre resuelve a la de 5 (p_provider DEFAULT 'wompi'); arregla T8.
--   6. Transferencia: submit_order_receipt → awaiting_approval →
--      approve_order_receipt (paid con approved_by) / reject_order_receipt.
--      Bucket privado order-receipts con policies por orden.
--   7. Efectivo al retirar: reserva por cash_hold_hours (48 h) y
--      confirm_cash_pickup (código de retiro) → paid + delivered.
--   8. store_order_payment_failed (webhook rechazado/anulado libera la reserva),
--      cancel_my_order, order_transition (matriz por actor) y
--      release_expired_holds (+ pg_cron si existe). Una orden en
--      awaiting_approval NO vence (D-18).
--
--   DECISIONES PROVISIONALES (2026-10-03, documentadas en el PR):
--   · D-5 = A: cada vendedor cobra con SUS llaves. La resolución de la
--     pasarela vive en _store_checkout_gateway; acá se crea como STUB
--     fail-closed y 20261003230013 la reemplaza. Nunca llaves globales.
--   · D-3: comisión 0 % tienda escolar; externo = vendor_profiles.commission_rate
--     (foto en order_items.commission_rate). Con D-5 = A la comisión queda
--     ADEUDADA (settlements.collected_by='seller', 20261003230011).
--   · D-1: IVA incluido según products.tax_rate (§6.3): line_base =
--     round(line_total/(1+rate)), line_tax = line_total - line_base.
--   · D-2: un checkout por vendedor (MULTIPLE_SELLERS).
--   · Cupones: no en esta fase. p_coupon_code no vacío → COUPONS_NOT_AVAILABLE.
--   · D-6/D-18: reserva pasarela 45 min (cubre PSE), transferencia y efectivo
--     según store_payment_settings (48 h por defecto). Comprobante en revisión
--     no vence.
--   · D-11: el envío no lleva IVA (línea aparte, excluida) hasta que lo
--     confirme el contador.
--   · Referencia CART-<hex>-<hex> (no ORD-…): reusa el ruteo por prefijo y el
--     filtro SAFE_REFERENCE de los webhooks.
--   Dependencias hacia adelante (STUB acá, cuerpo real después, siempre
--   fail-closed entre una y otra): _store_checkout_gateway (230013),
--   _store_emit_order_events (230016). compute_settlements_for_order existe
--   en la viva y la reescribe 230011.
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
    IF to_regprocedure('public.request_order_refund(uuid,text,uuid)') IS NULL
       OR to_regprocedure('public._store_actor(uuid)') IS NULL
       OR to_regclass('public.order_status_history') IS NULL THEN
        RAISE EXCEPTION 'Faltan M-F0-1..M-F0-6 (20261003202431..202439): aplicarlas antes.';
    END IF;
END
$pre$;

-- ─── 1. Reservas ─────────────────────────────────────────────────────────────
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS reserved integer NOT NULL DEFAULT 0;
ALTER TABLE public.product_variants
    ADD COLUMN IF NOT EXISTS reserved integer NOT NULL DEFAULT 0;
ALTER TABLE public.products
    ADD CONSTRAINT products_reserved_nonneg CHECK (reserved >= 0);
ALTER TABLE public.product_variants
    ADD CONSTRAINT product_variants_reserved_nonneg CHECK (reserved >= 0);

COMMENT ON COLUMN public.products.reserved IS
  'Tienda v2: unidades en reservas activas (stock_holds). Solo lo mueven RPC DEFINER. Disponible = stock - reserved.';
COMMENT ON COLUMN public.product_variants.reserved IS
  'Tienda v2: unidades en reservas activas (stock_holds). Solo lo mueven RPC DEFINER. Disponible = stock - reserved.';

-- El INSERT de products/variants conserva el grant de tabla (stock inicial):
-- el cliente no puede nacer con reservas.
CREATE OR REPLACE FUNCTION public.fn_store_reserved_from_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
    IF current_user IN ('authenticated', 'anon') THEN
        NEW.reserved := 0;
    END IF;
    RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.fn_store_reserved_from_client() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_products_reserved_client ON public.products;
CREATE TRIGGER trg_products_reserved_client
    BEFORE INSERT ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.fn_store_reserved_from_client();
DROP TRIGGER IF EXISTS trg_variants_reserved_client ON public.product_variants;
CREATE TRIGGER trg_variants_reserved_client
    BEFORE INSERT ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION public.fn_store_reserved_from_client();

CREATE TABLE IF NOT EXISTS public.stock_holds (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
    product_id    uuid NOT NULL REFERENCES public.products(id),
    variant_id    uuid REFERENCES public.product_variants(id),
    quantity      integer NOT NULL CHECK (quantity > 0),
    status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'consumed', 'released', 'expired')),
    expires_at    timestamptz NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    closed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS stock_holds_active_expires_idx ON public.stock_holds (expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS stock_holds_order_idx ON public.stock_holds (order_id);

ALTER TABLE public.stock_holds ENABLE ROW LEVEL SECURITY;   -- sin policies
REVOKE ALL ON public.stock_holds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stock_holds TO service_role;

COMMENT ON TABLE public.stock_holds IS
  'Tienda v2 §4.2: reserva de stock por línea de orden. Solo la escriben RPC DEFINER (create_cart_order, _settle_order_paid, release).';

-- ─── 2. Foto por ítem y pasarela de la orden ─────────────────────────────────
ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS commission_rate numeric(5,4),
    ADD COLUMN IF NOT EXISTS owner_type      text,
    ADD COLUMN IF NOT EXISTS owner_id        uuid;
ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_owner_type_check
        CHECK (owner_type IS NULL OR owner_type IN ('school', 'vendor'));

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS seller_gateway_kind text;
ALTER TABLE public.orders
    ADD CONSTRAINT orders_seller_gateway_kind_check
        CHECK (seller_gateway_kind IS NULL OR seller_gateway_kind IN ('school', 'vendor'));

COMMENT ON COLUMN public.orders.seller_gateway_id IS
  'Fila de school_payment_providers (kind=school) o vendor_payment_providers (kind=vendor) con que se cobra. Nunca llaves globales (D-5 = A).';

-- ─── 3. payment_method = canal (D-17) ────────────────────────────────────────
UPDATE public.orders
   SET payment_method_detail = COALESCE(payment_method_detail, payment_method),
       payment_method = CASE
           WHEN lower(payment_method) IN ('wompi', 'card', 'pse', 'nequi', 'daviplata',
                                          'bancolombia_transfer', 'bancolombia_qr',
                                          'bancolombia_collect') THEN 'wompi'
           WHEN lower(payment_method) IN ('mercadopago', 'mp', 'credit_card', 'debit_card',
                                          'account_money', 'ticket', 'bank_transfer') THEN 'mercadopago'
           WHEN lower(payment_method) IN ('transfer', 'transferencia') THEN 'transfer'
           WHEN lower(payment_method) IN ('cash', 'efectivo', 'cash_pickup') THEN 'cash_pickup'
           ELSE NULL END
 WHERE payment_method IS NOT NULL
   AND payment_method NOT IN ('wompi', 'mercadopago', 'transfer', 'cash_pickup');

ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_method_check
        CHECK (payment_method IS NULL OR payment_method IN ('wompi', 'mercadopago', 'transfer', 'cash_pickup'));

-- ─── 4. Helpers internos (sin EXECUTE para nadie) ────────────────────────────
-- IVA: acepta 0.19 o 19 (datos viejos); fuera de rango → 0.
CREATE OR REPLACE FUNCTION public._store_norm_tax_rate(p_rate numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT CASE
        WHEN p_rate IS NULL OR p_rate < 0 THEN 0::numeric
        WHEN p_rate > 1 AND p_rate <= 100 THEN round(p_rate / 100, 4)
        WHEN p_rate > 100 THEN 0::numeric
        ELSE round(p_rate, 4) END;
$fn$;

-- §6.3: IVA incluido, pesos enteros, el IVA cuadra al peso con lo cobrado.
CREATE OR REPLACE FUNCTION public._store_line_amounts(p_unit_price numeric, p_qty integer, p_tax_rate numeric)
RETURNS TABLE (line_total numeric, line_base numeric, line_tax numeric)
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    WITH t AS (SELECT round(p_unit_price * p_qty) AS total,
                      public._store_norm_tax_rate(p_tax_rate) AS rate)
    SELECT t.total, round(t.total / (1 + t.rate)), t.total - round(t.total / (1 + t.rate)) FROM t;
$fn$;

-- D-3 (provisional): tienda escolar 0 %; externo su commission_rate (0.10 por defecto).
CREATE OR REPLACE FUNCTION public._store_commission_rate(p_vendor_profile_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT CASE
        WHEN vp.vendor_type::text = 'school' AND vp.school_id IS NOT NULL THEN 0::numeric
        ELSE COALESCE(vp.commission_rate,
                      (SELECT (value ->> 'rate')::numeric FROM public.platform_config
                        WHERE key = 'default_commission_rate'),
                      0.10)
    END
    FROM public.vendor_profiles vp WHERE vp.id = p_vendor_profile_id;
$fn$;

-- Escuelas de un usuario explícito (user_school_ids() solo sirve con JWT).
CREATE OR REPLACE FUNCTION public._store_user_school_ids(p_user uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT COALESCE(ARRAY(
        SELECT sm.school_id FROM public.school_members sm
         WHERE sm.profile_id = p_user AND sm.status = 'active'
        UNION
        SELECT ss.school_id FROM public.school_staff ss
         WHERE ss.coach_auth_id = p_user AND ss.status = 'active'
        UNION
        SELECT s.id FROM public.schools s WHERE s.owner_id = p_user
    ), '{}'::uuid[]);
$fn$;

-- Actor/nota del historial (trg_orders_status_history lee estos GUC locales).
CREATE OR REPLACE FUNCTION public._store_set_actor(p_role text, p_actor uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT set_config('sportmaps.order_actor_role', COALESCE(p_role, ''), true),
           set_config('sportmaps.order_actor_id', COALESCE(p_actor::text, ''), true),
           set_config('sportmaps.order_note', COALESCE(left(p_note, 500), ''), true);
$fn$;

-- El historial toma el actor del GUC (el BFF usa service role: auth.uid() NULL).
CREATE OR REPLACE FUNCTION public.fn_orders_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_uid  uuid := auth.uid();
    v_role text := NULLIF(current_setting('sportmaps.order_actor_role', true), '');
    v_gid  text := NULLIF(current_setting('sportmaps.order_actor_id', true), '');
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NULL;
    END IF;
    IF v_gid IS NOT NULL THEN
        BEGIN
            v_uid := v_gid::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
            NULL;
        END;
    END IF;
    IF v_role IS NULL OR v_role NOT IN ('buyer', 'seller', 'admin', 'system', 'webhook') THEN
        v_role := CASE
            WHEN v_uid IS NULL                THEN 'system'
            WHEN v_uid = NEW.user_id          THEN 'buyer'
            WHEN public.is_super_admin()      THEN 'admin'
            ELSE 'seller' END;
    END IF;
    INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
    VALUES (NEW.id,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
            NEW.status,
            (SELECT p.id FROM public.profiles p WHERE p.id = v_uid),
            v_role,
            NULLIF(current_setting('sportmaps.order_note', true), ''));
    RETURN NULL;
END;
$fn$;

-- STUB fail-closed: 20261003230013 la reemplaza con la pasarela del vendedor.
-- Devuelve {gateway_id, gateway_kind, provider, hold_minutes}.
CREATE OR REPLACE FUNCTION public._store_checkout_gateway(p_vendor_profile_id uuid, p_method text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
    RAISE EXCEPTION 'PAYMENT_METHOD_NOT_ACCEPTED' USING ERRCODE = 'P0001',
          HINT = 'Medios de pago del vendedor sin configurar (falta 20261003230013).';
END;
$fn$;

-- STUB: 20261003230016 la reemplaza (eventos a accounting_outbox).
CREATE OR REPLACE FUNCTION public._store_emit_order_events(p_order_id uuid, p_kind text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
    RETURN 0;
END;
$fn$;

-- Resumen de la orden (lo que devuelven las RPC al BFF / comprador).
CREATE OR REPLACE FUNCTION public._store_order_summary(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT jsonb_build_object(
        'order_id', o.id,
        'reference', o.reference,
        'status', o.status,
        'payment_method', o.payment_method,
        'vendor_profile_id', o.vendor_profile_id,
        'seller_gateway_id', o.seller_gateway_id,
        'seller_gateway_kind', o.seller_gateway_kind,
        'fulfillment', o.fulfillment_mode,
        'pickup_branch_id', o.pickup_branch_id,
        'subtotal', o.subtotal,
        'discount_total', o.discount_total,
        'tax_total', o.tax_total,
        'shipping', o.shipping_cost,
        'total', o.total_amount,
        'amount_in_cents', (o.total_amount * 100)::bigint,
        'currency', 'COP',
        'expires_at', o.expires_at,
        'items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'order_item_id', oi.id,
                       'product_id', oi.product_id,
                       'variant_id', oi.variant_id,
                       'name', p.name || COALESCE(' · ' || v.name, ''),
                       'quantity', oi.quantity,
                       'unit_price', oi.unit_price,
                       'tax_rate', oi.tax_rate,
                       'line_total', oi.line_total,
                       'line_base', oi.line_base,
                       'line_tax', oi.tax_amount) ORDER BY oi.created_at, oi.id)
              FROM public.order_items oi
              JOIN public.products p ON p.id = oi.product_id
              LEFT JOIN public.product_variants v ON v.id = oi.variant_id
             WHERE oi.order_id = o.id), '[]'::jsonb)
    )
    FROM public.orders o WHERE o.id = p_order_id;
$fn$;

-- Libera las reservas activas de una orden (cancelación / vencimiento).
-- Bloquea en el orden canónico: variantes por id, luego productos por id.
CREATE OR REPLACE FUNCTION public._store_release_holds(p_order_id uuid, p_hold_status text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_h record;
    v_n integer := 0;
BEGIN
    IF p_hold_status NOT IN ('released', 'expired') THEN
        RAISE EXCEPTION 'INVALID_HOLD_STATUS' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.product_variants
     WHERE id IN (SELECT variant_id FROM public.stock_holds
                   WHERE order_id = p_order_id AND status = 'active' AND variant_id IS NOT NULL)
     ORDER BY id FOR UPDATE;
    PERFORM 1 FROM public.products
     WHERE id IN (SELECT product_id FROM public.stock_holds
                   WHERE order_id = p_order_id AND status = 'active' AND variant_id IS NULL)
     ORDER BY id FOR UPDATE;

    FOR v_h IN SELECT * FROM public.stock_holds
                WHERE order_id = p_order_id AND status = 'active' FOR UPDATE
    LOOP
        IF v_h.variant_id IS NOT NULL THEN
            UPDATE public.product_variants SET reserved = GREATEST(reserved - v_h.quantity, 0)
             WHERE id = v_h.variant_id;
        ELSE
            UPDATE public.products SET reserved = GREATEST(reserved - v_h.quantity, 0)
             WHERE id = v_h.product_id;
        END IF;
        UPDATE public.stock_holds SET status = p_hold_status, closed_at = now() WHERE id = v_h.id;
        v_n := v_n + 1;
    END LOOP;
    RETURN v_n;
END;
$fn$;

-- ─── 5. create_cart_order (contrato definitivo) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.create_cart_order(
    p_items           jsonb,
    p_fulfillment     text,
    p_pickup_branch   uuid,
    p_address         jsonb,
    p_buyer           jsonb,
    p_payment_method  text,
    p_coupon_code     text,
    p_buyer_id        uuid,
    p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_buyer      uuid;
    v_existing   uuid;
    v_agg        jsonb;
    v_vps        uuid[];
    v_vp         public.vendor_profiles%ROWTYPE;
    v_gw         jsonb;
    v_hold_min   integer;
    v_school_ids uuid[];
    v_l          record;
    v_amt        record;
    v_lines      jsonb := '[]'::jsonb;
    v_short      jsonb := '[]'::jsonb;
    v_unit       numeric;
    v_rate       numeric;
    v_comm       numeric;
    v_avail      integer;
    v_subtotal   numeric := 0;
    v_tax        numeric := 0;
    v_shipping   numeric := 0;
    v_total      numeric;
    v_dept       text;
    v_branch     uuid;
    v_order_id   uuid := gen_random_uuid();
    v_reference  text;
    v_expires    timestamptz;
    v_code       text;
    v_owner_type text;
    v_owner_id   uuid;
    v_prof       record;
    v_item_id    uuid;
    v_line       jsonb;
BEGIN
    -- Comprador: el del JWT; solo el BFF (service role) lo pasa explícito.
    v_buyer := CASE WHEN COALESCE(auth.role(), '') = 'service_role' THEN p_buyer_id ELSE auth.uid() END;
    IF v_buyer IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501',
              HINT = 'Compra como invitado: no disponible en esta fase.';
    END IF;

    IF NOT public.store_enabled() THEN
        RAISE EXCEPTION 'STORE_DISABLED' USING ERRCODE = 'P0001';
    END IF;

    -- Idempotencia: el mismo clic reintentado devuelve la misma orden. El lock
    -- consultivo serializa dos reintentos simultáneos con la misma clave.
    IF p_idempotency_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(v_buyer::text || ':' || p_idempotency_key::text, 7));
        SELECT id INTO v_existing FROM public.orders
         WHERE user_id = v_buyer AND idempotency_key = p_idempotency_key;
        IF v_existing IS NOT NULL THEN
            RETURN public._store_order_summary(v_existing) || jsonb_build_object('idempotent', true);
        END IF;
    END IF;

    IF NULLIF(btrim(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
        RAISE EXCEPTION 'COUPONS_NOT_AVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    IF p_payment_method IS NULL OR p_payment_method NOT IN ('wompi', 'mercadopago', 'transfer', 'cash_pickup') THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_METHOD' USING ERRCODE = '22023';
    END IF;
    IF p_fulfillment IS NULL OR p_fulfillment NOT IN ('pickup', 'shipping') THEN
        RAISE EXCEPTION 'INVALID_FULFILLMENT' USING ERRCODE = '22023';
    END IF;
    IF p_payment_method = 'cash_pickup' AND p_fulfillment <> 'pickup' THEN
        RAISE EXCEPTION 'CASH_REQUIRES_PICKUP' USING ERRCODE = '22023';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_CART' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_items) > 50 THEN
        RAISE EXCEPTION 'TOO_MANY_ITEMS' USING ERRCODE = '22023';
    END IF;

    -- Normaliza: solo variant_id / product_id / quantity. Cualquier precio que
    -- mande el cliente se ignora (R6). La variante manda sobre el producto.
    WITH raw AS (
        SELECT NULLIF(e ->> 'variant_id', '')::uuid AS variant_id,
               NULLIF(e ->> 'product_id', '')::uuid AS product_id,
               CASE WHEN (e ->> 'quantity') ~ '^\s*[0-9]{1,4}\s*$' THEN (e ->> 'quantity')::integer END AS qty
          FROM jsonb_array_elements(p_items) e
    ), res AS (
        SELECT COALESCE(pv.product_id, r.product_id) AS product_id,
               r.variant_id,
               r.qty,
               (r.variant_id IS NOT NULL AND pv.id IS NULL) AS bad_variant,
               (r.variant_id IS NOT NULL AND pv.id IS NOT NULL AND r.product_id IS NOT NULL
                AND r.product_id <> pv.product_id) AS mismatch
          FROM raw r LEFT JOIN public.product_variants pv ON pv.id = r.variant_id
    )
    SELECT jsonb_agg(jsonb_build_object(
               'product_id', product_id, 'variant_id', variant_id, 'qty', qty,
               'bad', bad, 'noqty', noqty) ORDER BY product_id, variant_id)
      INTO v_agg
      FROM (SELECT product_id, variant_id,
                   sum(qty)::integer AS qty,
                   bool_or(bad_variant OR mismatch OR product_id IS NULL) AS bad,
                   bool_or(qty IS NULL) AS noqty
              FROM res GROUP BY product_id, variant_id) g;

    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_agg) x WHERE (x ->> 'bad')::boolean) THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_agg) x
                WHERE (x ->> 'noqty')::boolean OR (x ->> 'qty')::integer NOT BETWEEN 1 AND 20) THEN
        RAISE EXCEPTION 'INVALID_QTY' USING ERRCODE = '22023', HINT = 'Entre 1 y 20 unidades por producto.';
    END IF;

    -- D-2: un vendedor por checkout. Y el vendedor tiene que poder vender hoy.
    SELECT array_agg(DISTINCT p.vendor_profile_id) INTO v_vps
      FROM jsonb_to_recordset(v_agg) AS a(product_id uuid, variant_id uuid, qty integer)
      JOIN public.products p ON p.id = a.product_id;
    IF v_vps IS NULL OR array_length(v_vps, 1) IS NULL THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF array_length(v_vps, 1) > 1 THEN
        RAISE EXCEPTION 'MULTIPLE_SELLERS' USING ERRCODE = 'P0001',
              HINT = 'Se paga una tienda por checkout.';
    END IF;
    IF v_vps[1] IS NULL OR NOT public.store_seller_allowed(v_vps[1]) THEN
        RAISE EXCEPTION 'SELLER_NOT_ALLOWED' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE id = v_vps[1];

    -- Medio aceptado por ESE vendedor, con SUS llaves (D-5 = A).
    v_gw := public._store_checkout_gateway(v_vp.id, p_payment_method);
    v_hold_min := COALESCE((v_gw ->> 'hold_minutes')::integer, 45);

    -- FOR UPDATE en orden canónico (variantes por id, luego productos por id):
    -- dos carritos con los mismos ítems en distinto orden no se bloquean (C3).
    PERFORM 1 FROM public.product_variants
     WHERE id IN (SELECT (x ->> 'variant_id')::uuid FROM jsonb_array_elements(v_agg) x
                   WHERE x ->> 'variant_id' IS NOT NULL)
     ORDER BY id FOR UPDATE;
    PERFORM 1 FROM public.products
     WHERE id IN (SELECT (x ->> 'product_id')::uuid FROM jsonb_array_elements(v_agg) x
                   WHERE x ->> 'variant_id' IS NULL)
     ORDER BY id FOR UPDATE;

    v_school_ids := public._store_user_school_ids(v_buyer);
    v_rate := public._store_commission_rate(v_vp.id);

    FOR v_l IN
        SELECT a.product_id, a.variant_id, a.qty,
               p.name, p.price, p.tax_rate, p.active, p.status AS p_status, p.visibility::text AS visibility,
               p.school_id AS p_school, p.vendor_profile_id, p.stock AS p_stock, p.reserved AS p_reserved,
               v.id AS v_id, v.name AS v_name, v.price_override, v.stock AS v_stock,
               v.reserved AS v_reserved, v.is_active AS v_active,
               EXISTS (SELECT 1 FROM public.product_variants x WHERE x.product_id = p.id) AS has_variants
          FROM jsonb_to_recordset(v_agg) AS a(product_id uuid, variant_id uuid, qty integer)
          JOIN public.products p ON p.id = a.product_id
          LEFT JOIN public.product_variants v ON v.id = a.variant_id
         ORDER BY a.product_id, a.variant_id
    LOOP
        IF v_l.vendor_profile_id IS DISTINCT FROM v_vp.id THEN
            RAISE EXCEPTION 'MULTIPLE_SELLERS' USING ERRCODE = 'P0001';
        END IF;
        IF NOT COALESCE(v_l.active, false) OR v_l.p_status <> 'active' OR v_l.visibility = 'private'
           OR (v_l.visibility = 'school_only'
               AND (v_l.p_school IS NULL OR NOT (v_l.p_school = ANY (v_school_ids))))
           OR (v_l.variant_id IS NOT NULL AND NOT COALESCE(v_l.v_active, false)) THEN
            RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE' USING ERRCODE = 'P0001',
                  DETAIL = jsonb_build_object('product_id', v_l.product_id, 'variant_id', v_l.variant_id)::text;
        END IF;
        IF v_l.has_variants AND v_l.variant_id IS NULL THEN
            RAISE EXCEPTION 'VARIANT_REQUIRED' USING ERRCODE = '22023',
                  DETAIL = jsonb_build_object('product_id', v_l.product_id)::text;
        END IF;

        v_avail := CASE WHEN v_l.variant_id IS NOT NULL THEN v_l.v_stock - v_l.v_reserved
                        ELSE v_l.p_stock - v_l.p_reserved END;
        IF v_avail < v_l.qty THEN
            v_short := v_short || jsonb_build_object('product_id', v_l.product_id, 'variant_id', v_l.variant_id,
                                                     'requested', v_l.qty, 'available', GREATEST(v_avail, 0));
        END IF;

        v_unit := COALESCE(v_l.price_override, v_l.price);
        IF v_unit IS NULL OR v_unit <= 0 THEN
            RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE' USING ERRCODE = 'P0001',
                  DETAIL = jsonb_build_object('product_id', v_l.product_id, 'reason', 'price')::text;
        END IF;
        SELECT * INTO v_amt FROM public._store_line_amounts(v_unit, v_l.qty, v_l.tax_rate);
        v_comm := round(v_amt.line_total * v_rate);

        v_lines := v_lines || jsonb_build_object(
            'product_id', v_l.product_id, 'variant_id', v_l.variant_id, 'qty', v_l.qty,
            'unit_price', v_unit, 'tax_rate', public._store_norm_tax_rate(v_l.tax_rate),
            'line_total', v_amt.line_total, 'line_base', v_amt.line_base, 'line_tax', v_amt.line_tax,
            'platform_fee', v_comm);
        v_subtotal := v_subtotal + v_amt.line_total;
        v_tax      := v_tax + v_amt.line_tax;
    END LOOP;

    IF jsonb_array_length(v_short) > 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001', DETAIL = v_short::text;
    END IF;

    -- Entrega.
    IF p_fulfillment = 'pickup' THEN
        v_shipping := 0;
        IF p_pickup_branch IS NOT NULL THEN
            IF v_vp.school_id IS NULL OR NOT EXISTS (
                SELECT 1 FROM public.school_branches b
                 WHERE b.id = p_pickup_branch AND b.school_id = v_vp.school_id
                   AND COALESCE(b.status, 'active') = 'active') THEN
                RAISE EXCEPTION 'INVALID_PICKUP_BRANCH' USING ERRCODE = '22023';
            END IF;
            v_branch := p_pickup_branch;
        ELSIF v_vp.school_id IS NOT NULL THEN
            SELECT b.id INTO v_branch FROM public.school_branches b
             WHERE b.school_id = v_vp.school_id AND COALESCE(b.status, 'active') = 'active'
             ORDER BY b.is_main DESC NULLS LAST, b.created_at LIMIT 1;
        END IF;
    ELSE
        v_dept := btrim(COALESCE(p_address ->> 'departamento', p_address ->> 'department', ''));
        IF v_dept = '' OR btrim(COALESCE(p_address ->> 'direccion', p_address ->> 'line1',
                                         p_address ->> 'address', '')) = '' THEN
            RAISE EXCEPTION 'ADDRESS_REQUIRED' USING ERRCODE = '22023';
        END IF;
        SELECT z.costo_base INTO v_shipping FROM public.shipping_zones z
         WHERE z.is_active AND lower(btrim(z.departamento)) = lower(v_dept)
         LIMIT 1;
        IF v_shipping IS NULL THEN
            RAISE EXCEPTION 'SHIPPING_ZONE_NOT_FOUND' USING ERRCODE = 'P0001',
                  DETAIL = jsonb_build_object('departamento', v_dept)::text;
        END IF;
        v_shipping := round(v_shipping);
    END IF;

    v_total := v_subtotal + v_shipping;   -- discount_total = 0 hasta F3b
    IF v_total <= 0 THEN
        RAISE EXCEPTION 'EMPTY_TOTAL' USING ERRCODE = 'P0001';
    END IF;

    -- Dueño de la venta (foto por ítem; contrato de contabilidad §6.2).
    IF v_vp.vendor_type::text = 'school' AND v_vp.school_id IS NOT NULL THEN
        v_owner_type := 'school'; v_owner_id := v_vp.school_id;
    ELSE
        v_owner_type := 'vendor'; v_owner_id := v_vp.id;
    END IF;

    SELECT p.full_name, p.email, p.phone, p.document_number INTO v_prof
      FROM public.profiles p WHERE p.id = v_buyer;

    v_reference := 'CART-' || upper(to_hex((extract(epoch FROM clock_timestamp()) * 1000)::bigint))
                || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    v_expires := now() + make_interval(mins => v_hold_min);
    IF p_fulfillment = 'pickup' THEN
        v_code := lpad((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0');
    END IF;

    PERFORM public._store_set_actor('buyer', v_buyer, NULL);

    INSERT INTO public.orders (
        id, user_id, vendor_id, vendor_profile_id, school_id, reference, idempotency_key,
        status, payment_method, payment_provider, provider_reference, wompi_reference,
        seller_gateway_id, seller_gateway_kind, fulfillment_mode, pickup_branch_id,
        shipping_address, shipping_cost, subtotal, discount_total, tax_total, total_amount,
        expires_at, buyer_snapshot, customer_name, customer_document, contact_email, contact_phone,
        notes, pickup_code_hash, platform_fee
    ) VALUES (
        v_order_id, v_buyer, v_vp.user_id, v_vp.id, v_vp.school_id, v_reference, p_idempotency_key,
        'pending_payment', p_payment_method,
        CASE p_payment_method WHEN 'wompi' THEN 'wompi'::public.payment_provider
                              WHEN 'mercadopago' THEN 'mercadopago'::public.payment_provider END,
        CASE WHEN p_payment_method IN ('wompi', 'mercadopago') THEN v_reference END,
        CASE WHEN p_payment_method = 'wompi' THEN v_reference END,
        NULLIF(v_gw ->> 'gateway_id', '')::uuid, NULLIF(v_gw ->> 'gateway_kind', ''),
        p_fulfillment, v_branch,
        CASE WHEN p_fulfillment = 'shipping' THEN p_address END,
        v_shipping, v_subtotal, 0, v_tax, v_total,
        v_expires,
        jsonb_strip_nulls(jsonb_build_object(
            'name',     COALESCE(NULLIF(btrim(p_buyer ->> 'name'), ''), v_prof.full_name),
            'document', COALESCE(NULLIF(btrim(p_buyer ->> 'document'), ''), v_prof.document_number),
            'email',    COALESCE(NULLIF(btrim(p_buyer ->> 'email'), ''), v_prof.email),
            'phone',    COALESCE(NULLIF(btrim(p_buyer ->> 'phone'), ''), v_prof.phone))),
        COALESCE(NULLIF(btrim(p_buyer ->> 'name'), ''), v_prof.full_name),
        COALESCE(NULLIF(btrim(p_buyer ->> 'document'), ''), v_prof.document_number),
        COALESCE(NULLIF(btrim(p_buyer ->> 'email'), ''), v_prof.email),
        COALESCE(NULLIF(btrim(p_buyer ->> 'phone'), ''), v_prof.phone),
        NULLIF(left(btrim(COALESCE(p_buyer ->> 'notes', '')), 1000), ''),
        CASE WHEN v_code IS NOT NULL THEN encode(sha256(convert_to(v_code || ':' || v_order_id::text, 'UTF8')), 'hex') END,
        (SELECT COALESCE(sum((x ->> 'platform_fee')::numeric), 0) FROM jsonb_array_elements(v_lines) x)
    );

    FOR v_line IN SELECT x FROM jsonb_array_elements(v_lines) x LOOP
        INSERT INTO public.order_items (
            order_id, product_id, variant_id, quantity, unit_price, subtotal, tax_amount,
            tax_rate, line_total, line_base, discount_amount, vendor_id, vendor_profile_id,
            platform_fee, commission_rate, owner_type, owner_id
        ) VALUES (
            v_order_id, (v_line ->> 'product_id')::uuid, NULLIF(v_line ->> 'variant_id', '')::uuid,
            (v_line ->> 'qty')::integer, (v_line ->> 'unit_price')::numeric,
            (v_line ->> 'line_total')::numeric, (v_line ->> 'line_tax')::numeric,
            (v_line ->> 'tax_rate')::numeric, (v_line ->> 'line_total')::numeric,
            (v_line ->> 'line_base')::numeric, 0, v_vp.user_id, v_vp.id,
            (v_line ->> 'platform_fee')::numeric, v_rate, v_owner_type, v_owner_id
        ) RETURNING id INTO v_item_id;

        INSERT INTO public.stock_holds (order_id, order_item_id, product_id, variant_id, quantity, expires_at)
        VALUES (v_order_id, v_item_id, (v_line ->> 'product_id')::uuid,
                NULLIF(v_line ->> 'variant_id', '')::uuid, (v_line ->> 'qty')::integer, v_expires);

        IF NULLIF(v_line ->> 'variant_id', '') IS NOT NULL THEN
            UPDATE public.product_variants SET reserved = reserved + (v_line ->> 'qty')::integer
             WHERE id = (v_line ->> 'variant_id')::uuid;
        ELSE
            UPDATE public.products SET reserved = reserved + (v_line ->> 'qty')::integer
             WHERE id = (v_line ->> 'product_id')::uuid;
        END IF;
    END LOOP;

    RETURN public._store_order_summary(v_order_id)
        || jsonb_build_object('idempotent', false, 'pickup_code', v_code,
                              'provider', v_gw ->> 'provider');
END;
$fn$;

COMMENT ON FUNCTION public.create_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, uuid) IS
  'Tienda v2 §6.2 (contrato definitivo): crea orden + ítems + reservas en UNA transacción. Precio/IVA/total de la base. JWT: comprador = auth.uid(); service role: p_buyer_id.';

-- ─── 6. quote_cart (solo lectura, misma calculadora) ─────────────────────────
-- Desviación: agrega p_address (el envío depende del departamento).
CREATE OR REPLACE FUNCTION public.quote_cart(
    p_items       jsonb,
    p_fulfillment text DEFAULT 'pickup',
    p_address     jsonb DEFAULT NULL,
    p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_school_ids uuid[] := CASE WHEN auth.uid() IS NOT NULL THEN public._store_user_school_ids(auth.uid())
                                ELSE '{}'::uuid[] END;
    v_l        record;
    v_amt      record;
    v_lines    jsonb := '[]'::jsonb;
    v_sub      numeric := 0;
    v_tax      numeric := 0;
    v_ship     numeric;
    v_unit     numeric;
    v_avail    integer;
    v_err      text;
    v_vendors  uuid[] := '{}';
    v_dept     text;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 50 THEN
        RAISE EXCEPTION 'INVALID_ITEMS' USING ERRCODE = '22023';
    END IF;

    FOR v_l IN
        WITH raw AS (
            SELECT NULLIF(e ->> 'variant_id', '')::uuid AS variant_id,
                   NULLIF(e ->> 'product_id', '')::uuid AS product_id,
                   CASE WHEN (e ->> 'quantity') ~ '^\s*[0-9]{1,4}\s*$' THEN (e ->> 'quantity')::integer END AS qty
              FROM jsonb_array_elements(p_items) e
        )
        SELECT r.variant_id, COALESCE(pv.product_id, r.product_id) AS product_id, r.qty,
               p.id AS p_id, p.name, p.price, p.tax_rate, p.active, p.status AS p_status,
               p.visibility::text AS visibility, p.school_id AS p_school, p.vendor_profile_id,
               p.stock AS p_stock, p.reserved AS p_reserved,
               pv.id AS v_id, pv.name AS v_name, pv.price_override, pv.stock AS v_stock,
               pv.reserved AS v_reserved, pv.is_active AS v_active,
               EXISTS (SELECT 1 FROM public.product_variants x WHERE x.product_id = p.id) AS has_variants
          FROM raw r
          LEFT JOIN public.product_variants pv ON pv.id = r.variant_id
          LEFT JOIN public.products p ON p.id = COALESCE(pv.product_id, r.product_id)
    LOOP
        v_err := NULL;
        IF v_l.p_id IS NULL OR (v_l.variant_id IS NOT NULL AND v_l.v_id IS NULL) THEN
            v_err := 'PRODUCT_NOT_FOUND';
        ELSIF NOT COALESCE(v_l.active, false) OR v_l.p_status <> 'active' OR v_l.visibility = 'private'
              OR (v_l.visibility = 'school_only'
                  AND (v_l.p_school IS NULL OR NOT (v_l.p_school = ANY (v_school_ids))))
              OR (v_l.variant_id IS NOT NULL AND NOT COALESCE(v_l.v_active, false))
              OR v_l.vendor_profile_id IS NULL OR NOT public.store_seller_allowed(v_l.vendor_profile_id) THEN
            v_err := 'PRODUCT_NOT_AVAILABLE';
        ELSIF v_l.has_variants AND v_l.variant_id IS NULL THEN
            v_err := 'VARIANT_REQUIRED';
        ELSIF v_l.qty IS NULL OR v_l.qty NOT BETWEEN 1 AND 20 THEN
            v_err := 'INVALID_QTY';
        END IF;

        IF v_err IS NOT NULL THEN
            v_lines := v_lines || jsonb_build_object('product_id', v_l.product_id, 'variant_id', v_l.variant_id,
                                                     'quantity', v_l.qty, 'error', v_err);
            CONTINUE;
        END IF;

        v_avail := GREATEST(CASE WHEN v_l.variant_id IS NOT NULL THEN v_l.v_stock - v_l.v_reserved
                                 ELSE v_l.p_stock - v_l.p_reserved END, 0);
        v_unit := COALESCE(v_l.price_override, v_l.price);
        SELECT * INTO v_amt FROM public._store_line_amounts(v_unit, LEAST(v_l.qty, GREATEST(v_avail, 0)), v_l.tax_rate);
        v_vendors := array_append(v_vendors, v_l.vendor_profile_id);
        v_lines := v_lines || jsonb_build_object(
            'product_id', v_l.product_id, 'variant_id', v_l.variant_id,
            'name', v_l.name || COALESCE(' · ' || v_l.v_name, ''),
            'vendor_profile_id', v_l.vendor_profile_id,
            'quantity', v_l.qty, 'available', v_avail,
            'adjusted_quantity', LEAST(v_l.qty, v_avail),
            'unit_price', v_unit, 'tax_rate', public._store_norm_tax_rate(v_l.tax_rate),
            'line_total', v_amt.line_total, 'line_base', v_amt.line_base, 'line_tax', v_amt.line_tax,
            'error', CASE WHEN v_avail = 0 THEN 'OUT_OF_STOCK'
                          WHEN v_avail < v_l.qty THEN 'INSUFFICIENT_STOCK' END);
        v_sub := v_sub + v_amt.line_total;
        v_tax := v_tax + v_amt.line_tax;
    END LOOP;

    IF p_fulfillment = 'shipping' THEN
        v_dept := btrim(COALESCE(p_address ->> 'departamento', p_address ->> 'department', ''));
        SELECT round(z.costo_base) INTO v_ship FROM public.shipping_zones z
         WHERE z.is_active AND lower(btrim(z.departamento)) = lower(v_dept) LIMIT 1;
    ELSE
        v_ship := 0;
    END IF;

    RETURN jsonb_build_object(
        'lines', v_lines,
        'subtotal', v_sub,
        'tax_total', v_tax,
        'shipping', v_ship,
        'shipping_error', CASE WHEN p_fulfillment = 'shipping' AND v_ship IS NULL THEN 'SHIPPING_ZONE_NOT_FOUND' END,
        'discount_total', 0,
        'total', v_sub + COALESCE(v_ship, 0),
        'coupon_error', CASE WHEN NULLIF(btrim(COALESCE(p_coupon_code, '')), '') IS NOT NULL
                             THEN 'COUPONS_NOT_AVAILABLE' END,
        'multiple_sellers', (SELECT count(DISTINCT x) FROM unnest(v_vendors) x) > 1,
        'store_enabled', public.store_enabled()
    );
END;
$fn$;

-- ─── 7. Liquidar una orden pagada (interna) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public._settle_order_paid(
    p_order_id      uuid,
    p_provider      text,      -- wompi | mercadopago | transfer | cash_pickup
    p_tx_id         text,
    p_method_detail text,
    p_actor         uuid,
    p_actor_role    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o      public.orders%ROWTYPE;
    v_l      record;
    v_short  jsonb := '[]'::jsonb;
    v_before integer;
    v_gw     boolean := p_provider IN ('wompi', 'mercadopago');
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_o.id IS NULL THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    PERFORM 1 FROM public.product_variants
     WHERE id IN (SELECT variant_id FROM public.order_items WHERE order_id = p_order_id AND variant_id IS NOT NULL)
     ORDER BY id FOR UPDATE;
    PERFORM 1 FROM public.products
     WHERE id IN (SELECT product_id FROM public.order_items WHERE order_id = p_order_id AND variant_id IS NULL)
     ORDER BY id FOR UPDATE;

    -- ¿Alcanza? Con reserva activa basta stock >= qty; sin reserva (venció o se
    -- liberó) hace falta disponible (stock - reserved) >= qty.
    FOR v_l IN
        SELECT oi.id, oi.product_id, oi.variant_id, oi.quantity,
               h.id AS hold_id,
               COALESCE(v.stock, p.stock) AS stock, COALESCE(v.reserved, p.reserved) AS reserved
          FROM public.order_items oi
          JOIN public.products p ON p.id = oi.product_id
          LEFT JOIN public.product_variants v ON v.id = oi.variant_id
          LEFT JOIN public.stock_holds h ON h.order_item_id = oi.id AND h.status = 'active'
         WHERE oi.order_id = p_order_id
    LOOP
        IF (v_l.hold_id IS NOT NULL AND v_l.stock < v_l.quantity)
           OR (v_l.hold_id IS NULL AND v_l.stock - v_l.reserved < v_l.quantity) THEN
            v_short := v_short || jsonb_build_object('product_id', v_l.product_id, 'variant_id', v_l.variant_id,
                                                     'quantity', v_l.quantity,
                                                     'available', GREATEST(v_l.stock - CASE WHEN v_l.hold_id IS NULL THEN v_l.reserved ELSE 0 END, 0));
        END IF;
    END LOOP;

    PERFORM public._store_set_actor(p_actor_role, p_actor,
                                    CASE WHEN p_tx_id IS NOT NULL THEN p_provider || ' tx=' || p_tx_id END);

    IF jsonb_array_length(v_short) > 0 THEN
        -- Pago tardío sin stock: nunca negativo. Queda para revisión/reembolso.
        UPDATE public.orders
           SET status = 'payment_review',
               requires_review = true,
               last_failure_reason = 'PAID_WITHOUT_STOCK',
               last_failure_at = now(),
               payment_provider = CASE WHEN v_gw THEN public.resolve_payment_provider(p_provider) ELSE payment_provider END,
               provider_transaction_id = CASE WHEN v_gw THEN p_tx_id ELSE provider_transaction_id END,
               wompi_transaction_id = CASE WHEN p_provider = 'wompi' THEN p_tx_id ELSE wompi_transaction_id END,
               payment_method_detail = COALESCE(p_method_detail, payment_method_detail),
               updated_at = now()
         WHERE id = p_order_id;
        RETURN jsonb_build_object('ok', false, 'review', true, 'reason', 'PAID_WITHOUT_STOCK',
                                  'order_id', p_order_id, 'shortages', v_short);
    END IF;

    FOR v_l IN
        SELECT oi.id, oi.product_id, oi.variant_id, oi.quantity, h.id AS hold_id
          FROM public.order_items oi
          LEFT JOIN public.stock_holds h ON h.order_item_id = oi.id AND h.status = 'active'
         WHERE oi.order_id = p_order_id
         ORDER BY oi.variant_id NULLS LAST, oi.product_id
    LOOP
        IF v_l.variant_id IS NOT NULL THEN
            SELECT stock INTO v_before FROM public.product_variants WHERE id = v_l.variant_id;
            UPDATE public.product_variants
               SET stock = stock - v_l.quantity,
                   reserved = CASE WHEN v_l.hold_id IS NOT NULL THEN GREATEST(reserved - v_l.quantity, 0) ELSE reserved END,
                   updated_at = now()
             WHERE id = v_l.variant_id;
        ELSE
            SELECT stock INTO v_before FROM public.products WHERE id = v_l.product_id;
            UPDATE public.products
               SET stock = stock - v_l.quantity,
                   reserved = CASE WHEN v_l.hold_id IS NOT NULL THEN GREATEST(reserved - v_l.quantity, 0) ELSE reserved END,
                   updated_at = now()
             WHERE id = v_l.product_id;
        END IF;
        IF v_l.hold_id IS NOT NULL THEN
            UPDATE public.stock_holds SET status = 'consumed', closed_at = now() WHERE id = v_l.hold_id;
        END IF;

        INSERT INTO public.inventory_logs (product_id, variant_id, vendor_id, delta, stock_before,
                                           stock_after, reason, order_id, created_by, note)
        VALUES (v_l.product_id, v_l.variant_id,
                (SELECT vendor_id FROM public.products WHERE id = v_l.product_id),
                -v_l.quantity, v_before, v_before - v_l.quantity, 'order_paid', p_order_id,
                (SELECT u.id FROM auth.users u WHERE u.id = p_actor),
                'Venta ' || COALESCE(v_o.reference, p_order_id::text));
    END LOOP;

    UPDATE public.orders
       SET status = 'paid',
           paid_at = now(),
           payment_provider = CASE WHEN v_gw THEN public.resolve_payment_provider(p_provider) ELSE payment_provider END,
           provider_transaction_id = CASE WHEN v_gw THEN p_tx_id ELSE provider_transaction_id END,
           wompi_transaction_id = CASE WHEN p_provider = 'wompi' THEN p_tx_id ELSE wompi_transaction_id END,
           payment_method_detail = COALESCE(p_method_detail, payment_method_detail),
           approved_by = CASE WHEN NOT v_gw THEN (SELECT p.id FROM public.profiles p WHERE p.id = p_actor)
                              ELSE approved_by END,
           approved_at = CASE WHEN NOT v_gw THEN now() ELSE approved_at END,
           requires_review = false,
           last_failure_reason = CASE WHEN last_failure_reason = 'PAID_WITHOUT_STOCK' THEN NULL ELSE last_failure_reason END,
           updated_at = now()
     WHERE id = p_order_id;

    PERFORM public.compute_settlements_for_order(p_order_id);
    PERFORM public._store_emit_order_events(p_order_id, 'sale');

    RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', 'paid',
                              'provider', p_provider, 'reference', v_o.reference);
END;
$fn$;

-- ─── 8. confirm_order_payment: una sola firma (T8) ───────────────────────────
DROP FUNCTION IF EXISTS public.confirm_order_payment(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.confirm_order_payment(
    p_order_id uuid, p_wompi_reference text, p_wompi_transaction_id text,
    p_payment_method_type text DEFAULT 'CARD'::text, p_provider text DEFAULT 'wompi'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_provider text := public.resolve_payment_provider(p_provider)::text;
    v_o        public.orders%ROWTYPE;
BEGIN
    IF p_wompi_transaction_id IS NULL OR btrim(p_wompi_transaction_id) = '' THEN
        RAISE EXCEPTION 'TX_ID_REQUIRED' USING ERRCODE = '22023';
    END IF;

    -- FOR UPDATE: un webhook duplicado o concurrente espera y luego ve 'paid'
    -- con el mismo tx → idempotente (C4/R23).
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_o.id IS NULL THEN
        RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_o.status NOT IN ('pending_payment', 'awaiting_approval', 'payment_review', 'expired', 'cancelled') THEN
        IF v_o.provider_transaction_id = p_wompi_transaction_id
           OR (v_provider = 'wompi' AND v_o.wompi_transaction_id = p_wompi_transaction_id) THEN
            RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order_id', v_o.id, 'status', v_o.status);
        END IF;
        -- Pagada con OTRA transacción: posible doble cobro. No se toca el stock.
        PERFORM public._store_set_actor('webhook', NULL, 'segundo pago ' || v_provider || ' tx=' || p_wompi_transaction_id);
        UPDATE public.orders
           SET requires_review = true,
               last_failure_reason = 'DUPLICATE_PAYMENT ' || v_provider || ' tx=' || p_wompi_transaction_id,
               last_failure_at = now(), updated_at = now()
         WHERE id = v_o.id;
        RETURN jsonb_build_object('ok', false, 'review', true, 'reason', 'ALREADY_PAID', 'order_id', v_o.id);
    END IF;

    IF v_o.payment_method IS NOT NULL AND v_o.payment_method <> v_provider THEN
        UPDATE public.orders
           SET requires_review = true,
               last_failure_reason = 'METHOD_MISMATCH ' || v_provider || ' tx=' || p_wompi_transaction_id,
               last_failure_at = now(), updated_at = now()
         WHERE id = v_o.id;
        RETURN jsonb_build_object('ok', false, 'review', true, 'reason', 'METHOD_MISMATCH', 'order_id', v_o.id);
    END IF;

    UPDATE public.orders
       SET provider_reference = COALESCE(provider_reference, p_wompi_reference),
           wompi_reference = CASE WHEN v_provider = 'wompi' THEN COALESCE(wompi_reference, p_wompi_reference)
                                  ELSE wompi_reference END
     WHERE id = v_o.id;

    RETURN public._settle_order_paid(v_o.id, v_provider, p_wompi_transaction_id, p_payment_method_type,
                                     NULL, 'webhook');
END;
$fn$;

COMMENT ON FUNCTION public.confirm_order_payment(uuid, text, text, text, text) IS
  'Tienda v2 M-F0-4: confirma el pago de pasarela (solo service_role, desde el webhook ya verificado). Idempotente por transacción; sin stock → payment_review.';

-- Pago de pasarela NO aprobado (webhook). Reemplaza el UPDATE directo del BFF,
-- que dejaba la reserva colgada (reserved nunca bajaba). Solo service_role.
--   rejected/failed sobre una orden que espera pago → libera reservas + cancelled.
--   refunded (anulación de la pasarela) sobre una orden cobrada → NO cambia
--   estado: marca revisión (el reembolso real va por complete_refund, que
--   repone stock y reversa settlements una sola vez).
--   pending → solo deja rastro de la transacción.
CREATE OR REPLACE FUNCTION public.store_order_payment_failed(
    p_order_id uuid, p_provider text, p_tx_id text, p_status text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o      public.orders%ROWTYPE;
    v_prov   text := public.resolve_payment_provider(p_provider)::text;
    v_action text := 'none';
BEGIN
    IF p_status NOT IN ('rejected', 'failed', 'refunded', 'pending') THEN
        RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_o.id IS NULL THEN
        RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
    END IF;

    -- Nunca pisa la transacción de un pago ya confirmado.
    IF v_o.status IN ('pending_payment', 'expired', 'cancelled') THEN
        UPDATE public.orders
           SET provider_transaction_id = COALESCE(p_tx_id, provider_transaction_id),
               wompi_transaction_id = CASE WHEN v_prov = 'wompi' THEN COALESCE(p_tx_id, wompi_transaction_id)
                                           ELSE wompi_transaction_id END,
               updated_at = now()
         WHERE id = p_order_id;
    END IF;

    IF p_status IN ('rejected', 'failed') OR (p_status = 'refunded' AND v_o.status = 'pending_payment') THEN
        IF v_o.status = 'pending_payment' THEN
            PERFORM public._store_release_holds(p_order_id, 'released');
            PERFORM public._store_set_actor('webhook', NULL, left(COALESCE(p_reason, v_prov || '_' || p_status), 500));
            UPDATE public.orders
               SET status = 'cancelled', last_failure_reason = left(COALESCE(p_reason, v_prov || '_' || p_status), 500),
                   last_failure_at = now(), updated_at = now()
             WHERE id = p_order_id;
            v_action := 'cancelled';
        END IF;
    ELSIF p_status = 'refunded' AND v_o.status IN ('paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered') THEN
        UPDATE public.orders
           SET requires_review = true,
               last_failure_reason = left('GATEWAY_VOID ' || v_prov || ' tx=' || COALESCE(p_tx_id, '?'), 500),
               last_failure_at = now(), updated_at = now()
         WHERE id = p_order_id;
        v_action := 'flagged';
    END IF;

    RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'action', v_action,
                              'status', (SELECT status FROM public.orders WHERE id = p_order_id));
END;
$fn$;

-- ─── 9. Transferencia con comprobante ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_order_receipt(p_order_id uuid, p_receipt_path text, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_o     public.orders%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_o.id IS NULL OR v_o.user_id IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_o.payment_method IS DISTINCT FROM 'transfer' THEN
        RAISE EXCEPTION 'NOT_A_TRANSFER_ORDER' USING ERRCODE = 'P0001';
    END IF;
    IF v_o.status NOT IN ('pending_payment', 'awaiting_approval') THEN
        RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE = 'P0001', DETAIL = v_o.status;
    END IF;
    IF v_o.status = 'pending_payment' AND v_o.expires_at IS NOT NULL AND v_o.expires_at < now() THEN
        RAISE EXCEPTION 'ORDER_EXPIRED' USING ERRCODE = 'P0001';
    END IF;
    -- El archivo vive en el bucket privado order-receipts, bajo la carpeta de la orden.
    IF p_receipt_path IS NULL OR p_receipt_path !~ ('^' || p_order_id::text || '/[A-Za-z0-9._-]{1,120}$') THEN
        RAISE EXCEPTION 'INVALID_RECEIPT_PATH' USING ERRCODE = '22023',
              HINT = 'Ruta esperada: {order_id}/{archivo} en el bucket order-receipts.';
    END IF;

    PERFORM public._store_set_actor('buyer', v_actor, 'comprobante enviado');
    UPDATE public.orders
       SET status = 'awaiting_approval',
           receipt_path = p_receipt_path,
           receipt_submitted_at = now(),
           rejection_reason = NULL,
           updated_at = now()
     WHERE id = p_order_id;

    RETURN public._store_order_summary(p_order_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.approve_order_receipt(p_order_id uuid, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_o     public.orders%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_o.id IS NULL OR NOT public.can_manage_store_as(v_o.vendor_profile_id, v_actor) THEN
        RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
    END IF;
    IF v_o.status = 'paid' AND v_o.approved_by IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order_id', p_order_id, 'status', 'paid');
    END IF;
    IF v_o.status <> 'awaiting_approval' OR v_o.payment_method IS DISTINCT FROM 'transfer' THEN
        RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE = 'P0001', DETAIL = v_o.status;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor) THEN
        RAISE EXCEPTION 'ACTOR_WITHOUT_PROFILE' USING ERRCODE = '42501';
    END IF;
    RETURN public._settle_order_paid(p_order_id, 'transfer', NULL, 'transfer_receipt', v_actor,
                                     CASE WHEN public.can_manage_store_as(v_o.vendor_profile_id, v_actor)
                                               AND EXISTS (SELECT 1 FROM public.platform_admins pa
                                                            WHERE pa.profile_id = v_actor AND pa.is_active)
                                          THEN 'admin' ELSE 'seller' END);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reject_order_receipt(p_order_id uuid, p_reason text, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_o     public.orders%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
        RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_o.id IS NULL OR NOT public.can_manage_store_as(v_o.vendor_profile_id, v_actor) THEN
        RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
    END IF;
    IF v_o.status <> 'awaiting_approval' THEN
        RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE = 'P0001', DETAIL = v_o.status;
    END IF;

    -- Vuelve a esperar pago; si la reserva venció durante la revisión, el
    -- comprador tiene 24 h para subir otro comprobante (provisional).
    PERFORM public._store_set_actor('seller', v_actor, left(btrim(p_reason), 500));
    UPDATE public.orders
       SET status = 'pending_payment',
           rejection_reason = left(btrim(p_reason), 500),
           expires_at = GREATEST(COALESCE(expires_at, now()), now() + interval '24 hours'),
           updated_at = now()
     WHERE id = p_order_id;
    UPDATE public.stock_holds
       SET expires_at = GREATEST(expires_at, now() + interval '24 hours')
     WHERE order_id = p_order_id AND status = 'active';

    RETURN public._store_order_summary(p_order_id) || jsonb_build_object('rejection_reason', left(btrim(p_reason), 500));
END;
$fn$;

-- ─── 10. Efectivo al retirar ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_cash_pickup(p_order_id uuid, p_pickup_code text, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_o     public.orders%ROWTYPE;
    v_res   jsonb;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_o.id IS NULL OR NOT public.can_manage_store_as(v_o.vendor_profile_id, v_actor) THEN
        RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
    END IF;
    IF v_o.payment_method IS DISTINCT FROM 'cash_pickup' THEN
        RAISE EXCEPTION 'NOT_A_CASH_ORDER' USING ERRCODE = 'P0001';
    END IF;
    IF v_o.status NOT IN ('pending_payment', 'expired') THEN
        RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE = 'P0001', DETAIL = v_o.status;
    END IF;
    IF v_o.pickup_code_hash IS NULL
       OR p_pickup_code IS NULL
       OR encode(sha256(convert_to(btrim(p_pickup_code) || ':' || v_o.id::text, 'UTF8')), 'hex') <> v_o.pickup_code_hash THEN
        RAISE EXCEPTION 'INVALID_PICKUP_CODE' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor) THEN
        RAISE EXCEPTION 'ACTOR_WITHOUT_PROFILE' USING ERRCODE = '42501';
    END IF;

    v_res := public._settle_order_paid(p_order_id, 'cash_pickup', NULL, 'cash', v_actor, 'seller');
    IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
        RETURN v_res;
    END IF;

    PERFORM public._store_set_actor('seller', v_actor, 'entregado y cobrado en efectivo');
    UPDATE public.orders SET status = 'delivered', updated_at = now() WHERE id = p_order_id;

    RETURN public._store_order_summary(p_order_id);
END;
$fn$;

-- ─── 11. Cancelar / transiciones / vencer ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_my_order(p_order_id uuid, p_reason text DEFAULT NULL, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_o     public.orders%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_o.id IS NULL OR v_o.user_id IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_o.status NOT IN ('pending_payment', 'awaiting_approval') THEN
        RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE = 'P0001', DETAIL = v_o.status;
    END IF;
    PERFORM public._store_release_holds(p_order_id, 'released');
    PERFORM public._store_set_actor('buyer', v_actor, COALESCE(NULLIF(btrim(p_reason), ''), 'cancelada por el comprador'));
    UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = p_order_id;
    RETURN public._store_order_summary(p_order_id);
END;
$fn$;

-- Matriz por actor (§2.6). Pagar / reembolsar NO van por acá.
CREATE OR REPLACE FUNCTION public.order_transition(
    p_order_id uuid, p_to text, p_note text DEFAULT NULL, p_tracking jsonb DEFAULT NULL, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor   uuid := public._store_actor(p_actor);
    v_o       public.orders%ROWTYPE;
    v_admin   boolean;
    v_seller  boolean;
    v_buyer   boolean;
    v_role    text;
    v_ok      boolean := false;
    v_code    text := NULLIF(btrim(COALESCE(p_tracking ->> 'pickup_code', '')), '');
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_o.id IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    v_admin  := EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.profile_id = v_actor AND pa.is_active);
    v_seller := public.can_manage_store_as(v_o.vendor_profile_id, v_actor);
    v_buyer  := v_o.user_id = v_actor;
    IF NOT (v_admin OR v_seller OR v_buyer) THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF p_to IS NULL OR p_to NOT IN ('pending_payment','awaiting_approval','payment_review','paid','preparing',
                                    'ready_for_pickup','shipped','delivered','expired','cancelled',
                                    'refunded','partially_refunded') THEN
        RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = '22023';
    END IF;

    -- Mismo estado: solo actualiza la guía.
    IF p_to = v_o.status THEN
        IF (v_seller OR v_admin) AND p_tracking IS NOT NULL THEN
            UPDATE public.orders
               SET tracking_number = COALESCE(NULLIF(p_tracking ->> 'tracking_number', ''), tracking_number),
                   shipping_carrier = COALESCE(NULLIF(p_tracking ->> 'carrier', ''), shipping_carrier),
                   updated_at = now()
             WHERE id = p_order_id;
        END IF;
        RETURN public._store_order_summary(p_order_id) || jsonb_build_object('changed', false);
    END IF;

    IF v_seller OR v_admin THEN
        v_role := CASE WHEN v_seller THEN 'seller' ELSE 'admin' END;
        v_ok := (v_o.status, p_to) IN (
                    ('paid', 'preparing'),
                    ('preparing', 'ready_for_pickup'),
                    ('preparing', 'shipped'),
                    ('ready_for_pickup', 'delivered'),
                    ('shipped', 'delivered'),
                    ('pending_payment', 'cancelled'),
                    ('awaiting_approval', 'cancelled'))
             OR (v_admin AND (v_o.status, p_to) IN (('payment_review', 'cancelled')));
        IF v_ok AND p_to = 'ready_for_pickup' AND v_o.fulfillment_mode = 'shipping' THEN v_ok := false; END IF;
        IF v_ok AND p_to = 'shipped' AND v_o.fulfillment_mode = 'pickup' THEN v_ok := false; END IF;
    END IF;
    IF NOT v_ok AND v_buyer THEN
        v_role := 'buyer';
        v_ok := (v_o.status, p_to) IN (('shipped', 'delivered'),
                                      ('pending_payment', 'cancelled'),
                                      ('awaiting_approval', 'cancelled'));
    END IF;
    IF NOT v_ok THEN
        RAISE EXCEPTION 'TRANSITION_NOT_ALLOWED' USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object('from', v_o.status, 'to', p_to)::text;
    END IF;

    -- Retiro en sede: el vendedor entrega con el código del comprador (el admin de plataforma no).
    IF v_o.status = 'ready_for_pickup' AND p_to = 'delivered' AND v_role = 'seller'
       AND v_o.pickup_code_hash IS NOT NULL
       AND (v_code IS NULL
            OR encode(sha256(convert_to(v_code || ':' || v_o.id::text, 'UTF8')), 'hex') <> v_o.pickup_code_hash) THEN
        RAISE EXCEPTION 'INVALID_PICKUP_CODE' USING ERRCODE = '42501';
    END IF;

    IF p_to = 'cancelled' THEN
        PERFORM public._store_release_holds(p_order_id, 'released');
    END IF;

    PERFORM public._store_set_actor(v_role, v_actor, NULLIF(btrim(COALESCE(p_note, '')), ''));
    UPDATE public.orders
       SET status = p_to,
           tracking_number = COALESCE(NULLIF(p_tracking ->> 'tracking_number', ''), tracking_number),
           shipping_carrier = COALESCE(NULLIF(p_tracking ->> 'carrier', ''), shipping_carrier),
           vendor_notes = CASE WHEN v_role IN ('seller', 'admin') AND NULLIF(btrim(COALESCE(p_note, '')), '') IS NOT NULL
                               THEN left(btrim(p_note), 1000) ELSE vendor_notes END,
           updated_at = now()
     WHERE id = p_order_id;

    RETURN public._store_order_summary(p_order_id) || jsonb_build_object('changed', true, 'actor_role', v_role);
END;
$fn$;

-- Cron: vence reservas de órdenes que siguen esperando pago. awaiting_approval
-- (comprobante en revisión) NO vence (D-18). SKIP LOCKED: si un webhook está
-- confirmando esa orden, este ciclo la salta (C6: o consume o libera).
CREATE OR REPLACE FUNCTION public.release_expired_holds()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_id uuid;
    v_n  integer := 0;
BEGIN
    FOR v_id IN
        SELECT o.id FROM public.orders o
         WHERE o.status = 'pending_payment' AND o.expires_at IS NOT NULL AND o.expires_at < now()
         ORDER BY o.expires_at
         LIMIT 500
         FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM public._store_release_holds(v_id, 'expired');
        PERFORM public._store_set_actor('system', NULL, 'reserva vencida');
        UPDATE public.orders SET status = 'expired', updated_at = now() WHERE id = v_id;
        v_n := v_n + 1;
    END LOOP;
    RETURN jsonb_build_object('expired_orders', v_n);
END;
$fn$;

-- ─── 12. Bucket privado de comprobantes ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('order-receipts', 'order-receipts', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- ¿Puede la sesión escribir/leer este objeto? Primer segmento = order_id.
CREATE OR REPLACE FUNCTION public.order_receipt_object_access(p_name text, p_write boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_seg text := (storage.foldername(p_name))[1];
    v_o   record;
BEGIN
    IF auth.uid() IS NULL OR v_seg IS NULL
       OR v_seg !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN false;
    END IF;
    SELECT id, user_id, vendor_profile_id, status, payment_method INTO v_o
      FROM public.orders WHERE id = v_seg::uuid;
    IF v_o.id IS NULL THEN
        RETURN false;
    END IF;
    IF p_write THEN
        RETURN v_o.user_id = auth.uid() AND v_o.payment_method = 'transfer'
           AND v_o.status IN ('pending_payment', 'awaiting_approval');
    END IF;
    RETURN v_o.user_id = auth.uid() OR public.can_manage_store(v_o.vendor_profile_id) OR public.is_super_admin();
END;
$fn$;

DROP POLICY IF EXISTS order_receipts_insert_buyer ON storage.objects;
CREATE POLICY order_receipts_insert_buyer ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'order-receipts' AND public.order_receipt_object_access(name, true));

DROP POLICY IF EXISTS order_receipts_select ON storage.objects;
CREATE POLICY order_receipts_select ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'order-receipts' AND public.order_receipt_object_access(name, false));
-- Sin UPDATE/DELETE: el comprobante es evidencia.

-- ─── 13. pg_cron (si existe; el gemelo local no lo tiene) ───────────────────
DO $cron$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        EXECUTE $q$SELECT cron.schedule('store-release-expired-holds', '* * * * *',
                                        'SELECT public.release_expired_holds()')$q$;
    ELSE
        RAISE NOTICE 'pg_cron no instalado: release_expired_holds() queda sin programar';
    END IF;
END
$cron$;

-- ─── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public._store_norm_tax_rate(numeric)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_line_amounts(numeric, integer, numeric)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_commission_rate(uuid)                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_user_school_ids(uuid)                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_set_actor(text, uuid, text)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_orders_status_history()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_checkout_gateway(uuid, text)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_emit_order_events(uuid, text)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_order_summary(uuid)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_release_holds(uuid, text)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._settle_order_paid(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quote_cart(jsonb, text, jsonb, text)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_order_payment_failed(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_order_receipt(uuid, text, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_order_receipt(uuid, uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_order_receipt(uuid, text, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_cash_pickup(uuid, text, uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_my_order(uuid, text, uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_transition(uuid, text, text, jsonb, uuid)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_expired_holds()                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_receipt_object_access(text, boolean)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_store_reserved_from_client()                  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.quote_cart(jsonb, text, jsonb, text)            TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_order_payment_failed(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_order_receipt(uuid, text, uuid)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_order_receipt(uuid, uuid)               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_order_receipt(uuid, text, uuid)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_cash_pickup(uuid, text, uuid)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_my_order(uuid, text, uuid)               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.order_transition(uuid, text, text, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_holds()                         TO service_role;
GRANT EXECUTE ON FUNCTION public.order_receipt_object_access(text, boolean)      TO authenticated, service_role;

COMMIT;
