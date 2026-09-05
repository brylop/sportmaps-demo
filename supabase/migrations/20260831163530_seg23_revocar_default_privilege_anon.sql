-- =============================================================================
-- 20260831163530_seg23_revocar_default_privilege_anon.sql
-- Autor: judegor99   Fecha: 2026-08-31   Versión anterior: 20260831162124
-- Objetivo: SEG-23 (docs/ROADMAP.md) — fix de raíz, no por-tabla.
--
-- Causa raíz confirmada en pg_default_acl (schema public, obj_type='r'):
--   ALTER DEFAULT PRIVILEGES otorgado por el rol `postgres` da
--   SELECT/INSERT/UPDATE/DELETE a `anon` en TODA tabla nueva creada por ese
--   rol -- independiente del GRANT explícito de cada migración. Ya mordió dos
--   migraciones que declaraban explícitamente "sin GRANT a anon"
--   (20260812182000_futbol_metricas_alineacion.sql y
--   20260831160936_mesociclo_carmel.sql, esta última recién parcheada
--   por-tabla en 20260831162124).
--
-- Qué hace: revoca el DEFAULT PRIVILEGE de `anon` sobre tablas futuras del
-- rol `postgres` en `public`. NO es retroactivo -- ALTER DEFAULT PRIVILEGES
-- solo cambia qué privilegios se otorgan a objetos creados DESPUÉS de este
-- comando. Cero impacto sobre las tablas que ya existen: sus GRANT
-- individuales (los que trae cada migración) no se tocan.
--
-- Deliberadamente NO se toca el default de `authenticated`: todas las
-- migraciones ya lo otorgan explícitamente cuando corresponde, así que
-- quitarlo del default no cambia nada hoy y agregaría un riesgo sin
-- beneficio (una tabla nueva que lo necesite y a la que alguien olvide
-- otorgárselo explícito quedaría inaccesible incluso para RLS).
--
-- Efecto esperado hacia adelante: toda tabla nueva nace sin acceso de `anon`
-- salvo que la migración que la crea lo otorgue a propósito -- opt-in en vez
-- de opt-out, que es el sentido correcto para un rol sin sesión.
-- =============================================================================

BEGIN;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon;

COMMIT;
