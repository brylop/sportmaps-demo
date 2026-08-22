-- =============================================================================
-- 20260820125510_school_signup_leads_revoke_public_execute.sql
-- Autor: brylop   Fecha: 2026-08-20   Versión anterior: 20260820124659
-- Objetivo: cerrar un hueco real detectado al probar 20260820124659 contra la
--   base viva — no un hallazgo teórico.
-- =============================================================================
-- HALLAZGO (probado en la base viva, no en el repo)
--
-- 20260820124659 hizo `REVOKE ALL ON FUNCTION list_school_leads(...) FROM anon`
-- y lo mismo para `update_school_lead_status`. Se probó con
-- `has_function_privilege('anon', 'public.list_school_leads(uuid,text)',
-- 'EXECUTE')` y devolvió TRUE — `anon` seguía pudiendo listar prospectos de
-- CUALQUIER escuela sin sesión.
--
-- Causa: `CREATE FUNCTION` en Postgres otorga EXECUTE a PUBLIC por defecto.
-- Revocar solo de `anon` no toca ese grant a PUBLIC, y `anon` lo hereda de ahí
-- igual. Es el mismo mecanismo que ya cerró 20260513000003
-- (linter_fase3a_revoke_helpers): "REVOKE ALL … FROM PUBLIC no alcanza" corre
-- al revés también — revocar solo del rol nombrado tampoco alcanza si PUBLIC
-- sigue con el grant.
--
-- Confirmado en producción con el owner real de DYNASTY VOLLEY CLUB
-- (school_id 2d509571-3238-4c04-ac3f-6dfe20539226): simulando `SET ROLE anon`
-- sin sesión, `list_school_leads` devolvía la fila de prueba igual. Después de
-- este fix, `has_function_privilege('anon', ..., 'EXECUTE')` es FALSE.
--
-- submit_school_lead y get_school_lead_landing_public NO se tocan: esas SÍ
-- deben ser anon a propósito (por eso llevan `GRANT ... TO anon` explícito).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.list_school_leads(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.list_school_leads(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_school_lead_status(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.update_school_lead_status(uuid, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload config';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación después de aplicar
-- ────────────────────────────────────────────────────────────────────────────
-- SELECT has_function_privilege('anon', 'public.list_school_leads(uuid,text)', 'EXECUTE');           -- false
-- SELECT has_function_privilege('anon', 'public.update_school_lead_status(uuid,text)', 'EXECUTE');    -- false
-- SELECT has_function_privilege('authenticated', 'public.list_school_leads(uuid,text)', 'EXECUTE');   -- true
