-- ============================================================
-- SPORTMAPS — vendor_profile inactivo por default en signup
--
-- Bug observado en stg (2026-05-19): un trainer recien registrado ve
-- el grupo "Mi Tienda" completo en el sidebar (Panel Tienda, Servicios,
-- Pedidos, Inbox, Liquidaciones, Envios, Promociones, Verificacion)
-- porque auto_create_vendor_profile crea el perfil con
-- is_active = true (default de la columna).
--
-- Decision (paralela a la de escuelas, 20260514000002): vender es
-- un upgrade que se solicita y aprueba manualmente, NO un default
-- de signup. Aplica a TODOS los roles que pueden vender:
-- external_vendor, wellness_professional, personal_trainer.
--
-- Cambio:
--   1. Trigger auto_create_vendor_profile pasa a crear vendor_profile
--      con is_active = false. El perfil queda creado (para que el
--      onboarding del rol pueda guardar datos contra una fila real)
--      pero no aparece en el sidebar ni en el marketplace publico
--      hasta que un super_admin lo active vía plan_upgrade_requests.
--
-- NO backfill: los vendor_profiles ya activos en stg/prod siguen
-- activos. Esta migracion solo cambia el comportamiento de signups
-- futuros. Si en stg hay un trainer de prueba que quieras desactivar,
-- corre manualmente:
--   UPDATE public.vendor_profiles SET is_active=false WHERE id='...';
-- ============================================================

BEGIN;


-- ============================================================
-- 1. auto_create_vendor_profile: insertar con is_active=false
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_create_vendor_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
BEGIN
    -- Solo los roles "vendedores explicitos" reciben vendor_profile auto.
    -- `school` queda EXCLUIDO desde 20260514000002 (addon `store`).
    -- El resto ahora se crea INACTIVO: el rol debe solicitar activacion
    -- via plan_upgrade_requests y un super_admin lo aprueba manualmente.
    IF NEW.role::text IN ('external_vendor', 'wellness_professional', 'personal_trainer') THEN
        INSERT INTO public.vendor_profiles (
            user_id,
            vendor_type,
            display_name,
            capabilities,
            is_active
        ) VALUES (
            NEW.id,
            CASE NEW.role::text
                WHEN 'external_vendor'        THEN 'store'::public.vendor_type
                WHEN 'wellness_professional'  THEN 'wellness'::public.vendor_type
                WHEN 'personal_trainer'       THEN 'personal_trainer'::public.vendor_type
            END,
            COALESCE(NEW.full_name, NEW.email, 'Vendedor'),
            CASE NEW.role::text
                WHEN 'external_vendor'        THEN '{"can_sell_products": true,  "can_sell_services": false}'::jsonb
                WHEN 'wellness_professional'  THEN '{"can_sell_products": false, "can_sell_services": true}'::jsonb
                WHEN 'personal_trainer'       THEN '{"can_sell_products": false, "can_sell_services": true}'::jsonb
            END,
            false  -- INACTIVO: requiere aprobacion via plan_upgrade_requests
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$body$;

COMMENT ON FUNCTION public.auto_create_vendor_profile() IS
    'Crea vendor_profile INACTIVO (is_active=false) para roles vendedores '
    '(external_vendor, wellness_professional, personal_trainer). La fila existe '
    'para que el onboarding del rol pueda guardar datos contra ella, pero el '
    'sidebar Mi Tienda y la visibilidad publica quedan apagados hasta que un '
    'super_admin lo apruebe via plan_upgrade_requests. `school` queda fuera '
    'desde 20260514000002 (modelo de addon).';


-- ============================================================
-- 2. Refresh PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload config';

COMMIT;
