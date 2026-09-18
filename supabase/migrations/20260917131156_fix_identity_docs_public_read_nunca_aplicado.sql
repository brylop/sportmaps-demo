-- =============================================================================
-- 20260917131156_fix_identity_docs_public_read_nunca_aplicado.sql
-- Autor: brylop   Fecha: 2026-09-17   Versión anterior: 20260917123008
-- Objetivo: cerrar de verdad el hueco que 20260511000006 creía haber cerrado.
--
-- HALLAZGO (2026-09-17), mientras se depuraba por qué la migración de storage
-- de la fase 1 de alta-atleta-por-foto-hoja-matricula.md no podía aplicar sus
-- policies:
--
--   `identity_docs_public_read` (FOR SELECT TO public USING (bucket_id =
--   'identity-documents')) SEGUÍA VIVA en la base — 20260511000006 la debía
--   reemplazar por identity_docs_owner_read + identity_docs_staff_read, pero
--   las tres sentencias (el DROP de la abierta y los dos CREATE de reemplazo)
--   vivían dentro de un `DO $$ ... SET LOCAL ROLE supabase_storage_admin ...`
--   que se saltaba con un RAISE WARNING silencioso porque NINGÚN rol
--   disponible (ni siquiera `postgres`) tiene membresía en
--   supabase_storage_admin en este proyecto. Verificado:
--   `pg_has_role('postgres','supabase_storage_admin','MEMBER')` = false.
--
--   Consecuencia medida: `anon` tiene GRANT SELECT sobre storage.objects
--   (el default de Supabase) y la policy `roles={public}` no filtra por rol
--   — cualquiera sin autenticar podía leer cédulas de menores, cédulas de
--   acudientes y certificados de EPS del bucket identity-documents. Vigente
--   desde el 2026-05-11 (cuando se creyó cerrado) hasta hoy.
--
--   Solo `UPDATE storage.buckets SET public = false` de esa misma migración
--   sí se aplicó (esa sentencia no vivía dentro del DO bloqueado), lo cual
--   explica por qué nadie lo notó: la URL pública corta ya no funcionaba, y
--   eso se leyó como "ya está privado", sin verificar la policy misma.
--
-- FIX (aplicado en caliente el 2026-09-17 vía SQL Editor del Dashboard,
-- porque resultó que ALTER/DROP/CREATE POLICY sobre storage.objects SÍ
-- funciona con el rol `postgres` de este proyecto sin necesitar
-- supabase_storage_admin — el DO bloqueado de 20260511000006 nunca hacía
-- falta). Esta migración formaliza ese fix para que quede en el ledger y se
-- reproduzca en cualquier ambiente nuevo.
--
-- IMPORTANTE: al no necesitar el DO de escalada, esta migración SÍ se puede
-- aplicar por el camino normal (CLI / apply_migration).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "identity_docs_public_read" ON storage.objects;
DROP POLICY IF EXISTS "Public Document Read"      ON storage.objects;

DROP POLICY IF EXISTS "identity_docs_owner_read" ON storage.objects;
CREATE POLICY "identity_docs_owner_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "identity_docs_staff_read" ON storage.objects;
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
);

COMMENT ON POLICY "identity_docs_owner_read" ON storage.objects IS
    'El parent que subió el doc lo puede leer (path ownership). Recreada 2026-09-17 — la de 20260511000006 nunca se había aplicado.';
COMMENT ON POLICY "identity_docs_staff_read" ON storage.objects IS
    'Staff con role privilegiado puede leer cualquier doc para procesos administrativos. Recreada 2026-09-17, mismo motivo. TODO heredado de 20260511000006: no restringe por escuela.';

-- Verificación dura: si la abierta sigue viva, esta migración no cumplió su
-- propósito.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'identity_docs_public_read'
    ) THEN
        RAISE EXCEPTION 'identity_docs_public_read sigue existiendo — el hueco no se cerró.';
    END IF;
END $$;

NOTIFY pgrst, 'reload config';

COMMIT;
