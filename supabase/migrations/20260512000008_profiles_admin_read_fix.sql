-- ============================================================
-- SPORTMAPS — Fix policy profiles_admin_read (recursión infinita)
--
-- La migracion 20260512000007 creo una policy SELECT en profiles que
-- hacia SELECT FROM profiles dentro del USING — eso dispara la propia
-- policy y causa "infinite recursion detected in policy for relation
-- profiles" (código 42P17). Rompió el login.
--
-- La forma correcta es delegar el check a public.is_super_admin()
-- que es SECURITY DEFINER (bypasa RLS).
-- ============================================================

-- 1. Dropear la policy rota
DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;

-- 2. Recrearla usando is_super_admin() para evitar recursion
CREATE POLICY "profiles_admin_read"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.is_super_admin());

NOTIFY pgrst, 'reload config';
