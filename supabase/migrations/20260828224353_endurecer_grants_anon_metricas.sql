-- =============================================================================
-- 20260828224353_endurecer_grants_anon_metricas.sql
-- Autor: judegor99   Fecha: 2026-08-28   Versión anterior: 20260827231724
-- Objetivo: cerrar el GRANT ALL a `anon` en las 5 tablas de rendimiento que
--   20260731154626_regularize_performance_schema.sql replicó "sin endosar" de
--   la base compartida (ver su NOTA 1). El privilegio crudo incluía TRUNCATE,
--   que RLS no cubre — hoy no es explotable porque PostgREST no expone
--   TRUNCATE, pero es superficie que nadie quiso dar.
--
-- Verificado contra la base viva antes de aplicar (luebjarufsiadojhvxgi):
--   information_schema.table_privileges confirmó SELECT/INSERT/UPDATE/DELETE
--   para anon en las 5 tablas, sin drift respecto al repo. pg_policies
--   confirmó que solo dos policies alcanzan a anon:
--     · sport_metric_thresholds_select_all: roles {public}, USING(true) →
--       catálogo público a propósito.
--     · "public can register as guest via poll" en unregistered_athletes:
--       roles {public}, FOR INSERT → alta de invitado por poll_token.
--   sport_metric_definitions_select_all está restringida a {authenticated}.
--   performance_entries y competition_results usan user_staff_school_ids()/
--   user_school_ids()/auth.uid(), todos vacíos o NULL para anon.
--
-- Se preservan esas dos excepciones para no cambiar comportamiento, solo
-- cerrar superficie. Nota: el alta real de invitado hoy pasa por el BFF con
-- service_role (bff/src/controllers/polls.controller.ts), no por este grant
-- directo — se preserva igual porque tocar la policy de producto no es parte
-- de este fix de permisos.
--
-- Aplicada en luebjarufsiadojhvxgi vía apply_migration (Supabase MCP) el
-- 2026-08-28. Verificación post-aplicación: information_schema.table_privileges
-- quedó con exactamente los dos grants preservados; get_advisors (security) no
-- reportó hallazgos nuevos sobre estas 5 tablas; invariantes_seguridad() no
-- agregó ninguna violación nueva (el único hallazgo pre-existente que toca una
-- de estas tablas — I3 en unregistered_athletes.school_owner_manage_
-- unregistered_athletes, FOR ALL sin WITH CHECK explícito — ya estaba antes de
-- este cambio y es deuda aparte, no introducida acá).
-- =============================================================================

BEGIN;

REVOKE ALL ON public.unregistered_athletes    FROM anon;
REVOKE ALL ON public.sport_metric_definitions FROM anon;
REVOKE ALL ON public.sport_metric_thresholds  FROM anon;
REVOKE ALL ON public.performance_entries      FROM anon;
REVOKE ALL ON public.competition_results      FROM anon;

GRANT INSERT ON public.unregistered_athletes   TO anon;
GRANT SELECT ON public.sport_metric_thresholds TO anon;

COMMIT;
