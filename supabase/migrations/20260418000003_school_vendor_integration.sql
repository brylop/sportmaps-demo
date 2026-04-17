-- ============================================================
-- SPORTMAPS MARKETPLACE — Integracion Escuela como Vendedor
-- Las escuelas pueden vender productos (uniformes, kits, etc.)
-- Se crea vendor_profile automaticamente para el owner de la escuela.
-- ============================================================


-- ============================================================
-- 1. Reemplazar trigger auto_create_vendor_profile
-- Ahora tambien crea para role = 'school'
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_create_vendor_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Crear vendor_profile para roles vendedores
    IF NEW.role IN ('store_owner', 'wellness_professional', 'school') THEN
        INSERT INTO public.vendor_profiles (
            user_id,
            vendor_type,
            display_name,
            capabilities
        ) VALUES (
            NEW.id,
            CASE NEW.role
                WHEN 'store_owner' THEN 'store'::public.vendor_type
                WHEN 'wellness_professional' THEN 'wellness'::public.vendor_type
                WHEN 'school' THEN 'school'::public.vendor_type
            END,
            COALESCE(NEW.full_name, NEW.email, 'Vendedor'),
            CASE NEW.role
                WHEN 'store_owner' THEN
                    '{"can_sell_products": true, "can_sell_services": false}'::jsonb
                WHEN 'wellness_professional' THEN
                    '{"can_sell_products": false, "can_sell_services": true}'::jsonb
                WHEN 'school' THEN
                    '{"can_sell_products": true, "can_sell_services": false}'::jsonb
            END
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;


-- ============================================================
-- 2. Crear vendor_profiles para escuelas existentes
-- (backfill — solo para owners que aun no tengan vendor_profile)
-- ============================================================

INSERT INTO public.vendor_profiles (user_id, vendor_type, display_name, capabilities)
SELECT
    p.id,
    'school'::public.vendor_type,
    COALESCE(s.name, p.full_name, p.email, 'Escuela'),
    '{"can_sell_products": true, "can_sell_services": false}'::jsonb
FROM public.profiles p
JOIN public.schools s ON s.owner_id = p.id
WHERE p.role IN ('school', 'admin')
  AND NOT EXISTS (
      SELECT 1 FROM public.vendor_profiles vp WHERE vp.user_id = p.id
  );


-- ============================================================
-- 3. Actualizar display_name de vendor_profiles de escuelas
-- con el nombre real de la escuela
-- ============================================================

UPDATE public.vendor_profiles vp
SET display_name = s.name
FROM public.schools s
WHERE s.owner_id = vp.user_id
  AND vp.vendor_type = 'school'
  AND vp.display_name != s.name;


-- ============================================================
-- 4. Agregar vendor_profile_id a productos existentes de escuelas
-- (backfill para productos que ya tenian school_id pero no vendor_profile_id)
-- ============================================================

UPDATE public.products p
SET vendor_profile_id = vp.id
FROM public.vendor_profiles vp
WHERE vp.user_id = p.vendor_id
  AND p.vendor_profile_id IS NULL
  AND p.school_id IS NOT NULL;
