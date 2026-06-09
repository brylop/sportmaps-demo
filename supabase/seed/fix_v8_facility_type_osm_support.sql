-- ============================================================
-- SPORTMAPS — FIX v8: school_type='facility' para canchas/gimnasios OSM
--
-- Para soportar la importacion de Overpass API (OpenStreetMap):
--   - club=sport                → 'club'         (ya existia)
--   - leisure=sports_centre     → 'academy'      (ya existia)
--   - leisure=pitch             → 'facility'     (NUEVO)
--   - leisure=swimming_pool     → 'facility'     (NUEVO)
--   - leisure=fitness_centre    → 'facility'     (NUEVO)
--
-- 'facility' es infraestructura deportiva sin operador SaaS:
--   - NO recibe trial 30 dias
--   - NO acepta school_subscriptions
--   - NO acepta familias / enrollments
--   - SI aparece en el mapa publico /explorar como info
--
-- Aplicar despues de fix_v7. Idempotente.
-- ============================================================

BEGIN;


-- ============================================================
-- A. Funcion is_non_saas_entity — bloquea SaaS flow para gov + facility
-- ============================================================
-- Reemplaza el uso de is_gov_entity en triggers de bloqueo SaaS.
-- Conserva is_gov_entity por si codigo legacy la usa.

CREATE OR REPLACE FUNCTION public.is_non_saas_entity(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.schools
         WHERE id = p_school_id
           AND school_type IN ('institute', 'federation', 'association', 'facility')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_non_saas_entity(uuid) TO authenticated, anon;


-- ============================================================
-- B. Reemplazar create_default_school_subscription para skip facility
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_default_school_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
BEGIN
    -- Skip entidades no-SaaS: gobierno + infraestructura
    IF NEW.school_type IN ('institute', 'federation', 'association', 'facility') THEN
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


-- ============================================================
-- C. Trigger de bloqueo: usar is_non_saas_entity en lugar de is_gov_entity
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_gov_entity_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF public.is_non_saas_entity(NEW.school_id) THEN
        RAISE EXCEPTION 'No se permite crear subscriptions en entidades no-SaaS (institute/federation/association/facility). Estas entidades son solo informativas.'
            USING ERRCODE = 'P0001',
                  HINT = 'Estas entidades aparecen en el mapa publico pero no operan como escuelas SaaS.';
    END IF;
    RETURN NEW;
END;
$$;


COMMIT;
