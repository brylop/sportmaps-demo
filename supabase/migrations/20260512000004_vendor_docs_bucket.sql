-- ============================================================
-- SPORTMAPS — Vendor verification docs bucket
--
-- Crea el bucket privado `vendor-docs` para que VendorOnboardingPage
-- pueda subir el RUT/Camara de Comercio/Tarjeta Profesional sin
-- el error "Bucket not found".
--
-- Privado por defecto. Path esperado: <user.id>-<timestamp>.<ext>
-- (ver VendorOnboardingPage.tsx L201).
--
-- Policies:
--   - owner_upload: el dueno del archivo puede subir (foldername()[1] no aplica
--     porque el path es flat; usamos prefix con user.id en el name).
--   - owner_read:   el dueno puede leer su propio doc para previsualizar.
--   - admin_read:   roles privilegiados leen para verificar vendors.
--
-- Notas:
--   - File size limit: 5MB (consistente con identity_documents).
--   - Allowed mime: pdf, jpg, png.
--   - Si el archivo se persistio en `vendor_profiles.verification_doc_url`
--     como public URL, esa URL no funcionara porque el bucket es privado.
--     El frontend debe usar createSignedUrl para mostrarlo.
-- ============================================================


-- 1. Crear bucket si no existe (privado, mime restringido, 5MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'vendor-docs',
    'vendor-docs',
    false,
    5242880,  -- 5 MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
   SET public            = EXCLUDED.public,
       file_size_limit   = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 2. Policies en storage.objects
--    Path actual del frontend: <user.id>-<timestamp>.<ext>  (flat, sin carpeta)
--    Usamos starts_with(name, auth.uid()::text || '-') para owner-match.

DROP POLICY IF EXISTS "vendor_docs_owner_upload" ON storage.objects;
CREATE POLICY "vendor_docs_owner_upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'vendor-docs'
        AND name LIKE (auth.uid()::text || '-%')
    );

DROP POLICY IF EXISTS "vendor_docs_owner_read" ON storage.objects;
CREATE POLICY "vendor_docs_owner_read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'vendor-docs'
        AND name LIKE (auth.uid()::text || '-%')
    );

DROP POLICY IF EXISTS "vendor_docs_owner_update" ON storage.objects;
CREATE POLICY "vendor_docs_owner_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'vendor-docs'
        AND name LIKE (auth.uid()::text || '-%')
    );

DROP POLICY IF EXISTS "vendor_docs_owner_delete" ON storage.objects;
CREATE POLICY "vendor_docs_owner_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'vendor-docs'
        AND name LIKE (auth.uid()::text || '-%')
    );

-- Admin / staff puede leer cualquier doc para verificar identidad del vendor.
DROP POLICY IF EXISTS "vendor_docs_admin_read" ON storage.objects;
CREATE POLICY "vendor_docs_admin_read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'vendor-docs'
        AND EXISTS (
            SELECT 1
              FROM public.profiles p
             WHERE p.id = auth.uid()
               AND p.role::text IN ('owner', 'admin', 'super_admin')
        )
    );


-- 3. Refresh schema cache
NOTIFY pgrst, 'reload config';
