-- =============================================================================
-- 20261002125959_tienda_apagada_y_guard_vendor_profiles.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-02   Versión anterior: 20261002125957
-- Objetivo: apagar la tienda/marketplace sin borrar nada (decisión D-A) y cerrar
--   T2 de docs/auditoria-contabilidad-tienda-2026-10-02.md.
--   Spec: docs/specs/blindaje-dinero-pagos-tienda-nomina.md §1.3.
--
--   1. Flag global platform_config.store_enabled = false + función
--      store_enabled(). Se reprende con un UPDATE de una fila, sin deploy.
--   2. Policies RESTRICTIVE store_off_* que, con la tienda apagada, cierran la
--      escritura directa de órdenes, ítems, productos, variantes, reembolsos y
--      mensajes, y esconden productos/variantes a quien no es su dueño. Esto
--      cierra también T3/T4/T5/T6 mientras la tienda esté apagada (reabrirla
--      exige la Tienda v2: órdenes por RPC con precios de la base).
--      El historial (SELECT de órdenes propias) no se toca. Ninguna fila se borra.
--   3. T2: un usuario se autoverificaba como vendedor, se ponía comisión 0 o se
--      daba capacidades: vendor_profiles_update_own no tenía WITH CHECK ni
--      protección de columnas, y enable_vendor_profile (DEFINER) deja elegir
--      vendor_type/capabilities. Trigger trg_guard_vendor_profiles las congela.
--
--   NO se cierra vendor_profiles entera: la usan wellness, el entrenador
--   personal, 12 planes school_monthly de escuelas reales,
--   can_manage_finances('vendor', …) y 9 policies de otras tablas.
--   Uso real que se pierde al apagar: 0 (1 orden seed, 3 productos demo).
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

-- ─── 1. Flag ─────────────────────────────────────────────────────────────────
INSERT INTO public.platform_config (key, value, description)
VALUES ('store_enabled', '{"enabled": false}'::jsonb,
        'Tienda/marketplace de productos. false = apagada (spec blindaje-dinero §1.3). Reprender: UPDATE … SET value = ''{"enabled": true}''.')
ON CONFLICT (key) DO NOTHING;

-- DEFINER porque platform_config solo la lee el super admin; devuelve un
-- booleano y nada más. Falla cerrado: sin fila o sin valor = apagada.
CREATE OR REPLACE FUNCTION public.store_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT COALESCE(
        (SELECT (value ->> 'enabled')::boolean FROM public.platform_config WHERE key = 'store_enabled'),
        false
    );
$fn$;

COMMENT ON FUNCTION public.store_enabled() IS
  'true si la tienda/marketplace de productos está prendida (platform_config.store_enabled). Falla cerrado.';

REVOKE ALL ON FUNCTION public.store_enabled() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_enabled() TO anon, authenticated, service_role;

-- ─── 2. Policies RESTRICTIVE: con la tienda apagada no hay escritura directa ──
-- RESTRICTIVE se suma con AND a las permisivas existentes: no hace falta tocar
-- las policies actuales y apagar/prender es solo el flag.

-- orders
DROP POLICY IF EXISTS store_off_insert ON public.orders;
CREATE POLICY store_off_insert ON public.orders AS RESTRICTIVE
    FOR INSERT TO authenticated, anon WITH CHECK (public.store_enabled());
DROP POLICY IF EXISTS store_off_update ON public.orders;
CREATE POLICY store_off_update ON public.orders AS RESTRICTIVE
    FOR UPDATE TO authenticated, anon USING (public.store_enabled()) WITH CHECK (public.store_enabled());

-- order_items
DROP POLICY IF EXISTS store_off_insert ON public.order_items;
CREATE POLICY store_off_insert ON public.order_items AS RESTRICTIVE
    FOR INSERT TO authenticated, anon WITH CHECK (public.store_enabled());
DROP POLICY IF EXISTS store_off_update ON public.order_items;
CREATE POLICY store_off_update ON public.order_items AS RESTRICTIVE
    FOR UPDATE TO authenticated, anon USING (public.store_enabled()) WITH CHECK (public.store_enabled());

-- products: escritura cerrada; lectura solo para el dueño (y super admin).
DROP POLICY IF EXISTS store_off_insert ON public.products;
CREATE POLICY store_off_insert ON public.products AS RESTRICTIVE
    FOR INSERT TO authenticated, anon WITH CHECK (public.store_enabled());
DROP POLICY IF EXISTS store_off_update ON public.products;
CREATE POLICY store_off_update ON public.products AS RESTRICTIVE
    FOR UPDATE TO authenticated, anon USING (public.store_enabled()) WITH CHECK (public.store_enabled());
DROP POLICY IF EXISTS store_off_select ON public.products;
CREATE POLICY store_off_select ON public.products AS RESTRICTIVE
    FOR SELECT TO authenticated, anon
    USING (public.store_enabled() OR vendor_id = auth.uid() OR (SELECT public.is_super_admin()));

-- product_variants: igual, el dueño se resuelve por el producto padre.
DROP POLICY IF EXISTS store_off_insert ON public.product_variants;
CREATE POLICY store_off_insert ON public.product_variants AS RESTRICTIVE
    FOR INSERT TO authenticated, anon WITH CHECK (public.store_enabled());
DROP POLICY IF EXISTS store_off_update ON public.product_variants;
CREATE POLICY store_off_update ON public.product_variants AS RESTRICTIVE
    FOR UPDATE TO authenticated, anon USING (public.store_enabled()) WITH CHECK (public.store_enabled());
DROP POLICY IF EXISTS store_off_select ON public.product_variants;
CREATE POLICY store_off_select ON public.product_variants AS RESTRICTIVE
    FOR SELECT TO authenticated, anon
    USING (
        public.store_enabled()
        OR EXISTS (SELECT 1 FROM public.products p
                    WHERE p.id = product_variants.product_id AND p.vendor_id = auth.uid())
        OR (SELECT public.is_super_admin())
    );

-- refunds y store_messages: sin altas nuevas con la tienda apagada.
DROP POLICY IF EXISTS store_off_insert ON public.refunds;
CREATE POLICY store_off_insert ON public.refunds AS RESTRICTIVE
    FOR INSERT TO authenticated, anon WITH CHECK (public.store_enabled());
DROP POLICY IF EXISTS store_off_insert ON public.store_messages;
CREATE POLICY store_off_insert ON public.store_messages AS RESTRICTIVE
    FOR INSERT TO authenticated, anon WITH CHECK (public.store_enabled());

-- ─── 3. T2 — vendor_profiles: el dueño no se autoverifica ────────────────────
ALTER POLICY vendor_profiles_update_own ON public.vendor_profiles
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- INVOKER: decide por auth.role()/auth.uid(), que siguen siendo los del usuario
-- aunque la escritura venga de enable_vendor_profile (DEFINER).
CREATE OR REPLACE FUNCTION public.fn_guard_vendor_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_col text;
BEGIN
    -- BFF (service_role), crons/SQL sin JWT y super admin: sin restricción.
    IF COALESCE(auth.role(), '') = 'service_role'
       OR auth.uid() IS NULL
       OR public.is_super_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Nadie nace verificado ni elige su comisión.
        NEW.verification_status := 'pending';
        NEW.commission_rate     := 0.10;
        NEW.avg_rating          := NULL;
        NEW.reviews_count       := 0;
        -- Con la tienda apagada nadie se da permiso de vender productos.
        IF NOT public.store_enabled() THEN
            NEW.capabilities := jsonb_set(
                COALESCE(NEW.capabilities, '{}'::jsonb), '{can_sell_products}', 'false'::jsonb, true);
        END IF;
        RETURN NEW;
    END IF;

    v_col := CASE
        WHEN NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN 'verification_status'
        WHEN NEW.commission_rate     IS DISTINCT FROM OLD.commission_rate     THEN 'commission_rate'
        WHEN NEW.capabilities        IS DISTINCT FROM OLD.capabilities        THEN 'capabilities'
        WHEN NEW.vendor_type         IS DISTINCT FROM OLD.vendor_type         THEN 'vendor_type'
        WHEN NEW.user_id             IS DISTINCT FROM OLD.user_id             THEN 'user_id'
        -- Los agregados de reseñas los recalcula recalc_vendor_review_aggregates
        -- (DEFINER, current_user = postgres); el usuario no los escribe directo.
        WHEN current_user IN ('authenticated', 'anon')
             AND (NEW.avg_rating    IS DISTINCT FROM OLD.avg_rating
               OR NEW.reviews_count IS DISTINCT FROM OLD.reviews_count) THEN 'avg_rating/reviews_count'
    END;
    IF v_col IS NOT NULL THEN
        RAISE EXCEPTION 'VENDOR_FIELD_LOCKED: %', v_col
            USING ERRCODE = '42501',
                  HINT = 'La verificación, la comisión y las capacidades las cambia SportMaps.';
    END IF;
    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.fn_guard_vendor_profiles() IS
  'Congela verificación, comisión, capacidades y tipo de vendor_profiles para el propio usuario. Spec blindaje-dinero §1.3 (T2).';

REVOKE ALL ON FUNCTION public.fn_guard_vendor_profiles() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_vendor_profiles ON public.vendor_profiles;
CREATE TRIGGER trg_guard_vendor_profiles
    BEFORE INSERT OR UPDATE ON public.vendor_profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_vendor_profiles();

COMMIT;
