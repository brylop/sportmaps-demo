-- =============================================================================
-- 20260921115743_mesociclo_md_cross_microciclo_y_ddl_hardening.sql
-- Autor: brylop   Fecha: 2026-09-21   Versión anterior: 20260919194528
-- Objetivo: implementa la parte de la revisión del 18-sep
--   (docs/specs/periodizacion-microciclos-y-carga.md §8,
--   docs/plan-mesociclo-carmel-2026-08-31.md §6a) que es DDL/RPC, sin tocar
--   todavía la dirección del FK día↔sesión (§8.2 — eso queda para una
--   migración aparte, es más grande y toca datos existentes de otra forma).
--
--   1. §8.1 — Índice MD que no cruza microciclos. RPC
--      `training_days_md_labels(team_id, day_dates[])`, SECURITY INVOKER (se
--      apoya en la RLS ya existente de las 2 tablas que lee, no necesita
--      SECURITY DEFINER). Mira TODOS los partidos del equipo, sin importar en
--      qué microciclo estén — corrige H1 reproducido dentro del producto.
--      El cálculo en cliente (`mdLabelsForDay` en MesocycleSection.tsx) se
--      retira en el mismo PR.
--
--   2. Corrección de datos real, encontrada al verificar el día-en-rango
--      antes de escribir el trigger de abajo (§8.6 tercer punto): 1 fila de
--      `training_microcycle_days` en producción, del team real 1375b77e, con
--      `microcycle_id` apuntando a la semana equivocada para su `day_date`
--      -- exactamente el bug que el trigger nuevo previene. Día 2026-09-16
--      enganchado a la semana 3 (Sep17-23) en vez de la semana 2 (Sep9-16,
--      la única a la que esa fecha puede pertenecer sin ambigüedad).
--      Se deja SIN TOCAR el mesociclo de prueba "PRUEBA" del team 3198480a,
--      con 2 días fuera de rango: uno (2026-08-20) es anterior al inicio de
--      TODO el mesociclo, no hay semana a la que reasignarlo sin inventar la
--      fecha; el otro (2026-09-18, semana 1) resultó ser un DUPLICADO -- ya
--      existe un día real con esa misma fecha en su semana correcta (con
--      sesión enganchada), así que reasignarlo chocaría contra
--      `UNIQUE(microcycle_id, day_date)`. Es dato de prueba, huérfano y
--      redundante; no se borra ni se adivina sin que el usuario lo pida.
--
--   3. §8.6 -- endurecimiento de DDL verificado contra `pg_constraint` antes
--      de escribir cada uno (ninguno rompe datos reales, confirmado con
--      SELECT antes de aplicar):
--        - FK compuesto `(microcycle_id, school_id)` / `(mesocycle_id,
--          school_id)` en las 3 tablas hijas -- hoy nada impedía que
--          `school_id` (denormalizado, "evita JOIN en RLS") de una fila no
--          coincidiera con el de su padre real.
--        - `EXCLUDE USING gist` -- dos microciclos del mismo equipo no
--          pueden solaparse en fechas (requiere `btree_gist`, no estaba
--          instalada).
--        - `UNIQUE(mesocycle_id, number)` -- D1 dice que ese número es el
--          lenguaje del cuerpo técnico, no puede repetirse dentro del mes.
--        - Trigger `training_microcycle_days` que exige `day_date` dentro
--          de `[starts_on, ends_on]` de su propio `microcycle_id` -- la causa
--          raíz del punto 2 de arriba. Los 2 días reasignados y confirmados
--          quedan limpios ANTES de crear el trigger; el huérfano de prueba
--          (2026-08-20) queda fuera de su rango a propósito, pero el trigger
--          solo dispara en escrituras nuevas, no revienta lo que ya existe.
--
--   Fuera de esta migración (queda para la siguiente, según §8.2/§8.7 del
--   spec): mover `session_id` de `training_microcycle_days` a
--   `training_sessions.microcycle_day_id`, D13 (carga por atleta), el flag
--   para el modo `individual`, el botón "Eliminar mesociclo" y el campo
--   `component` en `session_blocks`.
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

-- ─── 1. Corrección de datos — el día ya no está en la semana de su fecha ────
UPDATE public.training_microcycle_days
SET microcycle_id = '4305c0b3-298f-4dbe-9bab-c5c7ceb87c85'  -- semana 2, Sep9-16, del mismo mesociclo
WHERE id = '9d85483e-3e1f-4816-bc05-c7f79d89919c' AND day_date = '2026-09-16';


-- ─── 2. Índice MD cruzando microciclos (§8.1) ───────────────────────────────
-- SECURITY INVOKER a propósito: no necesita saltar RLS, el caller ya tiene
-- acceso de lectura a estas 2 tablas si es staff de la escuela -- mismo
-- criterio de "sin RPC si no hace falta" que ya usa v_session_load.
CREATE OR REPLACE FUNCTION public.training_days_md_labels(p_team_id uuid, p_day_dates date[])
RETURNS TABLE(day_date date, md_labels text[])
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
    WITH input_days AS (
        SELECT DISTINCT unnest(p_day_dates) AS day_date
    ),
    partidos AS (
        SELECT d.day_date
        FROM public.training_microcycle_days d
        JOIN public.training_microcycles mc ON mc.id = d.microcycle_id
        WHERE mc.team_id = p_team_id
          AND d.day_type = 'partido'
    )
    SELECT
        i.day_date,
        CASE
            WHEN EXISTS (SELECT 1 FROM partidos p WHERE p.day_date = i.day_date)
                THEN ARRAY['MD']
            ELSE ARRAY_REMOVE(ARRAY[
                (SELECT 'MD+' || (i.day_date - p.day_date)
                   FROM partidos p WHERE p.day_date < i.day_date
                   ORDER BY p.day_date DESC LIMIT 1),
                (SELECT 'MD-' || (p.day_date - i.day_date)
                   FROM partidos p WHERE p.day_date > i.day_date
                   ORDER BY p.day_date ASC LIMIT 1)
            ], NULL)
        END AS md_labels
    FROM input_days i;
$$;

REVOKE ALL ON FUNCTION public.training_days_md_labels(uuid, date[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.training_days_md_labels(uuid, date[]) TO authenticated;


-- ─── 3. Endurecimiento de DDL (§8.6) ────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- Auxiliares para los FK compuestos de abajo (Postgres exige que la columna
-- referenciada tenga UNIQUE/PK; `id` solo ya es PK, esto agrega la pareja).
ALTER TABLE public.training_mesocycles  ADD CONSTRAINT training_mesocycles_id_school_key  UNIQUE (id, school_id);
ALTER TABLE public.training_microcycles ADD CONSTRAINT training_microcycles_id_school_key UNIQUE (id, school_id);

-- FK compuesto: el school_id denormalizado ya no puede divergir del real del padre.
ALTER TABLE public.training_microcycles
    ADD CONSTRAINT training_microcycles_mesocycle_school_fkey
    FOREIGN KEY (mesocycle_id, school_id) REFERENCES public.training_mesocycles (id, school_id);

ALTER TABLE public.training_microcycle_days
    ADD CONSTRAINT training_microcycle_days_microcycle_school_fkey
    FOREIGN KEY (microcycle_id, school_id) REFERENCES public.training_microcycles (id, school_id);

ALTER TABLE public.training_mesocycle_evaluations
    ADD CONSTRAINT training_mesocycle_evaluations_mesocycle_school_fkey
    FOREIGN KEY (mesocycle_id, school_id) REFERENCES public.training_mesocycles (id, school_id);

-- Dos microciclos del mismo equipo no pueden solaparse en fechas.
ALTER TABLE public.training_microcycles
    ADD CONSTRAINT training_microcycles_no_overlap
    EXCLUDE USING gist (team_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&);

-- D1: el número de semana es el lenguaje del cuerpo técnico, no se repite dentro del mes.
ALTER TABLE public.training_microcycles
    ADD CONSTRAINT training_microcycles_mesocycle_number_key UNIQUE (mesocycle_id, number);

-- Un día no puede vivir fuera del rango de fechas de su propia semana.
CREATE OR REPLACE FUNCTION public.check_training_day_within_microcycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_starts date;
    v_ends   date;
BEGIN
    SELECT starts_on, ends_on INTO v_starts, v_ends
    FROM public.training_microcycles WHERE id = NEW.microcycle_id;

    IF NEW.day_date < v_starts OR NEW.day_date > v_ends THEN
        RAISE EXCEPTION 'day_date % está fuera del rango [%, %] de su microciclo', NEW.day_date, v_starts, v_ends
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_microcycle_days_within_range ON public.training_microcycle_days;
CREATE TRIGGER training_microcycle_days_within_range
    BEFORE INSERT OR UPDATE OF day_date, microcycle_id ON public.training_microcycle_days
    FOR EACH ROW EXECUTE FUNCTION public.check_training_day_within_microcycle();

COMMIT;

NOTIFY pgrst, 'reload schema';
