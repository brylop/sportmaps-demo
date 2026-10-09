-- =============================================================================
-- 20261008154654_mesociclo_documentos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-08   Versión anterior: 20261008154653
-- Objetivo: documentos adjuntos al mesociclo (spec rediseno-seguimiento-deportivo
--   §F6 y §5). Carmel: "la subida de documentos en mesociclos no se ve" — no
--   existía ni tabla, ni bucket, ni UI. El entrenador sube el plan en Word/PDF,
--   fotos de la pizarra, etc. y el dueño los ve.
--
-- Decisión de producto (§5): SOLO EL STAFF de la escuela. Nada para padres ni
-- atletas. Por eso todas las policies usan user_staff_school_ids() (quien
-- trabaja en la escuela) y NUNCA user_school_ids() (que incluye padres y
-- atletas — invariante I2 y fuga de lectura).
--
-- Supabase Free al ~49 % de archivos → tope duro de 10 MB por archivo en el
-- bucket Y en la tabla; el frontend además comprime las imágenes al subir.
--
-- Path en Storage: {school_id}/{mesocycle_id}/{ts}-{nombre seguro}
--   folder[1] = escuela  → decide quién lee/sube/borra.
--   folder[2] = mesociclo → al subir se exige que sea de ESA escuela.
--
-- Patrón: 20260710000001_accounting_phase1_receipts.sql (tabla puntero +
-- bucket privado + policies de storage.objects por carpeta), pero con una
-- policy por comando (no FOR ALL) y WITH CHECK explícito en los INSERT.
--
-- Nota: al borrar un mesociclo (ON DELETE CASCADE) se van las filas de esta
-- tabla pero NO los objetos del bucket (Storage no se limpia desde SQL). Quedan
-- huérfanos inaccesibles desde la UI; limpieza pendiente (job del BFF).
-- =============================================================================

BEGIN;

-- 1. Tabla puntero ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_mesocycle_documents (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    mesocycle_id  uuid        NOT NULL REFERENCES public.training_mesocycles(id) ON DELETE CASCADE,
    school_id     uuid        NOT NULL,
    storage_path  text        NOT NULL,
    file_name     text        NOT NULL,
    mime_type     text,
    size_bytes    integer     CHECK (size_bytes IS NULL OR (size_bytes >= 0 AND size_bytes <= 10485760)),
    uploaded_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT training_mesocycle_documents_path_unique UNIQUE (storage_path),
    -- El path tiene que caer en la carpeta de su escuela y su mesociclo: así la
    -- fila y el objeto de Storage no pueden apuntar a escuelas distintas.
    CONSTRAINT training_mesocycle_documents_path_folder CHECK (
        storage_path LIKE school_id::text || '/' || mesocycle_id::text || '/%'
    )
);

CREATE INDEX IF NOT EXISTS idx_training_mesocycle_documents_meso
    ON public.training_mesocycle_documents (mesocycle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_mesocycle_documents_school
    ON public.training_mesocycle_documents (school_id);

ALTER TABLE public.training_mesocycle_documents ENABLE ROW LEVEL SECURITY;

-- Sin UPDATE: un documento se sube o se borra, no se edita.
REVOKE ALL ON public.training_mesocycle_documents FROM PUBLIC;
REVOKE ALL ON public.training_mesocycle_documents FROM anon;
REVOKE ALL ON public.training_mesocycle_documents FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.training_mesocycle_documents TO authenticated;

-- 2. Policies de la tabla (una por comando; todas TO authenticated) ----------

-- SELECT: cualquiera que TRABAJE en la escuela (coach, staff, admin, dueño).
-- Padres y atletas no están en user_staff_school_ids() → no ven nada.
DROP POLICY IF EXISTS tmd_select_staff ON public.training_mesocycle_documents;
CREATE POLICY tmd_select_staff ON public.training_mesocycle_documents
    FOR SELECT TO authenticated
    USING (school_id = ANY (public.user_staff_school_ids()));

-- INSERT: staff de la escuela, firmando como sí mismo, y el mesociclo tiene que
-- ser de ESA escuela (si no, un coach de la escuela A podría colgar archivos en
-- un mesociclo de la B poniendo school_id = A). La subconsulta va sobre
-- training_mesocycles (otra tabla → sin self-recursion) y corre con el RLS de
-- esa tabla, que también es staff-only (training_mesocycles_select).
DROP POLICY IF EXISTS tmd_insert_staff ON public.training_mesocycle_documents;
CREATE POLICY tmd_insert_staff ON public.training_mesocycle_documents
    FOR INSERT TO authenticated
    WITH CHECK (
        school_id = ANY (public.user_staff_school_ids())
        AND uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.training_mesocycles m
             WHERE m.id = training_mesocycle_documents.mesocycle_id
               AND m.school_id = training_mesocycle_documents.school_id
        )
    );

-- DELETE: quien lo subió (si sigue siendo staff de la escuela) o la
-- administración de la escuela (user_admin_school_ids: sin coaches).
DROP POLICY IF EXISTS tmd_delete_uploader_or_admin ON public.training_mesocycle_documents;
CREATE POLICY tmd_delete_uploader_or_admin ON public.training_mesocycle_documents
    FOR DELETE TO authenticated
    USING (
        (uploaded_by = auth.uid() AND school_id = ANY (public.user_staff_school_ids()))
        OR school_id = ANY (public.user_admin_school_ids())
    );

-- 3. Bucket privado -----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'mesocycle-documents',
    'mesocycle-documents',
    false,
    10485760,  -- 10 MB (Supabase Free al ~49 %)
    ARRAY[
        'application/pdf',
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   -- .docx
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         -- .xlsx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'  -- .pptx
    ]
)
ON CONFLICT (id) DO UPDATE
   SET public             = EXCLUDED.public,
       file_size_limit    = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Policies en storage.objects (path = {school_id}/{mesocycle_id}/{archivo}) -
-- Espejo de las de la tabla. La carpeta se compara como TEXTO contra
-- user_staff_school_ids()::text[] en vez de castear (storage.foldername(name))[1]
-- a uuid: Postgres no garantiza el orden de evaluación del AND, y un ::uuid
-- sobre una carpeta que no es uuid (de OTRO bucket) haría fallar con 22P02 las
-- consultas de ese otro bucket. Comparar texto con texto nunca lanza error y es
-- equivalente (uuid::text es canónico, en minúsculas, igual que el path que
-- arma el frontend).

DROP POLICY IF EXISTS mesocycle_documents_select ON storage.objects;
CREATE POLICY mesocycle_documents_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'mesocycle-documents'
        AND (storage.foldername(name))[1] = ANY (public.user_staff_school_ids()::text[])
    );

DROP POLICY IF EXISTS mesocycle_documents_insert ON storage.objects;
CREATE POLICY mesocycle_documents_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'mesocycle-documents'
        AND (storage.foldername(name))[1] = ANY (public.user_staff_school_ids()::text[])
        AND EXISTS (
            SELECT 1 FROM public.training_mesocycles m
             WHERE m.id::text        = (storage.foldername(name))[2]
               AND m.school_id::text = (storage.foldername(name))[1]
        )
    );

-- Borra quien lo subió (owner_id del objeto = auth.uid()) mientras siga siendo
-- staff, o la administración de la escuela.
DROP POLICY IF EXISTS mesocycle_documents_delete ON storage.objects;
CREATE POLICY mesocycle_documents_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'mesocycle-documents'
        AND (
            (owner_id = auth.uid()::text
             AND (storage.foldername(name))[1] = ANY (public.user_staff_school_ids()::text[]))
            OR (storage.foldername(name))[1] = ANY (public.user_admin_school_ids()::text[])
        )
    );

-- Sin policy de UPDATE en el bucket: no se sobrescribe un archivo (upsert:false).

COMMIT;

NOTIFY pgrst, 'reload config';

-- Verificación post-aplicación (manual):
--   select cmd, policyname, permissive, roles, qual, with_check
--     from pg_policies where tablename = 'training_mesocycle_documents';
--   select policyname, cmd, qual, with_check from pg_policies
--    where schemaname = 'storage' and policyname like 'mesocycle_documents_%';
--   set local role anon; select count(*) from public.training_mesocycle_documents; -- debe fallar
--   npm run seguridad:invariantes
