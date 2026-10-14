-- =============================================================================
-- 20261013170553_tienda_compra_sin_cuenta.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-13   Versión anterior: 20261013170548
-- Objetivo: compra SIN cuenta en la tienda (D-13 del spec tienda v2, §2.1
--   "Pedido de invitado"). Primer cliente: GYM RM, 205 socios y 2 con cuenta;
--   el carrito funcionaba sin sesión pero "Pagar" exigía iniciar sesión y se
--   perdían ventas.
--
--   1. platform_config 'store_guest_checkout': encendido + límites
--      configurables (monto máximo por pedido, pedidos por correo/hora, por
--      IP/hora, pedidos abiertos por correo, vigencia del enlace).
--   2. store_guest_checkout_log: rastro mínimo para los límites (hash del
--      correo y de la IP, nunca en claro). RLS sin policies, sin grants.
--   3. create_cart_order acepta p_buyer_id NULL SOLO cuando lo llama
--      create_guest_cart_order (service role + marca de transacción). Con JWT
--      el comprador sigue siendo auth.uid() y NULL sigue siendo
--      NOT_AUTHENTICATED. Se parchea el cuerpo VIGENTE (no se reescribe): así
--      no pisa lo que 20261013170543 (cupones) le haya hecho a la función; el
--      p_coupon_code pasa igual, sin lógica duplicada aquí.
--   4. create_guest_cart_order (solo service role, la llama el BFF): correo y
--      nombre obligatorios, teléfono opcional; productos school_only/private
--      → LOGIN_REQUIRED; límites; monto máximo; token de acceso al pedido
--      (se devuelve UNA vez, se guarda sha256 en orders.guest_token_hash).
--   5. RPC por token (solo service role): ver el pedido (estado, ítems,
--      historial, cuentas para transferir, sede), subir comprobante,
--      regenerar el código de retiro (mismo tope de 3 que el logueado,
--      mismo rastro) y cancelar.
--   6. Vinculación: al confirmar el correo (trigger en auth.users) y con
--      link_my_guest_orders() (JWT, correo confirmado) los pedidos de
--      invitado con ese correo pasan a la cuenta.
--
-- Depende de: tienda v2 F0 (20261003230007: create_cart_order, orders.guest_*,
--   _store_order_summary, _store_set_actor), 20261008163336
--   (_store_transfer_accounts, _store_pickup_branches) y 20261008163338
--   (regenerate_my_pickup_code: misma nota de auditoría).
-- Nada se abre a anon: todas las funciones nuevas son de service_role salvo
--   link_my_guest_orders (authenticated, actúa solo sobre auth.uid()).
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
    IF to_regprocedure('public.create_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, uuid)') IS NULL THEN
        RAISE EXCEPTION 'Falta create_cart_order (20261003230007): aplicarla antes.';
    END IF;
    IF to_regprocedure('public._store_transfer_accounts(uuid)') IS NULL
       OR to_regprocedure('public._store_pickup_branches(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Falta 20261008163336 (cuentas y sedes de la tienda): aplicarla antes.';
    END IF;
    IF to_regprocedure('public.regenerate_my_pickup_code(uuid, uuid)') IS NULL THEN
        RAISE EXCEPTION 'Falta 20261008163338 (código de retiro regenerable): aplicarla antes.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'guest_token_hash')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'guest_email') THEN
        RAISE EXCEPTION 'Faltan orders.guest_email / guest_token_hash (tienda v2 F0).';
    END IF;
END
$pre$;

-- ─── 1. Configuración ────────────────────────────────────────────────────────
INSERT INTO public.platform_config (key, value, description)
VALUES ('store_guest_checkout',
        jsonb_build_object(
            'enabled', true,
            'max_order_amount', 1000000,        -- COP por pedido de invitado
            'max_orders_per_email_hour', 3,
            'max_orders_per_ip_hour', 10,
            'max_open_orders_per_email', 3,     -- sin pagar a la vez (anti-acaparar stock)
            'token_ttl_days', 180),             -- vida del enlace /pedido/:token
        'Tienda: compra sin cuenta (mig. 20261013170553). enabled + límites anti-abuso.')
ON CONFLICT (key) DO NOTHING;

-- Defaults si la fila falta o viene incompleta/mal formada (fail-safe: valores conservadores).
CREATE OR REPLACE FUNCTION public._store_guest_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT jsonb_build_object(
               'enabled', false,
               'max_order_amount', 1000000,
               'max_orders_per_email_hour', 3,
               'max_orders_per_ip_hour', 10,
               'max_open_orders_per_email', 3,
               'token_ttl_days', 180)
        || COALESCE((SELECT c.value FROM public.platform_config c
                      WHERE c.key = 'store_guest_checkout' AND jsonb_typeof(c.value) = 'object'), '{}'::jsonb);
$fn$;

-- Entero positivo de la config, o el default.
CREATE OR REPLACE FUNCTION public._store_guest_cfg_int(p_cfg jsonb, p_key text, p_default integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT CASE WHEN jsonb_typeof(p_cfg -> p_key) = 'number' AND (p_cfg ->> p_key)::numeric >= 0
                     AND (p_cfg ->> p_key)::numeric < 2147483647
                THEN floor((p_cfg ->> p_key)::numeric)::integer
                ELSE p_default END;
$fn$;

-- ─── 2. Rastro para los límites ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_guest_checkout_log (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id          uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    vendor_profile_id uuid,
    email_hash        text NOT NULL CHECK (email_hash ~ '^[0-9a-f]{64}$'),
    ip_hash           text CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$'),
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_guest_checkout_log_email_idx ON public.store_guest_checkout_log (email_hash, created_at);
CREATE INDEX IF NOT EXISTS store_guest_checkout_log_ip_idx ON public.store_guest_checkout_log (ip_hash, created_at) WHERE ip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS store_guest_checkout_log_created_idx ON public.store_guest_checkout_log (created_at);

ALTER TABLE public.store_guest_checkout_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_guest_checkout_log FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.store_guest_checkout_log IS
'Tienda: un renglón por pedido de invitado creado (hash del correo y de la IP) para los límites por hora. Solo lo escriben/leen las RPC de invitado (SECURITY DEFINER). Se purga a los 30 días.';

-- Búsqueda por token y por correo de invitado.
CREATE UNIQUE INDEX IF NOT EXISTS orders_guest_token_hash_uq ON public.orders (guest_token_hash) WHERE guest_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_guest_email_idx ON public.orders (guest_email) WHERE guest_email IS NOT NULL;

-- ─── 3. create_cart_order: comprador NULL solo para el invitado ──────────────
-- Se parchea el cuerpo VIGENTE (puede venir de 20261013170543, cupones): solo
-- se cambia la guarda del comprador. Si el ancla no está, la migración falla
-- en vez de adivinar.
DO $patch$
DECLARE
    v_def text := pg_get_functiondef('public.create_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, uuid)'::regprocedure);
    v_re  text := 'IF v_buyer IS NULL THEN\s*RAISE EXCEPTION ''NOT_AUTHENTICATED''[^;]*;\s*END IF;';
    v_new text;
BEGIN
    IF position('sportmaps.guest_checkout' IN v_def) > 0 THEN
        RAISE NOTICE 'create_cart_order ya acepta invitado: sin cambios';
        RETURN;
    END IF;
    IF (SELECT count(*) FROM regexp_matches(v_def, v_re, 'g')) <> 1 THEN
        RAISE EXCEPTION 'No encuentro (exactamente una vez) la guarda del comprador en create_cart_order: revisar a mano.';
    END IF;
    v_new := regexp_replace(v_def, v_re,
$r$-- Invitado (mig. 20261013170553): comprador NULL SOLO si lo pide
    -- create_guest_cart_order (service role + marca local de la transacción),
    -- que ya validó correo, límites y productos. Con JWT nunca.
    IF v_buyer IS NULL
       AND NOT (COALESCE(auth.role(), '') = 'service_role'
                AND COALESCE(current_setting('sportmaps.guest_checkout', true), '') = 'on') THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501',
              HINT = 'Sin cuenta: usa la compra como invitado.';
    END IF;$r$);
    EXECUTE v_new;   -- CREATE OR REPLACE: conserva ACL y comentario
END
$patch$;

-- ─── 4. Crear la orden de invitado ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_guest_cart_order(
    p_items           jsonb,
    p_fulfillment     text,
    p_pickup_branch   uuid,
    p_address         jsonb,
    p_buyer           jsonb,
    p_payment_method  text,
    p_coupon_code     text,
    p_idempotency_key uuid,
    p_client_ip       text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    c_uuid     CONSTANT text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    v_cfg      jsonb := public._store_guest_config();
    v_email    text;
    v_name     text;
    v_phone    text;
    v_doc      text;
    v_ip       text;
    v_ehash    text;
    v_ihash    text;
    v_n        integer;
    v_existing uuid;
    v_res      jsonb;
    v_order    uuid;
    v_total    numeric;
    v_max      integer;
    v_token    text;
    v_blocked  jsonb;
BEGIN
    -- Solo el BFF (service role). Ni anon ni authenticated tienen EXECUTE; esto es la segunda llave.
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF NOT COALESCE((v_cfg ->> 'enabled')::boolean, false) THEN
        RAISE EXCEPTION 'GUEST_CHECKOUT_DISABLED' USING ERRCODE = 'P0001';
    END IF;

    -- Datos del comprador: correo y nombre obligatorios, teléfono opcional.
    v_email := lower(btrim(COALESCE(p_buyer ->> 'email', '')));
    IF v_email = '' OR length(v_email) > 254
       OR v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' THEN
        RAISE EXCEPTION 'GUEST_EMAIL_REQUIRED' USING ERRCODE = '22023';
    END IF;
    v_name := regexp_replace(btrim(COALESCE(p_buyer ->> 'name', '')), '\s+', ' ', 'g');
    IF length(v_name) < 2 OR length(v_name) > 120 THEN
        RAISE EXCEPTION 'GUEST_NAME_REQUIRED' USING ERRCODE = '22023';
    END IF;
    v_phone := regexp_replace(COALESCE(p_buyer ->> 'phone', ''), '[\s().-]', '', 'g');
    IF v_phone <> '' AND v_phone !~ '^\+?[0-9]{7,15}$' THEN
        RAISE EXCEPTION 'INVALID_PHONE' USING ERRCODE = '22023';
    END IF;
    v_doc := NULLIF(btrim(COALESCE(p_buyer ->> 'document', '')), '');
    IF v_doc IS NOT NULL AND length(v_doc) > 40 THEN
        RAISE EXCEPTION 'INVALID_DOCUMENT' USING ERRCODE = '22023';
    END IF;
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22023';
    END IF;

    v_ehash := encode(sha256(convert_to('store-guest-email:' || v_email, 'UTF8')), 'hex');
    v_ip    := NULLIF(btrim(left(COALESCE(p_client_ip, ''), 64)), '');
    v_ihash := CASE WHEN v_ip IS NOT NULL
                    THEN encode(sha256(convert_to('store-guest-ip:' || v_ip, 'UTF8')), 'hex') END;

    -- Serializa los intentos del mismo correo (y luego de la misma IP): los
    -- límites se cuentan sin carreras. Orden fijo correo → IP: sin deadlocks.
    PERFORM pg_advisory_xact_lock(hashtextextended('store-guest-email:' || v_email, 11));
    IF v_ihash IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('store-guest-ip:' || v_ip, 11));
    END IF;

    -- Idempotencia: el mismo clic reintentado devuelve la misma orden (sin
    -- token: solo se entrega una vez; el enlace ya salió por correo).
    SELECT o.id INTO v_existing FROM public.orders o
     WHERE o.guest_email = v_email AND o.idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
        RETURN public._store_order_summary(v_existing)
            || jsonb_build_object('idempotent', true, 'access_token', NULL, 'guest_email', v_email);
    END IF;

    -- school_only / private: solo con cuenta (la base también lo rechaza en
    -- create_cart_order; aquí con un código que la UI entiende).
    SELECT jsonb_agg(DISTINCT p.id) INTO v_blocked
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END) e
      LEFT JOIN public.product_variants pv
             ON (e ->> 'variant_id') ~ c_uuid AND pv.id = (e ->> 'variant_id')::uuid
      JOIN public.products p
        ON p.id = COALESCE(pv.product_id, CASE WHEN (e ->> 'product_id') ~ c_uuid THEN (e ->> 'product_id')::uuid END)
     WHERE p.visibility::text <> 'public';
    IF v_blocked IS NOT NULL THEN
        RAISE EXCEPTION 'LOGIN_REQUIRED' USING ERRCODE = 'P0001', DETAIL = v_blocked::text,
              HINT = 'Productos solo para miembros: inicia sesión.';
    END IF;

    -- Límites.
    SELECT count(*) INTO v_n FROM public.store_guest_checkout_log
     WHERE email_hash = v_ehash AND created_at > now() - interval '1 hour';
    IF v_n >= public._store_guest_cfg_int(v_cfg, 'max_orders_per_email_hour', 3) THEN
        RAISE EXCEPTION 'GUEST_RATE_LIMITED' USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object('scope', 'email', 'retry_after_minutes', 60)::text;
    END IF;
    IF v_ihash IS NOT NULL THEN
        SELECT count(*) INTO v_n FROM public.store_guest_checkout_log
         WHERE ip_hash = v_ihash AND created_at > now() - interval '1 hour';
        IF v_n >= public._store_guest_cfg_int(v_cfg, 'max_orders_per_ip_hour', 10) THEN
            RAISE EXCEPTION 'GUEST_RATE_LIMITED' USING ERRCODE = 'P0001',
                  DETAIL = jsonb_build_object('scope', 'ip', 'retry_after_minutes', 60)::text;
        END IF;
    END IF;
    SELECT count(*) INTO v_n FROM public.orders o
     WHERE o.guest_email = v_email AND o.user_id IS NULL
       AND o.status IN ('pending_payment', 'awaiting_approval');
    IF v_n >= public._store_guest_cfg_int(v_cfg, 'max_open_orders_per_email', 3) THEN
        RAISE EXCEPTION 'GUEST_OPEN_ORDERS_LIMIT' USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object('open', v_n)::text;
    END IF;

    -- La orden la arma el motor de siempre (precio, IVA, stock, envío, medio,
    -- cupón) con comprador NULL.
    PERFORM set_config('sportmaps.guest_checkout', 'on', true);
    v_res := public.create_cart_order(
        p_items, p_fulfillment, p_pickup_branch, p_address,
        jsonb_strip_nulls(jsonb_build_object(
            'name', v_name, 'email', v_email, 'phone', NULLIF(v_phone, ''), 'document', v_doc,
            'notes', NULLIF(left(btrim(COALESCE(p_buyer ->> 'notes', '')), 1000), ''))),
        p_payment_method, p_coupon_code, NULL, p_idempotency_key);
    PERFORM set_config('sportmaps.guest_checkout', 'off', true);

    v_order := (v_res ->> 'order_id')::uuid;
    v_total := (v_res ->> 'total')::numeric;
    v_max   := public._store_guest_cfg_int(v_cfg, 'max_order_amount', 1000000);
    IF v_total > v_max THEN
        -- La excepción deshace la orden, los ítems y las reservas.
        RAISE EXCEPTION 'GUEST_AMOUNT_LIMIT' USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object('max', v_max, 'total', v_total)::text,
              HINT = 'Para compras mayores, crea tu cuenta.';
    END IF;

    -- Token del enlace mágico /pedido/:token: 2 × uuid v4 = 244 bits. Se
    -- devuelve UNA vez; la base guarda solo el sha256.
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    UPDATE public.orders
       SET guest_email = v_email,
           guest_token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
           updated_at = now()
     WHERE id = v_order;

    INSERT INTO public.store_guest_checkout_log (order_id, vendor_profile_id, email_hash, ip_hash)
    VALUES (v_order, NULLIF(v_res ->> 'vendor_profile_id', '')::uuid, v_ehash, v_ihash);
    DELETE FROM public.store_guest_checkout_log WHERE created_at < now() - interval '30 days';

    RETURN v_res || jsonb_build_object('idempotent', false, 'access_token', v_token, 'guest_email', v_email);
END;
$fn$;

COMMENT ON FUNCTION public.create_guest_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, text) IS
'Tienda: pedido SIN cuenta (solo service role / BFF). Correo y nombre obligatorios; school_only → LOGIN_REQUIRED; límites por correo/IP/hora, pedidos abiertos y monto (platform_config store_guest_checkout). Devuelve access_token UNA vez (se guarda sha256).';

-- ─── 5. Acceso por token ─────────────────────────────────────────────────────
-- Orden del token, o NOT_FOUND (token mal formado, inexistente o vencido: indistinguibles).
CREATE OR REPLACE FUNCTION public._store_guest_order_id(p_token text, p_lock boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_ttl integer := public._store_guest_cfg_int(public._store_guest_config(), 'token_ttl_days', 180);
    v_id  uuid;
BEGIN
    IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF p_lock THEN
        SELECT o.id INTO v_id FROM public.orders o
         WHERE o.guest_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
           AND o.created_at > now() - make_interval(days => v_ttl)
           FOR UPDATE;
    ELSE
        SELECT o.id INTO v_id FROM public.orders o
         WHERE o.guest_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
           AND o.created_at > now() - make_interval(days => v_ttl);
    END IF;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.guest_order_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_id    uuid;
    v_o     public.orders%ROWTYPE;
    v_vp    public.vendor_profiles%ROWTYPE;
    v_regen integer;
    v_email text;
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    v_id := public._store_guest_order_id(p_token, false);
    SELECT * INTO v_o FROM public.orders WHERE id = v_id;
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE id = v_o.vendor_profile_id;

    SELECT count(*) INTO v_regen FROM public.order_status_history h
     WHERE h.order_id = v_o.id AND h.actor_role = 'buyer'
       AND h.from_status IS NOT DISTINCT FROM h.to_status
       AND h.note LIKE 'Código de retiro regenerado por el comprador%';

    -- Correo enmascarado (quien tiene el enlace ya lo sabe; igual no se repite entero).
    v_email := COALESCE(v_o.guest_email, '');
    v_email := CASE WHEN position('@' IN v_email) > 2
                    THEN left(v_email, 2) || repeat('•', 3) || substr(v_email, position('@' IN v_email))
                    ELSE v_email END;

    RETURN jsonb_build_object(
        'order', jsonb_build_object(
            'id', v_o.id, 'reference', v_o.reference, 'status', v_o.status,
            'payment_method', v_o.payment_method, 'fulfillment_mode', v_o.fulfillment_mode,
            'subtotal', v_o.subtotal, 'discount_total', v_o.discount_total, 'tax_total', v_o.tax_total,
            'shipping_cost', v_o.shipping_cost, 'total_amount', v_o.total_amount,
            'expires_at', v_o.expires_at, 'created_at', v_o.created_at, 'paid_at', v_o.paid_at,
            'receipt_submitted_at', v_o.receipt_submitted_at, 'has_receipt', v_o.receipt_path IS NOT NULL,
            'rejection_reason', v_o.rejection_reason, 'tracking_number', v_o.tracking_number,
            'shipping_carrier', v_o.shipping_carrier, 'shipping_address', v_o.shipping_address,
            'customer_name', COALESCE(v_o.customer_name, v_o.buyer_snapshot ->> 'name'),
            'email_masked', v_email,
            'linked_to_account', v_o.user_id IS NOT NULL,
            'vendor_profile_id', v_o.vendor_profile_id),
        'items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', oi.id, 'product_id', oi.product_id, 'variant_id', oi.variant_id,
                       'name', p.name, 'variant_name', v.name, 'image_url', p.image_url,
                       'quantity', oi.quantity, 'unit_price', oi.unit_price, 'line_total', oi.line_total)
                       ORDER BY oi.created_at, oi.id)
              FROM public.order_items oi
              JOIN public.products p ON p.id = oi.product_id
              LEFT JOIN public.product_variants v ON v.id = oi.variant_id
             WHERE oi.order_id = v_o.id), '[]'::jsonb),
        'history', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', h.id, 'from_status', h.from_status, 'to_status', h.to_status,
                       'actor_role', h.actor_role, 'note', h.note, 'created_at', h.created_at)
                       ORDER BY h.created_at, h.id)
              FROM public.order_status_history h WHERE h.order_id = v_o.id), '[]'::jsonb),
        'store', jsonb_build_object(
            'display_name', v_vp.display_name, 'slug', v_vp.slug, 'logo_url', v_vp.logo_url),
        'pickup_branch', (
            SELECT jsonb_build_object('id', b.id, 'name', b.name, 'address', b.address)
              FROM public.school_branches b WHERE b.id = v_o.pickup_branch_id),
        'transfer', CASE WHEN v_o.payment_method = 'transfer'
                              AND v_o.status IN ('pending_payment', 'awaiting_approval')
                         THEN jsonb_build_object(
                                  'accounts', public._store_transfer_accounts(v_o.vendor_profile_id),
                                  'instructions', (SELECT s.transfer_instructions FROM public.store_payment_settings s
                                                    WHERE s.vendor_profile_id = v_o.vendor_profile_id),
                                  'amount', v_o.total_amount, 'reference', v_o.reference,
                                  'expires_at', v_o.expires_at) END,
        'pickup', jsonb_build_object(
            'regenerations_used', v_regen,
            'regenerations_max', 3,
            'can_regenerate', v_o.fulfillment_mode = 'pickup'
                              AND v_o.status IN ('paid', 'preparing', 'ready_for_pickup')
                              AND v_regen < 3)
    );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.guest_order_submit_receipt(p_token text, p_receipt_path text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_id uuid;
    v_o  public.orders%ROWTYPE;
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    v_id := public._store_guest_order_id(p_token, true);
    SELECT * INTO v_o FROM public.orders WHERE id = v_id;
    -- Mismas reglas que submit_order_receipt (20261003230007).
    IF v_o.payment_method IS DISTINCT FROM 'transfer' THEN
        RAISE EXCEPTION 'NOT_A_TRANSFER_ORDER' USING ERRCODE = 'P0001';
    END IF;
    IF v_o.status NOT IN ('pending_payment', 'awaiting_approval') THEN
        RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE = 'P0001', DETAIL = v_o.status;
    END IF;
    IF v_o.status = 'pending_payment' AND v_o.expires_at IS NOT NULL AND v_o.expires_at < now() THEN
        RAISE EXCEPTION 'ORDER_EXPIRED' USING ERRCODE = 'P0001';
    END IF;
    IF p_receipt_path IS NULL OR p_receipt_path !~ ('^' || v_o.id::text || '/[A-Za-z0-9._-]{1,120}$') THEN
        RAISE EXCEPTION 'INVALID_RECEIPT_PATH' USING ERRCODE = '22023',
              HINT = 'Ruta esperada: {order_id}/{archivo} en el bucket order-receipts.';
    END IF;

    PERFORM public._store_set_actor('buyer', v_o.user_id, 'comprobante enviado (enlace del pedido)');
    UPDATE public.orders
       SET status = 'awaiting_approval',
           receipt_path = p_receipt_path,
           receipt_submitted_at = now(),
           rejection_reason = NULL,
           updated_at = now()
     WHERE id = v_o.id;

    RETURN public._store_order_summary(v_o.id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.guest_order_regenerate_pickup_code(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    -- Mismo tope y misma nota que regenerate_my_pickup_code (20261008163338):
    -- el conteo es UNO por pedido, se regenere por la cuenta o por el enlace.
    c_max   CONSTANT integer := 3;
    c_note  CONSTANT text    := 'Código de retiro regenerado por el comprador';
    v_id    uuid;
    v_o     public.orders%ROWTYPE;
    v_used  integer;
    v_code  text;
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    v_id := public._store_guest_order_id(p_token, true);
    SELECT * INTO v_o FROM public.orders WHERE id = v_id;
    IF v_o.fulfillment_mode IS DISTINCT FROM 'pickup' THEN
        RAISE EXCEPTION 'NOT_A_PICKUP_ORDER' USING ERRCODE = 'P0001';
    END IF;
    IF v_o.status NOT IN ('paid', 'preparing', 'ready_for_pickup') THEN
        RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE = 'P0001', DETAIL = v_o.status;
    END IF;

    SELECT count(*) INTO v_used
      FROM public.order_status_history h
     WHERE h.order_id = v_o.id
       AND h.actor_role = 'buyer'
       AND h.from_status IS NOT DISTINCT FROM h.to_status
       AND h.note LIKE c_note || '%';
    IF v_used >= c_max THEN
        RAISE EXCEPTION 'PICKUP_CODE_LIMIT' USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object('max', c_max, 'used', v_used)::text;
    END IF;

    v_code := lpad((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0');
    UPDATE public.orders
       SET pickup_code_hash = encode(sha256(convert_to(v_code || ':' || v_o.id::text, 'UTF8')), 'hex'),
           updated_at = now()
     WHERE id = v_o.id;

    INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
    VALUES (v_o.id, v_o.status, v_o.status,
            (SELECT p.id FROM public.profiles p WHERE p.id = v_o.user_id), 'buyer',
            c_note || ' (' || (v_used + 1) || ' de ' || c_max || '); el anterior dejó de servir');

    RETURN jsonb_build_object(
        'order_id', v_o.id,
        'status', v_o.status,
        'pickup_code', v_code,
        'regenerations_used', v_used + 1,
        'regenerations_left', c_max - (v_used + 1),
        'regenerations_max', c_max);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.guest_order_cancel(p_token text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_id uuid;
    v_o  public.orders%ROWTYPE;
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    v_id := public._store_guest_order_id(p_token, true);
    SELECT * INTO v_o FROM public.orders WHERE id = v_id;
    IF v_o.status NOT IN ('pending_payment', 'awaiting_approval') THEN
        RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE = 'P0001', DETAIL = v_o.status;
    END IF;
    PERFORM public._store_release_holds(v_o.id, 'released');
    PERFORM public._store_set_actor('buyer', v_o.user_id,
        COALESCE(NULLIF(left(btrim(COALESCE(p_reason, '')), 500), ''), 'cancelada por el comprador (enlace del pedido)'));
    UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = v_o.id;
    RETURN public._store_order_summary(v_o.id);
END;
$fn$;

-- ─── 6. Vincular pedidos de invitado a la cuenta ─────────────────────────────
CREATE OR REPLACE FUNCTION public._store_link_guest_orders(p_user uuid, p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_email text := lower(btrim(COALESCE(p_email, '')));
    v_n     integer := 0;
    r       record;
BEGIN
    IF p_user IS NULL OR v_email = '' THEN
        RETURN 0;
    END IF;
    FOR r IN
        SELECT o.id, o.status FROM public.orders o
         WHERE o.user_id IS NULL AND o.guest_email = v_email
         ORDER BY o.created_at
           FOR UPDATE
    LOOP
        UPDATE public.orders SET user_id = p_user, updated_at = now() WHERE id = r.id;
        INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
        VALUES (r.id, r.status, r.status, (SELECT p.id FROM public.profiles p WHERE p.id = p_user), 'system',
                'Pedido vinculado a la cuenta del comprador (correo verificado)');
        v_n := v_n + 1;
    END LOOP;
    RETURN v_n;
END;
$fn$;

-- Al confirmar el correo (registro normal: email_confirmed_at pasa de NULL a
-- una fecha). Nunca bloquea la confirmación: si algo falla, solo avisa.
CREATE OR REPLACE FUNCTION public.fn_store_link_guest_orders_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
BEGIN
    IF NEW.email IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
        BEGIN
            PERFORM public._store_link_guest_orders(NEW.id, NEW.email);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'store: no se pudieron vincular pedidos de invitado de %: %', NEW.id, SQLERRM;
        END;
    END IF;
    RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_store_link_guest_orders_on_confirm ON auth.users;
CREATE TRIGGER trg_store_link_guest_orders_on_confirm
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_store_link_guest_orders_on_confirm();

-- Para quien ya tenía cuenta (o entró por Google): la app la llama al abrir
-- "Mis compras". Solo actúa sobre el correo CONFIRMADO de auth.uid().
CREATE OR REPLACE FUNCTION public.link_my_guest_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_uid   uuid := auth.uid();
    v_email text;
    v_conf  timestamptz;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    SELECT u.email, u.email_confirmed_at INTO v_email, v_conf FROM auth.users u WHERE u.id = v_uid;
    IF v_email IS NULL OR v_conf IS NULL THEN
        RETURN jsonb_build_object('linked', 0, 'reason', 'EMAIL_NOT_CONFIRMED');
    END IF;
    RETURN jsonb_build_object('linked', public._store_link_guest_orders(v_uid, v_email));
END;
$fn$;

COMMENT ON FUNCTION public.link_my_guest_orders() IS
'Tienda: pasa a la cuenta de auth.uid() los pedidos de invitado hechos con SU correo confirmado. También corre solo al confirmar el correo (trigger en auth.users).';

-- ─── 7. Permisos ─────────────────────────────────────────────────────────────
-- Los default privileges dan EXECUTE a anon/authenticated en cada función
-- nueva: se revoca explícito (CLAUDE.md, trampa 3).
REVOKE ALL ON FUNCTION public._store_guest_config()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_guest_cfg_int(jsonb, text, integer)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_guest_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_guest_order_id(text, boolean)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_order_view(text)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_order_submit_receipt(text, text)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_order_regenerate_pickup_code(text)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_order_cancel(text, text)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_link_guest_orders(uuid, text)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_store_link_guest_orders_on_confirm()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_my_guest_orders()                      FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_guest_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_order_view(text)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_order_submit_receipt(text, text)   TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_order_regenerate_pickup_code(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_order_cancel(text, text)           TO service_role;
GRANT EXECUTE ON FUNCTION public.link_my_guest_orders()                   TO authenticated, service_role;

COMMIT;
