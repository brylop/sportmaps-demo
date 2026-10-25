-- =============================================================================
-- 20261025013621_v2_b7_alcance_y_validaciones.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261025003712
-- Objetivo: arreglos de la revisión de código del Entrenador/Deportista V2
--           (docs/specs/entrenador-deportista-v2.md) sobre B1, B2, B3 y B5.
--           Las migraciones 20261025003634…003712 ya están aplicadas y no se
--           tocan: todo va aquí, con CREATE OR REPLACE y la MISMA firma.
--
--   A1 team_payment_status: hoy cualquier staff de la escuela consulta
--      cualquier equipo. Ahora, si quien llama NO es administración
--      (user_admin_school_ids / plataforma), el equipo tiene que ser suyo
--      (user_coached_team_ids(), el alcance del coach de 20261010201426) →
--      si no, 42501. Y si la escuela tiene school_settings.coach_hide_financial_info
--      = true, al entrenador se le devuelven 0 filas (sin error).
--   B2 callup_status: mismo alcance por match_lineups.team_id (sin equipo →
--      solo administración).
--   B1 give_kudos: el entrenador solo felicita a deportistas de SUS equipos.
--      «Del equipo» = mismo plantel que team_payment_status /
--      calendar_event_recipients: inscripción active/pending/paused en el
--      equipo (child_id / user_id / unregistered_athlete_id) o menor con
--      children.team_id (activo).
--   M2 save_match_roster: p_players solo admite sujetos de la escuela del
--      partido (children.school_id o inscripción; perfil con inscripción o
--      membresía athlete activa; ficha unregistered_athletes.school_id). Un
--      ajeno RECHAZA la llamada (22023) antes de tocar la convocatoria, la
--      lista o los avisos. El resto del cuerpo es el vivo (B2) sin cambios.
--   M1 menor con cuenta propia (subject_type 'profile', profiles.date_of_birth
--      a menos de 18 años, hora Colombia): no hay vínculo profile→acudiente, así
--      que callup_status lo muestra con has_account = false («responde la
--      familia en persona») y respond_callup le rechaza responder (42501) con
--      un mensaje claro. Sin fecha de nacimiento = mayor (puede responder).
--   b9 _calendar_event_kind: «juegos» y «pruebas» ya no cambian el tipo de un
--      entreno («Juegos predeportivos» sigue siendo entrenamiento). Partido =
--      partido / amistoso / vs / final; competencia = torneo / copa / liga /
--      festival / competencia / campeonato / interclubes; evaluación solo con
--      «evaluación».
--
-- Quién es «entrenador» aquí: todo staff de la escuela que NO es
-- administración (owner/admin/school_admin/super_admin de la escuela, dueño en
-- schools.owner_id, o staff de plataforma). Hoy eso son los 43 miembros
-- 'coach' activos y 2 'reporter' (que no dirigen equipos: pierden estas tres
-- RPCs, que son de cancha). Fail-closed a propósito.
--
-- RADIO (base viva, 2026-10-25, solo lectura con execute_sql):
--   · Cuerpos vivos de team_payment_status, callup_status, give_kudos,
--     respond_callup, save_match_roster y _calendar_event_kind comparados con
--     pg_proc: idénticos a los archivos 003634/003647/003657/003712.
--   · athlete_kudos: 0 filas. match_callup_responses: 0 filas.
--   · match_lineups: 5 'team_match' + 101 'training_session'. Jugadores ya
--     guardados ajenos a su escuela: 0 → la validación nueva no invalida nada.
--   · Perfiles menores en convocatorias: 0 (de 3 perfiles convocados).
--   · coach_hide_financial_info = true: 1 escuela (759eee9d-…): sus coaches
--     dejan de ver el semáforo de pago.
--   · _calendar_event_kind: 1 evento 'training' vivo cambia de nombre si se
--     re-edita («Pruebas físicas y técnicas»: evaluación → entrenamiento).
--     Ninguna notificación existente cambia.
--   · Sin cambios de tablas, policies, firmas ni grants de las RPCs públicas.
--
-- VERIFICACIÓN: SQL con sesión simulada (BEGIN … ROLLBACK) en el informe del
--   agente y en docs/migraciones-pendientes-2026-10-25/. Rápida:
--   select proname, pg_get_function_identity_arguments(oid), prosecdef, proconfig, proacl
--     from pg_proc where proname in ('team_payment_status','callup_status','give_kudos',
--       'respond_callup','save_match_roster','_calendar_event_kind',
--       '_v2_alcance_entrenador','_v2_sujeto_en_equipos','_v2_sujeto_en_escuela','_v2_perfil_menor');
--   select public._calendar_event_kind('training', 'Juegos predeportivos');  -- entrenamiento
--   select public._calendar_event_kind('training', 'Final copa Ciudad');     -- partido
--
-- REVERSA: re-crear team_payment_status (20261025003657), callup_status /
--   respond_callup / save_match_roster (20261025003647 §3, §5, §6), give_kudos
--   (20261025003634 §3) y _calendar_event_kind (20261025003712 §1) tal cual,
--   y después:
--   DROP FUNCTION IF EXISTS public._v2_alcance_entrenador(uuid);
--   DROP FUNCTION IF EXISTS public._v2_sujeto_en_equipos(text, uuid, uuid[]);
--   DROP FUNCTION IF EXISTS public._v2_sujeto_en_escuela(text, uuid, uuid);
--   DROP FUNCTION IF EXISTS public._v2_perfil_menor(uuid);
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

-- ─── 0. Helpers internos (solo los usan las RPCs definer de este archivo) ───

-- ¿Quien llama entra a esta escuela con alcance de ENTRENADOR (no administración)?
CREATE OR REPLACE FUNCTION public._v2_alcance_entrenador(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT NOT (p_school_id = ANY (public.user_admin_school_ids()) OR public.is_platform_admin());
$$;

-- ¿El deportista está en alguno de estos equipos? Mismo plantel que
-- team_payment_status / calendar_event_recipients.
CREATE OR REPLACE FUNCTION public._v2_sujeto_en_equipos(p_subject_type text, p_subject_id uuid, p_team_ids uuid[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p_subject_id IS NOT NULL
     AND COALESCE(array_length(p_team_ids, 1), 0) > 0
     AND (
          EXISTS (SELECT 1 FROM public.enrollments e
                   WHERE e.team_id = ANY (p_team_ids)
                     AND e.status IN ('active', 'pending', 'paused')
                     AND (   (p_subject_type = 'child'        AND e.child_id = p_subject_id)
                          OR (p_subject_type = 'profile'      AND e.user_id = p_subject_id AND e.child_id IS NULL)
                          OR (p_subject_type = 'unregistered' AND e.unregistered_athlete_id = p_subject_id)))
       OR (p_subject_type = 'child'
           AND EXISTS (SELECT 1 FROM public.children c
                        WHERE c.id = p_subject_id AND c.is_active AND c.team_id = ANY (p_team_ids)))
     );
$$;

-- ¿El deportista es de esta escuela? Mismo criterio que give_kudos (B1).
CREATE OR REPLACE FUNCTION public._v2_sujeto_en_escuela(p_subject_type text, p_subject_id uuid, p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p_subject_id IS NOT NULL AND p_school_id IS NOT NULL AND COALESCE(CASE p_subject_type
    WHEN 'child' THEN
         EXISTS (SELECT 1 FROM public.children c WHERE c.id = p_subject_id AND c.school_id = p_school_id)
      OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.child_id = p_subject_id AND e.school_id = p_school_id)
    WHEN 'profile' THEN
         EXISTS (SELECT 1 FROM public.enrollments e WHERE e.user_id = p_subject_id AND e.school_id = p_school_id)
      OR EXISTS (SELECT 1 FROM public.school_members sm
                  WHERE sm.profile_id = p_subject_id AND sm.school_id = p_school_id
                    AND sm.role = 'athlete' AND sm.status = 'active')
    WHEN 'unregistered' THEN
         EXISTS (SELECT 1 FROM public.unregistered_athletes ua WHERE ua.id = p_subject_id AND ua.school_id = p_school_id)
    ELSE false
  END, false);
$$;

-- ¿Perfil menor de 18 (hora Colombia)? Sin fecha de nacimiento → false (mayor).
CREATE OR REPLACE FUNCTION public._v2_perfil_menor(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT p.date_of_birth > ((now() AT TIME ZONE 'America/Bogota')::date - interval '18 years')::date
      FROM public.profiles p WHERE p.id = p_profile_id
  ), false);
$$;

-- Los default privileges les darían EXECUTE a authenticated/anon (trampa 3).
REVOKE ALL ON FUNCTION public._v2_alcance_entrenador(uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._v2_sujeto_en_equipos(text, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._v2_sujeto_en_escuela(text, uuid, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._v2_perfil_menor(uuid)                    FROM PUBLIC, anon, authenticated;

-- ─── 1. A1 team_payment_status: equipo propio + coach_hide_financial_info ──
CREATE OR REPLACE FUNCTION public.team_payment_status(p_team_id uuid)
RETURNS TABLE (
  subject_type text,
  subject_id   uuid,
  athlete_key  text,
  athlete_name text,
  estado       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_school uuid;
  v_hoy    date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT t.school_id INTO v_school FROM public.teams t WHERE t.id = p_team_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Equipo no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF NOT (v_school = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;

  -- b7: el entrenador solo ve SUS equipos y nada si la escuela oculta la plata.
  IF public._v2_alcance_entrenador(v_school) THEN
    IF NOT (p_team_id = ANY (public.user_coached_team_ids())) THEN
      RAISE EXCEPTION 'No diriges este equipo' USING ERRCODE = '42501';
    END IF;
    IF COALESCE((SELECT st.coach_hide_financial_info FROM public.school_settings st
                  WHERE st.school_id = v_school), false) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH plantel AS (
    SELECT DISTINCT
           CASE WHEN e.child_id IS NOT NULL THEN 'child'
                WHEN e.user_id  IS NOT NULL THEN 'profile'
                ELSE 'unregistered' END                                   AS st,
           COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id)     AS sid
      FROM public.enrollments e
     WHERE e.team_id = p_team_id
       AND e.status IN ('active', 'pending', 'paused')
       AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
    UNION
    SELECT 'child', c.id
      FROM public.children c
     WHERE c.team_id = p_team_id AND c.is_active
  ),
  cobros AS (
    SELECT pl.st, pl.sid,
           bool_or(p.status = 'overdue'
                   OR (p.status IN ('pending', 'partial', 'rejected') AND p.due_date < v_hoy)) AS vencido,
           bool_or(p.status IN ('pending', 'partial', 'rejected'))                            AS abierto
      FROM plantel pl
      JOIN public.payments p
        ON p.school_id = v_school
       AND (   (pl.st = 'child'        AND p.child_id = pl.sid)
            OR (pl.st = 'profile'      AND p.user_id = pl.sid AND p.child_id IS NULL AND p.unregistered_athlete_id IS NULL)
            OR (pl.st = 'unregistered' AND p.unregistered_athlete_id = pl.sid))
     WHERE p.status IN ('overdue', 'pending', 'partial', 'rejected')
     GROUP BY pl.st, pl.sid
  )
  SELECT pl.st,
         pl.sid,
         pl.st || ':' || pl.sid,
         COALESCE(c.full_name, pr.full_name, ua.full_name, 'Deportista')::text,
         CASE WHEN COALESCE(cb.vencido, false) THEN 'vencido'
              WHEN COALESCE(cb.abierto, false) THEN 'pendiente'
              ELSE 'al_dia' END
    FROM plantel pl
    LEFT JOIN cobros cb                       ON cb.st = pl.st AND cb.sid = pl.sid
    LEFT JOIN public.children c               ON pl.st = 'child'        AND c.id  = pl.sid
    LEFT JOIN public.profiles pr              ON pl.st = 'profile'      AND pr.id = pl.sid
    LEFT JOIN public.unregistered_athletes ua ON pl.st = 'unregistered' AND ua.id = pl.sid
   ORDER BY 4;
END;
$$;
COMMENT ON FUNCTION public.team_payment_status(uuid) IS
  'B3 V2: estado de pago por deportista de un equipo (al_dia | pendiente | vencido), '
  'SIN montos ni conceptos. Administración: cualquier equipo de su escuela. Entrenador: '
  'solo sus equipos (42501 si no), y 0 filas si la escuela tiene coach_hide_financial_info.';

-- ─── 2. B2 callup_status: alcance del entrenador + menor con cuenta ─────────
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
  v_team   uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT ml.school_id, ml.team_id INTO v_school, v_team FROM public.match_lineups ml WHERE ml.id = p_lineup_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Convocatoria no encontrada' USING ERRCODE = 'P0002'; END IF;
  IF NOT (v_school = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;
  -- b7: el entrenador solo ve convocatorias de SUS equipos.
  IF public._v2_alcance_entrenador(v_school)
     AND (v_team IS NULL OR NOT (v_team = ANY (public.user_coached_team_ids()))) THEN
    RAISE EXCEPTION 'No diriges este equipo' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT mlp.subject_type, mlp.subject_id,
         COALESCE(c.full_name, p.full_name, ua.full_name, 'Deportista')::text,
         mlp.role,
         -- M1: el menor con cuenta propia no responde (lo hace su familia en persona).
         (public._callup_subject_account(mlp.subject_type, mlp.subject_id) IS NOT NULL
          AND NOT (mlp.subject_type = 'profile' AND public._v2_perfil_menor(mlp.subject_id))),
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
  'nadie puede responder en la app (menor sin acudiente vinculado, ficha sin cuenta o '
  'deportista con cuenta menor de 18). Administración: toda la escuela; entrenador: sus equipos.';

-- ─── 3. B2 respond_callup: el menor con cuenta propia no responde ───────────
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

  -- M1: deportista con cuenta propia y menor de 18 → la convocatoria la
  -- responde su acudiente; en el esquema no hay vínculo profile→acudiente, así
  -- que la familia le avisa al profe en persona.
  IF v_type = 'profile' AND public._v2_perfil_menor(v_sid) THEN
    RAISE EXCEPTION 'Eres menor de edad: la convocatoria la responde tu acudiente. Pídele que le avise a tu entrenador.'
      USING ERRCODE = '42501', HINT = 'MINOR_CANNOT_RESPOND';
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
  'vinculada a la ficha. Deportista con cuenta menor de 18 → 42501 (responde su acudiente). '
  'Partido cancelado o pasado → 55000.';

-- ─── 4. B1 give_kudos: el entrenador solo a deportistas de SUS equipos ──────
CREATE OR REPLACE FUNCTION public.give_kudos(
  p_school_id               uuid,
  p_child_id                uuid,
  p_athlete_user_id         uuid,
  p_message                 text,
  p_unregistered_athlete_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_msg     text := btrim(COALESCE(p_message, ''));
  v_id      uuid;
  v_name    text;
  v_coach   text;
  v_belongs boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_school_id IS NULL THEN RAISE EXCEPTION 'Falta la escuela' USING ERRCODE = '22023'; END IF;
  IF num_nonnulls(p_child_id, p_athlete_user_id, p_unregistered_athlete_id) <> 1 THEN
    RAISE EXCEPTION 'Indica exactamente un deportista' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_msg) < 1 OR char_length(v_msg) > 200 THEN
    RAISE EXCEPTION 'El mensaje debe tener entre 1 y 200 caracteres' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_school_id = ANY (public.user_staff_school_ids()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Sin permiso sobre esta escuela' USING ERRCODE = '42501';
  END IF;

  -- El deportista tiene que ser de ESTA escuela (ficha o inscripción).
  IF p_child_id IS NOT NULL THEN
    SELECT c.full_name,
           (c.school_id = p_school_id
            OR EXISTS (SELECT 1 FROM public.enrollments e
                        WHERE e.child_id = c.id AND e.school_id = p_school_id))
      INTO v_name, v_belongs
      FROM public.children c WHERE c.id = p_child_id;
  ELSIF p_athlete_user_id IS NOT NULL THEN
    SELECT p.full_name,
           (EXISTS (SELECT 1 FROM public.enrollments e
                     WHERE e.user_id = p.id AND e.school_id = p_school_id)
            OR EXISTS (SELECT 1 FROM public.school_members sm
                        WHERE sm.profile_id = p.id AND sm.school_id = p_school_id
                          AND sm.role = 'athlete' AND sm.status = 'active'))
      INTO v_name, v_belongs
      FROM public.profiles p WHERE p.id = p_athlete_user_id;
  ELSE
    SELECT ua.full_name, (ua.school_id = p_school_id)
      INTO v_name, v_belongs
      FROM public.unregistered_athletes ua WHERE ua.id = p_unregistered_athlete_id;
  END IF;

  IF NOT COALESCE(v_belongs, false) THEN
    RAISE EXCEPTION 'El deportista no pertenece a esta escuela' USING ERRCODE = '22023';
  END IF;

  -- b7: el entrenador (no administración) solo felicita a deportistas de sus equipos.
  IF public._v2_alcance_entrenador(p_school_id)
     AND NOT public._v2_sujeto_en_equipos(
           CASE WHEN p_child_id IS NOT NULL THEN 'child'
                WHEN p_athlete_user_id IS NOT NULL THEN 'profile'
                ELSE 'unregistered' END,
           COALESCE(p_child_id, p_athlete_user_id, p_unregistered_athlete_id),
           public.user_coached_team_ids()) THEN
    RAISE EXCEPTION 'Este deportista no es de tus equipos' USING ERRCODE = '42501';
  END IF;

  BEGIN
    INSERT INTO public.athlete_kudos (school_id, child_id, athlete_user_id, unregistered_athlete_id, coach_id, message)
    VALUES (p_school_id, p_child_id, p_athlete_user_id, p_unregistered_athlete_id, v_uid, v_msg)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'KUDOS_DAILY_LIMIT' USING ERRCODE = 'P0001',
      HINT = 'Este deportista ya recibió una felicitación hoy.';
  END;

  -- Aviso. Nunca tumba la felicitación: si notifications rechaza, queda el WARNING.
  BEGIN
    SELECT NULLIF(btrim(full_name), '') INTO v_coach FROM public.profiles WHERE id = v_uid;

    INSERT INTO public.notifications (user_id, school_id, type, category, title, message, link, data)
    SELECT DISTINCT r.uid, p_school_id, 'info', 'kudos',
           '👏 ¡Felicitaciones, ' || COALESCE(split_part(btrim(v_name), ' ', 1), 'campeón') || '!',
           COALESCE(v_coach, 'Tu entrenador') || ': «' || v_msg || '»',
           '/dashboard',
           jsonb_build_object('kudos_id', v_id,
                              'child_id', p_child_id,
                              'athlete_user_id', p_athlete_user_id,
                              'unregistered_athlete_id', p_unregistered_athlete_id)
      FROM (
        SELECT c.parent_id AS uid FROM public.children c WHERE c.id = p_child_id
        UNION SELECT p_athlete_user_id
        UNION SELECT ua.linked_profile_id FROM public.unregistered_athletes ua WHERE ua.id = p_unregistered_athlete_id
      ) r
     WHERE r.uid IS NOT NULL AND r.uid <> v_uid;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'give_kudos: no se pudo notificar (%): %', SQLSTATE, SQLERRM;
  END;

  RETURN v_id;
END;
$$;
COMMENT ON FUNCTION public.give_kudos(uuid, uuid, uuid, text, uuid) IS
  'B1 V2: felicitación del staff a un deportista de su escuela (el entrenador, solo de sus '
  'equipos → 42501). Máx. 1 por deportista por día (hora Colombia) → KUDOS_DAILY_LIMIT. '
  'Avisa al acudiente / al deportista.';

-- ─── 5. M2 save_match_roster: solo deportistas de la escuela del partido ────
-- Cuerpo vivo de 20261025003647 §6 (verificado contra pg_proc el 2026-10-25);
-- único cambio: el bloque «M2» antes de tocar la convocatoria.
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
  v_ajenos integer;
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

  -- M2: nadie ajeno a la escuela del partido entra a la convocatoria ni recibe
  -- el aviso. Se rechaza ANTES de tocar nada (la lista vieja queda igual).
  SELECT count(*) INTO v_ajenos
    FROM jsonb_array_elements(COALESCE(p_players, '[]'::jsonb)) x
   WHERE NOT public._v2_sujeto_en_escuela(x->>'subject_type', NULLIF(x->>'subject_id', '')::uuid, m.school_id);
  IF v_ajenos > 0 THEN
    RAISE EXCEPTION '% deportista(s) de la lista no pertenecen a esta escuela', v_ajenos
      USING ERRCODE = '22023', HINT = 'ROSTER_FOREIGN_PLAYER';
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

-- ─── 6. b9 _calendar_event_kind: «juegos» / «pruebas» no cambian el tipo ────
CREATE OR REPLACE FUNCTION public._calendar_event_kind(p_event_type text, p_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH t AS (
    SELECT lower(translate(COALESCE(p_title, ''), 'ÁÉÍÓÚáéíóúÜü', 'AEIOUaeiouUu')) AS s
  )
  SELECT CASE
    WHEN p_event_type = 'match'       THEN 'partido'
    WHEN p_event_type = 'competition' THEN 'competencia'
    WHEN p_event_type = 'meeting'     THEN 'reunión'
    WHEN p_event_type = 'evaluation'  THEN 'evaluación'
    WHEN p_event_type = 'workshop'    THEN 'taller'
    WHEN p_event_type IN ('training', 'other') OR p_event_type IS NULL THEN
      CASE
        -- Solo palabras claras de partido. «Juegos predeportivos» es un entreno.
        WHEN t.s ~ '(^|[^a-z])(partidos?|amistosos?|final(es)?)([^a-z]|$)' OR t.s ~ '(^|[^a-z])vs\.?([^a-z]|$)' THEN 'partido'
        WHEN t.s ~ '(^|[^a-z])(torneos?|copas?|ligas?|festival(es)?|competencias?|campeonatos?|interclubes)([^a-z]|$)' THEN 'competencia'
        WHEN t.s ~ '(^|[^a-z])(reunion(es)?|asambleas?)([^a-z]|$)'  THEN 'reunión'
        -- «Pruebas de velocidad» es un entreno; solo «evaluación» lo nombra.
        WHEN t.s ~ '(^|[^a-z])evaluacion(es)?([^a-z]|$)'            THEN 'evaluación'
        WHEN t.s ~ '(^|[^a-z])talle(r|res)([^a-z]|$)'               THEN 'taller'
        WHEN p_event_type = 'training'                       THEN 'entrenamiento'
        ELSE 'evento'
      END
    ELSE 'evento'
  END
  FROM t;
$$;
COMMENT ON FUNCTION public._calendar_event_kind(text, text) IS
  'Tipo de evento para el aviso a familias. Un training/other cuyo título dice partido, '
  'amistoso, vs, final, torneo, copa, liga, reunión, evaluación o taller se nombra por el '
  'título (B5 V2; «juegos»/«pruebas» no cuentan desde b7).';
-- Función pura sin datos; solo la usa el trigger (definer). Cerrada como en B5.
REVOKE ALL ON FUNCTION public._calendar_event_kind(text, text) FROM PUBLIC, anon, authenticated;

-- ─── 7. Grants de las RPCs públicas (mismos que tenían) ─────────────────────
REVOKE ALL ON FUNCTION public.team_payment_status(uuid)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.callup_status(uuid)                           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_callup(uuid, uuid, uuid, text, uuid)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.give_kudos(uuid, uuid, uuid, text, uuid)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_match_roster(uuid, jsonb)                FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_payment_status(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.callup_status(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_callup(uuid, uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.give_kudos(uuid, uuid, uuid, text, uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_match_roster(uuid, jsonb)               TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
