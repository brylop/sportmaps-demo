-- =============================================================================
-- 20260831162124_mesociclo_carmel_revocar_anon.sql
-- Autor: judegor99   Fecha: 2026-08-31   Versión anterior: 20260831160936
-- Objetivo: cerrar el GRANT a `anon` en las 4 tablas de
--   20260831160936_mesociclo_carmel.sql que esa misma migración NO pidió.
--
-- Verificado contra la base viva (luebjarufsiadojhvxgi) inmediatamente después
-- de aplicar 20260831160936: information_schema.table_privileges mostró
-- SELECT/INSERT/UPDATE/DELETE para `anon` en las 4 tablas nuevas, a pesar de
-- que esa migración solo otorgó a authenticated/service_role.
--
-- Causa raíz identificada (pg_default_acl, schema public, obj_type='r'):
--   ALTER DEFAULT PRIVILEGES otorgado por el rol `postgres` da
--   SELECT/INSERT/UPDATE/DELETE a anon (y a authenticated) en TODA tabla nueva
--   creada por ese rol en public — independiente del GRANT explícito de la
--   migración. Mismo mecanismo que ya documentaba (para funciones/EXECUTE)
--   20260731154626_regularize_performance_schema.sql NOTA 1, y el mismo que
--   dejó el mismo drift en match_lineups/match_lineup_players/
--   football_match_events (20260812182000_futbol_metricas_alineacion.sql, que
--   también declaraba "sin GRANT a anon" y también quedó con el mismo grant no
--   pedido — confirmado con la misma consulta). Esta migración cierra SOLO el
--   radio de la propia 20260831160936; el default privilege de origen (que
--   sigue afectando cualquier tabla futura creada por `postgres`) queda fuera
--   de alcance a propósito — es un cambio de blast radius mucho mayor y no es
--   parte de lo que el usuario pidió esta sesión. Reportado aparte.
--
-- RLS ya bloqueaba el acceso real (verificado con `SET LOCAL role anon`:
-- 0 filas visibles, porque user_staff_school_ids() devuelve array vacío para
-- anon), así que esto es endurecimiento de superficie, no un fix de un hueco
-- explotado — mismo criterio que 20260828224353_endurecer_grants_anon_metricas.sql.
-- =============================================================================

BEGIN;

REVOKE ALL ON public.training_mesocycles            FROM anon;
REVOKE ALL ON public.training_microcycles           FROM anon;
REVOKE ALL ON public.training_microcycle_days        FROM anon;
REVOKE ALL ON public.training_mesocycle_evaluations FROM anon;

COMMIT;
