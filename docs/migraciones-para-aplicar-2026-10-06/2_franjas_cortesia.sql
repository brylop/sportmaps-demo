-- Pegar COMPLETO en el SQL Editor. Franjas de clase de cortesía desde los entrenamientos.
-- =============================================================================
-- 20261006084303_franjas_cortesia_desde_entrenamientos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006082002
-- Objetivo: que las franjas de clase de cortesía salgan de los ENTRENAMIENTOS
-- reales de cada grupo (teams.schedule) en vez de cargarse a mano.
--
-- El generador vive en el BFF (bff/src/services/franjas-cortesia.service.ts) y
-- corre a diario (05:30 COT) en los TRES BFF que comparten esta base. Esta
-- migración solo le da lo que necesita de la base:
--
--   1. school_settings.courtesy_from_training — opción por escuela. Default
--      false: ninguna escuela empieza a ofrecer clases de cortesía en todos sus
--      entrenamientos sin haberlo decidido. Se activa por script (Dynasty).
--
--   2. school_trial_slots.generated_from_schedule — distingue las franjas que
--      creó el generador de las que la escuela carga a mano. Sin esto el job no
--      puede CERRAR las franjas de un horario que cambió (si cerrara por
--      team_id, se llevaría por delante las manuales).
--
--   3. Índice ÚNICO parcial (team_id, slot_date, start_time) WHERE team_id IS
--      NOT NULL — la idempotencia entre los 3 BFF no puede depender de «leer y
--      luego insertar» (dos procesos leen lo mismo y los dos insertan). Con el
--      índice, el segundo recibe 23505 y el generador lo cuenta como «ya
--      existía». Parcial porque las franjas manuales sin equipo (team_id NULL)
--      no tienen por qué ser únicas por hora.
--      Medido el 2026-10-06: 2 filas en toda la tabla, ambas con team_id NULL
--      → el índice se crea sin chocar con datos existentes.
--
-- No toca RLS: school_trial_slots sigue sin GRANT a anon/authenticated (todo
-- pasa por RPC SECURITY DEFINER) y school_settings conserva sus policies; la
-- columna nueva no es sensible.
-- =============================================================================

BEGIN;

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS courtesy_from_training boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.courtesy_from_training IS
    'true = el BFF genera a diario franjas de clase de cortesía (school_trial_slots) desde teams.schedule, ventana rodante de 3 semanas, sin límite práctico de cupos (max_capacity = 999). Ver bff/src/services/franjas-cortesia.service.ts.';

ALTER TABLE public.school_trial_slots
    ADD COLUMN IF NOT EXISTS generated_from_schedule boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_trial_slots.generated_from_schedule IS
    'true = la creó el generador desde teams.schedule. Solo estas las puede cerrar el job cuando el horario del grupo cambia (y solo si no tienen reservas). Las manuales (false) no se tocan nunca.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_trial_slots_team_fecha_hora
    ON public.school_trial_slots (team_id, slot_date, start_time)
    WHERE team_id IS NOT NULL;

COMMIT;

insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261006084303', '20261006084303_franjas_cortesia_desde_entrenamientos', 'sql-editor 2026-10-06') on conflict (version) do nothing;
