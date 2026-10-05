-- =====================================================================
-- PASO 3 — Tienda v2 (apagada) + estado de plantillas de WhatsApp
-- Generado 2026-10-04. Pegar COMPLETO en el SQL Editor de Supabase y Run.
-- Cada migración trae su propio BEGIN/COMMIT: si una falla, las anteriores
-- quedan aplicadas y registradas; corregir y seguir desde la que falló.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 20261003230007_tienda_v2_motor_orden.sql
-- ─────────────────────────────────────────────────────────────────────
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

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003230007', '20261003230007_tienda_v2_motor_orden', 'sql-editor 2026-10-04') on conflict (version) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 20261003230011_tienda_v2_settlements_unico.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261003230011_tienda_v2_settlements_unico.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003230007
-- Objetivo: M-F0-5 de docs/specs/tienda-v2-f0-plan-migraciones.md. Hoy corren
--   DOS motores en cada pago (T7): split_order_payment (vendor_payouts por
--   orden, 5 % + 2,65 % sobre subtotal+IVA) y compute_settlements_for_order
--   (agrupa por vendor_id, sin redondeo, acredita saldo "por pagar al
--   vendedor"). Y release_settlements_for_vendor suma TODO lo que esté en
--   'processing', no solo lo recién liberado → una segunda llamada duplica el
--   saldo (T22).
--
--   1. settlements.status: enum settlement_status → text + CHECK (lección de
--      payments.status) con 'reversed'. collected_by ('seller'|'platform'),
--      payout_id, discount_amount, commission_rate (foto),
--      gateway_fee_estimated. Un settlement por ítem (UNIQUE order_item_id).
--   2. vendor_balances.commission_due: comisión que el vendedor le debe a
--      SportMaps cuando él cobra (collected_by='seller').
--   3. compute_settlements_for_order reescrita: por ítem, pesos enteros,
--      idempotente, comisión de la foto de order_items.commission_rate.
--      collected_by='seller' NO toca available/pending_balance.
--   4. release_settlements_for_vendor: suma solo las filas que liberó esta
--      llamada (T22) y solo collected_by='platform'.
--   5. _store_reverse_settlements(order): reverso al reembolso total.
--   6. vendor_payouts.kind ('order'|'batch') reemplaza CHECK one_origin.
--   7. split_order_payment queda NO-OP (mismo contrato, no crea payouts) para
--      que el BFF desplegado deje de correr el segundo motor desde ya; se
--      revoca admin_generate_pending_payouts a authenticated. DROP de ambas
--      en M-F0-9 (después del deploy del BFF).
--
--   DECISIONES PROVISIONALES (2026-10-03):
--   · D-5 = A: todo settlement nuevo nace collected_by='seller' (el vendedor
--     cobró con sus llaves). La comisión queda "adeudada" en
--     vendor_balances.commission_due; no se descuenta de ningún payout.
--   · D-3: comisión 0 % tienda escolar; externo commission_rate (foto).
--   · gateway_fee = ESTIMADO (platform_config.gateway_fee_rate sobre el bruto
--     del ítem; transferencia/efectivo = 0), gateway_fee_estimated=true. El
--     fee real de Wompi/MP queda para cuando el webhook lo traiga.
--   · Reembolso parcial: no reversa settlements (abierto: prorrateo).
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
    IF to_regclass('public.stock_holds') IS NULL THEN
        RAISE EXCEPTION 'Falta M-F0-4 (20261003230007): aplicarla antes.';
    END IF;
END
$pre$;

-- ─── 1. settlements ──────────────────────────────────────────────────────────
ALTER TABLE public.settlements ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.settlements ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.settlements ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.settlements
    ADD CONSTRAINT settlements_status_check
        CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'reversed'));

ALTER TABLE public.settlements
    ADD COLUMN IF NOT EXISTS collected_by          text NOT NULL DEFAULT 'seller',
    ADD COLUMN IF NOT EXISTS payout_id             uuid REFERENCES public.vendor_payouts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS discount_amount       numeric(12,0) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS commission_rate       numeric(5,4),
    ADD COLUMN IF NOT EXISTS gateway_fee_estimated boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS reversed_at           timestamptz;
ALTER TABLE public.settlements
    ADD CONSTRAINT settlements_collected_by_check CHECK (collected_by IN ('seller', 'platform'));

CREATE UNIQUE INDEX IF NOT EXISTS settlements_order_item_uniq
    ON public.settlements (order_item_id) WHERE order_item_id IS NOT NULL;

COMMENT ON COLUMN public.settlements.collected_by IS
  'Quién cobró la venta. seller (D-5 = A): el vendedor cobró con sus llaves y platform_fee es comisión ADEUDADA a SportMaps. platform: SportMaps recaudó y le debe net al vendedor.';

-- ─── 2. vendor_balances.commission_due ───────────────────────────────────────
ALTER TABLE public.vendor_balances
    ADD COLUMN IF NOT EXISTS commission_due numeric(14,0) NOT NULL DEFAULT 0;
ALTER TABLE public.vendor_balances
    ADD CONSTRAINT vendor_balances_commission_due_nonneg CHECK (commission_due >= 0);

COMMENT ON COLUMN public.vendor_balances.commission_due IS
  'Comisión que el vendedor le debe a SportMaps por ventas que cobró él (Σ platform_fee de settlements collected_by=seller no reversados).';

-- ─── 3. Un solo motor ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_settlements_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o        record;
    v_it       record;
    v_gw_rate  numeric := 0;
    v_rate     numeric;
    v_gross    numeric;
    v_fee      numeric;
    v_gwfee    numeric;
    v_net      numeric;
    v_id       uuid;
    v_count    integer := 0;
    v_total    numeric := 0;
    v_collect  text := 'seller';   -- D-5 = A (provisional)
BEGIN
    SELECT id, status, payment_method INTO v_o FROM public.orders WHERE id = p_order_id;
    IF v_o.id IS NULL THEN
        RETURN jsonb_build_object('error', 'order_not_found');
    END IF;

    IF v_o.payment_method IN ('wompi', 'mercadopago') THEN
        SELECT COALESCE((value ->> v_o.payment_method)::numeric, 0) INTO v_gw_rate
          FROM public.platform_config WHERE key = 'gateway_fee_rate';
        v_gw_rate := COALESCE(v_gw_rate, 0);
    END IF;

    FOR v_it IN
        SELECT oi.id, oi.vendor_profile_id,
               COALESCE(oi.line_total, round(oi.unit_price * oi.quantity)) AS gross,
               COALESCE(oi.line_total - oi.line_base, oi.tax_amount, 0)    AS tax,
               COALESCE(oi.discount_amount, 0)                             AS disc,
               oi.commission_rate
          FROM public.order_items oi
         WHERE oi.order_id = p_order_id AND oi.vendor_profile_id IS NOT NULL
         ORDER BY oi.id
    LOOP
        v_rate  := COALESCE(v_it.commission_rate, public._store_commission_rate(v_it.vendor_profile_id), 0);
        v_gross := round(v_it.gross);
        v_fee   := round(v_gross * v_rate);
        v_gwfee := round(v_gross * v_gw_rate);
        v_net   := GREATEST(v_gross - v_fee - v_gwfee, 0);

        INSERT INTO public.settlements (
            vendor_profile_id, order_id, order_item_id, gross_amount, platform_fee, gateway_fee,
            tax_amount, net_amount, status, collected_by, discount_amount, commission_rate,
            gateway_fee_estimated
        ) VALUES (
            v_it.vendor_profile_id, p_order_id, v_it.id, v_gross, v_fee, v_gwfee,
            round(v_it.tax), v_net, 'pending', v_collect, round(v_it.disc), v_rate, true
        )
        ON CONFLICT (order_item_id) WHERE order_item_id IS NOT NULL DO NOTHING
        RETURNING id INTO v_id;

        IF v_id IS NULL THEN
            CONTINUE;   -- ya liquidado (idempotente)
        END IF;

        INSERT INTO public.vendor_balances (vendor_profile_id) VALUES (v_it.vendor_profile_id)
        ON CONFLICT (vendor_profile_id) DO NOTHING;

        IF v_collect = 'seller' THEN
            UPDATE public.vendor_balances
               SET commission_due = commission_due + v_fee,
                   total_earned   = total_earned + v_gross,
                   total_fees     = total_fees + v_fee + v_gwfee,
                   updated_at     = now()
             WHERE vendor_profile_id = v_it.vendor_profile_id;
        ELSE
            UPDATE public.vendor_balances
               SET pending_balance = pending_balance + v_net,
                   total_earned    = total_earned + v_gross,
                   total_fees      = total_fees + v_fee + v_gwfee,
                   updated_at      = now()
             WHERE vendor_profile_id = v_it.vendor_profile_id;
        END IF;

        v_count := v_count + 1;
        v_total := v_total + v_net;
    END LOOP;

    RETURN jsonb_build_object('settlements_created', v_count, 'total_net_amount', v_total,
                              'collected_by', v_collect);
END;
$fn$;

COMMENT ON FUNCTION public.compute_settlements_for_order(uuid) IS
  'Tienda v2 M-F0-5: UN motor. Un settlement por ítem, pesos enteros, idempotente. collected_by=seller (D-5 = A) acumula commission_due.';

-- ─── 4. Liberación sin duplicar (T22) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_settlements_for_vendor(p_vendor_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_physical integer;
    v_digital  integer;
    v_service  integer;
    v_count    integer := 0;
    v_net      numeric := 0;
BEGIN
    SELECT (value ->> 'physical')::int, (value ->> 'digital')::int, (value ->> 'service')::int
      INTO v_physical, v_digital, v_service
      FROM public.platform_config WHERE key = 'escrow_release_days';
    v_physical := COALESCE(v_physical, 7);
    v_digital  := COALESCE(v_digital, 1);
    v_service  := COALESCE(v_service, 1);

    WITH eligible AS (
        SELECT s.id
          FROM public.settlements s
          JOIN public.orders o ON o.id = s.order_id
         WHERE s.vendor_profile_id = p_vendor_profile_id
           AND s.status = 'pending'
           AND s.collected_by = 'platform'
           AND o.status = 'delivered'
           AND o.updated_at <= now() - make_interval(days =>
                 CASE COALESCE(o.fulfillment_type::text, 'physical')
                     WHEN 'digital' THEN v_digital
                     WHEN 'service' THEN v_service
                     ELSE v_physical END)
         FOR UPDATE OF s
    ), upd AS (
        UPDATE public.settlements s
           SET status = 'processing', updated_at = now()
          FROM eligible e
         WHERE s.id = e.id
        RETURNING s.net_amount
    )
    SELECT count(*), COALESCE(sum(net_amount), 0) INTO v_count, v_net FROM upd;

    IF v_count > 0 THEN
        UPDATE public.vendor_balances
           SET pending_balance   = GREATEST(pending_balance - v_net, 0),
               available_balance = available_balance + v_net,
               updated_at        = now()
         WHERE vendor_profile_id = p_vendor_profile_id;
    END IF;

    RETURN jsonb_build_object('released_count', v_count, 'released_amount', v_net);
END;
$fn$;

-- ─── 5. Reverso al reembolso total ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._store_reverse_settlements(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_s   record;
    v_n   integer := 0;
BEGIN
    FOR v_s IN
        UPDATE public.settlements
           SET status = 'reversed', reversed_at = now(), updated_at = now()
         WHERE order_id = p_order_id AND status IN ('pending', 'processing')
        RETURNING vendor_profile_id, collected_by, gross_amount, platform_fee, gateway_fee, net_amount, status
    LOOP
        IF v_s.collected_by = 'seller' THEN
            UPDATE public.vendor_balances
               SET commission_due = GREATEST(commission_due - v_s.platform_fee, 0),
                   total_earned   = GREATEST(total_earned - v_s.gross_amount, 0),
                   total_fees     = GREATEST(total_fees - v_s.platform_fee - v_s.gateway_fee, 0),
                   updated_at     = now()
             WHERE vendor_profile_id = v_s.vendor_profile_id;
        ELSE
            UPDATE public.vendor_balances
               SET pending_balance = GREATEST(pending_balance - v_s.net_amount, 0),
                   total_earned    = GREATEST(total_earned - v_s.gross_amount, 0),
                   total_fees      = GREATEST(total_fees - v_s.platform_fee - v_s.gateway_fee, 0),
                   updated_at      = now()
             WHERE vendor_profile_id = v_s.vendor_profile_id;
        END IF;
        v_n := v_n + 1;
    END LOOP;
    RETURN jsonb_build_object('reversed', v_n);
END;
$fn$;

-- ─── 6. vendor_payouts por lote ──────────────────────────────────────────────
ALTER TABLE public.vendor_payouts
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'order';
ALTER TABLE public.vendor_payouts DROP CONSTRAINT IF EXISTS one_origin;
ALTER TABLE public.vendor_payouts
    ADD CONSTRAINT vendor_payouts_kind_check CHECK (kind IN ('order', 'batch')),
    ADD CONSTRAINT vendor_payouts_origin_check CHECK (
        (kind = 'order' AND ((order_id IS NOT NULL)::int + (transaction_id IS NOT NULL)::int) = 1)
     OR (kind = 'batch' AND order_id IS NULL AND transaction_id IS NULL));

-- ─── 7. Segundo motor apagado ────────────────────────────────────────────────
-- Mismo contrato que la viva (el BFF desplegado la sigue llamando hasta su
-- deploy): ya no crea vendor_payouts. DROP en M-F0-9.
CREATE OR REPLACE FUNCTION public.split_order_payment(
    p_order_id uuid, p_sportmaps_fee_pct numeric DEFAULT 5.0,
    p_provider_fee_pct numeric DEFAULT NULL::numeric, p_provider text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'payouts_created', 0,
                              'order_id', p_order_id, 'reason', 'single_engine_compute_settlements');
END;
$fn$;

REVOKE ALL ON FUNCTION public.split_order_payment(uuid, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.split_order_payment(uuid, numeric, numeric, text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_generate_pending_payouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_generate_pending_payouts() TO service_role;

REVOKE ALL ON FUNCTION public.compute_settlements_for_order(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_settlements_for_vendor(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_reverse_settlements(uuid)      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_settlements_for_order(uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_settlements_for_vendor(uuid) TO service_role;

-- Lectura de settlements por quien administra la tienda (admins de la escuela
-- incluidos), además del dueño legacy. Sin escritura del cliente.
DROP POLICY IF EXISTS settlements_select_store ON public.settlements;
CREATE POLICY settlements_select_store ON public.settlements
    FOR SELECT TO authenticated
    USING (public.can_manage_store(vendor_profile_id));
REVOKE INSERT, UPDATE, DELETE ON public.settlements, public.vendor_balances, public.vendor_payouts FROM anon, authenticated;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003230011', '20261003230011_tienda_v2_settlements_unico', 'sql-editor 2026-10-04') on conflict (version) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 20261003230013_tienda_v2_pasarela_y_metodos_del_vendedor.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261003230013_tienda_v2_pasarela_y_metodos_del_vendedor.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003230011
-- Objetivo: M-F0-7 de docs/specs/tienda-v2-f0-plan-migraciones.md. Hoy una
--   venta de tienda por Wompi cae en la cuenta de Dynasty (las llaves ENV del
--   BFF, §1.5 del plan) y el checkout muestra una cuenta bancaria inventada
--   (B2 del informe docs/qa/tienda-baseline-padre-2026-10-03.md).
--
--   1. store_payment_settings: qué medios acepta cada vendedor y por cuánto
--      reserva (transferencia / efectivo). Escritura solo por RPC
--      set_store_payment_settings, que no deja prender lo que no está
--      configurado (GATEWAY_NOT_CONFIGURED / NO_TRANSFER_ACCOUNTS).
--   2. Pasarela del vendedor, SIEMPRE sus llaves:
--      escuela → school_payment_providers (+ payment_provider_secrets cifrado);
--      externo → vendor_payment_providers + vendor_payment_provider_secrets
--      (nueva, cifrada en el BFF con PAYMENT_TOKENS_ENC_KEY, sin acceso del
--      cliente). access_token deja de ser NOT NULL (no se guarda en claro).
--   3. Las columnas de secreto en claro dejan de ser legibles por
--      authenticated (grant por columnas, trampa 4) y anon pierde todo.
--   4. _store_checkout_gateway (reemplaza el STUB de 230007): resuelve el medio
--      aceptado → fila de pasarela + minutos de reserva. Sin pasarela propia
--      el vendedor solo puede ofrecer transferencia y efectivo.
--   5. store_payment_methods (público: solo public_key/sandbox/flags) y
--      store_transfer_accounts (solo el comprador de la orden / la tienda; la
--      vitrina pública nunca ve números de cuenta — no repetir T1).
--
--   DECISIÓN PROVISIONAL D-5 = A (2026-10-03): cada vendedor cobra con SUS
--   llaves; jamás las globales del BFF. Wompi exige integrity + private key;
--   MP exige access token. Una escuela en payment_mode 'aggregator' sin fila
--   propia queda solo con transferencia/efectivo.
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
    IF to_regprocedure('public._store_checkout_gateway(uuid,text)') IS NULL THEN
        RAISE EXCEPTION 'Falta M-F0-4 (20261003230007): aplicarla antes.';
    END IF;
END
$pre$;

-- ─── 1. Medios de pago por vendedor ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_payment_settings (
    vendor_profile_id     uuid PRIMARY KEY REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    accept_wompi          boolean NOT NULL DEFAULT false,
    accept_mercadopago    boolean NOT NULL DEFAULT false,
    accept_transfer       boolean NOT NULL DEFAULT false,
    accept_cash_pickup    boolean NOT NULL DEFAULT false,
    transfer_instructions text CHECK (transfer_instructions IS NULL OR length(transfer_instructions) <= 1000),
    transfer_hold_hours   integer NOT NULL DEFAULT 48 CHECK (transfer_hold_hours BETWEEN 1 AND 168),
    cash_hold_hours       integer NOT NULL DEFAULT 48 CHECK (cash_hold_hours BETWEEN 1 AND 168),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    updated_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.store_payment_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_payment_settings_select ON public.store_payment_settings;
CREATE POLICY store_payment_settings_select ON public.store_payment_settings
    FOR SELECT TO authenticated
    USING (public.can_manage_store(vendor_profile_id));
REVOKE ALL ON public.store_payment_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.store_payment_settings TO authenticated;
GRANT ALL ON public.store_payment_settings TO service_role;

-- ─── 2. Secretos de pasarela de vendedores externos (cifrados) ───────────────
CREATE TABLE IF NOT EXISTS public.vendor_payment_provider_secrets (
    provider_id          uuid PRIMARY KEY REFERENCES public.vendor_payment_providers(id) ON DELETE CASCADE,
    access_token_enc     text,
    private_key_enc      text,
    integrity_secret_enc text,
    events_secret_enc    text,
    updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_payment_provider_secrets ENABLE ROW LEVEL SECURITY;   -- sin policies
REVOKE ALL ON public.vendor_payment_provider_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.vendor_payment_provider_secrets TO service_role;

COMMENT ON TABLE public.vendor_payment_provider_secrets IS
  'Tienda v2 M-F0-7: secretos de pasarela de vendedores externos cifrados en el BFF (gcm:…). Espejo de payment_provider_secrets. Solo service_role.';

ALTER TABLE public.vendor_payment_providers ALTER COLUMN access_token DROP NOT NULL;
COMMENT ON COLUMN public.vendor_payment_providers.access_token IS
  'DEPRECATED (M-F0-7): el BFF guarda los secretos cifrados en vendor_payment_provider_secrets y deja estas columnas en NULL.';

-- ─── 3. Columnas de secreto fuera del alcance del cliente ────────────────────
REVOKE ALL ON public.school_payment_providers, public.vendor_payment_providers FROM anon;
REVOKE SELECT ON public.school_payment_providers FROM authenticated;
GRANT SELECT (id, school_id, provider, public_key, sandbox, is_default, enabled, created_at, updated_at,
              connect_method, external_user_id, application_fee_pct, connect_status, connected_at,
              connected_by)
    ON public.school_payment_providers TO authenticated;
REVOKE SELECT ON public.vendor_payment_providers FROM authenticated;
GRANT SELECT (id, vendor_id, provider, public_key, sandbox, is_default, enabled, created_at, updated_at)
    ON public.vendor_payment_providers TO authenticated;

-- ─── 4. Resolución de la pasarela del vendedor (interna) ─────────────────────
-- Devuelve {gateway_id, gateway_kind} de la pasarela PROPIA del vendedor para
-- ese proveedor, o NULL. Exige los secretos imprescindibles cifrados.
CREATE OR REPLACE FUNCTION public._store_gateway_row(p_vendor_profile_id uuid, p_provider text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_vp public.vendor_profiles%ROWTYPE;
    v_id uuid;
BEGIN
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE id = p_vendor_profile_id;
    IF v_vp.id IS NULL OR p_provider NOT IN ('wompi', 'mercadopago') THEN
        RETURN NULL;
    END IF;

    IF v_vp.vendor_type::text = 'school' AND v_vp.school_id IS NOT NULL THEN
        SELECT spp.id INTO v_id
          FROM public.school_payment_providers spp
          JOIN public.payment_provider_secrets s ON s.provider_id = spp.id
         WHERE spp.school_id = v_vp.school_id
           AND spp.provider::text = p_provider
           AND spp.enabled
           AND spp.connect_status IN ('connected', 'connected_pending_webhook')
           AND CASE p_provider
                 WHEN 'wompi' THEN s.private_key_enc IS NOT NULL AND s.integrity_secret_enc IS NOT NULL
                 ELSE s.access_token_enc IS NOT NULL END
         ORDER BY spp.is_default DESC, spp.created_at
         LIMIT 1;
        RETURN CASE WHEN v_id IS NULL THEN NULL
                    ELSE jsonb_build_object('gateway_id', v_id, 'gateway_kind', 'school') END;
    END IF;

    SELECT vpp.id INTO v_id
      FROM public.vendor_payment_providers vpp
      LEFT JOIN public.vendor_payment_provider_secrets s ON s.provider_id = vpp.id
     WHERE vpp.vendor_id = v_vp.user_id
       AND vpp.provider::text = p_provider
       AND vpp.enabled
       AND CASE p_provider
             WHEN 'wompi' THEN COALESCE(s.private_key_enc, vpp.access_token) IS NOT NULL
                           AND COALESCE(s.integrity_secret_enc, vpp.integrity_secret) IS NOT NULL
             ELSE COALESCE(s.access_token_enc, vpp.access_token) IS NOT NULL END
     ORDER BY vpp.is_default DESC, vpp.created_at
     LIMIT 1;
    RETURN CASE WHEN v_id IS NULL THEN NULL
                ELSE jsonb_build_object('gateway_id', v_id, 'gateway_kind', 'vendor') END;
END;
$fn$;

-- Cuentas para transferencia del vendedor (interna; números completos).
--   escuela → school_settings.payment_accounts activas (+ cuenta bancaria legacy)
--   externo → vendor_bank_accounts activas
CREATE OR REPLACE FUNCTION public._store_transfer_accounts(p_vendor_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_vp  public.vendor_profiles%ROWTYPE;
    v_out jsonb := '[]'::jsonb;
    v_ss  record;
BEGIN
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE id = p_vendor_profile_id;
    IF v_vp.id IS NULL THEN
        RETURN v_out;
    END IF;

    IF v_vp.vendor_type::text = 'school' AND v_vp.school_id IS NOT NULL THEN
        SELECT payment_accounts, bank_name, bank_account_type, bank_account_number,
               COALESCE(bank_account_holder, bank_titular_name) AS holder, bank_titular_id
          INTO v_ss
          FROM public.school_settings WHERE school_id = v_vp.school_id;
        IF jsonb_typeof(v_ss.payment_accounts) = 'array' THEN
            SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                       'type', a ->> 'type', 'label', a ->> 'label', 'value', a ->> 'value',
                       'bank', a ->> 'bank', 'account_type', a ->> 'account_type',
                       'holder', a ->> 'holder', 'holder_id', a ->> 'holder_id'))), '[]'::jsonb)
              INTO v_out
              FROM jsonb_array_elements(v_ss.payment_accounts) a
             WHERE COALESCE((a ->> 'active')::boolean, true)
               AND NULLIF(btrim(COALESCE(a ->> 'value', '')), '') IS NOT NULL;
        END IF;
        IF NULLIF(btrim(COALESCE(v_ss.bank_account_number, '')), '') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_out) x
                            WHERE x ->> 'value' = btrim(v_ss.bank_account_number)) THEN
            v_out := v_out || jsonb_strip_nulls(jsonb_build_object(
                'type', 'bank', 'label', COALESCE(v_ss.bank_name, 'Cuenta bancaria'),
                'value', btrim(v_ss.bank_account_number), 'bank', v_ss.bank_name,
                'account_type', v_ss.bank_account_type, 'holder', v_ss.holder,
                'holder_id', v_ss.bank_titular_id));
        END IF;
        RETURN v_out;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'type', 'bank', 'label', b.bank_name, 'value', b.account_number, 'bank', b.bank_name,
               'account_type', b.account_type, 'holder', b.account_holder,
               'holder_id', b.document_number)) ORDER BY b.is_default DESC, b.created_at), '[]'::jsonb)
      INTO v_out
      FROM public.vendor_bank_accounts b
     WHERE b.vendor_profile_id = v_vp.id AND COALESCE(b.is_active, true);
    RETURN v_out;
END;
$fn$;

-- Reemplaza el STUB de 230007. Valida el medio contra lo que el vendedor
-- aceptó y contra lo que REALMENTE tiene configurado.
CREATE OR REPLACE FUNCTION public._store_checkout_gateway(p_vendor_profile_id uuid, p_method text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_s        public.store_payment_settings%ROWTYPE;
    v_gw       jsonb;
    v_accepted boolean;
BEGIN
    SELECT * INTO v_s FROM public.store_payment_settings WHERE vendor_profile_id = p_vendor_profile_id;
    v_accepted := CASE p_method
                    WHEN 'wompi'       THEN v_s.accept_wompi
                    WHEN 'mercadopago' THEN v_s.accept_mercadopago
                    WHEN 'transfer'    THEN v_s.accept_transfer
                    WHEN 'cash_pickup' THEN v_s.accept_cash_pickup
                    ELSE false END;
    IF v_s.vendor_profile_id IS NULL OR NOT COALESCE(v_accepted, false) THEN
        RAISE EXCEPTION 'PAYMENT_METHOD_NOT_ACCEPTED' USING ERRCODE = 'P0001',
              DETAIL = COALESCE(p_method, '');
    END IF;

    IF p_method IN ('wompi', 'mercadopago') THEN
        v_gw := public._store_gateway_row(p_vendor_profile_id, p_method);
        IF v_gw IS NULL THEN
            RAISE EXCEPTION 'GATEWAY_NOT_CONFIGURED' USING ERRCODE = 'P0001', DETAIL = p_method;
        END IF;
        RETURN v_gw || jsonb_build_object('provider', p_method, 'hold_minutes', 45);
    END IF;

    IF p_method = 'transfer' THEN
        IF jsonb_array_length(public._store_transfer_accounts(p_vendor_profile_id)) = 0 THEN
            RAISE EXCEPTION 'NO_TRANSFER_ACCOUNTS' USING ERRCODE = 'P0001';
        END IF;
        RETURN jsonb_build_object('provider', 'transfer', 'hold_minutes', v_s.transfer_hold_hours * 60);
    END IF;

    RETURN jsonb_build_object('provider', 'cash_pickup', 'hold_minutes', v_s.cash_hold_hours * 60);
END;
$fn$;

-- ─── 5. RPC públicas ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_store_payment_settings(
    p_vendor_profile_id uuid, p_settings jsonb, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor uuid := public._store_actor(p_actor);
    v_cur   public.store_payment_settings%ROWTYPE;
    v_new   public.store_payment_settings%ROWTYPE;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF NOT public.can_manage_store_as(p_vendor_profile_id, v_actor) THEN
        RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
    END IF;
    IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
        RAISE EXCEPTION 'INVALID_SETTINGS' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_cur FROM public.store_payment_settings WHERE vendor_profile_id = p_vendor_profile_id FOR UPDATE;

    v_new.vendor_profile_id     := p_vendor_profile_id;
    v_new.accept_wompi          := COALESCE((p_settings ->> 'accept_wompi')::boolean, v_cur.accept_wompi, false);
    v_new.accept_mercadopago    := COALESCE((p_settings ->> 'accept_mercadopago')::boolean, v_cur.accept_mercadopago, false);
    v_new.accept_transfer       := COALESCE((p_settings ->> 'accept_transfer')::boolean, v_cur.accept_transfer, false);
    v_new.accept_cash_pickup    := COALESCE((p_settings ->> 'accept_cash_pickup')::boolean, v_cur.accept_cash_pickup, false);
    v_new.transfer_instructions := CASE WHEN p_settings ? 'transfer_instructions'
                                        THEN NULLIF(left(btrim(COALESCE(p_settings ->> 'transfer_instructions', '')), 1000), '')
                                        ELSE v_cur.transfer_instructions END;
    v_new.transfer_hold_hours   := COALESCE((p_settings ->> 'transfer_hold_hours')::integer, v_cur.transfer_hold_hours, 48);
    v_new.cash_hold_hours       := COALESCE((p_settings ->> 'cash_hold_hours')::integer, v_cur.cash_hold_hours, 48);

    IF v_new.accept_wompi AND public._store_gateway_row(p_vendor_profile_id, 'wompi') IS NULL THEN
        RAISE EXCEPTION 'GATEWAY_NOT_CONFIGURED' USING ERRCODE = 'P0001', DETAIL = 'wompi';
    END IF;
    IF v_new.accept_mercadopago AND public._store_gateway_row(p_vendor_profile_id, 'mercadopago') IS NULL THEN
        RAISE EXCEPTION 'GATEWAY_NOT_CONFIGURED' USING ERRCODE = 'P0001', DETAIL = 'mercadopago';
    END IF;
    IF v_new.accept_transfer AND jsonb_array_length(public._store_transfer_accounts(p_vendor_profile_id)) = 0 THEN
        RAISE EXCEPTION 'NO_TRANSFER_ACCOUNTS' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.store_payment_settings AS s (
        vendor_profile_id, accept_wompi, accept_mercadopago, accept_transfer, accept_cash_pickup,
        transfer_instructions, transfer_hold_hours, cash_hold_hours, updated_at, updated_by)
    VALUES (v_new.vendor_profile_id, v_new.accept_wompi, v_new.accept_mercadopago, v_new.accept_transfer,
            v_new.accept_cash_pickup, v_new.transfer_instructions, v_new.transfer_hold_hours,
            v_new.cash_hold_hours, now(), (SELECT p.id FROM public.profiles p WHERE p.id = v_actor))
    ON CONFLICT (vendor_profile_id) DO UPDATE
       SET accept_wompi = EXCLUDED.accept_wompi,
           accept_mercadopago = EXCLUDED.accept_mercadopago,
           accept_transfer = EXCLUDED.accept_transfer,
           accept_cash_pickup = EXCLUDED.accept_cash_pickup,
           transfer_instructions = EXCLUDED.transfer_instructions,
           transfer_hold_hours = EXCLUDED.transfer_hold_hours,
           cash_hold_hours = EXCLUDED.cash_hold_hours,
           updated_at = now(),
           updated_by = EXCLUDED.updated_by
    RETURNING * INTO v_new;

    RETURN to_jsonb(v_new);
END;
$fn$;

-- Lo que la vitrina puede saber: qué medios hay y la llave PÚBLICA de la pasarela.
CREATE OR REPLACE FUNCTION public.store_payment_methods(p_vendor_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_s       public.store_payment_settings%ROWTYPE;
    v_methods jsonb := '[]'::jsonb;
    v_gw      jsonb;
    v_row     record;
    v_p       text;
BEGIN
    IF NOT public.store_seller_allowed(p_vendor_profile_id) THEN
        RETURN jsonb_build_object('vendor_profile_id', p_vendor_profile_id, 'allowed', false, 'methods', '[]'::jsonb);
    END IF;
    SELECT * INTO v_s FROM public.store_payment_settings WHERE vendor_profile_id = p_vendor_profile_id;
    IF v_s.vendor_profile_id IS NULL THEN
        RETURN jsonb_build_object('vendor_profile_id', p_vendor_profile_id, 'allowed', true, 'methods', '[]'::jsonb);
    END IF;

    FOREACH v_p IN ARRAY ARRAY['wompi', 'mercadopago'] LOOP
        IF (v_p = 'wompi' AND v_s.accept_wompi) OR (v_p = 'mercadopago' AND v_s.accept_mercadopago) THEN
            v_gw := public._store_gateway_row(p_vendor_profile_id, v_p);
            IF v_gw IS NOT NULL THEN
                IF v_gw ->> 'gateway_kind' = 'school' THEN
                    SELECT public_key, sandbox INTO v_row FROM public.school_payment_providers
                     WHERE id = (v_gw ->> 'gateway_id')::uuid;
                ELSE
                    SELECT public_key, sandbox INTO v_row FROM public.vendor_payment_providers
                     WHERE id = (v_gw ->> 'gateway_id')::uuid;
                END IF;
                v_methods := v_methods || jsonb_build_object('method', v_p, 'provider', v_p,
                                                             'public_key', v_row.public_key, 'sandbox', v_row.sandbox);
            END IF;
        END IF;
    END LOOP;
    IF v_s.accept_transfer AND jsonb_array_length(public._store_transfer_accounts(p_vendor_profile_id)) > 0 THEN
        v_methods := v_methods || jsonb_build_object('method', 'transfer', 'hold_hours', v_s.transfer_hold_hours,
                                                     'requires_receipt', true);
    END IF;
    IF v_s.accept_cash_pickup THEN
        v_methods := v_methods || jsonb_build_object('method', 'cash_pickup', 'hold_hours', v_s.cash_hold_hours,
                                                     'requires_pickup', true);
    END IF;

    RETURN jsonb_build_object('vendor_profile_id', p_vendor_profile_id, 'allowed', true, 'methods', v_methods);
END;
$fn$;

-- Números de cuenta: solo al comprador de una orden de transferencia abierta
-- (o a quien administra la tienda). Nunca a la vitrina.
CREATE OR REPLACE FUNCTION public.store_transfer_accounts(p_order_id uuid, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    IF v_o.id IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF NOT (public.can_manage_store_as(v_o.vendor_profile_id, v_actor)
            OR (v_o.user_id = v_actor AND v_o.payment_method = 'transfer'
                AND v_o.status IN ('pending_payment', 'awaiting_approval'))) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
        'order_id', v_o.id,
        'reference', v_o.reference,
        'amount', v_o.total_amount,
        'expires_at', v_o.expires_at,
        'status', v_o.status,
        'accounts', public._store_transfer_accounts(v_o.vendor_profile_id),
        'instructions', (SELECT transfer_instructions FROM public.store_payment_settings
                          WHERE vendor_profile_id = v_o.vendor_profile_id));
END;
$fn$;

-- ─── 6. Alta/edición de la pasarela de un vendedor externo (transaccional) ───
-- Espejo de upsert_school_provider: fila visible + secretos cifrados en la
-- MISMA transacción (CLAUDE.md: multi-fila = RPC). Las columnas en claro
-- quedan en NULL. Una clave ausente en p_secrets_enc no borra la existente.
-- Solo service_role (el BFF cifra con PAYMENT_TOKENS_ENC_KEY y valida dueño).
CREATE OR REPLACE FUNCTION public.upsert_vendor_provider(
    p_vendor_id   uuid,
    p_provider    public.payment_provider,
    p_public_key  text,
    p_secrets_enc jsonb,
    p_sandbox     boolean DEFAULT true,
    p_enabled     boolean DEFAULT true,
    p_is_default  boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_id uuid;
BEGIN
    IF p_vendor_id IS NULL OR NULLIF(btrim(COALESCE(p_public_key, '')), '') IS NULL THEN
        RAISE EXCEPTION 'vendor_id y public_key son obligatorios' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.vendor_payment_providers AS v (
        vendor_id, provider, public_key, access_token, webhook_secret, integrity_secret,
        sandbox, enabled, is_default, updated_at)
    VALUES (p_vendor_id, p_provider, btrim(p_public_key), NULL, NULL, NULL,
            p_sandbox, p_enabled, p_is_default, now())
    ON CONFLICT (vendor_id, provider) DO UPDATE
       SET public_key = EXCLUDED.public_key,
           access_token = NULL, webhook_secret = NULL, integrity_secret = NULL,
           sandbox = EXCLUDED.sandbox,
           enabled = EXCLUDED.enabled,
           is_default = EXCLUDED.is_default,
           updated_at = now()
    RETURNING v.id INTO v_id;

    INSERT INTO public.vendor_payment_provider_secrets AS s (
        provider_id, access_token_enc, private_key_enc, integrity_secret_enc, events_secret_enc, updated_at)
    VALUES (v_id,
            p_secrets_enc ->> 'access_token_enc',
            p_secrets_enc ->> 'private_key_enc',
            p_secrets_enc ->> 'integrity_secret_enc',
            p_secrets_enc ->> 'events_secret_enc',
            now())
    ON CONFLICT (provider_id) DO UPDATE
       SET access_token_enc     = COALESCE(EXCLUDED.access_token_enc,     s.access_token_enc),
           private_key_enc      = COALESCE(EXCLUDED.private_key_enc,      s.private_key_enc),
           integrity_secret_enc = COALESCE(EXCLUDED.integrity_secret_enc, s.integrity_secret_enc),
           events_secret_enc    = COALESCE(EXCLUDED.events_secret_enc,    s.events_secret_enc),
           updated_at           = now();

    RETURN v_id;
END;
$fn$;

-- ─── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.upsert_vendor_provider(uuid, public.payment_provider, text, jsonb, boolean, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_vendor_provider(uuid, public.payment_provider, text, jsonb, boolean, boolean, boolean) TO service_role;
REVOKE ALL ON FUNCTION public._store_gateway_row(uuid, text)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_transfer_accounts(uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_checkout_gateway(uuid, text)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_store_payment_settings(uuid, jsonb, uuid)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_payment_methods(uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_transfer_accounts(uuid, uuid)            FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._store_gateway_row(uuid, text)                TO service_role;
GRANT EXECUTE ON FUNCTION public.set_store_payment_settings(uuid, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_payment_methods(uuid)                   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_transfer_accounts(uuid, uuid)           TO authenticated, service_role;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003230013', '20261003230013_tienda_v2_pasarela_y_metodos_del_vendedor', 'sql-editor 2026-10-04') on conflict (version) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 20261003230016_tienda_v2_factura_y_eventos.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261003230016_tienda_v2_factura_y_eventos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003230013
-- Objetivo: M-F0-8 de docs/specs/tienda-v2-f0-plan-migraciones.md, ajustada al
--   contrato de contabilidad (docs/specs/contabilidad-v2-f0-plan-migraciones.md
--   §6): la tienda NO agrega ramas a cash_ledger ni escribe tablas contables;
--   su única salida contable son eventos idempotentes a accounting_outbox
--   (20261003202429), emitidos en la MISMA transacción que cambia el estado.
--
--   1. Guard de emisión (T20): una factura (document_type='invoice') con
--      order_id exige orden en estado cobrado (paid…delivered) CON prueba de
--      pago (transacción de pasarela, o transferencia/efectivo aprobados por
--      alguien) y emisor = dueño de la venta (escuela por su tienda; externo
--      por sí mismo; nunca la escuela por un externo).
--   2. order_invoice_payload(order): líneas con IVA incluido (§6.3) + línea de
--      ENVÍO aparte (excluida de IVA, D-11 provisional). La usa el BFF
--      (invoicing.service emitInvoiceForOrder).
--   3. orders_pending_invoice(): candidatas del cron autoEmitPendingOrders
--      (tienda prendida + estado cobrado + prueba de pago).
--   4. _store_emit_order_events (reemplaza el STUB de 230007): al pagarse una
--      orden emite commerce_sale (+ commerce_commission y commerce_gateway_fee
--      si son > 0). Un evento por vendedor y por momento (D-2 → uno por orden).
--   5. Reembolso completado de una orden → commerce_refund (proporcional) y,
--      si es total, reverso de settlements (trigger sobre refunds; no toca
--      complete_refund, cuya rama payment_id sigue idéntica).
--
--   DECISIONES PROVISIONALES (2026-10-03):
--   · source_kind de venta/comisión/fee = 'order' (uno por vendedor; el
--     contrato listaba 'order_item'/'settlement', pero pide "un evento por
--     vendedor" y el envío no pertenece a ningún ítem). idempotency_key =
--     '<event_kind>:<order_id>'; reembolso '<commerce_refund>:<refund_id>'.
--   · settlement_mode = 'direct' (D-5 = A: el vendedor cobró).
--   · D-1 IVA incluido; D-11 envío excluido de IVA.
--   · Reembolso parcial: evento proporcional, settlements sin reversar.
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
    IF to_regprocedure('public.accounting_emit_event(text,uuid,text,text,uuid,jsonb,text)') IS NULL THEN
        RAISE EXCEPTION 'Falta la bandeja contable (20261003202429): aplicarla antes.';
    END IF;
    IF to_regclass('public.store_payment_settings') IS NULL
       OR to_regprocedure('public._store_reverse_settlements(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Faltan 20261003230011 / 20261003230013: aplicarlas antes.';
    END IF;
END
$pre$;

-- ─── Helpers ─────────────────────────────────────────────────────────────────
-- ¿La orden está cobrada y con prueba? (lo mismo que exige trg_orders_paid_requires_proof)
CREATE OR REPLACE FUNCTION public._store_order_has_payment_proof(p_order public.orders)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT p_order.status IN ('paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered')
       AND p_order.paid_at IS NOT NULL
       AND (p_order.provider_transaction_id IS NOT NULL
            OR p_order.wompi_transaction_id IS NOT NULL
            OR (p_order.payment_method IN ('transfer', 'cash_pickup') AND p_order.approved_by IS NOT NULL));
$fn$;

-- Dueño de la venta: (school, school_id) para tienda escolar; (vendor, vp.id) si no.
CREATE OR REPLACE FUNCTION public._store_order_owner(p_order_id uuid)
RETURNS TABLE (owner_type text, owner_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT COALESCE(oi.owner_type,
                    CASE WHEN vp.vendor_type::text = 'school' AND vp.school_id IS NOT NULL THEN 'school' ELSE 'vendor' END),
           COALESCE(oi.owner_id,
                    CASE WHEN vp.vendor_type::text = 'school' AND vp.school_id IS NOT NULL THEN vp.school_id ELSE vp.id END)
      FROM public.orders o
      LEFT JOIN public.vendor_profiles vp ON vp.id = o.vendor_profile_id
      LEFT JOIN LATERAL (SELECT x.owner_type, x.owner_id FROM public.order_items x
                          WHERE x.order_id = o.id AND x.owner_type IS NOT NULL LIMIT 1) oi ON true
     WHERE o.id = p_order_id AND (oi.owner_type IS NOT NULL OR vp.id IS NOT NULL);
$fn$;

-- ─── 1. Guard de emisión de factura de órdenes ───────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_invoice_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o     public.orders%ROWTYPE;
    v_owner record;
BEGIN
    IF NEW.order_id IS NULL OR NEW.document_type <> 'invoice' THEN
        RETURN NEW;
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = NEW.order_id FOR SHARE;
    IF v_o.id IS NULL OR NOT public._store_order_has_payment_proof(v_o) THEN
        RAISE EXCEPTION 'INVOICE_ORDER_NOT_PAID: %', COALESCE(v_o.status, 'inexistente')
            USING ERRCODE = '55000',
                  HINT = 'Solo se factura una orden cobrada con prueba de pago (pasarela o aprobación del vendedor).';
    END IF;
    SELECT * INTO v_owner FROM public._store_order_owner(NEW.order_id);
    IF v_owner.owner_type IS NULL
       OR NEW.owner_type IS DISTINCT FROM v_owner.owner_type
       OR NEW.owner_id IS DISTINCT FROM v_owner.owner_id THEN
        RAISE EXCEPTION 'INVOICE_ORDER_WRONG_OWNER' USING ERRCODE = '55000',
              HINT = 'El emisor es el dueño de la venta (escuela por su tienda, externo por sí mismo).';
    END IF;
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_factura_orden_pagada ON public.electronic_invoices;
CREATE TRIGGER trg_guard_factura_orden_pagada
    BEFORE INSERT ON public.electronic_invoices
    FOR EACH ROW
    WHEN (NEW.order_id IS NOT NULL)
    EXECUTE FUNCTION public.guard_invoice_order_paid();

-- ─── 2. Payload de factura (IVA incluido + envío) ────────────────────────────
CREATE OR REPLACE FUNCTION public.order_invoice_payload(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o     public.orders%ROWTYPE;
    v_owner record;
    v_lines jsonb;
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    IF v_o.id IS NULL THEN
        RETURN jsonb_build_object('invoiceable', false, 'reason', 'order_not_found');
    END IF;
    IF NOT public._store_order_has_payment_proof(v_o) THEN
        RETURN jsonb_build_object('invoiceable', false, 'reason', 'order_not_paid', 'status', v_o.status);
    END IF;
    IF v_o.user_id IS NULL THEN
        RETURN jsonb_build_object('invoiceable', false, 'reason', 'order_without_buyer');
    END IF;
    SELECT * INTO v_owner FROM public._store_order_owner(p_order_id);
    IF v_owner.owner_type IS NULL THEN
        RETURN jsonb_build_object('invoiceable', false, 'reason', 'cannot_resolve_owner');
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'code', 'ORD-' || left(v_o.id::text, 8) || '-' || rn,
               'name', name,
               'quantity', quantity,
               'unit_price', unit_price,                 -- IVA incluido
               'tax_rate_pct', round(tax_rate * 100, 2),
               'is_excluded', tax_rate = 0,
               'line_total', line_total,
               'line_base', line_base,
               'line_tax', line_tax) ORDER BY rn), '[]'::jsonb)
      INTO v_lines
      FROM (SELECT row_number() OVER (ORDER BY oi.created_at, oi.id) AS rn,
                   p.name || COALESCE(' · ' || v.name, '') AS name,
                   oi.quantity, oi.unit_price,
                   COALESCE(oi.tax_rate, public._store_norm_tax_rate(p.tax_rate)) AS tax_rate,
                   COALESCE(oi.line_total, round(oi.unit_price * oi.quantity)) AS line_total,
                   oi.line_base, COALESCE(oi.tax_amount, 0) AS line_tax
              FROM public.order_items oi
              JOIN public.products p ON p.id = oi.product_id
              LEFT JOIN public.product_variants v ON v.id = oi.variant_id
             WHERE oi.order_id = p_order_id) x;

    IF COALESCE(v_o.shipping_cost, 0) > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'code', 'ORD-' || left(v_o.id::text, 8) || '-ENVIO',
            'name', 'Envío', 'quantity', 1, 'unit_price', v_o.shipping_cost,
            'tax_rate_pct', 0, 'is_excluded', true,                    -- D-11 provisional
            'line_total', v_o.shipping_cost, 'line_base', v_o.shipping_cost, 'line_tax', 0,
            'is_shipping', true);
    END IF;

    RETURN jsonb_build_object(
        'invoiceable', true,
        'order_id', v_o.id,
        'reference', v_o.reference,
        'owner_type', v_owner.owner_type,
        'owner_id', v_owner.owner_id,
        'buyer_id', v_o.user_id,
        'payment_method', v_o.payment_method,
        'total', v_o.total_amount,
        'lines', v_lines);
END;
$fn$;

-- Candidatas al cron de facturación: tienda prendida + cobradas con prueba.
CREATE OR REPLACE FUNCTION public.orders_pending_invoice(p_since timestamptz, p_limit integer DEFAULT 100)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT o.id
      FROM public.orders o
     WHERE public.store_enabled()
       AND o.paid_at >= p_since
       AND public._store_order_has_payment_proof(o)
       AND NOT EXISTS (SELECT 1 FROM public.electronic_invoices ei
                        WHERE ei.order_id = o.id AND ei.document_type = 'invoice'
                          AND ei.status IN ('queued', 'sent', 'accepted') AND ei.voided_at IS NULL)
     ORDER BY o.paid_at DESC
     LIMIT GREATEST(LEAST(COALESCE(p_limit, 100), 500), 1);
$fn$;

-- ─── 3. Eventos contables de la orden ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._store_order_event_payload(p_order_id uuid, p_ratio numeric, p_effective timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o      public.orders%ROWTYPE;
    v_base   numeric;
    v_vat    numeric;
    v_lines  numeric;
    v_comm   numeric;
    v_gwfee  numeric;
    v_rates  numeric[];
    v_crate  numeric;
    v_ship   numeric;
    v_gross  numeric;
    v_est    boolean;
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    SELECT COALESCE(sum(COALESCE(oi.line_base, oi.line_total - COALESCE(oi.tax_amount, 0))), 0),
           COALESCE(sum(COALESCE(oi.tax_amount, 0)), 0),
           COALESCE(sum(COALESCE(oi.line_total, round(oi.unit_price * oi.quantity))), 0),
           array_agg(DISTINCT oi.tax_rate),
           max(oi.commission_rate)
      INTO v_base, v_vat, v_lines, v_rates, v_crate
      FROM public.order_items oi WHERE oi.order_id = p_order_id;
    SELECT COALESCE(sum(s.platform_fee), 0), COALESCE(sum(s.gateway_fee), 0), COALESCE(bool_or(s.gateway_fee_estimated), false)
      INTO v_comm, v_gwfee, v_est
      FROM public.settlements s WHERE s.order_id = p_order_id AND s.status <> 'reversed';

    v_ship := COALESCE(v_o.shipping_cost, 0);
    IF p_ratio < 1 THEN
        v_base  := round(v_base * p_ratio);
        v_vat   := round(v_vat * p_ratio);
        v_ship  := round(v_ship * p_ratio);
        v_comm  := round(v_comm * p_ratio);
        v_gwfee := round(v_gwfee * p_ratio);
    END IF;
    v_gross := v_base + v_vat + v_ship;   -- cuadra por construcción (contrato §6.2)

    RETURN jsonb_build_object(
        'order_id', v_o.id,
        'reference', v_o.reference,
        'gross', v_gross,
        'base', v_base,
        'vat', v_vat,
        'vat_rate', CASE WHEN array_length(v_rates, 1) = 1 THEN v_rates[1] END,
        'shipping', v_ship,
        'commission', v_comm,
        'commission_rate', v_crate,
        'gateway_fee', v_gwfee,
        'gateway_fee_estimated', v_est,
        'net', v_gross - v_comm - v_gwfee,
        'currency', 'COP',
        'settlement_mode', 'direct',                 -- D-5 = A: el vendedor cobró
        'payout_batch_id', NULL,
        'payment_method', v_o.payment_method,
        'buyer_party', jsonb_build_object('type', 'profile', 'id', v_o.user_id),
        'electronic_invoice_id', NULL,
        'ratio', p_ratio,
        'effective_date', to_char((p_effective AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD'));
END;
$fn$;

CREATE OR REPLACE FUNCTION public._store_emit_order_events(p_order_id uuid, p_kind text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o       public.orders%ROWTYPE;
    v_owner   record;
    v_payload jsonb;
    v_n       integer := 0;
BEGIN
    IF p_kind <> 'sale' THEN
        RAISE EXCEPTION 'INVALID_EVENT_KIND' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    IF v_o.id IS NULL OR v_o.paid_at IS NULL THEN
        RETURN 0;
    END IF;
    SELECT * INTO v_owner FROM public._store_order_owner(p_order_id);
    IF v_owner.owner_type IS NULL THEN
        RETURN 0;   -- orden legacy sin tienda: nada que postear
    END IF;

    v_payload := public._store_order_event_payload(p_order_id, 1, v_o.paid_at);

    PERFORM public.accounting_emit_event('order', p_order_id, 'commerce_sale',
                                         v_owner.owner_type, v_owner.owner_id, v_payload,
                                         'commerce_sale:' || p_order_id);
    v_n := 1;
    IF (v_payload ->> 'commission')::numeric > 0 THEN
        PERFORM public.accounting_emit_event('order', p_order_id, 'commerce_commission',
                                             v_owner.owner_type, v_owner.owner_id, v_payload,
                                             'commerce_commission:' || p_order_id);
        v_n := v_n + 1;
    END IF;
    IF (v_payload ->> 'gateway_fee')::numeric > 0 THEN
        PERFORM public.accounting_emit_event('order', p_order_id, 'commerce_gateway_fee',
                                             v_owner.owner_type, v_owner.owner_id, v_payload,
                                             'commerce_gateway_fee:' || p_order_id);
        v_n := v_n + 1;
    END IF;
    RETURN v_n;
END;
$fn$;

-- ─── 4. Reembolso de orden completado → reverso + evento ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_store_refund_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_o       public.orders%ROWTYPE;
    v_owner   record;
    v_ratio   numeric;
    v_payload jsonb;
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = NEW.order_id;
    IF v_o.id IS NULL OR v_o.total_amount IS NULL OR v_o.total_amount <= 0 THEN
        RETURN NULL;
    END IF;
    v_ratio := LEAST(COALESCE(NEW.refund_amount, 0) / v_o.total_amount, 1);

    -- El payload se arma ANTES de reversar (lleva la comisión original, prorrateada).
    SELECT * INTO v_owner FROM public._store_order_owner(NEW.order_id);
    IF v_owner.owner_type IS NOT NULL AND v_o.paid_at IS NOT NULL THEN
        v_payload := public._store_order_event_payload(NEW.order_id, v_ratio,
                                                       COALESCE(NEW.processed_at, now()))
                  || jsonb_build_object('refund_id', NEW.id, 'refund_amount', NEW.refund_amount);
        PERFORM public.accounting_emit_event('refund', NEW.id, 'commerce_refund',
                                             v_owner.owner_type, v_owner.owner_id, v_payload,
                                             'commerce_refund:' || NEW.id);
    END IF;

    IF v_ratio >= 1 THEN
        PERFORM public._store_reverse_settlements(NEW.order_id);
    END IF;
    RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_store_refund_completed ON public.refunds;
CREATE TRIGGER trg_store_refund_completed
    AFTER UPDATE OF status ON public.refunds
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.order_id IS NOT NULL)
    EXECUTE FUNCTION public.fn_store_refund_completed();

-- ─── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public._store_order_has_payment_proof(public.orders)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_order_owner(uuid)                             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_invoice_order_paid()                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_invoice_payload(uuid)                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orders_pending_invoice(timestamptz, integer)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_order_event_payload(uuid, numeric, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_emit_order_events(uuid, text)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_store_refund_completed()                          FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.order_invoice_payload(uuid)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.orders_pending_invoice(timestamptz, integer) TO service_role;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261003230016', '20261003230016_tienda_v2_factura_y_eventos', 'sql-editor 2026-10-04') on conflict (version) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 20261004080918_whatsapp_estado_de_plantillas_por_waba.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261004080918_whatsapp_estado_de_plantillas_por_waba.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261004074523
-- Objetivo: saber, POR ESCUELA, qué plantillas de Meta están aprobadas en SU
--           WABA, para que la cobranza automática por WhatsApp pueda usarlas.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- POR QUÉ UNA TABLA NUEVA Y NO payment_message_templates.meta_*
--
--   Una plantilla de Meta vive DENTRO de una WABA: `pago_vence_hoy_v4` aprobada
--   en la WABA de prueba (2239403120233193) no sirve para enviar desde el número
--   de Dynasty (WABA 1096337621148583); allá hubo que registrarla de nuevo el
--   2026-10-04 y arrancó en PENDING. El estado es, entonces, por (WABA, nombre,
--   idioma).
--
--   `payment_message_templates` no tiene esa forma:
--     · 17 de sus 18 filas son GLOBALES (school_id NULL) — medido 2026-10-04.
--       Una fila global no puede llevar el estado de N WABAs distintas.
--     · Sus `body` son texto libre con {{nombre_padre}}, editable por la escuela
--       desde MessageTemplatesPage. Lo que Meta aprobó es OTRO texto, con
--       variables posicionales {{1}}..{{6}} fijas. Atar uno al otro sugiere que
--       editar el body cambia lo que se envía, y no es así.
--     · Su taxonomía (5 template_type) es más gruesa que la escalera de cobranza
--       (8 escalones): `reminder_due` no distingue "vence mañana" de "vence hoy".
--   `meta_template_name`/`meta_template_status` (agregadas por el spec de opt-in)
--   siguen vacías en las 18 filas y ningún código las lee. No se borran
--   (migraciones inmutables y el frontend tipado las conoce); quedan sin uso.
--
--   El MAPEO concepto → nombre de Meta va en código
--   (bff/src/services/whatsapp-plantillas.service.ts): cada nombre trae su
--   propio orden de variables (_v3/_v4 movieron {{2}} a escuela y {{4}} a
--   periodo), así que un cambio de nombre exige cambiar código de todos modos.
--
-- QUIÉN LA ESCRIBE
--
--   Solo el BFF con service_role:
--     (a) el job de sync cada 30 min (GET /{waba}/message_templates), que es la
--         fuente de verdad;
--     (b) si el GET falla, los eventos `message_template_status_update` que el
--         webhook ya guarda en whatsapp_account_events.
--   Ningún cliente escribe aquí: un admin que pudiera marcar APPROVED a mano
--   haría que la cobranza mande una plantilla que Meta rechaza.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_template_status (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    integration_id   uuid NOT NULL,
    -- Desnormalizado para que la policy no haga join (mismo criterio que
    -- whatsapp_optins). La FK compuesta de abajo garantiza que coincida.
    school_id        uuid NOT NULL,
    -- La WABA de la que se leyó. Si la escuela reconecta con otra WABA, las
    -- filas viejas quedan con el waba_id anterior y el servicio las ignora.
    waba_id          text NOT NULL,

    name             text NOT NULL,
    language         text NOT NULL,          -- 'es_CO', tal como lo devuelve Meta
    category         text,                   -- UTILITY | MARKETING | AUTHENTICATION
    -- text + CHECK, no CREATE TYPE. Lista = estados documentados por Meta para
    -- message_templates. Lo que Meta invente después entra como UNKNOWN (el
    -- servicio lo normaliza) en vez de tumbar el sync entero por un CHECK.
    status           text NOT NULL CHECK (status IN (
                         'APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED',
                         'IN_APPEAL', 'PENDING_DELETION', 'DELETED',
                         'LIMIT_EXCEEDED', 'ARCHIVED', 'UNKNOWN'
                     )),
    meta_id          text,                   -- id de la plantilla en Meta
    rejected_reason  text,
    -- Los componentes tal como están APROBADOS en Meta: con esto el envío puede
    -- comprobar que el número de variables coincide antes de mandar.
    components       jsonb,
    -- De dónde salió el último estado: el listado (verdad) o un evento del webhook.
    source           text NOT NULL DEFAULT 'sync' CHECK (source IN ('sync', 'webhook')),

    synced_at        timestamptz NOT NULL DEFAULT now(),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_wa_template_status UNIQUE (integration_id, name, language),

    -- uq_wa_integration_id_school ya existe (spec de opt-in); se reusa.
    CONSTRAINT fk_wa_template_status_integration
        FOREIGN KEY (integration_id, school_id)
        REFERENCES public.school_whatsapp_integrations(id, school_id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.whatsapp_template_status IS
    'Estado de cada plantilla de Meta en la WABA de cada integración. Lo escribe solo el BFF (sync cada 30 min + eventos del webhook). La cobranza automática solo envía plantillas con status=APPROVED aquí.';

-- La pregunta caliente del envío: "¿esta plantilla está aprobada en esta integración?"
CREATE INDEX IF NOT EXISTS idx_wa_template_status_aprobadas
    ON public.whatsapp_template_status (integration_id, name)
    WHERE status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_wa_template_status_school
    ON public.whatsapp_template_status (school_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_template_status ENABLE ROW LEVEL SECURITY;

-- Lectura: administración de la escuela (owner/admin/school_admin activos en
-- school_members, vía is_school_admin). No user_school_ids(): padres y atletas
-- no tienen nada que ver con el estado de las plantillas.
-- (SELECT auth.uid()) no aplica: is_school_admin recibe la fila como argumento.
DROP POLICY IF EXISTS "wa_template_status_admin_select" ON public.whatsapp_template_status;
CREATE POLICY "wa_template_status_admin_select" ON public.whatsapp_template_status
    FOR SELECT TO authenticated
    USING (public.is_school_admin(school_id));

-- Escritura: ninguna policy para authenticated/anon y sin grants de escritura.
-- Sin FOR ALL (invariante I3). service_role salta RLS.
REVOKE ALL ON TABLE public.whatsapp_template_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.whatsapp_template_status TO authenticated;
GRANT ALL ON TABLE public.whatsapp_template_status TO service_role;

COMMIT;

-- ─── Verificación después de aplicar (solo lectura) ─────────────────────────
-- select cmd, policyname, roles, qual, with_check from pg_policies
--  where tablename = 'whatsapp_template_status';          -- 1 policy, SELECT
-- set local role anon; select count(*) from public.whatsapp_template_status;  -- permission denied
-- npm run seguridad:invariantes

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261004080918', '20261004080918_whatsapp_estado_de_plantillas_por_waba', 'sql-editor 2026-10-04') on conflict (version) do nothing;
