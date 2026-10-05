-- =============================================================================
-- 20261003202436_tienda_v2_orders_cerrar_escritura.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202434
-- Objetivo: M-F0-3 de docs/specs/tienda-v2-f0-plan-migraciones.md.
--   Cierra T3/T4, confirmados en la prueba real (docs/qa/tienda-baseline-padre-
--   2026-10-03.md §3): el comprador reescribía total y estado de su orden
--   (incluso 'paid' con total 1 y estados inventados) y creaba órdenes e ítems
--   con el precio que quisiera, por PostgREST.
--
--   1. Columnas nuevas en orders / order_items (nullable o con default) para el
--      motor de orden (M-F0-4), comprobante, efectivo, cupones (F3b) e invitado.
--      Backfill de vendor_profile_id desde vendor_id / products.
--   2. Estados: CHECK cerrado. Legacy: pending→pending_payment,
--      processing→preparing, declined/failed/rejected→cancelled,
--      completed→delivered (con nota en el historial). Otro valor = la
--      migración aborta (no se adivina).
--   3. Escritura: sin policies de INSERT/UPDATE del comprador, REVOKE de
--      INSERT/UPDATE/DELETE a anon y authenticated, y trigger cinturón
--      trg_zz_guard_orders (INVOKER) que rechaza a authenticated/anon aunque
--      alguien vuelva a dar el grant. DEFINER (postgres) y BFF (service_role)
--      pasan.
--   4. trg_orders_paid_requires_proof: 'paid' exige transacción de pasarela o
--      (transferencia/efectivo aprobados por alguien).
--   5. order_status_history (append-only; lo escribe un trigger DEFINER).
--   6. Vendedor ve sus órdenes por can_manage_store (admins de la escuela
--      incluidos) además del camino legacy por products.vendor_id.
--   7. disable_vendor_profile y confirm_order_payment (las 2 sobrecargas,
--      todavía vivas hasta M-F0-9) entienden los estados nuevos.
--
--   NO va acá (desviación del plan, ver PR): el CHECK de orders.payment_method
--   (D-17). confirm_order_payment escribe hoy el submétodo crudo de Wompi/MP
--   ('CARD', 'NEQUI', 'credit_card'…) en esa columna; el CHECK entra con
--   M-F0-4, que reescribe confirm_order_payment y usa payment_method_detail.
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
    IF to_regprocedure('public.store_can_manage_product(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Falta M-F0-2 (20261003202434): aplicarla antes.';
    END IF;
END
$pre$;

-- ─── 1. Columnas ─────────────────────────────────────────────────────────────
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS vendor_profile_id     uuid REFERENCES public.vendor_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS school_id             uuid REFERENCES public.schools(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reference             text,
    ADD COLUMN IF NOT EXISTS idempotency_key       uuid,
    ADD COLUMN IF NOT EXISTS subtotal              numeric(12,0),
    ADD COLUMN IF NOT EXISTS discount_total        numeric(12,0) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coupon_id             uuid,
    ADD COLUMN IF NOT EXISTS fulfillment_mode      text,
    ADD COLUMN IF NOT EXISTS pickup_branch_id      uuid REFERENCES public.school_branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS expires_at            timestamptz,
    ADD COLUMN IF NOT EXISTS buyer_snapshot        jsonb,
    ADD COLUMN IF NOT EXISTS payment_method_detail text,
    ADD COLUMN IF NOT EXISTS seller_gateway_id     uuid,
    ADD COLUMN IF NOT EXISTS receipt_path          text,
    ADD COLUMN IF NOT EXISTS receipt_submitted_at  timestamptz,
    ADD COLUMN IF NOT EXISTS approved_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at           timestamptz,
    ADD COLUMN IF NOT EXISTS rejection_reason      text,
    ADD COLUMN IF NOT EXISTS pickup_code_hash      text,
    ADD COLUMN IF NOT EXISTS guest_email           text,
    ADD COLUMN IF NOT EXISTS guest_token_hash      text;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_reference_key UNIQUE (reference),
    ADD CONSTRAINT orders_user_idempotency_key UNIQUE (user_id, idempotency_key),
    ADD CONSTRAINT orders_fulfillment_mode_check
        CHECK (fulfillment_mode IS NULL OR fulfillment_mode IN ('pickup', 'shipping')),
    ADD CONSTRAINT orders_discount_total_nonneg CHECK (discount_total >= 0);

COMMENT ON COLUMN public.orders.payment_method_detail IS
  'Submétodo de la pasarela (CARD, PSE, NEQUI…). payment_method queda para el canal (D-17, CHECK en M-F0-4).';

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS tax_rate          numeric(5,4),
    ADD COLUMN IF NOT EXISTS line_total        numeric(12,0),
    ADD COLUMN IF NOT EXISTS line_base         numeric(12,0),
    ADD COLUMN IF NOT EXISTS discount_amount   numeric(12,0) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_profile_id uuid REFERENCES public.vendor_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_vendor_profile_id_idx      ON public.orders (vendor_profile_id);
CREATE INDEX IF NOT EXISTS order_items_vendor_profile_id_idx ON public.order_items (vendor_profile_id);

-- Backfill (antes de los triggers de guarda): de qué tienda es cada fila.
UPDATE public.order_items oi
   SET vendor_profile_id = p.vendor_profile_id
  FROM public.products p
 WHERE oi.product_id = p.id AND oi.vendor_profile_id IS NULL AND p.vendor_profile_id IS NOT NULL;

UPDATE public.orders o
   SET vendor_profile_id = vp.id,
       school_id         = vp.school_id
  FROM public.vendor_profiles vp
 WHERE o.vendor_profile_id IS NULL AND o.vendor_id IS NOT NULL AND vp.user_id = o.vendor_id;

-- Órdenes sin vendor_id (las del checkout viejo, B8): la tienda sale del único
-- vendor_profile de sus ítems, si es uno solo.
UPDATE public.orders o
   SET vendor_profile_id = x.vp_id,
       school_id         = (SELECT school_id FROM public.vendor_profiles WHERE id = x.vp_id)
  FROM (SELECT oi.order_id, min(oi.vendor_profile_id::text)::uuid AS vp_id
          FROM public.order_items oi
         WHERE oi.vendor_profile_id IS NOT NULL
         GROUP BY oi.order_id
        HAVING count(DISTINCT oi.vendor_profile_id) = 1) x
 WHERE o.id = x.order_id AND o.vendor_profile_id IS NULL;

-- ─── 5. Historial (antes del remapeo para dejar la nota) ─────────────────────
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    from_status text,
    to_status   text NOT NULL,
    actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_role  text NOT NULL CHECK (actor_role IN ('buyer', 'seller', 'admin', 'system', 'webhook')),
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON public.order_status_history (order_id, created_at);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- ─── 2. Estados ──────────────────────────────────────────────────────────────
WITH mapa(desde, hacia) AS (
    VALUES ('pending', 'pending_payment'), ('processing', 'preparing'),
           ('declined', 'cancelled'), ('failed', 'cancelled'), ('rejected', 'cancelled'),
           ('completed', 'delivered')
), cambiadas AS (
    UPDATE public.orders o
       SET status = m.hacia, updated_at = now()
      FROM mapa m
     WHERE o.status = m.desde
    RETURNING o.id, m.desde, m.hacia
)
INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_role, note)
SELECT id, desde, hacia, 'system', 'M-F0-3: estado legacy remapeado' FROM cambiadas;

UPDATE public.orders SET status = 'pending_payment' WHERE status IS NULL;

DO $chk$
DECLARE
    v_raros text;
BEGIN
    SELECT string_agg(DISTINCT status, ', ') INTO v_raros
      FROM public.orders
     WHERE status NOT IN ('pending_payment','awaiting_approval','payment_review','paid','preparing',
                          'ready_for_pickup','shipped','delivered','expired','cancelled','refunded',
                          'partially_refunded');
    IF v_raros IS NOT NULL THEN
        RAISE EXCEPTION 'orders.status con valores sin mapeo: % (decidir a mano antes de aplicar)', v_raros;
    END IF;
END
$chk$;

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending_payment';
ALTER TABLE public.orders ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN (
    'pending_payment','awaiting_approval','payment_review','paid','preparing','ready_for_pickup',
    'shipped','delivered','expired','cancelled','refunded','partially_refunded'));

-- ─── 3. Cerrar la escritura del cliente ──────────────────────────────────────
DROP POLICY IF EXISTS orders_insert_buyer      ON public.orders;
DROP POLICY IF EXISTS orders_update_buyer      ON public.orders;
DROP POLICY IF EXISTS order_items_insert_buyer ON public.order_items;

REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items FROM anon, authenticated;
REVOKE ALL ON public.orders, public.order_items FROM anon;

-- Cinturón: aunque vuelva a aparecer un grant o una policy, el cliente no escribe.
-- INVOKER a propósito: current_user es el rol de la sesión (authenticated/anon)
-- salvo dentro de una función DEFINER (postgres) o con el BFF (service_role).
CREATE OR REPLACE FUNCTION public.fn_guard_orders_client_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
    IF current_user IN ('authenticated', 'anon') THEN
        RAISE EXCEPTION 'ORDER_WRITE_LOCKED' USING ERRCODE = '42501',
              HINT = 'Las órdenes se escriben solo por RPC o por el BFF.';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_guard_orders_client_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_zz_guard_orders ON public.orders;
CREATE TRIGGER trg_zz_guard_orders
    BEFORE INSERT OR UPDATE OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_orders_client_write();

DROP TRIGGER IF EXISTS trg_zz_guard_order_items ON public.order_items;
CREATE TRIGGER trg_zz_guard_order_items
    BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_orders_client_write();

-- ─── 4. 'paid' exige prueba de pago ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_orders_paid_requires_proof()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
    IF NEW.status = 'paid'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
       AND NOT (
            NEW.provider_transaction_id IS NOT NULL
         OR NEW.wompi_transaction_id IS NOT NULL
         OR (NEW.payment_method IN ('transfer', 'cash_pickup') AND NEW.approved_by IS NOT NULL)
       ) THEN
        RAISE EXCEPTION 'PAID_WITHOUT_PROOF' USING ERRCODE = '23514',
              HINT = 'paid exige la transacción de la pasarela o la aprobación del vendedor (transferencia/efectivo).';
    END IF;
    RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_orders_paid_requires_proof() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_paid_requires_proof ON public.orders;
CREATE TRIGGER trg_orders_paid_requires_proof
    BEFORE INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_orders_paid_requires_proof();

-- ─── 5b. Historial: lo escribe un trigger, nadie más ─────────────────────────
-- Las RPC de M-F0-4 pueden fijar sportmaps.order_actor_role / sportmaps.order_note
-- (set_config local) para dejar actor y nota; el cliente no puede fijar GUC.
CREATE OR REPLACE FUNCTION public.fn_orders_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_uid  uuid := auth.uid();
    v_role text := NULLIF(current_setting('sportmaps.order_actor_role', true), '');
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NULL;
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

REVOKE ALL ON FUNCTION public.fn_orders_status_history() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_status_history ON public.orders;
CREATE TRIGGER trg_orders_status_history
    AFTER INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_orders_status_history();

-- ¿Quien llama puede ver esta orden? (comprador, tienda, super admin). DEFINER
-- para que la policy de order_status_history no dependa de la RLS de orders.
CREATE OR REPLACE FUNCTION public.order_visible_to_me(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT EXISTS (
        SELECT 1 FROM public.orders o
         WHERE o.id = p_order_id
           AND auth.uid() IS NOT NULL
           AND (o.user_id = auth.uid()
                OR public.can_manage_store(o.vendor_profile_id)
                OR public._order_has_vendor_item(o.id)
                OR public.is_super_admin())
    );
$fn$;

REVOKE ALL ON FUNCTION public.order_visible_to_me(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_visible_to_me(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS order_status_history_select ON public.order_status_history;
CREATE POLICY order_status_history_select ON public.order_status_history
    FOR SELECT TO authenticated
    USING (public.order_visible_to_me(order_id));

REVOKE ALL ON public.order_status_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_status_history TO authenticated;
GRANT ALL    ON public.order_status_history TO service_role;

-- ─── 6. Lectura del vendedor por tienda (admins incluidos) ───────────────────
DROP POLICY IF EXISTS orders_select_vendor ON public.orders;
CREATE POLICY orders_select_vendor ON public.orders
    FOR SELECT TO authenticated
    USING (public.can_manage_store(vendor_profile_id) OR public._order_has_vendor_item(id));

DROP POLICY IF EXISTS order_items_select_vendor ON public.order_items;
CREATE POLICY order_items_select_vendor ON public.order_items
    FOR SELECT TO authenticated
    USING (public.can_manage_store(vendor_profile_id)
           OR public.store_can_manage_product(product_id)
           OR EXISTS (SELECT 1 FROM public.products p
                       WHERE p.id = order_items.product_id AND p.vendor_id = (SELECT auth.uid())));

-- ─── 7a. disable_vendor_profile con los estados nuevos ───────────────────────
CREATE OR REPLACE FUNCTION public.disable_vendor_profile()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_user_id        uuid := auth.uid();
    v_vp_id          uuid;
    v_pending_orders integer := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_vp_id FROM public.vendor_profiles WHERE user_id = v_user_id;

    SELECT count(DISTINCT o.id) INTO v_pending_orders
      FROM public.orders o
      LEFT JOIN public.order_items oi ON oi.order_id = o.id
      LEFT JOIN public.products    p  ON p.id = oi.product_id
     WHERE (p.vendor_id = v_user_id OR (v_vp_id IS NOT NULL AND o.vendor_profile_id = v_vp_id))
       AND o.status IN ('pending_payment','awaiting_approval','payment_review','paid',
                        'preparing','ready_for_pickup','shipped');

    IF v_pending_orders > 0 THEN
        RAISE EXCEPTION 'No puedes desactivar tu tienda mientras tengas % ordenes en proceso.', v_pending_orders
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.vendor_profiles
       SET is_active = false, updated_at = now()
     WHERE user_id = v_user_id;

    RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.disable_vendor_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disable_vendor_profile() TO authenticated, service_role;

-- ─── 7b. confirm_order_payment: acepta pending_payment ───────────────────────
-- Mismo cuerpo que el vivo; cambia la lista de estados de origen y el
-- search_path. M-F0-4 reescribe la de 5 args y M-F0-9 borra la de 4.
CREATE OR REPLACE FUNCTION public.confirm_order_payment(
    p_order_id uuid, p_wompi_reference text, p_wompi_transaction_id text,
    p_payment_method_type text DEFAULT 'CARD'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_stock_before INT;
    v_stock_after INT;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

    IF v_order.status = 'paid' AND v_order.wompi_transaction_id = p_wompi_transaction_id THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END IF;

    IF v_order.status NOT IN ('pending_payment', 'payment_review') THEN
        RAISE EXCEPTION 'order_not_pending: %', v_order.status;
    END IF;

    FOR v_item IN
        SELECT id, product_id, variant_id, quantity
        FROM public.order_items
        WHERE order_id = p_order_id
        ORDER BY product_id, variant_id NULLS FIRST
    LOOP
        IF v_item.variant_id IS NOT NULL THEN
            SELECT stock INTO v_stock_before FROM public.product_variants WHERE id = v_item.variant_id FOR UPDATE;
            IF v_stock_before IS NULL OR v_stock_before < v_item.quantity THEN
                RAISE EXCEPTION 'insufficient_stock_variant: %', v_item.variant_id;
            END IF;
            v_stock_after := v_stock_before - v_item.quantity;
            UPDATE public.product_variants SET stock = v_stock_after, updated_at = NOW() WHERE id = v_item.variant_id;
        ELSE
            SELECT stock INTO v_stock_before FROM public.products WHERE id = v_item.product_id FOR UPDATE;
            IF v_stock_before IS NULL OR v_stock_before < v_item.quantity THEN
                RAISE EXCEPTION 'insufficient_stock_product: %', v_item.product_id;
            END IF;
            v_stock_after := v_stock_before - v_item.quantity;
            UPDATE public.products SET stock = v_stock_after, updated_at = NOW() WHERE id = v_item.product_id;
        END IF;

        INSERT INTO public.inventory_logs (
            product_id, variant_id, vendor_id, delta, stock_before, stock_after, reason, order_id
        ) VALUES (
            v_item.product_id, v_item.variant_id,
            (SELECT vendor_id FROM public.products WHERE id = v_item.product_id),
            -v_item.quantity, v_stock_before, v_stock_after, 'order_paid', p_order_id
        );
    END LOOP;

    UPDATE public.orders
    SET status = 'paid',
        wompi_reference = p_wompi_reference,
        wompi_transaction_id = p_wompi_transaction_id,
        payment_method = COALESCE(p_payment_method_type, 'wompi'),
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'wompi_reference', p_wompi_reference);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.confirm_order_payment(
    p_order_id uuid, p_wompi_reference text, p_wompi_transaction_id text,
    p_payment_method_type text DEFAULT 'CARD'::text, p_provider text DEFAULT 'wompi'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_stock_before INT;
    v_stock_after INT;
    v_provider public.payment_provider := public.resolve_payment_provider(p_provider);
    v_is_wompi BOOLEAN := v_provider = 'wompi';
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

    IF v_order.status = 'paid'
       AND v_order.provider_transaction_id = p_wompi_transaction_id
       AND v_order.payment_provider = v_provider
    THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END IF;

    IF v_order.status = 'paid'
       AND v_is_wompi
       AND v_order.wompi_transaction_id = p_wompi_transaction_id
    THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true, 'legacy_match', true);
    END IF;

    IF v_order.status NOT IN ('pending_payment', 'payment_review') THEN
        RAISE EXCEPTION 'order_not_pending: %', v_order.status;
    END IF;

    FOR v_item IN
        SELECT id, product_id, variant_id, quantity
        FROM public.order_items
        WHERE order_id = p_order_id
        ORDER BY product_id, variant_id NULLS FIRST
    LOOP
        IF v_item.variant_id IS NOT NULL THEN
            SELECT stock INTO v_stock_before FROM public.product_variants WHERE id = v_item.variant_id FOR UPDATE;
            IF v_stock_before IS NULL OR v_stock_before < v_item.quantity THEN
                RAISE EXCEPTION 'insufficient_stock_variant: %', v_item.variant_id;
            END IF;
            v_stock_after := v_stock_before - v_item.quantity;
            UPDATE public.product_variants SET stock = v_stock_after, updated_at = NOW() WHERE id = v_item.variant_id;
        ELSE
            SELECT stock INTO v_stock_before FROM public.products WHERE id = v_item.product_id FOR UPDATE;
            IF v_stock_before IS NULL OR v_stock_before < v_item.quantity THEN
                RAISE EXCEPTION 'insufficient_stock_product: %', v_item.product_id;
            END IF;
            v_stock_after := v_stock_before - v_item.quantity;
            UPDATE public.products SET stock = v_stock_after, updated_at = NOW() WHERE id = v_item.product_id;
        END IF;

        INSERT INTO public.inventory_logs (
            product_id, variant_id, vendor_id, delta, stock_before, stock_after, reason, order_id
        ) VALUES (
            v_item.product_id, v_item.variant_id,
            (SELECT vendor_id FROM public.products WHERE id = v_item.product_id),
            -v_item.quantity, v_stock_before, v_stock_after, 'order_paid', p_order_id
        );
    END LOOP;

    UPDATE public.orders
    SET status = 'paid',
        payment_provider = v_provider,
        provider_reference = p_wompi_reference,
        provider_transaction_id = p_wompi_transaction_id,
        wompi_reference = CASE WHEN v_is_wompi THEN p_wompi_reference ELSE wompi_reference END,
        wompi_transaction_id = CASE WHEN v_is_wompi THEN p_wompi_transaction_id ELSE wompi_transaction_id END,
        payment_method = COALESCE(p_payment_method_type, v_provider::text),
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'provider', v_provider,
        'provider_reference', p_wompi_reference
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, text, text, text)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, text, text)       TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, text, text, text) TO service_role;

COMMIT;
