-- =========================================================================
-- 20260511000006 — Endurecer el bucket identity-documents.
--
-- Problema critico:
--   El bucket fue creado con public = true y la policy SELECT era
--   "USING (bucket_id = 'identity-documents')" — abierta a CUALQUIERA con
--   la URL, sin autenticar. Eso filtraba documentos de identidad de
--   menores (DNI, cedulas) a internet.
--
-- Hallazgo del audit de seguridad 2026-05-11.
--
-- Solucion:
--   1. Marcar el bucket como privado (public = false). No rompe nada
--      porque el frontend ya usa createSignedUrl al leer (ver
--      EventDocumentsTab, SchoolStudentsManagementPage, DocumentsReportTab).
--   2. Reemplazar la policy SELECT abierta por dos:
--      - El propio dueno del path (parent que subio el doc).
--      - Staff con role privilegiado (admin/school_admin/coach/organizer/...).
--   3. Conservar las policies INSERT/DELETE/UPDATE que ya validan ownership.
--
-- Trade-off: la policy de staff actualmente NO restringe por escuela —
-- cualquier staff de la plataforma puede leer cualquier doc. Endurecer
-- eso requiere join con public.children que es trabajo aparte. Esto cierra
-- el agujero critico (acceso anonimo) que es muchisimo mas grave.
--
-- Nota tecnica (permisos):
--   En Supabase managed reciente storage.objects es propiedad de
--   supabase_storage_admin, no de postgres. Sin escalar al rol dueno la
--   migracion falla con "ERROR: 42501: must be owner of relation objects".
--   Encapsulamos todas las operaciones sobre storage.objects en UN solo
--   DO block que hace SET LOCAL ROLE; el role aplica a las EXECUTE
--   subsiguientes dentro del block y se auto-revierte al salir.
-- =========================================================================


-- 1. Bucket privado. storage.buckets si puede editarlo el rol postgres
--    normal — no necesita escalada.
UPDATE storage.buckets
   SET public = false
 WHERE id = 'identity-documents';


-- 2. Policies sobre storage.objects, todo dentro de un DO block.
--    Estrategia: si el rol actual tiene membresia en supabase_storage_admin
--    (caso del Dashboard SQL Editor que corre como supabase_admin),
--    escalamos y aplicamos. Si no la tiene (caso CLI / postgres expuesto),
--    salimos del DO sin aplicar para no abortar el resto de la migracion.
--    El bloque de verificacion al final dispara error claro si nada se
--    aplico, indicando al operador que corra esta migracion desde el
--    Dashboard.
DO $$
BEGIN
    IF NOT pg_has_role(current_user, 'supabase_storage_admin', 'USAGE') THEN
        RAISE WARNING
            'El rol actual (%) no tiene membresia en supabase_storage_admin. Las policies de storage.objects NO se aplicaran aqui — corre esta migracion desde el SQL Editor del Dashboard de Supabase (corre como supabase_admin con privilegios completos).',
            current_user;
        RETURN;
    END IF;

    SET LOCAL ROLE supabase_storage_admin;

    -- 2.1 Eliminar la policy SELECT abierta y otros nombres legacy.
    EXECUTE 'DROP POLICY IF EXISTS "identity_docs_public_read" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Public Document Read"      ON storage.objects';

    -- 2.2 SELECT por path ownership: el parent que subio el doc puede leerlo.
    --     Path esperado: children/{auth.uid()}/docs/{filename}
    --     foldername()[2] = auth.uid()
    EXECUTE 'DROP POLICY IF EXISTS "identity_docs_owner_read" ON storage.objects';
    EXECUTE $sql$
        CREATE POLICY "identity_docs_owner_read"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (
            bucket_id = 'identity-documents'
            AND (storage.foldername(name))[2] = auth.uid()::text
        )
    $sql$;

    -- 2.3 SELECT por rol staff: admin/school_admin/coach/organizer/etc.
    --     pueden leer docs de cualquier nino para procesos administrativos
    --     (descarga masiva para eventos, reportes, etc.).
    --
    --     TODO: restringir esto a staff de la escuela del nino especifico
    --     haciendo join con public.children + school_members. Hoy queda
    --     intencionalmente amplio para no romper EventDocumentsTab.
    EXECUTE 'DROP POLICY IF EXISTS "identity_docs_staff_read" ON storage.objects';
    EXECUTE $sql$
        CREATE POLICY "identity_docs_staff_read"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (
            bucket_id = 'identity-documents'
            AND EXISTS (
                SELECT 1
                FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role::text IN (
                      'owner', 'admin', 'super_admin', 'school_admin', 'school',
                      'coach', 'staff', 'organizer'
                  )
            )
        )
    $sql$;

    -- COMMENT ON POLICY exige ownership literal (no basta con grants), por
    -- eso es la sentencia que disparaba 42501 cuando el role switch no
    -- aplicaba al scope principal.
    EXECUTE $sql$
        COMMENT ON POLICY "identity_docs_owner_read" ON storage.objects IS
            'El parent que subio el doc lo puede leer (path ownership).'
    $sql$;
    EXECUTE $sql$
        COMMENT ON POLICY "identity_docs_staff_read" ON storage.objects IS
            'Staff con role privilegiado puede leer cualquier doc para descargas masivas. Restringir por escuela es follow-up.'
    $sql$;
END $$;


-- 3. Verificacion: la migracion no es util si las policies no existen.
--    Si el DO de arriba salio por falta de privilegios, fallamos aqui con
--    instrucciones claras para que el operador no la marque como exitosa.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename  = 'objects'
          AND policyname = 'identity_docs_owner_read'
    ) THEN
        RAISE EXCEPTION USING
            MESSAGE = 'identity_docs_owner_read no existe en storage.objects.',
            HINT    = 'Esta migracion necesita privilegios sobre storage.objects que el rol actual no tiene. Ejecuta el contenido de este archivo desde el SQL Editor del Dashboard de Supabase (Project > SQL Editor > New query). Ahi corre como supabase_admin con los permisos necesarios.';
    END IF;
END $$;


-- 4. Refresh schema cache.
NOTIFY pgrst, 'reload config';
