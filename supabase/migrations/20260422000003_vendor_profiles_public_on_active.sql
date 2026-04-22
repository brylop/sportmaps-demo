-- Migration: 20260422000003_vendor_profiles_public_on_active.sql
-- Description: Relaja la RLS de vendor_profiles y service_listings para que
-- un vendedor sea visible al publicar desde Mi Perfil Publico (is_active=true)
-- sin tener que esperar verification_status='verified'. El badge de verificado
-- sigue existiendo en la UI como distintivo de confianza, pero no bloquea la
-- aparicion en Explorar.

-- ── vendor_profiles: SELECT publico sobre is_active=true ────────────────
DROP POLICY IF EXISTS "vendor_profiles_select_public" ON public.vendor_profiles;

CREATE POLICY "vendor_profiles_select_public"
    ON public.vendor_profiles FOR SELECT
    USING (is_active = true);

COMMENT ON POLICY "vendor_profiles_select_public" ON public.vendor_profiles IS
    'Publico: ver vendedores activos. verification_status queda como badge de confianza, no como gate.';

-- ── service_listings: el SELECT publico ya era is_active=true y visibility=public,
--    se mantiene igual (ok).
