-- =============================================================================
-- 20261025003634_v2_b1_felicitaciones_athlete_kudos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261024225703
-- Objetivo: B1 del contrato docs/specs/entrenador-deportista-v2.md — el profe
--           felicita a un deportista («👏») y la familia y el deportista lo ven.
--
--   · Tabla athlete_kudos (exactamente un sujeto: child | athlete_user | unregistered).
--   · RPC give_kudos(...)  → uuid. Staff de la escuela; 1 por deportista por día
--     (hora Colombia) por escuela → error 'KUDOS_DAILY_LIMIT'. Avisa por
--     notifications (category 'kudos') al acudiente del menor, al deportista
--     con cuenta y a la cuenta vinculada de la ficha.
--   · RPC list_kudos(...) → id, message, coach_name, created_at. La ven el
--     acudiente del hijo, el propio deportista (o su cuenta vinculada a la
--     ficha) y el staff de la escuela.
--   · Helpers is_linked_unregistered_athlete(uuid) y my_linked_unregistered_ids()
--     (también los usan B2 y B4).
--   · notifications_category_check suma 'kudos' y 'match' (B2) sin perder las
--     categorías vivas: se reconstruye leyendo la lista ACTUAL del catálogo.
--
-- Diferencia con el contrato: give_kudos y list_kudos llevan un último
-- parámetro OPCIONAL p_unregistered_athlete_id (DEFAULT NULL). La tabla del
-- contrato ya tiene la columna; sin el parámetro, los deportistas de ficha
-- (Monster, Besser: la mayoría) no podrían recibir felicitaciones. Las llamadas
-- con nombre de 4 / 3 argumentos siguen funcionando igual.
--
-- RADIO (base viva, 2026-10-25, solo lectura):
--   · Tabla nueva: 0 filas. Nadie la lee hasta que el frontend V2 la use.
--   · notifications_category_check: el CHECK se revalida sobre las filas
--     existentes; las categorías vivas se conservan, así que ninguna fila cambia
--     de validez. Ningún otro objeto se modifica.
--
-- VERIFICACIÓN (después de aplicar):
--   select proname, proacl from pg_proc where proname in ('give_kudos','list_kudos','is_linked_unregistered_athlete');
--   select policyname, cmd, roles, qual from pg_policies where tablename = 'athlete_kudos';
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'notifications_category_check';
--   Pruebas con sesión simulada: ver el informe del agente (BEGIN … ROLLBACK).
--
-- REVERSA:
--   DROP FUNCTION IF EXISTS public.give_kudos(uuid, uuid, uuid, text, uuid);
--   DROP FUNCTION IF EXISTS public.list_kudos(uuid, uuid, integer, uuid);
--   DROP TABLE IF EXISTS public.athlete_kudos;
--   (is_linked_unregistered_athlete y my_linked_unregistered_ids las usan B2 y B4:
--    solo se borran si esas también se revierten.)
--   El CHECK de categorías puede quedarse: solo agrega valores.
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

-- ─── 0. Categorías de notificación: + 'kudos', + 'match' ───────────────────
-- Se lee la lista viva del CHECK y se le suman las dos nuevas. Escribir la
-- lista a mano pisaría cualquier categoría que otra sesión haya agregado.
DO $$
DECLARE
  v_def  text;
  v_vals text[];
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.notifications'::regclass
     AND c.conname  = 'notifications_category_check';
  IF v_def IS NULL THEN
    RETURN;  -- sin CHECK no hay nada que ampliar
  END IF;

  SELECT array_agg(m[1]) INTO v_vals
    FROM regexp_matches(v_def, '''([^'']+)''', 'g') AS m;

  IF v_vals @> ARRAY['kudos', 'match'] THEN
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_vals
    FROM unnest(COALESCE(v_vals, '{}'::text[]) || ARRAY['kudos', 'match']) AS x;

  ALTER TABLE public.notifications DROP CONSTRAINT notifications_category_check;
  EXECUTE format(
    'ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check CHECK (category = ANY (%L::text[]))',
    v_vals);
END $$;

-- ─── 1. Helper: ¿la ficha (unregistered_athletes) está vinculada a mí? ──────
CREATE OR REPLACE FUNCTION public.is_linked_unregistered_athlete(p_unregistered_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unregistered_athletes ua
     WHERE ua.id = p_unregistered_id
       AND ua.linked_profile_id IS NOT NULL
       AND ua.linked_profile_id = auth.uid()
  );
$$;
COMMENT ON FUNCTION public.is_linked_unregistered_athlete(uuid) IS
  'true si la ficha de deportista está vinculada a la cuenta del caller '
  '(unregistered_athletes.linked_profile_id). Helper de policies — no revocar EXECUTE a authenticated.';
REVOKE ALL ON FUNCTION public.is_linked_unregistered_athlete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_linked_unregistered_athlete(uuid) TO authenticated;

-- Variante en arreglo para policies: se envuelve en (SELECT …) y se evalúa una
-- vez por consulta, no una vez por fila.
CREATE OR REPLACE FUNCTION public.my_linked_unregistered_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(ARRAY(
    SELECT ua.id FROM public.unregistered_athletes ua
     WHERE ua.linked_profile_id IS NOT NULL
       AND ua.linked_profile_id = auth.uid()
  ), '{}'::uuid[]);
$$;
REVOKE ALL ON FUNCTION public.my_linked_unregistered_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_linked_unregistered_ids() TO authenticated;

-- ─── 2. Tabla ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.athlete_kudos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id               uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  child_id                uuid REFERENCES public.children(id) ON DELETE CASCADE,
  athlete_user_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  unregistered_athlete_id uuid REFERENCES public.unregistered_athletes(id) ON DELETE CASCADE,
  coach_id                uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  message                 text NOT NULL,
  kudos_date              date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Bogota')::date),
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT athlete_kudos_un_sujeto
    CHECK (num_nonnulls(child_id, athlete_user_id, unregistered_athlete_id) = 1),
  CONSTRAINT athlete_kudos_message_len
    CHECK (char_length(btrim(message)) BETWEEN 1 AND 200)
);

-- 1 por deportista por día por escuela. El índice es el candado real (dos
-- profes a la vez no pasan los dos); la RPC traduce el 23505 a KUDOS_DAILY_LIMIT.
CREATE UNIQUE INDEX IF NOT EXISTS uq_athlete_kudos_sujeto_dia
  ON public.athlete_kudos (school_id, (COALESCE(child_id, athlete_user_id, unregistered_athlete_id)), kudos_date);
CREATE INDEX IF NOT EXISTS idx_athlete_kudos_child  ON public.athlete_kudos (child_id, created_at DESC) WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_athlete_kudos_user   ON public.athlete_kudos (athlete_user_id, created_at DESC) WHERE athlete_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_athlete_kudos_unreg  ON public.athlete_kudos (unregistered_athlete_id, created_at DESC) WHERE unregistered_athlete_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_athlete_kudos_school ON public.athlete_kudos (school_id, created_at DESC);

ALTER TABLE public.athlete_kudos ENABLE ROW LEVEL SECURITY;
-- Solo lectura desde el cliente. Toda escritura entra por give_kudos.
REVOKE ALL ON TABLE public.athlete_kudos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.athlete_kudos TO authenticated;

DROP POLICY IF EXISTS athlete_kudos_select ON public.athlete_kudos;
CREATE POLICY athlete_kudos_select ON public.athlete_kudos FOR SELECT TO authenticated
  USING (
    (SELECT public.is_platform_admin())
    OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (child_id IS NOT NULL AND public.is_parent_of_child(child_id))
    OR (athlete_user_id IS NOT NULL AND athlete_user_id = (SELECT auth.uid()))
    OR (unregistered_athlete_id IS NOT NULL
        AND unregistered_athlete_id = ANY ((SELECT public.my_linked_unregistered_ids())::uuid[]))
  );

-- ─── 3. give_kudos ──────────────────────────────────────────────────────────
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
  'B1 V2: felicitación del staff a un deportista de su escuela. Máx. 1 por deportista '
  'por día (hora Colombia) → KUDOS_DAILY_LIMIT. Avisa al acudiente / al deportista.';

-- ─── 4. list_kudos ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_kudos(
  p_child_id                uuid,
  p_athlete_user_id         uuid,
  p_limit                   integer DEFAULT 20,
  p_unregistered_athlete_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, message text, coach_name text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_familia boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF num_nonnulls(p_child_id, p_athlete_user_id, p_unregistered_athlete_id) <> 1 THEN
    RAISE EXCEPTION 'Indica exactamente un deportista' USING ERRCODE = '22023';
  END IF;

  -- La familia (acudiente / el propio deportista / su cuenta vinculada) ve todas
  -- las suyas; el staff, las de sus escuelas. Nadie más ve nada (lista vacía).
  v_familia := (p_child_id IS NOT NULL AND public.is_parent_of_child(p_child_id))
            OR (p_athlete_user_id IS NOT NULL AND p_athlete_user_id = v_uid)
            OR (p_unregistered_athlete_id IS NOT NULL AND public.is_linked_unregistered_athlete(p_unregistered_athlete_id));

  RETURN QUERY
  SELECT k.id, k.message, COALESCE(NULLIF(btrim(p.full_name), ''), 'Tu entrenador') AS coach_name, k.created_at
    FROM public.athlete_kudos k
    LEFT JOIN public.profiles p ON p.id = k.coach_id
   WHERE ((p_child_id IS NOT NULL AND k.child_id = p_child_id)
       OR (p_athlete_user_id IS NOT NULL AND k.athlete_user_id = p_athlete_user_id)
       OR (p_unregistered_athlete_id IS NOT NULL AND k.unregistered_athlete_id = p_unregistered_athlete_id))
     AND (v_familia
          OR k.school_id = ANY (public.user_staff_school_ids())
          OR public.is_platform_admin())
   ORDER BY k.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END;
$$;
COMMENT ON FUNCTION public.list_kudos(uuid, uuid, integer, uuid) IS
  'B1 V2: felicitaciones de un deportista. Acudiente del menor, el deportista, su cuenta '
  'vinculada a la ficha y el staff de la escuela. Otros → lista vacía.';

REVOKE ALL ON FUNCTION public.give_kudos(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_kudos(uuid, uuid, integer, uuid)    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.give_kudos(uuid, uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_kudos(uuid, uuid, integer, uuid)    TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
