-- =============================================================================
-- calendar_events: eventos por EQUIPO y por ESCUELA, visibles para las familias
-- =============================================================================
-- Reportado por CLUB DEPORTIVO BESSER (2026-09-23): el coach crea los
-- entrenamientos y los partidos en /calendar y los papás no ven nada.
--
-- Estado VIVO de la tabla (difiere del repo — 20260217000001 la creó con
-- school_id, la base de hoy NO lo tiene y sí tiene sport/event_label):
--   columnas: id, user_id, team_id, title, description, event_type, start_time,
--             end_time, location, all_day, is_demo, created_at, sport,
--             event_label, updated_at
--   policies: 6 (dos FOR ALL sin WITH CHECK → viola I3; la de lectura por
--             equipo mira team_members, tabla VACÍA en Besser: el roster real
--             vive en enrollments)
--   grants:   anon con SELECT/INSERT/UPDATE/DELETE
--
-- Modelo que queda (sin columna de visibilidad; se deriva de dos columnas):
--   team_id NOT NULL                → evento de EQUIPO. Lo ve el staff de la
--                                     escuela y las familias con un hijo (o el
--                                     propio atleta) inscrito en ese equipo.
--   team_id NULL, school_id NOT NULL → evento de TODA LA ESCUELA. Lo ve todo
--                                     miembro/familia de la escuela.
--   ambos NULL                       → evento PERSONAL. Solo quien lo creó.
--
-- Quién escribe: quien crea (user_id = auth.uid()) puede publicar para un
-- equipo o para toda la escuela solo si TRABAJA en ella (user_staff_school_ids,
-- nunca user_school_ids — I2). Editar/borrar: el creador, o la administración
-- de la escuela (user_admin_school_ids) para poder corregir lo de un coach.
-- =============================================================================

-- ─── 1. Columna school_id + índices ──────────────────────────────────────────
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_school_start ON public.calendar_events (school_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_team_start   ON public.calendar_events (team_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start   ON public.calendar_events (user_id, start_time);

-- ─── 2. Backfill ─────────────────────────────────────────────────────────────
-- Evento con equipo → escuela del equipo. Evento SIN equipo se queda personal
-- (school_id NULL): no se convierte en "toda la escuela" a espaldas de quien lo
-- creó. Los coaches re-asignan los suyos desde el lápiz del evento.
UPDATE public.calendar_events ce
   SET school_id = t.school_id
  FROM public.teams t
 WHERE ce.team_id = t.id AND ce.school_id IS NULL;

-- ─── 3. El equipo manda sobre la escuela ─────────────────────────────────────
-- Si viene team_id, school_id se toma del equipo (no de lo que mande el
-- cliente). SECURITY DEFINER para no depender de la RLS de teams.
CREATE OR REPLACE FUNCTION public.calendar_events_fill_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    SELECT t.school_id INTO NEW.school_id FROM public.teams t WHERE t.id = NEW.team_id;
    IF NEW.school_id IS NULL THEN
      RAISE EXCEPTION 'El equipo % no existe', NEW.team_id USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.calendar_events_fill_school() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_calendar_events_fill_school ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_fill_school
  BEFORE INSERT OR UPDATE OF team_id, school_id ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.calendar_events_fill_school();

-- ─── 4. Helpers de alcance para la familia (SECURITY DEFINER, sin recursión) ─
-- Equipos donde el usuario tiene un hijo inscrito (o él mismo, si es atleta
-- adulto). 'pending' cuenta: la familia que espera el primer pago ya debe ver
-- el horario. children.team_id entra también: es lo que llena el QR antes de
-- que exista la inscripción.
CREATE OR REPLACE FUNCTION public.calendar_family_team_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(array_agg(DISTINCT x.team_id), '{}'::uuid[])
  FROM (
    SELECT e.team_id
      FROM public.enrollments e
     WHERE e.team_id IS NOT NULL
       AND e.status IN ('active', 'pending', 'paused')
       AND (e.user_id = auth.uid()
            OR e.child_id IN (SELECT c.id FROM public.children c WHERE c.parent_id = auth.uid()))
    UNION
    SELECT c.team_id
      FROM public.children c
     WHERE c.parent_id = auth.uid() AND c.team_id IS NOT NULL AND c.is_active
  ) x;
$$;

-- Escuelas donde el usuario es miembro activo (user_school_ids: padres y
-- atletas incluidos) o tiene un hijo inscrito aunque no figure en
-- school_members. SOLO para lectura.
CREATE OR REPLACE FUNCTION public.calendar_family_school_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(array_agg(DISTINCT x.school_id), '{}'::uuid[])
  FROM (
    SELECT e.school_id
      FROM public.enrollments e
     WHERE e.status IN ('active', 'pending', 'paused')
       AND (e.user_id = auth.uid()
            OR e.child_id IN (SELECT c.id FROM public.children c WHERE c.parent_id = auth.uid()))
    UNION
    SELECT c.school_id
      FROM public.children c
     WHERE c.parent_id = auth.uid() AND c.school_id IS NOT NULL AND c.is_active
    UNION
    SELECT unnest(public.user_school_ids())
  ) x;
$$;

-- ¿El equipo pertenece a esa escuela? Para el WITH CHECK, sin pasar por la RLS
-- de teams (un equipo inactivo no es visible por teams_select_public).
CREATE OR REPLACE FUNCTION public.calendar_team_in_school(p_team uuid, p_school uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = p_team AND t.school_id = p_school);
$$;

REVOKE ALL ON FUNCTION public.calendar_family_team_ids()              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calendar_family_school_ids()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calendar_team_in_school(uuid, uuid)     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_family_team_ids()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_family_school_ids()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_team_in_school(uuid, uuid)  TO authenticated;

-- ─── 5. Policies: se tiran TODAS las vivas y se crean 4 ──────────────────────
-- Las policies son permisivas y se suman con OR: dejar una vieja abre la tabla.
DROP POLICY IF EXISTS "School admins can manage all events in their school" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can manage own events"                         ON public.calendar_events;
DROP POLICY IF EXISTS calendar_events_select                                ON public.calendar_events;
DROP POLICY IF EXISTS calendar_events_insert                                ON public.calendar_events;
DROP POLICY IF EXISTS calendar_events_update                                ON public.calendar_events;
DROP POLICY IF EXISTS calendar_events_delete                                ON public.calendar_events;
-- La del repo (20260218000002), por si estuviera viva en otro ambiente.
DROP POLICY IF EXISTS calendar_own_events                                   ON public.calendar_events;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Lectura. Helpers envueltos en (SELECT ...) para que Postgres los evalúe una
-- vez por consulta y no por fila.
CREATE POLICY calendar_events_select ON public.calendar_events
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_platform_admin())
    -- Staff de la escuela (coaches incluidos): todo lo de su escuela.
    OR (school_id IS NOT NULL AND school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]))
    -- Evento de toda la escuela: cualquier miembro o familia de la escuela.
    OR (team_id IS NULL AND school_id IS NOT NULL
        AND school_id = ANY ((SELECT public.calendar_family_school_ids())::uuid[]))
    -- Evento de equipo: familias con alguien inscrito en ese equipo.
    OR (team_id IS NOT NULL AND team_id = ANY ((SELECT public.calendar_family_team_ids())::uuid[]))
  );

-- Alta. Siempre a nombre propio. Personal: cualquiera. De equipo o de escuela:
-- solo quien trabaja en esa escuela, y el equipo tiene que ser de esa escuela.
CREATE POLICY calendar_events_insert ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      (school_id IS NULL AND team_id IS NULL)
      OR (SELECT public.is_platform_admin())
      OR (school_id IS NOT NULL
          AND school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
          AND (team_id IS NULL OR public.calendar_team_in_school(team_id, school_id)))
    )
  );

-- Edición. El creador, o la administración de la escuela del evento. La fila
-- resultante tiene que seguir cumpliendo las mismas reglas del alta (sin
-- exigir user_id = yo, para que el admin pueda corregir lo de un coach).
CREATE POLICY calendar_events_update ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_platform_admin())
    OR (school_id IS NOT NULL AND school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]))
  )
  WITH CHECK (
    (
      user_id = (SELECT auth.uid())
      OR (SELECT public.is_platform_admin())
      OR (school_id IS NOT NULL AND school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]))
    )
    AND (
      (school_id IS NULL AND team_id IS NULL)
      OR (SELECT public.is_platform_admin())
      OR (school_id IS NOT NULL
          AND school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
          AND (team_id IS NULL OR public.calendar_team_in_school(team_id, school_id)))
    )
  );

-- Borrado. El creador o la administración de la escuela del evento.
CREATE POLICY calendar_events_delete ON public.calendar_events
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_platform_admin())
    OR (school_id IS NOT NULL AND school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]))
  );

-- ─── 6. Grants: anon no tiene nada que hacer acá ─────────────────────────────
REVOKE ALL ON TABLE public.calendar_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calendar_events TO authenticated;

COMMENT ON COLUMN public.calendar_events.school_id IS
  'Escuela del evento. team_id → evento de equipo (school_id se toma del equipo por trigger); solo school_id → evento de toda la escuela; ambos NULL → personal.';
