-- ============================================================
-- SMOKE TEST — Alcance del entrenador: equipos, contacto de familias y
-- disponibilidad médica (20261010201426_coach_alcance_equipos_contactos).
-- NO es una migración. Correr con psql DESPUÉS de aplicar la migración:
--   psql "$DATABASE_URL" \
--     -v school_id="'<escuela SIN coach_can_create_teams, con >= 2 equipos>'" \
--     -v coach_id="'<profiles.id de un coach activo de esa escuela que dirige >= 1 equipo y NO todos>'" \
--     -v admin_id="'<profiles.id de owner/admin de esa escuela>'" \
--     -v parent_id="'<profiles.id de un acudiente de esa escuela, sin rol de staff>'" \
--     -v scoped_school_id="'<escuela CON coach_can_create_teams (Carmel) o la misma school_id para saltar>'" \
--     -v scoped_coach_id="'<coach de esa escuela que es teams.coach_id de >= 1 equipo, o el mismo coach_id para saltar>'" \
--     -f supabase/migrations/_smoke/coach_alcance_equipos_contactos_smoke.sql
--
-- Ejemplo real (2026-10-10): Besser 759eee9d-05cb-4958-b84a-2560f77e3683,
-- coach Duvan 78edddfb-a60f-4011-bd76-54e0ad33a924 (dirige 3 de 8);
-- Carmel 374a6716-af42-4745-afe1-8d089153e01b, coach Robert
-- d8256cee-5c7b-45e6-8ee0-eb88d3293fec (dirige 2 de 7).
--
-- Todo va en BEGIN … ROLLBACK: los UPDATE de prueba no persisten.
-- Cualquier FAIL aborta (ON_ERROR_STOP) y la transacción se deshace igual.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _p (school_id uuid, coach_id uuid, admin_id uuid, parent_id uuid,
                      scoped_school_id uuid, scoped_coach_id uuid,
                      team_propio uuid, team_ajeno uuid, team_scoped uuid);
INSERT INTO _p (school_id, coach_id, admin_id, parent_id, scoped_school_id, scoped_coach_id)
VALUES (:school_id, :coach_id, :admin_id, :parent_id, :scoped_school_id, :scoped_coach_id);
GRANT SELECT ON _p TO authenticated, anon;

-- ── 0. Catálogo ──────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teams'
              AND policyname IN ('Teams: manage staff', 'Programs: manage admin')) THEN
    RAISE EXCEPTION 'FAIL 0a: siguen vivas las policies viejas de teams';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'Teams: manage admin' AND with_check IS NOT NULL)
  OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'Teams: coach update own' AND cmd = 'UPDATE' AND with_check IS NOT NULL)
  OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'Teams: coach manage own (scoped)') THEN
    RAISE EXCEPTION 'FAIL 0b: faltan policies nuevas de teams (o el carril de Carmel)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename IN ('team_coaches','team_branches') AND policyname LIKE '%manage_staff') THEN
    RAISE EXCEPTION 'FAIL 0c: team_coaches/team_branches conservan *_manage_staff';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.teams'::regclass
                  AND tgname = 'trg_teams_guard_coach_update' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'FAIL 0d: falta trg_teams_guard_coach_update';
  END IF;
  FOREACH f IN ARRAY ARRAY['public.user_coached_team_ids()',
                           'public.coach_contact_masked_school(uuid)',
                           'public.get_school_athlete_availability(uuid)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = f::regprocedure AND prosecdef
                    AND proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']) THEN
      RAISE EXCEPTION 'FAIL 0e: % sin SECURITY DEFINER o sin search_path (I4)', f;
    END IF;
    IF NOT has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL 0f: authenticated sin EXECUTE sobre %', f;
    END IF;
    IF has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL 0g: anon con EXECUTE sobre %', f;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.school_athletes'::regclass
                  AND reloptions @> ARRAY['security_invoker=true']) THEN
    RAISE EXCEPTION 'FAIL 0h: school_athletes perdió security_invoker';
  END IF;
  IF EXISTS (SELECT 1 FROM public.school_settings s, _p WHERE s.school_id = _p.school_id AND s.coach_can_create_teams) THEN
    RAISE EXCEPTION 'PRECONDICIÓN: school_id tiene coach_can_create_teams; usar una escuela sin el flag';
  END IF;
  IF EXISTS (SELECT 1 FROM public.school_settings s, _p WHERE s.school_id = _p.school_id AND s.coach_can_see_all_contacts) THEN
    RAISE EXCEPTION 'PRECONDICIÓN: school_id tiene coach_can_see_all_contacts';
  END IF;
END $$;

-- Equipo propio y ajeno del coach (resueltos como postgres, antes de cambiar de rol).
UPDATE _p SET team_propio = (
  SELECT t.id FROM public.teams t
    JOIN public.school_staff ss ON ss.school_id = t.school_id AND ss.coach_auth_id = _p.coach_id
   WHERE t.school_id = _p.school_id
     AND (t.coach_id = ss.id OR EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = ss.id))
   ORDER BY t.created_at LIMIT 1);
UPDATE _p SET team_ajeno = (
  SELECT t.id FROM public.teams t
   WHERE t.school_id = _p.school_id
     AND NOT EXISTS (SELECT 1 FROM public.school_staff ss
                      WHERE ss.school_id = t.school_id AND ss.coach_auth_id = _p.coach_id
                        AND (t.coach_id = ss.id OR EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = ss.id)))
   ORDER BY t.created_at LIMIT 1);
UPDATE _p SET team_scoped = (
  SELECT t.id FROM public.teams t
    JOIN public.school_staff ss ON ss.id = t.coach_id AND ss.coach_auth_id = _p.scoped_coach_id
   WHERE t.school_id = _p.scoped_school_id
   ORDER BY t.created_at LIMIT 1);

DO $$
BEGIN
  IF (SELECT team_propio FROM _p) IS NULL THEN RAISE EXCEPTION 'PRECONDICIÓN: el coach no dirige ningún equipo de la escuela'; END IF;
  IF (SELECT team_ajeno  FROM _p) IS NULL THEN RAISE EXCEPTION 'PRECONDICIÓN: el coach dirige todos los equipos; elegir otro'; END IF;
END $$;

-- ── 1. Sesión de ENTRENADOR ──────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
       json_build_object('sub', (SELECT coach_id FROM _p), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE n int; v_propio uuid; v_ajeno uuid; v_school uuid;
BEGIN
  SELECT team_propio, team_ajeno, school_id INTO v_propio, v_ajeno, v_school FROM _p;

  IF NOT (v_propio = ANY (public.user_coached_team_ids())) THEN
    RAISE EXCEPTION 'FAIL 1a: user_coached_team_ids() no incluye el equipo propio';
  END IF;
  IF v_ajeno = ANY (public.user_coached_team_ids()) THEN
    RAISE EXCEPTION 'FAIL 1b: user_coached_team_ids() incluye un equipo ajeno';
  END IF;

  -- Editar datos deportivos de SU equipo: permitido.
  UPDATE public.teams SET description = COALESCE(description, '') || ' ' WHERE id = v_propio;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 1c: el coach no pudo editar su propio equipo (filas=%)', n; END IF;

  -- Equipo ajeno: invisible para escribir (0 filas, sin error).
  UPDATE public.teams SET description = COALESCE(description, '') || ' ' WHERE id = v_ajeno;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 1d: el coach editó un equipo que no dirige'; END IF;

  -- Precio / estado / entrenador de SU equipo: solo administración.
  BEGIN
    UPDATE public.teams SET price_monthly = COALESCE(price_monthly, 0) + 1 WHERE id = v_propio;
    RAISE EXCEPTION 'FAIL 1e: el coach cambió el precio de su equipo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.teams SET status = CASE WHEN status = 'inactive' THEN 'active' ELSE 'inactive' END WHERE id = v_propio;
    RAISE EXCEPTION 'FAIL 1f: el coach archivó/reactivó su equipo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.teams SET coach_id = NULL WHERE id = v_propio;
    RAISE EXCEPTION 'FAIL 1g: el coach se quitó/reasignó el equipo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Crear equipo: no (escuela sin coach_can_create_teams).
  BEGIN
    INSERT INTO public.teams (name, sport, school_id) VALUES ('__smoke_coach__', 'Fútbol', v_school);
    RAISE EXCEPTION 'FAIL 1h: el coach creó un equipo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Borrar su propio equipo: no (0 filas, sin error).
  DELETE FROM public.teams WHERE id = v_propio;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 1i: el coach borró un equipo'; END IF;

  -- Asignarse a un equipo ajeno: no.
  BEGIN
    INSERT INTO public.team_coaches (team_id, coach_id, school_id)
    SELECT v_ajeno, ss.id, v_school FROM public.school_staff ss
     WHERE ss.school_id = v_school AND ss.coach_auth_id = auth.uid() LIMIT 1;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE EXCEPTION 'FAIL 1j: el coach se asignó a un equipo ajeno'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Contacto: enmascarado fuera de sus equipos…
  IF EXISTS (SELECT 1 FROM public.school_athletes sa
              WHERE sa.school_id = v_school
                AND (sa.parent_email IS NOT NULL OR sa.parent_phone IS NOT NULL)
                AND NOT COALESCE(sa.team_id = ANY (public.user_coached_team_ids()), false)
                AND NOT EXISTS (SELECT 1 FROM public.enrollments e
                                 WHERE e.status = 'active'
                                   AND e.team_id = ANY (public.user_coached_team_ids())
                                   AND (e.child_id = sa.id OR e.user_id = sa.id OR e.unregistered_athlete_id = sa.id))) THEN
    RAISE EXCEPTION 'FAIL 1k: el coach ve contacto de familias de equipos que no dirige';
  END IF;
  -- …pero sigue viendo la fila (nombre) para poder inscribirla en su equipo.
  IF NOT EXISTS (SELECT 1 FROM public.school_athletes sa
                  WHERE sa.school_id = v_school
                    AND sa.enrolled_team_id IS DISTINCT FROM v_propio) THEN
    RAISE NOTICE 'AVISO 1l: no hay deportistas fuera de sus equipos para comprobar visibilidad de filas';
  END IF;

  -- La RPC médica corre sin error para el coach.
  PERFORM count(*) FROM public.get_school_athlete_availability(v_school);
  RAISE NOTICE 'OK 1: entrenador';
END $$;

-- Contacto DENTRO de sus equipos: igual al dato real (comparado como postgres).
RESET ROLE;
CREATE TEMP TABLE _ids_coach (id uuid);
GRANT ALL ON _ids_coach TO authenticated;
SET LOCAL ROLE authenticated;
INSERT INTO _ids_coach
  SELECT sa.id FROM public.school_athletes sa, _p
   WHERE sa.school_id = _p.school_id AND sa.enrolled_team_id = _p.team_propio
     AND (sa.parent_email IS NOT NULL OR sa.parent_phone IS NOT NULL);
RESET ROLE;
DO $$
DECLARE visibles int; reales int;
BEGIN
  SELECT count(*) INTO visibles FROM _ids_coach;
  SELECT count(*) INTO reales FROM public.school_athletes sa, _p
   WHERE sa.school_id = _p.school_id AND sa.enrolled_team_id = _p.team_propio
     AND (sa.parent_email IS NOT NULL OR sa.parent_phone IS NOT NULL);
  IF visibles <> reales THEN
    RAISE EXCEPTION 'FAIL 1m: el coach ve % contactos de su equipo y hay % (no debe enmascarar los suyos)', visibles, reales;
  END IF;
  RAISE NOTICE 'OK 1m: contactos del equipo propio visibles (%)', visibles;
END $$;

-- ── 2. Sesión de ADMINISTRACIÓN ──────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
       json_build_object('sub', (SELECT admin_id FROM _p), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE n int; v_ajeno uuid; v_school uuid; enmascarados int;
BEGIN
  SELECT team_ajeno, school_id INTO v_ajeno, v_school FROM _p;
  IF NOT (v_school = ANY (public.user_admin_school_ids())) THEN
    RAISE EXCEPTION 'PRECONDICIÓN: admin_id no es administración de la escuela';
  END IF;

  UPDATE public.teams SET price_monthly = COALESCE(price_monthly, 0) + 1,
                          status = status
   WHERE id = v_ajeno;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 2a: la administración no pudo cambiar el precio de un equipo'; END IF;

  IF public.coach_contact_masked_school(v_school) THEN
    RAISE EXCEPTION 'FAIL 2b: a la administración se le enmascara el contacto';
  END IF;
  RAISE NOTICE 'OK 2: administración';
END $$;

-- ── 3. Sesión de ACUDIENTE ───────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
       json_build_object('sub', (SELECT parent_id FROM _p), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE n int; v_propio uuid; v_school uuid;
BEGIN
  SELECT team_propio, school_id INTO v_propio, v_school FROM _p;
  UPDATE public.teams SET description = description WHERE school_id = v_school;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 3a: un acudiente editó equipos (%)', n; END IF;
  IF cardinality(public.user_coached_team_ids()) <> 0 THEN
    RAISE EXCEPTION 'FAIL 3b: user_coached_team_ids() no vacío para un acudiente';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_school_athlete_availability(v_school)) THEN
    RAISE EXCEPTION 'FAIL 3c: un acudiente lee disponibilidad médica de la escuela';
  END IF;
  RAISE NOTICE 'OK 3: acudiente';
END $$;

-- ── 4. Escuela con coach_can_create_teams (Carmel): SIN CAMBIO ──────────────
SELECT set_config('request.jwt.claims',
       json_build_object('sub', (SELECT scoped_coach_id FROM _p), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE n int; v_team uuid; v_school uuid;
BEGIN
  SELECT team_scoped, scoped_school_id INTO v_team, v_school FROM _p;
  IF v_team IS NULL OR NOT public.is_scoped_coach_school(v_school) THEN
    RAISE NOTICE 'SALTADO 4: sin escuela con coach_can_create_teams o sin equipo propio';
    RETURN;
  END IF;
  -- Igual que antes de la migración: archiva/reactiva SU equipo (lo deshace el ROLLBACK).
  UPDATE public.teams SET status = CASE WHEN status = 'inactive' THEN 'active' ELSE 'inactive' END WHERE id = v_team;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 4a: el coach de la escuela con coach_can_create_teams perdió editar su equipo'; END IF;
  -- Y sigue sin poder entregárselo a otro.
  BEGIN
    UPDATE public.teams SET coach_id = NULL WHERE id = v_team;
    RAISE EXCEPTION 'FAIL 4b: el coach acotado se quitó el equipo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK 4: carril coach_can_create_teams intacto';
END $$;

RESET ROLE;
ROLLBACK;
