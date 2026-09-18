-- =============================================================================
-- 20260912102517_team_availability_y_scheduling_team_en_enrollments.sql
-- Autor: judegor99   Fecha: 2026-09-12   Versión anterior: 20260911184400
-- Objetivo: piloto de "agendar por equipo" (Dreamers + Academia Superior Bogotá).
-- Un atleta sigue cobrando por su plan/tarifa (offering_plan_id), pero cuando
-- el coach rota dentro de un nivel, hoy hay que reconfigurar coach_availability
-- por cada entrenador. Con esto, el HORARIO le pertenece al equipo (nivel), y
-- rotar coach es solo actualizar team_coaches (ya existe, migración
-- 20260224000032) — el horario no se toca.
--
-- team_availability: mismo shape que coach_availability, pero dueño = equipo.
-- enrollments.scheduling_team_id: columna nueva e independiente del team_id
-- que ya existe en enrollments (reservado para inscripciones 100% de equipo,
-- ej. Club Campestre, con team_id y SIN offering_plan_id). Se evitó reusar
-- team_id porque lo consumen ~19 archivos del BFF (asistencia, cobros,
-- reportes) que asumen ese significado — scheduling_team_id no lo toca
-- ninguno de esos flujos, solo el nuevo camino de generación de horarios en
-- session-bookings.ts.
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

CREATE TABLE public.team_availability (
    id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id                       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    school_id                     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    day_of_week                   smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time                    time NOT NULL,
    end_time                      time NOT NULL,
    available_for_group_classes   boolean NOT NULL DEFAULT true,
    available_for_personal_classes boolean NOT NULL DEFAULT false,
    max_group_capacity            integer,
    created_at                    timestamptz NOT NULL DEFAULT now(),
    updated_at                    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (team_id, day_of_week, start_time, end_time)
);

CREATE INDEX idx_team_availability_team_id ON public.team_availability(team_id);
CREATE INDEX idx_team_availability_school_id ON public.team_availability(school_id);

CREATE TRIGGER trg_team_availability_updated_at
    BEFORE UPDATE ON public.team_availability
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.team_availability ENABLE ROW LEVEL SECURITY;

-- Mismo criterio que coach_availability (school_admin_can_manage_coach_availability):
-- gestión completa reservada a admin de la escuela. El BFF es quien realmente
-- valida school_id server-side; esto es el respaldo de RLS.
CREATE POLICY team_availability_school_admin_manage
    ON public.team_availability
    FOR ALL
    USING (is_school_admin(school_id))
    WITH CHECK (is_school_admin(school_id));

COMMENT ON TABLE public.team_availability IS
    'Disponibilidad semanal de un EQUIPO (no de un coach individual) — piloto "agendar por equipo" (Dreamers, Academia Superior Bogotá). El coach que dicta se resuelve en team_coaches, independiente de este horario.';

-- ── enrollments.scheduling_team_id ───────────────────────────────────────────
ALTER TABLE public.enrollments
    ADD COLUMN scheduling_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX idx_enrollments_scheduling_team_id
    ON public.enrollments(scheduling_team_id) WHERE scheduling_team_id IS NOT NULL;

COMMENT ON COLUMN public.enrollments.scheduling_team_id IS
    'Piloto "agendar por equipo": cuando está seteado, /athlete/available agenda usando team_availability + team_coaches de este equipo en vez del booking_mode del offering. NO afecta cobro (offering_plan_id sigue siendo la fuente de verdad de precio/créditos) ni ninguna otra pantalla — deliberadamente distinto del team_id existente en esta tabla (reservado para inscripciones 100% de equipo).';

COMMIT;
