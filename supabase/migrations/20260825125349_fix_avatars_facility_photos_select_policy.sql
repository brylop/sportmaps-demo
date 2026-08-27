-- =============================================================================
-- 20260825125349_fix_avatars_facility_photos_select_policy.sql
-- Autor: brylop   Fecha: 2026-08-25   Versión anterior: 20260825124513
-- Objetivo: subir una foto con upsert:true (avatar de perfil, foto de
--   instalación) siempre fallaba con "new row violates row-level security
--   policy", para cualquier usuario, en cualquier momento.
--
--   Causa: los buckets `avatars` y `facility-photos` no tenían NINGUNA
--   policy de SELECT sobre storage.objects. useStorage.ts sube TODO con
--   upsert:true, que Storage resuelve como INSERT ... ON CONFLICT DO
--   UPDATE. Postgres exige permiso de SELECT sobre la fila para poder
--   resolver el conflicto en un INSERT ON CONFLICT — sin ninguna policy de
--   SELECT que aplique, el INSERT entero se rechaza como violación de RLS,
--   sin importar si el archivo ya existía. school-assets nunca tuvo este
--   problema porque sí tiene `school_assets_public_read`.
--
--   Fix: agregar SELECT público para ambos buckets (ya son buckets
--   públicos a nivel de storage.buckets — la URL pública ya servía estos
--   objetos sin pasar por RLS; esto solo destraba el chequeo interno del
--   upsert, no expone nada nuevo).
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

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "facility_photos_public_read" ON storage.objects;
CREATE POLICY "facility_photos_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'facility-photos');

COMMIT;
