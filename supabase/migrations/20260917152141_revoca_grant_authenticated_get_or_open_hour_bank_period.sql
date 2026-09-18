-- =============================================================================
-- 20260917152141_revoca_grant_authenticated_get_or_open_hour_bank_period.sql
-- Autor: judegor99   Fecha: 2026-09-17   Versión anterior: 20260915185925
-- Objetivo: cerrar dos GRANTs de EXECUTE indebidos sobre RPCs de banco de horas,
-- encontrados verificando la base viva (luebjarufsiadojhvxgi) contra las policies
-- documentadas, no contra el repo (docs/migrations-workflow.md: "el ledger no
-- dice qué está aplicado en Supabase").
--
-- 1) get_or_open_hour_bank_period(uuid) — 20260827174032_hour_bank_rpc_auth_y_
--    autocierre_fix.sql había revocado EXECUTE de `authenticated` a propósito
--    (la función no valida auth.uid() contra el dueño del enrollment; recibe
--    cualquier enrollment_id y abre/lee su hour_bank_period). El CREATE OR
--    REPLACE de 20260915121329_corrige_hours_plan_enabled_academia_superior.sql
--    reusó el cuerpo de la migración original (20260821131412) para no cambiar
--    comportamiento, pero ese cuerpo traía consigo el GRANT viejo a
--    `authenticated`, y GRANT es aditivo: no pisa privilegios existentes. Con
--    esto, cualquier usuario autenticado de cualquier escuela podía abrir o leer
--    el hour_bank_period de un enrollment ajeno.
--
-- 2) auto_close_stale_hour_bank_visits() — verificado en vivo con `anon` Y
--    `authenticated` en el ACL de EXECUTE, aunque 20260827174032 ya la había
--    restringido a service_role. Causa raíz: 20260905124655_hour_bank_close_
--    after_exit_grace.sql la recreó (CREATE OR REPLACE) y solo agregó
--    `GRANT ... TO service_role`, sin el REVOKE previo — los default privileges
--    del esquema (el mismo patrón de SEG-23, ver docs/gotchas-tecnicos.md)
--    vuelven a otorgar EXECUTE a anon/authenticated en cada función nueva o
--    reemplazada. Esta función no recibe parámetros y recorre TODAS las
--    visitas abiertas de TODAS las escuelas — con `anon` en el ACL, cualquier
--    visitante sin sesión podía dispararla a voluntad y forzar cierres
--    prematuros / descuentos de banco de horas en producción.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · REVOKE ALL FROM PUBLIC no alcanza: hay que revocar explícito de
--     anon/authenticated, porque los default privileges del esquema vuelven a
--     otorgar EXECUTE en cada CREATE/CREATE OR REPLACE.
-- =============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_or_open_hour_bank_period(uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_open_hour_bank_period(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.auto_close_stale_hour_bank_visits()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_close_stale_hour_bank_visits() TO service_role;

COMMIT;
