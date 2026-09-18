-- =============================================================================
-- 20260917131343_enrollment_intake_storage_policies_v2.sql
-- Autor: brylop   Fecha: 2026-09-17   Versión anterior: 20260917131156
-- Objetivo: reintenta lo que 20260917123008 no pudo aplicar. Esa migración
--   envolvía las policies en un `DO $$ ... SET LOCAL ROLE
--   supabase_storage_admin ... $$`, copiando el patrón de 20260511000006 bajo
--   el supuesto de que hacía falta esa membresía. No hacía falta: verificado
--   el 2026-09-17 (ver 20260917131156_fix_identity_docs_public_read_nunca_aplicado.sql)
--   que `postgres` puede hacer DROP/CREATE POLICY sobre storage.objects
--   directamente en este proyecto — ningún rol tiene esa membresía y por eso
--   ese bloque se saltaba siempre con un RAISE WARNING silencioso.
--
--   20260917123008 queda tal como está (inmutable, ya commiteada); esta
--   migración aplica el mismo contenido sin la escalada innecesaria.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- Reusa el bucket identity-documents (ya privado desde 20260511000006), con
-- el mismo patrón de policies por path que 20260827170031 usa para
-- unregistered_athletes: el primer segmento del path identifica el tipo de
-- recurso, el segundo el id, y is_school_admin() decide si el staff puede
-- tocarlo. Path esperado: enrollment_intake/{intake_id}/hoja.{ext}

DROP POLICY IF EXISTS "identity_docs_enrollment_intake_insert" ON storage.objects;
CREATE POLICY "identity_docs_enrollment_intake_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = 'enrollment_intake'
    AND EXISTS (
        SELECT 1 FROM public.enrollment_form_intake efi
        WHERE efi.id::text = (storage.foldername(name))[2]
          AND public.is_school_admin(efi.school_id)
    )
);

DROP POLICY IF EXISTS "identity_docs_enrollment_intake_select" ON storage.objects;
CREATE POLICY "identity_docs_enrollment_intake_select"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = 'enrollment_intake'
    AND EXISTS (
        SELECT 1 FROM public.enrollment_form_intake efi
        WHERE efi.id::text = (storage.foldername(name))[2]
          AND public.is_school_admin(efi.school_id)
    )
);

DROP POLICY IF EXISTS "identity_docs_enrollment_intake_delete" ON storage.objects;
CREATE POLICY "identity_docs_enrollment_intake_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = 'enrollment_intake'
    AND EXISTS (
        SELECT 1 FROM public.enrollment_form_intake efi
        WHERE efi.id::text = (storage.foldername(name))[2]
          AND public.is_school_admin(efi.school_id)
    )
);

COMMENT ON POLICY "identity_docs_enrollment_intake_insert" ON storage.objects IS
    'Solo admin/school_admin/owner de la escuela dueña del intake puede subir la foto de la hoja de matrícula.';
COMMENT ON POLICY "identity_docs_enrollment_intake_select" ON storage.objects IS
    'El inbox de revisión (fase 4) muestra la foto solo a admins de esa escuela.';
COMMENT ON POLICY "identity_docs_enrollment_intake_delete" ON storage.objects IS
    'Descarte manual desde el inbox; el borrado por retención (7 días en rejected/failed) lo hace un job con service_role.';

NOTIFY pgrst, 'reload config';

COMMIT;
