-- =============================================================================
-- 20260917123008_enrollment_intake_storage_policies.sql
-- Autor: brylop   Fecha: 2026-09-17   Versión anterior: 20260917122529
-- Objetivo: policies de storage.objects para las fotos de hojas de matrícula
--   de docs/specs/alta-atleta-por-foto-hoja-matricula.md. Separada de
--   20260917122529 (la tabla) porque storage.objects es propiedad de
--   supabase_storage_admin en Supabase managed reciente, no de postgres —
--   aplicarla en la misma transacción que la tabla hace fallar TODO el
--   migration (el error del bloque de storage revierte también la tabla ya
--   creada). Mismo problema y misma solución que 20260511000006.
--
-- IMPORTANTE — esta migración NO se puede aplicar por el camino normal
-- (CLI / apply_migration / rol postgres del pooler): falla con
-- "must be owner of relation objects" o, si el rol no tiene membresía en
-- supabase_storage_admin, con el RAISE EXCEPTION de verificación al final.
-- Correrla desde el SQL Editor del Dashboard de Supabase (Project > SQL
-- Editor > New query), donde corre como supabase_admin con los privilegios
-- necesarios.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

-- Reusa el bucket identity-documents (ya privado desde 20260511000006), con
-- el mismo patrón de policies por path que 20260827170031 usa para
-- unregistered_athletes: el primer segmento del path identifica el tipo de
-- recurso, el segundo el id, y is_school_admin() decide si el staff puede
-- tocarlo. Path esperado: enrollment_intake/{intake_id}/hoja.{ext}
DO $$
BEGIN
    IF NOT pg_has_role(current_user, 'supabase_storage_admin', 'USAGE') THEN
        RAISE WARNING
            'El rol actual (%) no tiene membresía en supabase_storage_admin. Las policies de storage.objects para enrollment_intake NO se aplicarán aquí — corre esta migración desde el SQL Editor del Dashboard de Supabase.',
            current_user;
        RETURN;
    END IF;

    SET LOCAL ROLE supabase_storage_admin;

    -- INSERT: solo admin/school_admin/owner de la escuela dueña del intake.
    EXECUTE 'DROP POLICY IF EXISTS "identity_docs_enrollment_intake_insert" ON storage.objects';
    EXECUTE $sql$
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
        )
    $sql$;

    -- SELECT: mismo criterio — el inbox de revisión (fase 4) muestra la foto
    -- al lado del formulario.
    EXECUTE 'DROP POLICY IF EXISTS "identity_docs_enrollment_intake_select" ON storage.objects';
    EXECUTE $sql$
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
        )
    $sql$;

    -- DELETE: la retención de §3 del plan (rejected/failed a 7 días) la
    -- ejecuta un job con service_role, que no pasa por RLS de Storage. Esta
    -- policy es para que un admin pueda descartar manualmente si hace falta.
    EXECUTE 'DROP POLICY IF EXISTS "identity_docs_enrollment_intake_delete" ON storage.objects';
    EXECUTE $sql$
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
        )
    $sql$;

    EXECUTE $sql$
        COMMENT ON POLICY "identity_docs_enrollment_intake_insert" ON storage.objects IS
            'Solo admin/school_admin/owner de la escuela dueña del intake puede subir la foto de la hoja de matrícula.'
    $sql$;
    EXECUTE $sql$
        COMMENT ON POLICY "identity_docs_enrollment_intake_select" ON storage.objects IS
            'El inbox de revisión (fase 4) muestra la foto solo a admins de esa escuela.'
    $sql$;
    EXECUTE $sql$
        COMMENT ON POLICY "identity_docs_enrollment_intake_delete" ON storage.objects IS
            'Descarte manual desde el inbox; el borrado por retención (7 días en rejected/failed) lo hace un job con service_role.'
    $sql$;
END $$;

-- Verificación: si el DO de arriba salió por falta de privilegios, esta
-- migración no queda útil sin las policies — fallar aquí con instrucciones
-- claras en vez de marcarla como exitosa a medias.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename  = 'objects'
          AND policyname = 'identity_docs_enrollment_intake_select'
    ) THEN
        RAISE EXCEPTION USING
            MESSAGE = 'identity_docs_enrollment_intake_select no existe en storage.objects.',
            HINT    = 'Esta migración necesita privilegios sobre storage.objects que el rol actual no tiene. Ejecuta el contenido de este archivo desde el SQL Editor del Dashboard de Supabase (Project > SQL Editor > New query), donde corre como supabase_admin.';
    END IF;
END $$;

NOTIFY pgrst, 'reload config';
