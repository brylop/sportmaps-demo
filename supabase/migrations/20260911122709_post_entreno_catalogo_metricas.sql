-- =============================================================================
-- 20260911122709_post_entreno_catalogo_metricas.sql
-- Autor: brylop   Fecha: 2026-09-11   Versión anterior: 20260910114047
-- Objetivo: F0 de "Evaluación Post-Entrenamiento" — docs/specs/evaluacion-post-entrenamiento.md
--
-- Siembra el catálogo de la autoevaluación post-sesión (deportista + rating del
-- coach) como filas de sport_metric_definitions, para voleibol y fútbol. No crea
-- tablas nuevas: reutiliza el catálogo de métricas que ya existe (§1 y §3.1 del
-- spec) — el mismo mecanismo que un admin usa hoy para agregar una métrica.
--
-- Tres columnas nuevas en sport_metric_definitions:
--   · aggregation — cómo se agregan las mediciones de un mes en el informe:
--       'latest'       → última vs. anterior (comportamiento actual, default,
--                        NINGUNA fila existente cambia de significado)
--       'avg'          → promedio del periodo (BORG, esfuerzo, rating del coach)
--       'distribution' → % por opción, NUNCA promedio (comprensión, satisfacción)
--       'count'        → veces seleccionado (aspectos a mejorar)
--   · options  — jsonb [{value,label}] para métricas de opción fija; NULL en las
--                numéricas puras (BORG es 0-10 continuo, sin options).
--   · required — si la pregunta es obligatoria en el formulario. Todo lo nuevo es
--                obligatorio EXCEPTO "aspectos a mejorar" (única pregunta opcional
--                en el Google Form original — 153 de 223 respuestas, ~30% la salta).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
--
-- Nota de seguridad (spec §1.1, ya CERRADA antes de escribir esto): se verificó
-- contra la base viva (pg_policies) que performance_entries y attendance_sessions
-- ya fueron corregidas por 20260814185120_padres_no_escriben_tablas_operativas.sql
-- (user_school_ids() → user_staff_school_ids() en las policies de escritura). El
-- hallazgo del spec estaba basado en el archivo de creación original, no en el
-- estado real — el fix ya existe, no hace falta F-SEC. No se toca RLS acá.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. Columnas nuevas — guardadas (misma cautela que 20260731160301 sobre
--        esta base compartida: ADD COLUMN IF NOT EXISTS toma AccessExclusiveLock
--        aunque no cambie nada; se pregunta al catálogo antes). ─────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sport_metric_definitions'
          AND column_name = 'aggregation'
    ) THEN
        ALTER TABLE public.sport_metric_definitions
            ADD COLUMN aggregation text NOT NULL DEFAULT 'latest'
                CHECK (aggregation IN ('latest','avg','distribution','count'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sport_metric_definitions'
          AND column_name = 'options'
    ) THEN
        ALTER TABLE public.sport_metric_definitions ADD COLUMN options jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sport_metric_definitions'
          AND column_name = 'required'
    ) THEN
        ALTER TABLE public.sport_metric_definitions
            ADD COLUMN required boolean NOT NULL DEFAULT true;
    END IF;
END $$;

COMMENT ON COLUMN public.sport_metric_definitions.aggregation IS
    'Cómo agrega el informe mensual las mediciones de un periodo: latest (última '
    'vs. anterior, default — comportamiento previo a esta migración), avg '
    '(promedio), distribution (% por opción, nunca promediar), count (veces '
    'seleccionado). Ver report-snapshot.service.ts §3.4 del spec.';
COMMENT ON COLUMN public.sport_metric_definitions.options IS
    'jsonb [{"value":n,"label":"..."}] para métricas de opción fija. NULL en '
    'numéricas puras sin catálogo de valores (ej. BORG 0-10 continuo).';
COMMENT ON COLUMN public.sport_metric_definitions.required IS
    'Si la pregunta es obligatoria en el formulario que la captura. Todas las de '
    'este catálogo son obligatorias salvo "aspectos a mejorar" (focus_*).';

-- ─── 2. Seed — evaluación post-entrenamiento, por deporte ────────────────────
-- ON CONFLICT (sport_category_id, metric_key) DO NOTHING: reintentar esta
-- migración (o que ya haya corrido parcialmente) no duplica ni pisa filas.
DO $$
DECLARE
    v_voleibol uuid := '3eeda4d4-2804-448e-9e1f-330949080c17';
    v_futbol   uuid := '5c560204-8c0e-41d9-b73a-d675799f4ab9';
    v_sport    uuid;
BEGIN
    FOREACH v_sport IN ARRAY ARRAY[v_voleibol, v_futbol]
    LOOP
        -- Las 5 preguntas universales (idénticas en ambos deportes) ───────────
        INSERT INTO public.sport_metric_definitions
            (sport_category_id, metric_key, display_name, parent_label, parent_hint,
             data_type, category, min_value, max_value, higher_is_better,
             aggregation, options, required)
        VALUES
        (v_sport, 'rpe_borg', 'Percepción de cansancio (BORG)',
         '¿Qué tan cansada terminaste?',
         'Escala de esfuerzo percibido de 0 (reposo) a 10 (esfuerzo extremo), '
         'reportada por la deportista al terminar cada sesión.',
         'rating', NULL, 0, 10, false, 'avg', NULL, true),

        (v_sport, 'task_comprehension', 'Comprensión de las tareas',
         '¿Entendiste los ejercicios de hoy?',
         'Qué tanto comprendió y aplicó los conceptos trabajados en la sesión.',
         'rating', NULL, 1, 4, true, 'distribution',
         '[{"value":1,"label":"Las comprendí y apliqué"},'
          '{"value":2,"label":"Solo las comprendí"},'
          '{"value":3,"label":"Las apliqué sin entender bien el concepto"},'
          '{"value":4,"label":"Ni las comprendí ni apliqué"}]'::jsonb,
         true),

        (v_sport, 'self_effort_pct', 'Esfuerzo y entrega',
         '¿Cuánto te esforzaste hoy?',
         'Percepción propia de esfuerzo y entrega durante el entrenamiento.',
         'rating', NULL, 50, 100, true, 'avg',
         '[{"value":50,"label":"Me costó, di menos de la mitad"},'
          '{"value":60,"label":"Di la mitad"},'
          '{"value":70,"label":"Me esforcé moderadamente"},'
          '{"value":80,"label":"Me esforcé bien"},'
          '{"value":90,"label":"Me esforcé mucho"},'
          '{"value":100,"label":"¡Lo di todo!"}]'::jsonb,
         true),

        (v_sport, 'satisfaction', 'Satisfacción y alegría',
         '¿Cómo te sentiste al terminar?',
         'Nivel de satisfacción y alegría de la deportista al cierre de la sesión.',
         'rating', NULL, 1, 5, true, 'distribution',
         '[{"value":1,"label":"No me siento satisfecha"},'
          '{"value":2,"label":"Me siento satisfecha"},'
          '{"value":3,"label":"Me siento alegre y satisfecha"},'
          '{"value":4,"label":"Me siento alegre"},'
          '{"value":5,"label":"No me siento satisfecha ni alegre"}]'::jsonb,
         true),

        (v_sport, 'coach_effort_rating', 'Rating del coach — esfuerzo',
         'Evaluación del entrenador frente a la entrega de la deportista',
         'Calificación que el coach hace, por deportista, tras cada sesión.',
         'rating', NULL, 50, 100, true, 'avg',
         '[{"value":50,"label":"Aplicó y entregó su esfuerzo a menos de la mitad"},'
          '{"value":60,"label":"A la mitad de lo que se le exige"},'
          '{"value":70,"label":"De forma moderada"},'
          '{"value":80,"label":"De buena manera"},'
          '{"value":90,"label":"De muy buena manera"},'
          '{"value":100,"label":"Aplicó y entregó todo su esfuerzo"}]'::jsonb,
         true)
        ON CONFLICT (sport_category_id, metric_key) DO NOTHING;
    END LOOP;

    -- Voleibol: catálogo de "aspectos a mejorar" (Besser) ──────────────────────
    INSERT INTO public.sport_metric_definitions
        (sport_category_id, metric_key, display_name, category,
         data_type, min_value, max_value, higher_is_better,
         aggregation, required)
    VALUES
    (v_voleibol, 'focus_comunicacion_campo',      'La comunicación en el campo',      'tactical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_recepcion_pase',           'Técnica de recepción y pase',       'technical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_remate',                   'Técnica de remate',                 'technical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_finta_enganche',           'La finta y el enganche',            'technical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_seguridad_tranquilidad',   'La seguridad y tranquilidad',       'tactical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_liderazgo',                'El liderazgo con mis compañeras',   'tactical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_mirar_espalda_levantar',   'Mirar la espalda y levantar',       'technical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_presion_tras_perdida',     'Presión tras pérdida',              'tactical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_acciones_defensivas',      'Acciones defensivas',               'tactical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_intensidad_fisico',        'La intensidad y el aspecto físico', 'physical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_toma_decision',            'La toma de decisión',               'tactical', 'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_nada',                     'Hoy nada',                          NULL,       'count', 0, 1, true, 'count', false),
    (v_voleibol, 'focus_other',                    'Otro',                              NULL,       'count', 0, 1, true, 'count', false)
    ON CONFLICT (sport_category_id, metric_key) DO NOTHING;

    -- Fútbol: catálogo de "aspectos a mejorar" (mockup aprobado) ───────────────
    INSERT INTO public.sport_metric_definitions
        (sport_category_id, metric_key, display_name, category,
         data_type, min_value, max_value, higher_is_better,
         aggregation, required)
    VALUES
    (v_futbol, 'focus_pase_control',       'Pase y control',           'technical', 'count', 0, 1, true, 'count', false),
    (v_futbol, 'focus_remate_gol',         'Remate a gol',             'technical', 'count', 0, 1, true, 'count', false),
    (v_futbol, 'focus_comunicacion_cancha','Comunicación en cancha',   'tactical',  'count', 0, 1, true, 'count', false),
    (v_futbol, 'focus_regate',             'Regate',                   'technical', 'count', 0, 1, true, 'count', false),
    (v_futbol, 'focus_marca_defensa',      'Marca y defensa',          'tactical',  'count', 0, 1, true, 'count', false),
    (v_futbol, 'focus_intensidad_fisica',  'Intensidad física',        'physical',  'count', 0, 1, true, 'count', false),
    (v_futbol, 'focus_nada',               'Hoy nada',                 NULL,        'count', 0, 1, true, 'count', false),
    (v_futbol, 'focus_other',              'Otro',                     NULL,        'count', 0, 1, true, 'count', false)
    ON CONFLICT (sport_category_id, metric_key) DO NOTHING;
END $$;

COMMIT;

-- =============================================================================
-- Qué NO hace esta migración, a propósito:
--   · No toca RLS (nota de seguridad arriba: ya está corregida en la base viva).
--   · No crea las RPCs de captura (submit_post_training_self_eval /
--     submit_post_training_coach_rating) — van en F1.
--   · No toca report-snapshot.service.ts (agregados de sesión) — va en F4.
--   · getMetricCatalog() (bff/src/services/metric-catalog.service.ts) necesita
--     exponer aggregation/options/required en su SELECT — cambio de código, no
--     de esta migración; se hace junto con F1 cuando el frontend los consuma.
-- =============================================================================
