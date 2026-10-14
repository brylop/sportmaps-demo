-- =============================================================================
-- 20261014113152_versiona_insert_exercise_tactical_scope.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014113038
-- Objetivo: VERSIONAR el estado vivo de insert_exercise_into_session_block.
-- =============================================================================
-- Contexto (hallado 2026-10-14):
--   La función viva fue endurecida A MANO (SQL editor; su COMMENT cita una
--   migración 20261013200604 que no existe en el repo). Exige
--   user_tactical_edit_school_ids() (owner/coach/super_admin + staff con cuenta
--   de coach), mientras que TODAS las versiones del repo
--   (20261008155457 y 20261008183744) usan user_staff_school_ids(), que también
--   deja pasar a admin / school_admin / reporter. Re-correr cualquiera de esas
--   dos migraciones REABRIRÍA el permiso.
--
--   Diff vivo vs 20261008183744: ÚNICAMENTE la línea del alcance (+ su
--   comentario). Firma, DEFAULT de p_team_id, SECURITY DEFINER, VOLATILE,
--   search_path, COMMENT y grants son los mismos.
--
--   Esta migración copia el cuerpo vivo BYTE A BYTE (md5(prosrc) =
--   a429e7e492dadcb3987b00907d48f70c) y re-afirma el proacl vivo:
--     {postgres=X, service_role=X, authenticated=X}  (sin PUBLIC ni anon).
--   Es un NO-OP sobre la base viva.
--
--   user_tactical_edit_school_ids() ya está versionada (20260925170001) y su
--   cuerpo vivo coincide con el repo: no se toca aquí.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.insert_exercise_into_session_block(
  p_exercise_id uuid,
  p_session_id  uuid,
  p_block_id    uuid,
  p_team_id     uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
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
$function$;

COMMENT ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) IS
  'Biblioteca T3: copia un ejercicio a un bloque de sesión (bloque + match_lineups con frames) en una transacción. Exige user_tactical_edit_school_ids() (20261013200604).';

-- Grants = proacl vivo. Se revoca explícito de anon/authenticated (los default
-- privileges del esquema otorgan EXECUTE en cada función nueva) y se re-otorga.
REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) TO service_role;

COMMIT;
