-- =============================================================================
-- 20260926124215_training_sessions_school_id_derivar_por_trigger.sql
-- Autor: brylop   Fecha: 2026-09-26   Versión anterior: 20260925140545
-- Objetivo: producción NO puede crear sesiones de entrenamiento desde el
--   24-sep a las 19:07 (hora Colombia). A esa hora se aplicó por el MCP de
--   Supabase (apply_migration "training_sessions_school_id", sin archivo en
--   el repo) la columna `training_sessions.school_id NOT NULL` con sus 4
--   policies comparando `sm.school_id = training_sessions.school_id`. El
--   frontend de producción (app.sportmaps.co, rama main) sigue mandando el
--   INSERT sin `school_id` → el WITH CHECK de `training_plans_insert`
--   evalúa `sm.school_id = NULL` → 42501 "new row violates row-level
--   security policy for table training_sessions". Confirmado en los logs de
--   Postgres del 25-sep (5 INSERT fallidos desde PostgREST: 10:01, 10:04,
--   12:22 y 12:23 hora Colombia; el de las 12:23 es el del video del coach
--   Carlos Ruiz, Carmel Club) y reproducido con su JWT en una transacción
--   con ROLLBACK.
--
--   El fix del frontend (commit 58bbe824 + migración 20260925135425) ya
--   está en develop/dev.sportmaps.co pero NO en main. Y un bundle viejo
--   cacheado en el navegador seguiría rompiendo aunque se despliegue.
--
--   Fix de base, independiente del bundle: trigger BEFORE INSERT que, si el
--   cliente no manda `school_id`, lo deriva de `teams.school_id` del
--   `team_id`. En PostgreSQL los triggers BEFORE ROW corren ANTES del WITH
--   CHECK de RLS y antes del NOT NULL, así que la fila llega a la policy ya
--   con su escuela. No relaja nada: la policy sigue exigiendo que
--   auth.uid() sea miembro activo de ESA escuela con rol permitido, y el FK
--   compuesto (team_id, school_id) → teams(id, school_id) de
--   20260925135425 sigue impidiendo que un cliente mande una escuela que no
--   es la del equipo.
--
--   SECURITY DEFINER a propósito: la lectura de `teams` dentro del trigger
--   no debe depender de la RLS de `teams` para el rol que inserta (si no
--   viera el equipo, el school_id quedaría NULL y volvería el 42501 sin
--   explicar nada). Lo que decide si puede o no insertar sigue siendo la
--   policy de `training_sessions`, no este trigger.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.fn_training_sessions_derive_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NEW.school_id IS NULL AND NEW.team_id IS NOT NULL THEN
        SELECT t.school_id INTO NEW.school_id
        FROM public.teams t
        WHERE t.id = NEW.team_id;
    END IF;
    RETURN NEW;
END;
$$;

-- No se revoca EXECUTE: una función RETURNS trigger no es invocable desde SQL
-- ni desde PostgREST ("trigger functions can only be called as triggers"),
-- así que el default privilege del esquema no expone nada acá.

DROP TRIGGER IF EXISTS trg_training_sessions_derive_school_id ON public.training_sessions;
CREATE TRIGGER trg_training_sessions_derive_school_id
    BEFORE INSERT ON public.training_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_training_sessions_derive_school_id();

COMMIT;

NOTIFY pgrst, 'reload schema';
