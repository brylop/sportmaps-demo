-- =============================================================================
-- 20260926131340_partidos_f1_school_id_status_criterios_rls_rpcs.sql
-- Fase 1 del spec docs/specs/partidos-registro-y-evaluacion-por-jugador.md
-- Plan aprobado: docs/plan-partidos-f1-db-rls-rpc.md (2026-09-26, «aplícala»).
--
-- 1. match_results: school_id (backfill + trigger «el equipo manda»), status,
--    kickoff_at, location, calendar_event_id, tournament_match_id,
--    evaluation_published_at, auditoría. 4 policies nuevas en lugar de las 5 vivas.
-- 2. training_microcycle_days.match_id · school_settings.share_match_evaluations.
-- 3. school_metric_definitions (criterios por escuela; solo admin escribe).
-- 4. performance_entries: índice único para context_type='competition' y la
--    policy de lectura REEMPLAZADA — antes cualquier miembro (padres incluidos)
--    leía todas las evaluaciones de la escuela; ahora staff todo, familia lo
--    suyo, y lo de partido solo si está publicado y la escuela lo comparte.
-- 5. RPCs: create_match, update_match, save_match_roster, submit_match_evaluation,
--    publish_match_evaluation, link_day_to_match, seed_school_match_criteria.
--
-- Diferencia con el plan: performance_entries.value es NOT NULL, así que un
-- criterio de escala 'text' se guarda con value = 0 y el texto en notes. Los
-- promedios excluyen los criterios 'text' por su escala.
--
-- Rollback de policies (texto vivo del 2026-09-26) al final, comentado.
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- ─── 1. match_results ───────────────────────────────────────────────────────
ALTER TABLE public.match_results
  ADD COLUMN IF NOT EXISTS school_id               uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status                  text NOT NULL DEFAULT 'played',
  ADD COLUMN IF NOT EXISTS kickoff_at              timestamptz,
  ADD COLUMN IF NOT EXISTS location                text,
  ADD COLUMN IF NOT EXISTS calendar_event_id       uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tournament_match_id     uuid REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evaluation_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at              timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.match_results DROP CONSTRAINT IF EXISTS match_results_status_check;
ALTER TABLE public.match_results
  ADD CONSTRAINT match_results_status_check CHECK (status IN ('scheduled', 'played', 'cancelled'));

UPDATE public.match_results mr SET school_id = t.school_id
  FROM public.teams t WHERE t.id = mr.team_id AND mr.school_id IS NULL;
UPDATE public.match_results
   SET status = CASE WHEN home_score IS NOT NULL AND away_score IS NOT NULL THEN 'played' ELSE 'scheduled' END;
ALTER TABLE public.match_results ALTER COLUMN school_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_results_calendar_event
  ON public.match_results (calendar_event_id) WHERE calendar_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_results_school_date ON public.match_results (school_id, match_date DESC);
CREATE INDEX IF NOT EXISTS idx_match_results_team_date   ON public.match_results (team_id, match_date DESC);

CREATE OR REPLACE FUNCTION public.match_results_fill_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  SELECT t.school_id INTO NEW.school_id FROM public.teams t WHERE t.id = NEW.team_id;
  IF NEW.school_id IS NULL THEN
    RAISE EXCEPTION 'El equipo % no existe', NEW.team_id USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.match_results_fill_school() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_match_results_fill_school ON public.match_results;
CREATE TRIGGER trg_match_results_fill_school
  BEFORE INSERT OR UPDATE ON public.match_results
  FOR EACH ROW EXECUTE FUNCTION public.match_results_fill_school();

-- ─── 2. Enlaces y flag ──────────────────────────────────────────────────────
ALTER TABLE public.training_microcycle_days
  ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.match_results(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_training_microcycle_days_match ON public.training_microcycle_days (match_id);

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS share_match_evaluations boolean NOT NULL DEFAULT false;

-- ─── 3. school_metric_definitions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_metric_definitions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  metric_key           text NOT NULL CHECK (metric_key ~ '^[a-z0-9_]{2,60}$'),
  display_name         text NOT NULL,
  description          text,
  scale                text NOT NULL CHECK (scale IN ('scale_1_5', 'scale_1_10', 'yes_no', 'number', 'text')),
  unit                 text,
  min_value            numeric,
  max_value            numeric,
  options              jsonb,
  applies_to           text NOT NULL DEFAULT 'match' CHECK (applies_to IN ('match', 'training', 'both')),
  sort_order           integer NOT NULL DEFAULT 0,
  is_active            boolean NOT NULL DEFAULT true,
  source_definition_id uuid REFERENCES public.sport_metric_definitions(id) ON DELETE SET NULL,
  created_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, metric_key)
);
CREATE INDEX IF NOT EXISTS idx_school_metric_definitions_school
  ON public.school_metric_definitions (school_id, is_active, sort_order);

ALTER TABLE public.school_metric_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.school_metric_definitions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.school_metric_definitions TO authenticated;

DROP POLICY IF EXISTS smd_select ON public.school_metric_definitions;
DROP POLICY IF EXISTS smd_insert ON public.school_metric_definitions;
DROP POLICY IF EXISTS smd_update ON public.school_metric_definitions;
DROP POLICY IF EXISTS smd_delete ON public.school_metric_definitions;

CREATE POLICY smd_select ON public.school_metric_definitions FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin())
         OR school_id = ANY ((SELECT public.calendar_family_school_ids())::uuid[]));
CREATE POLICY smd_insert ON public.school_metric_definitions FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_platform_admin())
              OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]));
CREATE POLICY smd_update ON public.school_metric_definitions FOR UPDATE TO authenticated
  USING ((SELECT public.is_platform_admin())
         OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]))
  WITH CHECK ((SELECT public.is_platform_admin())
              OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]));
CREATE POLICY smd_delete ON public.school_metric_definitions FOR DELETE TO authenticated
  USING ((SELECT public.is_platform_admin())
         OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]));

-- ─── 4. performance_entries ─────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS performance_entries_competition_unique
  ON public.performance_entries (subject_type, subject_id, metric_key, context_id)
  WHERE context_type = 'competition';

CREATE OR REPLACE FUNCTION public.match_evaluation_visible_to_family(p_match uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.match_results mr
      JOIN public.school_settings ss ON ss.school_id = mr.school_id
     WHERE mr.id = p_match
       AND mr.evaluation_published_at IS NOT NULL
       AND ss.share_match_evaluations
  );
$$;
REVOKE ALL ON FUNCTION public.match_evaluation_visible_to_family(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_evaluation_visible_to_family(uuid) TO authenticated;

DROP POLICY IF EXISTS performance_entries_select_own ON public.performance_entries;
DROP POLICY IF EXISTS performance_entries_select     ON public.performance_entries;
CREATE POLICY performance_entries_select ON public.performance_entries FOR SELECT TO authenticated
  USING (
    (SELECT public.is_platform_admin())
    OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (
      ((subject_type = 'profile' AND subject_id = (SELECT auth.uid()))
       OR (subject_type = 'child' AND public.is_parent_of_child(subject_id)))
      AND (context_type <> 'competition' OR public.match_evaluation_visible_to_family(context_id))
    )
  );

-- ─── 5. Policies de match_results ───────────────────────────────────────────
DROP POLICY IF EXISTS match_results_admin_all ON public.match_results;
DROP POLICY IF EXISTS match_results_select    ON public.match_results;
DROP POLICY IF EXISTS match_results_insert    ON public.match_results;
DROP POLICY IF EXISTS match_results_update    ON public.match_results;
DROP POLICY IF EXISTS match_results_delete    ON public.match_results;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_results_select ON public.match_results FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin())
         OR school_id = ANY ((SELECT public.user_school_ids())::uuid[])
         OR team_id   = ANY ((SELECT public.calendar_family_team_ids())::uuid[]));
CREATE POLICY match_results_insert ON public.match_results FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_platform_admin())
              OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));
CREATE POLICY match_results_update ON public.match_results FOR UPDATE TO authenticated
  USING ((SELECT public.is_platform_admin())
         OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]))
  WITH CHECK ((SELECT public.is_platform_admin())
              OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));
CREATE POLICY match_results_delete ON public.match_results FOR DELETE TO authenticated
  USING ((SELECT public.is_platform_admin())
         OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));

-- ─── 6. RPCs ────────────────────────────────────────────────────────────────

-- create_match: partido (+ evento de calendario + enlace al día) en una transacción.
CREATE OR REPLACE FUNCTION public.create_match(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_team    uuid := NULLIF(p->>'team_id', '')::uuid;
  v_school  uuid;
  v_date    date := NULLIF(p->>'match_date', '')::date;
  v_kickoff timestamptz := NULLIF(p->>'kickoff_at', '')::timestamptz;
  v_home    integer := NULLIF(p->>'home_score', '')::integer;
  v_away    integer := NULLIF(p->>'away_score', '')::integer;
  v_opp     text := NULLIF(trim(p->>'opponent'), '');
  v_event   uuid := NULLIF(p->>'calendar_event_id', '')::uuid;
  v_day     uuid := NULLIF(p->>'microcycle_day_id', '')::uuid;
  v_start   timestamptz;
  v_match   uuid;
  v_n       integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF v_team IS NULL OR v_opp IS NULL OR (v_date IS NULL AND v_kickoff IS NULL) THEN
    RAISE EXCEPTION 'Faltan categoría, rival o fecha' USING ERRCODE = '22023';
  END IF;
  SELECT school_id INTO v_school FROM public.teams WHERE id = v_team;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Categoría no válida' USING ERRCODE = '22023'; END IF;
  IF NOT (v_school = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;

  v_date  := COALESCE(v_date, (v_kickoff AT TIME ZONE 'America/Bogota')::date);
  v_start := COALESCE(v_kickoff, (v_date + time '15:00') AT TIME ZONE 'America/Bogota');

  IF v_event IS NOT NULL THEN
    PERFORM 1 FROM public.calendar_events WHERE id = v_event AND school_id = v_school;
    IF NOT FOUND THEN RAISE EXCEPTION 'Evento de calendario no válido' USING ERRCODE = '22023'; END IF;
  ELSIF COALESCE((p->>'create_calendar_event')::boolean, false) THEN
    INSERT INTO public.calendar_events (user_id, title, description, event_type, start_time, end_time, location, all_day, team_id, school_id)
    VALUES (v_uid, 'Partido vs ' || v_opp, NULLIF(p->>'notes', ''), 'match', v_start, v_start + interval '2 hours',
            NULLIF(p->>'location', ''), false, v_team, v_school)
    RETURNING id INTO v_event;
  END IF;

  INSERT INTO public.match_results (team_id, opponent, home_score, away_score, is_home, match_date, match_type, notes,
                                    status, kickoff_at, location, calendar_event_id, tournament_match_id, created_by, updated_by)
  VALUES (v_team, v_opp, v_home, v_away, COALESCE((p->>'is_home')::boolean, true), v_date, NULLIF(p->>'match_type', ''),
          NULLIF(p->>'notes', ''),
          CASE WHEN v_home IS NOT NULL AND v_away IS NOT NULL THEN 'played' ELSE 'scheduled' END,
          v_kickoff, NULLIF(p->>'location', ''), v_event, NULLIF(p->>'tournament_match_id', '')::uuid, v_uid, v_uid)
  RETURNING id INTO v_match;

  IF v_day IS NOT NULL THEN
    UPDATE public.training_microcycle_days SET match_id = v_match WHERE id = v_day AND school_id = v_school;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE EXCEPTION 'Día del mesociclo no válido' USING ERRCODE = '22023'; END IF;
  END IF;

  RETURN jsonb_build_object('match_id', v_match, 'calendar_event_id', v_event);
END;
$$;

-- update_match: solo las claves presentes; mueve el evento si cambia la hora.
CREATE OR REPLACE FUNCTION public.update_match(p_match uuid, p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m     public.match_results%ROWTYPE;
  v_new_start timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO m FROM public.match_results WHERE id = p_match FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado' USING ERRCODE = '02000'; END IF;
  IF NOT (m.school_id = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;
  IF p ? 'status' AND (p->>'status') NOT IN ('scheduled', 'played', 'cancelled') THEN
    RAISE EXCEPTION 'Estado no válido' USING ERRCODE = '22023';
  END IF;

  UPDATE public.match_results SET
    opponent   = CASE WHEN p ? 'opponent'   THEN COALESCE(NULLIF(trim(p->>'opponent'), ''), opponent) ELSE opponent END,
    match_date = CASE WHEN p ? 'match_date' THEN COALESCE(NULLIF(p->>'match_date', '')::date, match_date) ELSE match_date END,
    kickoff_at = CASE WHEN p ? 'kickoff_at' THEN NULLIF(p->>'kickoff_at', '')::timestamptz ELSE kickoff_at END,
    is_home    = CASE WHEN p ? 'is_home'    THEN COALESCE((p->>'is_home')::boolean, is_home) ELSE is_home END,
    match_type = CASE WHEN p ? 'match_type' THEN NULLIF(p->>'match_type', '') ELSE match_type END,
    location   = CASE WHEN p ? 'location'   THEN NULLIF(p->>'location', '') ELSE location END,
    notes      = CASE WHEN p ? 'notes'      THEN NULLIF(p->>'notes', '') ELSE notes END,
    home_score = CASE WHEN p ? 'home_score' THEN NULLIF(p->>'home_score', '')::integer ELSE home_score END,
    away_score = CASE WHEN p ? 'away_score' THEN NULLIF(p->>'away_score', '')::integer ELSE away_score END,
    status     = CASE WHEN p ? 'status' THEN p->>'status' ELSE status END,
    updated_by = v_uid
  WHERE id = p_match
  RETURNING * INTO m;

  -- Con los dos marcadores, un partido programado pasa a jugado.
  IF m.status = 'scheduled' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL AND NOT (p ? 'status') THEN
    UPDATE public.match_results SET status = 'played' WHERE id = p_match RETURNING * INTO m;
  END IF;

  IF m.calendar_event_id IS NOT NULL AND (p ? 'kickoff_at' OR p ? 'match_date') THEN
    v_new_start := COALESCE(m.kickoff_at, (m.match_date + time '15:00') AT TIME ZONE 'America/Bogota');
    UPDATE public.calendar_events
       SET end_time = v_new_start + (end_time - start_time), start_time = v_new_start, updated_at = now()
     WHERE id = m.calendar_event_id;
  END IF;

  RETURN to_jsonb(m);
END;
$$;

-- save_match_roster: convocados (borrar e insertar dentro de la misma transacción).
CREATE OR REPLACE FUNCTION public.save_match_roster(p_match uuid, p_players jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  m        public.match_results%ROWTYPE;
  v_lineup uuid;
  v_n      integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO m FROM public.match_results WHERE id = p_match;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado' USING ERRCODE = '02000'; END IF;
  IF NOT (m.school_id = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(COALESCE(p_players, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_players debe ser un arreglo' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.match_lineups (school_id, team_id, source_type, source_id, created_by)
  VALUES (m.school_id, m.team_id, 'team_match', p_match, v_uid)
  ON CONFLICT (source_type, source_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_lineup;

  DELETE FROM public.match_lineup_players WHERE lineup_id = v_lineup;

  INSERT INTO public.match_lineup_players (lineup_id, school_id, subject_type, subject_id, role, minutes_played, position_code, jersey_number)
  SELECT v_lineup, m.school_id, x->>'subject_type', (x->>'subject_id')::uuid,
         COALESCE(NULLIF(x->>'role', ''), 'starter'), NULLIF(x->>'minutes_played', '')::integer,
         NULLIF(x->>'position_code', ''), NULLIF(x->>'jersey_number', '')::integer
    FROM jsonb_array_elements(COALESCE(p_players, '[]'::jsonb)) x;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- submit_match_evaluation: upsert por (jugador, criterio); gana el último.
CREATE OR REPLACE FUNCTION public.submit_match_evaluation(p_match uuid, p_entries jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  m     public.match_results%ROWTYPE;
  v_n   integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO m FROM public.match_results WHERE id = p_match;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado' USING ERRCODE = '02000'; END IF;
  IF NOT (m.school_id = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(COALESCE(p_entries, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_entries debe ser un arreglo' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.performance_entries (school_id, subject_type, subject_id, metric_key, value, context_type, context_id, recorded_by, notes)
  SELECT m.school_id, x->>'subject_type', (x->>'subject_id')::uuid, x->>'metric_key',
         COALESCE(NULLIF(x->>'value', '')::numeric, 0), 'competition', p_match, v_uid, NULLIF(x->>'notes', '')
    FROM jsonb_array_elements(COALESCE(p_entries, '[]'::jsonb)) x
  ON CONFLICT (subject_type, subject_id, metric_key, context_id) WHERE context_type = 'competition'
  DO UPDATE SET value = EXCLUDED.value, notes = EXCLUDED.notes, recorded_by = EXCLUDED.recorded_by, recorded_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF m.status = 'scheduled' THEN
    UPDATE public.match_results SET status = 'played', updated_by = v_uid WHERE id = p_match;
  END IF;
  RETURN v_n;
END;
$$;

-- publish_match_evaluation: abre o cierra la evaluación a las familias (D7).
CREATE OR REPLACE FUNCTION public.publish_match_evaluation(p_match uuid, p_publish boolean)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school uuid;
  v_at  timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT school_id INTO v_school FROM public.match_results WHERE id = p_match;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Partido no encontrado' USING ERRCODE = '02000'; END IF;
  IF NOT (v_school = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;
  UPDATE public.match_results
     SET evaluation_published_at = CASE WHEN p_publish THEN now() END, updated_by = v_uid
   WHERE id = p_match
  RETURNING evaluation_published_at INTO v_at;
  RETURN v_at;
END;
$$;

-- link_day_to_match: enlaza (o desenlaza con NULL) un día del mesociclo.
CREATE OR REPLACE FUNCTION public.link_day_to_match(p_day uuid, p_match uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT school_id INTO v_school FROM public.training_microcycle_days WHERE id = p_day;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Día no encontrado' USING ERRCODE = '02000'; END IF;
  IF NOT (v_school = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;
  IF p_match IS NOT NULL THEN
    PERFORM 1 FROM public.match_results WHERE id = p_match AND school_id = v_school;
    IF NOT FOUND THEN RAISE EXCEPTION 'El partido no es de esta escuela' USING ERRCODE = '22023'; END IF;
  END IF;
  UPDATE public.training_microcycle_days SET match_id = p_match WHERE id = p_day;
END;
$$;

-- seed_school_match_criteria: 7 criterios por defecto (idempotente). Solo admin.
CREATE OR REPLACE FUNCTION public.seed_school_match_criteria(p_school uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n   integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT (p_school = ANY (public.user_admin_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Solo la administración de la escuela define los criterios' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.school_metric_definitions (school_id, metric_key, display_name, scale, min_value, max_value, applies_to, sort_order, created_by)
  VALUES
    (p_school, 'actitud',      'Actitud y compromiso', 'scale_1_5', 1, 5, 'both', 10, v_uid),
    (p_school, 'tecnica',      'Técnica',              'scale_1_5', 1, 5, 'both', 20, v_uid),
    (p_school, 'decisiones',   'Toma de decisiones',   'scale_1_5', 1, 5, 'both', 30, v_uid),
    (p_school, 'fisico',       'Físico',               'scale_1_5', 1, 5, 'both', 40, v_uid),
    (p_school, 'comunicacion', 'Comunicación',         'scale_1_5', 1, 5, 'both', 50, v_uid),
    (p_school, 'rol',          'Cumplimiento del rol', 'scale_1_5', 1, 5, 'match', 60, v_uid),
    (p_school, 'comentario',   'Comentario del coach', 'text',      NULL, NULL, 'both', 90, v_uid)
  ON CONFLICT (school_id, metric_key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- Grants: el default privilege del esquema da EXECUTE a authenticated y anon;
-- se revoca explícito de anon y PUBLIC y se otorga solo a authenticated.
REVOKE ALL ON FUNCTION public.create_match(jsonb)                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_match(uuid, jsonb)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_match_roster(uuid, jsonb)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_match_evaluation(uuid, jsonb)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_match_evaluation(uuid, boolean)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_day_to_match(uuid, uuid)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_school_match_criteria(uuid)             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_match(jsonb)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_match(uuid, jsonb)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_match_roster(uuid, jsonb)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_match_evaluation(uuid, jsonb)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_match_evaluation(uuid, boolean)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_day_to_match(uuid, uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_school_match_criteria(uuid)          TO authenticated;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- ROLLBACK de policies (texto vivo al 2026-09-26):
--
-- DROP POLICY IF EXISTS performance_entries_select ON public.performance_entries;
-- CREATE POLICY performance_entries_select_own ON public.performance_entries FOR SELECT
--   USING (((subject_type = 'profile') AND (subject_id = auth.uid()))
--       OR ((subject_type = 'child') AND is_parent_of_child(subject_id))
--       OR (school_id = ANY (user_school_ids())));
--
-- match_results (5 policies, TO public):
--   match_results_admin_all FOR ALL
--     USING/WITH CHECK (EXISTS (SELECT 1 FROM teams WHERE teams.id = match_results.team_id AND is_school_admin(teams.school_id)))
--   match_results_select FOR SELECT
--     USING (EXISTS (SELECT 1 FROM teams t JOIN school_members sm ON sm.school_id = t.school_id
--            WHERE t.id = match_results.team_id AND sm.profile_id = auth.uid() AND sm.status = 'active') OR is_platform_admin())
--   match_results_insert FOR INSERT WITH CHECK (mismo EXISTS + sm.role IN (owner,admin,staff,coach,super_admin,school_admin)) OR is_platform_admin())
--   match_results_update FOR UPDATE USING (mismo EXISTS + roles owner,admin,staff,coach,super_admin,school_admin) OR is_platform_admin())
--   match_results_delete FOR DELETE USING (mismo EXISTS + roles owner,admin,staff,super_admin,school_admin) OR is_platform_admin())
-- =============================================================================
