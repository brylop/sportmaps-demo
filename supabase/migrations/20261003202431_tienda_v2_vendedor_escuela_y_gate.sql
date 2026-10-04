-- =============================================================================
-- 20261003202431_tienda_v2_vendedor_escuela_y_gate.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261003202429
-- Objetivo: M-F0-1 de docs/specs/tienda-v2-f0-plan-migraciones.md.
--   La tienda de una escuela no existía como tal: vendor_profiles no sabe a qué
--   escuela pertenece (se deducía por schools.owner_id, ambiguo con 2 escuelas),
--   solo el usuario dueño podía administrarla (no los admins) y no había forma
--   de prender la tienda para UN vendedor piloto sin prenderla para las 7
--   escuelas con addon.
--
--   1. vendor_profiles.school_id (+ UNIQUE parcial) con backfill solo cuando el
--      dueño tiene UNA escuela (el caso 1 dueño / 2 escuelas queda NULL).
--   2. can_manage_store(vp) / can_manage_store_as(vp, user): dueño del perfil,
--      owner/admin de la escuela del perfil (NO coaches, D-15) o super admin.
--   3. store_pilot_allowlist() + store_seller_allowed(vp): flag global AND
--      allowlist de piloto (D-14) AND perfil activo con can_sell_products AND
--      (escuela con addon store y operativa | externo verificado).
--   4. enable_school_store(school): crea/reusa el perfil 'school' de la
--      escuela, verificado (D-4) y con can_sell_products. Un perfil por usuario
--      (D-16): si el dueño ya tiene otro perfil → OWNER_HAS_OTHER_VENDOR_PROFILE.
--   5. trial_block_* de products ya no bloquea a externos (school_id NULL).
--   6. RESTRICTIVE store_seller_visible (SELECT products/product_variants):
--      terceros solo ven productos de vendedores habilitados.
--   7. fn_guard_vendor_profiles (M3) congela también school_id y deja pasar a
--      las RPC de confianza (GUC sportmaps.trusted_rpc local a la transacción).
--   8. R03b / T1: authenticated deja de leer vendor_profiles.bank_data por
--      PostgREST (grant por columnas). Ningún lector con JWT la pide; el BFF
--      usa service role.
--
--   NO decide comisión (D-3): enable_school_store deja el default de la
--   columna y no toca la comisión de un perfil existente.
--   Prerrequisito: 20261002125959 (M3: store_enabled(), trg_guard_vendor_profiles).
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

-- Falla temprano si M3 no está aplicada: esta migración la extiende.
DO $pre$
BEGIN
    IF to_regprocedure('public.store_enabled()') IS NULL
       OR to_regprocedure('public.fn_guard_vendor_profiles()') IS NULL THEN
        RAISE EXCEPTION 'Falta M3 (20261002125959_tienda_apagada_y_guard_vendor_profiles): aplicarla antes.';
    END IF;
END
$pre$;

-- ─── 1. vendor_profiles.school_id ────────────────────────────────────────────
ALTER TABLE public.vendor_profiles
    ADD COLUMN IF NOT EXISTS school_id uuid NULL REFERENCES public.schools(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_profiles_school_id_uniq
    ON public.vendor_profiles (school_id) WHERE school_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_profiles.school_id IS
  'Escuela dueña de la tienda (vendor_type=school). Una tienda por escuela. NULL = externo o caso ambiguo sin resolver (dueño con varias escuelas).';

-- Backfill: solo perfiles 'school' cuyo dueño es owner de exactamente UNA escuela.
-- (Lo corre postgres sin JWT → el guard de M3 lo deja pasar.)
WITH unicas AS (
    SELECT s.owner_id, min(s.id::text)::uuid AS school_id
      FROM public.schools s
     WHERE s.owner_id IS NOT NULL
     GROUP BY s.owner_id
    HAVING count(*) = 1
)
UPDATE public.vendor_profiles vp
   SET school_id = u.school_id
  FROM unicas u
 WHERE vp.vendor_type = 'school'
   AND vp.school_id IS NULL
   AND vp.user_id = u.owner_id
   AND NOT EXISTS (SELECT 1 FROM public.vendor_profiles x WHERE x.school_id = u.school_id);

-- ─── 2. Quién administra una tienda ──────────────────────────────────────────
-- Versión con usuario explícito: para el BFF (service role, auth.uid() NULL).
CREATE OR REPLACE FUNCTION public.can_manage_store_as(p_vendor_profile_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT p_vendor_profile_id IS NOT NULL AND p_user_id IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM public.vendor_profiles vp
             WHERE vp.id = p_vendor_profile_id
               AND (
                    vp.user_id = p_user_id
                 OR (vp.school_id IS NOT NULL AND (
                        EXISTS (SELECT 1 FROM public.schools s
                                 WHERE s.id = vp.school_id AND s.owner_id = p_user_id)
                     OR EXISTS (SELECT 1 FROM public.school_members sm
                                 WHERE sm.school_id = vp.school_id
                                   AND sm.profile_id = p_user_id
                                   AND sm.status = 'active'
                                   AND sm.role IN ('owner','admin','school_admin','super_admin'))
                    ))
               )
        )
        OR EXISTS (SELECT 1 FROM public.platform_admins pa
                    WHERE pa.profile_id = p_user_id AND pa.is_active = true)
    );
$fn$;

COMMENT ON FUNCTION public.can_manage_store_as(uuid, uuid) IS
  'Tienda v2 (D-15): ¿p_user_id administra la tienda? Dueño del perfil, owner/admin (no coach) de su escuela o admin de plataforma. Solo service_role.';

CREATE OR REPLACE FUNCTION public.can_manage_store(p_vendor_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT COALESCE(public.can_manage_store_as(p_vendor_profile_id, auth.uid()), false)
        OR (p_vendor_profile_id IS NOT NULL AND public.is_super_admin());
$fn$;

COMMENT ON FUNCTION public.can_manage_store(uuid) IS
  'Tienda v2 (D-15): ¿el usuario de la sesión administra la tienda p_vendor_profile_id?';

-- ─── 3. Gate de vendedor + allowlist de piloto ───────────────────────────────
-- NULL = sin allowlist (todos los vendedores que cumplan el resto).
-- Clave presente pero mal formada = lista vacía (falla cerrado).
CREATE OR REPLACE FUNCTION public.store_pilot_allowlist()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_val jsonb;
BEGIN
    SELECT value -> 'allowlist' INTO v_val
      FROM public.platform_config WHERE key = 'store_enabled';
    IF v_val IS NULL OR jsonb_typeof(v_val) = 'null' THEN
        RETURN NULL;
    END IF;
    IF jsonb_typeof(v_val) <> 'array' THEN
        RETURN '{}'::uuid[];
    END IF;
    BEGIN
        RETURN COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_val)::uuid), '{}'::uuid[]);
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN '{}'::uuid[];
    END;
END;
$fn$;

COMMENT ON FUNCTION public.store_pilot_allowlist() IS
  'Tienda v2 (D-14): platform_config.store_enabled.value->allowlist (vendor_profile_id[]). NULL = sin restricción; mal formada = vacía.';

CREATE OR REPLACE FUNCTION public.store_seller_allowed(p_vendor_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
    SELECT COALESCE((
        SELECT public.store_enabled()
           AND (public.store_pilot_allowlist() IS NULL
                OR vp.id = ANY (public.store_pilot_allowlist()))
           AND vp.is_active
           AND COALESCE((vp.capabilities ->> 'can_sell_products')::boolean, false)
           AND CASE vp.vendor_type::text
                 WHEN 'school' THEN
                      vp.school_id IS NOT NULL
                  AND COALESCE(public.has_entitlement(vp.school_id, 'store'), false)
                  AND public.school_is_operational(vp.school_id) IS TRUE
                 ELSE vp.verification_status = 'verified'
               END
          FROM public.vendor_profiles vp
         WHERE vp.id = p_vendor_profile_id
    ), false);
$fn$;

COMMENT ON FUNCTION public.store_seller_allowed(uuid) IS
  'Tienda v2 §6.5: el vendedor puede vender hoy (flag + allowlist + activo + can_sell_products + addon/operativa o verificado).';

-- ─── 7 (antes de 4). Guard de vendor_profiles: school_id congelado + RPC de confianza
CREATE OR REPLACE FUNCTION public.fn_guard_vendor_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_col text;
BEGIN
    -- BFF (service_role), crons/SQL sin JWT, super admin y RPC de confianza
    -- (enable_school_store fija sportmaps.trusted_rpc='on' local a su
    -- transacción; PostgREST no deja al cliente fijar GUC arbitrarios).
    IF COALESCE(auth.role(), '') = 'service_role'
       OR auth.uid() IS NULL
       OR public.is_super_admin()
       OR COALESCE(current_setting('sportmaps.trusted_rpc', true), '') = 'on' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Nadie nace verificado ni elige su comisión ni su escuela.
        NEW.verification_status := 'pending';
        NEW.commission_rate     := 0.10;
        NEW.avg_rating          := NULL;
        NEW.reviews_count       := 0;
        NEW.school_id           := NULL;
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
        WHEN NEW.school_id           IS DISTINCT FROM OLD.school_id           THEN 'school_id'
        WHEN current_user IN ('authenticated', 'anon')
             AND (NEW.avg_rating    IS DISTINCT FROM OLD.avg_rating
               OR NEW.reviews_count IS DISTINCT FROM OLD.reviews_count) THEN 'avg_rating/reviews_count'
    END;
    IF v_col IS NOT NULL THEN
        RAISE EXCEPTION 'VENDOR_FIELD_LOCKED: %', v_col
            USING ERRCODE = '42501',
                  HINT = 'La verificación, la comisión, las capacidades y la escuela las cambia SportMaps.';
    END IF;
    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.fn_guard_vendor_profiles() IS
  'Congela verificación, comisión, capacidades, tipo y escuela de vendor_profiles para el propio usuario. M3 + Tienda v2 M-F0-1.';

REVOKE ALL ON FUNCTION public.fn_guard_vendor_profiles() FROM PUBLIC, anon, authenticated;

-- ─── 4. enable_school_store ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enable_school_store(p_school_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_uid    uuid := auth.uid();
    v_school record;
    v_vp     record;
    v_id     uuid;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF p_school_id IS NULL OR NOT (p_school_id = ANY (public.user_admin_school_ids())) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501',
              HINT = 'Solo el dueño o un administrador de la escuela activa su tienda.';
    END IF;

    SELECT id, name, owner_id INTO v_school FROM public.schools WHERE id = p_school_id;
    IF v_school.id IS NULL OR v_school.owner_id IS NULL THEN
        RAISE EXCEPTION 'SCHOOL_WITHOUT_OWNER' USING ERRCODE = 'P0002';
    END IF;
    IF NOT COALESCE(public.has_entitlement(p_school_id, 'store'), false) THEN
        RAISE EXCEPTION 'ADDON_REQUIRED' USING ERRCODE = 'P0001',
              HINT = 'La escuela necesita el adicional Tienda.';
    END IF;

    PERFORM set_config('sportmaps.trusted_rpc', 'on', true);

    -- (a) la escuela ya tiene su perfil
    SELECT * INTO v_vp FROM public.vendor_profiles WHERE school_id = p_school_id FOR UPDATE;
    IF v_vp.id IS NULL THEN
        -- (b) el dueño ya tiene un perfil (UNIQUE(user_id), D-16)
        SELECT * INTO v_vp FROM public.vendor_profiles WHERE user_id = v_school.owner_id FOR UPDATE;
        IF v_vp.id IS NOT NULL
           AND (v_vp.vendor_type::text <> 'school'
                OR (v_vp.school_id IS NOT NULL AND v_vp.school_id <> p_school_id)) THEN
            PERFORM set_config('sportmaps.trusted_rpc', 'off', true);
            RAISE EXCEPTION 'OWNER_HAS_OTHER_VENDOR_PROFILE' USING ERRCODE = 'P0001',
                  HINT = 'El dueño ya tiene otro perfil de vendedor; se resuelve a mano (D-16).';
        END IF;
    END IF;

    IF v_vp.id IS NOT NULL THEN
        UPDATE public.vendor_profiles
           SET school_id           = p_school_id,
               is_active           = true,
               verification_status = 'verified',
               capabilities        = jsonb_set(COALESCE(capabilities, '{}'::jsonb),
                                               '{can_sell_products}', 'true'::jsonb, true),
               updated_at          = now()
         WHERE id = v_vp.id
        RETURNING id INTO v_id;
    ELSE
        INSERT INTO public.vendor_profiles (
            user_id, vendor_type, display_name, school_id, capabilities,
            verification_status, is_active
        ) VALUES (
            v_school.owner_id, 'school', COALESCE(v_school.name, 'Tienda'), p_school_id,
            jsonb_build_object('can_sell_products', true, 'can_sell_services', false),
            'verified', true
        )
        RETURNING id INTO v_id;
    END IF;

    PERFORM set_config('sportmaps.trusted_rpc', 'off', true);
    RETURN v_id;
END;
$fn$;

COMMENT ON FUNCTION public.enable_school_store(uuid) IS
  'Tienda v2 M-F0-1: crea o reusa la tienda (vendor_profile school) de la escuela, verificada (D-4). Owner/admin de la escuela con addon store.';

-- ─── 5. trial_block_* no bloquea externos (school_id NULL) ───────────────────
ALTER POLICY trial_block_insert ON public.products
    WITH CHECK (school_id IS NULL OR public.school_is_operational(school_id));
ALTER POLICY trial_block_update ON public.products
    USING (school_id IS NULL OR public.school_is_operational(school_id))
    WITH CHECK (school_id IS NULL OR public.school_is_operational(school_id));
ALTER POLICY trial_block_delete ON public.products
    USING (school_id IS NULL OR public.school_is_operational(school_id));

-- ─── 6. Visibilidad por vendedor habilitado (RESTRICTIVE, se suma con AND) ───
DROP POLICY IF EXISTS store_seller_visible ON public.products;
CREATE POLICY store_seller_visible ON public.products AS RESTRICTIVE
    FOR SELECT TO anon, authenticated
    USING (
        public.can_manage_store(vendor_profile_id)
        OR (vendor_profile_id IS NOT NULL AND public.store_seller_allowed(vendor_profile_id))
        OR vendor_id = (SELECT auth.uid())                 -- legacy sin perfil: su dueño
        OR (SELECT public.is_super_admin())
    );

-- La variante se ve si se ve su producto (la RLS de products aplica dentro del EXISTS).
DROP POLICY IF EXISTS store_seller_visible ON public.product_variants;
CREATE POLICY store_seller_visible ON public.product_variants AS RESTRICTIVE
    FOR SELECT TO anon, authenticated
    USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id));

-- ─── 8. bank_data fuera del alcance de authenticated (R03b / T1) ─────────────
-- Un grant de tabla cubre todas las columnas: se cambia por grant por columnas.
REVOKE SELECT ON public.vendor_profiles FROM authenticated;
GRANT SELECT (id, user_id, vendor_type, display_name, slug, description, logo_url,
              cover_image_url, city, address, phone, email, nit, website_url,
              payment_methods, capabilities, commission_rate, verification_status,
              verification_doc_url, is_active, metadata, created_at, updated_at,
              avg_rating, reviews_count, response_rate, avg_response_hours, school_id)
    ON public.vendor_profiles TO authenticated;
-- anon conserva sus columnas públicas de M1 y suma school_id (no sensible).
GRANT SELECT (school_id) ON public.vendor_profiles TO anon;

-- ─── Grants de funciones ─────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.can_manage_store_as(uuid, uuid)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_store(uuid)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_pilot_allowlist()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_seller_allowed(uuid)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enable_school_store(uuid)        FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_manage_store_as(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_store(uuid)          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_pilot_allowlist()         TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_seller_allowed(uuid)      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enable_school_store(uuid)       TO authenticated, service_role;

COMMIT;
