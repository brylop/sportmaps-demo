-- Migration: 20260422000003_vendor_profiles_public_on_active.sql
-- Description: Relaja la RLS de vendor_profiles y service_listings para que
-- un vendedor sea visible al publicar desde Mi Perfil Publico (is_active=true)
-- sin tener que esperar verification_status='verified'. El badge de verificado
-- sigue existiendo en la UI como distintivo de confianza, pero no bloquea la
-- aparicion en Explorar.
--
-- Defensiva: si vendor_profiles no existe (marketplace no aplicado), la
-- migration no falla, solo emite NOTICE. Se aplica cuando el marketplace
-- se despliegue.

DO $$
BEGIN
    IF to_regclass('public.vendor_profiles') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "vendor_profiles_select_public" ON public.vendor_profiles';
        EXECUTE $POLICY$
            CREATE POLICY "vendor_profiles_select_public"
                ON public.vendor_profiles FOR SELECT
                USING (is_active = true)
        $POLICY$;
        EXECUTE $COMMENT$
            COMMENT ON POLICY "vendor_profiles_select_public" ON public.vendor_profiles IS
                'Publico: ver vendedores activos. verification_status queda como badge de confianza, no como gate.'
        $COMMENT$;
    ELSE
        RAISE NOTICE 'Skip: public.vendor_profiles no existe en esta DB (marketplace no aplicado).';
    END IF;
END $$;

-- service_listings: el SELECT publico ya es is_active=true y visibility=public,
-- no requiere cambios.
