-- =============================================================================
-- 20260915185925_add_child_id_access_control.sql
-- Autor: judegor99   Fecha: 2026-09-15   Versión anterior: 20260915121329
-- Objetivo: el control de acceso por torniquete (zk_user_mappings,
--   access_events) solo soportaba profiles (con login) y unregistered_athletes
--   (atletas sin login) -- children (alumnos enrolados por el flujo normal,
--   sin login propio) nunca tuvo forma de vincularse a un PIN. enrollments y
--   payments YA tienen child_id (mismo patrón de 3 vías); esta migración
--   extiende ese patrón, ya resuelto ahí, a las dos tablas que quedaron afuera.
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

ALTER TABLE public.zk_user_mappings
  ADD COLUMN child_id uuid REFERENCES public.children(id) ON DELETE SET NULL;

ALTER TABLE public.access_events
  ADD COLUMN child_id uuid REFERENCES public.children(id) ON DELETE SET NULL;

-- Exclusividad mutua: una fila de zk_user_mappings vincula el PIN a EXACTAMENTE
-- una identidad. Hoy (antes de esta migración) no había ningún CHECK entre
-- user_id/unregistered_athlete_id -- se agrega para las tres a la vez, mismo
-- espíritu que chk_enrollment_subject_exclusivity en enrollments. Verificado
-- contra la base viva antes de escribir esto: 0 filas violarían el check.
ALTER TABLE public.zk_user_mappings
  ADD CONSTRAINT chk_zk_mapping_subject_exclusivity
  CHECK (num_nonnulls(user_id, unregistered_athlete_id, child_id) = 1);

COMMIT;
