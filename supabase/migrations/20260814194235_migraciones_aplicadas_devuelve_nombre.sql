-- =============================================================================
-- 20260814194235_migraciones_aplicadas_devuelve_nombre.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814194111
-- Objetivo: que el detector de migraciones pendientes no dé falsos positivos.
--
-- ── Qué se descubrió al probarlo ────────────────────────────────────────────
-- La versión de 20260814194111 devolvía solo `version`, y comparar por versión
-- NO funciona: cuando una migración se aplica con una herramienta (el MCP de
-- Supabase, el dashboard), la base le asigna SU PROPIO timestamp, distinto al
-- del nombre del archivo. Ejemplo real de hoy:
--
--   archivo  20260814193412_guardar_fondo_del_icono_pwa.sql
--   base     20260814193503  guardar_fondo_del_icono_pwa
--
-- Con la comparación por versión, todas las migraciones aplicadas así aparecían
-- como pendientes. Un detector que grita de más es peor que no tenerlo: la
-- gente aprende a ignorarlo y el día que avisa de verdad no lo mira nadie.
--
-- El `name` sí coincide con el slug del archivo, así que esa es la comparación
-- confiable. Se devuelven ambas columnas y el script cruza por nombre.
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

-- Cambia el tipo de retorno, así que hay que soltarla antes de recrearla.
DROP FUNCTION IF EXISTS public.migraciones_aplicadas();

CREATE OR REPLACE FUNCTION public.migraciones_aplicadas()
RETURNS TABLE (version text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT m.version::text, m.name::text
      FROM supabase_migrations.schema_migrations m
     ORDER BY m.version;
$$;

COMMENT ON FUNCTION public.migraciones_aplicadas() IS
    'Migraciones aplicadas en esta base (version y nombre). El cruce confiable '
    'es por NOMBRE: al aplicar con una herramienta la base asigna su propio '
    'timestamp y la version deja de coincidir con la del archivo. La usa '
    'scripts/migraciones-pendientes.mjs.';

REVOKE ALL ON FUNCTION public.migraciones_aplicadas() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.migraciones_aplicadas() FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.migraciones_aplicadas() TO service_role;

COMMIT;
