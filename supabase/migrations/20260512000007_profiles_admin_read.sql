-- ============================================================
-- SPORTMAPS — Profiles: admin/super_admin read all
--
-- Para que la cola de moderacion de vendors muestre nombre y email
-- del titular, super_admin necesita leer profiles ajenos.
--
-- La RLS actual de profiles bloquea esto. Esta policy es aditiva
-- (SELECT) — los UPDATE/INSERT/DELETE siguen restringidos a las
-- policies existentes.
--
-- Tambien aplica para la moderacion de schools, organizers y
-- cualquier modulo administrativo que necesite resolver el dueno
-- de una entidad por user_id.
-- ============================================================

DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
CREATE POLICY "profiles_admin_read"
    ON public.profiles
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
