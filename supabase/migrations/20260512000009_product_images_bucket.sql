-- ============================================================
-- SPORTMAPS — Product images bucket
--
-- Crea el bucket publico `product-images` para que el wizard de
-- creacion de productos (ProductGalleryUploader) pueda subir las
-- imagenes sin el error "Bucket not found".
--
-- Path esperado por el frontend (ProductGalleryUploader.tsx L65):
--   <vendor_profile.id | auth.uid()>/<timestamp>-<rand>.<ext>
--
-- Publico: las URLs se sirven con getPublicUrl() para mostrarse en
-- el marketplace sin signed URLs.
--
-- Policies:
--   owner_upload  — el dueno sube en su carpeta (vendor o propio uid).
--   owner_update  — el dueno puede sobrescribir / mover.
--   owner_delete  — el dueno puede borrar.
--   public_read   — cualquiera lee (bucket publico).
--   admin_modify  — admin/super_admin pueden moderar contenido.
--
-- Limites: 5 MB / archivo. Mime: jpeg, png, webp.
-- ============================================================


-- 1. Crear bucket si no existe (publico, mime restringido, 5MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    5242880,  -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
   SET public            = EXCLUDED.public,
       file_size_limit   = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 2. Policies en storage.objects
--    Path: <namespace>/<filename> donde namespace = vendor_profile.id OR auth.uid()
--    Usamos (storage.foldername(name))[1] para extraer el primer segmento.

-- INSERT: dueno puede subir en su carpeta (vendor_profile.id propio o su auth uid)
DROP POLICY IF EXISTS "product_images_owner_upload" ON storage.objects;
CREATE POLICY "product_images_owner_upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'product-images'
        AND (
            -- carpeta = mi auth uid
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            -- carpeta = id de un vendor_profile que me pertenece
            EXISTS (
                SELECT 1
                  FROM public.vendor_profiles vp
                 WHERE vp.id::text = (storage.foldername(name))[1]
                   AND vp.user_id = auth.uid()
            )
        )
    );

-- UPDATE: mismo criterio que upload
DROP POLICY IF EXISTS "product_images_owner_update" ON storage.objects;
CREATE POLICY "product_images_owner_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'product-images'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR EXISTS (
                SELECT 1
                  FROM public.vendor_profiles vp
                 WHERE vp.id::text = (storage.foldername(name))[1]
                   AND vp.user_id = auth.uid()
            )
        )
    );

-- DELETE: mismo criterio
DROP POLICY IF EXISTS "product_images_owner_delete" ON storage.objects;
CREATE POLICY "product_images_owner_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'product-images'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR EXISTS (
                SELECT 1
                  FROM public.vendor_profiles vp
                 WHERE vp.id::text = (storage.foldername(name))[1]
                   AND vp.user_id = auth.uid()
            )
        )
    );

-- SELECT: publico (anon + authenticated). El bucket es publico pero igualmente
-- declaramos la policy para que el row level security la honre.
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'product-images');

-- Admin / super_admin pueden modificar/borrar para moderar contenido.
DROP POLICY IF EXISTS "product_images_admin_update" ON storage.objects;
CREATE POLICY "product_images_admin_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'product-images'
        AND EXISTS (
            SELECT 1
              FROM public.profiles p
             WHERE p.id = auth.uid()
               AND p.role::text IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "product_images_admin_delete" ON storage.objects;
CREATE POLICY "product_images_admin_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'product-images'
        AND EXISTS (
            SELECT 1
              FROM public.profiles p
             WHERE p.id = auth.uid()
               AND p.role::text IN ('admin', 'super_admin')
        )
    );


-- 3. Refresh schema cache
NOTIFY pgrst, 'reload config';
