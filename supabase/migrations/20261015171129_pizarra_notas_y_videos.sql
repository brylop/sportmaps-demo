-- =============================================================================
-- 20261014163705_pizarra_notas_y_videos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014125632
-- Objetivo: M6c de docs/specs/pizarra-m6-paridad-tacticalpad.md — notas y
--   videos por jugada y por cuadro, y «Videos guardados» por escuela.
--
--   1. Funciones de forma (IMMUTABLE) tactical_play_notes_ok / tactical_play_videos_ok,
--      usadas por los CHECK de las tres tablas de jugadas.
--   2. match_lineups / team_tactical_presets: columnas notes jsonb + videos jsonb
--      (NULL = sin notas ni videos: retrocompatible, sin reescribir filas).
--   3. training_exercises: notes/videos viajan DENTRO de board (board.notes,
--      board.videos): CHECK de forma sobre esas dos llaves.
--   4. public.tactical_saved_videos: enlaces guardados por escuela.
--      RLS: leen staff (user_staff_school_ids()); escriben quienes editan la
--      pizarra (user_tactical_edit_school_ids()). anon nada. Padres y atletas
--      no leen (la jugada es solo del cuerpo técnico desde 20261005173002).
--   5. insert_exercise_into_session_block: copia también board.notes /
--      board.videos a la jugada del bloque (mismo cuerpo que 20261013200604,
--      solo se agregan esas dos columnas).
--
-- ── Decisión: columnas jsonb + una tabla (y no una tabla de medios) ──────────
--   · La nota y los videos SON parte de la jugada: se guardan, se copian
--     («Insertar en sesión», paquetes) y se exportan junto con ella. En jsonb
--     viajan en la misma escritura que frames/arrows (sin transacción extra, sin
--     joins en las lecturas de la pizarra) y una jugada vieja sigue igual (NULL).
--   · La nota de cada CUADRO va dentro de frames[i].note: así sigue al cuadro
--     al reordenar, duplicar o borrar, y ya la cubre el CHECK de tamaño de
--     frames (512 KB). El BFF limita cada nota a 280 caracteres.
--   · training_exercises ya guarda la jugada en `board` (jsonb con su CHECK de
--     512 KB): notes/videos van ahí y import_exercise_pack los inserta tal cual,
--     sin tocar esa RPC.
--   · «Videos guardados» sí es una tabla: es una biblioteca de la ESCUELA que se
--     reusa en muchas jugadas, con dueño, borrado y RLS propia.
--
-- ── Proveedores ───────────────────────────────────────────────────────────────
--   youtube / vimeo: se guarda el id (regex estricta) y el frontend arma el
--   embed (youtube-nocookie.com / player.vimeo.com). veo, hudl, trace, pixellot
--   (también VidSwap), spiideo, xbotgo, reeplayer, drive, dropbox: se guarda la
--   URL https de un dominio de la lista exacta y se abre en otra pestaña (no
--   tienen embed público verificado). 'sportmaps' (subir desde el celular, M6h)
--   queda RESERVADO: exige asset_id uuid y nada lo crea todavía.
--   Cero almacenamiento: ningún archivo se sube.
--
-- ── Radio (leído del repo; sin consultar la base para no gastar Disk IO) ──────
--   · match_lineups / team_tactical_presets: ADD COLUMN NULL sin default =
--     solo catálogo, sin reescritura. Los CHECK nuevos se validan sobre filas
--     con notes/videos NULL (todas): pasan sin costo apreciable.
--   · training_exercises: ~28 filas (plantillas) con board sin notes/videos:
--     el CHECK nuevo pasa en todas.
--   · Policies existentes de las tres tablas: no se tocan (las columnas nuevas
--     quedan bajo las mismas policies de lectura staff / escritura táctica).
--   · tactical_saved_videos: tabla nueva, vacía. Nadie pierde nada.
--   · La RPC se reemplaza con la MISMA firma, gate y grants.
--
-- Depende de: 20261008155454 (frames), 20261008183744 (training_exercises),
-- 20261013200604 (RPC vigente + helpers), helpers user_*_school_ids().
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

-- ─── 0. Dependencias ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.training_exercises') IS NULL THEN
    RAISE EXCEPTION 'Falta public.training_exercises: aplicar 20261008183744 antes que esta migración.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'match_lineups' AND column_name = 'frames') THEN
    RAISE EXCEPTION 'Falta match_lineups.frames: aplicar 20261008155454 antes que esta migración.';
  END IF;
  IF to_regprocedure('public.user_tactical_edit_school_ids()') IS NULL
     OR to_regprocedure('public.user_staff_school_ids()') IS NULL THEN
    RAISE EXCEPTION 'Faltan los helpers de RLS user_*_school_ids().';
  END IF;
END $$;

-- ─── 1. Funciones de forma ──────────────────────────────────────────────────
-- Un dominio de enlace: https://<host exacto>/<algo>, sin usuario ni puerto.
CREATE OR REPLACE FUNCTION public.tactical_video_url_ok(p_provider text, p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p_url IS NOT NULL
     AND char_length(p_url) <= 500
     AND p_url !~ '[[:space:]<>"`\\]'
     AND CASE p_provider
       WHEN 'veo'       THEN p_url ~ '^https://(www\.|app\.)?veo\.co/[^/?#]'
       WHEN 'hudl'      THEN p_url ~ '^https://(www\.|fan\.)?hudl\.com/[^/?#]'
       WHEN 'trace'     THEN p_url ~ '^https://(www\.|app\.)?traceup\.com/[^/?#]'
       WHEN 'pixellot'  THEN p_url ~ '^https://((www\.|app\.)?pixellot\.tv|(www\.)?vidswap\.com)/[^/?#]'
       WHEN 'spiideo'   THEN p_url ~ '^https://(www\.|play\.|app\.)?spiideo\.com/[^/?#]'
       WHEN 'xbotgo'    THEN p_url ~ '^https://(www\.|app\.)?xbotgo\.com/[^/?#]'
       WHEN 'reeplayer' THEN p_url ~ '^https://(www\.|app\.)?reeplayer\.com/[^/?#]'
       WHEN 'drive'     THEN p_url ~ '^https://drive\.google\.com/file/d/[A-Za-z0-9_-]{20,100}/view$'
       WHEN 'dropbox'   THEN p_url ~ '^https://(www\.)?dropbox\.com/(s|scl/fi)/'
       ELSE false
     END
$$;

-- Un video (elemento de videos o fila de tactical_saved_videos).
CREATE OR REPLACE FUNCTION public.tactical_video_ok(
  p_provider text, p_video_id text, p_hash text, p_url text, p_asset_id text,
  p_title text, p_start int, p_end int
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(
       p_title IS NOT NULL AND char_length(btrim(p_title)) BETWEEN 1 AND 120
       AND p_start IS NOT NULL AND p_start BETWEEN 0 AND 21600
       AND (p_end IS NULL OR (p_end > p_start AND p_end <= 21600))
       AND CASE p_provider
         WHEN 'youtube'   THEN p_video_id ~ '^[A-Za-z0-9_-]{11}$' AND p_hash IS NULL AND p_url IS NULL AND p_asset_id IS NULL
         WHEN 'vimeo'     THEN p_video_id ~ '^[0-9]{6,12}$' AND (p_hash IS NULL OR p_hash ~ '^[0-9a-f]{6,20}$') AND p_url IS NULL AND p_asset_id IS NULL
         -- Reservado para M6h (video subido): solo la forma, nada lo crea todavía.
         WHEN 'sportmaps' THEN p_asset_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND p_url IS NULL AND p_hash IS NULL
         WHEN 'drive'     THEN public.tactical_video_url_ok(p_provider, p_url) AND p_hash IS NULL AND p_asset_id IS NULL
                               AND (p_video_id IS NULL OR p_video_id ~ '^[A-Za-z0-9_-]{20,100}$')
         WHEN 'veo' THEN true WHEN 'hudl' THEN true WHEN 'trace' THEN true WHEN 'pixellot' THEN true
         WHEN 'spiideo' THEN true WHEN 'xbotgo' THEN true WHEN 'reeplayer' THEN true WHEN 'dropbox' THEN true
         ELSE false
       END
       AND (p_provider NOT IN ('veo','hudl','trace','pixellot','spiideo','xbotgo','reeplayer','dropbox')
            OR (public.tactical_video_url_ok(p_provider, p_url) AND p_video_id IS NULL AND p_hash IS NULL AND p_asset_id IS NULL)),
     false)
$$;

-- notes = { text ≤ 2000, tags ≤ 10 de ≤ 40 }, nada más.
CREATE OR REPLACE FUNCTION public.tactical_play_notes_ok(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p IS NULL OR CASE WHEN jsonb_typeof(p) <> 'object' THEN false ELSE (
       octet_length(p::text) <= 16384
       AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('text', 'tags'))
       AND (NOT p ? 'text' OR (jsonb_typeof(p->'text') = 'string' AND char_length(p->>'text') <= 2000))
       AND (NOT p ? 'tags' OR CASE WHEN jsonb_typeof(p->'tags') <> 'array' THEN false ELSE (
             jsonb_array_length(p->'tags') <= 10
             AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p->'tags') t
                              WHERE jsonb_typeof(t) <> 'string' OR char_length(t #>> '{}') NOT BETWEEN 1 AND 40)
           ) END)
     ) END
$$;

-- videos = [video, …] ≤ 10.
CREATE OR REPLACE FUNCTION public.tactical_play_videos_ok(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p IS NULL OR CASE WHEN jsonb_typeof(p) <> 'array' THEN false ELSE (
       jsonb_array_length(p) <= 10
       AND octet_length(p::text) <= 16384
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(p) v
          WHERE jsonb_typeof(v) <> 'object'
             OR (v ? 'is_private' AND jsonb_typeof(v->'is_private') <> 'boolean')
             OR (v ? 'start_s' AND jsonb_typeof(v->'start_s') <> 'number')
             OR (v ? 'end_s' AND jsonb_typeof(v->'end_s') NOT IN ('number', 'null'))
             OR NOT public.tactical_video_ok(
                  v->>'provider', v->>'video_id', v->>'hash', v->>'url', v->>'asset_id', v->>'title',
                  CASE WHEN jsonb_typeof(v->'start_s') = 'number' AND (v->>'start_s') ~ '^[0-9]{1,6}$' THEN (v->>'start_s')::int
                       WHEN v ? 'start_s' THEN -1 ELSE 0 END,
                  CASE WHEN jsonb_typeof(v->'end_s') = 'number' AND (v->>'end_s') ~ '^[0-9]{1,6}$' THEN (v->>'end_s')::int
                       WHEN jsonb_typeof(v->'end_s') = 'number' THEN -1 ELSE NULL END)
       )
     ) END
$$;

-- Usadas en CHECK: las evalúa quien escribe. EXECUTE explícito a quien escribe
-- las tablas (authenticated por RLS, service_role por el BFF); anon no escribe.
REVOKE ALL ON FUNCTION public.tactical_video_url_ok(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tactical_video_ok(text, text, text, text, text, text, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tactical_play_notes_ok(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tactical_play_videos_ok(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tactical_video_url_ok(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tactical_video_ok(text, text, text, text, text, text, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tactical_play_notes_ok(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tactical_play_videos_ok(jsonb) TO authenticated, service_role;

-- ─── 2. Columnas de las jugadas ─────────────────────────────────────────────
ALTER TABLE public.match_lineups
  ADD COLUMN IF NOT EXISTS notes jsonb,
  ADD COLUMN IF NOT EXISTS videos jsonb;
ALTER TABLE public.team_tactical_presets
  ADD COLUMN IF NOT EXISTS notes jsonb,
  ADD COLUMN IF NOT EXISTS videos jsonb;

ALTER TABLE public.match_lineups DROP CONSTRAINT IF EXISTS match_lineups_media_shape_check;
ALTER TABLE public.match_lineups
  ADD CONSTRAINT match_lineups_media_shape_check
  CHECK (public.tactical_play_notes_ok(notes) AND public.tactical_play_videos_ok(videos));

ALTER TABLE public.team_tactical_presets DROP CONSTRAINT IF EXISTS team_tactical_presets_media_shape_check;
ALTER TABLE public.team_tactical_presets
  ADD CONSTRAINT team_tactical_presets_media_shape_check
  CHECK (public.tactical_play_notes_ok(notes) AND public.tactical_play_videos_ok(videos));

COMMENT ON COLUMN public.match_lineups.notes IS
  'Pizarra M6c: nota de la jugada { text (markdown mínimo ≤ 2000), tags[] ≤ 10 }. NULL = sin nota. Notas por cuadro: frames[i].note.';
COMMENT ON COLUMN public.match_lineups.videos IS
  'Pizarra M6c: videos por enlace [{provider, video_id|url|asset_id, hash?, title, start_s, end_s, is_private}] ≤ 10. Sin archivos.';
COMMENT ON COLUMN public.team_tactical_presets.notes IS 'Pizarra M6c: igual que match_lineups.notes.';
COMMENT ON COLUMN public.team_tactical_presets.videos IS 'Pizarra M6c: igual que match_lineups.videos.';

-- ─── 3. training_exercises: board.notes / board.videos ──────────────────────
ALTER TABLE public.training_exercises DROP CONSTRAINT IF EXISTS training_exercises_board_media_check;
ALTER TABLE public.training_exercises
  ADD CONSTRAINT training_exercises_board_media_check
  CHECK (public.tactical_play_notes_ok(NULLIF(board->'notes', 'null'::jsonb))
     AND public.tactical_play_videos_ok(NULLIF(board->'videos', 'null'::jsonb)));

-- ─── 4. tactical_saved_videos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tactical_saved_videos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider    text NOT NULL CHECK (provider IN (
                'youtube','vimeo','veo','hudl','trace','pixellot','spiideo','xbotgo','reeplayer','drive','dropbox','sportmaps')),
  video_id    text,
  hash        text,
  url         text,
  asset_id    uuid,
  title       text NOT NULL,
  start_s     integer NOT NULL DEFAULT 0,
  end_s       integer,
  -- «Enlace privado»: no sale en exportaciones públicas (PDF, paquetes).
  is_private  boolean NOT NULL DEFAULT false,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_saved_videos_shape_check CHECK (
    public.tactical_video_ok(provider, video_id, hash, url, asset_id::text, title, start_s, end_s)
  )
);

COMMENT ON TABLE public.tactical_saved_videos IS
  'Pizarra M6c: «Videos guardados» de la escuela (solo enlaces, cero almacenamiento). Leen staff; escriben quienes editan la pizarra.';

CREATE INDEX IF NOT EXISTS tactical_saved_videos_school_idx
  ON public.tactical_saved_videos (school_id, created_at DESC);
-- El mismo video con el mismo inicio no se guarda dos veces en la escuela.
CREATE UNIQUE INDEX IF NOT EXISTS tactical_saved_videos_unique_idx
  ON public.tactical_saved_videos (school_id, provider, COALESCE(video_id, url, asset_id::text), start_s);

DROP TRIGGER IF EXISTS tactical_saved_videos_set_updated_at ON public.tactical_saved_videos;
CREATE TRIGGER tactical_saved_videos_set_updated_at
  BEFORE UPDATE ON public.tactical_saved_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tactical_saved_videos ENABLE ROW LEVEL SECURITY;

-- Los default privileges del esquema dan todo a anon/authenticated: explícito.
REVOKE ALL ON public.tactical_saved_videos FROM PUBLIC;
REVOKE ALL ON public.tactical_saved_videos FROM anon;
REVOKE ALL ON public.tactical_saved_videos FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactical_saved_videos TO authenticated;
GRANT ALL ON public.tactical_saved_videos TO service_role;

-- Una policy por comando (nada de FOR ALL), helpers envueltos en (SELECT …)
-- para que se evalúen una vez por consulta. Sin SELECT sobre esta tabla.
DROP POLICY IF EXISTS tactical_saved_videos_select ON public.tactical_saved_videos;
CREATE POLICY tactical_saved_videos_select ON public.tactical_saved_videos
  FOR SELECT TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS tactical_saved_videos_insert ON public.tactical_saved_videos;
CREATE POLICY tactical_saved_videos_insert ON public.tactical_saved_videos
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[])
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS tactical_saved_videos_update ON public.tactical_saved_videos;
CREATE POLICY tactical_saved_videos_update ON public.tactical_saved_videos
  FOR UPDATE TO authenticated
  USING (school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]))
  WITH CHECK (school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]));

DROP POLICY IF EXISTS tactical_saved_videos_delete ON public.tactical_saved_videos;
CREATE POLICY tactical_saved_videos_delete ON public.tactical_saved_videos
  FOR DELETE TO authenticated
  USING (school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]));

-- ─── 5. RPC: copiar notes/videos del ejercicio al bloque ────────────────────
-- Cuerpo idéntico a 20261013200604 salvo v_notes / v_videos (comentados «M6c»).
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
  v_notes      jsonb;  -- M6c
  v_videos     jsonb;  -- M6c
  v_lineup_id  uuid;
  v_lineup_sch uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_exercise_id IS NULL OR p_block_id IS NULL THEN
    RAISE EXCEPTION 'p_exercise_id y p_block_id son requeridos.' USING ERRCODE = '22023';
  END IF;

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

  IF v_school IS NULL OR NOT (v_school = ANY (public.user_tactical_edit_school_ids())) THEN
    RAISE EXCEPTION 'No tienes permiso sobre esta sesión.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ex
    FROM public.training_exercises e
   WHERE e.id = p_exercise_id
     AND e.is_active
   FOR UPDATE;
  IF NOT FOUND
     OR NOT ((v_ex.school_id IS NULL AND v_ex.is_template) OR v_ex.school_id = v_school) THEN
    RAISE EXCEPTION 'Ejercicio no encontrado.' USING ERRCODE = 'P0002';
  END IF;

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

  v_board  := COALESCE(v_ex.board, '{}'::jsonb);
  v_arrows := CASE WHEN jsonb_typeof(v_board->'arrows') = 'array' THEN v_board->'arrows' ELSE '[]'::jsonb END;
  v_frames := CASE WHEN jsonb_typeof(v_board->'frames') = 'array' THEN v_board->'frames' ELSE '[]'::jsonb END;
  -- M6c: la nota y los videos del ejercicio pasan a la jugada del bloque (el
  -- CHECK de training_exercises ya garantiza la misma forma que exige match_lineups).
  v_notes  := CASE WHEN jsonb_typeof(v_board->'notes') = 'object' THEN v_board->'notes' ELSE NULL END;
  v_videos := CASE WHEN jsonb_typeof(v_board->'videos') = 'array' AND jsonb_array_length(v_board->'videos') > 0
                   THEN v_board->'videos' ELSE NULL END;
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
       SET team_id = v_team, arrows = v_arrows, frames = v_frames, formation = NULL,
           notes = v_notes, videos = v_videos, updated_at = now()
     WHERE id = v_lineup_id;
    DELETE FROM public.match_lineup_players WHERE lineup_id = v_lineup_id;
  ELSE
    INSERT INTO public.match_lineups (school_id, team_id, source_type, source_id, formation, arrows, frames, notes, videos, created_by)
    VALUES (v_school, v_team, 'training_session', p_block_id, NULL, v_arrows, v_frames, v_notes, v_videos, v_uid)
    RETURNING id INTO v_lineup_id;
  END IF;

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
  'Biblioteca T3: copia un ejercicio a un bloque de sesión (bloque + match_lineups con frames, notes y videos) en una transacción. Exige user_tactical_edit_school_ids() (20261013200604; notas/videos 20261014163705).';

REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_exercise_into_session_block(uuid, uuid, uuid, uuid) TO service_role;

COMMIT;
