-- =============================================================================
-- 20260814194111_rpc_listar_migraciones_aplicadas.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814193412
-- Objetivo: poder responder "¿esta migración ya está corriendo en producción?"
--           desde una herramienta, sin abrir el SQL editor.
--
-- ── Por qué hace falta ──────────────────────────────────────────────────────
-- El despliegue de migraciones es MANUAL, y eso ya costó caro: el 2026-08-13 se
-- commiteó `20260813133108_cerrar_fuga_de_payment_links_a_anon.sql`, que cerraba
-- una fuga con 93 tokens de pago expuestos a internet. Nunca se aplicó. Al día
-- siguiente la fuga seguía viva y apareció de casualidad, auditando otra cosa.
--
-- El commit existía, el fix estaba revisado, y no servía de nada.
--
-- `migrations:check` compara el repo contra el ledger y `migrations:drift` busca
-- objetos que la base tiene y el repo no crea. Ninguno responde la pregunta que
-- importa DESPUÉS de escribir un fix.
--
-- ── Por qué una RPC y no leer la tabla ──────────────────────────────────────
-- `supabase_migrations.schema_migrations` no está expuesta por PostgREST: solo
-- se admiten los esquemas `public` y `graphql_public`. Sin conexión directa a
-- Postgres —y no hay cadena en el .env— la única vía desde un script es una
-- función en `public`.
--
-- Devuelve únicamente la columna `version`: números de 14 dígitos, sin el SQL ni
-- los nombres. No hay nada sensible, pero igual queda restringida a
-- service_role — es información de infraestructura y no le sirve a nadie más.
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

CREATE OR REPLACE FUNCTION public.migraciones_aplicadas()
RETURNS TABLE (version text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT m.version::text
      FROM supabase_migrations.schema_migrations m
     ORDER BY m.version;
$$;

COMMENT ON FUNCTION public.migraciones_aplicadas() IS
    'Versiones de migracion aplicadas en esta base. Existe porque '
    'supabase_migrations no esta expuesta por PostgREST y el despliegue es '
    'manual: sin esto no hay forma de saber desde una herramienta si una '
    'migracion commiteada esta realmente corriendo. La usa '
    'scripts/migraciones-pendientes.mjs.';

REVOKE ALL ON FUNCTION public.migraciones_aplicadas() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.migraciones_aplicadas() FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.migraciones_aplicadas() TO service_role;

COMMIT;
