-- ============================================================
-- SPORTMAPS — FIX v6: categorización entidades + fix branches IDRD
--
-- Resuelve 3 issues detectados en staging:
--
--   1. ENTIDADES NO SON ESCUELAS — Federaciones, institutos, asociaciones
--      y secretarías están marcados como school_type='academy'. Deben ser:
--        - 'institute'    para institutos dept + secretarías municipales
--        - 'federation'   para federaciones deportivas colombianas
--        - 'association'  para asociaciones recreativas
--        - 'club'         para clubes deportebogota.com
--      IDRD (escuelas avaladas) sí son 'academy'.
--
--   2. IDRD BRANCHES SIN LAT — 32 de las 70 escuelas IDRD tienen branches
--      pero sin lat/lng (el cleanup v2 priorizó la branch más antigua,
--      que a veces era la vacía). Re-cleanup priorizando branches CON lat,
--      y fallback a coords aproximadas Bogotá para las que aún queden sin.
--
--   3. BLOQUEAR SIGNUPS EN ENTIDADES NO-ESCUELA — Las entidades
--      institute/federation/association NO deben aceptar registros de
--      familias ni cobros. Solo son info pública en el mapa.
--      Trigger que bloquea INSERT en school_subscriptions para esos tipos.
--
-- Idempotente. Aplicar después del consolidado anterior.
-- ============================================================

BEGIN;


-- ============================================================
-- 0. CLEANUP previo — borrar las 116 entidades con external_ref
--    cortos (duplicados truncados a 30 chars del Python viejo).
--    El nuevo seed entidades_deportivas_2025_2026.sql viene con
--    refs unicos (slug + hash MD5 8 chars).
-- ============================================================

-- 0.A — Borrar school_settings, branches, schools y external_school_imports
--       de los registros mindeporte con external_ref viejo (sin hash al final).
--       Los viejos terminan en slug truncado; los nuevos terminan en -<8hex>.

DO $$
DECLARE
    v_school_ids uuid[];
BEGIN
    -- Detecta refs viejos: NO terminan en '-<8 hex chars>'
    SELECT array_agg(school_id) INTO v_school_ids
      FROM public.external_school_imports
     WHERE source = 'mindeporte_entidades_2025_2026'
       AND external_ref !~ '-[0-9a-f]{8}$';

    IF v_school_ids IS NOT NULL AND array_length(v_school_ids, 1) > 0 THEN
        DELETE FROM public.school_branches WHERE school_id = ANY(v_school_ids);
        DELETE FROM public.school_settings WHERE school_id = ANY(v_school_ids);
        DELETE FROM public.external_school_imports
         WHERE source = 'mindeporte_entidades_2025_2026'
           AND school_id = ANY(v_school_ids);
        DELETE FROM public.schools WHERE id = ANY(v_school_ids);
    END IF;
END $$;


-- ============================================================
-- 1. CATEGORIZACIÓN — UPDATE school_type por source
-- ============================================================

-- 1.A — Mindeporte entidades: institutos (departamentales + municipales)
UPDATE public.schools s
   SET school_type = 'institute',
       updated_at = now()
  FROM public.external_school_imports e
 WHERE e.school_id = s.id
   AND e.source = 'mindeporte_entidades_2025_2026'
   AND (e.external_ref LIKE 'INST-DEP-%' OR e.external_ref LIKE 'INST-MUN-%')
   AND s.school_type != 'institute';

-- 1.B — Mindeporte entidades: federaciones
UPDATE public.schools s
   SET school_type = 'federation',
       updated_at = now()
  FROM public.external_school_imports e
 WHERE e.school_id = s.id
   AND e.source = 'mindeporte_entidades_2025_2026'
   AND e.external_ref LIKE 'FED-%'
   AND s.school_type != 'federation';

-- 1.C — Mindeporte entidades: asociaciones / fundaciones
UPDATE public.schools s
   SET school_type = 'association',
       updated_at = now()
  FROM public.external_school_imports e
 WHERE e.school_id = s.id
   AND e.source = 'mindeporte_entidades_2025_2026'
   AND e.external_ref LIKE 'ASOC-%'
   AND s.school_type != 'association';

-- 1.D — Deportebogota: clubes deportivos (no son escuelas formales)
UPDATE public.schools s
   SET school_type = 'club',
       updated_at = now()
  FROM public.external_school_imports e
 WHERE e.school_id = s.id
   AND e.source = 'deportebogota_2026'
   AND s.school_type != 'club';

-- IDRD se queda con school_type='academy' (correcto, sí son escuelas).


-- ============================================================
-- 2. FIX IDRD BRANCHES — re-priorizar branches con lat NOT NULL
-- ============================================================
--
-- El cleanup v2 usaba ORDER BY created_at ASC, manteniendo la primera
-- (a veces vacía). Ahora: para cada IDRD school con múltiples branches
-- main, dejamos la que SÍ tenga lat/lng (si existe).

-- 2.A — Borrar branches IDRD vacías (lat IS NULL) si la school tiene
--       otra branch main CON lat. (deja la geocodificada)
WITH ranked AS (
    SELECT
        b.id,
        b.school_id,
        b.lat,
        ROW_NUMBER() OVER (
            PARTITION BY b.school_id
            ORDER BY
                (CASE WHEN b.lat IS NOT NULL AND b.lng IS NOT NULL THEN 0 ELSE 1 END),
                b.created_at ASC,
                b.id ASC
        ) AS rn
    FROM public.school_branches b
    JOIN public.external_school_imports e ON e.school_id = b.school_id
    WHERE e.source = 'idrd_bogota_2026'
      AND b.is_main = true
),
to_delete AS (
    SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.school_branches
 WHERE id IN (SELECT id FROM to_delete);

-- 2.B — Para IDRD schools que aún no tengan branch main con lat,
--       insertar coords aproximadas centro Bogotá (fallback visible
--       en el mapa). Mejor que invisible.
INSERT INTO public.school_branches (school_id, name, address, city, lat, lng, is_main, status)
SELECT
    e.school_id,
    'Sede Principal',
    NULL,
    'Bogotá',
    -- Centro Bogotá con leve jitter por school_id (para no apilar marcadores)
    4.6533 + (mod(abs(hashtext(e.school_id::text)), 200) - 100) / 5000.0,
    -74.0836 + (mod(abs(hashtext(e.school_id::text) >> 8), 200) - 100) / 5000.0,
    true,
    'active'
FROM public.external_school_imports e
WHERE e.source = 'idrd_bogota_2026'
  AND NOT EXISTS (
      SELECT 1 FROM public.school_branches b
       WHERE b.school_id = e.school_id
         AND b.is_main = true
         AND b.lat IS NOT NULL
         AND b.lng IS NOT NULL
  );


-- ============================================================
-- 3. BLOQUEAR SIGNUPS EN ENTIDADES NO-ESCUELA (RLS + trigger)
-- ============================================================

-- 3.0 — Reemplazar create_default_school_subscription para que NO cree
--       trial automatico en gov entities (institute/federation/association).
--       Sin esto, el INSERT en schools dispara el trigger AFTER INSERT que
--       intenta crear school_subscriptions, lo cual es bloqueado por nuestro
--       trigger nuevo prevent_gov_entity_subscription_trg y todo falla.
--       Solucion: early return en la funcion default si la nueva school es gov.

CREATE OR REPLACE FUNCTION public.create_default_school_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
BEGIN
    -- Skip: entidades gubernamentales no son SaaS, no tienen trial ni plan.
    IF NEW.school_type IN ('institute', 'federation', 'association') THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.school_subscriptions (
        school_id,
        plan_code,
        tier,
        status,
        billing_cycle,
        trial_ends_at,
        metadata
    ) VALUES (
        NEW.id,
        'starter',
        'free',
        'trialing',
        'monthly',
        now() + interval '30 days',
        jsonb_build_object(
            'created_via',   'signup_trigger',
            'trial_started', to_jsonb(now())
        )
    )
    ON CONFLICT (school_id) DO NOTHING;

    RETURN NEW;
END;
$body$;


-- 3.A — Función helper: ¿este school_id es una entidad gubernamental?
CREATE OR REPLACE FUNCTION public.is_gov_entity(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.schools
         WHERE id = p_school_id
           AND school_type IN ('institute', 'federation', 'association')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_gov_entity(uuid) TO authenticated, anon;

-- 3.B — Trigger BEFORE INSERT en school_subscriptions: bloquear si gov entity
CREATE OR REPLACE FUNCTION public.prevent_gov_entity_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF public.is_gov_entity(NEW.school_id) THEN
        RAISE EXCEPTION 'No se permite crear subscriptions en entidades gubernamentales (institute/federation/association). Estas entidades son solo informativas.'
            USING ERRCODE = 'P0001',
                  HINT = 'Estas entidades aparecen en el mapa publico pero no operan como escuelas SaaS.';
    END IF;
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'school_subscriptions'
    ) THEN
        DROP TRIGGER IF EXISTS prevent_gov_entity_subscription_trg ON public.school_subscriptions;
        CREATE TRIGGER prevent_gov_entity_subscription_trg
            BEFORE INSERT OR UPDATE OF school_id ON public.school_subscriptions
            FOR EACH ROW EXECUTE FUNCTION public.prevent_gov_entity_subscription();
    END IF;
END $$;


-- ============================================================
-- 4. Verificación (correr aparte si querés)
-- ============================================================
-- SELECT school_type, COUNT(*) FROM public.schools GROUP BY school_type ORDER BY 2 DESC;
-- SELECT
--   e.source,
--   s.school_type,
--   COUNT(*) AS total,
--   COUNT(DISTINCT b.school_id) FILTER (WHERE b.lat IS NOT NULL) AS con_lat
-- FROM public.external_school_imports e
-- JOIN public.schools s ON s.id = e.school_id
-- LEFT JOIN public.school_branches b ON b.school_id = s.id AND b.is_main
-- GROUP BY e.source, s.school_type
-- ORDER BY e.source, s.school_type;


COMMIT;
