-- ============================================================================
-- 20260812174317_revoke_public_en_find_athletes_by_document.sql
-- Fecha: 2026-08-12
--
-- Seguimiento de 20260812172252 (SEG-14). Esa migracion enmascaro la respuesta
-- para `anon`, pero al verificar los permisos aparecio que la funcion tambien
-- tenia EXECUTE para PUBLIC:
--
--   find_athletes_by_document -> =X/postgres            <- PUBLIC
--                                postgres=X, anon=X, authenticated=X, service_role=X
--   mask_person_name          -> postgres=X, anon=X, authenticated=X, service_role=X
--
-- La entrada `=X/postgres`, sin nada antes del `=`, es PUBLIC. Postgres concede
-- EXECUTE a PUBLIC POR DEFECTO en toda funcion nueva; en `mask_person_name` no
-- aparece porque ahi si se hizo `REVOKE ALL FROM PUBLIC`, y en
-- `find_athletes_by_document` se omitio.
--
-- IMPACTO HOY: ninguno. `anon` y `authenticated` ya tienen el permiso explicito,
-- asi que ningun flujo cambia. Lo que se corrige es que el permiso deje de ser
-- implicito: con PUBLIC, cualquier rol que se cree despues lo hereda sin que
-- nadie lo decida.
--
-- Las migraciones son inmutables, asi que esto va en archivo nuevo con timestamp
-- posterior en vez de editar 20260812172252.
--
-- Nota de convencion: `SECURITY DEFINER` NO exime al caller de tener EXECUTE, y
-- por eso los GRANT explicitos se re-declaran aca despues del REVOKE.
-- ============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.find_athletes_by_document(text, uuid) FROM PUBLIC;

-- Se re-declaran los que si deben tenerlo. `anon` sigue incluido a proposito:
-- /join-team es publica y pide el documento antes del signUp (ver 20260812172252).
-- Con sesion devuelve el detalle; sin sesion, la version enmascarada.
GRANT EXECUTE ON FUNCTION public.find_athletes_by_document(text, uuid) TO anon, authenticated, service_role;

COMMIT;


-- ── Verificacion (correr despues) ───────────────────────────────────────────
-- ESPERADO: ya NO debe aparecer la linea `=X/postgres` en `permisos`. Las dos
-- funciones deben listar solo postgres / anon / authenticated / service_role.
--
-- SELECT p.proname AS funcion,
--        array_to_string(p.proacl, E'\n') AS permisos
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('find_athletes_by_document', 'mask_person_name')
--  ORDER BY p.proname;
