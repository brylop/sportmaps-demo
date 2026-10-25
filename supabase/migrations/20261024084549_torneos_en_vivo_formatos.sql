-- =============================================================================
-- 20261024084549_torneos_en_vivo_formatos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-24   Versión anterior: 20261023202219
-- Objetivo: torneos en vivo para todos los deportes (spec docs/specs/torneos-en-vivo-multideporte-plan.md)
--   · Tres formatos independientes por torneo: liga, copa y grupos + fase final.
--   · Estado «live» en los partidos, marcador por modelo (goles / sets) en `live_state`.
--   · Log auditado e idempotente de acciones + anotadores sin cuenta (token con hash).
--   · Todo OPT-IN: live_enabled = false y scoring_config NULL = comportamiento de hoy.
-- Seguridad: nada para anon/authenticated; todo pasa por el BFF (service_role).
-- =============================================================================

BEGIN;

-- ── events: interruptor en vivo, reglas de marcador, reglas del formato ──────
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS live_enabled   boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS scoring_config jsonb,
    ADD COLUMN IF NOT EXISTS format_config  jsonb,
    ADD COLUMN IF NOT EXISTS stream_url     text;

-- ── tournament_matches: estado live, fase, grupo, referencias, versión ───────
DO $$
DECLARE c text;
BEGIN
    SELECT conname INTO c
      FROM pg_constraint
     WHERE conrelid = 'public.tournament_matches'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%scheduled%';
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.tournament_matches DROP CONSTRAINT %I', c);
    END IF;
END $$;

ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_status_check
    CHECK (status IN ('scheduled','live','played','walkover','cancelled'));

ALTER TABLE public.tournament_matches
    ADD COLUMN IF NOT EXISTS stage            text NOT NULL DEFAULT 'league',
    ADD COLUMN IF NOT EXISTS group_label      text,
    ADD COLUMN IF NOT EXISTS home_ref         text,
    ADD COLUMN IF NOT EXISTS away_ref         text,
    ADD COLUMN IF NOT EXISTS court            text,
    ADD COLUMN IF NOT EXISTS started_at       timestamptz,
    ADD COLUMN IF NOT EXISTS finished_at      timestamptz,
    ADD COLUMN IF NOT EXISTS version          integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS live_state       jsonb,
    ADD COLUMN IF NOT EXISTS scorer_ref       text,
    ADD COLUMN IF NOT EXISTS scorer_label     text,
    ADD COLUMN IF NOT EXISTS scorer_taken_at  timestamptz,
    ADD COLUMN IF NOT EXISTS stream_url       text;

ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_stage_check
    CHECK (stage IN ('league','group','knockout','third_place'));

-- Las copas ya generadas eran todas de eliminación directa.
UPDATE public.tournament_matches m
   SET stage = 'knockout'
  FROM public.events e
 WHERE e.id = m.event_id AND e.competition_format = 'copa' AND m.stage = 'league';

CREATE INDEX IF NOT EXISTS idx_tmatches_event_status ON public.tournament_matches (event_id, status);
CREATE INDEX IF NOT EXISTS idx_tmatches_stage        ON public.tournament_matches (event_id, category_id, stage, round, slot);

-- ── Log de acciones: auditoría + idempotencia por client_action_id ───────────
CREATE TABLE IF NOT EXISTS public.tournament_match_log (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id         uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    event_id         uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    actor_type       text NOT NULL CHECK (actor_type IN ('user','scorekeeper','system')),
    actor_id         text,
    action           text NOT NULL,
    before_state     jsonb,
    after_state      jsonb,
    client_action_id text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tmlog_match_client_action
    ON public.tournament_match_log (match_id, client_action_id)
    WHERE client_action_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tmlog_match ON public.tournament_match_log (match_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tmlog_event ON public.tournament_match_log (event_id, created_at);

-- ── Anotadores sin cuenta (enlace/QR): solo el hash del token ────────────────
CREATE TABLE IF NOT EXISTS public.tournament_scorekeepers (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    label        text NOT NULL,
    court        text,
    token_hash   text NOT NULL,
    expires_at   timestamptz NOT NULL,
    revoked_at   timestamptz,
    last_used_at timestamptz,
    created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tscorekeepers_token ON public.tournament_scorekeepers (token_hash);
CREATE INDEX IF NOT EXISTS idx_tscorekeepers_event ON public.tournament_scorekeepers (event_id);

-- ── RLS: cerrado. El BFF (service_role) es el único que escribe y lee ────────
ALTER TABLE public.tournament_match_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_scorekeepers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tournament_match_log    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.tournament_scorekeepers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tournament_match_log    TO service_role;
GRANT ALL ON public.tournament_scorekeepers TO service_role;

-- ── RPC transaccional: estado + log en una sola transacción ──────────────────
-- Optimista por versión; un reintento con el mismo client_action_id no se aplica dos veces.
CREATE OR REPLACE FUNCTION public.apply_tournament_match_action(
    p_match_id         uuid,
    p_expected_version integer,
    p_status           text,
    p_live_state       jsonb,
    p_home_score       integer,
    p_away_score       integer,
    p_started_at       timestamptz,
    p_finished_at      timestamptz,
    p_scorer_ref       text,
    p_scorer_label     text,
    p_actor_type       text,
    p_actor_id         text,
    p_action           text,
    p_client_action_id text,
    p_before           jsonb,
    p_after            jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_version integer;
    v_event   uuid;
BEGIN
    SELECT version, event_id INTO v_version, v_event
      FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    IF p_client_action_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.tournament_match_log
         WHERE match_id = p_match_id AND client_action_id = p_client_action_id
    ) THEN
        RETURN jsonb_build_object('duplicate', true, 'version', v_version);
    END IF;

    IF v_version <> p_expected_version THEN
        RETURN jsonb_build_object('error', 'version_conflict', 'version', v_version);
    END IF;

    UPDATE public.tournament_matches
       SET status          = p_status,
           live_state      = p_live_state,
           home_score      = p_home_score,
           away_score      = p_away_score,
           started_at      = p_started_at,
           finished_at     = p_finished_at,
           scorer_ref      = p_scorer_ref,
           scorer_label    = p_scorer_label,
           scorer_taken_at = CASE WHEN p_scorer_ref IS DISTINCT FROM scorer_ref THEN now() ELSE scorer_taken_at END,
           version         = v_version + 1,
           updated_at      = now()
     WHERE id = p_match_id;

    INSERT INTO public.tournament_match_log
        (match_id, event_id, actor_type, actor_id, action, before_state, after_state, client_action_id)
    VALUES
        (p_match_id, v_event, p_actor_type, p_actor_id, p_action, p_before, p_after, p_client_action_id);

    RETURN jsonb_build_object('ok', true, 'version', v_version + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_tournament_match_action(uuid, integer, text, jsonb, integer, integer, timestamptz, timestamptz, text, text, text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_tournament_match_action(uuid, integer, text, jsonb, integer, integer, timestamptz, timestamptz, text, text, text, text, text, text, jsonb, jsonb) TO service_role;

COMMIT;
