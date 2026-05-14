-- ============================================================
-- SPORTMAPS — Vendor profiles: admin/super_admin read all
--
-- La RLS actual de vendor_profiles solo permite:
--   - SELECT propio (user_id = auth.uid())
--   - SELECT publico si is_active=true AND verification_status='verified'
--
-- Esto bloquea al super_admin para ver la cola de moderacion de
-- vendors pendientes desde el client directo (sin pasar por BFF).
--
-- Agregamos una policy aditiva: admin y super_admin leen todos los
-- vendor_profiles independiente del estado, para poder moderarlos
-- en AdminMarketplaceModerationPage > Vendors pendientes.
--
-- Writes siguen restringidos a vendor_profiles_update_own. La
-- actualizacion del verification_status se hace via BFF SECURITY
-- DEFINER endpoint /admin/vendors/:id/verify.
-- ============================================================

DROP POLICY IF EXISTS "vendor_profiles_admin_read" ON public.vendor_profiles;
CREATE POLICY "vendor_profiles_admin_read"
    ON public.vendor_profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM public.profiles p
             WHERE p.id = auth.uid()
               AND p.role::text IN ('admin', 'super_admin')
        )
    );

NOTIFY pgrst, 'reload config';
