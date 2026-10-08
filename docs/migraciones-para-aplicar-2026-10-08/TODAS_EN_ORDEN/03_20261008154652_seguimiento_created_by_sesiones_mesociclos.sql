-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 03 de 14 (orden obligatorio).

-- =============================================================================
-- 20261008154652_seguimiento_created_by_sesiones_mesociclos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-08   Versión anterior: 20261007183601
-- Objetivo: atribuir sesiones de entrenamiento y mesociclos a la PERSONA que
--   los crea/edita (no solo al equipo), para la vista del dueño "Seguimiento
--   deportivo" (docs/specs/rediseno-seguimiento-deportivo.md, F4).
-- =============================================================================
-- Qué hace:
--   · training_sessions:   + created_by, + updated_by  (uuid → profiles.id, null ok)
--   · training_mesocycles: + updated_by                (created_by YA existe:
--       NOT NULL + FK training_mesocycles_created_by_fkey → profiles(id), lo
--       llena la RPC create_mesocycle_with_weeks; no se toca)
--   · Trigger BEFORE INSERT OR UPDATE en las dos tablas que llena las columnas
--     desde auth.uid() cuando hay sesión de usuario. Con service_role (BFF,
--     jobs) auth.uid() es NULL y se respeta lo que traiga la fila.
--   · Índice (school_id, created_by) en training_sessions para la consulta por
--     entrenador.
--
-- Backfill: NINGUNO. Para las sesiones históricas no hay forma de saber quién
--   las creó (no hay auditoría previa); quedan con created_by NULL y el BFF
--   cae a la atribución por equipo (teams.coach_id / team_coaches).
--
-- RLS: SIN CAMBIOS. Policies vivas verificadas el 2026-10-08 (pg_policies):
--   training_sessions:   training_plans_select / _insert / _update / _delete
--                        (school_members activo con rol owner/admin/staff/
--                        coach/super_admin/school_admin — delete sin coach —
--                        o is_platform_admin()). Ninguna menciona columnas
--                        nuevas; filtran por fila, no por columna.
--   training_mesocycles: training_mesocycles_select / _insert / _update /
--                        _delete, todas school_id = ANY(user_staff_school_ids())
--                        y _update con WITH CHECK. Tampoco cambian.
--   El trigger no lee ninguna tabla: no hay riesgo de self-recursion.
--
-- Triggers existentes que conviven (BEFORE, se disparan por orden alfabético):
--   training_sessions:   trg_training_sessions_derive_school_id (INSERT)
--   training_mesocycles: update_training_mesocycles_updated_at   (UPDATE)
--   El nuevo (trg_*_set_actor) no depende del orden: solo toca created_by y
--   updated_by.
--
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
-- =============================================================================

BEGIN;

-- 1) Columnas -----------------------------------------------------------------
-- ON DELETE SET NULL: borrar un perfil no debe quedar bloqueado por haber
-- planificado una sesión (ver project_delete_user_gotchas).
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.training_mesocycles
  ADD COLUMN IF NOT EXISTS updated_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.training_sessions.created_by IS
  'Perfil que creó la sesión (auth.uid() vía trigger). NULL = histórica (antes de 2026-10-08) o creada por service_role.';
COMMENT ON COLUMN public.training_sessions.updated_by IS
  'Último perfil que editó la sesión (auth.uid() vía trigger).';
COMMENT ON COLUMN public.training_mesocycles.updated_by IS
  'Último perfil que editó el mesociclo (auth.uid() vía trigger).';

-- 2) Función de trigger ------------------------------------------------------
-- SECURITY INVOKER (default): solo lee auth.uid(), no necesita privilegios.
CREATE OR REPLACE FUNCTION public.fn_training_set_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Con sesión de usuario, manda el JWT (el cliente no puede atribuirle la
    -- sesión a otro). Sin sesión (service_role), se respeta lo que venga.
    IF v_uid IS NOT NULL THEN
      NEW.created_by := v_uid;
      NEW.updated_by := v_uid;
    END IF;
  ELSE -- UPDATE
    -- created_by no se reasigna a OTRA persona. Sí se permite que quede NULL
    -- (es lo que hace el ON DELETE SET NULL al borrar el perfil).
    IF NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL THEN
      NEW.created_by := OLD.created_by;
    END IF;
    IF v_uid IS NOT NULL THEN
      NEW.updated_by := v_uid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Una función de trigger no se invoca por RPC; los privilegios se validan al
-- crear el trigger, no al dispararlo. Se revoca para que no aparezca expuesta.
REVOKE ALL ON FUNCTION public.fn_training_set_actor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_training_set_actor() FROM anon, authenticated;

-- 3) Triggers ------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_training_sessions_set_actor ON public.training_sessions;
CREATE TRIGGER trg_training_sessions_set_actor
  BEFORE INSERT OR UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.fn_training_set_actor();

DROP TRIGGER IF EXISTS trg_training_mesocycles_set_actor ON public.training_mesocycles;
CREATE TRIGGER trg_training_mesocycles_set_actor
  BEFORE INSERT OR UPDATE ON public.training_mesocycles
  FOR EACH ROW EXECUTE FUNCTION public.fn_training_set_actor();

-- 4) Índice ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_training_sessions_school_created_by
  ON public.training_sessions (school_id, created_by);

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261008154652', '20261008154652_seguimiento_created_by_sesiones_mesociclos', 'sql-editor 2026-10-08') on conflict (version) do nothing;
