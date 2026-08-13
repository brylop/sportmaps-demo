-- =============================================================================
-- 20260812131456_futbol_metricas_alineacion.sql
-- Autor: judegor99   Fecha: 2026-08-12   Versión anterior: 20260811110226
-- Objetivo: capa autocontenida de alineación/eventos de partido para fútbol
--           (Fase 1 de "Módulo de Rendimiento de Fútbol"), sin depender de
--           event_teams/event_team_members (sin CREATE TABLE versionado en
--           el repo -- riesgo de drift) ni de tournament_match_events
--           (queda intacta, es el feed oficial de torneo).
--
-- Identidad de jugador: mismo patrón polimórfico que performance_entries
--   (subject_type IN profile/child/unregistered + subject_id, sin FK).
-- Identidad de partido: mismo criterio, polimórfico (source_type IN
--   team_match/tournament_match + source_id -> match_results.id o
--   tournament_matches.id, ambas con DDL 100% conocido).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp
--     (no se crea ninguna función nueva acá, se reusan is_parent_of_child()
--     y user_school_ids() ya existentes).
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
--   · team_members es tabla VIVA con tráfico real (misma Supabase para
--     dev/stg/prod) -- el ALTER TABLE sobre ella sigue el patrón anti-lock
--     de 20260731160301_regularize_performance_schema_lockfree.sql
--     (chequear catálogo antes de tomar AccessExclusiveLock).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';


-- ─── 1. Catálogo de posiciones sobre el roster existente (team_members) ─────
-- No se toca la columna `position` (texto libre, ya en uso) ni se fuerza
-- backfill -- no hay mapeo confiable de texto libre a las 4 categorías.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'team_members'
          AND column_name  = 'position_code'
    ) THEN
        ALTER TABLE public.team_members ADD COLUMN position_code text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'team_members_position_code_check'
          AND conrelid = 'public.team_members'::regclass
    ) THEN
        ALTER TABLE public.team_members
            ADD CONSTRAINT team_members_position_code_check
            CHECK (position_code IS NULL
                   OR position_code = ANY (ARRAY['arquero','defensa','medio','delantero']));
    END IF;
END $$;


-- ─── 2. match_lineups ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_lineups (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id      uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    source_type  text        NOT NULL CHECK (source_type = ANY (ARRAY['team_match','tournament_match'])),
    source_id    uuid        NOT NULL,
    formation    text,
    created_by   uuid        NOT NULL REFERENCES public.profiles(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_match_lineups_school ON public.match_lineups (school_id);
CREATE INDEX IF NOT EXISTS idx_match_lineups_team   ON public.match_lineups (team_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'match_lineups'
          AND t.tgname = 'update_match_lineups_updated_at' AND NOT t.tgisinternal
    ) THEN
        CREATE TRIGGER update_match_lineups_updated_at
            BEFORE UPDATE ON public.match_lineups
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;


-- ─── 3. match_lineup_players ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_lineup_players (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    lineup_id      uuid        NOT NULL REFERENCES public.match_lineups(id) ON DELETE CASCADE,
    school_id      uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    subject_type   text        NOT NULL CHECK (subject_type = ANY (ARRAY['profile','child','unregistered'])),
    subject_id     uuid        NOT NULL,
    position_code  text        CHECK (position_code = ANY (ARRAY['arquero','defensa','medio','delantero'])),
    role           text        NOT NULL CHECK (role = ANY (ARRAY['starter','bench'])),
    jersey_number  integer,
    minutes_played integer     CHECK (minutes_played IS NULL OR minutes_played >= 0),
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (lineup_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_match_lineup_players_lineup  ON public.match_lineup_players (lineup_id);
CREATE INDEX IF NOT EXISTS idx_match_lineup_players_school  ON public.match_lineup_players (school_id);
CREATE INDEX IF NOT EXISTS idx_match_lineup_players_subject ON public.match_lineup_players (subject_type, subject_id);


-- ─── 4. football_match_events ────────────────────────────────────────────────
-- Registro del entrenador de sus propios jugadores. No reemplaza ni reconcilia
-- con tournament_match_events (feed oficial de torneo), que queda intacta.
CREATE TABLE IF NOT EXISTS public.football_match_events (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id      uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    source_type  text        NOT NULL CHECK (source_type = ANY (ARRAY['team_match','tournament_match'])),
    source_id    uuid        NOT NULL,
    subject_type text        NOT NULL CHECK (subject_type = ANY (ARRAY['profile','child','unregistered'])),
    subject_id   uuid        NOT NULL,
    type         text        NOT NULL CHECK (type = ANY (ARRAY['goal','own_goal','yellow','red','assist'])),
    minute       integer     CHECK (minute IS NULL OR minute >= 0),
    created_by   uuid        NOT NULL REFERENCES public.profiles(id),
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_football_match_events_school  ON public.football_match_events (school_id);
CREATE INDEX IF NOT EXISTS idx_football_match_events_team    ON public.football_match_events (team_id);
CREATE INDEX IF NOT EXISTS idx_football_match_events_source  ON public.football_match_events (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_football_match_events_subject ON public.football_match_events (subject_type, subject_id);


-- ─── 5. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.match_lineups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_lineup_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.football_match_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    v_defs text[][] := ARRAY[
        ARRAY['match_lineups', 'match_lineups_select',
              'CREATE POLICY "match_lineups_select" ON public.match_lineups '
              'FOR SELECT USING ('
              '  school_id = ANY (public.user_school_ids())'
              '  OR EXISTS (SELECT 1 FROM public.match_lineup_players mlp '
              '             WHERE mlp.lineup_id = match_lineups.id '
              '               AND ((mlp.subject_type = ''profile'' AND mlp.subject_id = auth.uid())'
              '                 OR (mlp.subject_type = ''child'' AND public.is_parent_of_child(mlp.subject_id)))))'],
        ARRAY['match_lineups', 'match_lineups_insert',
              'CREATE POLICY "match_lineups_insert" ON public.match_lineups '
              'FOR INSERT WITH CHECK (school_id = ANY (public.user_school_ids()) OR created_by = auth.uid())'],
        ARRAY['match_lineups', 'match_lineups_update',
              'CREATE POLICY "match_lineups_update" ON public.match_lineups '
              'FOR UPDATE USING (school_id = ANY (public.user_school_ids()) OR created_by = auth.uid()) '
              'WITH CHECK (school_id = ANY (public.user_school_ids()) OR created_by = auth.uid())'],
        ARRAY['match_lineups', 'match_lineups_delete',
              'CREATE POLICY "match_lineups_delete" ON public.match_lineups '
              'FOR DELETE USING (school_id = ANY (public.user_school_ids()))'],

        ARRAY['match_lineup_players', 'match_lineup_players_select',
              'CREATE POLICY "match_lineup_players_select" ON public.match_lineup_players '
              'FOR SELECT USING ('
              '  school_id = ANY (public.user_school_ids())'
              '  OR (subject_type = ''profile'' AND subject_id = auth.uid())'
              '  OR (subject_type = ''child'' AND public.is_parent_of_child(subject_id)))'],
        ARRAY['match_lineup_players', 'match_lineup_players_insert',
              'CREATE POLICY "match_lineup_players_insert" ON public.match_lineup_players '
              'FOR INSERT WITH CHECK (school_id = ANY (public.user_school_ids()))'],
        ARRAY['match_lineup_players', 'match_lineup_players_update',
              'CREATE POLICY "match_lineup_players_update" ON public.match_lineup_players '
              'FOR UPDATE USING (school_id = ANY (public.user_school_ids())) '
              'WITH CHECK (school_id = ANY (public.user_school_ids()))'],
        ARRAY['match_lineup_players', 'match_lineup_players_delete',
              'CREATE POLICY "match_lineup_players_delete" ON public.match_lineup_players '
              'FOR DELETE USING (school_id = ANY (public.user_school_ids()))'],

        ARRAY['football_match_events', 'football_match_events_select',
              'CREATE POLICY "football_match_events_select" ON public.football_match_events '
              'FOR SELECT USING ('
              '  school_id = ANY (public.user_school_ids())'
              '  OR (subject_type = ''profile'' AND subject_id = auth.uid())'
              '  OR (subject_type = ''child'' AND public.is_parent_of_child(subject_id)))'],
        ARRAY['football_match_events', 'football_match_events_insert',
              'CREATE POLICY "football_match_events_insert" ON public.football_match_events '
              'FOR INSERT WITH CHECK (school_id = ANY (public.user_school_ids()))'],
        ARRAY['football_match_events', 'football_match_events_update',
              'CREATE POLICY "football_match_events_update" ON public.football_match_events '
              'FOR UPDATE USING (school_id = ANY (public.user_school_ids())) '
              'WITH CHECK (school_id = ANY (public.user_school_ids()))'],
        ARRAY['football_match_events', 'football_match_events_delete',
              'CREATE POLICY "football_match_events_delete" ON public.football_match_events '
              'FOR DELETE USING (school_id = ANY (public.user_school_ids()))']
    ];
    i int;
BEGIN
    FOR i IN 1 .. array_length(v_defs, 1) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_defs[i][1] AND policyname = v_defs[i][2]
        ) THEN
            EXECUTE v_defs[i][3];
        END IF;
    END LOOP;
END $$;


-- ─── 6. Grants ────────────────────────────────────────────────────────────────
-- Deliberadamente SIN GRANT a `anon` -- a diferencia de la desviación conocida
-- y aún pendiente de revocar en performance_entries/competition_results (ver
-- 20260731160301_regularize_performance_schema_lockfree.sql, NOTA 2). Estas
-- tablas nacen con mínimo privilegio.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE
            ON public.match_lineups, public.match_lineup_players, public.football_match_events
            TO authenticated, service_role;
    END IF;
END $$;


-- ─── 7. Seed de sport_metric_definitions para fútbol ────────────────────────
-- Solo métricas MANUALES/subjetivas. Goles, asistencias, tarjetas, partidos
-- jugados y minutos NO se siembran acá -- ya son datos objetivos en
-- football_match_events/match_lineup_players; sembrarlos como métrica también
-- llevaría al coach a cargarlos dos veces.
DO $$
DECLARE
    v_sport_id uuid;
BEGIN
    SELECT id INTO v_sport_id FROM public.sports_categories WHERE name = 'Fútbol' LIMIT 1;

    IF v_sport_id IS NULL THEN
        RAISE NOTICE 'sports_categories "Fútbol" no encontrada -- se omite el seed de métricas de fútbol';
    ELSE
        INSERT INTO public.sport_metric_definitions
            (sport_category_id, metric_key, display_name, data_type, category, subcategory, min_value, max_value, higher_is_better)
        VALUES
            (v_sport_id, 'precision_pase',           'Precisión de pase',      'rating', 'technical', 'pase',         1, 5, true),
            (v_sport_id, 'control_balon',             'Control de balón',       'rating', 'technical', 'control',      1, 5, true),
            (v_sport_id, 'definicion',                'Definición',             'rating', 'technical', 'finalizacion', 1, 5, true),
            (v_sport_id, 'duelos_ganados',             'Duelos ganados',         'rating', 'technical', 'defensa',      1, 5, true),
            (v_sport_id, 'posicionamiento_tactico',    'Posicionamiento táctico','rating', 'tactical',  NULL,           1, 5, true),
            (v_sport_id, 'actitud_esfuerzo',           'Actitud y esfuerzo',     'rating', 'physical',  NULL,           1, 5, true)
        ON CONFLICT (sport_category_id, metric_key) DO NOTHING;

        INSERT INTO public.sport_metric_thresholds (metric_id, band, min_value, max_value)
        SELECT smd.id, bands.band, bands.min_value, bands.max_value
        FROM public.sport_metric_definitions smd
        CROSS JOIN (VALUES
            ('red',    1, 2),
            ('yellow', 3, 3),
            ('green',  4, 5)
        ) AS bands(band, min_value, max_value)
        WHERE smd.sport_category_id = v_sport_id
          AND smd.metric_key IN (
              'precision_pase','control_balon','definicion',
              'duelos_ganados','posicionamiento_tactico','actitud_esfuerzo'
          )
        ON CONFLICT (metric_id, band) DO NOTHING;
    END IF;
END $$;

COMMIT;
