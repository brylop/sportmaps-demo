-- =============================================================================
-- 20260922223853_identity_docs_staff_read_scoped_por_escuela.sql
-- Autor: judegor99   Fecha: 2026-09-22   Versión anterior: 20260922164841
-- Objetivo: cerrar el TODO que 20260917131156 dejó explícito — la lectura de
-- identity-documents por rol de staff no filtraba por escuela.
--
-- HALLAZGO (auditoría 2026-09-22, ver docs/auditoria-seguridad-2026-08-14.md,
-- Adenda 2026-09-22): `identity_docs_staff_read` es
--
--   USING (bucket_id='identity-documents' AND EXISTS (
--     SELECT 1 FROM profiles p WHERE p.id=auth.uid()
--       AND p.role IN ('owner','admin','super_admin','school_admin','school',
--                       'coach','staff','organizer')))
--
-- Sin ninguna referencia a school_id: cualquier cuenta con uno de esos roles
-- —en CUALQUIER escuela— lee la cédula y el certificado EPS de los menores de
-- TODAS las demás. Verificado en vivo contra pg_policies.
--
-- FIX: reemplazarla por dos policies, una por prefijo de path real en el
-- bucket (verificado con `select (storage.foldername(name))[1], count(*)
-- from storage.objects where bucket_id='identity-documents' group by 1` —
-- solo existen 'unregistered_athletes' y 'children', nunca 'enrollment_intake'
-- todavía aunque ya tiene sus propias policies desde 20260917131343),
-- acotadas por escuela con is_school_admin() — el mismo scope que ya usan
-- las policies hermanas de INSERT/DELETE para unregistered_athletes
-- (20260827170031), así que esto no reduce el acceso de quien ya podía subir
-- o borrar estos documentos, solo cierra la lectura cross-tenant.
--
-- unregistered_athletes/{athlete_id}/docs/{file}  (foldername: 3 niveles,
--   confirmado 886/886 filas en ese formato) → join directo por athlete_id.
--
-- children/{parent_id}/{child_id}/docs/{file}  (foldername: 4 niveles,
--   27/59 filas) → join por child_id, el caso preciso.
-- children/{parent_id}/docs/{file}  (foldername: 3 niveles, formato legado,
--   32/59 filas, sin child_id en el path) → join por parent_id. Nota: si un
--   mismo padre tiene hijos en más de una escuela, un admin de cualquiera de
--   esas escuelas ve TODA la carpeta del padre bajo este formato legado — es
--   una limitación estructural del path, no algo que esta migración pueda
--   resolver sin mover archivos; el formato nuevo (4 niveles) ya no tiene
--   este problema.
--
-- Deliberadamente usa is_school_admin() (owner/admin/school_admin), NO la
-- lista de 8 roles original: coach/staff/organizer no necesitan leer cédulas
-- de menores para su trabajo diario, y es el mismo scope que ya rige el
-- INSERT/DELETE de estos documentos. Si un flujo real de coach lo necesita,
-- se agrega a propósito, no por herencia de una policy que nunca se pensó
-- así.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "identity_docs_staff_read" ON storage.objects;

CREATE POLICY "identity_docs_unregistered_staff_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = 'unregistered_athletes'
    AND EXISTS (
        SELECT 1 FROM public.unregistered_athletes ua
        WHERE ua.id = ((storage.foldername(name))[2])::uuid
          AND (is_school_admin(ua.school_id) OR is_super_admin())
    )
);

CREATE POLICY "identity_docs_children_staff_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = 'children'
    AND (
        -- children/{parent_id}/{child_id}/docs/{file} — caso preciso.
        (
            array_length(storage.foldername(name), 1) >= 4
            AND EXISTS (
                SELECT 1 FROM public.children c
                WHERE c.id = ((storage.foldername(name))[3])::uuid
                  AND (is_school_admin(c.school_id) OR is_super_admin())
            )
        )
        OR
        -- children/{parent_id}/docs/{file} — formato legado, sin child_id.
        (
            array_length(storage.foldername(name), 1) = 3
            AND EXISTS (
                SELECT 1 FROM public.children c
                WHERE c.parent_id = ((storage.foldername(name))[2])::uuid
                  AND (is_school_admin(c.school_id) OR is_super_admin())
            )
        )
    )
);

COMMENT ON POLICY "identity_docs_unregistered_staff_read" ON storage.objects IS
    'Staff (owner/admin/school_admin de ESA escuela, o super_admin) lee documentos de atletas sin registrar de su propia escuela. Reemplaza a identity_docs_staff_read (2026-09-22), que no acotaba por escuela.';
COMMENT ON POLICY "identity_docs_children_staff_read" ON storage.objects IS
    'Staff (owner/admin/school_admin de ESA escuela, o super_admin) lee documentos de hijos matriculados en su propia escuela. Reemplaza a identity_docs_staff_read (2026-09-22). Limitación conocida en el formato legado de 3 niveles: acota por padre, no por hijo individual — ver comentario de cabecera.';

-- Verificación dura: si la policy sin acotar sigue viva, esta migración no
-- cumplió su propósito (mismo patrón que 20260917131156).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'identity_docs_staff_read'
    ) THEN
        RAISE EXCEPTION 'identity_docs_staff_read sigue existiendo — la lectura cross-tenant no se cerró.';
    END IF;
END $$;

NOTIFY pgrst, 'reload config';

COMMIT;
