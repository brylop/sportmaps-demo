-- =============================================================================
-- 20261025003647_v2_b2_convocatoria_con_respuesta.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261025003634
-- Objetivo: B2 del contrato docs/specs/entrenador-deportista-v2.md — la
--           convocatoria pide «Va / No va» a la familia (decisiones 4 y 8).
--
--   · Tabla match_callup_responses (una respuesta por convocatoria + deportista).
--   · respond_callup(p_lineup_id, p_child_id, p_athlete_user_id, p_response
--     [, p_unregistered_athlete_id]) → jsonb. Responde la cuenta del deportista:
--       child        → su acudiente (children.parent_id)   — el menor no responde
--       profile      → el propio deportista (cuenta adulta)
--       unregistered → la cuenta vinculada a la ficha (linked_profile_id)
--   · my_callups() → convocatorias de partidos que no han pasado, de mis hijos y mías.
--   · callup_status(p_lineup_id) → por convocado: nombre y respuesta (para el profe).
--   · save_match_roster: NUEVA VERSIÓN (CREATE OR REPLACE, misma firma). Además
--     de lo de antes: borra las respuestas de quien sale de la lista y, si el
--     partido no ha pasado, avisa (notifications, category 'match') a cada cuenta
--     que entra («Convocatoria») o sale («Cambio en la convocatoria»). Un aviso
--     por cuenta: un acudiente con dos hijos convocados recibe UNO con los dos.
--     Re-guardar la misma lista NO vuelve a avisar.
--
-- Depende de 20261025003634 (helper is_linked_unregistered_athlete y la
-- categoría 'match' en notifications_category_check). Igual se re-asegura la
-- categoría acá por si se aplican en otro orden.
--
-- Nota sobre el menor con cuenta propia (subject_type='profile', < 18 años): no
-- hay vínculo profile→acudiente en el esquema, así que responde él mismo. Los
-- menores en children no tienen cuenta y los responde siempre el acudiente.
--
-- RADIO (base viva, 2026-10-25, solo lectura):
--   · match_lineups 'team_match': 5 (51 convocados, 2 escuelas). Partidos
--     programados a futuro: 0 → aplicar NO dispara ningún aviso.
--   · save_match_roster: mismo cuerpo vivo (verificado contra pg_proc) + avisos
--     y limpieza de respuestas. Sin cambios de firma ni de grants.
--   · Tabla nueva: 0 filas.
--
-- VERIFICACIÓN: ver el informe del agente (sesión simulada, BEGIN … ROLLBACK).
--   select proname, pg_get_function_identity_arguments(oid), proacl from pg_proc
--    where proname in ('respond_callup','my_callups','callup_status','save_match_roster','_callup_subject_account');
--   select policyname, cmd, roles, qual from pg_policies where tablename = 'match_callup_responses';
--
-- REVERSA:
--   DROP FUNCTION IF EXISTS public.respond_callup(uuid, uuid, uuid, text, uuid);
--   DROP FUNCTION IF EXISTS public.my_callups();
--   DROP FUNCTION IF EXISTS public.callup_status(uuid);
--   DROP TABLE IF EXISTS public.match_callup_responses;
--   save_match_roster: re-crear el cuerpo de 20260926131340 (§6) tal cual.
--   DROP FUNCTION IF EXISTS public._callup_subject_account(text, uuid);  (después de lo anterior)
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

-- ─── 0. Categoría 'match' (idempotente; ver 20261025003634) ────────────────
DO $$
DECLARE
  v_def  text;
  v_vals text[];
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.notifications'::regclass
     AND c.conname  = 'notifications_category_check';
  IF v_def IS NULL THEN RETURN; END IF;
  -- La base puede guardar el CHECK como ARRAY['a'::text, …] o como literal
  -- '{a,b,…}'::text[]: si 'match' ya figura en cualquiera de los dos, no se toca.
  IF v_def ~ '[{,'']match[,}'']' THEN RETURN; END IF;
  SELECT array_agg(m[1]) INTO v_vals FROM regexp_matches(v_def, '''([^'']+)''', 'g') AS m;
  IF v_vals @> ARRAY['match'] THEN RETURN; END IF;
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_vals
    FROM unnest(COALESCE(v_vals, '{}'::text[]) || ARRAY['match']) AS x;
  ALTER TABLE public.notifications DROP CONSTRAINT notifications_category_check;
  EXECUTE format(
    'ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check CHECK (category = ANY (%L::text[]))',
    v_vals);
END $$;

-- ─── 1. Helper interno: la cuenta que responde/recibe por un deportista ─────
CREATE OR REPLACE FUNCTION public._callup_subject_account(p_subject_type text, p_subject_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE p_subject_type
           WHEN 'child'        THEN (SELECT c.parent_id FROM public.children c WHERE c.id = p_subject_id)
           WHEN 'profile'      THEN p_subject_id
           WHEN 'unregistered' THEN (SELECT ua.linked_profile_id FROM public.unregistered_athletes ua WHERE ua.id = p_subject_id)
         END;
$$;
-- Solo la usan las funciones de este archivo (definer). Los default privileges
-- le darían EXECUTE a authenticated/anon: se revoca explícito (trampa 3).
REVOKE ALL ON FUNCTION public._callup_subject_account(text, uuid) FROM PUBLIC, anon, authenticated;

-- ─── 2. Tabla ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_callup_responses (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id               uuid NOT NULL REFERENCES public.match_lineups(id) ON DELETE CASCADE,
  school_id               uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  child_id                uuid REFERENCES public.children(id) ON DELETE CASCADE,
  athlete_user_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  unregistered_athlete_id uuid REFERENCES public.unregistered_athletes(id) ON DELETE CASCADE,
  response                text NOT NULL CHECK (response IN ('va', 'no_va')),
  responded_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_callup_responses_un_sujeto
    CHECK (num_nonnulls(child_id, athlete_user_id, unregistered_athlete_id) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_match_callup_responses_sujeto
  ON public.match_callup_responses (lineup_id, (COALESCE(child_id, athlete_user_id, unregistered_athlete_id)));
CREATE INDEX IF NOT EXISTS idx_match_callup_responses_school ON public.match_callup_responses (school_id);

ALTER TABLE public.match_callup_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.match_callup_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.match_callup_responses TO authenticated;

DROP POLICY IF EXISTS match_callup_responses_select ON public.match_callup_responses;
CREATE POLICY match_callup_responses_select ON public.match_callup_responses FOR SELECT TO authenticated
  USING (
    (SELECT public.is_platform_admin())
    OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR responded_by = (SELECT auth.uid())
    OR (child_id IS NOT NULL AND public.is_parent_of_child(child_id))
    OR (athlete_user_id IS NOT NULL AND athlete_user_id = (SELECT auth.uid()))
    OR (unregistered_athlete_id IS NOT NULL
        AND unregistered_athlete_id = ANY ((SELECT public.my_linked_unregistered_ids())::uuid[]))
  );

-- ─── 3. respond_callup ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_callup(
  p_lineup_id               uuid,
  p_child_id                uuid,
  p_athlete_user_id         uuid,
  p_response                text,
  p_unregistered_athlete_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_type   text;
  v_sid    uuid;
  l        public.match_lineups%ROWTYPE;
  m        public.match_results%ROWTYPE;
  v_at     timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_response IS NULL OR p_response NOT IN ('va', 'no_va') THEN
    RAISE EXCEPTION 'Respuesta no válida (va | no_va)' USING ERRCODE = '22023';
  END IF;
  IF num_nonnulls(p_child_id, p_athlete_user_id, p_unregistered_athlete_id) <> 1 THEN
    RAISE EXCEPTION 'Indica exactamente un deportista' USING ERRCODE = '22023';
  END IF;
  v_type := CASE WHEN p_child_id IS NOT NULL THEN 'child'
                 WHEN p_athlete_user_id IS NOT NULL THEN 'profile'
                 ELSE 'unregistered' END;
  v_sid  := COALESCE(p_child_id, p_athlete_user_id, p_unregistered_athlete_id);

  -- Decisión 8: responde la cuenta del deportista (acudiente del menor / el adulto
  -- / la cuenta vinculada a la ficha). Nadie más, ni el staff.
  IF public._callup_subject_account(v_type, v_sid) IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'No puedes responder por este deportista' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO l FROM public.match_lineups WHERE id = p_lineup_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convocatoria no encontrada' USING ERRCODE = 'P0002'; END IF;

  PERFORM 1 FROM public.match_lineup_players mlp
   WHERE mlp.lineup_id = p_lineup_id AND mlp.subject_type = v_type AND mlp.subject_id = v_sid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El deportista no está en esta convocatoria' USING ERRCODE = 'P0002';
  END IF;

  IF l.source_type = 'team_match' THEN
    SELECT * INTO m FROM public.match_results WHERE id = l.source_id;
    IF FOUND AND (m.status = 'cancelled'
                  OR m.match_date < (now() AT TIME ZONE 'America/Bogota')::date) THEN
      RAISE EXCEPTION 'Este partido ya no recibe respuestas' USING ERRCODE = '55000';
    END IF;
  END IF;

  INSERT INTO public.match_callup_responses
    (lineup_id, school_id, child_id, athlete_user_id, unregistered_athlete_id, response, responded_by, responded_at)
  VALUES (p_lineup_id, l.school_id, p_child_id, p_athlete_user_id, p_unregistered_athlete_id, p_response, v_uid, now())
  ON CONFLICT (lineup_id, (COALESCE(child_id, athlete_user_id, unregistered_athlete_id)))
  DO UPDATE SET response = EXCLUDED.response, responded_by = EXCLUDED.responded_by, responded_at = now()
  RETURNING responded_at INTO v_at;

  RETURN jsonb_build_object('lineup_id', p_lineup_id, 'subject_type', v_type, 'subject_id', v_sid,
                            'response', p_response, 'responded_at', v_at);
END;
$$;
COMMENT ON FUNCTION public.respond_callup(uuid, uuid, uuid, text, uuid) IS
  'B2 V2: «Va / No va». Responde el acudiente del menor, el deportista adulto o la cuenta '
  'vinculada a la ficha. Partido cancelado o pasado → 55000.';

-- ─── 4. my_callups ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_callups()
RETURNS TABLE (
  lineup_id    uuid,
  match_id     uuid,
  school_id    uuid,
  team_id      uuid,
  team_name    text,
  subject_type text,
  subject_id   uuid,
  athlete_name text,
  role         text,
  opponent     text,
  match_date   date,
  kickoff_at   timestamptz,
  location     text,
  is_home      boolean,
  notes        text,
  response     text,
  responded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH yo AS (SELECT auth.uid() AS uid),
  mios AS (
    SELECT 'child'::text AS st, c.id AS sid, c.full_name AS nombre
      FROM public.children c, yo WHERE c.parent_id = yo.uid
    UNION ALL
    SELECT 'profile', p.id, p.full_name FROM public.profiles p, yo WHERE p.id = yo.uid
    UNION ALL
    SELECT 'unregistered', ua.id, ua.full_name
      FROM public.unregistered_athletes ua, yo WHERE ua.linked_profile_id = yo.uid
  )
  SELECT ml.id, mr.id, ml.school_id, ml.team_id, t.name,
         mlp.subject_type, mlp.subject_id, mios.nombre, mlp.role,
         mr.opponent, mr.match_date, mr.kickoff_at, mr.location, mr.is_home, mr.notes,
         r.response, r.responded_at
    FROM mios
    JOIN public.match_lineup_players mlp ON mlp.subject_type = mios.st AND mlp.subject_id = mios.sid
    JOIN public.match_lineups ml        ON ml.id = mlp.lineup_id AND ml.source_type = 'team_match'
    JOIN public.match_results mr        ON mr.id = ml.source_id
    LEFT JOIN public.teams t            ON t.id = ml.team_id
    LEFT JOIN public.match_callup_responses r
           ON r.lineup_id = ml.id
          AND COALESCE(r.child_id, r.athlete_user_id, r.unregistered_athlete_id) = mlp.subject_id
   WHERE mr.status <> 'cancelled'
     AND mr.match_date >= (now() AT TIME ZONE 'America/Bogota')::date
   ORDER BY mr.match_date, mr.kickoff_at NULLS LAST, mios.nombre;
$$;
COMMENT ON FUNCTION public.my_callups() IS
  'B2 V2: convocatorias de partidos que no han pasado, de mis hijos, mías y de la ficha '
  'vinculada a mi cuenta, con mi respuesta (o NULL).';

-- ─── 5. callup_status (para el profe) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.callup_status(p_lineup_id uuid)
RETURNS TABLE (
  subject_type     text,
  subject_id       uuid,
  athlete_name     text,
  role             text,
  has_account      boolean,
  response         text,
  responded_at     timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_school uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT ml.school_id INTO v_school FROM public.match_lineups ml WHERE ml.id = p_lineup_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Convocatoria no encontrada' USING ERRCODE = 'P0002'; END IF;
  IF NOT (v_school = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT mlp.subject_type, mlp.subject_id,
         COALESCE(c.full_name, p.full_name, ua.full_name, 'Deportista')::text,
         mlp.role,
         (public._callup_subject_account(mlp.subject_type, mlp.subject_id) IS NOT NULL),
         r.response, r.responded_at
    FROM public.match_lineup_players mlp
    LEFT JOIN public.children c              ON mlp.subject_type = 'child'        AND c.id  = mlp.subject_id
    LEFT JOIN public.profiles p              ON mlp.subject_type = 'profile'      AND p.id  = mlp.subject_id
    LEFT JOIN public.unregistered_athletes ua ON mlp.subject_type = 'unregistered' AND ua.id = mlp.subject_id
    LEFT JOIN public.match_callup_responses r
           ON r.lineup_id = mlp.lineup_id
          AND COALESCE(r.child_id, r.athlete_user_id, r.unregistered_athlete_id) = mlp.subject_id
   WHERE mlp.lineup_id = p_lineup_id
   ORDER BY (mlp.role = 'bench'), 3;
END;
$$;
COMMENT ON FUNCTION public.callup_status(uuid) IS
  'B2 V2: por convocado, nombre y respuesta (NULL = no ha respondido). has_account=false: '
  'no hay cuenta que pueda responder (menor sin acudiente vinculado / ficha sin cuenta). Solo staff.';

-- ─── 6. save_match_roster — nueva versión con avisos ────────────────────────
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
  v_antes  text[];
  v_ahora  text[];
  v_cuando text;
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

  -- Lista de antes (clave 'tipo:id') para saber quién entra y quién sale.
  SELECT COALESCE(array_agg(mlp.subject_type || ':' || mlp.subject_id), '{}'::text[])
    INTO v_antes
    FROM public.match_lineup_players mlp WHERE mlp.lineup_id = v_lineup;

  DELETE FROM public.match_lineup_players WHERE lineup_id = v_lineup;

  INSERT INTO public.match_lineup_players (lineup_id, school_id, subject_type, subject_id, role, minutes_played, position_code, jersey_number)
  SELECT v_lineup, m.school_id, x->>'subject_type', (x->>'subject_id')::uuid,
         COALESCE(NULLIF(x->>'role', ''), 'starter'), NULLIF(x->>'minutes_played', '')::integer,
         NULLIF(x->>'position_code', ''), NULLIF(x->>'jersey_number', '')::integer
    FROM jsonb_array_elements(COALESCE(p_players, '[]'::jsonb)) x;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  SELECT COALESCE(array_agg(mlp.subject_type || ':' || mlp.subject_id), '{}'::text[])
    INTO v_ahora
    FROM public.match_lineup_players mlp WHERE mlp.lineup_id = v_lineup;

  -- Quien sale de la lista pierde su respuesta (si vuelve, responde de nuevo).
  DELETE FROM public.match_callup_responses r
   WHERE r.lineup_id = v_lineup
     AND NOT EXISTS (SELECT 1 FROM public.match_lineup_players mlp
                      WHERE mlp.lineup_id = v_lineup
                        AND mlp.subject_id = COALESCE(r.child_id, r.athlete_user_id, r.unregistered_athlete_id));

  -- Avisos: solo partidos que no han pasado ni se cancelaron. Un fallo del
  -- aviso nunca tumba la convocatoria.
  IF m.status <> 'cancelled' AND m.match_date >= (now() AT TIME ZONE 'America/Bogota')::date THEN
    BEGIN
      v_cuando := to_char(m.match_date, 'DD/MM')
               || COALESCE(' a las ' || to_char(m.kickoff_at AT TIME ZONE 'America/Bogota', 'HH24:MI'), '')
               || COALESCE(', en ' || NULLIF(btrim(m.location), ''), '');

      WITH cambios AS (
        SELECT 'entra'::text AS tipo, k FROM unnest(v_ahora) k WHERE NOT (k = ANY (v_antes))
        UNION ALL
        SELECT 'sale', k FROM unnest(v_antes) k WHERE NOT (k = ANY (v_ahora))
      ),
      sujetos AS (
        SELECT c.tipo, split_part(c.k, ':', 1) AS st, split_part(c.k, ':', 2)::uuid AS sid
          FROM cambios c
      ),
      con_cuenta AS (
        SELECT s.tipo, s.st, s.sid,
               public._callup_subject_account(s.st, s.sid) AS uid,
               split_part(btrim(COALESCE(ch.full_name, p.full_name, ua.full_name, 'Tu deportista')), ' ', 1) AS nombre
          FROM sujetos s
          LEFT JOIN public.children ch              ON s.st = 'child'        AND ch.id = s.sid
          LEFT JOIN public.profiles p               ON s.st = 'profile'      AND p.id  = s.sid
          LEFT JOIN public.unregistered_athletes ua ON s.st = 'unregistered' AND ua.id = s.sid
      )
      INSERT INTO public.notifications (user_id, school_id, type, category, title, message, link, data)
      SELECT cc.uid, m.school_id, 'info', 'match',
             CASE cc.tipo WHEN 'entra' THEN '⚽ Convocatoria: vs ' || m.opponent
                          ELSE '⚽ Cambio en la convocatoria: vs ' || m.opponent END,
             CASE cc.tipo
               WHEN 'entra' THEN string_agg(cc.nombre, ', ' ORDER BY cc.nombre)
                                 || CASE WHEN count(*) > 1 THEN ' están convocados' ELSE ' está convocado' END
                                 || ' para el partido del ' || v_cuando || '. Cuéntanos si va.'
               ELSE string_agg(cc.nombre, ', ' ORDER BY cc.nombre)
                    || ' ya no ' || CASE WHEN count(*) > 1 THEN 'están' ELSE 'está' END
                    || ' en la convocatoria del partido del ' || v_cuando || '.'
             END,
             '/calendar',
             jsonb_build_object('lineup_id', v_lineup, 'match_id', p_match, 'op', cc.tipo,
                                'subjects', jsonb_agg(jsonb_build_object('subject_type', cc.st, 'subject_id', cc.sid)))
        FROM con_cuenta cc
       WHERE cc.uid IS NOT NULL AND cc.uid <> v_uid
       GROUP BY cc.uid, cc.tipo;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'save_match_roster: aviso de convocatoria falló (%): %', SQLSTATE, SQLERRM;
    END;
  END IF;

  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_callup(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_callups()                                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.callup_status(uuid)                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_match_roster(uuid, jsonb)               FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_callup(uuid, uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_callups()                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.callup_status(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_match_roster(uuid, jsonb)               TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
