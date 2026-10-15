-- =============================================================================
-- 20261013200604_pizarra_rls_biblioteca_y_rpc_ejercicio.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013165308
-- Objetivo: cierra los tres huecos que encontraron las pruebas de permisos de la
--   pizarra TacticalPad contra la base viva (scripts/rls-pruebas-pizarra.mjs,
--   npm run seguridad:rls-pizarra, 2026-10-13). Reemplaza objetos de
--   20261008183744_biblioteca_ejercicios_v2.sql (aplicada y verificada viva:
--   el cuerpo de la RPC en pg_proc coincide línea por línea con el del repo).
--
--   H1 (MEDIA) insert_exercise_into_session_block autorizaba con
--      user_staff_school_ids() (todo el que no sea parent/athlete/accountant),
--      pero ESCRIBE en match_lineups / match_lineup_players, cuyas policies de
--      escritura exigen user_tactical_edit_school_ids() (owner, coach,
--      super_admin, staff con cuenta de coach), y en training_sessions. Un
--      admin / school_admin / reporter que llama la RPC directo por PostgREST
--      (expuesta a authenticated; el requireRole del BFF no la protege) creaba
--      o REEMPLAZABA la jugada de cualquier bloque de su escuela y borraba sus
--      match_lineup_players, cosa que por la tabla no puede hacer.
--      Fix: el gate pasa a user_tactical_edit_school_ids(), el mismo de la
--      tabla y el mismo TACTICAL_EDIT_ROLES del BFF (school/exercises.ts). El
--      resto del cuerpo es idéntico al vivo.
--
--   H2 (BAJA) training_exercises_select deja leer las plantillas del sistema a
--      CUALQUIER autenticado (padres, atletas, usuarios sin escuela). El spec
--      (§4: «leen las del sistema y las de su escuela quienes están en
--      user_staff_school_ids()») las limita a staff. Contenido genérico, sin
--      datos privados: se alinea con el spec.
--
--   H3 (BAJA) training_exercises_update no fija la autoría en el WITH CHECK: el
--      autor (coach) puede reasignar created_by a otro miembro o a NULL y
--      endosarle el ejercicio. Ahora un no-admin solo deja created_by = él
--      mismo; el admin de la escuela sigue pudiendo editar lo de otros.
--
-- Radio medido contra la base viva (2026-10-13) ANTES de escribir esto:
--   · H1: 5 membresías activas pierden el camino por RPC (2 admin, 2
--     school_admin, 1 reporter), en 5 escuelas, sin rol táctico en esa escuela.
--     El BFF ya les respondía 403 (requireRole TACTICAL_EDIT_ROLES): ninguna
--     pantalla cambia. Coaches y owners: sin cambio.
--   · H2: 12 filas (las 12 plantillas). Padres (872 membresías) y atletas (48)
--     dejan de poder listarlas por REST; la app las lee por el BFF con
--     service_role, que no pasa por RLS. Ningún componente del frontend lee
--     training_exercises directo (grep frontend/src).
--   · H3: 0 filas (hoy no hay ejercicios de escuela, solo las 12 plantillas). El
--     BFF escribe con service_role: sin impacto.
--
-- Policies: training_exercises tiene exactamente 4 (select/insert/update/delete,
-- verificado en pg_policies); se reescriben SOLO select y update, en la misma
-- transacción. No se toca ningún helper de RLS ni sus GRANTs.
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

-- ─── H1. RPC: el gate es el de editar la pizarra, no el de ser staff ────────
CREATE OR REPLACE FUNCTION public.insert_exercise_into_session_block(
  p_exercise_id uuid,
  p_session_id  uuid,
  p_block_id    uuid,
  p_team_id     uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_ex         public.training_exercises%ROWTYPE;
  v_school     uuid;
  v_team       uuid;
  v_blocks     jsonb;
  v_block      jsonb;
  v_found      boolean := false;
  v_board      jsonb;
  v_arrows     jsonb;
  v_frames     jsonb;
  v_lineup_id  uuid;
  v_lineup_sch uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_exercise_id IS NULL OR p_block_id IS NULL THEN
    RAISE EXCEPTION 'p_exercise_id y p_block_id son requeridos.' USING ERRCODE = '22023';
  END IF;

  -- Escuela y equipo: de la sesión si existe; si no, del equipo.
  IF p_session_id IS NOT NULL THEN
    SELECT ts.school_id, ts.team_id, COALESCE(ts.session_blocks, '[]'::jsonb)
      INTO v_school, v_team, v_blocks
      FROM public.training_sessions ts
     WHERE ts.id = p_session_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sesión no encontrada.' USING ERRCODE = 'P0002';
    END IF;
    IF p_team_id IS NOT NULL AND p_team_id <> v_team THEN
      RAISE EXCEPTION 'El equipo no corresponde a la sesión.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_blocks) <> 'array' THEN
      v_blocks := '[]'::jsonb;
    END IF;
  ELSE
    IF p_team_id IS NULL THEN
      RAISE EXCEPTION 'Sin sesión hace falta p_team_id.' USING ERRCODE = '22023';
    END IF;
    SELECT t.school_id, t.id INTO v_school, v_team
      FROM public.teams t WHERE t.id = p_team_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Equipo no encontrado.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- El caller tiene que poder EDITAR LA PIZARRA en esa escuela: el mismo
  -- alcance que las policies de escritura de match_lineups / match_lineup_players
  -- (user_tactical_edit_school_ids(): owner, coach, super_admin de la escuela y
  -- staff con cuenta de coach). Antes era user_staff_school_ids(), que también
  -- incluye admin / school_admin / reporter: por esta RPC escribían jugadas que
  -- por la tabla no pueden escribir.
  IF v_school IS NULL OR NOT (v_school = ANY (public.user_tactical_edit_school_ids())) THEN
    RAISE EXCEPTION 'No tienes permiso sobre esta sesión.' USING ERRCODE = '42501';
  END IF;

  -- El ejercicio: plantilla del sistema o de ESA misma escuela, y activo.
  SELECT * INTO v_ex
    FROM public.training_exercises e
   WHERE e.id = p_exercise_id
     AND e.is_active
   FOR UPDATE;
  IF NOT FOUND
     OR NOT ((v_ex.school_id IS NULL AND v_ex.is_template) OR v_ex.school_id = v_school) THEN
    RAISE EXCEPTION 'Ejercicio no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  -- a) Bloque: completa SOLO lo vacío; nunca pisa lo que el coach ya escribió.
  IF p_session_id IS NOT NULL THEN
    SELECT jsonb_agg(
             CASE WHEN b.elem->>'id' = p_block_id::text THEN
               b.elem
               || jsonb_build_object(
                    'name',        CASE WHEN COALESCE(btrim(b.elem->>'name'), '') = '' THEN v_ex.name ELSE b.elem->>'name' END,
                    'activity',    CASE WHEN COALESCE(btrim(b.elem->>'activity'), '') = '' THEN v_ex.name ELSE b.elem->>'activity' END,
                    'minutes',     CASE WHEN COALESCE(btrim(b.elem->>'minutes'), '') = '' THEN COALESCE(v_ex.minutes::text, '') ELSE b.elem->>'minutes' END,
                    'objective',   CASE WHEN COALESCE(btrim(b.elem->>'objective'), '') = '' THEN COALESCE(v_ex.objective, '') ELSE b.elem->>'objective' END,
                    'description', CASE WHEN COALESCE(btrim(b.elem->>'description'), '') = '' THEN COALESCE(v_ex.description, '') ELSE b.elem->>'description' END,
                    'exercise_id', v_ex.id
                  )
             ELSE b.elem END
             ORDER BY b.ord
           ),
           bool_or(b.elem->>'id' = p_block_id::text)
      INTO v_blocks, v_found
      FROM jsonb_array_elements(v_blocks) WITH ORDINALITY AS b(elem, ord);

    v_blocks := COALESCE(v_blocks, '[]'::jsonb);
    IF NOT COALESCE(v_found, false) THEN
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', p_block_id,
        'name', v_ex.name,
        'minutes', COALESCE(v_ex.minutes::text, ''),
        'activity', v_ex.name,
        'objective', COALESCE(v_ex.objective, ''),
        'description', COALESCE(v_ex.description, ''),
        'component', '',
        'exercise_id', v_ex.id
      ));
    END IF;

    UPDATE public.training_sessions
       SET session_blocks = v_blocks, updated_at = now()
     WHERE id = p_session_id;

    SELECT elem INTO v_block
      FROM jsonb_array_elements(v_blocks) AS elem
     WHERE elem->>'id' = p_block_id::text
     LIMIT 1;
  END IF;

  -- b) Jugada del bloque. Sin frames guardados se arma UN cuadro con los
  --    puestos + figuras, porque los puestos no pueden ir a match_lineup_players
  --    (subject_id NOT NULL) y sin cuadro se perderían sus posiciones.
  v_board  := COALESCE(v_ex.board, '{}'::jsonb);
  v_arrows := CASE WHEN jsonb_typeof(v_board->'arrows') = 'array' THEN v_board->'arrows' ELSE '[]'::jsonb END;
  v_frames := CASE WHEN jsonb_typeof(v_board->'frames') = 'array' THEN v_board->'frames' ELSE '[]'::jsonb END;
  IF jsonb_array_length(v_frames) = 0
     AND jsonb_typeof(v_board->'players') = 'array'
     AND jsonb_array_length(v_board->'players') > 0 THEN
    v_frames := jsonb_build_array(jsonb_build_object(
      'id', 'f1',
      'duration_ms', 1200,
      'players', (SELECT COALESCE(jsonb_agg(jsonb_build_object('key', p->>'key', 'x', p->'x', 'y', p->'y')), '[]'::jsonb)
                    FROM jsonb_array_elements(v_board->'players') AS p),
      'ball', NULL,
      'arrows', v_arrows
    ));
  END IF;

  SELECT ml.id, ml.school_id INTO v_lineup_id, v_lineup_sch
    FROM public.match_lineups ml
   WHERE ml.source_type = 'training_session'
     AND ml.source_id = p_block_id
   FOR UPDATE;

  IF v_lineup_id IS NOT NULL THEN
    IF v_lineup_sch <> v_school THEN
      RAISE EXCEPTION 'El bloque pertenece a otra escuela.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.match_lineups
       SET team_id = v_team, arrows = v_arrows, frames = v_frames, formation = NULL, updated_at = now()
     WHERE id = v_lineup_id;
    -- c) La jugada se reemplaza entera: los atletas asignados a la jugada
    --    anterior ya no tienen puesto en el ejercicio nuevo.
    DELETE FROM public.match_lineup_players WHERE lineup_id = v_lineup_id;
  ELSE
    INSERT INTO public.match_lineups (school_id, team_id, source_type, source_id, formation, arrows, frames, created_by)
    VALUES (v_school, v_team, 'training_session', p_block_id, NULL, v_arrows, v_frames, v_uid)
    RETURNING id INTO v_lineup_id;
  END IF;

  -- d) Uso
  UPDATE public.training_exercises SET times_used = times_used + 1 WHERE id = v_ex.id;

  RETURN jsonb_build_object(
    'lineup_id',   v_lineup_id,
    'session_id',  p_session_id,
    'block_id',    p_block_id,
    'exercise_id', v_ex.id,
    'block',       v_block
  );
END;
$$;

COMMENT ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) IS
  'Biblioteca T3: copia un ejercicio a un bloque de sesión (bloque + match_lineups con frames) en una transacción. Exige user_tactical_edit_school_ids() (20261013200604).';

-- Los default privileges del esquema dan EXECUTE a authenticated/anon: explícito.
REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) TO service_role;

-- ─── H2. Plantillas del sistema: las lee quien trabaja en alguna escuela ────
DROP POLICY IF EXISTS training_exercises_select ON public.training_exercises;
CREATE POLICY training_exercises_select ON public.training_exercises
  FOR SELECT TO authenticated
  USING (
    (
      school_id IS NULL AND is_template
      AND cardinality((SELECT public.user_staff_school_ids())::uuid[]) > 0
    )
    OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- ─── H3. Update: la autoría no se reasigna, salvo un admin de la escuela ────
DROP POLICY IF EXISTS training_exercises_update ON public.training_exercises;
CREATE POLICY training_exercises_update ON public.training_exercises
  FOR UPDATE TO authenticated
  USING (
    (
      school_id IS NOT NULL
      AND (
        (created_by = (SELECT auth.uid()) AND school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]))
        OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
      )
    )
    OR (school_id IS NULL AND (SELECT public.is_super_admin()))
  )
  WITH CHECK (
    -- No puede mudarse a una escuela ajena, volverse plantilla global ni
    -- cambiar de autor (salvo que lo haga un admin de la escuela).
    (
      school_id IS NOT NULL
      AND NOT is_template
      AND school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
      AND (
        created_by = (SELECT auth.uid())
        OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
      )
    )
    OR (school_id IS NULL AND is_template AND (SELECT public.is_super_admin()))
  );

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación post-aplicación:
--   npm run seguridad:rls-pizarra   -- los casos «esperado tras 20261013200604» pasan a verde
--   npm run seguridad:invariantes
--   select policyname, cmd, qual, with_check from pg_policies where tablename = 'training_exercises';
--   select proacl, proconfig from pg_proc where proname = 'insert_exercise_into_session_block';
-- -----------------------------------------------------------------------------
