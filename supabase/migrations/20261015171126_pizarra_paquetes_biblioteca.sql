-- =============================================================================
-- 20261014121142_pizarra_paquetes_biblioteca.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014111442
-- Objetivo: M2 de docs/specs/pizarra-multideporte-3d-ia.md (decisión D4, §4) —
--   «bibliotecas cargables = paquetes». Un paquete es un conjunto de ejercicios
--   de un deporte. SportMaps publica los del sistema (school_id NULL, solo
--   lectura); la escuela ACTIVA los que quiere e IMPORTA los suyos desde un
--   archivo .json (formato 'sportmaps-ejercicios' v1, lo valida el BFF).
--
--   1. public.exercise_packs          paquetes (sistema / escuela), deporte, versión
--   2. training_exercises.pack_id     a qué paquete pertenece cada ejercicio
--   3. public.school_exercise_packs   paquetes del sistema activados por escuela
--   4. RLS: leen staff (user_staff_school_ids()); NADIE escribe por la tabla
--   5. RPCs SECURITY DEFINER: activate_exercise_pack, deactivate_exercise_pack,
--      import_exercise_pack (paquete + todos sus ejercicios en UNA transacción)
--   6. Datos: 7 paquetes del sistema y las 28 plantillas asignadas por deporte
--
-- ── Decisión de compatibilidad (la toma el BFF, school/exercisePacks.ts) ─────
--   Una escuela que todavía NO activó ningún paquete ve TODOS los paquetes del
--   sistema de sus deportes (modo «todos»): es lo que ve hoy. Si no fuera así,
--   al desplegar se vaciaría la biblioteca de las 371 escuelas. Apenas activa
--   uno pasa a modo «selección»: ve solo los activados + los suyos. Si
--   desactiva el último vuelve a «todos» (nunca biblioteca vacía; la pantalla
--   lo avisa antes de desactivar el último). Los ejercicios PROPIOS de la
--   escuela se ven siempre, salvo los de un paquete propio desactivado.
--
-- ── Paquetes del sistema (ids fijos 5b1c0000-…-00000000000N) ─────────────────
--   1 futbol     «Fútbol: fundamentos y juego»   las 11 de fútbol 11
--   2 futbol7    «Fútbol 7 y fútbol 5»           1 de fútbol 7 + 2 de fútbol 5
--   3 futsal     «Futsal»                         3
--   4 voleibol   «Voleibol formativo»             3
--   5 baloncesto «Baloncesto»                     3
--   6 balonmano  «Balonmano»                      3
--   7 generico   «Preparación física»             2
--   El paquete 2 mezcla F7 y F5 a propósito: desde M2 (D1) una escuela de
--   fútbol ve las tres canchas (11, 7 y 5), así que el deporte del paquete es
--   el principal y cada ejercicio conserva el suyo. El BFF filtra por los DOS.
--
-- ── Radio medido contra la base viva (2026-10-14, solo SELECT) ───────────────
--   · exercise_packs / school_exercise_packs no existen; training_exercises no
--     tiene pack_id; su único trigger es training_exercises_set_updated_at y
--     tiene exactamente 4 policies (select/insert/update/delete). Nada choca.
--   · training_exercises: 12 plantillas del sistema VIVAS (11 fútbol + 1 F7) y
--     0 ejercicios de escuela. La 20261013194057 (16 plantillas de los demás
--     deportes) NO está aplicada: esta migración la exige antes (bloque 0) y
--     corta con un mensaje claro si falta. Tras ambas: 28 plantillas → 7
--     paquetes, 0 sin paquete.
--   · Visibilidad: 371 escuelas, 0 con paquetes activados → todas quedan en
--     modo «todos» = exactamente lo que ven hoy. Ninguna pantalla cambia al
--     aplicar; el cambio llega solo cuando una escuela activa un paquete.
--   · Quién puede activar / importar (gate interno de las RPC =
--     user_admin_school_ids() ∪ user_tactical_edit_school_ids()): 110
--     membresías activas (66 owner, 37 coach, 5 admin, 2 school_admin) en 66
--     escuelas + 57 cuentas de coach en school_staff. NO pueden: 872 padres,
--     48 atletas, 2 reporter (staff que LEE pero no gestiona). Nadie pierde
--     nada: todo es nuevo.
--   · Escrituras: las tablas nuevas no tienen policies de escritura y
--     authenticated/anon no tienen INSERT/UPDATE/DELETE; el BFF escribe solo por
--     las RPC (userClient, para que auth.uid() sea el caller).
--   · training_exercises: se agrega una columna NULL (sin reescritura de la
--     tabla, 12-28 filas) y un trigger que impide colgar un ejercicio de un
--     paquete de OTRA escuela (o un ejercicio de escuela de un paquete del
--     sistema). Sus 4 policies no se tocan.
--
-- Depende de: 20261008183744 (training_exercises), 20261013194057 (plantillas
-- de los demás deportes), helpers user_*_school_ids() e is_super_admin().
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
    RAISE EXCEPTION 'Falta public.training_exercises: aplicar 20261008183744_biblioteca_ejercicios_v2 antes que esta migración.';
  END IF;
  IF to_regprocedure('public.user_tactical_edit_school_ids()') IS NULL
     OR to_regprocedure('public.user_admin_school_ids()') IS NULL
     OR to_regprocedure('public.user_staff_school_ids()') IS NULL THEN
    RAISE EXCEPTION 'Faltan los helpers de RLS user_*_school_ids().';
  END IF;
  -- Las plantillas de futsal, vóley, básquet, balonmano, F5 y genérico las trae
  -- 20261013194057. Sin ellas los paquetes 2-7 quedarían vacíos y, si se
  -- aplicara después, sus 16 filas quedarían sin paquete.
  IF (SELECT count(DISTINCT e.sport) FROM public.training_exercises e
       WHERE e.school_id IS NULL AND e.is_template) < 8 THEN
    RAISE EXCEPTION 'Faltan plantillas del sistema de algún deporte: aplicar 20261013194057_plantillas_ejercicios_otros_deportes antes que esta migración.';
  END IF;
END $$;

-- ─── 1. exercise_packs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercise_packs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = paquete SportMaps (sistema, solo lectura).
  school_id   uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  sport       text NOT NULL
              CHECK (sport IN ('futbol','futbol7','futbol5','futsal','voleibol','baloncesto','balonmano','generico')),
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  version     integer NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 100000),
  -- Paquete propio desactivado = sus ejercicios no salen en la biblioteca.
  -- Paquete del sistema inactivo = SportMaps lo retiró.
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exercise_packs IS
  'Paquetes de la Biblioteca de ejercicios (pizarra M2, D4). school_id NULL = paquete SportMaps de solo lectura. Escritura solo por RPC (activate/deactivate/import_exercise_pack).';

CREATE INDEX IF NOT EXISTS exercise_packs_school_idx ON public.exercise_packs (school_id);
CREATE INDEX IF NOT EXISTS exercise_packs_system_sport_idx
  ON public.exercise_packs (sport) WHERE school_id IS NULL;

DROP TRIGGER IF EXISTS exercise_packs_set_updated_at ON public.exercise_packs;
CREATE TRIGGER exercise_packs_set_updated_at
  BEFORE UPDATE ON public.exercise_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. training_exercises.pack_id ──────────────────────────────────────────
ALTER TABLE public.training_exercises
  ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.exercise_packs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS training_exercises_pack_idx
  ON public.training_exercises (pack_id) WHERE pack_id IS NOT NULL;

-- Un ejercicio solo cuelga de un paquete de SU misma escuela (o los dos del
-- sistema). Sin esto, un coach podía insertar por PostgREST un ejercicio de su
-- escuela con pack_id = un paquete SportMaps (o de otra escuela) y «meterlo»
-- en el paquete ajeno. SECURITY INVOKER a propósito: el caller solo ve los
-- paquetes de sus escuelas y los del sistema, así que un paquete ajeno ni se
-- encuentra (→ rechazo); service_role y postgres ven todo.
CREATE OR REPLACE FUNCTION public.training_exercises_pack_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_pack_school uuid;
BEGIN
  IF NEW.pack_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT ep.school_id INTO v_pack_school
    FROM public.exercise_packs ep
   WHERE ep.id = NEW.pack_id;
  IF NOT FOUND OR v_pack_school IS DISTINCT FROM NEW.school_id THEN
    RAISE EXCEPTION 'El ejercicio y su paquete tienen que ser de la misma escuela (o los dos de SportMaps).'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.training_exercises_pack_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.training_exercises_pack_scope() FROM anon;
REVOKE ALL ON FUNCTION public.training_exercises_pack_scope() FROM authenticated;

DROP TRIGGER IF EXISTS training_exercises_pack_scope ON public.training_exercises;
CREATE TRIGGER training_exercises_pack_scope
  BEFORE INSERT OR UPDATE OF pack_id, school_id ON public.training_exercises
  FOR EACH ROW EXECUTE FUNCTION public.training_exercises_pack_scope();

-- ─── 3. school_exercise_packs (paquetes del sistema activados) ──────────────
CREATE TABLE IF NOT EXISTS public.school_exercise_packs (
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  pack_id      uuid NOT NULL REFERENCES public.exercise_packs(id) ON DELETE CASCADE,
  activated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_exercise_packs_pkey PRIMARY KEY (school_id, pack_id)
);

COMMENT ON TABLE public.school_exercise_packs IS
  'Paquetes SportMaps activados por cada escuela (pizarra M2). Sin filas = la escuela ve todos los de sus deportes. Escritura solo por activate/deactivate_exercise_pack.';

CREATE INDEX IF NOT EXISTS school_exercise_packs_pack_idx ON public.school_exercise_packs (pack_id);

-- ─── 4. RLS: leen staff; nadie escribe por la tabla ─────────────────────────
ALTER TABLE public.exercise_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_exercise_packs ENABLE ROW LEVEL SECURITY;

-- Los default privileges del esquema dan todo a anon/authenticated: explícito.
REVOKE ALL ON public.exercise_packs FROM PUBLIC;
REVOKE ALL ON public.exercise_packs FROM anon;
REVOKE ALL ON public.exercise_packs FROM authenticated;
GRANT SELECT ON public.exercise_packs TO authenticated;
GRANT ALL ON public.exercise_packs TO service_role;

REVOKE ALL ON public.school_exercise_packs FROM PUBLIC;
REVOKE ALL ON public.school_exercise_packs FROM anon;
REVOKE ALL ON public.school_exercise_packs FROM authenticated;
GRANT SELECT ON public.school_exercise_packs TO authenticated;
GRANT ALL ON public.school_exercise_packs TO service_role;

-- Paquetes: los del sistema los lee quien trabaja en alguna escuela (mismo
-- criterio que las plantillas en training_exercises_select, 20261013200604);
-- los de una escuela, su staff. Padres y atletas no (user_staff_school_ids()
-- los excluye). Sin SELECT sobre exercise_packs dentro del USING.
DROP POLICY IF EXISTS exercise_packs_select ON public.exercise_packs;
CREATE POLICY exercise_packs_select ON public.exercise_packs
  FOR SELECT TO authenticated
  USING (
    (school_id IS NULL AND cardinality((SELECT public.user_staff_school_ids())::uuid[]) > 0)
    OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS school_exercise_packs_select ON public.school_exercise_packs;
CREATE POLICY school_exercise_packs_select ON public.school_exercise_packs
  FOR SELECT TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- Sin policies de INSERT/UPDATE/DELETE: con RLS activa eso es «nadie», y
-- además authenticated no tiene el privilegio. Todo pasa por las RPC.

-- ─── 5. RPCs ────────────────────────────────────────────────────────────────
-- Gate común (inline en cada RPC): el caller administra la escuela
-- (user_admin_school_ids()) o puede editar su pizarra
-- (user_tactical_edit_school_ids()), o es super admin de plataforma.

-- 5a. Activar: paquete del sistema → fila en school_exercise_packs; paquete
--     propio desactivado → is_active = true.
CREATE OR REPLACE FUNCTION public.activate_exercise_pack(p_school_id uuid, p_pack_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_pack public.exercise_packs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL OR p_pack_id IS NULL THEN
    RAISE EXCEPTION 'p_school_id y p_pack_id son requeridos.' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_school_id = ANY (public.user_admin_school_ids())
          OR p_school_id = ANY (public.user_tactical_edit_school_ids())
          OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'No puedes gestionar los paquetes de esta escuela.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pack FROM public.exercise_packs ep WHERE ep.id = p_pack_id;
  -- Un paquete de OTRA escuela responde igual que uno inexistente.
  IF NOT FOUND OR (v_pack.school_id IS NOT NULL AND v_pack.school_id <> p_school_id) THEN
    RAISE EXCEPTION 'Paquete no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pack.school_id IS NULL THEN
    IF NOT v_pack.is_active THEN
      RAISE EXCEPTION 'Ese paquete ya no está disponible.' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.school_exercise_packs (school_id, pack_id, activated_by)
    VALUES (p_school_id, p_pack_id, v_uid)
    ON CONFLICT (school_id, pack_id) DO NOTHING;
  ELSE
    UPDATE public.exercise_packs SET is_active = true WHERE id = p_pack_id AND NOT is_active;
  END IF;

  RETURN jsonb_build_object('pack_id', p_pack_id, 'school_id', p_school_id,
                            'is_system', v_pack.school_id IS NULL, 'activated', true);
END;
$$;

-- 5b. Desactivar: paquete del sistema → borra la activación; propio → is_active = false.
CREATE OR REPLACE FUNCTION public.deactivate_exercise_pack(p_school_id uuid, p_pack_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_pack public.exercise_packs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL OR p_pack_id IS NULL THEN
    RAISE EXCEPTION 'p_school_id y p_pack_id son requeridos.' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_school_id = ANY (public.user_admin_school_ids())
          OR p_school_id = ANY (public.user_tactical_edit_school_ids())
          OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'No puedes gestionar los paquetes de esta escuela.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pack FROM public.exercise_packs ep WHERE ep.id = p_pack_id;
  IF NOT FOUND OR (v_pack.school_id IS NOT NULL AND v_pack.school_id <> p_school_id) THEN
    RAISE EXCEPTION 'Paquete no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pack.school_id IS NULL THEN
    DELETE FROM public.school_exercise_packs WHERE school_id = p_school_id AND pack_id = p_pack_id;
  ELSE
    UPDATE public.exercise_packs SET is_active = false WHERE id = p_pack_id AND is_active;
  END IF;

  RETURN jsonb_build_object('pack_id', p_pack_id, 'school_id', p_school_id,
                            'is_system', v_pack.school_id IS NULL, 'activated', false);
END;
$$;

-- 5c. Importar: crea el paquete de la escuela y TODOS sus ejercicios en una
--     sola transacción (la función entera lo es: un ejercicio que no pasa un
--     CHECK deshace el paquete y los anteriores). El BFF ya validó el archivo
--     (formato, versión, jugadas, deportes de la escuela, textos); acá se
--     repiten los topes duros para quien llame la RPC directo por PostgREST.
--     NUNCA se usan ids, school_id, created_by ni is_template del payload.
CREATE OR REPLACE FUNCTION public.import_exercise_pack(p_school_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_pack    jsonb;
  v_list    jsonb;
  v_ex      jsonb;
  v_pack_id uuid;
  v_sport   text;
  v_version integer;
  v_n       integer := 0;
  v_tags    text[];
  v_board   jsonb;
  v_own     integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'p_school_id es requerido.' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_school_id = ANY (public.user_admin_school_ids())
          OR p_school_id = ANY (public.user_tactical_edit_school_ids())
          OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'No puedes importar paquetes en esta escuela.' USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'El paquete debe ser un objeto { pack, exercises }.' USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_payload::text) > 4194304 THEN
    RAISE EXCEPTION 'El paquete pesa más de 4 MB.' USING ERRCODE = '22023';
  END IF;

  v_pack := p_payload->'pack';
  v_list := p_payload->'exercises';
  IF v_pack IS NULL OR jsonb_typeof(v_pack) <> 'object' THEN
    RAISE EXCEPTION 'Falta pack.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_pack->'name') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'pack.name es requerido.' USING ERRCODE = '22023';
  END IF;
  v_sport := v_pack->>'sport';
  IF v_sport IS NULL OR v_sport NOT IN ('futbol','futbol7','futbol5','futsal','voleibol','baloncesto','balonmano','generico') THEN
    RAISE EXCEPTION 'pack.sport inválido.' USING ERRCODE = '22023';
  END IF;
  v_version := CASE WHEN jsonb_typeof(v_pack->'version') = 'number'
                    THEN LEAST(GREATEST(floor((v_pack->>'version')::numeric)::integer, 1), 100000)
                    ELSE 1 END;
  IF v_list IS NULL OR jsonb_typeof(v_list) <> 'array'
     OR jsonb_array_length(v_list) < 1 OR jsonb_array_length(v_list) > 200 THEN
    RAISE EXCEPTION 'exercises debe ser una lista de 1 a 200 ejercicios.' USING ERRCODE = '22023';
  END IF;

  -- Tope de paquetes propios (abuso / errores en bucle). Lock transaccional
  -- por escuela (no bloquea la fila de schools) para que dos importaciones a la
  -- vez no pasen las dos el conteo.
  PERFORM pg_advisory_xact_lock(hashtextextended('import_exercise_pack:' || p_school_id::text, 0));
  PERFORM 1 FROM public.schools s WHERE s.id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escuela no encontrada.' USING ERRCODE = 'P0002';
  END IF;
  SELECT count(*) INTO v_own FROM public.exercise_packs ep WHERE ep.school_id = p_school_id;
  IF v_own >= 200 THEN
    RAISE EXCEPTION 'Tu escuela ya tiene 200 paquetes: borra alguno antes de importar.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.exercise_packs (school_id, sport, name, description, version, is_active, created_by)
  VALUES (
    p_school_id,
    v_sport,
    btrim(v_pack->>'name'),
    NULLIF(btrim(CASE WHEN jsonb_typeof(v_pack->'description') = 'string' THEN v_pack->>'description' END), ''),
    v_version,
    true,
    v_uid
  )
  RETURNING id INTO v_pack_id;

  FOR v_ex IN SELECT value FROM jsonb_array_elements(v_list) LOOP
    v_n := v_n + 1;
    IF jsonb_typeof(v_ex) <> 'object' OR jsonb_typeof(v_ex->'name') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Ejercicio %: debe ser un objeto con name.', v_n USING ERRCODE = '22023';
    END IF;
    IF v_ex ? 'tags' AND jsonb_typeof(v_ex->'tags') <> 'array' THEN
      RAISE EXCEPTION 'Ejercicio %: tags debe ser una lista.', v_n USING ERRCODE = '22023';
    END IF;
    v_tags := CASE WHEN jsonb_typeof(v_ex->'tags') = 'array'
                   THEN ARRAY(SELECT DISTINCT lower(btrim(t)) FROM jsonb_array_elements_text(v_ex->'tags') AS t
                               WHERE btrim(t) <> '' AND char_length(btrim(t)) <= 40)
                   ELSE '{}'::text[] END;
    v_board := CASE WHEN jsonb_typeof(v_ex->'board') = 'object' THEN v_ex->'board'
                    ELSE '{"players":[],"arrows":[],"frames":[]}'::jsonb END;

    -- Los CHECK de training_exercises (largos, minutos, deporte, tamaño de la
    -- jugada) y el trigger de paquete validan cada fila; cualquiera que falle
    -- aborta la importación entera.
    INSERT INTO public.training_exercises
      (school_id, created_by, pack_id, name, objective, minutes, age_group, materials, tags, sport, description, board, is_template, is_active)
    VALUES (
      p_school_id,
      v_uid,
      v_pack_id,
      btrim(v_ex->>'name'),
      NULLIF(btrim(CASE WHEN jsonb_typeof(v_ex->'objective') = 'string' THEN v_ex->>'objective' END), ''),
      CASE WHEN jsonb_typeof(v_ex->'minutes') = 'number' THEN (v_ex->>'minutes')::numeric::integer END,
      NULLIF(btrim(CASE WHEN jsonb_typeof(v_ex->'age_group') = 'string' THEN v_ex->>'age_group' END), ''),
      NULLIF(btrim(CASE WHEN jsonb_typeof(v_ex->'materials') = 'string' THEN v_ex->>'materials' END), ''),
      v_tags,
      COALESCE(CASE WHEN jsonb_typeof(v_ex->'sport') = 'string' THEN v_ex->>'sport' END, v_sport),
      NULLIF(btrim(CASE WHEN jsonb_typeof(v_ex->'description') = 'string' THEN v_ex->>'description' END), ''),
      v_board,
      false,
      true
    );
  END LOOP;

  RETURN jsonb_build_object('pack_id', v_pack_id, 'school_id', p_school_id, 'exercises', v_n);
END;
$$;

COMMENT ON FUNCTION public.activate_exercise_pack(uuid, uuid) IS
  'Pizarra M2: activa un paquete SportMaps (o reactiva uno propio) para la escuela. Gate: user_admin_school_ids() ∪ user_tactical_edit_school_ids().';
COMMENT ON FUNCTION public.deactivate_exercise_pack(uuid, uuid) IS
  'Pizarra M2: desactiva un paquete SportMaps (o uno propio) para la escuela. Gate: user_admin_school_ids() ∪ user_tactical_edit_school_ids().';
COMMENT ON FUNCTION public.import_exercise_pack(uuid, jsonb) IS
  'Pizarra M2: importa un paquete (archivo sportmaps-ejercicios v1 ya validado por el BFF) creando el paquete y sus ejercicios en una transacción. Ignora ids del archivo.';

-- Los default privileges del esquema dan EXECUTE a authenticated/anon: explícito.
REVOKE ALL ON FUNCTION public.activate_exercise_pack(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_exercise_pack(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.activate_exercise_pack(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_exercise_pack(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.deactivate_exercise_pack(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_exercise_pack(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.deactivate_exercise_pack(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_exercise_pack(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.import_exercise_pack(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_exercise_pack(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_exercise_pack(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_exercise_pack(uuid, jsonb) TO service_role;

-- ─── 6. Datos: paquetes del sistema y asignación de las 28 plantillas ───────
-- Idempotente: ids fijos (ON CONFLICT DO NOTHING) y solo asigna plantillas
-- que todavía no tienen paquete.
INSERT INTO public.exercise_packs (id, school_id, sport, name, description, version, is_active, created_by)
VALUES
  ('5b1c0000-0000-4000-8000-000000000001', NULL, 'futbol', 'Fútbol: fundamentos y juego',
   'Rondos, posesión, salida de balón, presión, finalización, defensa y balón parado para fútbol 11.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000002', NULL, 'futbol7', 'Fútbol 7 y fútbol 5',
   'Juego de posición y tareas en cancha reducida para las categorías que juegan fútbol 7 y fútbol 5.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000003', NULL, 'futsal', 'Futsal',
   'Rotaciones, paredes y finalización en cancha de fútbol sala.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000004', NULL, 'voleibol', 'Voleibol formativo',
   'Recepción, armado, ataque y rotación por zonas para categorías formativas.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000005', NULL, 'baloncesto', 'Baloncesto',
   'Pase y corte, bloqueo directo y transición en media y cancha completa.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000006', NULL, 'balonmano', 'Balonmano',
   'Circulación, cruces y defensa en balonmano.', 1, true, NULL),
  ('5b1c0000-0000-4000-8000-000000000007', NULL, 'generico', 'Preparación física',
   'Calentamientos, reacción y coordinación que sirven para cualquier deporte.', 1, true, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE public.training_exercises e
   SET pack_id = CASE e.sport
                   WHEN 'futbol'     THEN '5b1c0000-0000-4000-8000-000000000001'::uuid
                   WHEN 'futbol7'    THEN '5b1c0000-0000-4000-8000-000000000002'::uuid
                   WHEN 'futbol5'    THEN '5b1c0000-0000-4000-8000-000000000002'::uuid
                   WHEN 'futsal'     THEN '5b1c0000-0000-4000-8000-000000000003'::uuid
                   WHEN 'voleibol'   THEN '5b1c0000-0000-4000-8000-000000000004'::uuid
                   WHEN 'baloncesto' THEN '5b1c0000-0000-4000-8000-000000000005'::uuid
                   WHEN 'balonmano'  THEN '5b1c0000-0000-4000-8000-000000000006'::uuid
                   WHEN 'generico'   THEN '5b1c0000-0000-4000-8000-000000000007'::uuid
                 END
 WHERE e.school_id IS NULL
   AND e.is_template
   AND e.pack_id IS NULL;

-- Ninguna plantilla del sistema sin paquete.
DO $$
DECLARE
  v_sin integer;
BEGIN
  SELECT count(*) INTO v_sin FROM public.training_exercises
   WHERE school_id IS NULL AND is_template AND pack_id IS NULL;
  IF v_sin > 0 THEN
    RAISE EXCEPTION 'Quedaron % plantillas del sistema sin paquete.', v_sin;
  END IF;
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación post-aplicación:
--   npm run seguridad:rls-pizarra   -- los casos de paquetes dejan de omitirse y pasan a verde
--   npm run seguridad:invariantes
--   select ep.name, ep.sport, count(e.*) from public.exercise_packs ep
--     left join public.training_exercises e on e.pack_id = ep.id
--    where ep.school_id is null group by 1, 2 order by 2;      -- 7 paquetes, 28 ejercicios
--   select tablename, policyname, cmd, roles, qual, with_check from pg_policies
--    where tablename in ('exercise_packs', 'school_exercise_packs');   -- solo SELECT
--   select proname, proacl, proconfig from pg_proc
--    where proname in ('activate_exercise_pack', 'deactivate_exercise_pack', 'import_exercise_pack');
--   set local role anon; select count(*) from public.exercise_packs;     -- permission denied
-- -----------------------------------------------------------------------------
