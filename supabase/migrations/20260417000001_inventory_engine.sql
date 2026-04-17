-- ============================================================
-- SPORTMAPS MARKETPLACE — FASE 6: MOTOR DE INVENTARIO
-- Stock holds (reserva temporal), inventory transactions
-- (auditoria), triggers de deduccion y expiracion
-- ============================================================


-- ============================================================
-- 1. TABLA stock_holds (reserva temporal de inventario)
-- Cuando un usuario agrega al carrito, se "bloquea" stock
-- por 15 minutos para evitar overselling.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stock_holds (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  uuid        REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id  uuid        REFERENCES public.product_variants(id) ON DELETE CASCADE,
    user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id  text,
    quantity    integer     NOT NULL CHECK (quantity > 0),
    held_at     timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
    status      text        NOT NULL DEFAULT 'held'
                            CHECK (status IN ('held', 'converted', 'expired')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT stock_holds_has_target
        CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL),
    CONSTRAINT stock_holds_has_owner
        CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_stock_holds_status ON public.stock_holds(status) WHERE status = 'held';
CREATE INDEX IF NOT EXISTS idx_stock_holds_expires ON public.stock_holds(expires_at) WHERE status = 'held';
CREATE INDEX IF NOT EXISTS idx_stock_holds_product ON public.stock_holds(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_holds_variant ON public.stock_holds(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_holds_user ON public.stock_holds(user_id) WHERE user_id IS NOT NULL;


-- ============================================================
-- 2. TABLA inventory_transactions (auditoria de stock)
-- Cada movimiento de inventario queda registrado.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id        uuid        REFERENCES public.product_variants(id) ON DELETE CASCADE,
    transaction_type  text        NOT NULL
                                  CHECK (transaction_type IN ('sale', 'restock', 'adjustment', 'return', 'hold', 'release')),
    quantity_change   integer     NOT NULL,
    stock_before      integer     NOT NULL,
    stock_after       integer     NOT NULL,
    reference_type    text        CHECK (reference_type IN ('order', 'manual', 'hold', 'return')),
    reference_id      uuid,
    performed_by      uuid        REFERENCES auth.users(id),
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_tx_product ON public.inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_variant ON public.inventory_transactions(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_tx_type ON public.inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_ref ON public.inventory_transactions(reference_type, reference_id) WHERE reference_id IS NOT NULL;


-- ============================================================
-- 3. RLS para stock_holds e inventory_transactions
-- ============================================================

ALTER TABLE public.stock_holds ENABLE ROW LEVEL SECURITY;

-- Usuarios ven sus propios holds
CREATE POLICY "stock_holds_select_own"
    ON public.stock_holds FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Usuarios crean sus propios holds
CREATE POLICY "stock_holds_insert_own"
    ON public.stock_holds FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Vendors ven transacciones de sus productos
CREATE POLICY "inventory_tx_select_vendor"
    ON public.inventory_transactions FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = inventory_transactions.product_id
              AND p.vendor_id = auth.uid()
        )
    );


-- ============================================================
-- 4. RPC: hold_stock
-- Reserva temporal de stock (15 min). Verifica disponibilidad.
-- ============================================================

CREATE OR REPLACE FUNCTION public.hold_stock(
    p_product_id uuid DEFAULT NULL,
    p_variant_id uuid DEFAULT NULL,
    p_quantity integer DEFAULT 1,
    p_user_id uuid DEFAULT NULL,
    p_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available integer;
    v_held integer;
    v_hold_id uuid;
BEGIN
    -- Validar input
    IF p_product_id IS NULL AND p_variant_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'product_id o variant_id requerido');
    END IF;

    IF p_user_id IS NULL AND p_session_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'user_id o session_id requerido');
    END IF;

    -- Obtener stock disponible
    IF p_variant_id IS NOT NULL THEN
        SELECT stock INTO v_available FROM product_variants WHERE id = p_variant_id;
    ELSE
        SELECT stock INTO v_available FROM products WHERE id = p_product_id;
    END IF;

    IF v_available IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Producto/variante no encontrado');
    END IF;

    -- Contar holds activos para este item
    SELECT COALESCE(SUM(quantity), 0) INTO v_held
    FROM stock_holds
    WHERE status = 'held'
      AND expires_at > now()
      AND (
          (p_variant_id IS NOT NULL AND variant_id = p_variant_id)
          OR (p_variant_id IS NULL AND product_id = p_product_id)
      );

    -- Verificar disponibilidad real (stock - holds activos)
    IF (v_available - v_held) < p_quantity THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Stock insuficiente',
            'available', v_available - v_held,
            'requested', p_quantity
        );
    END IF;

    -- Crear hold
    INSERT INTO stock_holds (product_id, variant_id, user_id, session_id, quantity)
    VALUES (p_product_id, p_variant_id, p_user_id, p_session_id, p_quantity)
    RETURNING id INTO v_hold_id;

    RETURN jsonb_build_object(
        'ok', true,
        'hold_id', v_hold_id,
        'expires_at', (now() + interval '15 minutes')::text,
        'quantity', p_quantity
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.hold_stock TO authenticated;


-- ============================================================
-- 5. FUNCTION: expire_stock_holds
-- Ejecutar periodicamente (pg_cron o BFF cron job).
-- Libera holds expirados y registra inventory_transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_stock_holds()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expired_count integer;
BEGIN
    UPDATE stock_holds
    SET status = 'expired'
    WHERE status = 'held'
      AND expires_at < now();

    GET DIAGNOSTICS v_expired_count = ROW_COUNT;

    RETURN v_expired_count;
END;
$$;


-- ============================================================
-- 6. TRIGGER: deduct_stock_on_payment
-- Cuando una orden pasa a status 'paid', descuenta stock
-- de cada item y crea inventory_transactions.
-- ============================================================

CREATE OR REPLACE FUNCTION public.deduct_stock_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_stock_before integer;
    v_new_stock integer;
BEGIN
    -- Solo ejecutar cuando status cambia a 'paid'
    IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN

        FOR v_item IN
            SELECT oi.product_id, oi.variant_id, oi.quantity
            FROM order_items oi
            WHERE oi.order_id = NEW.id
        LOOP
            IF v_item.variant_id IS NOT NULL THEN
                -- Descontar de variante
                SELECT stock INTO v_stock_before
                FROM product_variants WHERE id = v_item.variant_id FOR UPDATE;

                v_new_stock := v_stock_before - v_item.quantity;

                IF v_new_stock < 0 THEN
                    RAISE EXCEPTION 'Stock insuficiente para variante %. Stock: %, Requerido: %',
                        v_item.variant_id, v_stock_before, v_item.quantity;
                END IF;

                UPDATE product_variants SET stock = v_new_stock WHERE id = v_item.variant_id;

                INSERT INTO inventory_transactions (
                    product_id, variant_id, transaction_type,
                    quantity_change, stock_before, stock_after,
                    reference_type, reference_id, performed_by
                ) VALUES (
                    v_item.product_id, v_item.variant_id, 'sale',
                    -v_item.quantity, v_stock_before, v_new_stock,
                    'order', NEW.id, NEW.user_id
                );
            ELSE
                -- Descontar de producto padre
                SELECT stock INTO v_stock_before
                FROM products WHERE id = v_item.product_id FOR UPDATE;

                v_new_stock := v_stock_before - v_item.quantity;

                IF v_new_stock < 0 THEN
                    RAISE EXCEPTION 'Stock insuficiente para producto %. Stock: %, Requerido: %',
                        v_item.product_id, v_stock_before, v_item.quantity;
                END IF;

                UPDATE products SET stock = v_new_stock WHERE id = v_item.product_id;

                INSERT INTO inventory_transactions (
                    product_id, variant_id, transaction_type,
                    quantity_change, stock_before, stock_after,
                    reference_type, reference_id, performed_by
                ) VALUES (
                    v_item.product_id, NULL, 'sale',
                    -v_item.quantity, v_stock_before, v_new_stock,
                    'order', NEW.id, NEW.user_id
                );
            END IF;

            -- Convertir stock_holds relacionados
            UPDATE stock_holds
            SET status = 'converted'
            WHERE status = 'held'
              AND user_id = NEW.user_id
              AND (
                  (v_item.variant_id IS NOT NULL AND variant_id = v_item.variant_id)
                  OR (v_item.variant_id IS NULL AND product_id = v_item.product_id)
              );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_stock_on_payment ON public.orders;
CREATE TRIGGER trg_deduct_stock_on_payment
    AFTER UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_payment();


-- ============================================================
-- 7. TRIGGER: notify_low_stock
-- Alerta al vendedor cuando stock <= min_stock_alert
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Solo notificar si el stock bajo del umbral
    IF NEW.stock <= (
        SELECT COALESCE(min_stock_alert, 5) FROM products WHERE id = NEW.id
    ) AND (OLD.stock > NEW.stock) THEN
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            NEW.vendor_id,
            'Stock bajo',
            format('El producto "%s" tiene solo %s unidades restantes.', NEW.name, NEW.stock),
            'warning',
            '/vendor/products'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.products;
CREATE TRIGGER trg_notify_low_stock
    AFTER UPDATE OF stock ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();


-- ============================================================
-- 8. COMENTARIOS
-- ============================================================

COMMENT ON TABLE public.stock_holds IS 'Reservas temporales de inventario (15 min). Previene overselling al bloquear stock durante el checkout.';
COMMENT ON TABLE public.inventory_transactions IS 'Log de auditoria de todos los movimientos de stock. Cada venta, devolucion, ajuste queda registrado.';
COMMENT ON FUNCTION public.hold_stock IS 'Reserva temporal de stock. Retorna hold_id o error si no hay disponibilidad.';
COMMENT ON FUNCTION public.expire_stock_holds IS 'Libera holds expirados. Ejecutar cada 5 minutos via cron.';
