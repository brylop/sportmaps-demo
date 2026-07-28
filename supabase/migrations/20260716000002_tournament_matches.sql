-- ============================================================
-- SPORTMAPS — Torneos: formato de competencia + partidos + resultados
-- ------------------------------------------------------------
-- Capa "Resultados" (inspirada en gestores de competición tipo controla.club),
-- acotada a: LIGA (todos contra todos → tabla de posiciones) y base para COPA.
--   * events.competition_format: liga | copa | grupos | americano
--   * tournament_matches: partidos (jornada, local/visitante, marcador)
--   * tournament_match_events: goles/tarjetas por jugador (goleadores, fair play)
-- La tabla de posiciones se calcula on-the-fly desde los partidos jugados.
-- RLS: lectura autenticado; escritura solo quien gestiona el evento (can_manage_event).
-- Fecha: 2026-07-16
-- ============================================================

BEGIN;

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS competition_format text
        CHECK (competition_format IS NULL OR competition_format IN ('liga','copa','grupos','americano'));

COMMENT ON COLUMN public.events.competition_format IS
    'Formato de la competencia: liga (round-robin) | copa (eliminación) | grupos | americano.';

-- ── Partidos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_matches (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    category_id  uuid REFERENCES public.event_categories_config(id) ON DELETE SET NULL,
    round        integer NOT NULL DEFAULT 1,       -- jornada (liga) o ronda (copa)
    slot         integer NOT NULL DEFAULT 0,       -- orden dentro de la jornada/ronda
    home_team_id uuid REFERENCES public.event_teams(id) ON DELETE SET NULL,
    away_team_id uuid REFERENCES public.event_teams(id) ON DELETE SET NULL,
    home_score   integer,
    away_score   integer,
    status       text NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','played','walkover','cancelled')),
    scheduled_at timestamptz,
    venue        text,
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tmatches_event    ON public.tournament_matches (event_id);
CREATE INDEX IF NOT EXISTS idx_tmatches_category ON public.tournament_matches (category_id, round, slot);

-- ── Eventos de partido (goles / tarjetas) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_match_events (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id   uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,  -- denormalizado p/ RLS
    team_id    uuid REFERENCES public.event_teams(id) ON DELETE SET NULL,
    member_id  uuid REFERENCES public.event_team_members(id) ON DELETE SET NULL,
    type       text NOT NULL CHECK (type IN ('goal','own_goal','yellow','red','assist')),
    minute     integer,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tmevents_match ON public.tournament_match_events (match_id);
CREATE INDEX IF NOT EXISTS idx_tmevents_event ON public.tournament_match_events (event_id, type);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.tournament_matches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_match_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tmatches_read ON public.tournament_matches;
CREATE POLICY tmatches_read ON public.tournament_matches
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tmatches_manage ON public.tournament_matches;
CREATE POLICY tmatches_manage ON public.tournament_matches
    FOR ALL TO authenticated
    USING (public.can_manage_event(event_id)) WITH CHECK (public.can_manage_event(event_id));

DROP POLICY IF EXISTS tmevents_read ON public.tournament_match_events;
CREATE POLICY tmevents_read ON public.tournament_match_events
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tmevents_manage ON public.tournament_match_events;
CREATE POLICY tmevents_manage ON public.tournament_match_events
    FOR ALL TO authenticated
    USING (public.can_manage_event(event_id)) WITH CHECK (public.can_manage_event(event_id));

COMMIT;

NOTIFY pgrst, 'reload schema';
