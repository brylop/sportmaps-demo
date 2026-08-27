-- =============================================================================
-- 20260827170031_unregistered_athletes_documents_admin_upload.sql
-- Autor: brylop   Fecha: 2026-08-27   Versión anterior: 20260826112433
-- Objetivo: habilitar la carga de documentos de unregistered_athletes desde el
--   front (SchoolStudentsManagementPage.tsx), para escuelas que sigan afiliando
--   atletas después del import puntual de Monster Volley (docs/specs no
--   requerido — feature nueva, no migración de datos).
--
--   La tabla athlete_documents ya permite el INSERT/DELETE por admin
--   (policy "school_staff_manage_athlete_documents", migración
--   20260825125806). Lo que faltaba era storage.objects: las policies
--   existentes de INSERT/DELETE en identity-documents solo cubren
--   children/{auth.uid()}/docs/... (ownership del propio padre) — el path
--   unregistered_athletes/{athleteId}/... no matchea nada, así que cualquier
--   subida real fallaría con "new row violates row-level security policy".
--   Mismo problema en avatars para la foto de perfil (athlete_photo también
--   se sube ahí, ver 02c_subir_avatar.mjs).
--
--   Se agregan como policies NUEVAS (permisivas, se suman con OR a las
--   existentes) — no se toca ni se dropea nada de lo que ya funciona para
--   children/. avatars usa upsert:true (mismo patrón que
--   20260825125349 encontró para perfiles): además del INSERT hace falta
--   UPDATE para que Postgres resuelva el ON CONFLICT; el SELECT ya está
--   cubierto por "avatars_public_read" (bucket público).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- identity-documents: los 6 documentos "de archivo" (no la foto de perfil).
-- Path: unregistered_athletes/{athleteId}/docs/{tipo}-{timestamp}-{nombre}.{ext}
DROP POLICY IF EXISTS "identity_docs_unregistered_admin_insert" ON storage.objects;
CREATE POLICY "identity_docs_unregistered_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = 'unregistered_athletes'
    AND EXISTS (
        SELECT 1 FROM public.unregistered_athletes ua
        WHERE ua.id::text = (storage.foldername(name))[2]
          AND (public.is_school_admin(ua.school_id) OR public.is_super_admin())
    )
);

DROP POLICY IF EXISTS "identity_docs_unregistered_admin_delete" ON storage.objects;
CREATE POLICY "identity_docs_unregistered_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = 'unregistered_athletes'
    AND EXISTS (
        SELECT 1 FROM public.unregistered_athletes ua
        WHERE ua.id::text = (storage.foldername(name))[2]
          AND (public.is_school_admin(ua.school_id) OR public.is_super_admin())
    )
);

-- avatars: solo la foto de perfil (athlete_photo). Path:
-- unregistered_athletes/{athleteId}/{timestamp}.{ext} — mismo prefijo de
-- carpeta que identity-documents, así que el mismo EXISTS aplica igual.
DROP POLICY IF EXISTS "avatars_unregistered_admin_insert" ON storage.objects;
CREATE POLICY "avatars_unregistered_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'unregistered_athletes'
    AND EXISTS (
        SELECT 1 FROM public.unregistered_athletes ua
        WHERE ua.id::text = (storage.foldername(name))[2]
          AND (public.is_school_admin(ua.school_id) OR public.is_super_admin())
    )
);

DROP POLICY IF EXISTS "avatars_unregistered_admin_update" ON storage.objects;
CREATE POLICY "avatars_unregistered_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'unregistered_athletes'
    AND EXISTS (
        SELECT 1 FROM public.unregistered_athletes ua
        WHERE ua.id::text = (storage.foldername(name))[2]
          AND (public.is_school_admin(ua.school_id) OR public.is_super_admin())
    )
);

NOTIFY pgrst, 'reload config';

COMMIT;
