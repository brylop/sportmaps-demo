-- =============================================================================
-- 20261008183744_biblioteca_ejercicios_v2.sql
-- Reemplaza a 20261008155457_biblioteca_ejercicios.sql (NO aplicarla): sus policies usan
-- `x = ANY ((SELECT fn()))`, que Postgres lee como subconsulta y falla con 42883
-- «operator does not exist: uuid = uuid[]» (falló al aplicarla el 2026-10-08).
-- Único cambio: ANY ((SELECT public.<fn>())) → ANY ((SELECT public.<fn>())::uuid[]).
-- Mismo arreglo que 20261006104251 / 20261006104254.
-- =============================================================================

-- =============================================================================
-- 20261008155457_biblioteca_ejercicios.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-08   Versión anterior: 20261008155454
-- Objetivo: T3 de docs/specs/pizarra-nivel-tacticalpad.md — Biblioteca de
--   ejercicios. Tabla `training_exercises` (ejercicios de la escuela + plantillas
--   del sistema con school_id NULL), su RLS por comando, la RPC transaccional
--   `insert_exercise_into_session_block` que copia un ejercicio a un bloque de
--   sesión (bloque en session_blocks + jugada en match_lineups con frames) y 12
--   plantillas SportMaps listas para usar.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
--
-- Orden: depende de 20261008155454 (columna match_lineups.frames). 155454 <
-- 155457, así que en el orden normal ya existe; si alguien aplica esta sola,
-- el DO de abajo corta con un mensaje claro en vez de crear una RPC que falla
-- en la primera llamada.
--
-- Jugadores de la jugada: `match_lineup_players.subject_id` es NOT NULL (y
-- UNIQUE con lineup_id + subject_type). Un ejercicio de biblioteca no tiene
-- atletas reales, solo puestos ("Exterior 1", "Pivote"), así que la RPC NO
-- inserta filas en match_lineup_players: los puestos viajan en `frames` con
-- key = 'slot#<índice>' (presetSlotKey() de tacticalFrames.ts, el MISMO
-- formato de los cuadros de «Mis jugadas» / team_tactical_presets.frames),
-- donde el índice es la posición en board.players. El coach después asigna
-- atletas reales desde la pizarra.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'match_lineups' AND column_name = 'frames'
  ) THEN
    RAISE EXCEPTION 'Falta match_lineups.frames: aplicar 20261008155454_pizarra_animacion_por_cuadros antes que esta migración.';
  END IF;
END $$;

-- ─── 1. Tabla ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = plantilla del sistema (SportMaps), de solo lectura para las escuelas.
  school_id    uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  -- FK de negocio a profiles (CLAUDE.md). NULL en las plantillas del sistema
  -- y si el autor se borra (el ejercicio sigue siendo de la escuela).
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name         text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  objective    text CHECK (objective IS NULL OR char_length(objective) <= 1000),
  minutes      integer CHECK (minutes IS NULL OR minutes BETWEEN 1 AND 240),
  age_group    text CHECK (age_group IS NULL OR char_length(age_group) <= 60),
  materials    text CHECK (materials IS NULL OR char_length(materials) <= 500),
  tags         text[] NOT NULL DEFAULT '{}'::text[] CHECK (cardinality(tags) <= 20),
  sport        text NOT NULL DEFAULT 'futbol'
               CHECK (sport IN ('futbol','futbol7','futbol5','futsal','voleibol','baloncesto','balonmano','generico')),
  description  text CHECK (description IS NULL OR char_length(description) <= 4000),
  -- { players: [{key:'slot#i', slot_label, x, y, jersey_number?}], arrows: [...], frames: [...] }
  -- La forma fina la valida el BFF (exerciseShapes.ts); acá solo el tipo y un
  -- tope de tamaño para que un cliente no guarde megas.
  board        jsonb NOT NULL DEFAULT '{}'::jsonb
               CHECK (jsonb_typeof(board) = 'object' AND octet_length(board::text) <= 524288),
  is_template  boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  times_used   integer NOT NULL DEFAULT 0 CHECK (times_used >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Plantilla del sistema <=> sin escuela. Una escuela no puede marcar algo suyo
  -- como plantilla global, ni existe una plantilla "de nadie" que no sea del sistema.
  CONSTRAINT training_exercises_template_scope CHECK ((school_id IS NULL) = is_template)
);

COMMENT ON TABLE public.training_exercises IS
  'Biblioteca de ejercicios (pizarra T3). school_id NULL + is_template = plantilla SportMaps de solo lectura.';

CREATE INDEX IF NOT EXISTS training_exercises_school_active_idx
  ON public.training_exercises (school_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS training_exercises_templates_idx
  ON public.training_exercises (sport) WHERE school_id IS NULL AND is_active;
CREATE INDEX IF NOT EXISTS training_exercises_created_by_idx
  ON public.training_exercises (created_by);
CREATE INDEX IF NOT EXISTS training_exercises_tags_idx
  ON public.training_exercises USING gin (tags);

DROP TRIGGER IF EXISTS training_exercises_set_updated_at ON public.training_exercises;
CREATE TRIGGER training_exercises_set_updated_at
  BEFORE UPDATE ON public.training_exercises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. RLS: una policy por comando ─────────────────────────────────────────
-- Helpers envueltos en (SELECT …) para que se evalúen una vez por query y no
-- por fila. Ninguna policy lee training_exercises (sin self-recursion).
-- Escritura con user_staff_school_ids() (staff, sin padres ni atletas), nunca
-- con user_school_ids(). Lo que OTRO miembro escribió solo lo toca un admin.
-- Plantillas del sistema (school_id NULL): solo super admin las escribe.
ALTER TABLE public.training_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_exercises_select ON public.training_exercises;
CREATE POLICY training_exercises_select ON public.training_exercises
  FOR SELECT TO authenticated
  USING (
    (school_id IS NULL AND is_template)
    OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS training_exercises_insert ON public.training_exercises;
CREATE POLICY training_exercises_insert ON public.training_exercises
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      school_id IS NOT NULL
      AND NOT is_template
      AND school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
      AND created_by = (SELECT auth.uid())
    )
    OR (school_id IS NULL AND is_template AND (SELECT public.is_super_admin()))
  );

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
    -- No puede mudarse a una escuela ajena ni volverse plantilla global.
    (
      school_id IS NOT NULL
      AND NOT is_template
      AND school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    )
    OR (school_id IS NULL AND is_template AND (SELECT public.is_super_admin()))
  );

DROP POLICY IF EXISTS training_exercises_delete ON public.training_exercises;
CREATE POLICY training_exercises_delete ON public.training_exercises
  FOR DELETE TO authenticated
  USING (
    (
      school_id IS NOT NULL
      AND (
        (created_by = (SELECT auth.uid()) AND school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]))
        OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
      )
    )
    OR (school_id IS NULL AND (SELECT public.is_super_admin()))
  );

REVOKE ALL ON public.training_exercises FROM PUBLIC;
REVOKE ALL ON public.training_exercises FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_exercises TO authenticated;
GRANT ALL ON public.training_exercises TO service_role;

-- ─── 3. RPC: copiar un ejercicio a un bloque de sesión ───────────────────────
-- Todo en UNA transacción (CLAUDE.md: creación multi-fila = RPC):
--   a) upsert del bloque en training_sessions.session_blocks (solo si hay sesión)
--   b) crea o reemplaza el match_lineups del bloque (source_type
--      'training_session', source_id = id del bloque) con arrows + frames
--   c) borra los match_lineup_players previos del bloque (la jugada se reemplaza)
--   d) times_used + 1
--
-- p_session_id NULL: la sesión todavía no existe (formulario de "Crear sesión").
-- Se pasa p_team_id y solo se arma la jugada del bloque, igual que hoy hace el
-- tablero táctico al abrirse sobre un bloque nuevo (la jugada cuelga del id del
-- bloque, no de la sesión). Los textos del bloque los guarda el formulario.
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

  -- El caller tiene que TRABAJAR en esa escuela (padres/atletas fuera).
  IF v_school IS NULL OR NOT (v_school = ANY (public.user_staff_school_ids())) THEN
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
  'Biblioteca T3: copia un ejercicio a un bloque de sesión (bloque + match_lineups con frames) en una transacción.';

REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) TO service_role;

-- ─── 4. Plantillas SportMaps (school_id NULL, is_template) ──────────────────
-- Coordenadas 0-100 de cancha completa, arco propio abajo (y alto = defensa).
-- Rivales = objeto 'opponent' (rojo; amarillo = arquero rival). Pase =
-- ball_path 'pase' amarillo, remate = ball_path 'remate' rojo, desplazamiento
-- = arrow/curve blanco. Ids fijos: re-aplicar no duplica (ON CONFLICT).
INSERT INTO public.training_exercises
  (id, school_id, created_by, name, objective, minutes, age_group, materials, tags, sport, description, board, is_template, is_active)
VALUES
  ('5b1b0000-0000-4000-8000-000000000001', NULL, NULL, 'Rondo 4v2', 'Conservar el balón a uno o dos toques con el perfil abierto y el pase al pie del compañero libre.', 12, 'Sub-9 en adelante', '4 platillos, 1 balón, 2 petos',
   ARRAY['rondo', 'posesión', 'calentamiento', 'pase']::text[], 'futbol', 'Cuadro de 12×12 m. Cuatro por fuera, dos defensores adentro. Máximo dos toques. Si un defensor toca el balón, entra el que perdió. Variante: un toque obligado o pase que no puede ir al compañero de al lado.',
   '{"players":[{"key":"slot#0","slot_label":"Exterior 1","x":50,"y":42,"jersey_number":1},{"key":"slot#1","slot_label":"Exterior 2","x":62,"y":50,"jersey_number":2},{"key":"slot#2","slot_label":"Exterior 3","x":50,"y":58,"jersey_number":3},{"key":"slot#3","slot_label":"Exterior 4","x":38,"y":50,"jersey_number":4}],"arrows":[{"type":"zone","x1":38,"y1":42,"x2":62,"y2":58,"color":"yellow"},{"type":"cone","x1":38,"y1":42,"x2":38,"y2":42,"color":"orange"},{"type":"cone","x1":62,"y1":42,"x2":62,"y2":42,"color":"orange"},{"type":"cone","x1":62,"y1":58,"x2":62,"y2":58,"color":"orange"},{"type":"cone","x1":38,"y1":58,"x2":38,"y2":58,"color":"orange"},{"type":"opponent","x1":48,"y1":48,"x2":48,"y2":48,"color":"red"},{"type":"opponent","x1":53,"y1":52,"x2":53,"y2":52,"color":"red"},{"type":"ball_path","kind":"pase","x1":50,"y1":42,"x2":62,"y2":50,"color":"yellow"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":42},{"key":"slot#1","x":62,"y":50},{"key":"slot#2","x":50,"y":58},{"key":"slot#3","x":38,"y":50}],"ball":{"x":50,"y":43.5},"arrows":[{"type":"zone","x1":38,"y1":42,"x2":62,"y2":58,"color":"yellow"},{"type":"cone","x1":38,"y1":42,"x2":38,"y2":42,"color":"orange"},{"type":"cone","x1":62,"y1":42,"x2":62,"y2":42,"color":"orange"},{"type":"cone","x1":62,"y1":58,"x2":62,"y2":58,"color":"orange"},{"type":"cone","x1":38,"y1":58,"x2":38,"y2":58,"color":"orange"},{"type":"opponent","x1":48,"y1":48,"x2":48,"y2":48,"color":"red"},{"type":"opponent","x1":53,"y1":52,"x2":53,"y2":52,"color":"red"},{"type":"ball_path","kind":"pase","x1":50,"y1":42,"x2":62,"y2":50,"color":"yellow"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":42},{"key":"slot#1","x":62,"y":50},{"key":"slot#2","x":50,"y":58},{"key":"slot#3","x":38,"y":50}],"ball":{"x":60.5,"y":50},"arrows":[{"type":"zone","x1":38,"y1":42,"x2":62,"y2":58,"color":"yellow"},{"type":"cone","x1":38,"y1":42,"x2":38,"y2":42,"color":"orange"},{"type":"cone","x1":62,"y1":42,"x2":62,"y2":42,"color":"orange"},{"type":"cone","x1":62,"y1":58,"x2":62,"y2":58,"color":"orange"},{"type":"cone","x1":38,"y1":58,"x2":38,"y2":58,"color":"orange"},{"type":"opponent","x1":48,"y1":48,"x2":48,"y2":48,"color":"red"},{"type":"opponent","x1":53,"y1":52,"x2":53,"y2":52,"color":"red"},{"type":"ball_path","kind":"pase","x1":62,"y1":50,"x2":50,"y2":58,"color":"yellow"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":42},{"key":"slot#1","x":62,"y":50},{"key":"slot#2","x":50,"y":58},{"key":"slot#3","x":38,"y":50}],"ball":{"x":50,"y":56.5},"arrows":[{"type":"zone","x1":38,"y1":42,"x2":62,"y2":58,"color":"yellow"},{"type":"cone","x1":38,"y1":42,"x2":38,"y2":42,"color":"orange"},{"type":"cone","x1":62,"y1":42,"x2":62,"y2":42,"color":"orange"},{"type":"cone","x1":62,"y1":58,"x2":62,"y2":58,"color":"orange"},{"type":"cone","x1":38,"y1":58,"x2":38,"y2":58,"color":"orange"},{"type":"opponent","x1":48,"y1":48,"x2":48,"y2":48,"color":"red"},{"type":"opponent","x1":53,"y1":52,"x2":53,"y2":52,"color":"red"},{"type":"ball_path","kind":"pase","x1":50,"y1":58,"x2":38,"y2":50,"color":"yellow"}]}]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000002', NULL, NULL, 'Rondo 5v2 con pivote', 'Encontrar al hombre libre por dentro y jugar con el tercer hombre para superar la presión.', 15, 'Sub-11 en adelante', '4 platillos, 2 balones, 2 petos',
   ARRAY['rondo', 'posesión', 'tercer hombre', 'pase']::text[], 'futbol', 'Cuadro de 14×14 m. Cuatro por fuera y un pivote adentro. Punto extra cada vez que el balón pasa por el pivote y sale al lado contrario. Cambiar defensores cada 90 segundos.',
   '{"players":[{"key":"slot#0","slot_label":"Exterior 1","x":50,"y":40,"jersey_number":1},{"key":"slot#1","slot_label":"Exterior 2","x":64,"y":50,"jersey_number":2},{"key":"slot#2","slot_label":"Exterior 3","x":50,"y":60,"jersey_number":3},{"key":"slot#3","slot_label":"Exterior 4","x":36,"y":50,"jersey_number":4},{"key":"slot#4","slot_label":"Pivote","x":50,"y":50,"jersey_number":5}],"arrows":[{"type":"zone","x1":36,"y1":40,"x2":64,"y2":60,"color":"blue"},{"type":"cone","x1":36,"y1":40,"x2":36,"y2":40,"color":"orange"},{"type":"cone","x1":64,"y1":40,"x2":64,"y2":40,"color":"orange"},{"type":"cone","x1":64,"y1":60,"x2":64,"y2":60,"color":"orange"},{"type":"cone","x1":36,"y1":60,"x2":36,"y2":60,"color":"orange"},{"type":"opponent","x1":45,"y1":45,"x2":45,"y2":45,"color":"red"},{"type":"opponent","x1":56,"y1":55,"x2":56,"y2":55,"color":"red"},{"type":"ball_path","kind":"pase","x1":50,"y1":40,"x2":50,"y2":50,"color":"yellow"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":40},{"key":"slot#1","x":64,"y":50},{"key":"slot#2","x":50,"y":60},{"key":"slot#3","x":36,"y":50},{"key":"slot#4","x":50,"y":50}],"ball":{"x":50,"y":41.5},"arrows":[{"type":"zone","x1":36,"y1":40,"x2":64,"y2":60,"color":"blue"},{"type":"cone","x1":36,"y1":40,"x2":36,"y2":40,"color":"orange"},{"type":"cone","x1":64,"y1":40,"x2":64,"y2":40,"color":"orange"},{"type":"cone","x1":64,"y1":60,"x2":64,"y2":60,"color":"orange"},{"type":"cone","x1":36,"y1":60,"x2":36,"y2":60,"color":"orange"},{"type":"opponent","x1":45,"y1":45,"x2":45,"y2":45,"color":"red"},{"type":"opponent","x1":56,"y1":55,"x2":56,"y2":55,"color":"red"},{"type":"ball_path","kind":"pase","x1":50,"y1":40,"x2":50,"y2":50,"color":"yellow"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":40},{"key":"slot#1","x":64,"y":50},{"key":"slot#2","x":50,"y":60},{"key":"slot#3","x":36,"y":50},{"key":"slot#4","x":50,"y":50}],"ball":{"x":50,"y":51.5},"arrows":[{"type":"zone","x1":36,"y1":40,"x2":64,"y2":60,"color":"blue"},{"type":"cone","x1":36,"y1":40,"x2":36,"y2":40,"color":"orange"},{"type":"cone","x1":64,"y1":40,"x2":64,"y2":40,"color":"orange"},{"type":"cone","x1":64,"y1":60,"x2":64,"y2":60,"color":"orange"},{"type":"cone","x1":36,"y1":60,"x2":36,"y2":60,"color":"orange"},{"type":"opponent","x1":45,"y1":45,"x2":45,"y2":45,"color":"red"},{"type":"opponent","x1":56,"y1":55,"x2":56,"y2":55,"color":"red"},{"type":"ball_path","kind":"pase","x1":50,"y1":50,"x2":64,"y2":50,"color":"yellow"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":40},{"key":"slot#1","x":64,"y":50},{"key":"slot#2","x":50,"y":60},{"key":"slot#3","x":36,"y":50},{"key":"slot#4","x":50,"y":50}],"ball":{"x":62.5,"y":50},"arrows":[{"type":"zone","x1":36,"y1":40,"x2":64,"y2":60,"color":"blue"},{"type":"cone","x1":36,"y1":40,"x2":36,"y2":40,"color":"orange"},{"type":"cone","x1":64,"y1":40,"x2":64,"y2":40,"color":"orange"},{"type":"cone","x1":64,"y1":60,"x2":64,"y2":60,"color":"orange"},{"type":"cone","x1":36,"y1":60,"x2":36,"y2":60,"color":"orange"},{"type":"opponent","x1":45,"y1":45,"x2":45,"y2":45,"color":"red"},{"type":"opponent","x1":56,"y1":55,"x2":56,"y2":55,"color":"red"},{"type":"ball_path","kind":"pase","x1":64,"y1":50,"x2":50,"y2":60,"color":"yellow"}]}]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000003', NULL, NULL, 'Posesión 6v3', 'Dar amplitud y profundidad para mantener el balón con superioridad y cambiar de orientación.', 15, 'Sub-12 en adelante', '4 platillos, 3 balones, 3 petos',
   ARRAY['posesión', 'superioridad', 'cambio de orientación']::text[], 'futbol', 'Espacio de 25×20 m. Dos comodines en los lados cortos y cuatro adentro contra tres. Diez pases seguidos = un punto. Si roban, los defensores deben dar cinco pases para cambiar de rol.',
   '{"players":[{"key":"slot#0","slot_label":"Comodín 1","x":25,"y":50,"jersey_number":1},{"key":"slot#1","slot_label":"Comodín 2","x":75,"y":50,"jersey_number":2},{"key":"slot#2","slot_label":"Interior 1","x":40,"y":38,"jersey_number":3},{"key":"slot#3","slot_label":"Interior 2","x":60,"y":38,"jersey_number":4},{"key":"slot#4","slot_label":"Interior 3","x":40,"y":62,"jersey_number":5},{"key":"slot#5","slot_label":"Interior 4","x":60,"y":62,"jersey_number":6}],"arrows":[{"type":"zone","x1":25,"y1":30,"x2":75,"y2":70,"color":"yellow"},{"type":"cone","x1":25,"y1":30,"x2":25,"y2":30,"color":"orange"},{"type":"cone","x1":75,"y1":30,"x2":75,"y2":30,"color":"orange"},{"type":"cone","x1":75,"y1":70,"x2":75,"y2":70,"color":"orange"},{"type":"cone","x1":25,"y1":70,"x2":25,"y2":70,"color":"orange"},{"type":"opponent","x1":50,"y1":45,"x2":50,"y2":45,"color":"red"},{"type":"opponent","x1":46,"y1":56,"x2":46,"y2":56,"color":"red"},{"type":"opponent","x1":56,"y1":55,"x2":56,"y2":55,"color":"red"},{"type":"ball_path","kind":"pase","x1":25,"y1":50,"x2":40,"y2":38,"color":"yellow"},{"type":"ball_path","kind":"pase","x1":40,"y1":38,"x2":60,"y2":62,"color":"yellow"},{"type":"curve","x1":60,"y1":38,"x2":66,"y2":47,"color":"white"}],"frames":[]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000004', NULL, NULL, 'Salida de balón 4-3-3', 'Salir jugando desde el arquero ante presión de tres: centrales abiertos, laterales altos y volante que ofrece línea de pase.', 20, 'Sub-13 en adelante', 'Media cancha, 6 balones, petos de dos colores',
   ARRAY['salida de balón', '4-3-3', 'construcción', 'táctico']::text[], 'futbol', 'El arquero saca en corto. Los centrales se abren al borde del área, los laterales suben a la altura del volante. Si el rival tapa al volante, el balón va al lateral. Se termina cuando el equipo supera la línea de medio campo con control.',
   '{"players":[{"key":"slot#0","slot_label":"Arquero","x":50,"y":92},{"key":"slot#1","slot_label":"Central izq.","x":33,"y":84},{"key":"slot#2","slot_label":"Central der.","x":67,"y":84},{"key":"slot#3","slot_label":"Lateral izq.","x":10,"y":66},{"key":"slot#4","slot_label":"Lateral der.","x":90,"y":66},{"key":"slot#5","slot_label":"Volante","x":50,"y":72},{"key":"slot#6","slot_label":"Medio izq.","x":30,"y":55},{"key":"slot#7","slot_label":"Medio der.","x":70,"y":55},{"key":"slot#8","slot_label":"Extremo izq.","x":12,"y":34},{"key":"slot#9","slot_label":"Delantero","x":50,"y":28},{"key":"slot#10","slot_label":"Extremo der.","x":88,"y":34}],"arrows":[{"type":"opponent","x1":40,"y1":76,"x2":40,"y2":76,"color":"red"},{"type":"opponent","x1":60,"y1":76,"x2":60,"y2":76,"color":"red"},{"type":"opponent","x1":50,"y1":64,"x2":50,"y2":64,"color":"red"},{"type":"ball_path","kind":"pase","x1":50,"y1":92,"x2":67,"y2":84,"color":"yellow"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":92},{"key":"slot#1","x":33,"y":84},{"key":"slot#2","x":67,"y":84},{"key":"slot#3","x":10,"y":66},{"key":"slot#4","x":90,"y":66},{"key":"slot#5","x":50,"y":72},{"key":"slot#6","x":30,"y":55},{"key":"slot#7","x":70,"y":55},{"key":"slot#8","x":12,"y":34},{"key":"slot#9","x":50,"y":28},{"key":"slot#10","x":88,"y":34}],"ball":{"x":50,"y":90},"arrows":[{"type":"opponent","x1":40,"y1":76,"x2":40,"y2":76,"color":"red"},{"type":"opponent","x1":60,"y1":76,"x2":60,"y2":76,"color":"red"},{"type":"opponent","x1":50,"y1":64,"x2":50,"y2":64,"color":"red"},{"type":"ball_path","kind":"pase","x1":50,"y1":92,"x2":67,"y2":84,"color":"yellow"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":92},{"key":"slot#1","x":33,"y":84},{"key":"slot#2","x":67,"y":84},{"key":"slot#3","x":10,"y":66},{"key":"slot#4","x":90,"y":66},{"key":"slot#5","x":55,"y":70},{"key":"slot#6","x":30,"y":55},{"key":"slot#7","x":70,"y":55},{"key":"slot#8","x":12,"y":34},{"key":"slot#9","x":50,"y":28},{"key":"slot#10","x":88,"y":34}],"ball":{"x":66,"y":82.5},"arrows":[{"type":"opponent","x1":40,"y1":76,"x2":40,"y2":76,"color":"red"},{"type":"opponent","x1":60,"y1":76,"x2":60,"y2":76,"color":"red"},{"type":"opponent","x1":50,"y1":64,"x2":50,"y2":64,"color":"red"},{"type":"arrow","x1":60,"y1":76,"x2":64,"y2":80,"color":"red"},{"type":"ball_path","kind":"pase","x1":67,"y1":84,"x2":90,"y2":64,"color":"yellow"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":50,"y":92},{"key":"slot#1","x":33,"y":84},{"key":"slot#2","x":67,"y":84},{"key":"slot#3","x":10,"y":66},{"key":"slot#4","x":90,"y":64},{"key":"slot#5","x":55,"y":70},{"key":"slot#6","x":30,"y":55},{"key":"slot#7","x":76,"y":50},{"key":"slot#8","x":12,"y":34},{"key":"slot#9","x":50,"y":28},{"key":"slot#10","x":90,"y":26}],"ball":{"x":89,"y":62.5},"arrows":[{"type":"opponent","x1":40,"y1":76,"x2":40,"y2":76,"color":"red"},{"type":"opponent","x1":60,"y1":76,"x2":60,"y2":76,"color":"red"},{"type":"opponent","x1":50,"y1":64,"x2":50,"y2":64,"color":"red"},{"type":"ball_path","kind":"pase","x1":90,"y1":64,"x2":76,"y2":50,"color":"yellow"},{"type":"curve","x1":88,"y1":34,"x2":90,"y2":22,"color":"white"}]}]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000005', NULL, NULL, 'Presión tras pérdida (5 segundos)', 'Recuperar el balón en los primeros cinco segundos tras perderlo, cerrando al poseedor y sus líneas de pase cercanas.', 15, 'Sub-13 en adelante', 'Medio campo, petos, 6 balones',
   ARRAY['presión', 'transición defensiva', 'recuperación', 'táctico']::text[], 'futbol', 'Juego 6v6 en 40×30 m. Cuando un equipo pierde el balón, el más cercano presiona al poseedor y los dos siguientes cierran pases cortos. Recuperar en menos de cinco segundos vale doble.',
   '{"players":[{"key":"slot#0","slot_label":"Delantero","x":52,"y":30},{"key":"slot#1","slot_label":"Extremo izq.","x":30,"y":34},{"key":"slot#2","slot_label":"Extremo der.","x":74,"y":32},{"key":"slot#3","slot_label":"Medio izq.","x":40,"y":48},{"key":"slot#4","slot_label":"Volante","x":55,"y":52},{"key":"slot#5","slot_label":"Medio der.","x":68,"y":46}],"arrows":[{"type":"opponent","x1":58,"y1":40,"x2":58,"y2":40,"color":"red"},{"type":"opponent","x1":45,"y1":30,"x2":45,"y2":30,"color":"red"},{"type":"opponent","x1":75,"y1":42,"x2":75,"y2":42,"color":"red"},{"type":"opponent","x1":55,"y1":22,"x2":55,"y2":22,"color":"red"},{"type":"zone","x1":42,"y1":30,"x2":72,"y2":52,"color":"red"},{"type":"text","x1":57,"y1":27,"x2":57,"y2":27,"text":"Pérdida","color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":52,"y":30},{"key":"slot#1","x":30,"y":34},{"key":"slot#2","x":74,"y":32},{"key":"slot#3","x":40,"y":48},{"key":"slot#4","x":55,"y":52},{"key":"slot#5","x":68,"y":46}],"ball":{"x":58,"y":41.5},"arrows":[{"type":"opponent","x1":58,"y1":40,"x2":58,"y2":40,"color":"red"},{"type":"opponent","x1":45,"y1":30,"x2":45,"y2":30,"color":"red"},{"type":"opponent","x1":75,"y1":42,"x2":75,"y2":42,"color":"red"},{"type":"opponent","x1":55,"y1":22,"x2":55,"y2":22,"color":"red"},{"type":"zone","x1":42,"y1":30,"x2":72,"y2":52,"color":"red"},{"type":"text","x1":57,"y1":27,"x2":57,"y2":27,"text":"Pérdida","color":"white"}]},{"id":"f2","duration_ms":900,"players":[{"key":"slot#0","x":52,"y":38},{"key":"slot#1","x":30,"y":34},{"key":"slot#2","x":74,"y":32},{"key":"slot#3","x":47,"y":42},{"key":"slot#4","x":57,"y":44},{"key":"slot#5","x":64,"y":42}],"ball":{"x":58,"y":41.5},"arrows":[{"type":"opponent","x1":58,"y1":40,"x2":58,"y2":40,"color":"red"},{"type":"opponent","x1":45,"y1":30,"x2":45,"y2":30,"color":"red"},{"type":"opponent","x1":75,"y1":42,"x2":75,"y2":42,"color":"red"},{"type":"opponent","x1":55,"y1":22,"x2":55,"y2":22,"color":"red"},{"type":"zone","x1":42,"y1":30,"x2":72,"y2":52,"color":"red"},{"type":"arrow","x1":55,"y1":52,"x2":57,"y2":44,"color":"white"},{"type":"arrow","x1":68,"y1":46,"x2":64,"y2":42,"color":"white"},{"type":"arrow","x1":52,"y1":30,"x2":52,"y2":38,"color":"white"},{"type":"arrow","x1":40,"y1":48,"x2":47,"y2":42,"color":"white"}]}]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000006', NULL, NULL, '2v1 y finalización', 'Fijar al defensor con la conducción y pasar en el momento justo para terminar con remate.', 15, 'Sub-9 en adelante', '1 arco, 6 balones, platillos',
   ARRAY['finalización', 'superioridad', 'remate', 'ataque']::text[], 'futbol', 'Dos atacantes contra un defensor y arquero desde 30 m. El poseedor conduce hacia el defensor; si lo fija, pasa; si no, remata. Rotar roles cada tres repeticiones.',
   '{"players":[{"key":"slot#0","slot_label":"Atacante 1","x":38,"y":40,"jersey_number":9},{"key":"slot#1","slot_label":"Atacante 2","x":64,"y":40,"jersey_number":11}],"arrows":[{"type":"opponent","x1":51,"y1":28,"x2":51,"y2":28,"color":"red"},{"type":"opponent","x1":50,"y1":4,"x2":50,"y2":4,"color":"yellow"},{"type":"arrow","x1":38,"y1":40,"x2":46,"y2":28,"color":"white"},{"type":"curve","x1":64,"y1":40,"x2":60,"y2":20,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":38,"y":40},{"key":"slot#1","x":64,"y":40}],"ball":{"x":38,"y":38.5},"arrows":[{"type":"opponent","x1":51,"y1":28,"x2":51,"y2":28,"color":"red"},{"type":"opponent","x1":50,"y1":4,"x2":50,"y2":4,"color":"yellow"},{"type":"arrow","x1":38,"y1":40,"x2":46,"y2":28,"color":"white"},{"type":"curve","x1":64,"y1":40,"x2":60,"y2":20,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":46,"y":28},{"key":"slot#1","x":60,"y":20}],"ball":{"x":46,"y":26.5},"arrows":[{"type":"opponent","x1":51,"y1":28,"x2":51,"y2":28,"color":"red"},{"type":"opponent","x1":50,"y1":4,"x2":50,"y2":4,"color":"yellow"},{"type":"ball_path","kind":"pase","x1":46,"y1":28,"x2":60,"y2":20,"color":"yellow"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":46,"y":28},{"key":"slot#1","x":60,"y":20}],"ball":{"x":59,"y":18.5},"arrows":[{"type":"opponent","x1":51,"y1":28,"x2":51,"y2":28,"color":"red"},{"type":"opponent","x1":50,"y1":4,"x2":50,"y2":4,"color":"yellow"},{"type":"ball_path","kind":"remate","x1":60,"y1":20,"x2":47,"y2":1,"color":"red"}]}]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000007', NULL, NULL, 'Centro y remate', 'Llegar al área con ataques coordinados: primer palo, segundo palo y punto penal.', 20, 'Sub-11 en adelante', '1 arco, 2 estacas, 2 platillos, 8 balones',
   ARRAY['centro', 'remate', 'finalización', 'juego por banda']::text[], 'futbol', 'El extremo conduce hasta línea de fondo y centra. El delantero ataca el primer palo, el interior el segundo y el volante llega al punto penal. Alternar banda derecha e izquierda.',
   '{"players":[{"key":"slot#0","slot_label":"Extremo der.","x":86,"y":26,"jersey_number":7},{"key":"slot#1","slot_label":"Delantero","x":50,"y":26,"jersey_number":9},{"key":"slot#2","slot_label":"Interior","x":38,"y":28,"jersey_number":10},{"key":"slot#3","slot_label":"Volante","x":55,"y":38,"jersey_number":8}],"arrows":[{"type":"opponent","x1":50,"y1":3,"x2":50,"y2":3,"color":"yellow"},{"type":"pole","x1":60,"y1":10,"x2":60,"y2":10},{"type":"pole","x1":42,"y1":10,"x2":42,"y2":10},{"type":"cone","x1":86,"y1":26,"x2":86,"y2":26,"color":"orange"},{"type":"cone","x1":90,"y1":8,"x2":90,"y2":8,"color":"orange"},{"type":"arrow","x1":86,"y1":26,"x2":90,"y2":8,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":86,"y":26},{"key":"slot#1","x":50,"y":26},{"key":"slot#2","x":38,"y":28},{"key":"slot#3","x":55,"y":38}],"ball":{"x":86,"y":24.5},"arrows":[{"type":"opponent","x1":50,"y1":3,"x2":50,"y2":3,"color":"yellow"},{"type":"pole","x1":60,"y1":10,"x2":60,"y2":10},{"type":"pole","x1":42,"y1":10,"x2":42,"y2":10},{"type":"cone","x1":86,"y1":26,"x2":86,"y2":26,"color":"orange"},{"type":"cone","x1":90,"y1":8,"x2":90,"y2":8,"color":"orange"},{"type":"arrow","x1":86,"y1":26,"x2":90,"y2":8,"color":"white"}]},{"id":"f2","duration_ms":1000,"players":[{"key":"slot#0","x":90,"y":8},{"key":"slot#1","x":50,"y":26},{"key":"slot#2","x":38,"y":28},{"key":"slot#3","x":55,"y":38}],"ball":{"x":90,"y":9},"arrows":[{"type":"opponent","x1":50,"y1":3,"x2":50,"y2":3,"color":"yellow"},{"type":"pole","x1":60,"y1":10,"x2":60,"y2":10},{"type":"pole","x1":42,"y1":10,"x2":42,"y2":10},{"type":"cone","x1":86,"y1":26,"x2":86,"y2":26,"color":"orange"},{"type":"cone","x1":90,"y1":8,"x2":90,"y2":8,"color":"orange"},{"type":"curve","x1":50,"y1":26,"x2":58,"y2":9,"color":"white"},{"type":"curve","x1":38,"y1":28,"x2":42,"y2":9,"color":"white"},{"type":"arrow","x1":55,"y1":38,"x2":50,"y2":16,"color":"white"},{"type":"ball_path","kind":"pase","x1":90,"y1":8,"x2":57,"y2":9,"color":"yellow"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":90,"y":8},{"key":"slot#1","x":58,"y":9},{"key":"slot#2","x":42,"y":9},{"key":"slot#3","x":50,"y":16}],"ball":{"x":57,"y":8},"arrows":[{"type":"opponent","x1":50,"y1":3,"x2":50,"y2":3,"color":"yellow"},{"type":"pole","x1":60,"y1":10,"x2":60,"y2":10},{"type":"pole","x1":42,"y1":10,"x2":42,"y2":10},{"type":"cone","x1":86,"y1":26,"x2":86,"y2":26,"color":"orange"},{"type":"cone","x1":90,"y1":8,"x2":90,"y2":8,"color":"orange"},{"type":"ball_path","kind":"remate","x1":58,"y1":9,"x2":50,"y2":1,"color":"red"}]}]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000008', NULL, NULL, 'Juego de posición 7v7', 'Ocupar carriles y alturas distintas para generar líneas de pase y atacar el espacio entre líneas.', 25, 'Sub-12 en adelante', 'Cancha de fútbol 7, 2 arcos, petos, platillos para marcar carriles',
   ARRAY['juego de posición', 'fútbol 7', 'amplitud', 'táctico']::text[], 'futbol7', 'Partido 7v7 con carriles marcados. Nunca dos jugadores en el mismo carril a la misma altura. Un gol después de jugar con el punta de espaldas vale doble.',
   '{"players":[{"key":"slot#0","slot_label":"Arquero","x":50,"y":82},{"key":"slot#1","slot_label":"Central izq.","x":32,"y":70},{"key":"slot#2","slot_label":"Central der.","x":68,"y":70},{"key":"slot#3","slot_label":"Carril izq.","x":14,"y":50},{"key":"slot#4","slot_label":"Mediocentro","x":50,"y":54},{"key":"slot#5","slot_label":"Carril der.","x":86,"y":50},{"key":"slot#6","slot_label":"Punta","x":50,"y":28}],"arrows":[{"type":"opponent","x1":50,"y1":18,"x2":50,"y2":18,"color":"red"},{"type":"opponent","x1":38,"y1":34,"x2":38,"y2":34,"color":"red"},{"type":"opponent","x1":62,"y1":34,"x2":62,"y2":34,"color":"red"},{"type":"opponent","x1":30,"y1":48,"x2":30,"y2":48,"color":"red"},{"type":"opponent","x1":70,"y1":48,"x2":70,"y2":48,"color":"red"},{"type":"opponent","x1":50,"y1":42,"x2":50,"y2":42,"color":"red"},{"type":"zone","x1":0,"y1":20,"x2":22,"y2":80,"color":"blue"},{"type":"zone","x1":78,"y1":20,"x2":100,"y2":80,"color":"blue"},{"type":"ball_path","kind":"pase","x1":50,"y1":82,"x2":32,"y2":70,"color":"yellow"},{"type":"ball_path","kind":"pase","x1":32,"y1":70,"x2":50,"y2":54,"color":"yellow"},{"type":"ball_path","kind":"pase","x1":50,"y1":54,"x2":86,"y2":50,"color":"yellow"},{"type":"curve","x1":50,"y1":28,"x2":58,"y2":40,"color":"white"}],"frames":[]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000009', NULL, NULL, 'Transición ofensiva 3v2', 'Atacar rápido tras recuperar: conducir por el centro, abrir con los carrileros y terminar en menos de 8 segundos.', 15, 'Sub-11 en adelante', '1 arco, 8 balones, platillos',
   ARRAY['transición ofensiva', 'contraataque', 'superioridad']::text[], 'futbol', 'Tres atacantes salen desde medio campo contra dos defensores. El conductor fija por dentro y los carrileros atacan el espacio a la espalda. Tiempo máximo: 8 segundos.',
   '{"players":[{"key":"slot#0","slot_label":"Carrilero izq.","x":26,"y":56,"jersey_number":3},{"key":"slot#1","slot_label":"Conductor","x":50,"y":58,"jersey_number":10},{"key":"slot#2","slot_label":"Carrilero der.","x":74,"y":56,"jersey_number":7}],"arrows":[{"type":"opponent","x1":42,"y1":34,"x2":42,"y2":34,"color":"red"},{"type":"opponent","x1":58,"y1":34,"x2":58,"y2":34,"color":"red"},{"type":"opponent","x1":50,"y1":4,"x2":50,"y2":4,"color":"yellow"},{"type":"arrow","x1":50,"y1":58,"x2":50,"y2":40,"color":"white"},{"type":"arrow","x1":26,"y1":56,"x2":22,"y2":28,"color":"white"},{"type":"arrow","x1":74,"y1":56,"x2":78,"y2":28,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":26,"y":56},{"key":"slot#1","x":50,"y":58},{"key":"slot#2","x":74,"y":56}],"ball":{"x":50,"y":56.5},"arrows":[{"type":"opponent","x1":42,"y1":34,"x2":42,"y2":34,"color":"red"},{"type":"opponent","x1":58,"y1":34,"x2":58,"y2":34,"color":"red"},{"type":"opponent","x1":50,"y1":4,"x2":50,"y2":4,"color":"yellow"},{"type":"arrow","x1":50,"y1":58,"x2":50,"y2":40,"color":"white"},{"type":"arrow","x1":26,"y1":56,"x2":22,"y2":28,"color":"white"},{"type":"arrow","x1":74,"y1":56,"x2":78,"y2":28,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":22,"y":28},{"key":"slot#1","x":50,"y":40},{"key":"slot#2","x":78,"y":28}],"ball":{"x":50,"y":38.5},"arrows":[{"type":"opponent","x1":42,"y1":34,"x2":42,"y2":34,"color":"red"},{"type":"opponent","x1":58,"y1":34,"x2":58,"y2":34,"color":"red"},{"type":"opponent","x1":50,"y1":4,"x2":50,"y2":4,"color":"yellow"},{"type":"ball_path","kind":"pase","x1":50,"y1":40,"x2":76,"y2":26,"color":"yellow"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":22,"y":28},{"key":"slot#1","x":50,"y":40},{"key":"slot#2","x":70,"y":18}],"ball":{"x":75,"y":24.5},"arrows":[{"type":"opponent","x1":42,"y1":34,"x2":42,"y2":34,"color":"red"},{"type":"opponent","x1":58,"y1":34,"x2":58,"y2":34,"color":"red"},{"type":"opponent","x1":50,"y1":4,"x2":50,"y2":4,"color":"yellow"},{"type":"ball_path","kind":"remate","x1":70,"y1":18,"x2":53,"y2":1,"color":"red"}]}]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000010', NULL, NULL, 'Línea de 4: basculación', 'Mover la línea de cuatro como un bloque hacia el lado del balón: el lateral presiona, el central cubre y el lateral contrario cierra.', 20, 'Sub-13 en adelante', 'Media cancha, 4 maniquíes o platillos, 6 balones',
   ARRAY['defensa', 'línea de 4', 'basculación', 'táctico']::text[], 'futbol', 'Cuatro defensores contra cuatro atacantes que se pasan el balón por fuera. A cada pase la línea bascula, distancia de 8-10 m entre defensores. El entrenador para y corrige alturas.',
   '{"players":[{"key":"slot#0","slot_label":"Lateral izq.","x":18,"y":70,"jersey_number":3},{"key":"slot#1","slot_label":"Central izq.","x":40,"y":74,"jersey_number":4},{"key":"slot#2","slot_label":"Central der.","x":60,"y":74,"jersey_number":2},{"key":"slot#3","slot_label":"Lateral der.","x":82,"y":70,"jersey_number":5}],"arrows":[{"type":"opponent","x1":16,"y1":52,"x2":16,"y2":52,"color":"red"},{"type":"opponent","x1":42,"y1":56,"x2":42,"y2":56,"color":"red"},{"type":"opponent","x1":62,"y1":56,"x2":62,"y2":56,"color":"red"},{"type":"opponent","x1":86,"y1":50,"x2":86,"y2":50,"color":"red"},{"type":"arrow","x1":82,"y1":70,"x2":84,"y2":58,"color":"white"},{"type":"arrow","x1":60,"y1":74,"x2":70,"y2":70,"color":"white"},{"type":"arrow","x1":40,"y1":74,"x2":54,"y2":74,"color":"white"},{"type":"arrow","x1":18,"y1":70,"x2":36,"y2":72,"color":"white"}],"frames":[{"id":"f1","duration_ms":1400,"players":[{"key":"slot#0","x":18,"y":70},{"key":"slot#1","x":40,"y":74},{"key":"slot#2","x":60,"y":74},{"key":"slot#3","x":82,"y":70}],"ball":{"x":86,"y":51.5},"arrows":[{"type":"opponent","x1":16,"y1":52,"x2":16,"y2":52,"color":"red"},{"type":"opponent","x1":42,"y1":56,"x2":42,"y2":56,"color":"red"},{"type":"opponent","x1":62,"y1":56,"x2":62,"y2":56,"color":"red"},{"type":"opponent","x1":86,"y1":50,"x2":86,"y2":50,"color":"red"},{"type":"arrow","x1":82,"y1":70,"x2":84,"y2":58,"color":"white"},{"type":"arrow","x1":60,"y1":74,"x2":70,"y2":70,"color":"white"},{"type":"arrow","x1":40,"y1":74,"x2":54,"y2":74,"color":"white"},{"type":"arrow","x1":18,"y1":70,"x2":36,"y2":72,"color":"white"}]},{"id":"f2","duration_ms":1200,"players":[{"key":"slot#0","x":36,"y":72},{"key":"slot#1","x":54,"y":74},{"key":"slot#2","x":70,"y":70},{"key":"slot#3","x":84,"y":58}],"ball":{"x":86,"y":51.5},"arrows":[{"type":"opponent","x1":16,"y1":52,"x2":16,"y2":52,"color":"red"},{"type":"opponent","x1":42,"y1":56,"x2":42,"y2":56,"color":"red"},{"type":"opponent","x1":62,"y1":56,"x2":62,"y2":56,"color":"red"},{"type":"opponent","x1":86,"y1":50,"x2":86,"y2":50,"color":"red"},{"type":"ball_path","kind":"pase","x1":86,"y1":50,"x2":16,"y2":52,"color":"yellow"}]},{"id":"f3","duration_ms":1600,"players":[{"key":"slot#0","x":18,"y":60},{"key":"slot#1","x":30,"y":70},{"key":"slot#2","x":46,"y":74},{"key":"slot#3","x":64,"y":72}],"ball":{"x":17.5,"y":52},"arrows":[{"type":"opponent","x1":16,"y1":52,"x2":16,"y2":52,"color":"red"},{"type":"opponent","x1":42,"y1":56,"x2":42,"y2":56,"color":"red"},{"type":"opponent","x1":62,"y1":56,"x2":62,"y2":56,"color":"red"},{"type":"opponent","x1":86,"y1":50,"x2":86,"y2":50,"color":"red"}]}]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000011', NULL, NULL, 'Saque de esquina ofensivo', 'Atacar el saque de esquina con carreras sincronizadas a primer palo, segundo palo y punto penal, con un jugador para el rechace.', 15, 'Sub-12 en adelante', '1 arco, 10 balones, 3 maniquíes',
   ARRAY['balón parado', 'tiro de esquina', 'remate de cabeza']::text[], 'futbol', 'Cada jugador sale de su marca en el momento en que el lanzador levanta el brazo. Primer palo peina, segundo palo cierra, punto penal remata. El de borde del área y el de rechace evitan la contra.',
   '{"players":[{"key":"slot#0","slot_label":"Lanzador","x":98,"y":1,"jersey_number":7},{"key":"slot#1","slot_label":"Primer palo","x":62,"y":18,"jersey_number":9},{"key":"slot#2","slot_label":"Segundo palo","x":40,"y":16,"jersey_number":4},{"key":"slot#3","slot_label":"Punto penal","x":52,"y":22,"jersey_number":5},{"key":"slot#4","slot_label":"Borde del área","x":50,"y":30,"jersey_number":10},{"key":"slot#5","slot_label":"Rechace","x":70,"y":32,"jersey_number":8}],"arrows":[{"type":"opponent","x1":50,"y1":2,"x2":50,"y2":2,"color":"yellow"},{"type":"opponent","x1":58,"y1":8,"x2":58,"y2":8,"color":"red"},{"type":"opponent","x1":46,"y1":10,"x2":46,"y2":10,"color":"red"},{"type":"opponent","x1":52,"y1":14,"x2":52,"y2":14,"color":"red"},{"type":"opponent","x1":62,"y1":12,"x2":62,"y2":12,"color":"red"},{"type":"curve","x1":62,"y1":18,"x2":58,"y2":6,"color":"white"},{"type":"curve","x1":40,"y1":16,"x2":46,"y2":6,"color":"white"},{"type":"arrow","x1":52,"y1":22,"x2":52,"y2":11,"color":"white"}],"frames":[{"id":"f1","duration_ms":1200,"players":[{"key":"slot#0","x":98,"y":1},{"key":"slot#1","x":62,"y":18},{"key":"slot#2","x":40,"y":16},{"key":"slot#3","x":52,"y":22},{"key":"slot#4","x":50,"y":30},{"key":"slot#5","x":70,"y":32}],"ball":{"x":97,"y":2},"arrows":[{"type":"opponent","x1":50,"y1":2,"x2":50,"y2":2,"color":"yellow"},{"type":"opponent","x1":58,"y1":8,"x2":58,"y2":8,"color":"red"},{"type":"opponent","x1":46,"y1":10,"x2":46,"y2":10,"color":"red"},{"type":"opponent","x1":52,"y1":14,"x2":52,"y2":14,"color":"red"},{"type":"opponent","x1":62,"y1":12,"x2":62,"y2":12,"color":"red"},{"type":"curve","x1":62,"y1":18,"x2":58,"y2":6,"color":"white"},{"type":"curve","x1":40,"y1":16,"x2":46,"y2":6,"color":"white"},{"type":"arrow","x1":52,"y1":22,"x2":52,"y2":11,"color":"white"}]},{"id":"f2","duration_ms":900,"players":[{"key":"slot#0","x":98,"y":1},{"key":"slot#1","x":58,"y":6},{"key":"slot#2","x":46,"y":6},{"key":"slot#3","x":52,"y":11},{"key":"slot#4","x":50,"y":30},{"key":"slot#5","x":70,"y":32}],"ball":{"x":97,"y":2},"arrows":[{"type":"opponent","x1":50,"y1":2,"x2":50,"y2":2,"color":"yellow"},{"type":"opponent","x1":58,"y1":8,"x2":58,"y2":8,"color":"red"},{"type":"opponent","x1":46,"y1":10,"x2":46,"y2":10,"color":"red"},{"type":"opponent","x1":52,"y1":14,"x2":52,"y2":14,"color":"red"},{"type":"opponent","x1":62,"y1":12,"x2":62,"y2":12,"color":"red"},{"type":"ball_path","kind":"pase","x1":98,"y1":1,"x2":58,"y2":6,"color":"yellow"}]},{"id":"f3","duration_ms":1200,"players":[{"key":"slot#0","x":98,"y":1},{"key":"slot#1","x":58,"y":6},{"key":"slot#2","x":46,"y":6},{"key":"slot#3","x":52,"y":11},{"key":"slot#4","x":50,"y":30},{"key":"slot#5","x":70,"y":32}],"ball":{"x":58,"y":6},"arrows":[{"type":"opponent","x1":50,"y1":2,"x2":50,"y2":2,"color":"yellow"},{"type":"opponent","x1":58,"y1":8,"x2":58,"y2":8,"color":"red"},{"type":"opponent","x1":46,"y1":10,"x2":46,"y2":10,"color":"red"},{"type":"opponent","x1":52,"y1":14,"x2":52,"y2":14,"color":"red"},{"type":"opponent","x1":62,"y1":12,"x2":62,"y2":12,"color":"red"},{"type":"ball_path","kind":"remate","x1":58,"y1":6,"x2":50,"y2":0,"color":"red"}]}]}'::jsonb, true, true),
  ('5b1b0000-0000-4000-8000-000000000012', NULL, NULL, 'Circuito de conducción', 'Conducir con las dos piernas y cambiar de ritmo entre conos, coordinación y remate final.', 12, 'Sub-7 en adelante', '5 conos, 1 escalera, 2 aros, 1 valla, 1 arco chico, 1 balón por jugador',
   ARRAY['conducción', 'coordinación', 'técnica', 'iniciación']::text[], 'futbol', 'Zigzag en conducción entre conos, escalera de coordinación sin balón, saltos en los aros, valla y remate al arco chico. Salen con 5 segundos de diferencia. Variante: solo pierna menos hábil.',
   '{"players":[{"key":"slot#0","slot_label":"Jugador 1","x":20,"y":88,"jersey_number":1},{"key":"slot#1","slot_label":"Jugador 2","x":14,"y":92,"jersey_number":2},{"key":"slot#2","slot_label":"Jugador 3","x":26,"y":92,"jersey_number":3}],"arrows":[{"type":"cone","x1":20,"y1":80,"x2":20,"y2":80,"color":"orange"},{"type":"cone","x1":30,"y1":72,"x2":30,"y2":72,"color":"orange"},{"type":"cone","x1":20,"y1":64,"x2":20,"y2":64,"color":"orange"},{"type":"cone","x1":30,"y1":56,"x2":30,"y2":56,"color":"orange"},{"type":"cone","x1":20,"y1":48,"x2":20,"y2":48,"color":"orange"},{"type":"ladder","x1":40,"y1":40,"x2":40,"y2":40,"rot":90},{"type":"ring","x1":55,"y1":34,"x2":55,"y2":34},{"type":"ring","x1":62,"y1":30,"x2":62,"y2":30},{"type":"hurdle","x1":70,"y1":26,"x2":70,"y2":26},{"type":"mini_goal","x1":82,"y1":14,"x2":82,"y2":14,"rot":0},{"type":"ball","x1":20,"y1":86,"x2":20,"y2":86},{"type":"freehand","x1":20,"y1":48,"x2":30,"y2":86,"color":"white","points":[20,86,26,76,24,68,26,60,24,52,22,48]},{"type":"arrow","x1":22,"y1":48,"x2":38,"y2":42,"color":"white"},{"type":"arrow","x1":44,"y1":38,"x2":54,"y2":34,"color":"white"},{"type":"arrow","x1":62,"y1":30,"x2":69,"y2":27,"color":"white"},{"type":"ball_path","kind":"remate","x1":72,"y1":24,"x2":81,"y2":15,"color":"red"}],"frames":[]}'::jsonb, true, true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
