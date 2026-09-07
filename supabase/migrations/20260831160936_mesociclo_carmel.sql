-- =============================================================================
-- 20260831160936_mesociclo_carmel.sql
-- Autor: judegor99   Fecha: 2026-08-31   Versión anterior: 20260831133329
-- Objetivo: PER-1 (microciclo) + PER-7 (mesociclo) + PER-8 (rúbrica) — nivel
--   mensual de periodización, a partir del Excel real "MESOCICLO C.C.C..xlsx"
--   de Club Carmel. Decisiones de producto resueltas en conversación con el
--   usuario el 2026-08-31 (D2, D4, D9-D12), documentadas en
--   docs/specs/periodizacion-microciclos-y-carga.md §2/§3.5/§3.6 y en el plan
--   docs/plan-mesociclo-carmel-2026-08-31.md.
--
-- Verificado contra la base viva (luebjarufsiadojhvxgi) antes de escribir esto:
--   · user_staff_school_ids()/user_school_ids() existen y responden por RPC.
--   · sport_metric_definitions: UNIQUE(sport_category_id, metric_key) y CHECK
--     de category = physical|technical|tactical|attendance confirmados en
--     20260731154626_regularize_performance_schema.sql:138-158.
--   · GRANT ALL a anon en performance_entries/sport_metric_definitions ya
--     estaba cerrado por 20260828224353_endurecer_grants_anon_metricas.sql —
--     esta migración no reabre nada, hereda las mismas policies restrictivas.
--   · Cero colisión de nombre con las 4 tablas nuevas en todo el repo, ni en
--     las 9 migraciones sin commitear del working tree (trial classes, eje
--     distinto).
--   · training_sessions ya existe con ese nombre desde
--     20260828230512_renombrar_sesiones_entrenamiento_futbol.sql (CAR-8) — acá
--     NO se le agrega ninguna columna, solo se documenta que su columna
--     `evaluation` (jsonb) admite una clave `rpe` más, sin DDL.
--
-- Alcance (docs/plan-mesociclo-carmel-2026-08-31.md §0): entra PER-1 completo,
-- PER-2 mínimo (sRPE → UA, sin monotonía/strain/ACWR — necesitan 28 días de
-- historia que hoy no existen), PER-7 y PER-8. Fuera de alcance: PER-3
-- (alertas), el resto de PER-0 (tablero táctico colgado de training_slots),
-- PER-4/5/6.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp
--     (no se crea ninguna función acá, se reusan user_staff_school_ids() y
--     update_updated_at_column() ya existentes).
--   · GRANT EXECUTE explícito por RPC (no aplica, sin funciones nuevas).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING — las de
--     acá filtran por school_id = ANY(user_staff_school_ids()), sin self-join.
--   · FOR ALL sin WITH CHECK (I3): evitado a propósito — 4 policies separadas
--     por tabla, con WITH CHECK explícito en INSERT/UPDATE.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. training_mesocycles (D9) — va primero: training_microcycles la referencia ──
CREATE TABLE IF NOT EXISTS public.training_mesocycles (
    id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id                uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id                  uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    starts_on                date        NOT NULL,
    ends_on                  date        NOT NULL,
    n_sessions_planned       integer     CHECK (n_sessions_planned IS NULL OR n_sessions_planned >= 0),
    session_duration_minutes integer     CHECK (session_duration_minutes IS NULL OR session_duration_minutes >= 0),
    general_objective        text,
    game_model               text,
    -- D12: el coach elige el modo de la rúbrica por mesociclo, no es una
    -- decisión única de plataforma.
    evaluation_mode          text        NOT NULL DEFAULT 'team'
                              CHECK (evaluation_mode = ANY (ARRAY['team','individual'])),
    -- Mismo patrón que evaluation (jsonb) de training_sessions, CAR-8.
    closing_review           jsonb,
    created_by               uuid        NOT NULL REFERENCES public.profiles(id),
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_training_mesocycles_school ON public.training_mesocycles (school_id);
CREATE INDEX IF NOT EXISTS idx_training_mesocycles_team   ON public.training_mesocycles (team_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'training_mesocycles'
          AND t.tgname = 'update_training_mesocycles_updated_at' AND NOT t.tgisinternal
    ) THEN
        CREATE TRIGGER update_training_mesocycles_updated_at
            BEFORE UPDATE ON public.training_mesocycles
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;


-- ─── 2. training_microcycles (D1, D9, D10) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_microcycles (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id      uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    mesocycle_id uuid        REFERENCES public.training_mesocycles(id) ON DELETE SET NULL,  -- D10, opcional
    number       integer,
    starts_on    date        NOT NULL,
    ends_on      date        NOT NULL,
    objective    text,
    -- Cierre semanal (D11) — texto libre del coach, no derivado. Asistencia y
    -- carga SÍ son derivadas (v_session_load, §4 de este archivo) y no viven
    -- acá para no duplicar lo que ya se puede calcular.
    objective_compliance   text,
    collective_performance text,
    improvement_notes      text,
    created_by   uuid        NOT NULL REFERENCES public.profiles(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (team_id, starts_on),
    CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_training_microcycles_school     ON public.training_microcycles (school_id);
CREATE INDEX IF NOT EXISTS idx_training_microcycles_team       ON public.training_microcycles (team_id);
CREATE INDEX IF NOT EXISTS idx_training_microcycles_mesocycle  ON public.training_microcycles (mesocycle_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'training_microcycles'
          AND t.tgname = 'update_training_microcycles_updated_at' AND NOT t.tgisinternal
    ) THEN
        CREATE TRIGGER update_training_microcycles_updated_at
            BEFORE UPDATE ON public.training_microcycles
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;


-- ─── 3. training_microcycle_days (D1, D3, D2) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_microcycle_days (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id            uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,  -- denormalizado, evita JOIN en RLS
    microcycle_id        uuid        NOT NULL REFERENCES public.training_microcycles(id) ON DELETE CASCADE,
    day_date             date        NOT NULL,
    day_type             text        NOT NULL CHECK (day_type = ANY (ARRAY['descanso','entrenamiento','partido','regenerativo','activacion'])),
    planned_rpe          smallint    CHECK (planned_rpe IS NULL OR planned_rpe BETWEEN 0 AND 10),
    planned_minutes      integer     CHECK (planned_minutes IS NULL OR planned_minutes >= 0),
    focus                text,
    -- D2: si el partido es un torneo gestionado en SportMaps, se liga acá y
    -- day_date se autocompleta desde tournament_matches.scheduled_at en el
    -- frontend. Si es un partido externo (el caso más común), day_date se
    -- tipea a mano y tournament_match_id queda NULL.
    session_id           uuid        REFERENCES public.training_sessions(id)  ON DELETE SET NULL,
    tournament_match_id  uuid        REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (microcycle_id, day_date)
);

CREATE INDEX IF NOT EXISTS idx_training_microcycle_days_school     ON public.training_microcycle_days (school_id);
CREATE INDEX IF NOT EXISTS idx_training_microcycle_days_microcycle ON public.training_microcycle_days (microcycle_id);
CREATE INDEX IF NOT EXISTS idx_training_microcycle_days_session    ON public.training_microcycle_days (session_id);


-- ─── 4. training_mesocycle_evaluations (D12, solo modo 'team') ──────────────
-- Modo 'individual' NO usa esta tabla — ver el INSERT de sport_metric_definitions
-- más abajo y performance_entries (ya existente). Tenerla separada por modo, en
-- vez de un subject_id nullable ambiguo acá mismo, evita mezclar "juicio del
-- coach sobre el equipo" con "métrica estandarizada del atleta" sin decidirlo
-- — el mismo error que dejó payments.status como TEXT (CLAUDE.md).
CREATE TABLE IF NOT EXISTS public.training_mesocycle_evaluations (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    mesocycle_id  uuid        NOT NULL REFERENCES public.training_mesocycles(id) ON DELETE CASCADE,
    indicator     text        NOT NULL CHECK (indicator = ANY (ARRAY[
                              'tecnica_individual','toma_decisiones','principios_juego',
                              'condicion_fisica','comportamiento_colectivo','rendimiento_competitivo'])),
    checkpoint    text        NOT NULL CHECK (checkpoint = ANY (ARRAY['inicial','semana_2','semana_3','semana_4','final'])),
    score         smallint    NOT NULL CHECK (score BETWEEN 1 AND 10),
    observations  text,
    created_by    uuid        NOT NULL REFERENCES public.profiles(id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (mesocycle_id, indicator, checkpoint)
);

CREATE INDEX IF NOT EXISTS idx_training_mesocycle_evaluations_school     ON public.training_mesocycle_evaluations (school_id);
CREATE INDEX IF NOT EXISTS idx_training_mesocycle_evaluations_mesocycle ON public.training_mesocycle_evaluations (mesocycle_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'training_mesocycle_evaluations'
          AND t.tgname = 'update_training_mesocycle_evaluations_updated_at' AND NOT t.tgisinternal
    ) THEN
        CREATE TRIGGER update_training_mesocycle_evaluations_updated_at
            BEFORE UPDATE ON public.training_mesocycle_evaluations
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;


-- ─── 5. RLS — mismo patrón que futbol_metricas_alineacion (CAR-8) ───────────
-- user_staff_school_ids(): quien TRABAJA en la escuela, sin padres/atletas.
-- Es contenido operativo de coach/admin (D7: no visible al padre en v1), y no
-- otorga permisos, así que no aplica user_admin_school_ids().
ALTER TABLE public.training_mesocycles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_microcycles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_microcycle_days       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_mesocycle_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_mesocycles_select ON public.training_mesocycles;
CREATE POLICY training_mesocycles_select ON public.training_mesocycles
    FOR SELECT USING (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_mesocycles_insert ON public.training_mesocycles;
CREATE POLICY training_mesocycles_insert ON public.training_mesocycles
    FOR INSERT WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_mesocycles_update ON public.training_mesocycles;
CREATE POLICY training_mesocycles_update ON public.training_mesocycles
    FOR UPDATE USING (school_id = ANY (public.user_staff_school_ids()))
    WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_mesocycles_delete ON public.training_mesocycles;
CREATE POLICY training_mesocycles_delete ON public.training_mesocycles
    FOR DELETE USING (school_id = ANY (public.user_staff_school_ids()));

DROP POLICY IF EXISTS training_microcycles_select ON public.training_microcycles;
CREATE POLICY training_microcycles_select ON public.training_microcycles
    FOR SELECT USING (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_microcycles_insert ON public.training_microcycles;
CREATE POLICY training_microcycles_insert ON public.training_microcycles
    FOR INSERT WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_microcycles_update ON public.training_microcycles;
CREATE POLICY training_microcycles_update ON public.training_microcycles
    FOR UPDATE USING (school_id = ANY (public.user_staff_school_ids()))
    WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_microcycles_delete ON public.training_microcycles;
CREATE POLICY training_microcycles_delete ON public.training_microcycles
    FOR DELETE USING (school_id = ANY (public.user_staff_school_ids()));

DROP POLICY IF EXISTS training_microcycle_days_select ON public.training_microcycle_days;
CREATE POLICY training_microcycle_days_select ON public.training_microcycle_days
    FOR SELECT USING (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_microcycle_days_insert ON public.training_microcycle_days;
CREATE POLICY training_microcycle_days_insert ON public.training_microcycle_days
    FOR INSERT WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_microcycle_days_update ON public.training_microcycle_days;
CREATE POLICY training_microcycle_days_update ON public.training_microcycle_days
    FOR UPDATE USING (school_id = ANY (public.user_staff_school_ids()))
    WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_microcycle_days_delete ON public.training_microcycle_days;
CREATE POLICY training_microcycle_days_delete ON public.training_microcycle_days
    FOR DELETE USING (school_id = ANY (public.user_staff_school_ids()));

DROP POLICY IF EXISTS training_mesocycle_evaluations_select ON public.training_mesocycle_evaluations;
CREATE POLICY training_mesocycle_evaluations_select ON public.training_mesocycle_evaluations
    FOR SELECT USING (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_mesocycle_evaluations_insert ON public.training_mesocycle_evaluations;
CREATE POLICY training_mesocycle_evaluations_insert ON public.training_mesocycle_evaluations
    FOR INSERT WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_mesocycle_evaluations_update ON public.training_mesocycle_evaluations;
CREATE POLICY training_mesocycle_evaluations_update ON public.training_mesocycle_evaluations
    FOR UPDATE USING (school_id = ANY (public.user_staff_school_ids()))
    WITH CHECK (school_id = ANY (public.user_staff_school_ids()));
DROP POLICY IF EXISTS training_mesocycle_evaluations_delete ON public.training_mesocycle_evaluations;
CREATE POLICY training_mesocycle_evaluations_delete ON public.training_mesocycle_evaluations
    FOR DELETE USING (school_id = ANY (public.user_staff_school_ids()));


-- ─── 6. Grants — sin anon, igual que futbol_metricas_alineacion ─────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE
            ON public.training_mesocycles, public.training_microcycles,
               public.training_microcycle_days, public.training_mesocycle_evaluations
            TO authenticated, service_role;
    END IF;
END $$;


-- ─── 7. Rúbrica modo 'individual' — 6 sport_metric_definitions nuevas ───────
-- Reusa performance_entries (context_type='evaluation', existe desde que se
-- creó la tabla, nunca usado — verificado 2026-08-31). metric_key prefijado
-- mesociclo_ para no repetir la colisión de nombre que dejó a duelos_ganados
-- con semántica de conteo en vez de rating (docs/specs/periodizacion-
-- microciclos-y-carga.md §3.6). category solo con valores válidos del CHECK
-- real (physical|technical|tactical|attendance) — no existe "colectivo".
DO $$
DECLARE
    v_sport_id uuid;
BEGIN
    SELECT id INTO v_sport_id FROM public.sports_categories WHERE name = 'Fútbol' LIMIT 1;

    IF v_sport_id IS NULL THEN
        RAISE NOTICE 'sports_categories "Fútbol" no encontrada -- se omite el seed de la rúbrica de mesociclo';
    ELSE
        INSERT INTO public.sport_metric_definitions
            (sport_category_id, metric_key, display_name, data_type, category, min_value, max_value, higher_is_better)
        VALUES
            (v_sport_id, 'mesociclo_tecnica_individual',       'Técnica individual (mesociclo)',       'rating', 'technical', 1, 10, true),
            (v_sport_id, 'mesociclo_toma_decisiones',          'Toma de decisiones (mesociclo)',       'rating', 'tactical',  1, 10, true),
            (v_sport_id, 'mesociclo_principios_juego',         'Principios de juego (mesociclo)',      'rating', 'tactical',  1, 10, true),
            (v_sport_id, 'mesociclo_condicion_fisica',         'Condición física (mesociclo)',         'rating', 'physical',  1, 10, true),
            (v_sport_id, 'mesociclo_comportamiento_colectivo', 'Comportamiento colectivo (mesociclo)', 'rating', 'tactical',  1, 10, true),
            (v_sport_id, 'mesociclo_rendimiento_competitivo',  'Rendimiento competitivo (mesociclo)',  'rating', 'physical',  1, 10, true)
        ON CONFLICT (sport_category_id, metric_key) DO NOTHING;
    END IF;
END $$;


-- ─── 8. v_session_load — UA derivada, D4 (sRPE de Foster) ───────────────────
-- No persiste: rpe vive en training_sessions.evaluation->>'rpe' (jsonb que
-- CAR-8 ya creó, sin ALTER TABLE acá) y los minutos se suman de
-- session_blocks. Agrupable por semana desde session_date en el cliente o con
-- date_trunc — no depende de que exista training_microcycles para calcularse.
CREATE OR REPLACE VIEW public.v_session_load
WITH (security_invoker = true) AS
SELECT
    ts.id            AS session_id,
    ts.team_id       AS team_id,
    ts.session_date  AS session_date,
    NULLIF(ts.evaluation ->> 'rpe', '')::smallint AS rpe,
    COALESCE((
        SELECT SUM(NULLIF(block ->> 'minutes', '')::numeric)
        FROM jsonb_array_elements(COALESCE(ts.session_blocks, '[]'::jsonb)) AS block
    ), 0) AS total_minutes,
    NULLIF(ts.evaluation ->> 'rpe', '')::smallint * COALESCE((
        SELECT SUM(NULLIF(block ->> 'minutes', '')::numeric)
        FROM jsonb_array_elements(COALESCE(ts.session_blocks, '[]'::jsonb)) AS block
    ), 0) AS load_ua
FROM public.training_sessions ts;

COMMENT ON VIEW public.v_session_load IS
    'Carga por sesión (UA = RPE de sesión x minutos totales, sRPE de Foster). '
    'security_invoker=true: hereda la RLS de training_sessions, no la de esta vista.';

COMMIT;

NOTIFY pgrst, 'reload schema';
