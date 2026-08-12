-- ============================================================================
-- SPORTMAPS — Las entidades informativas del mapa no entran al periodo de prueba
--
-- Fecha: 2026-08-12
-- Corrige a 20260812125503 (ya aplicada, por eso va en migración nueva).
--
-- Qué apareció al aplicar: el trigger `prevent_gov_entity_subscription()` —que
-- vive en la base pero no está versionado en el repo— prohíbe crear filas en
-- school_subscriptions para institute / federation / association / facility,
-- porque son entidades solo informativas del mapa público, no clientes SaaS.
--
-- Dato que lo confirma: las 151 escuelas "sin suscripción" son EXACTAMENTE esas
-- entidades — 79 federation + 62 institute + 10 association = 151. Ninguna
-- escuela SaaS real quedó sin fila. Lo que había que arreglar no era darles
-- suscripción, sino que no se les aplique el bloqueo.
--
-- El problema concreto que cierra esta migración:
--   school_is_operational() resolvía "sin fila de suscripción" con
--   `created_at + 1 mes > now()`. Como las 151 se cargaron el 2026-06-09, todas
--   daban `false` → quedaban marcadas como bloqueadas. No lo sufre ningún
--   usuario hoy (no tienen cuentas asociadas), pero es un estado falso que
--   ensucia la consola y que mordería apenas alguna de ellas reciba un usuario.
--
-- Además se blinda el trigger de registro: insertaba la suscripción para toda
-- escuela nueva, así que crear hoy una federación desde la app chocaría contra
-- prevent_gov_entity_subscription() y tumbaría el INSERT de la escuela entera.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Qué cuenta como entidad informativa
--
-- Función propia en vez de repetir la lista en tres lugares: si mañana el
-- trigger no versionado cambia, se ajusta acá y todo queda coherente.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_informational_entity(p_school_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    -- Misma lista que rechaza prevent_gov_entity_subscription().
    SELECT COALESCE(p_school_type IN ('institute','federation','association','facility'), false);
$$;

COMMENT ON FUNCTION public.is_informational_entity(text) IS
    'true = entidad solo informativa del mapa público (institute/federation/association/facility). '
    'No es cliente SaaS: no tiene suscripción, no corre periodo de prueba y nunca se bloquea. '
    'Espeja la lista de prevent_gov_entity_subscription(), que no está versionado en el repo.';

GRANT EXECUTE ON FUNCTION public.is_informational_entity(text) TO authenticated, anon, service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. school_is_operational: las informativas siempre operan
--
-- Se agrega la rama al principio, antes que cualquier evaluación de trial.
-- El resto de la lógica queda idéntica a 20260812125503.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.school_is_operational(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE
        -- Entidad informativa del mapa: no es cliente SaaS, no aplica bloqueo.
        WHEN public.is_informational_entity(s.school_type) THEN true
        -- Cuentas nuestras: nunca se bloquean.
        WHEN s.account_type <> 'real' THEN true
        -- Exención comercial explícita (ej. Dynasty, GYM RM).
        WHEN COALESCE(sub.blocking_exempt, false) THEN true
        -- Sin fila de suscripción: se respeta el mes de prueba desde el registro.
        WHEN sub.school_id IS NULL THEN (s.created_at + interval '1 month') > now()
        -- Estado terminal declarado por el cron o por el super admin.
        WHEN sub.status IN ('trial_expired','cancelled') THEN false
        -- Prueba corriendo pero con la fecha ya pasada (el cron aún no corrió).
        WHEN sub.status = 'trialing' AND sub.trial_ends_at IS NOT NULL
             AND sub.trial_ends_at <= now() THEN false
        ELSE true
    END
    FROM public.schools s
    LEFT JOIN public.school_subscriptions sub ON sub.school_id = s.id
    WHERE s.id = p_school_id;
$$;

COMMENT ON FUNCTION public.school_is_operational(uuid) IS
    'false = escuela bloqueada por fin de periodo de prueba (solo lectura). '
    'Nunca bloquea entidades informativas del mapa, cuentas account_type<>real ni '
    'con blocking_exempt=true. Fuente única del bloqueo: la usan el middleware del BFF y RLS.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Trigger de registro: no intentar crear suscripción a una informativa
--
-- Sin esto, dar de alta una federación/instituto desde la app revienta con el
-- RAISE de prevent_gov_entity_subscription() y se cae el INSERT de la escuela.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_default_school_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
DECLARE
    v_meses integer := 1;   -- default de plataforma
BEGIN
    -- Las entidades informativas del mapa no son clientes SaaS.
    IF public.is_informational_entity(NEW.school_type) THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.school_subscriptions (
        school_id, plan_code, tier, status, billing_cycle,
        trial_ends_at, trial_months, metadata
    ) VALUES (
        NEW.id, 'starter', 'free', 'trialing', 'monthly',
        NEW.created_at + (v_meses || ' months')::interval,
        v_meses,
        jsonb_build_object(
            'created_via',   'signup_trigger',
            'trial_started', to_jsonb(NEW.created_at),
            'trial_months',  v_meses
        )
    )
    ON CONFLICT (school_id) DO NOTHING;

    RETURN NEW;
END;
$body$;

COMMENT ON FUNCTION public.create_default_school_subscription() IS
    'Trigger AFTER INSERT ON schools: crea la suscripción en starter/free/trialing con '
    '1 mes de prueba contado desde schools.created_at. Salta las entidades informativas '
    '(institute/federation/association/facility), que no admiten suscripción.';


-- ────────────────────────────────────────────────────────────────────────────
-- 4. La consola del super admin deja de listar las informativas
--
-- Aparecían como "vencidas" con una fecha de prueba que nunca existió.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_trials(
    p_filtro       text DEFAULT 'todas',   -- todas | por_vencer | vencidas | bloqueadas | exentas
    p_account_type text DEFAULT NULL,
    p_limit        integer DEFAULT 50,
    p_offset       integer DEFAULT 0
)
RETURNS TABLE (
    school_id       uuid,
    school_name     text,
    owner_email     text,
    account_type    text,
    plan_code       text,
    status          text,
    created_at      timestamptz,
    trial_ends_at   timestamptz,
    trial_months    integer,
    dias_restantes  integer,
    blocking_exempt boolean,
    blocking_exempt_reason text,
    is_operational  boolean,
    atletas_activos integer,
    total_rows      bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH base AS (
        SELECT
            s.id, s.name, s.account_type, s.created_at,
            p.email AS owner_email,
            COALESCE(ss.plan_code, 'starter')                             AS plan_code,
            COALESCE(ss.status, 'trialing')                               AS status,
            COALESCE(ss.trial_ends_at, s.created_at + interval '1 month') AS trial_ends_at,
            ss.trial_months,
            COALESCE(ss.blocking_exempt, false)                           AS blocking_exempt,
            ss.blocking_exempt_reason,
            public.school_is_operational(s.id)                            AS is_operational,
            (SELECT count(*) FROM public.enrollments e
              WHERE e.school_id = s.id AND e.status IN ('active','paid'))::int AS atletas_activos
          FROM public.schools s
          LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
          LEFT JOIN public.profiles p              ON p.id = s.owner_id
         WHERE NOT public.is_informational_entity(s.school_type)
    ), filtrado AS (
        SELECT * FROM base b
         WHERE (p_account_type IS NULL OR b.account_type = p_account_type)
           AND CASE p_filtro
                 WHEN 'por_vencer'  THEN b.trial_ends_at > now() AND b.trial_ends_at <= now() + interval '15 days'
                 WHEN 'vencidas'    THEN b.trial_ends_at <= now()
                 WHEN 'bloqueadas'  THEN b.is_operational = false
                 WHEN 'exentas'     THEN b.blocking_exempt = true
                 ELSE true
               END
    )
    SELECT f.id, f.name, f.owner_email, f.account_type, f.plan_code, f.status,
           f.created_at, f.trial_ends_at, f.trial_months,
           GREATEST(0, ceil(EXTRACT(epoch FROM (f.trial_ends_at - now())) / 86400))::int,
           f.blocking_exempt, f.blocking_exempt_reason, f.is_operational, f.atletas_activos,
           (SELECT count(*) FROM filtrado)
      FROM filtrado f
     ORDER BY f.trial_ends_at ASC
     LIMIT COALESCE(p_limit, 50) OFFSET COALESCE(p_offset, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_trials(text, text, integer, integer) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
