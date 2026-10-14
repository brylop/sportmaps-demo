-- =============================================================================
-- 20261013170543_tienda_cupones_por_empresa.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-13   Versión anterior: 20261013124655
-- Objetivo: cupones de descuento POR TIENDA (tienda v2 F3b, plan F0 §5.4).
--   Cada vendedor (tienda escolar o empresa externa) emite sus propios códigos;
--   la base los valida y aplica en create_cart_order (nunca el cliente),
--   prorratea el descuento por línea para que IVA y comisión salgan sobre el
--   NETO (spec §6.3 / D-1 / D-3) y el evento contable lleva el descuento.
-- =============================================================================
-- Qué hace:
--   1. store_coupons (por vendor_profile, código único por tienda sin importar
--      mayúsculas), store_coupon_redemptions (reserva → consumo → liberación) y
--      store_coupon_attempts (límite de intentos fallidos del comprador).
--      orders.coupon_code (foto del código) + FK orders.coupon_id.
--   2. Guardia BEFORE INSERT/UPDATE de store_coupons: normaliza el código,
--      valida alcance (productos de ESA tienda, categorías existentes), lo
--      vuelve inmutable cuando ya hay redenciones y sella auditoría.
--   3. RLS: quien administra la tienda (can_manage_store) ve/crea/edita SUS
--      cupones; el comprador NO los lista (valida uno por quote_cart, con
--      límite de intentos). Redenciones: la tienda y el propio comprador leen.
--   4. _store_coupon_apply(): motor único (quote_cart y create_cart_order).
--      Con p_lock bloquea la fila del cupón FOR UPDATE: dos compras por el
--      último uso se serializan y una recibe COUPON_LIMIT.
--   5. create_cart_order (misma firma de 9 args) aplica el cupón y reserva la
--      redención; quote_cart lo cotiza (pasa a VOLATILE: registra intentos).
--   6. Trigger en orders: paid/… → consumed; expired/cancelled → released.
--   7. _store_order_summary, _store_order_event_payload y order_invoice_payload
--      exponen el descuento (contabilidad y factura cuadran con lo cobrado).
--
-- Decisiones (docs/specs/tienda-v2-contrato-checkout.md §2.6):
--   · El descuento nunca supera el 90 % de lo elegible (mismo tope que el %):
--     la orden siempre tiene algo que cobrar y la línea conserva base de IVA.
--   · Prorrateo proporcional a line_total (piso), el residuo a la línea más
--     cara. IVA y comisión sobre line_total NETO; unit_price queda el de lista.
--   · orders.subtotal = productos ANTES del descuento; total = subtotal −
--     discount_total + envío. El envío nunca se descuenta.
--   · v1: solo financia el vendedor (funded_by='vendor'); la columna y
--     platform_share_pct quedan para co-financiado por SportMaps (D-20). La
--     constraint store_coupons_v1_solo_vendedor es la que se suelta entonces.
--   · Pago tardío de una orden vencida (redención liberada): se re-consume
--     aunque pase el tope (la plata ya entró con ese precio).
--   · Comprador sin sesión (p_buyer NULL): COUPON_LOGIN_REQUIRED. La compra
--     sin cuenta (20261013170553) decide cómo identificar al invitado y se
--     monta encima de ESTA versión de create_cart_order.
--
-- Recordatorios (CLAUDE.md): inmutable; search_path fijo; GRANT/REVOKE
-- explícitos; text + CHECK; sin FOR ALL (I3); sin self-recursion en RLS.
-- =============================================================================

BEGIN;

-- ─── 1. Tablas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_coupons (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id   uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    -- Si está: solo lo redimen miembros activos de ESA escuela (la empresa X le
    -- da el código a las familias de un club).
    school_id           uuid REFERENCES public.schools(id) ON DELETE CASCADE,
    code                text NOT NULL,
    description         text,
    kind                text NOT NULL,
    value               numeric(12,2) NOT NULL,
    min_subtotal        numeric(12,0) NOT NULL DEFAULT 0,
    max_discount        numeric(12,0),
    starts_at           timestamptz NOT NULL DEFAULT now(),
    ends_at             timestamptz,
    max_redemptions     integer,
    max_per_buyer       integer DEFAULT 1,
    applies_to          text NOT NULL DEFAULT 'store',
    product_ids         uuid[] NOT NULL DEFAULT '{}'::uuid[],
    category_ids        uuid[] NOT NULL DEFAULT '{}'::uuid[],
    funded_by           text NOT NULL DEFAULT 'vendor',
    platform_share_pct  numeric(5,2) NOT NULL DEFAULT 0,
    status              text NOT NULL DEFAULT 'active',
    created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT store_coupons_code_format     CHECK (code ~ '^[A-Z0-9_-]{3,30}$'),
    CONSTRAINT store_coupons_description_len CHECK (description IS NULL OR char_length(description) <= 200),
    CONSTRAINT store_coupons_kind_check      CHECK (kind IN ('percent', 'fixed')),
    CONSTRAINT store_coupons_value_check     CHECK (value > 0 AND (kind <> 'percent' OR value <= 90)
                                                    AND (kind <> 'fixed' OR value = round(value))),
    CONSTRAINT store_coupons_min_check       CHECK (min_subtotal >= 0),
    CONSTRAINT store_coupons_max_disc_check  CHECK (max_discount IS NULL OR max_discount > 0),
    CONSTRAINT store_coupons_dates_check     CHECK (ends_at IS NULL OR ends_at > starts_at),
    CONSTRAINT store_coupons_max_red_check   CHECK (max_redemptions IS NULL OR max_redemptions > 0),
    CONSTRAINT store_coupons_per_buyer_check CHECK (max_per_buyer IS NULL OR max_per_buyer > 0),
    CONSTRAINT store_coupons_applies_check   CHECK (applies_to IN ('store', 'products', 'categories')),
    CONSTRAINT store_coupons_scope_check     CHECK (
        (applies_to = 'store')
        OR (applies_to = 'products'   AND cardinality(product_ids) BETWEEN 1 AND 200)
        OR (applies_to = 'categories' AND cardinality(category_ids) BETWEEN 1 AND 50)),
    CONSTRAINT store_coupons_funded_check    CHECK (funded_by IN ('vendor', 'co_funded', 'platform')),
    CONSTRAINT store_coupons_share_check     CHECK (platform_share_pct BETWEEN 0 AND 100),
    -- v1: solo financia el vendedor (D-20). Soltar ESTA constraint para co-financiar.
    CONSTRAINT store_coupons_v1_solo_vendedor CHECK (funded_by = 'vendor' AND platform_share_pct = 0),
    CONSTRAINT store_coupons_status_check    CHECK (status IN ('active', 'paused', 'archived'))
);

COMMENT ON TABLE public.store_coupons IS
  'Tienda v2 F3b: códigos de descuento emitidos por una tienda (vendor_profile). Los aplica create_cart_order; el cliente nunca calcula el descuento. Escritura: quien administra la tienda (can_manage_store) — RLS + guardia fn_store_coupons_guard.';
COMMENT ON COLUMN public.store_coupons.value IS 'percent: 1–90 (porcentaje). fixed: pesos enteros.';
COMMENT ON COLUMN public.store_coupons.min_subtotal IS 'Mínimo de compra sobre lo ELEGIBLE (productos del alcance, IVA incluido, sin envío).';
COMMENT ON COLUMN public.store_coupons.max_discount IS 'Tope en pesos del descuento (útil para %).';
COMMENT ON COLUMN public.store_coupons.funded_by IS 'Quién absorbe el descuento. v1 solo vendor (store_coupons_v1_solo_vendedor).';

CREATE UNIQUE INDEX IF NOT EXISTS store_coupons_vendor_code_uq
    ON public.store_coupons (vendor_profile_id, upper(code));
CREATE INDEX IF NOT EXISTS store_coupons_vendor_status_idx
    ON public.store_coupons (vendor_profile_id, status);

CREATE TABLE IF NOT EXISTS public.store_coupon_redemptions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id         uuid NOT NULL REFERENCES public.store_coupons(id) ON DELETE RESTRICT,
    vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    order_id          uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    buyer_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    code              text NOT NULL,
    discount_amount   numeric(12,0) NOT NULL,
    status            text NOT NULL DEFAULT 'reserved',
    created_at        timestamptz NOT NULL DEFAULT now(),
    consumed_at       timestamptz,
    released_at       timestamptz,
    CONSTRAINT store_coupon_redemptions_order_uq     UNIQUE (order_id),
    CONSTRAINT store_coupon_redemptions_amount_check CHECK (discount_amount >= 0),
    CONSTRAINT store_coupon_redemptions_status_check CHECK (status IN ('reserved', 'consumed', 'released'))
);

COMMENT ON TABLE public.store_coupon_redemptions IS
  'Tienda v2 F3b: un uso de cupón por orden. reserved al crear la orden (con la fila del cupón FOR UPDATE), consumed al pagar, released al vencer/cancelar. Los topes cuentan reserved + consumed. Solo la escriben RPC/trigger DEFINER.';

CREATE INDEX IF NOT EXISTS store_coupon_redemptions_coupon_idx
    ON public.store_coupon_redemptions (coupon_id, status);
CREATE INDEX IF NOT EXISTS store_coupon_redemptions_buyer_idx
    ON public.store_coupon_redemptions (coupon_id, buyer_id) WHERE status IN ('reserved', 'consumed');

CREATE TABLE IF NOT EXISTS public.store_coupon_attempts (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    buyer_id          uuid NOT NULL,
    vendor_profile_id uuid,
    code_norm         text NOT NULL,
    error             text NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.store_coupon_attempts IS
  'Tienda v2 F3b: intentos FALLIDOS de cupón por comprador (anti fuerza bruta). 10 códigos distintos fallidos en 15 min → COUPON_TOO_MANY_ATTEMPTS. Sin grants ni policies: solo DEFINER.';
CREATE INDEX IF NOT EXISTS store_coupon_attempts_buyer_idx
    ON public.store_coupon_attempts (buyer_id, created_at DESC);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text;
COMMENT ON COLUMN public.orders.coupon_code IS 'Foto del código de cupón aplicado (tienda v2 F3b). El monto está en discount_total.';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_coupon_id_fkey') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_coupon_id_fkey FOREIGN KEY (coupon_id)
      REFERENCES public.store_coupons(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS orders_coupon_id_idx ON public.orders (coupon_id) WHERE coupon_id IS NOT NULL;

-- ─── 2. Guardia de escritura de cupones ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_store_coupons_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_uid  uuid := auth.uid();
    v_bad  integer;
BEGIN
    NEW.code := upper(btrim(COALESCE(NEW.code, '')));
    NEW.description := NULLIF(btrim(COALESCE(NEW.description, '')), '');
    IF NEW.kind = 'fixed' THEN
        NEW.value := round(NEW.value);
    END IF;
    NEW.product_ids  := COALESCE(NEW.product_ids, '{}'::uuid[]);
    NEW.category_ids := COALESCE(NEW.category_ids, '{}'::uuid[]);
    IF NEW.applies_to = 'store' THEN
        NEW.product_ids := '{}'::uuid[]; NEW.category_ids := '{}'::uuid[];
    ELSIF NEW.applies_to = 'products' THEN
        NEW.category_ids := '{}'::uuid[];
    ELSIF NEW.applies_to = 'categories' THEN
        NEW.product_ids := '{}'::uuid[];
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.vendor_profile_id IS DISTINCT FROM OLD.vendor_profile_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
           OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'COUPON_IMMUTABLE_FIELD' USING ERRCODE = '42501';
        END IF;
        -- Con usos, el código y la mecánica del descuento quedan congelados
        -- (lo vendido tiene que poder explicarse con el cupón que hay).
        IF (NEW.code IS DISTINCT FROM OLD.code OR NEW.kind IS DISTINCT FROM OLD.kind
            OR NEW.value IS DISTINCT FROM OLD.value)
           AND EXISTS (SELECT 1 FROM public.store_coupon_redemptions r WHERE r.coupon_id = OLD.id) THEN
            RAISE EXCEPTION 'COUPON_LOCKED' USING ERRCODE = 'P0001',
                  HINT = 'El cupón ya tiene usos: pausa este y crea otro.';
        END IF;
        NEW.updated_at := now();
        IF v_uid IS NOT NULL THEN
            NEW.updated_by := (SELECT p.id FROM public.profiles p WHERE p.id = v_uid);
        END IF;
    ELSE
        IF v_uid IS NOT NULL THEN
            NEW.created_by := (SELECT p.id FROM public.profiles p WHERE p.id = v_uid);
        END IF;
        NEW.updated_by := NEW.created_by;
        NEW.created_at := now();
        NEW.updated_at := now();
    END IF;

    IF NEW.applies_to = 'products' THEN
        SELECT count(*) INTO v_bad
          FROM unnest(NEW.product_ids) AS x(id)
         WHERE NOT EXISTS (SELECT 1 FROM public.products p
                            WHERE p.id = x.id AND p.vendor_profile_id = NEW.vendor_profile_id);
        IF v_bad > 0 THEN
            RAISE EXCEPTION 'COUPON_INVALID_SCOPE' USING ERRCODE = '22023',
                  HINT = 'Solo productos de esta tienda.';
        END IF;
    ELSIF NEW.applies_to = 'categories' THEN
        SELECT count(*) INTO v_bad
          FROM unnest(NEW.category_ids) AS x(id)
         WHERE NOT EXISTS (SELECT 1 FROM public.product_categories c WHERE c.id = x.id);
        IF v_bad > 0 THEN
            RAISE EXCEPTION 'COUPON_INVALID_SCOPE' USING ERRCODE = '22023';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_coupons_guard ON public.store_coupons;
CREATE TRIGGER trg_store_coupons_guard
    BEFORE INSERT OR UPDATE ON public.store_coupons
    FOR EACH ROW EXECUTE FUNCTION public.fn_store_coupons_guard();

-- ─── 3. RLS y permisos ────────────────────────────────────────────────────────
ALTER TABLE public.store_coupons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_coupon_attempts    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_coupons_select_manager ON public.store_coupons;
CREATE POLICY store_coupons_select_manager ON public.store_coupons
    FOR SELECT TO authenticated
    USING (public.can_manage_store(vendor_profile_id));

DROP POLICY IF EXISTS store_coupons_insert_manager ON public.store_coupons;
CREATE POLICY store_coupons_insert_manager ON public.store_coupons
    FOR INSERT TO authenticated
    WITH CHECK (public.can_manage_store(vendor_profile_id));

DROP POLICY IF EXISTS store_coupons_update_manager ON public.store_coupons;
CREATE POLICY store_coupons_update_manager ON public.store_coupons
    FOR UPDATE TO authenticated
    USING (public.can_manage_store(vendor_profile_id))
    WITH CHECK (public.can_manage_store(vendor_profile_id));
-- Sin DELETE: un cupón se pausa o archiva (las redenciones lo referencian).

DROP POLICY IF EXISTS store_coupon_redemptions_select ON public.store_coupon_redemptions;
CREATE POLICY store_coupon_redemptions_select ON public.store_coupon_redemptions
    FOR SELECT TO authenticated
    USING (buyer_id = (SELECT auth.uid()) OR public.can_manage_store(vendor_profile_id));

REVOKE ALL ON public.store_coupons            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.store_coupon_redemptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.store_coupon_attempts    FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.store_coupons TO authenticated;
GRANT SELECT ON public.store_coupon_redemptions TO authenticated;
GRANT ALL ON public.store_coupons, public.store_coupon_redemptions, public.store_coupon_attempts TO service_role;

-- ─── 4. Motor del cupón ───────────────────────────────────────────────────────
-- p_lines: [{idx, product_id, category_id, line_total}] (line_total BRUTO, IVA incluido).
-- Devuelve {ok:true, coupon_id, code, kind, value, description, eligible_subtotal,
-- discount_total, allocations:{"<idx>": pesos}} o {ok:false, error, detail}.
CREATE OR REPLACE FUNCTION public._store_coupon_apply(
    p_vendor_profile_id uuid,
    p_code              text,
    p_buyer             uuid,
    p_lines             jsonb,
    p_school_ids        uuid[],
    p_lock              boolean,
    p_record_attempt    boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_norm     text := upper(btrim(COALESCE(p_code, '')));
    v_c        public.store_coupons%ROWTYPE;
    v_err      text;
    v_detail   jsonb;
    v_elig     numeric := 0;
    v_raw      numeric;
    v_disc     numeric;
    v_alloc    jsonb := '{}'::jsonb;
    v_sum      numeric := 0;
    v_l        record;
    v_top_idx  text;
    v_used     integer;
    v_failed   integer;
BEGIN
    IF p_buyer IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'COUPON_LOGIN_REQUIRED');
    END IF;

    -- Fuerza bruta: 10 códigos DISTINTOS fallidos en 15 min bloquean (incluso uno bueno).
    SELECT count(DISTINCT a.code_norm) INTO v_failed
      FROM public.store_coupon_attempts a
     WHERE a.buyer_id = p_buyer AND a.created_at > now() - interval '15 minutes';
    IF v_failed >= 10 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'COUPON_TOO_MANY_ATTEMPTS');
    END IF;

    <<eval>>
    BEGIN
        IF v_norm !~ '^[A-Z0-9_-]{3,30}$' THEN
            v_err := 'COUPON_INVALID'; EXIT eval;
        END IF;

        SELECT * INTO v_c FROM public.store_coupons c
         WHERE c.vendor_profile_id = p_vendor_profile_id AND upper(c.code) = v_norm;
        IF v_c.id IS NOT NULL AND p_lock THEN
            -- Serializa a todos los que redimen ESTE cupón (tope de usos sin carreras).
            SELECT * INTO v_c FROM public.store_coupons c WHERE c.id = v_c.id FOR UPDATE;
        END IF;

        IF v_c.id IS NULL OR v_c.status <> 'active'
           OR (v_c.school_id IS NOT NULL AND NOT (v_c.school_id = ANY (COALESCE(p_school_ids, '{}'::uuid[])))) THEN
            v_err := 'COUPON_INVALID'; EXIT eval;   -- no se revela si existe para otra escuela
        END IF;
        IF now() < v_c.starts_at THEN
            v_err := 'COUPON_NOT_STARTED';
            v_detail := jsonb_build_object('starts_at', v_c.starts_at); EXIT eval;
        END IF;
        IF v_c.ends_at IS NOT NULL AND now() >= v_c.ends_at THEN
            v_err := 'COUPON_EXPIRED';
            v_detail := jsonb_build_object('ends_at', v_c.ends_at); EXIT eval;
        END IF;

        SELECT COALESCE(sum((l ->> 'line_total')::numeric), 0) INTO v_elig
          FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) l
         WHERE v_c.applies_to = 'store'
            OR (v_c.applies_to = 'products'   AND (l ->> 'product_id')::uuid  = ANY (v_c.product_ids))
            OR (v_c.applies_to = 'categories' AND NULLIF(l ->> 'category_id', '')::uuid = ANY (v_c.category_ids));
        IF v_elig <= 0 THEN
            v_err := 'COUPON_NOT_APPLICABLE'; EXIT eval;
        END IF;
        IF v_elig < v_c.min_subtotal THEN
            v_err := 'COUPON_MIN_PURCHASE';
            v_detail := jsonb_build_object('min_subtotal', v_c.min_subtotal, 'eligible_subtotal', v_elig); EXIT eval;
        END IF;

        IF v_c.max_redemptions IS NOT NULL THEN
            SELECT count(*) INTO v_used FROM public.store_coupon_redemptions r
             WHERE r.coupon_id = v_c.id AND r.status IN ('reserved', 'consumed');
            IF v_used >= v_c.max_redemptions THEN
                v_err := 'COUPON_LIMIT'; EXIT eval;
            END IF;
        END IF;
        IF v_c.max_per_buyer IS NOT NULL THEN
            SELECT count(*) INTO v_used FROM public.store_coupon_redemptions r
             WHERE r.coupon_id = v_c.id AND r.buyer_id = p_buyer AND r.status IN ('reserved', 'consumed');
            IF v_used >= v_c.max_per_buyer THEN
                v_err := 'COUPON_BUYER_LIMIT';
                v_detail := jsonb_build_object('max_per_buyer', v_c.max_per_buyer); EXIT eval;
            END IF;
        END IF;
    END eval;

    IF v_err IS NOT NULL THEN
        IF p_record_attempt AND NOT EXISTS (
            SELECT 1 FROM public.store_coupon_attempts a
             WHERE a.buyer_id = p_buyer AND a.code_norm = left(v_norm, 60)
               AND a.created_at > now() - interval '15 minutes') THEN
            INSERT INTO public.store_coupon_attempts (buyer_id, vendor_profile_id, code_norm, error)
            VALUES (p_buyer, p_vendor_profile_id, left(v_norm, 60), v_err);
        END IF;
        RETURN jsonb_build_object('ok', false, 'error', v_err) || CASE WHEN v_detail IS NOT NULL
               THEN jsonb_build_object('detail', v_detail) ELSE '{}'::jsonb END;
    END IF;

    -- Monto: % o fijo, con tope del cupón y nunca más del 90 % de lo elegible.
    v_raw := CASE v_c.kind WHEN 'percent' THEN round(v_elig * v_c.value / 100) ELSE v_c.value END;
    v_disc := LEAST(v_raw, COALESCE(v_c.max_discount, v_raw), floor(v_elig * 0.9));
    v_disc := GREATEST(v_disc, 0);

    -- Prorrateo por línea (piso proporcional); el residuo a la línea más cara.
    FOR v_l IN
        SELECT l ->> 'idx' AS idx, (l ->> 'line_total')::numeric AS lt
          FROM jsonb_array_elements(p_lines) l
         WHERE v_c.applies_to = 'store'
            OR (v_c.applies_to = 'products'   AND (l ->> 'product_id')::uuid  = ANY (v_c.product_ids))
            OR (v_c.applies_to = 'categories' AND NULLIF(l ->> 'category_id', '')::uuid = ANY (v_c.category_ids))
         ORDER BY (l ->> 'line_total')::numeric DESC, (l ->> 'idx')::integer
    LOOP
        IF v_top_idx IS NULL THEN v_top_idx := v_l.idx; END IF;
        v_alloc := v_alloc || jsonb_build_object(v_l.idx, floor(v_disc * v_l.lt / v_elig));
        v_sum := v_sum + floor(v_disc * v_l.lt / v_elig);
    END LOOP;
    IF v_disc - v_sum <> 0 THEN
        v_alloc := jsonb_set(v_alloc, ARRAY[v_top_idx], to_jsonb((v_alloc ->> v_top_idx)::numeric + (v_disc - v_sum)));
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'coupon_id', v_c.id, 'code', v_c.code, 'kind', v_c.kind, 'value', v_c.value,
        'description', v_c.description, 'funded_by', v_c.funded_by,
        'eligible_subtotal', v_elig, 'discount_total', v_disc, 'allocations', v_alloc);
END;
$$;

COMMENT ON FUNCTION public._store_coupon_apply(uuid, text, uuid, jsonb, uuid[], boolean, boolean) IS
  'Tienda v2 F3b: valida y calcula un cupón de la tienda para un comprador y un carrito. p_lock=true (create_cart_order) bloquea el cupón FOR UPDATE. Interna: solo la llaman RPC DEFINER.';

-- ─── 5a. create_cart_order (misma firma; aplica el cupón) ─────────────────────
CREATE OR REPLACE FUNCTION public.create_cart_order(
    p_items jsonb, p_fulfillment text, p_pickup_branch uuid, p_address jsonb, p_buyer jsonb,
    p_payment_method text, p_coupon_code text, p_buyer_id uuid, p_idempotency_key uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
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
    v_discount   numeric := 0;
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
    v_coupon_in  text := NULLIF(btrim(COALESCE(p_coupon_code, '')), '');
    v_cp         jsonb;
    v_idx        integer := 0;
    v_disc       numeric;
    v_net        numeric;
    v_nrate      numeric;
    v_base       numeric;
    v_final      jsonb := '[]'::jsonb;
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

    IF v_coupon_in IS NOT NULL AND char_length(v_coupon_in) > 60 THEN
        RAISE EXCEPTION 'COUPON_INVALID' USING ERRCODE = 'P0001';
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
               p.category_id,
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

        -- Bruto de la línea; el neto (con cupón) se calcula después.
        v_lines := v_lines || jsonb_build_object(
            'idx', v_idx,
            'product_id', v_l.product_id, 'variant_id', v_l.variant_id, 'qty', v_l.qty,
            'category_id', v_l.category_id,
            'unit_price', v_unit, 'tax_rate', public._store_norm_tax_rate(v_l.tax_rate),
            'line_total', v_amt.line_total);
        v_subtotal := v_subtotal + v_amt.line_total;
        v_idx := v_idx + 1;
    END LOOP;

    IF jsonb_array_length(v_short) > 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001', DETAIL = v_short::text;
    END IF;

    -- Cupón de ESTA tienda: la fila del cupón queda FOR UPDATE hasta el COMMIT
    -- (los topes de uso no se pasan en concurrencia).
    IF v_coupon_in IS NOT NULL THEN
        v_cp := public._store_coupon_apply(v_vp.id, v_coupon_in, v_buyer, v_lines, v_school_ids, true, false);
        IF NOT COALESCE((v_cp ->> 'ok')::boolean, false) THEN
            RAISE EXCEPTION '%', v_cp ->> 'error' USING ERRCODE = 'P0001',
                  DETAIL = COALESCE(v_cp -> 'detail', '{}'::jsonb)::text;
        END IF;
    END IF;

    -- Neto por línea: IVA y comisión sobre lo efectivamente cobrado (§6.3, D-3).
    FOR v_line IN SELECT x FROM jsonb_array_elements(v_lines) x LOOP
        v_disc  := COALESCE((v_cp -> 'allocations' ->> (v_line ->> 'idx'))::numeric, 0);
        v_net   := (v_line ->> 'line_total')::numeric - v_disc;
        v_nrate := (v_line ->> 'tax_rate')::numeric;
        v_base  := round(v_net / (1 + v_nrate));
        v_comm  := round(v_net * v_rate);
        v_final := v_final || (v_line || jsonb_build_object(
            'gross_total', (v_line ->> 'line_total')::numeric,
            'discount', v_disc, 'line_total', v_net, 'line_base', v_base,
            'line_tax', v_net - v_base, 'platform_fee', v_comm));
        v_discount := v_discount + v_disc;
        v_tax      := v_tax + (v_net - v_base);
    END LOOP;

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

    v_total := v_subtotal - v_discount + v_shipping;   -- el envío no se descuenta
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
        coupon_id, coupon_code,
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
        v_shipping, v_subtotal, v_discount, v_tax, v_total,
        NULLIF(v_cp ->> 'coupon_id', '')::uuid, v_cp ->> 'code',
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
        (SELECT COALESCE(sum((x ->> 'platform_fee')::numeric), 0) FROM jsonb_array_elements(v_final) x)
    );

    FOR v_line IN SELECT x FROM jsonb_array_elements(v_final) x LOOP
        INSERT INTO public.order_items (
            order_id, product_id, variant_id, quantity, unit_price, subtotal, tax_amount,
            tax_rate, line_total, line_base, discount_amount, vendor_id, vendor_profile_id,
            platform_fee, commission_rate, owner_type, owner_id
        ) VALUES (
            v_order_id, (v_line ->> 'product_id')::uuid, NULLIF(v_line ->> 'variant_id', '')::uuid,
            (v_line ->> 'qty')::integer, (v_line ->> 'unit_price')::numeric,
            (v_line ->> 'line_total')::numeric, (v_line ->> 'line_tax')::numeric,
            (v_line ->> 'tax_rate')::numeric, (v_line ->> 'line_total')::numeric,
            (v_line ->> 'line_base')::numeric, (v_line ->> 'discount')::numeric, v_vp.user_id, v_vp.id,
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

    IF v_cp IS NOT NULL THEN
        INSERT INTO public.store_coupon_redemptions (coupon_id, vendor_profile_id, order_id, buyer_id, code,
                                                     discount_amount, status)
        VALUES ((v_cp ->> 'coupon_id')::uuid, v_vp.id, v_order_id, v_buyer, v_cp ->> 'code',
                v_discount, 'reserved');
    END IF;

    RETURN public._store_order_summary(v_order_id)
        || jsonb_build_object('idempotent', false, 'pickup_code', v_code,
                              'provider', v_gw ->> 'provider');
END;
$function$;

COMMENT ON FUNCTION public.create_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, uuid) IS
  'Tienda v2: crea la orden en UNA transacción (precio, IVA incluido, envío, reserva y total desde la base). F3b (20261013170543): p_coupon_code aplica un cupón de la tienda — prorrateo por línea, IVA y comisión sobre el neto, redención reservada con el cupón FOR UPDATE. Contrato: docs/specs/tienda-v2-contrato-checkout.md.';

-- ─── 5b. quote_cart (cotiza el cupón; VOLATILE porque registra intentos) ──────
CREATE OR REPLACE FUNCTION public.quote_cart(
    p_items jsonb, p_fulfillment text DEFAULT 'pickup'::text, p_address jsonb DEFAULT NULL::jsonb,
    p_coupon_code text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_uid      uuid := auth.uid();
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
    v_code     text := NULLIF(btrim(COALESCE(p_coupon_code, '')), '');
    v_cand     jsonb := '[]'::jsonb;
    v_idx      integer := 0;
    v_cp       jsonb;
    v_cerr     text;
    v_disc     numeric := 0;
    v_out      jsonb := '[]'::jsonb;
    v_line     jsonb;
    v_d        numeric;
    v_net      numeric;
    v_base     numeric;
    v_nv       integer;
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
               p.stock AS p_stock, p.reserved AS p_reserved, p.category_id,
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
            'idx', v_idx,
            'product_id', v_l.product_id, 'variant_id', v_l.variant_id,
            'name', v_l.name || COALESCE(' · ' || v_l.v_name, ''),
            'vendor_profile_id', v_l.vendor_profile_id,
            'quantity', v_l.qty, 'available', v_avail,
            'adjusted_quantity', LEAST(v_l.qty, v_avail),
            'unit_price', v_unit, 'tax_rate', public._store_norm_tax_rate(v_l.tax_rate),
            'line_total', v_amt.line_total, 'line_base', v_amt.line_base, 'line_tax', v_amt.line_tax,
            'discount_amount', 0,
            'error', CASE WHEN v_avail = 0 THEN 'OUT_OF_STOCK'
                          WHEN v_avail < v_l.qty THEN 'INSUFFICIENT_STOCK' END);
        IF v_amt.line_total > 0 THEN
            v_cand := v_cand || jsonb_build_object('idx', v_idx, 'product_id', v_l.product_id,
                                                   'category_id', v_l.category_id, 'line_total', v_amt.line_total);
        END IF;
        v_idx := v_idx + 1;
        v_sub := v_sub + v_amt.line_total;
        v_tax := v_tax + v_amt.line_tax;
    END LOOP;

    -- Cupón: mismo motor que create_cart_order (sin bloquear la fila).
    IF v_code IS NOT NULL THEN
        SELECT count(DISTINCT x) INTO v_nv FROM unnest(v_vendors) x;
        IF v_uid IS NULL THEN
            v_cerr := 'COUPON_LOGIN_REQUIRED';
        ELSIF char_length(v_code) > 60 THEN
            v_cerr := 'COUPON_INVALID';
        ELSIF v_nv > 1 THEN
            v_cerr := 'MULTIPLE_SELLERS';
        ELSIF v_nv = 0 OR jsonb_array_length(v_cand) = 0 THEN
            v_cerr := 'COUPON_NOT_APPLICABLE';
        ELSE
            v_cp := public._store_coupon_apply(v_vendors[1], v_code, v_uid, v_cand, v_school_ids, false, true);
            IF NOT COALESCE((v_cp ->> 'ok')::boolean, false) THEN
                v_cerr := v_cp ->> 'error';
            END IF;
        END IF;
    END IF;

    IF v_cp IS NOT NULL AND v_cerr IS NULL THEN
        v_disc := (v_cp ->> 'discount_total')::numeric;
        v_tax := 0;
        FOR v_line IN SELECT x FROM jsonb_array_elements(v_lines) x LOOP
            IF v_line ? 'idx' THEN
                v_d    := COALESCE((v_cp -> 'allocations' ->> (v_line ->> 'idx'))::numeric, 0);
                v_net  := (v_line ->> 'line_total')::numeric - v_d;
                v_base := round(v_net / (1 + (v_line ->> 'tax_rate')::numeric));
                v_tax  := v_tax + (v_net - v_base);
                v_line := v_line || jsonb_build_object('discount_amount', v_d, 'line_total_net', v_net,
                                                       'line_base', v_base, 'line_tax', v_net - v_base);
            END IF;
            v_out := v_out || v_line;
        END LOOP;
        v_lines := v_out;
    END IF;

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
        'discount_total', v_disc,
        'total', v_sub - v_disc + COALESCE(v_ship, 0),
        'coupon', CASE WHEN v_disc > 0 OR (v_cp IS NOT NULL AND v_cerr IS NULL) THEN jsonb_build_object(
                      'code', v_cp ->> 'code', 'kind', v_cp ->> 'kind', 'value', (v_cp ->> 'value')::numeric,
                      'description', v_cp ->> 'description', 'discount_total', v_disc) END,
        'coupon_error', v_cerr,
        'coupon_error_detail', CASE WHEN v_cerr IS NOT NULL THEN v_cp -> 'detail' END,
        'multiple_sellers', (SELECT count(DISTINCT x) FROM unnest(v_vendors) x) > 1,
        'store_enabled', public.store_enabled()
    );
END;
$function$;

-- ─── 6. Redención sigue al estado de la orden ────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_orders_coupon_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NEW.coupon_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;
    IF NEW.status IN ('expired', 'cancelled') THEN
        UPDATE public.store_coupon_redemptions
           SET status = 'released', released_at = now()
         WHERE order_id = NEW.id AND status = 'reserved';
    ELSIF NEW.status IN ('paid', 'preparing', 'ready_for_pickup', 'shipped', 'delivered') THEN
        -- También re-consume una liberada: pago tardío de una orden vencida.
        UPDATE public.store_coupon_redemptions
           SET status = 'consumed', consumed_at = COALESCE(consumed_at, now()), released_at = NULL
         WHERE order_id = NEW.id AND status IN ('reserved', 'released');
    END IF;
    -- refunded / partially_refunded / payment_review: la redención queda como está.
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_coupon_redemption ON public.orders;
CREATE TRIGGER trg_orders_coupon_redemption
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_orders_coupon_redemption();

-- ─── 7a. Resumen de la orden con el descuento ────────────────────────────────
CREATE OR REPLACE FUNCTION public._store_order_summary(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
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
        'coupon_code', o.coupon_code,
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
                       'discount_amount', COALESCE(oi.discount_amount, 0),
                       'line_total', oi.line_total,
                       'line_base', oi.line_base,
                       'line_tax', oi.tax_amount) ORDER BY oi.created_at, oi.id)
              FROM public.order_items oi
              JOIN public.products p ON p.id = oi.product_id
              LEFT JOIN public.product_variants v ON v.id = oi.variant_id
             WHERE oi.order_id = o.id), '[]'::jsonb)
    )
    FROM public.orders o WHERE o.id = p_order_id;
$function$;

-- ─── 7b. Evento contable con el descuento ────────────────────────────────────
-- gross sigue siendo lo COBRADO (base + IVA + envío, neto de descuento); se
-- agregan discount (menor ingreso, no gasto) y gross_before_discount.
CREATE OR REPLACE FUNCTION public._store_order_event_payload(p_order_id uuid, p_ratio numeric, p_effective timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
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
    v_disc   numeric;
    v_funded text;
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    SELECT COALESCE(sum(COALESCE(oi.line_base, oi.line_total - COALESCE(oi.tax_amount, 0))), 0),
           COALESCE(sum(COALESCE(oi.tax_amount, 0)), 0),
           COALESCE(sum(COALESCE(oi.line_total, round(oi.unit_price * oi.quantity))), 0),
           array_agg(DISTINCT oi.tax_rate),
           max(oi.commission_rate),
           COALESCE(sum(COALESCE(oi.discount_amount, 0)), 0)
      INTO v_base, v_vat, v_lines, v_rates, v_crate, v_disc
      FROM public.order_items oi WHERE oi.order_id = p_order_id;
    SELECT COALESCE(sum(s.platform_fee), 0), COALESCE(sum(s.gateway_fee), 0), COALESCE(bool_or(s.gateway_fee_estimated), false)
      INTO v_comm, v_gwfee, v_est
      FROM public.settlements s WHERE s.order_id = p_order_id AND s.status <> 'reversed';
    IF v_o.coupon_id IS NOT NULL THEN
        SELECT c.funded_by INTO v_funded FROM public.store_coupons c WHERE c.id = v_o.coupon_id;
    END IF;

    v_ship := COALESCE(v_o.shipping_cost, 0);
    IF p_ratio < 1 THEN
        v_base  := round(v_base * p_ratio);
        v_vat   := round(v_vat * p_ratio);
        v_ship  := round(v_ship * p_ratio);
        v_comm  := round(v_comm * p_ratio);
        v_gwfee := round(v_gwfee * p_ratio);
        v_disc  := round(v_disc * p_ratio);
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
        'discount', v_disc,
        'gross_before_discount', v_gross + v_disc,
        'coupon_id', v_o.coupon_id,
        'coupon_code', v_o.coupon_code,
        'coupon_funded_by', v_funded,
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
$function$;

-- ─── 7c. Factura: precio unitario NETO cuando hubo cupón ─────────────────────
-- El adaptador de Factus todavía no descuenta discount_rate del monto
-- declarado (factus-v2.adapter.unit.test.ts, «PENDIENTE»), así que se factura
-- el precio ya descontado: el total facturado cuadra con lo cobrado.
CREATE OR REPLACE FUNCTION public.order_invoice_payload(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
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
               'unit_price', CASE WHEN discount > 0 THEN round(line_total / quantity, 2) ELSE unit_price END,
               'list_unit_price', unit_price,
               'discount_amount', discount,
               'tax_rate_pct', round(tax_rate * 100, 2),
               'is_excluded', tax_rate = 0,
               'line_total', line_total,
               'line_base', line_base,
               'line_tax', line_tax) ORDER BY rn), '[]'::jsonb)
      INTO v_lines
      FROM (SELECT row_number() OVER (ORDER BY oi.created_at, oi.id) AS rn,
                   p.name || COALESCE(' · ' || v.name, '') AS name,
                   oi.quantity, oi.unit_price,
                   COALESCE(oi.discount_amount, 0) AS discount,
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
        'discount_total', COALESCE(v_o.discount_total, 0),
        'coupon_code', v_o.coupon_code,
        'lines', v_lines);
END;
$function$;

-- ─── 8. Permisos de funciones ────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.fn_store_coupons_guard()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_orders_coupon_redemption()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._store_coupon_apply(uuid, text, uuid, jsonb, uuid[], boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._store_coupon_apply(uuid, text, uuid, jsonb, uuid[], boolean, boolean) TO service_role;

-- Re-afirmar los grants de las RPC redefinidas (CREATE OR REPLACE los conserva;
-- se repiten para que la migración sola describa el estado buscado).
REVOKE ALL ON FUNCTION public.create_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cart_order(jsonb, text, uuid, jsonb, jsonb, text, text, uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.quote_cart(jsonb, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_cart(jsonb, text, jsonb, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._store_order_summary(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._store_order_summary(uuid) TO service_role;
REVOKE ALL ON FUNCTION public._store_order_event_payload(uuid, numeric, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._store_order_event_payload(uuid, numeric, timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION public.order_invoice_payload(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_invoice_payload(uuid) TO service_role;

COMMIT;
