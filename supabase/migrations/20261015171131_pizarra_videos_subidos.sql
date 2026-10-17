-- =============================================================================
-- 20261015145434_pizarra_videos_subidos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014125632
-- Objetivo: M6h fase 1 de docs/specs/pizarra-m6h-videos-subidos.md — videos que
--   el cuerpo técnico SUBE (del celular, o descargados de Veo/Hudl/Trace…) a un
--   proveedor de video externo (Bunny Stream recomendado), con cupo por escuela
--   y clips (inicio/fin) vinculables a una jugada. NADA del archivo pasa por
--   Supabase Storage ni por el BFF: el navegador sube directo al proveedor (tus).
--
--   1. school_video_settings: interruptor (flag) + cupo por escuela. Una fila
--      por escuela; sin fila = apagado. Solo SportMaps (super admin) la cambia,
--      por RPC. Los contadores used_* solo los mueven RPCs SECURITY DEFINER con
--      SELECT … FOR UPDATE sobre esta fila (regla de contadores del repo).
--   2. school_videos: un video subido. id = asset_id que reserva el modelo de
--      videos por enlace de M6c (provider 'sportmaps' + asset_id uuid,
--      20261014163705): una jugada referencia el video subido con ese id.
--   3. school_video_clips: tramos [start_s, end_s) de un video, con nombre y
--      vinculables a UNA jugada (match_lineups | team_tactical_presets |
--      training_exercises), polimórfico por columnas nulas + CHECK.
--   4. RPCs: begin_school_video_upload (reserva cupo + crea la fila, una
--      transacción), attach_school_video_asset, settle_school_video (webhook,
--      solo service_role), soft_delete_school_video, set_school_video_settings
--      (super admin), expire_stale_school_video_uploads (service_role).
--
-- ── Permisos (fase 1: SOLO el cuerpo técnico) ────────────────────────────────
--   · LEEN: staff de la escuela (user_staff_school_ids(): sin padres ni atletas).
--   · SUBEN / EDITAN / RECORTAN: quienes editan la pizarra
--     (user_tactical_edit_school_ids()). Subir es SOLO por RPC (reserva cupo).
--     Editar el video = UPDATE con GRANT por columna (título, equipo, fecha,
--     origen): estado, tamaño, duración, escuela, consentimiento y borrado NO.
--   · BORRAN: el autor (si sigue siendo táctico en la escuela) o un admin de la
--     escuela (user_admin_school_ids()). Borrado lógico por RPC, que además
--     devuelve el cupo.
--   · Padres y atletas: NADA en esta fase. consent_scope existe para la fase 4
--     («compartir con familias con consentimiento»), pero solo puede valer
--     'staff' hasta que exista el registro de consentimiento (CHECK de abajo;
--     relajarlo será una migración nueva junto con sus policies).
--   · anon: nada (REVOKE explícito; los default privileges del esquema dan todo).
--   · Ninguna policy FOR ALL; toda policy de escritura con WITH CHECK.
--
-- ── Cupo (control de costo) ──────────────────────────────────────────────────
--   El costo del proveedor es por almacenamiento acumulado (minutos o GB que
--   siguen guardados) + entrega. El cupo es de ALMACENAMIENTO VIVO: subir
--   reserva max_duration_s y size_bytes declarados; el webhook (settle) cambia la
--   reserva por lo real; borrar lo devuelve. counted_seconds/counted_bytes de
--   cada video = lo que ese video tiene cargado al cupo en este momento, así
--   settle y delete son idempotentes (delta = real − contado).
--   Defaults: 600 min (10 h) y 25 GB por escuela, archivo ≤ 4 GB, ≤ 3 h.
--
-- ── Radio (leído del repo; sin consultar la base: regla de Disk IO) ─────────
--   Tablas nuevas y vacías; ninguna policy ni función existente cambia. Ninguna
--   escuela ve nada nuevo hasta que SportMaps le crea su fila con enabled=true.
--
-- Depende de: helpers user_staff_school_ids(), user_tactical_edit_school_ids(),
--   user_admin_school_ids(), is_super_admin(); set_updated_at(); tablas schools,
--   teams, profiles, match_lineups, team_tactical_presets, training_exercises.
--
-- NO APLICADA. Al aplicarla (UNA sola sesión, ver CLAUDE.md «Disk IO»):
--   npm run seguridad:invariantes  y  npm run seguridad:rls-pizarra (casos
--   «esperado tras 20261015145434» de scripts/rls-pruebas-pizarra.mjs).
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
  IF to_regprocedure('public.user_tactical_edit_school_ids()') IS NULL
     OR to_regprocedure('public.user_staff_school_ids()') IS NULL
     OR to_regprocedure('public.user_admin_school_ids()') IS NULL
     OR to_regprocedure('public.is_super_admin()') IS NULL THEN
    RAISE EXCEPTION 'Faltan los helpers de RLS user_*_school_ids() / is_super_admin().';
  END IF;
  IF to_regclass('public.training_exercises') IS NULL THEN
    RAISE EXCEPTION 'Falta public.training_exercises: aplicar 20261008183744 antes que esta migración.';
  END IF;
  IF to_regprocedure('public.set_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'Falta public.set_updated_at().';
  END IF;
END $$;

-- ─── 1. school_video_settings (flag + cupo) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_video_settings (
  school_id          uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  enabled            boolean NOT NULL DEFAULT false,
  quota_seconds      integer NOT NULL DEFAULT 36000      CHECK (quota_seconds BETWEEN 0 AND 3600000),
  quota_bytes        bigint  NOT NULL DEFAULT 26843545600 CHECK (quota_bytes BETWEEN 0 AND 10995116277760),
  max_upload_bytes   bigint  NOT NULL DEFAULT 4294967296  CHECK (max_upload_bytes BETWEEN 1048576 AND 53687091200),
  max_duration_s     integer NOT NULL DEFAULT 10800       CHECK (max_duration_s BETWEEN 60 AND 43200),
  used_seconds       bigint  NOT NULL DEFAULT 0 CHECK (used_seconds >= 0),
  used_bytes         bigint  NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  updated_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.school_video_settings IS
  'M6h: interruptor y cupo de videos subidos por escuela. Sin fila = apagado. Solo RPCs mueven used_*; solo super admin cambia el resto (set_school_video_settings).';

DROP TRIGGER IF EXISTS school_video_settings_set_updated_at ON public.school_video_settings;
CREATE TRIGGER school_video_settings_set_updated_at
  BEFORE UPDATE ON public.school_video_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. school_videos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_videos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  team_id            uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  provider           text NOT NULL CHECK (provider IN ('bunny', 'cloudflare', 'mux', 'apivideo')),
  provider_asset_id  text CHECK (provider_asset_id IS NULL OR provider_asset_id ~ '^[A-Za-z0-9_-]{6,100}$'),
  status             text NOT NULL DEFAULT 'uploading'
                       CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'deleted')),
  duration_s         integer CHECK (duration_s IS NULL OR duration_s BETWEEN 0 AND 43200),
  size_bytes         bigint  CHECK (size_bytes IS NULL OR size_bytes >= 0),
  -- Lo que este video tiene cargado HOY al cupo de la escuela (reserva o real).
  counted_seconds    integer NOT NULL DEFAULT 0 CHECK (counted_seconds >= 0),
  counted_bytes      bigint  NOT NULL DEFAULT 0 CHECK (counted_bytes >= 0),
  title              text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  recorded_at        date,
  source             text NOT NULL DEFAULT 'phone'
                       CHECK (source IN ('phone', 'veo', 'hudl', 'trace', 'pixellot', 'other')),
  -- Fase 1: solo 'staff'. 'families_with_consent' queda en el dominio para la
  -- fase 4, pero el segundo CHECK lo impide hasta que exista el consentimiento.
  consent_scope      text NOT NULL DEFAULT 'staff'
                       CHECK (consent_scope IN ('staff', 'families_with_consent')),
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  deleted_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT school_videos_consent_phase1_check CHECK (consent_scope = 'staff'),
  CONSTRAINT school_videos_deleted_check CHECK ((status = 'deleted') = (deleted_at IS NOT NULL)),
  CONSTRAINT school_videos_deleted_uncounted_check CHECK (status <> 'deleted' OR (counted_seconds = 0 AND counted_bytes = 0))
);

COMMENT ON TABLE public.school_videos IS
  'M6h: videos subidos al proveedor externo (nunca a Supabase Storage). id = asset_id del video provider=''sportmaps'' de M6c. Leen staff; suben/editan tácticos; borran autor o admin (lógico, por RPC).';
COMMENT ON COLUMN public.school_videos.consent_scope IS
  'Fase 1 = staff (CHECK). Fase 4: families_with_consent, solo con consentimiento vigente del representante legal de cada menor que aparece (Ley 1581/2012, Decreto 1377/2013 art. 12).';

CREATE INDEX IF NOT EXISTS school_videos_school_idx
  ON public.school_videos (school_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS school_videos_team_idx
  ON public.school_videos (team_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS school_videos_provider_asset_uidx
  ON public.school_videos (provider, provider_asset_id) WHERE provider_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS school_videos_stale_idx
  ON public.school_videos (created_at) WHERE status = 'uploading';

DROP TRIGGER IF EXISTS school_videos_set_updated_at ON public.school_videos;
CREATE TRIGGER school_videos_set_updated_at
  BEFORE UPDATE ON public.school_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- El equipo (si hay) es de la misma escuela. DEFINER: lee teams aunque la RLS
-- de teams no se lo muestre al que edita.
CREATE OR REPLACE FUNCTION public.school_videos_team_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.team_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.teams t WHERE t.id = NEW.team_id AND t.school_id = NEW.school_id) THEN
    RAISE EXCEPTION 'El equipo no es de la escuela del video.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.school_videos_team_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS school_videos_team_guard ON public.school_videos;
CREATE TRIGGER school_videos_team_guard
  BEFORE INSERT OR UPDATE OF team_id, school_id ON public.school_videos
  FOR EACH ROW EXECUTE FUNCTION public.school_videos_team_guard();

-- ─── 3. school_video_clips ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_video_clips (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Copia de school_videos.school_id (el trigger la fija): la RLS filtra sin
  -- leer otra tabla.
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  video_id     uuid NOT NULL REFERENCES public.school_videos(id) ON DELETE CASCADE,
  start_s      numeric(8,2) NOT NULL CHECK (start_s >= 0 AND start_s <= 43200),
  end_s        numeric(8,2) NOT NULL CHECK (end_s <= 43200),
  title        text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  -- Jugada vinculada: a lo sumo UNA de las tres.
  lineup_id    uuid REFERENCES public.match_lineups(id) ON DELETE SET NULL,
  preset_id    uuid REFERENCES public.team_tactical_presets(id) ON DELETE SET NULL,
  exercise_id  uuid REFERENCES public.training_exercises(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_video_clips_range_check CHECK (end_s > start_s AND end_s - start_s >= 1),
  CONSTRAINT school_video_clips_one_play_check CHECK (num_nonnulls(lineup_id, preset_id, exercise_id) <= 1)
);

COMMENT ON TABLE public.school_video_clips IS
  'M6h: clips (inicio/fin) de un video subido, vinculables a una jugada. Virtuales: no crean un video nuevo en el proveedor (cero almacenamiento extra).';

CREATE INDEX IF NOT EXISTS school_video_clips_video_idx ON public.school_video_clips (video_id, start_s);
CREATE INDEX IF NOT EXISTS school_video_clips_school_idx ON public.school_video_clips (school_id);
CREATE INDEX IF NOT EXISTS school_video_clips_lineup_idx ON public.school_video_clips (lineup_id) WHERE lineup_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS school_video_clips_preset_idx ON public.school_video_clips (preset_id) WHERE preset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS school_video_clips_exercise_idx ON public.school_video_clips (exercise_id) WHERE exercise_id IS NOT NULL;

DROP TRIGGER IF EXISTS school_video_clips_set_updated_at ON public.school_video_clips;
CREATE TRIGGER school_video_clips_set_updated_at
  BEFORE UPDATE ON public.school_video_clips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fija school_id desde el video, exige video vivo, recorte dentro de la
-- duración conocida, tope de clips por video y jugada de la MISMA escuela.
CREATE OR REPLACE FUNCTION public.school_video_clips_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_school   uuid;
  v_status   text;
  v_duration integer;
BEGIN
  SELECT sv.school_id, sv.status, sv.duration_s
    INTO v_school, v_status, v_duration
    FROM public.school_videos sv
   WHERE sv.id = NEW.video_id;
  IF NOT FOUND OR v_status = 'deleted' THEN
    RAISE EXCEPTION 'Video no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.video_id <> OLD.video_id THEN
    RAISE EXCEPTION 'Un clip no se cambia de video.' USING ERRCODE = '22023';
  END IF;
  NEW.school_id := v_school;
  IF v_duration IS NOT NULL AND NEW.end_s > v_duration + 1 THEN
    RAISE EXCEPTION 'El clip termina después del final del video.' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.school_video_clips c WHERE c.video_id = NEW.video_id) >= 200 THEN
    RAISE EXCEPTION 'Máximo 200 clips por video.' USING ERRCODE = '54000';
  END IF;
  IF NEW.lineup_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.match_lineups ml WHERE ml.id = NEW.lineup_id AND ml.school_id = v_school) THEN
    RAISE EXCEPTION 'La jugada no es de la escuela del video.' USING ERRCODE = '22023';
  END IF;
  IF NEW.preset_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.team_tactical_presets tp WHERE tp.id = NEW.preset_id AND tp.school_id = v_school) THEN
    RAISE EXCEPTION 'La jugada no es de la escuela del video.' USING ERRCODE = '22023';
  END IF;
  -- Ejercicio: de la escuela o plantilla del sistema (school_id NULL).
  IF NEW.exercise_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.training_exercises e
        WHERE e.id = NEW.exercise_id AND (e.school_id = v_school OR (e.school_id IS NULL AND e.is_template))) THEN
    RAISE EXCEPTION 'El ejercicio no es de la escuela del video.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.school_video_clips_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS school_video_clips_guard ON public.school_video_clips;
CREATE TRIGGER school_video_clips_guard
  BEFORE INSERT OR UPDATE ON public.school_video_clips
  FOR EACH ROW EXECUTE FUNCTION public.school_video_clips_guard();

-- ─── 4. Privilegios y RLS ───────────────────────────────────────────────────
ALTER TABLE public.school_video_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_videos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_video_clips    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.school_video_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.school_videos         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.school_video_clips    FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.school_video_settings TO authenticated;
GRANT SELECT ON public.school_videos TO authenticated;
-- Editar el video: SOLO estas columnas. Estado, tamaño, duración, cupo,
-- escuela, consentimiento y borrado se mueven por RPC.
GRANT UPDATE (title, team_id, recorded_at, source) ON public.school_videos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_video_clips TO authenticated;
GRANT ALL ON public.school_video_settings, public.school_videos, public.school_video_clips TO service_role;

-- settings: staff de la escuela lee su interruptor y su cupo. Nadie escribe
-- directo (sin policies de escritura + sin GRANT).
DROP POLICY IF EXISTS school_video_settings_select ON public.school_video_settings;
CREATE POLICY school_video_settings_select ON public.school_video_settings
  FOR SELECT TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- videos
DROP POLICY IF EXISTS school_videos_select ON public.school_videos;
CREATE POLICY school_videos_select ON public.school_videos
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
         OR (SELECT public.is_super_admin()))
  );

DROP POLICY IF EXISTS school_videos_update ON public.school_videos;
CREATE POLICY school_videos_update ON public.school_videos
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[])
  )
  WITH CHECK (
    deleted_at IS NULL
    AND school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[])
  );
-- Sin policy de INSERT ni DELETE: alta por begin_school_video_upload, baja por
-- soft_delete_school_video.

-- clips
DROP POLICY IF EXISTS school_video_clips_select ON public.school_video_clips;
CREATE POLICY school_video_clips_select ON public.school_video_clips
  FOR SELECT TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS school_video_clips_insert ON public.school_video_clips;
CREATE POLICY school_video_clips_insert ON public.school_video_clips
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[])
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS school_video_clips_update ON public.school_video_clips;
CREATE POLICY school_video_clips_update ON public.school_video_clips
  FOR UPDATE TO authenticated
  USING (school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]))
  WITH CHECK (school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]));

-- Borra el autor (si sigue siendo táctico) o un admin de la escuela.
DROP POLICY IF EXISTS school_video_clips_delete ON public.school_video_clips;
CREATE POLICY school_video_clips_delete ON public.school_video_clips
  FOR DELETE TO authenticated
  USING (
    (created_by = (SELECT auth.uid())
       AND school_id = ANY ((SELECT public.user_tactical_edit_school_ids())::uuid[]))
    OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- ─── 5. RPCs ────────────────────────────────────────────────────────────────
-- Fila de settings de la escuela, bloqueada. Sin fila o apagada → excepción.
CREATE OR REPLACE FUNCTION public._school_video_lock_settings(p_school_id uuid)
RETURNS public.school_video_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v public.school_video_settings%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.school_video_settings WHERE school_id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VIDEOS_DISABLED: los videos subidos no están activos en esta escuela.' USING ERRCODE = '42501';
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public._school_video_lock_settings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._school_video_lock_settings(uuid) TO service_role;

-- 5.1 Reservar cupo + crear el video (una transacción). Lo llama el BFF con la
-- sesión del usuario (auth.uid() es quien sube).
CREATE OR REPLACE FUNCTION public.begin_school_video_upload(
  p_school_id      uuid,
  p_provider       text,
  p_title          text,
  p_size_bytes     bigint,
  p_max_duration_s integer,
  p_team_id        uuid DEFAULT NULL,
  p_source         text DEFAULT 'phone',
  p_recorded_at    date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_set  public.school_video_settings%ROWTYPE;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL OR NOT (p_school_id = ANY (public.user_tactical_edit_school_ids())) THEN
    RAISE EXCEPTION 'No tienes permiso para subir videos en esta escuela.' USING ERRCODE = '42501';
  END IF;
  IF p_size_bytes IS NULL OR p_size_bytes <= 0 THEN
    RAISE EXCEPTION 'Tamaño del archivo inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_max_duration_s IS NULL OR p_max_duration_s <= 0 THEN
    RAISE EXCEPTION 'Duración máxima inválida.' USING ERRCODE = '22023';
  END IF;

  v_set := public._school_video_lock_settings(p_school_id);
  IF NOT v_set.enabled THEN
    RAISE EXCEPTION 'VIDEOS_DISABLED: los videos subidos no están activos en esta escuela.' USING ERRCODE = '42501';
  END IF;
  IF p_size_bytes > v_set.max_upload_bytes THEN
    RAISE EXCEPTION 'FILE_TOO_LARGE: el archivo supera el máximo permitido.' USING ERRCODE = '22023';
  END IF;
  IF p_max_duration_s > v_set.max_duration_s THEN
    RAISE EXCEPTION 'TOO_LONG: el video supera la duración máxima.' USING ERRCODE = '22023';
  END IF;
  IF v_set.used_seconds + p_max_duration_s > v_set.quota_seconds
     OR v_set.used_bytes + p_size_bytes > v_set.quota_bytes THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED: no queda cupo de videos en la escuela.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.school_videos (school_id, team_id, provider, status, title, recorded_at, source,
                                    counted_seconds, counted_bytes, created_by)
  VALUES (p_school_id, p_team_id, p_provider, 'uploading', btrim(p_title), p_recorded_at, COALESCE(p_source, 'phone'),
          p_max_duration_s, p_size_bytes, v_uid)
  RETURNING id INTO v_id;

  UPDATE public.school_video_settings
     SET used_seconds = used_seconds + p_max_duration_s,
         used_bytes   = used_bytes + p_size_bytes
   WHERE school_id = p_school_id;

  RETURN jsonb_build_object(
    'video_id', v_id,
    'quota_seconds', v_set.quota_seconds,
    'quota_bytes', v_set.quota_bytes,
    'used_seconds', v_set.used_seconds + p_max_duration_s,
    'used_bytes', v_set.used_bytes + p_size_bytes
  );
END;
$$;
REVOKE ALL ON FUNCTION public.begin_school_video_upload(uuid, text, text, bigint, integer, uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_school_video_upload(uuid, text, text, bigint, integer, uuid, text, date) TO authenticated, service_role;

-- 5.2 Guardar el id del asset del proveedor (una sola vez, el autor, subiendo).
CREATE OR REPLACE FUNCTION public.attach_school_video_asset(p_video_id uuid, p_provider_asset_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n   int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.school_videos
     SET provider_asset_id = p_provider_asset_id
   WHERE id = p_video_id
     AND created_by = v_uid
     AND status = 'uploading'
     AND provider_asset_id IS NULL
     AND school_id = ANY (public.user_tactical_edit_school_ids());
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Video no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.attach_school_video_asset(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_school_video_asset(uuid, text) TO authenticated, service_role;

-- 5.3 Webhook del proveedor (solo service_role: el BFF tras verificar la firma
-- y releer el asset en el API del proveedor). Cambia la reserva por lo real.
-- Idempotente: delta = real − contado.
CREATE OR REPLACE FUNCTION public.settle_school_video(
  p_provider          text,
  p_provider_asset_id text,
  p_status            text,
  p_duration_s        integer DEFAULT NULL,
  p_size_bytes        bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v      public.school_videos%ROWTYPE;
  v_secs integer;
  v_byts bigint;
BEGIN
  IF p_status NOT IN ('processing', 'ready', 'failed') THEN
    RAISE EXCEPTION 'Estado inválido.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM public.school_videos
   WHERE provider = p_provider AND provider_asset_id = p_provider_asset_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_asset');
  END IF;
  -- Orden de bloqueo fijo (settings → video) igual que begin/delete.
  PERFORM public._school_video_lock_settings(v.school_id);
  SELECT * INTO v FROM public.school_videos WHERE id = v.id FOR UPDATE;
  IF v.status = 'deleted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deleted');
  END IF;
  -- Un evento viejo no deshace uno nuevo.
  IF v.status IN ('ready', 'failed') AND p_status = 'processing' THEN
    RETURN jsonb_build_object('ok', true, 'status', v.status, 'ignored', true);
  END IF;

  IF p_status = 'failed' THEN
    v_secs := 0; v_byts := 0;
  ELSIF p_status = 'ready' THEN
    v_secs := COALESCE(p_duration_s, v.counted_seconds);
    v_byts := COALESCE(p_size_bytes, v.counted_bytes);
  ELSE
    v_secs := v.counted_seconds; v_byts := v.counted_bytes;
  END IF;

  UPDATE public.school_video_settings
     SET used_seconds = GREATEST(used_seconds + (v_secs - v.counted_seconds), 0),
         used_bytes   = GREATEST(used_bytes + (v_byts - v.counted_bytes), 0)
   WHERE school_id = v.school_id;

  UPDATE public.school_videos
     SET status = p_status,
         duration_s = CASE WHEN p_status = 'ready' THEN COALESCE(p_duration_s, duration_s) ELSE duration_s END,
         size_bytes = CASE WHEN p_status = 'ready' THEN COALESCE(p_size_bytes, size_bytes) ELSE size_bytes END,
         counted_seconds = v_secs,
         counted_bytes = v_byts
   WHERE id = v.id;

  RETURN jsonb_build_object('ok', true, 'video_id', v.id, 'status', p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_school_video(text, text, text, integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_school_video(text, text, text, integer, bigint) TO service_role;

-- 5.4 Borrado lógico (también «cancelar subida»): autor táctico o admin.
-- Devuelve el cupo y los datos del proveedor para que el BFF borre el asset.
CREATE OR REPLACE FUNCTION public.soft_delete_school_video(p_video_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v     public.school_videos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.school_videos WHERE id = p_video_id;
  IF NOT FOUND OR v.status = 'deleted' THEN
    RAISE EXCEPTION 'Video no encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
       (v.created_by = v_uid AND v.school_id = ANY (public.user_tactical_edit_school_ids()))
       OR v.school_id = ANY (public.user_admin_school_ids())
       OR public.is_super_admin()
     ) THEN
    RAISE EXCEPTION 'Solo quien subió el video o un administrador de la escuela puede borrarlo.' USING ERRCODE = '42501';
  END IF;

  PERFORM public._school_video_lock_settings(v.school_id);
  SELECT * INTO v FROM public.school_videos WHERE id = p_video_id FOR UPDATE;
  IF v.status = 'deleted' THEN
    RAISE EXCEPTION 'Video no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.school_video_settings
     SET used_seconds = GREATEST(used_seconds - v.counted_seconds, 0),
         used_bytes   = GREATEST(used_bytes - v.counted_bytes, 0)
   WHERE school_id = v.school_id;

  UPDATE public.school_videos
     SET status = 'deleted', deleted_at = now(), deleted_by = v_uid,
         counted_seconds = 0, counted_bytes = 0
   WHERE id = v.id;
  -- Sin video no hay clips (la fila del video queda como rastro del borrado).
  DELETE FROM public.school_video_clips WHERE video_id = v.id;

  RETURN jsonb_build_object('video_id', v.id, 'provider', v.provider, 'provider_asset_id', v.provider_asset_id);
END;
$$;
REVOKE ALL ON FUNCTION public.soft_delete_school_video(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_school_video(uuid) TO authenticated, service_role;

-- 5.5 Prender/apagar y fijar cupo: SOLO SportMaps (super admin con su sesión,
-- o el BFF con service_role). Nunca la escuela (el cupo es costo de SportMaps).
CREATE OR REPLACE FUNCTION public.set_school_video_settings(
  p_school_id        uuid,
  p_enabled          boolean,
  p_quota_seconds    integer DEFAULT NULL,
  p_quota_bytes      bigint DEFAULT NULL,
  p_max_upload_bytes bigint DEFAULT NULL,
  p_max_duration_s   integer DEFAULT NULL
)
RETURNS public.school_video_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v public.school_video_settings%ROWTYPE;
BEGIN
  IF NOT (public.is_super_admin() OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
    RAISE EXCEPTION 'Solo SportMaps puede activar los videos subidos.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.school_video_settings AS s (school_id, enabled, updated_by)
  VALUES (p_school_id, COALESCE(p_enabled, false), auth.uid())
  ON CONFLICT (school_id) DO NOTHING;

  SELECT * INTO v FROM public.school_video_settings WHERE school_id = p_school_id FOR UPDATE;
  UPDATE public.school_video_settings
     SET enabled          = COALESCE(p_enabled, enabled),
         quota_seconds    = COALESCE(p_quota_seconds, quota_seconds),
         quota_bytes      = COALESCE(p_quota_bytes, quota_bytes),
         max_upload_bytes = COALESCE(p_max_upload_bytes, max_upload_bytes),
         max_duration_s   = COALESCE(p_max_duration_s, max_duration_s),
         updated_by       = auth.uid()
   WHERE school_id = p_school_id
   RETURNING * INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.set_school_video_settings(uuid, boolean, integer, bigint, bigint, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_school_video_settings(uuid, boolean, integer, bigint, bigint, integer) TO authenticated, service_role;

-- 5.6 Subidas abandonadas (nunca llegó el archivo): pasan a 'failed' y
-- devuelven la reserva. Para un cron del BFF (aún sin programar).
CREATE OR REPLACE FUNCTION public.expire_stale_school_video_uploads(p_older_than interval DEFAULT interval '24 hours')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  r   record;
  v_n integer := 0;
BEGIN
  FOR r IN
    SELECT id, school_id FROM public.school_videos
     WHERE status = 'uploading' AND created_at < now() - p_older_than
     ORDER BY school_id
     LIMIT 500
  LOOP
    PERFORM public._school_video_lock_settings(r.school_id);
    UPDATE public.school_video_settings s
       SET used_seconds = GREATEST(s.used_seconds - v.counted_seconds, 0),
           used_bytes   = GREATEST(s.used_bytes - v.counted_bytes, 0)
      FROM public.school_videos v
     WHERE v.id = r.id AND v.status = 'uploading' AND s.school_id = v.school_id;
    UPDATE public.school_videos
       SET status = 'failed', counted_seconds = 0, counted_bytes = 0
     WHERE id = r.id AND status = 'uploading';
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_stale_school_video_uploads(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_school_video_uploads(interval) TO service_role;

COMMIT;
