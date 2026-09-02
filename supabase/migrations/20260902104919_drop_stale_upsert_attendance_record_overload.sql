-- =============================================================================
-- 20260902104919_drop_stale_upsert_attendance_record_overload.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902104747
-- Objetivo: la migración anterior (20260902104747) hizo CREATE OR REPLACE de
-- `upsert_attendance_record` agregando `p_check_in_method` — pero al cambiar
-- la firma, Postgres NO reemplazó la función vieja: creó un OVERLOAD nuevo y
-- dejó la de 9 parámetros viva al lado. Verificado en la base: la vieja
-- (oid 157210) TODAVÍA tiene EXECUTE para PUBLIC/anon/authenticated — el
-- REVOKE de la migración anterior, escrito con la firma de 10 parámetros,
-- nunca la tocó. El agujero de seguridad seguía abierto.
--
-- Un RPC llamado con los 9 parámetros de siempre (como sigue haciendo
-- `POST /session` y `/walk-in` hoy) resuelve a la firma vieja por default
-- overload resolution — así que tampoco heredaba `check_in_method`.
--
-- Fix: DROP explícito del overload viejo. Con el nuevo default
-- (`p_check_in_method text DEFAULT 'manual'`), cualquier caller que siga
-- mandando solo 9 parámetros resuelve igual, ahora contra la única función
-- que queda — sin cambiar su comportamiento observado.
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

DROP FUNCTION IF EXISTS public.upsert_attendance_record(
    uuid, uuid, date, text, uuid, uuid, uuid, uuid, uuid
);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
-- Debe quedar UNA sola fila (la de 10 parámetros), y grants = solo service_role.
SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS sig, p.proacl
  FROM pg_proc p
 WHERE p.proname = 'upsert_attendance_record' AND p.pronamespace = 'public'::regnamespace;
