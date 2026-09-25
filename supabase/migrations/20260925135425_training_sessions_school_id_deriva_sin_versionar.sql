-- =============================================================================
-- 20260925135425_training_sessions_school_id_deriva_sin_versionar.sql
-- Autor: brylop   Fecha: 2026-09-25   Versión anterior: 20260925134939
-- Objetivo: documenta en el repo un cambio de esquema que YA ESTABA VIVO en
--   la base sin pasar por ninguna migración (deriva sin versionar, el gotcha
--   de siempre: "lo que se corre desde el SQL editor cambia la base sin
--   dejar rastro"). Encontrado por accidente: al probar `athlete_weekly_load`
--   (migración anterior) un INSERT de prueba a `training_sessions` reventó
--   con "42501 new row violates row-level security policy" -- la tabla ya
--   tenía `school_id uuid NOT NULL` y sus 4 policies ya comparaban
--   `sm.school_id = training_sessions.school_id` en vez del JOIN a `teams`
--   de siempre. Nadie lo commiteó: cero migración en el repo lo menciona.
--
--   Esta migración es TODO IDEMPOTENTE a propósito -- corre limpio tanto si
--   la base ya tiene esto (el caso real, hoy) como si alguien la corre desde
--   cero en un ambiente nuevo. No repite el `ALTER` a ciegas: cada pieza usa
--   `IF NOT EXISTS`/`DROP...CREATE` para no chocar contra lo que ya está.
--
--   Consecuencia real, no teórica: NINGÚN insert desde el frontend manda
--   `school_id` (ni `TrainingPlansPage.tsx` ni `MesocycleSection.tsx` lo
--   conocían -- `training_sessions` nunca lo tuvo hasta este cambio sin
--   versionar). Crear una sesión de entrenamiento, por CUALQUIERA de los dos
--   caminos, está roto en producción desde que esto se aplicó. El fix del
--   frontend (agregar `school_id` a los dos INSERT) va en el mismo commit
--   que esta migración -- no se puede separar, uno sin el otro dejaría el
--   síntoma igual.
--
--   De paso, mismo patrón que ya se cerró en `training_microcycle_days`/
--   `training_mesocycle_evaluations` (`20260921115743`): el `school_id`
--   denormalizado de `training_sessions` no tenía garantía de coincidir con
--   el de su `team_id` real. Verificado contra la base viva antes de
--   escribir esto: cero filas inconsistentes hoy. Se agrega el FK compuesto
--   para que no pueda pasar.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · RLS sin self-recursion.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. Columna (ya viva; IF NOT EXISTS por si se corre en un ambiente que no la tenga) ──
ALTER TABLE public.training_sessions
    ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

-- Backfill defensivo (no-op en la base real, ya está poblado) para cualquier
-- ambiente donde la columna se cree recién acá.
UPDATE public.training_sessions ts
SET school_id = t.school_id
FROM public.teams t
WHERE t.id = ts.team_id AND ts.school_id IS NULL;

ALTER TABLE public.training_sessions ALTER COLUMN school_id SET NOT NULL;

-- ─── 2. FK compuesto: school_id denormalizado, ahora garantizado contra el team real ──
-- `ADD CONSTRAINT ... IF NOT EXISTS` no existe en Postgres (a diferencia de
-- `ADD COLUMN IF NOT EXISTS`) -- se envuelve en un DO chequeando pg_constraint.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_id_school_key') THEN
        ALTER TABLE public.teams ADD CONSTRAINT teams_id_school_key UNIQUE (id, school_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_sessions_team_school_fkey') THEN
        ALTER TABLE public.training_sessions
            ADD CONSTRAINT training_sessions_team_school_fkey
            FOREIGN KEY (team_id, school_id) REFERENCES public.teams (id, school_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_training_sessions_school ON public.training_sessions (school_id);

-- ─── 3. RLS -- re-declarada tal cual está viva, + WITH CHECK en UPDATE (faltaba) ──
DROP POLICY IF EXISTS training_plans_select ON public.training_sessions;
CREATE POLICY training_plans_select ON public.training_sessions
    FOR SELECT USING (
        (EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = training_sessions.school_id
              AND sm.profile_id = auth.uid()
              AND sm.status = 'active'
              AND sm.role = ANY (ARRAY['owner','admin','staff','coach','super_admin','school_admin'])
        )) OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS training_plans_insert ON public.training_sessions;
CREATE POLICY training_plans_insert ON public.training_sessions
    FOR INSERT WITH CHECK (
        (EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = training_sessions.school_id
              AND sm.profile_id = auth.uid()
              AND sm.status = 'active'
              AND sm.role = ANY (ARRAY['owner','admin','staff','coach','super_admin','school_admin'])
        )) OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS training_plans_update ON public.training_sessions;
CREATE POLICY training_plans_update ON public.training_sessions
    FOR UPDATE USING (
        (EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = training_sessions.school_id
              AND sm.profile_id = auth.uid()
              AND sm.status = 'active'
              AND sm.role = ANY (ARRAY['owner','admin','staff','coach','super_admin','school_admin'])
        )) OR public.is_platform_admin()
    )
    -- WITH CHECK que faltaba en lo que estaba vivo: sin esto, un UPDATE
    -- podía escribir un school_id distinto sin que nadie lo validara contra
    -- la fila resultante (mismo patrón de I3 en CLAUDE.md, aplicado a UPDATE).
    WITH CHECK (
        (EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = training_sessions.school_id
              AND sm.profile_id = auth.uid()
              AND sm.status = 'active'
              AND sm.role = ANY (ARRAY['owner','admin','staff','coach','super_admin','school_admin'])
        )) OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS training_plans_delete ON public.training_sessions;
CREATE POLICY training_plans_delete ON public.training_sessions
    FOR DELETE USING (
        (EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = training_sessions.school_id
              AND sm.profile_id = auth.uid()
              AND sm.status = 'active'
              AND sm.role = ANY (ARRAY['owner','admin','staff','super_admin','school_admin'])
        )) OR public.is_platform_admin()
    );

COMMIT;

NOTIFY pgrst, 'reload schema';
