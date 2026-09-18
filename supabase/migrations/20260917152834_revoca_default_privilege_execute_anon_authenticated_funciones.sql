-- =============================================================================
-- 20260917152834_revoca_default_privilege_execute_anon_authenticated_funciones.sql
-- Autor: judegor99   Fecha: 2026-09-17   Versión anterior: 20260917152141
-- Objetivo: cerrar de raíz, para FUNCIONES, el mismo default privilege que
-- 20260831163530_seg23_revocar_default_privilege_anon.sql ya cerró para TABLAS.
--
-- Verificado en vivo (luebjarufsiadojhvxgi) con:
--   select r.rolname, n.nspname, d.defaclobjtype, aclexplode(d.defaclacl)
--   from pg_default_acl d join pg_roles r on r.oid=d.defaclrole
--   left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclobjtype='f';
--
-- Hay una entrada `defaclrole=postgres, nspname=public, defaclobjtype='f'` que
-- otorga EXECUTE a anon/authenticated/service_role en TODA función nueva creada
-- por `postgres` (el rol con el que corre `apply_migration`) en el esquema
-- public. Esto explica por qué dos RPCs de banco de horas (ver migración
-- 20260917152141) terminaron con `authenticated`/`anon` en su ACL de EXECUTE
-- pese a que sus migraciones de origen sí declaraban el GRANT restringido a
-- service_role: cualquier CREATE FUNCTION o CREATE OR REPLACE FUNCTION nueva
-- vuelve a heredar este default salvo que la migración haga el REVOKE
-- explícito (que casi ninguna hace, porque CLAUDE.md solo pedía el GRANT
-- explícito, no el REVOKE del default).
--
-- 20260831163530 cerró el gemelo de este problema para TABLAS
-- (`ALTER DEFAULT PRIVILEGES ... ON TABLES FROM anon`) pero nunca se hizo el
-- equivalente para FUNCIONES — quedó abierto sin que ninguna nota lo marcara
-- como pendiente explícito. Este fix es el mismo patrón, para el otro tipo de
-- objeto.
--
-- No es retroactivo: no cambia el ACL de funciones ya creadas (para eso hace
-- falta auditar y revocar cada una a mano, como se hizo con las dos de
-- 20260917152141). Solo evita que TODA función nueva de aquí en adelante nazca
-- con anon/authenticated en su ACL de EXECUTE por default.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · REVOKE ALL FROM PUBLIC no alcanza: hay que revocar explícito de
--     anon/authenticated — esta migración es exactamente ese caso, a nivel de
--     default privilege en vez de por función.
-- =============================================================================

BEGIN;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;
