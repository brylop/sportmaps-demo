-- =============================================================================
-- 20260918131232_training_sessions_select_solo_staff.sql
-- Autor: brylop   Fecha: 2026-09-18   Versión anterior: 20260918130753
-- Objetivo: training_sessions (contenido de las sesiones de entrenamiento,
--   PER-1/7/8) tenía DOS grietas de lectura, encontradas al responder si un
--   padre o atleta puede ver estas sesiones desde su app (ver
--   docs/specs/periodizacion-microciclos-y-carga.md, [[project_periodizacion_track]]):
--
--   1. training_plans_select (SELECT) no filtraba por rol -- alcanzaba con
--      ser miembro ACTIVO de la escuela (cualquier rol, incluido
--      parent/athlete) para leer el contenido completo de CUALQUIER equipo
--      de esa escuela, no solo del propio. Las otras tres operaciones
--      (INSERT/UPDATE/DELETE) sí estaban restringidas por rol -- solo el
--      SELECT se quedó abierto.
--   2. training_plans_coach_policy: policy FOR ALL heredada de cuando esta
--      tabla se llamaba training_plans (antes del rename de
--      20260828230512_renombrar_sesiones_entrenamiento_futbol.sql), nunca
--      limpiada. Es PERMISSIVE y se SUMA con OR a las demás -- endurecer
--      training_plans_select no alcanza mientras esta siga viva, porque
--      cubre SELECT (y también INSERT/UPDATE/DELETE) para cualquier
--      school_members con role IN ('school','admin','coach') SIN exigir
--      status='active' (un miembro dado de baja seguiría pudiendo leer y
--      escribir). Exactamente el patrón que ya advierte CLAUDE.md: "endurecer
--      cuatro no sirve si queda una quinta abierta sobre la misma tabla".
--
--   Fix: se borra la policy legacy (las 4 policies dedicadas ya cubren todo
--   lo que hacía, con status='active' de más) y el SELECT queda con el mismo
--   set de roles que INSERT/UPDATE -- solo staff de la escuela
--   (owner/admin/staff/coach/super_admin/school_admin), nunca parent/athlete
--   ni un miembro inactivo. No hace falta migrar datos: solo cambia quién
--   puede leer, ninguna fila se mueve.
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

SET LOCAL lock_timeout = '5s';

-- Legacy de training_plans, nunca limpiada tras el rename. FOR ALL sin
-- status='active' -- redundante y más permisiva que las 4 policies dedicadas
-- de abajo, que ya cubren select/insert/update/delete correctamente.
DROP POLICY IF EXISTS training_plans_coach_policy ON public.training_sessions;

DROP POLICY IF EXISTS training_plans_select ON public.training_sessions;
CREATE POLICY training_plans_select ON public.training_sessions
    FOR SELECT USING (
        (EXISTS (
            SELECT 1 FROM public.teams t
            JOIN public.school_members sm ON sm.school_id = t.school_id
            WHERE t.id = training_sessions.team_id
              AND sm.profile_id = auth.uid()
              AND sm.status = 'active'
              AND sm.role = ANY (ARRAY['owner','admin','staff','coach','super_admin','school_admin'])
        ))
        OR public.is_platform_admin()
    );

COMMIT;

NOTIFY pgrst, 'reload schema';
