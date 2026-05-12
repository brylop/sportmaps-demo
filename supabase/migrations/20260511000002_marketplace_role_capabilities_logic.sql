-- ============================================================
-- SPORTMAPS MARKETPLACE — R1.1 (parte 2/2)
-- Logica de roles + capacidades.
--
-- Esta migracion EXTIENDE el modulo marketplace (vendor_profiles,
-- products, orders) creado por:
--   - 20260416000001_marketplace_core_tables.sql
--   - 20260416000002_marketplace_rls.sql
--
-- DEFENSIVO: si esas migraciones base no estan aplicadas en la BD
-- destino, las secciones que dependen de vendor_profiles se skipean
-- con NOTICE. Las partes que solo dependen del enum user_role y la
-- tabla roles SI se aplican.
--
-- Despues de aplicar las migraciones base, basta re-correr esta
-- migracion para completar la logica restante (es idempotente).
-- ============================================================


-- ============================================================
-- 1. Backfill: migrar store_owner -> external_vendor
--    Solo depende de user_role (no de vendor_profiles).
-- ============================================================

DO $$ BEGIN
    EXECUTE $sql$
        UPDATE public.profiles
        SET role = 'external_vendor'
        WHERE role::text = 'store_owner';
    $sql$;
EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE 'Skip 1: profiles.role no disponible para backfill.';
END $$;


-- ============================================================
-- 2. Backfill: vendor_profile para personal_trainer existentes
--    Requiere vendor_profiles. Si no existe, skip.
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
    ) THEN
        EXECUTE $sql$
            INSERT INTO public.vendor_profiles (user_id, vendor_type, display_name, capabilities)
            SELECT
                p.id,
                'personal_trainer'::public.vendor_type,
                COALESCE(p.full_name, p.email, 'Entrenador personal'),
                '{"can_sell_products": false, "can_sell_services": true}'::jsonb
            FROM public.profiles p
            WHERE p.role::text = 'personal_trainer'
              AND NOT EXISTS (
                  SELECT 1 FROM public.vendor_profiles vp WHERE vp.user_id = p.id
              );
        $sql$;
    ELSE
        RAISE NOTICE 'Skip 2: tabla vendor_profiles no existe. Ejecuta 20260416000001 primero.';
    END IF;
END $$;


-- ============================================================
-- 3. Trigger auto_create_vendor_profile actualizado
--    Requiere vendor_profiles. Si no existe, skip.
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
    ) THEN
        EXECUTE $func$
            CREATE OR REPLACE FUNCTION public.auto_create_vendor_profile()
            RETURNS trigger
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public
            AS $body$
            BEGIN
                IF NEW.role::text IN ('external_vendor', 'wellness_professional', 'personal_trainer', 'school') THEN
                    INSERT INTO public.vendor_profiles (
                        user_id,
                        vendor_type,
                        display_name,
                        capabilities
                    ) VALUES (
                        NEW.id,
                        CASE NEW.role::text
                            WHEN 'external_vendor'        THEN 'store'::public.vendor_type
                            WHEN 'wellness_professional'  THEN 'wellness'::public.vendor_type
                            WHEN 'personal_trainer'       THEN 'personal_trainer'::public.vendor_type
                            WHEN 'school'                 THEN 'school'::public.vendor_type
                        END,
                        COALESCE(NEW.full_name, NEW.email, 'Vendedor'),
                        CASE NEW.role::text
                            WHEN 'external_vendor'        THEN '{"can_sell_products": true,  "can_sell_services": false}'::jsonb
                            WHEN 'wellness_professional'  THEN '{"can_sell_products": false, "can_sell_services": true}'::jsonb
                            WHEN 'personal_trainer'       THEN '{"can_sell_products": false, "can_sell_services": true}'::jsonb
                            WHEN 'school'                 THEN '{"can_sell_products": true,  "can_sell_services": false}'::jsonb
                        END
                    )
                    ON CONFLICT (user_id) DO NOTHING;
                END IF;

                RETURN NEW;
            END;
            $body$;
        $func$;

        EXECUTE $tr$ DROP TRIGGER IF EXISTS trg_auto_vendor_profile ON public.profiles; $tr$;
        EXECUTE $tr$
            CREATE TRIGGER trg_auto_vendor_profile
                AFTER INSERT ON public.profiles
                FOR EACH ROW EXECUTE FUNCTION public.auto_create_vendor_profile();
        $tr$;
    ELSE
        RAISE NOTICE 'Skip 3: tabla vendor_profiles no existe. Trigger no se crea.';
    END IF;
END $$;


-- ============================================================
-- 4. Funcion helper has_vendor_capability(user_id, capability)
--    Requiere vendor_profiles. Si no existe, skip.
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
    ) THEN
        EXECUTE $func$
            CREATE OR REPLACE FUNCTION public.has_vendor_capability(
                p_user_id    uuid,
                p_capability text
            )
            RETURNS boolean
            LANGUAGE sql
            STABLE
            SECURITY DEFINER
            SET search_path = public
            AS $body$
                SELECT EXISTS (
                    SELECT 1
                    FROM public.vendor_profiles vp
                    WHERE vp.user_id    = p_user_id
                      AND vp.is_active  = true
                      AND COALESCE((vp.capabilities ->> p_capability)::boolean, false) = true
                );
            $body$;
        $func$;

        EXECUTE $cm$
            COMMENT ON FUNCTION public.has_vendor_capability(uuid, text) IS
                'Retorna true si el usuario tiene vendor_profile activo con la capability solicitada (can_sell_products | can_sell_services). Reemplaza la autorizacion por role.';
        $cm$;
    ELSE
        RAISE NOTICE 'Skip 4: tabla vendor_profiles no existe. has_vendor_capability no se crea.';
    END IF;
END $$;


-- ============================================================
-- 5. RPC enable_vendor_profile
--    Requiere vendor_profiles + vendor_type. Si no existe, skip.
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
    ) THEN
        EXECUTE $func$
            CREATE OR REPLACE FUNCTION public.enable_vendor_profile(
                p_vendor_type        public.vendor_type DEFAULT 'store',
                p_can_sell_products  boolean            DEFAULT true,
                p_can_sell_services  boolean            DEFAULT false,
                p_display_name       text               DEFAULT NULL,
                p_description        text               DEFAULT NULL,
                p_city               text               DEFAULT NULL,
                p_phone              text               DEFAULT NULL
            )
            RETURNS public.vendor_profiles
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public
            AS $body$
            DECLARE
                v_user_id     uuid := auth.uid();
                v_existing    public.vendor_profiles;
                v_display     text;
                v_result      public.vendor_profiles;
            BEGIN
                IF v_user_id IS NULL THEN
                    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
                END IF;

                SELECT * INTO v_existing
                FROM public.vendor_profiles
                WHERE user_id = v_user_id;

                IF v_existing.id IS NOT NULL THEN
                    UPDATE public.vendor_profiles
                    SET is_active     = true,
                        vendor_type   = p_vendor_type,
                        capabilities  = jsonb_build_object(
                                            'can_sell_products', p_can_sell_products,
                                            'can_sell_services', p_can_sell_services
                                        ),
                        display_name  = COALESCE(p_display_name, v_existing.display_name),
                        description   = COALESCE(p_description,  v_existing.description),
                        city          = COALESCE(p_city,         v_existing.city),
                        phone         = COALESCE(p_phone,        v_existing.phone),
                        updated_at    = now()
                    WHERE id = v_existing.id
                    RETURNING * INTO v_result;

                    RETURN v_result;
                END IF;

                SELECT COALESCE(p_display_name, full_name, email, 'Vendedor')
                  INTO v_display
                  FROM public.profiles
                 WHERE id = v_user_id;

                INSERT INTO public.vendor_profiles (
                    user_id,
                    vendor_type,
                    display_name,
                    description,
                    city,
                    phone,
                    capabilities,
                    is_active
                ) VALUES (
                    v_user_id,
                    p_vendor_type,
                    v_display,
                    p_description,
                    p_city,
                    p_phone,
                    jsonb_build_object(
                        'can_sell_products', p_can_sell_products,
                        'can_sell_services', p_can_sell_services
                    ),
                    true
                )
                RETURNING * INTO v_result;

                RETURN v_result;
            END;
            $body$;
        $func$;

        EXECUTE $cm$
            COMMENT ON FUNCTION public.enable_vendor_profile IS
                'Activa Mi Tienda para el usuario autenticado. Si ya existe vendor_profile, lo reactiva y actualiza capabilities. No cambia profiles.role.';
        $cm$;

        EXECUTE $gr$
            GRANT EXECUTE ON FUNCTION public.enable_vendor_profile(public.vendor_type, boolean, boolean, text, text, text, text) TO authenticated;
        $gr$;
    ELSE
        RAISE NOTICE 'Skip 5: tabla vendor_profiles no existe. enable_vendor_profile no se crea.';
    END IF;
END $$;


-- ============================================================
-- 6. RPC disable_vendor_profile (soft deactivate)
--    Requiere vendor_profiles + orders + order_items + products.
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
    ) THEN
        EXECUTE $func$
            CREATE OR REPLACE FUNCTION public.disable_vendor_profile()
            RETURNS boolean
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public
            AS $body$
            DECLARE
                v_user_id        uuid := auth.uid();
                v_pending_orders integer := 0;
            BEGIN
                IF v_user_id IS NULL THEN
                    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
                END IF;

                -- Si las tablas orders/order_items/products existen, valido
                -- que no haya pedidos en proceso.
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'orders'
                ) AND EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'order_items'
                ) AND EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'products'
                ) THEN
                    SELECT COUNT(*) INTO v_pending_orders
                    FROM public.orders o
                    JOIN public.order_items oi ON oi.order_id = o.id
                    JOIN public.products    p  ON p.id        = oi.product_id
                    WHERE p.vendor_id = v_user_id
                      AND o.status IN ('pending', 'processing', 'shipped');

                    IF v_pending_orders > 0 THEN
                        RAISE EXCEPTION 'No puedes desactivar tu tienda mientras tengas % ordenes en proceso.', v_pending_orders
                            USING ERRCODE = '23514';
                    END IF;
                END IF;

                UPDATE public.vendor_profiles
                SET is_active  = false,
                    updated_at = now()
                WHERE user_id = v_user_id;

                RETURN true;
            END;
            $body$;
        $func$;

        EXECUTE $cm$
            COMMENT ON FUNCTION public.disable_vendor_profile IS
                'Soft deactivate Mi Tienda. Bloqueado si hay ordenes en proceso. Conserva historial.';
        $cm$;

        EXECUTE $gr$
            GRANT EXECUTE ON FUNCTION public.disable_vendor_profile() TO authenticated;
        $gr$;
    ELSE
        RAISE NOTICE 'Skip 6: tabla vendor_profiles no existe. disable_vendor_profile no se crea.';
    END IF;
END $$;


-- ============================================================
-- 7. Seed tabla public.roles (usada por RoleSelection frontend)
--    Solo si la tabla existe. Independiente del marketplace.
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'roles'
    ) THEN
        INSERT INTO public.roles (name, display_name, description, is_visible) VALUES
            ('external_vendor', 'Vendedor / Marca',
             'Vendedor independiente. Tienda, marca o distribuidor que vende productos deportivos.', true),
            ('personal_trainer', 'Entrenador Personal',
             'Entrenador independiente que vende sesiones, planes y asesorias.', true)
        ON CONFLICT (name) DO UPDATE
            SET display_name = EXCLUDED.display_name,
                description  = EXCLUDED.description,
                is_visible   = EXCLUDED.is_visible;

        UPDATE public.roles
        SET is_visible   = false,
            display_name = 'Dueño de Tienda (legacy)',
            description  = 'Rol legado. Nuevos vendedores usan external_vendor.'
        WHERE name = 'store_owner';

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role_id'
        ) THEN
            EXECUTE $sql$
                UPDATE public.profiles p
                SET role_id = r.id
                FROM public.roles r
                WHERE r.name = 'external_vendor'
                  AND p.role::text = 'external_vendor'
                  AND (p.role_id IS NULL OR p.role_id <> r.id);
            $sql$;
        END IF;
    ELSE
        RAISE NOTICE 'Skip 7: tabla roles no existe. Frontend usara fallback hardcoded.';
    END IF;
END $$;


-- ============================================================
-- 8. Comentarios de documentacion (solo si los objetos existen)
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'vendor_profiles' AND column_name = 'capabilities'
    ) THEN
        EXECUTE $cm$
            COMMENT ON COLUMN public.vendor_profiles.capabilities IS
                'JSONB {can_sell_products, can_sell_services}. Eje de autorizacion principal — BFF y RLS validan por aqui, NO por profiles.role.';
        $cm$;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        EXECUTE $cm$
            COMMENT ON TYPE public.user_role IS
                'Identidad principal del usuario. external_vendor/wellness_professional/personal_trainer/school crean vendor_profile automatico. coach/parent/athlete pueden activar via enable_vendor_profile RPC.';
        $cm$;
    END IF;
END $$;
