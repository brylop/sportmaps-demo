-- =============================================================================
-- 20261013192946_hermanos_escalonado_base.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013192936
-- Objetivo: F2 de docs/specs/dreamers-cierre-total.md — descuento por hermanos
--   ESCALONADO (Dreamers: 2.º hijo 5 %, 3.º en adelante 10 %) y hermanos cuyo
--   acudiente no tiene cuenta. Esta migración trae la base; los CREATE OR
--   REPLACE de open_month & cía. van en 20261013192955.
--
--   1. school_settings.sibling_discount_tiers numeric[] (NULL = % único de hoy;
--      Athletic Soacha 10 % y la Escuela Demo 15 % no cambian) + CHECK.
--   2. Trigger de sincronía tiers[1] <-> sibling_discount_percentage.
--   3. Tabla school_sibling_links (vínculo que confirma el admin; NUNCA se
--      escribe children.parent_id). RLS: SELECT para staff; sin escritura
--      directa (solo por RPC).
--   4. Helpers (solo service_role): _sibling_family, _sibling_rank,
--      _sibling_tier_pct, sibling_discount_quote, _sibling_link_core.
--   5. RPCs para la app (authenticated, gate interno): link_siblings,
--      unlink_sibling, get_sibling_family.
--
-- Compatible con el SQL Editor (sin TEMP TABLE). Sin CREATE TYPE.
-- =============================================================================

BEGIN;

-- ── 1. Columna + CHECK ───────────────────────────────────────────────────────
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS sibling_discount_tiers numeric[];

COMMENT ON COLUMN public.school_settings.sibling_discount_tiers IS
  'Descuento por hermanos escalonado: tiers[1] = % del 2.º hijo, tiers[2] = 3.º, ...; el último vale para todos los siguientes. NULL = se usa sibling_discount_percentage para todo hermano a partir del 2.º (comportamiento previo). tiers[1] se mantiene sincronizado con sibling_discount_percentage por trigger.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.school_settings'::regclass
                    AND conname = 'school_settings_sibling_discount_tiers_chk') THEN
    ALTER TABLE public.school_settings
      ADD CONSTRAINT school_settings_sibling_discount_tiers_chk CHECK (
        sibling_discount_tiers IS NULL OR (
              array_ndims(sibling_discount_tiers) = 1
          AND array_lower(sibling_discount_tiers, 1) = 1
          AND cardinality(sibling_discount_tiers) BETWEEN 1 AND 10
          AND array_position(sibling_discount_tiers, NULL) IS NULL
          AND 0   <= ALL (sibling_discount_tiers)
          AND 100 >= ALL (sibling_discount_tiers)
        )
      );
  END IF;
END $$;

-- ── 2. Sincronía tiers[1] <-> sibling_discount_percentage ─────────────────────
-- Las pantallas viejas (y los BFF sin desplegar) escriben solo el %; las nuevas
-- escriben los dos. Cambian los escalones → manda tiers[1]. Cambia solo el % y
-- hay escalones → el % pasa a ser el primer escalón.
CREATE OR REPLACE FUNCTION public.fn_school_settings_sibling_tiers_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sibling_discount_tiers IS NOT NULL THEN
      NEW.sibling_discount_percentage := COALESCE(NEW.sibling_discount_tiers[1], NEW.sibling_discount_percentage);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.sibling_discount_tiers IS DISTINCT FROM OLD.sibling_discount_tiers THEN
    IF NEW.sibling_discount_tiers IS NOT NULL THEN
      NEW.sibling_discount_percentage := COALESCE(NEW.sibling_discount_tiers[1], NEW.sibling_discount_percentage);
    END IF;
  ELSIF NEW.sibling_discount_percentage IS DISTINCT FROM OLD.sibling_discount_percentage
        AND NEW.sibling_discount_tiers IS NOT NULL THEN
    NEW.sibling_discount_tiers[1] := COALESCE(NEW.sibling_discount_percentage, 0);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_school_settings_sibling_tiers_sync() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_school_settings_sibling_tiers_sync() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_school_settings_sibling_tiers_sync ON public.school_settings;
CREATE TRIGGER trg_school_settings_sibling_tiers_sync
  BEFORE INSERT OR UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_school_settings_sibling_tiers_sync();

-- ── 3. Vínculos de hermanos sin cuenta de acudiente ──────────────────────────
CREATE TABLE IF NOT EXISTS public.school_sibling_links (
  school_id  uuid        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  child_id   uuid        NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  group_id   uuid        NOT NULL,
  source     text        NOT NULL DEFAULT 'ficha'
                         CONSTRAINT school_sibling_links_source_chk CHECK (source IN ('alta', 'ficha')),
  created_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, child_id)
);

COMMENT ON TABLE public.school_sibling_links IS
  'Hermanos confirmados por el admin cuando el acudiente no tiene cuenta (no comparten children.parent_id). Mismo group_id = misma familia dentro de la escuela. Se escribe SOLO por link_siblings / unlink_sibling / create_enrollment_with_payments.';

CREATE INDEX IF NOT EXISTS school_sibling_links_group_idx
  ON public.school_sibling_links (school_id, group_id);
CREATE INDEX IF NOT EXISTS school_sibling_links_child_idx
  ON public.school_sibling_links (child_id);

ALTER TABLE public.school_sibling_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.school_sibling_links FROM PUBLIC;
REVOKE ALL ON TABLE public.school_sibling_links FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.school_sibling_links FROM authenticated;
GRANT SELECT ON TABLE public.school_sibling_links TO authenticated;
GRANT ALL ON TABLE public.school_sibling_links TO service_role;

DROP POLICY IF EXISTS school_sibling_links_staff_select ON public.school_sibling_links;
CREATE POLICY school_sibling_links_staff_select
  ON public.school_sibling_links
  FOR SELECT TO authenticated
  USING (school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[]));

-- ── 4. Helpers (solo service_role) ───────────────────────────────────────────

-- Familia ACTIVA en la escuela de uno o más niños semilla: clausura por
-- children.parent_id (no nulo) y por group_id de school_sibling_links de ESA
-- escuela. Solo niños con inscripción activa en la escuela; cada niño una vez
-- con la fecha de su inscripción activa más antigua.
CREATE OR REPLACE FUNCTION public._sibling_family(p_school_id uuid, p_seeds uuid[])
RETURNS TABLE (child_id uuid, since timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH RECURSIVE fam(child_id) AS (
    SELECT s.id FROM unnest(p_seeds) AS s(id) WHERE s.id IS NOT NULL
    UNION
    SELECT x.child_id
      FROM fam f
      CROSS JOIN LATERAL (
        SELECT c2.id AS child_id
          FROM public.children c1
          JOIN public.children c2 ON c2.parent_id = c1.parent_id
         WHERE c1.id = f.child_id
           AND c1.parent_id IS NOT NULL
        UNION ALL
        SELECT l2.child_id
          FROM public.school_sibling_links l1
          JOIN public.school_sibling_links l2
            ON l2.school_id = l1.school_id AND l2.group_id = l1.group_id
         WHERE l1.school_id = p_school_id
           AND l1.child_id = f.child_id
      ) x
  )
  SELECT e.child_id, min(e.created_at) AS since
    FROM public.enrollments e
    JOIN fam ON fam.child_id = e.child_id
   WHERE e.school_id = p_school_id
     AND e.status = 'active'
   GROUP BY e.child_id;
$$;

-- Rango del niño en su familia activa: 1 = el más antiguo (paga completo),
-- 2 = 2.º hijo, ... Orden por (since, child_id). p_since fija la fecha del
-- niño (p. ej. su inscripción inactiva); NULL = su inscripción activa más
-- antigua, o ahora si no tiene (alta en curso → es el más nuevo).
CREATE OR REPLACE FUNCTION public._sibling_rank(p_school_id uuid, p_child_id uuid, p_since timestamptz DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH fam AS (
    SELECT f.child_id, f.since FROM public._sibling_family(p_school_id, ARRAY[p_child_id]) f
  ), me AS (
    SELECT COALESCE(p_since, (SELECT fam.since FROM fam WHERE fam.child_id = p_child_id), now()) AS since
  )
  SELECT CASE WHEN p_child_id IS NULL THEN 1
              ELSE 1 + (SELECT count(*)::int FROM fam, me
                         WHERE fam.child_id <> p_child_id
                           AND (fam.since < me.since
                                OR (fam.since = me.since AND fam.child_id < p_child_id)))
         END;
$$;

-- % de descuento para un rango: 0 si rank < 2 o la escuela lo tiene apagado;
-- con escalones tiers[LEAST(rank-1, cardinality)]; sin escalones el % único.
CREATE OR REPLACE FUNCTION public._sibling_tier_pct(p_school_id uuid, p_rank integer)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT CASE
             WHEN p_rank IS NULL OR p_rank < 2 THEN 0
             WHEN NOT COALESCE(ss.sibling_discount_enabled, false) THEN 0
             WHEN ss.sibling_discount_tiers IS NOT NULL
               THEN ss.sibling_discount_tiers[LEAST(p_rank - 1, cardinality(ss.sibling_discount_tiers))]
             ELSE COALESCE(ss.sibling_discount_percentage, 0)
           END
      FROM public.school_settings ss
     WHERE ss.school_id = p_school_id
  ), 0);
$$;

-- Cotización para el BFF (alta, cambio de plan, edición, reprecio).
--   p_child_id       niño (NULL en un alta cuyo niño aún no existe)
--   p_sibling_of     hermano que el admin señaló en el alta (aún sin vínculo)
--   p_enrollment_id  inscripción concreta (para fee_is_manual)
-- {pct, rank, family_active, fee_is_manual}. Un fee_is_manual no recibe
-- descuento (pct 0) pero sí cuenta para el rango de los demás.
CREATE OR REPLACE FUNCTION public.sibling_discount_quote(
  p_school_id     uuid,
  p_child_id      uuid,
  p_sibling_of    uuid DEFAULT NULL,
  p_enrollment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_rank   integer;
  v_fam    integer;
  v_manual boolean := false;
  v_since  timestamptz;
BEGIN
  SELECT count(*)::int INTO v_fam
    FROM public._sibling_family(p_school_id, ARRAY[p_child_id, p_sibling_of]);

  IF p_child_id IS NOT NULL THEN
    SELECT f.since INTO v_since
      FROM public._sibling_family(p_school_id, ARRAY[p_child_id, p_sibling_of]) f
     WHERE f.child_id = p_child_id;
  END IF;
  v_since := COALESCE(v_since, now());

  SELECT 1 + count(*)::int INTO v_rank
    FROM public._sibling_family(p_school_id, ARRAY[p_child_id, p_sibling_of]) f
   WHERE f.child_id IS DISTINCT FROM p_child_id
     AND (f.since < v_since
          OR (f.since = v_since AND p_child_id IS NOT NULL AND f.child_id < p_child_id));

  IF p_enrollment_id IS NOT NULL THEN
    SELECT COALESCE(e.fee_is_manual, false) INTO v_manual
      FROM public.enrollments e
     WHERE e.id = p_enrollment_id AND e.school_id = p_school_id;
  ELSIF p_child_id IS NOT NULL THEN
    SELECT COALESCE(bool_or(e.fee_is_manual), false) INTO v_manual
      FROM public.enrollments e
     WHERE e.school_id = p_school_id AND e.child_id = p_child_id AND e.status = 'active';
  END IF;
  v_manual := COALESCE(v_manual, false);

  RETURN jsonb_build_object(
    'pct',           CASE WHEN v_manual THEN 0 ELSE public._sibling_tier_pct(p_school_id, v_rank) END,
    'rank',          v_rank,
    'family_active', v_fam,
    'fee_is_manual', v_manual
  );
END;
$$;

-- Núcleo del vínculo (sin gate: lo llaman link_siblings y
-- create_enrollment_with_payments, que ya validaron).
CREATE OR REPLACE FUNCTION public._sibling_link_core(
  p_school_id uuid,
  p_child_ids uuid[],
  p_source    text,
  p_actor     uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_ids    uuid[];
  v_groups uuid[];
  v_group  uuid;
  v_bad    uuid;
  v_out    uuid[];
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'hermanos_datos_invalidos: escuela obligatoria' USING ERRCODE = '22023';
  END IF;
  IF p_source NOT IN ('alta', 'ficha') THEN
    RAISE EXCEPTION 'hermanos_datos_invalidos: origen %', p_source USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(p_child_ids) AS x WHERE x IS NOT NULL;
  IF COALESCE(cardinality(v_ids), 0) < 2 THEN
    RAISE EXCEPTION 'hermanos_datos_invalidos: se necesitan al menos dos niños distintos' USING ERRCODE = '22023';
  END IF;

  -- Todos deben tener (o haber tenido) inscripción en ESTA escuela.
  SELECT x INTO v_bad FROM unnest(v_ids) AS x
   WHERE NOT EXISTS (SELECT 1 FROM public.enrollments e
                      WHERE e.school_id = p_school_id AND e.child_id = x)
   LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'hermanos_otra_escuela: el niño % no está inscrito en esta escuela', v_bad
      USING ERRCODE = '22023';
  END IF;

  -- Serializa con las altas de la misma escuela (mismo candado que
  -- create_enrollment_with_payments).
  PERFORM pg_advisory_xact_lock(hashtextextended('siblings:' || p_school_id::text, 0));

  SELECT array_agg(DISTINCT l.group_id) INTO v_groups
    FROM public.school_sibling_links l
   WHERE l.school_id = p_school_id AND l.child_id = ANY (v_ids);

  IF v_groups IS NULL THEN
    v_group := gen_random_uuid();
  ELSE
    SELECT l.group_id INTO v_group
      FROM public.school_sibling_links l
     WHERE l.school_id = p_school_id AND l.group_id = ANY (v_groups)
     ORDER BY l.created_at, l.group_id
     LIMIT 1;
    -- Fusiona las familias que se tocan.
    UPDATE public.school_sibling_links
       SET group_id = v_group
     WHERE school_id = p_school_id AND group_id = ANY (v_groups) AND group_id <> v_group;
  END IF;

  INSERT INTO public.school_sibling_links (school_id, child_id, group_id, source, created_by)
  SELECT p_school_id, x, v_group, p_source, p_actor FROM unnest(v_ids) AS x
  ON CONFLICT (school_id, child_id) DO UPDATE SET group_id = EXCLUDED.group_id;

  SELECT array_agg(l.child_id ORDER BY l.created_at, l.child_id) INTO v_out
    FROM public.school_sibling_links l
   WHERE l.school_id = p_school_id AND l.group_id = v_group;

  INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)
  VALUES (p_school_id, p_actor, 'school_sibling_links', v_group::text, 'link_siblings',
          CASE WHEN v_groups IS NULL THEN NULL ELSE jsonb_build_object('merged_groups', to_jsonb(v_groups)) END,
          jsonb_build_object('child_ids', to_jsonb(v_ids), 'members', to_jsonb(v_out), 'source', p_source));

  RETURN jsonb_build_object('group_id', v_group, 'child_ids', to_jsonb(v_out));
END;
$$;

-- ── 5. RPCs para la app ──────────────────────────────────────────────────────
-- Gate: admin de la escuela (user_admin_school_ids, sin coaches) o super admin.
-- Sin JWT (service_role / BFF) pasa: anon no tiene EXECUTE.
CREATE OR REPLACE FUNCTION public.link_siblings(p_school_id uuid, p_child_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (public.is_super_admin() OR p_school_id = ANY (public.user_admin_school_ids())) THEN
    RAISE EXCEPTION 'no_autorizado: solo el administrador de la escuela vincula hermanos'
      USING ERRCODE = '42501';
  END IF;
  RETURN public._sibling_link_core(p_school_id, p_child_ids, 'ficha', auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.unlink_sibling(p_school_id uuid, p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_group uuid;
  v_left  uuid[];
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (public.is_super_admin() OR p_school_id = ANY (public.user_admin_school_ids())) THEN
    RAISE EXCEPTION 'no_autorizado: solo el administrador de la escuela desvincula hermanos'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('siblings:' || p_school_id::text, 0));

  DELETE FROM public.school_sibling_links
   WHERE school_id = p_school_id AND child_id = p_child_id
  RETURNING group_id INTO v_group;

  IF v_group IS NULL THEN
    RETURN jsonb_build_object('removed', false, 'group_id', NULL);
  END IF;

  -- Un grupo de un solo niño no es familia: se borra.
  SELECT array_agg(child_id) INTO v_left
    FROM public.school_sibling_links
   WHERE school_id = p_school_id AND group_id = v_group;
  IF COALESCE(cardinality(v_left), 0) < 2 THEN
    DELETE FROM public.school_sibling_links WHERE school_id = p_school_id AND group_id = v_group;
    v_left := NULL;
  END IF;

  INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)
  VALUES (p_school_id, auth.uid(), 'school_sibling_links', v_group::text, 'unlink_sibling',
          jsonb_build_object('child_id', p_child_id),
          jsonb_build_object('members', to_jsonb(v_left)));

  RETURN jsonb_build_object('removed', true, 'group_id', v_group);
END;
$$;

-- Familia de un niño para la ficha (staff de la escuela). Incluye al niño
-- (via 'self'), hermanos por acudiente ('acudiente') y por vínculo ('vinculo');
-- rank/pct solo para los que tienen inscripción activa.
CREATE OR REPLACE FUNCTION public.get_sibling_family(p_school_id uuid, p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (public.is_super_admin() OR p_school_id = ANY (public.user_staff_school_ids())) THEN
    RAISE EXCEPTION 'no_autorizado' USING ERRCODE = '42501';
  END IF;

  WITH RECURSIVE fam(child_id) AS (
    SELECT p_child_id
    UNION
    SELECT x.child_id
      FROM fam f
      CROSS JOIN LATERAL (
        SELECT c2.id AS child_id
          FROM public.children c1
          JOIN public.children c2 ON c2.parent_id = c1.parent_id
         WHERE c1.id = f.child_id AND c1.parent_id IS NOT NULL
        UNION ALL
        SELECT l2.child_id
          FROM public.school_sibling_links l1
          JOIN public.school_sibling_links l2
            ON l2.school_id = l1.school_id AND l2.group_id = l1.group_id
         WHERE l1.school_id = p_school_id AND l1.child_id = f.child_id
      ) x
  ),
  -- Solo niños con alguna inscripción en esta escuela (no se exponen hermanos
  -- de otras escuelas).
  en_escuela AS (
    SELECT fam.child_id FROM fam
     WHERE EXISTS (SELECT 1 FROM public.enrollments e
                    WHERE e.school_id = p_school_id AND e.child_id = fam.child_id)
  ),
  act AS (
    SELECT f.child_id, f.since FROM public._sibling_family(p_school_id, ARRAY[p_child_id]) f
  ),
  me AS (SELECT c.parent_id FROM public.children c WHERE c.id = p_child_id),
  mylink AS (SELECT l.group_id FROM public.school_sibling_links l
              WHERE l.school_id = p_school_id AND l.child_id = p_child_id)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'child_id',  c.id,
           'full_name', c.full_name,
           'via', CASE WHEN c.id = p_child_id THEN 'self'
                       WHEN c.parent_id IS NOT NULL AND c.parent_id = (SELECT parent_id FROM me) THEN 'acudiente'
                       WHEN EXISTS (SELECT 1 FROM public.school_sibling_links l, mylink
                                     WHERE l.school_id = p_school_id AND l.child_id = c.id
                                       AND l.group_id = mylink.group_id) THEN 'vinculo'
                       ELSE 'acudiente' END,
           'active', act.child_id IS NOT NULL,
           'since',  act.since,
           'rank',   CASE WHEN act.child_id IS NOT NULL THEN public._sibling_rank(p_school_id, c.id) END,
           'pct',    CASE WHEN act.child_id IS NOT NULL
                          THEN public._sibling_tier_pct(p_school_id, public._sibling_rank(p_school_id, c.id)) END
         ) ORDER BY act.since NULLS LAST, c.id), '[]'::jsonb)
    INTO v_out
    FROM en_escuela ee
    JOIN public.children c ON c.id = ee.child_id
    LEFT JOIN act ON act.child_id = c.id;

  RETURN v_out;
END;
$$;

-- ── Permisos ─────────────────────────────────────────────────────────────────
-- Los default privileges del esquema dan EXECUTE a authenticated en toda
-- función nueva: se revoca EXPLÍCITO de anon y authenticated (CLAUDE.md, trampa 3).
REVOKE ALL ON FUNCTION public._sibling_family(uuid, uuid[])                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sibling_rank(uuid, uuid, timestamptz)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sibling_tier_pct(uuid, integer)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sibling_discount_quote(uuid, uuid, uuid, uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sibling_link_core(uuid, uuid[], text, uuid)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_siblings(uuid, uuid[])                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unlink_sibling(uuid, uuid)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sibling_family(uuid, uuid)                    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public._sibling_family(uuid, uuid[])                  TO service_role;
GRANT EXECUTE ON FUNCTION public._sibling_rank(uuid, uuid, timestamptz)         TO service_role;
GRANT EXECUTE ON FUNCTION public._sibling_tier_pct(uuid, integer)               TO service_role;
GRANT EXECUTE ON FUNCTION public.sibling_discount_quote(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._sibling_link_core(uuid, uuid[], text, uuid)   TO service_role;
GRANT EXECUTE ON FUNCTION public.link_siblings(uuid, uuid[])                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlink_sibling(uuid, uuid)                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sibling_family(uuid, uuid)                 TO authenticated, service_role;

COMMIT;
