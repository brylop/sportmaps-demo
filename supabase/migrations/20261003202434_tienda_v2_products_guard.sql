-- =============================================================================
-- 20261003202434_tienda_v2_products_guard.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202431
-- Objetivo: M-F0-2 de docs/specs/tienda-v2-f0-plan-migraciones.md.
--   Productos y variantes solo los escribe quien administra la tienda
--   (can_manage_store, M-F0-1), nunca con el vendor_profile de otro (T5/R11),
--   y el stock deja de ser una columna editable desde el cliente (T6/R9): se
--   mueve con inventory_adjust (adelantada de F1), que deja kardex.
--
--   1. CHECK products.stock >= 0.
--   2. Policies de products / product_variants / product_images por
--      can_manage_store, con WITH CHECK (I3). DELETE solo de borradores.
--   3. Trigger trg_products_fill_vendor: vendor_id y school_id salen del
--      vendor_profile (compat con lectores legacy por vendor_id; un producto
--      no se "muda" de escuela por el body).
--   4. UPDATE por columnas: authenticated ya no actualiza `stock`.
--      anon sin INSERT/UPDATE/DELETE en products, variants e imágenes.
--   5. inventory_adjust(...) DEFINER con FOR UPDATE y kardex 'manual_adjust'.
--      Parámetro extra p_actor para el BFF (service role, auth.uid() NULL).
--   6. Fix del gate de publicación: trg_enforce_product_publish_gate llamaba
--      validate_product_quality(NEW.id) en BEFORE INSERT → la fila no existe →
--      'not_found' → 23514 aunque el producto cumpla. Ahora valida la fila NEW.
--   7. validate_product_vendor_capability pasa a DEFINER: un admin de la
--      escuela (no dueño) no ve por RLS el perfil si no está verificado.
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
    IF to_regprocedure('public.can_manage_store(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Falta M-F0-1 (20261003202431): aplicarla antes.';
    END IF;
END
$pre$;

-- ─── 1. Stock no negativo ────────────────────────────────────────────────────
ALTER TABLE public.products
    ADD CONSTRAINT products_stock_nonneg CHECK (stock >= 0);

-- ─── Helpers ─────────────────────────────────────────────────────────────────
-- Actor de una RPC de tienda: el usuario del JWT; si llama el BFF con service
-- role (auth.uid() NULL), el p_actor que el BFF validó. Interno: sin EXECUTE.
CREATE OR REPLACE FUNCTION public._store_actor(p_actor uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT CASE WHEN COALESCE(auth.role(), '') = 'service_role' THEN p_actor
                ELSE auth.uid() END;
$fn$;

-- ¿El usuario de la sesión administra la tienda dueña de este producto?
-- DEFINER para no depender de la RLS de products dentro de otras policies.
CREATE OR REPLACE FUNCTION public.store_can_manage_product(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT COALESCE((SELECT public.can_manage_store(p.vendor_profile_id)
                       FROM public.products p WHERE p.id = p_product_id), false);
$fn$;

COMMENT ON FUNCTION public.store_can_manage_product(uuid) IS
  'Tienda v2: can_manage_store del vendor_profile del producto (para policies de variantes/imágenes).';

-- ─── 3. vendor_id / school_id salen del perfil ───────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_products_fill_vendor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_user   uuid;
    v_school uuid;
BEGIN
    IF NEW.vendor_profile_id IS NULL THEN
        RETURN NEW;                       -- legacy sin perfil: no se toca
    END IF;
    SELECT user_id, school_id INTO v_user, v_school
      FROM public.vendor_profiles WHERE id = NEW.vendor_profile_id;
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'VENDOR_PROFILE_NOT_FOUND' USING ERRCODE = '23503';
    END IF;
    NEW.vendor_id := v_user;
    NEW.school_id := v_school;            -- externo → NULL; escuela → la suya
    RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_products_fill_vendor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_products_fill_vendor ON public.products;
CREATE TRIGGER trg_products_fill_vendor
    BEFORE INSERT OR UPDATE OF vendor_profile_id, vendor_id, school_id ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.fn_products_fill_vendor();

-- ─── 2. Policies ─────────────────────────────────────────────────────────────
-- products
DROP POLICY IF EXISTS products_insert_own ON public.products;
CREATE POLICY products_insert_own ON public.products
    FOR INSERT TO authenticated
    WITH CHECK (vendor_profile_id IS NOT NULL AND public.can_manage_store(vendor_profile_id));

DROP POLICY IF EXISTS products_update_own ON public.products;
CREATE POLICY products_update_own ON public.products
    FOR UPDATE TO authenticated
    USING (public.can_manage_store(vendor_profile_id))
    WITH CHECK (vendor_profile_id IS NOT NULL AND public.can_manage_store(vendor_profile_id));

DROP POLICY IF EXISTS products_delete_own ON public.products;
CREATE POLICY products_delete_own ON public.products
    FOR DELETE TO authenticated
    USING (public.can_manage_store(vendor_profile_id) AND status IN ('draft', 'rejected'));

DROP POLICY IF EXISTS products_select_own ON public.products;
CREATE POLICY products_select_own ON public.products
    FOR SELECT TO authenticated
    USING (public.can_manage_store(vendor_profile_id) OR vendor_id = (SELECT auth.uid()));

-- product_variants
DROP POLICY IF EXISTS product_variants_insert_own ON public.product_variants;
CREATE POLICY product_variants_insert_own ON public.product_variants
    FOR INSERT TO authenticated
    WITH CHECK (public.store_can_manage_product(product_id));

DROP POLICY IF EXISTS product_variants_update_own ON public.product_variants;
CREATE POLICY product_variants_update_own ON public.product_variants
    FOR UPDATE TO authenticated
    USING (public.store_can_manage_product(product_id))
    WITH CHECK (public.store_can_manage_product(product_id));

DROP POLICY IF EXISTS product_variants_delete_own ON public.product_variants;
CREATE POLICY product_variants_delete_own ON public.product_variants
    FOR DELETE TO authenticated
    USING (public.store_can_manage_product(product_id));

DROP POLICY IF EXISTS product_variants_select_own ON public.product_variants;
CREATE POLICY product_variants_select_own ON public.product_variants
    FOR SELECT TO authenticated
    USING (public.store_can_manage_product(product_id)
           OR EXISTS (SELECT 1 FROM public.products p
                       WHERE p.id = product_variants.product_id AND p.vendor_id = (SELECT auth.uid())));

-- product_images (I3: FOR ALL sin WITH CHECK)
DROP POLICY IF EXISTS product_images_vendor_all ON public.product_images;
CREATE POLICY product_images_vendor_all ON public.product_images
    FOR ALL TO authenticated
    USING (public.store_can_manage_product(product_id))
    WITH CHECK (public.store_can_manage_product(product_id));

-- ─── 4. Grants de tabla y de columna ─────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON public.products, public.product_variants, public.product_images FROM anon;

-- Un grant de tabla cubre todas las columnas: se quita el UPDATE de tabla y se
-- dan solo las columnas editables (sin stock, vendor_*, school_id, revisión ni
-- agregados de reseñas). INSERT conserva stock (stock inicial).
REVOKE UPDATE ON public.products, public.product_variants FROM authenticated;
REVOKE UPDATE (stock) ON public.products, public.product_variants FROM anon, authenticated;
GRANT UPDATE (name, description, price, category, category_id, brand_id, image_url,
              active, visibility, status, sku, attributes, weight_grams, is_digital,
              min_stock_alert, tax_rate, updated_at)
    ON public.products TO authenticated;
GRANT UPDATE (sku, name, attributes, price_override, image_url, is_active, sort_order, updated_at)
    ON public.product_variants TO authenticated;

-- ─── 5. inventory_adjust ─────────────────────────────────────────────────────
ALTER TABLE public.inventory_logs ADD COLUMN IF NOT EXISTS note text;

CREATE OR REPLACE FUNCTION public.inventory_adjust(
    p_variant_id  uuid,
    p_product_id  uuid,
    p_new_stock   integer,
    p_reason_code text DEFAULT 'manual_adjust',
    p_note        text DEFAULT NULL,
    p_actor       uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_actor    uuid := public._store_actor(p_actor);
    v_reason   text := COALESCE(p_reason_code, 'manual_adjust');
    v_prod     public.products%ROWTYPE;
    v_var      public.product_variants%ROWTYPE;
    v_before   integer;
    v_reserved integer;
    v_product  uuid;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF p_new_stock IS NULL OR p_new_stock < 0 THEN
        RAISE EXCEPTION 'INVALID_QTY' USING ERRCODE = '22023';
    END IF;
    IF v_reason NOT IN ('manual_adjust', 'manual_restock') THEN
        RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE = '22023';
    END IF;
    IF (p_variant_id IS NULL) = (p_product_id IS NULL) THEN
        RAISE EXCEPTION 'VARIANT_XOR_PRODUCT' USING ERRCODE = '22023',
              HINT = 'Pasar la variante, o el producto si no tiene variantes.';
    END IF;

    IF p_variant_id IS NOT NULL THEN
        SELECT * INTO v_var FROM public.product_variants WHERE id = p_variant_id FOR UPDATE;
        IF v_var.id IS NULL THEN
            RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
        END IF;
        SELECT * INTO v_prod FROM public.products WHERE id = v_var.product_id;
    ELSE
        SELECT * INTO v_prod FROM public.products WHERE id = p_product_id FOR UPDATE;
        IF v_prod.id IS NULL THEN
            RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
        END IF;
        IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = p_product_id) THEN
            RAISE EXCEPTION 'PRODUCT_HAS_VARIANTS' USING ERRCODE = '22023';
        END IF;
    END IF;
    v_product := v_prod.id;

    IF NOT (public.can_manage_store_as(v_prod.vendor_profile_id, v_actor)
            OR (v_prod.vendor_profile_id IS NULL AND v_prod.vendor_id = v_actor)) THEN
        RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
    END IF;

    -- `reserved` llega en M-F0-4; hasta entonces vale 0.
    IF p_variant_id IS NOT NULL THEN
        v_before   := v_var.stock;
        v_reserved := COALESCE((to_jsonb(v_var) ->> 'reserved')::integer, 0);
    ELSE
        v_before   := v_prod.stock;
        v_reserved := COALESCE((to_jsonb(v_prod) ->> 'reserved')::integer, 0);
    END IF;
    IF p_new_stock < v_reserved THEN
        RAISE EXCEPTION 'BELOW_RESERVED' USING ERRCODE = '22023',
              DETAIL = format('reservado=%s', v_reserved);
    END IF;

    IF p_new_stock = v_before THEN
        RETURN jsonb_build_object('ok', true, 'noop', true, 'product_id', v_product,
                                  'variant_id', p_variant_id, 'stock_before', v_before,
                                  'stock_after', v_before, 'delta', 0);
    END IF;

    IF p_variant_id IS NOT NULL THEN
        UPDATE public.product_variants SET stock = p_new_stock, updated_at = now() WHERE id = p_variant_id;
    ELSE
        UPDATE public.products SET stock = p_new_stock, updated_at = now() WHERE id = v_product;
    END IF;

    INSERT INTO public.inventory_logs (product_id, variant_id, vendor_id, delta, stock_before,
                                       stock_after, reason, created_by, note)
    VALUES (v_product, p_variant_id, v_prod.vendor_id, p_new_stock - v_before, v_before,
            p_new_stock, v_reason,
            (SELECT u.id FROM auth.users u WHERE u.id = v_actor),
            NULLIF(left(btrim(p_note), 500), ''));

    RETURN jsonb_build_object('ok', true, 'product_id', v_product, 'variant_id', p_variant_id,
                              'stock_before', v_before, 'stock_after', p_new_stock,
                              'delta', p_new_stock - v_before);
END;
$fn$;

COMMENT ON FUNCTION public.inventory_adjust(uuid, uuid, integer, text, text, uuid) IS
  'Tienda v2 (adelantada de F1): fija el stock de una variante (o de un producto sin variantes) con kardex. JWT: actor = auth.uid(); service role: p_actor.';

-- ─── 6. Gate de publicación sin el bug de BEFORE INSERT ──────────────────────
CREATE OR REPLACE FUNCTION public.validate_product_quality_row(p public.products)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_issues      jsonb := '[]'::jsonb;
    v_image_count integer := 0;
BEGIN
    IF p.name IS NULL OR length(trim(p.name)) < 5 THEN
        v_issues := v_issues || jsonb_build_object('code', 'name_too_short', 'message', 'Nombre debe tener al menos 5 caracteres.');
    END IF;
    IF p.description IS NULL OR length(trim(p.description)) < 30 THEN
        v_issues := v_issues || jsonb_build_object('code', 'description_too_short', 'message', 'Descripcion debe tener al menos 30 caracteres.');
    END IF;
    IF p.price IS NULL OR p.price <= 0 THEN
        v_issues := v_issues || jsonb_build_object('code', 'price_invalid', 'message', 'Precio debe ser mayor a 0.');
    END IF;
    IF p.category_id IS NULL THEN
        v_issues := v_issues || jsonb_build_object('code', 'category_required', 'message', 'Categoria es requerida.');
    END IF;

    IF to_regclass('public.product_media') IS NOT NULL AND p.id IS NOT NULL THEN
        EXECUTE $q$ SELECT count(*) FROM public.product_media WHERE product_id = $1 AND type IN ('image', 'image_360') $q$
           INTO v_image_count USING p.id;
    END IF;
    IF v_image_count = 0 AND (p.image_url IS NULL OR length(p.image_url) = 0) THEN
        v_issues := v_issues || jsonb_build_object('code', 'no_image', 'message', 'Al menos una imagen es requerida.');
    END IF;

    IF p.vendor_profile_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.vendor_profiles vp
         WHERE vp.id = p.vendor_profile_id AND vp.verification_status::text <> 'verified'
    ) THEN
        v_issues := v_issues || jsonb_build_object('code', 'vendor_unverified', 'message', 'Vendor no verificado — producto requerira revision admin.', 'severity', 'warning');
    END IF;

    RETURN v_issues;
END;
$fn$;

-- Misma firma y mismo contrato de siempre; ahora delega en la versión por fila.
CREATE OR REPLACE FUNCTION public.validate_product_quality(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_row public.products%ROWTYPE;
BEGIN
    SELECT * INTO v_row FROM public.products WHERE id = p_product_id;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_array(jsonb_build_object('code', 'not_found', 'message', 'Producto no encontrado.'));
    END IF;
    RETURN public.validate_product_quality_row(v_row);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.enforce_product_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_blocking_issues jsonb;
    v_vendor_verified boolean := false;
BEGIN
    IF NEW.status <> 'active' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
        RETURN NEW;
    END IF;

    -- Se valida la fila NEW (en BEFORE INSERT todavía no existe en la tabla).
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      INTO v_blocking_issues
      FROM jsonb_array_elements(public.validate_product_quality_row(NEW)) elem
     WHERE COALESCE(elem ->> 'severity', 'error') <> 'warning';

    IF jsonb_array_length(v_blocking_issues) > 0 THEN
        RAISE EXCEPTION 'Producto no cumple reglas de calidad: %', v_blocking_issues::text
            USING ERRCODE = '23514';
    END IF;

    IF NEW.vendor_profile_id IS NOT NULL THEN
        SELECT (verification_status::text = 'verified') INTO v_vendor_verified
          FROM public.vendor_profiles WHERE id = NEW.vendor_profile_id;
        IF NOT COALESCE(v_vendor_verified, false) THEN
            NEW.status := 'pending_review';
        END IF;
    END IF;

    RETURN NEW;
END;
$fn$;

-- ─── 7. Capacidad del vendedor: DEFINER (la RLS no debe esconder el perfil) ──
ALTER FUNCTION public.validate_product_vendor_capability() SECURITY DEFINER;

-- ─── Grants de funciones ─────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public._store_actor(uuid)                                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_can_manage_product(uuid)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_adjust(uuid, uuid, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_product_quality_row(public.products)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_product_publish_gate()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_product_vendor_capability()                 FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.store_can_manage_product(uuid)                        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inventory_adjust(uuid, uuid, integer, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_product_quality_row(public.products)         TO service_role;
-- validate_product_quality(uuid) conserva sus grants (authenticated, service_role).

COMMIT;
