-- ============================================================
-- SPORTMAPS — Linter Fase 1b
-- Cierra los 4 warnings de public_bucket_allows_listing en:
--   avatars, facility-photos, school-assets, coach-certificates
--
-- HALLAZGO IMPORTANTE
--   coach-certificates esta marcado public=true con policy SELECT
--   abierta, pero el frontend (frontend/src/hooks/useStorage.ts L52)
--   lo trata como privado. Cualquiera con la URL podia leer
--   certificados de coaches. Esta migracion lo pasa a privado y
--   agrega policies path-based.
--
-- POR QUE NO USAMOS SET ROLE supabase_storage_admin
--   En esta instancia de Supabase, el rol postgres NO es miembro
--   de supabase_storage_admin (pg_has_role devuelve false). Por eso
--   SET LOCAL ROLE falla con 42501. La alternativa probada que SI
--   funciona: emitir DROP/CREATE POLICY como statements top-level
--   sin DO block. postgres tiene grants suficientes via Supabase
--   para CREATE/DROP POLICY en storage.objects.
--
--   COMMENT ON POLICY si exige ownership literal de la tabla --
--   por eso se omite. Los comentarios estan en este header.
--
-- ACCESO PUBLICO POR URL
--   En Supabase Storage, las policies en storage.objects controlan
--   SELECT (LIST de objetos via API). El download por URL publica
--   del CDN funciona aunque no haya policy SELECT mientras
--   public=true. Entonces dropear las policies SELECT amplias
--   cierra el LIST sin romper getPublicUrl.
--
-- RIESGO coach-certificates -> privado
--   Si alguna fila en BD guardo la "public URL" del certificado
--   (en vez del filePath), esa URL deja de funcionar. El codigo
--   actual guarda filePath (correcto), pero datos legacy podrian
--   tener URLs publicas. Mitigation: re-leer via createSignedUrl.
-- ============================================================


-- 1. coach-certificates: bucket privado.
UPDATE storage.buckets
   SET public = false
 WHERE id = 'coach-certificates';


-- 2. avatars
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;


-- 3. facility-photos
DROP POLICY IF EXISTS "Anyone can view facility photos" ON storage.objects;


-- 4. school-assets — tenia 3 policies SELECT abiertas
DROP POLICY IF EXISTS "Logo es público"            ON storage.objects;
DROP POLICY IF EXISTS "QRs son públicos"           ON storage.objects;
DROP POLICY IF EXISTS "school_assets_public_read"  ON storage.objects;


-- 5. coach-certificates — ahora privado, requiere policies explicitas
DROP POLICY IF EXISTS "Coach can view own certificates" ON storage.objects;
DROP POLICY IF EXISTS "coach_certs_owner_read"          ON storage.objects;
DROP POLICY IF EXISTS "coach_certs_staff_read"          ON storage.objects;

-- Owner read: el coach que subio el cert lo puede leer.
-- Path esperado: <user.id>/<filename>  (ver CoachProfileWizard.tsx L226)
-- foldername()[1] = auth.uid()
CREATE POLICY "coach_certs_owner_read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'coach-certificates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Staff read: roles privilegiados pueden leer cualquier cert para
-- verificacion de credenciales. TODO: restringir por escuela en
-- migracion aparte.
CREATE POLICY "coach_certs_staff_read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'coach-certificates'
        AND EXISTS (
            SELECT 1
              FROM public.profiles p
             WHERE p.id = auth.uid()
               AND p.role::text IN (
                   'owner', 'admin', 'super_admin', 'school_admin', 'school'
               )
        )
    );


-- 6. Refresh schema cache.
NOTIFY pgrst, 'reload config';
