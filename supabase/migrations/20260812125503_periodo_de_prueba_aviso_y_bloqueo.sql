-- ============================================================================
-- SPORTMAPS — Periodo de prueba: aviso con contador + bloqueo al vencer
--
-- Fecha: 2026-08-12
-- Decisión del dueño del producto (2026-08-12):
--   · La prueba se cuenta desde la FECHA DE REGISTRO de la escuela.
--     Default de aquí en adelante: 1 mes. Lo entregado hasta hoy: 2 meses.
--   · El super admin debe poder fijar/extender el periodo por escuela, sin SQL.
--   · Al vencer: aviso al owner con contador y luego bloqueo (solo lectura).
--   · DYNASTY VOLLEY CLUB se avisa pero NO se bloquea (está en uso real).
--   · Las cuentas demo/pruebas nunca se bloquean.
--
-- Por qué hace falta esto (auditado hoy con scripts/audit-trial-2meses-2026-08-12.mjs):
--   `trial_ends_at` hoy no se puede usar como disparador: está vencido en casi
--   todas (Dynasty 2026-06-27, patinaje 2026-07-04), 178 escuelas quedaron en
--   status='active' tras un UPDATE masivo del 2026-07-21, y 151 no tienen fila
--   en school_subscriptions. Sin normalizar el dato, cualquier cron pega donde
--   no debe. Esta migración crea el mecanismo; la normalización del dato va
--   aparte en scripts/trial-normalizar-periodos-2026-08-12.sql (revisable).
--
-- Convenciones respetadas: text+CHECK (no CREATE TYPE), search_path fijo en
-- toda función, GRANT EXECUTE explícito por RPC, sin self-recursion en RLS.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. schools.account_type — separar cuentas reales de pruebas/demo
--
-- Es el gate G-TEST: sin esto el cron de expiración bloquearía las cuentas con
-- las que probamos. `is_demo` NO se toca (lo consume el mapa público) y además
-- está mal mantenido, así que sirve como semilla del backfill pero no como
-- fuente de verdad futura.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.schools
    ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'real';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.schools'::regclass
           AND conname  = 'schools_account_type_check'
    ) THEN
        ALTER TABLE public.schools
            ADD CONSTRAINT schools_account_type_check
            CHECK (account_type IN ('real','test','demo'));
    END IF;
END $$;

-- Backfill: lo que hoy está marcado is_demo pasa a 'demo'.
UPDATE public.schools
   SET account_type = 'demo'
 WHERE is_demo = true
   AND account_type = 'real';

CREATE INDEX IF NOT EXISTS idx_schools_account_type_no_real
    ON public.schools(account_type)
 WHERE account_type <> 'real';

COMMENT ON COLUMN public.schools.account_type IS
    'real = cuenta de cliente (sujeta a trial, cron de expiración y bloqueo). '
    'test/demo = cuenta nuestra: exenta del cron, del bloqueo y de las métricas de negocio. '
    'Backfill inicial desde is_demo, que queda solo para el mapa público.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. school_subscriptions — exención de bloqueo por escuela
--
-- Separa el ESTADO ("la prueba venció") de la CONSECUENCIA ("se bloquea").
-- Dynasty queda con status='trial_expired' — que es la verdad, y por eso el
-- owner ve el aviso — pero blocking_exempt=true, así que no se le corta nada.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.school_subscriptions
    ADD COLUMN IF NOT EXISTS blocking_exempt        boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS blocking_exempt_reason text,
    ADD COLUMN IF NOT EXISTS trial_months           integer;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.school_subscriptions'::regclass
           AND conname  = 'school_subscriptions_trial_months_check'
    ) THEN
        ALTER TABLE public.school_subscriptions
            ADD CONSTRAINT school_subscriptions_trial_months_check
            CHECK (trial_months IS NULL OR trial_months BETWEEN 0 AND 36);
    END IF;
END $$;

COMMENT ON COLUMN public.school_subscriptions.blocking_exempt IS
    'true → la escuela ve el aviso de fin de prueba pero NUNCA se bloquea. '
    'Para clientes en uso real mientras se cierra el trato comercial (ej. Dynasty).';
COMMENT ON COLUMN public.school_subscriptions.trial_months IS
    'Meses de prueba concedidos, contados desde schools.created_at. NULL → default de la plataforma. '
    'Se guarda para que el super admin vea POR QUÉ la fecha es la que es.';

-- El índice existente solo cubre status='trialing'; el cron también busca vencidas.
CREATE INDEX IF NOT EXISTS idx_school_subscriptions_trial_expiry
    ON public.school_subscriptions(trial_ends_at, status)
 WHERE status IN ('trialing','trial_expired');


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Registro nuevo: 1 mes contado desde el registro
--
-- Reemplaza los 30 días fijos por 1 mes calendario, que es lo que la escuela
-- entiende, y deja trial_months=1 explícito. No toca escuelas existentes
-- (ON CONFLICT DO NOTHING) — la normalización del parque va en script aparte.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_default_school_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $body$
DECLARE
    v_meses integer := 1;   -- default de plataforma (antes: 30 días fijos)
BEGIN
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
    '1 mes de prueba contado desde schools.created_at (antes: 30 días desde now()). '
    'Idempotente. El super admin puede extender con admin_set_trial/admin_extend_trial.';


-- ────────────────────────────────────────────────────────────────────────────
-- 4. school_is_operational(school_id) — la única fuente del bloqueo
--
-- Devuelve false SOLO cuando la prueba venció, la cuenta es real y no está
-- exenta. Fail-closed a propósito en un punto: si NO hay fila de suscripción
-- la escuela no está operativa... salvo que su registro sea reciente, porque
-- hay 151 escuelas sin fila y cortarlas de golpe sería un apagón silencioso.
-- SECURITY DEFINER + STABLE: se usa desde policies y desde el BFF.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.school_is_operational(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE
        -- Cuentas nuestras: nunca se bloquean.
        WHEN s.account_type <> 'real' THEN true
        -- Exención comercial explícita (ej. Dynasty).
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
    'Nunca bloquea cuentas account_type<>real ni con blocking_exempt=true. '
    'Fuente única del bloqueo: la usan el middleware del BFF y las policies de RLS.';

GRANT EXECUTE ON FUNCTION public.school_is_operational(uuid) TO authenticated, anon, service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. La vista deja de mentir y expone lo que el aviso necesita
--
-- Se agregan account_type, blocking_exempt, trial_months, school_created_at y
-- is_operational. Los COALESCE inventados de plan/tier/status se mantienen por
-- compatibilidad con los lectores actuales, PERO se agrega has_subscription_row
-- para que el consumidor pueda distinguir "starter de verdad" de "no hay fila"
-- (era el fail-open de me.routes.ts:50).
--
-- ⚠ El ORDEN de las 23 columnas originales se respeta al pie de la letra y las
--   nuevas van TODAS al final: CREATE OR REPLACE VIEW no permite insertar
--   columnas en el medio ni renombrarlas (42P16 "cannot change name of view
--   column"). Cambiar la EXPRESIÓN de una columna existente sí está permitido,
--   y es lo que se hace con trial_ends_at y subscription_status.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_school_entitlements
WITH (security_invoker = true) AS
SELECT
    -- ── Columnas originales: mismo nombre, mismo orden, mismo tipo ──────────
    s.id                                                                AS school_id,
    s.school_type,
    COALESCE(sub.plan_code, 'starter')                                  AS plan_code,
    COALESCE(sub.tier, 'free')                                          AS tier,
    -- Antes el default inventado era 'active' (fail-open). Ahora 'trialing':
    -- sin fila, la escuela está en prueba desde su registro, no activa.
    COALESCE(sub.status, 'trialing')                                    AS subscription_status,
    -- Fallback para las 151 escuelas sin fila: registro + 1 mes.
    COALESCE(sub.trial_ends_at, s.created_at + interval '1 month')      AS trial_ends_at,
    sub.current_period_start,
    sub.current_period_end,
    sub.billing_cycle,
    (s.school_type IN ('academy','hybrid') OR s.school_type IS NULL)    AS has_academy,
    (s.school_type IN ('venue','hybrid'))                               AS has_reservations,
    (s.school_type IN ('venue','hybrid'))                               AS has_wallet,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'tournaments'    AND a.enabled) AS has_tournaments,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'access_control' AND a.enabled) AS has_access_control,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'biomech'        AND a.enabled) AS has_biomech,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'nutrition'      AND a.enabled) AS has_nutrition,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'whitelabel'     AND a.enabled) AS has_whitelabel,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'whatsapp'       AND a.enabled) AS has_whatsapp,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'wompi'          AND a.enabled) AS has_wompi,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'mp'             AND a.enabled) AS has_mp,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'store'          AND a.enabled) AS has_store,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'accounting'     AND a.enabled) AS has_accounting,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'invoicing'      AND a.enabled) AS has_invoicing,

    -- ── Columnas NUEVAS: siempre al final (ver nota de 42P16 arriba) ────────
    s.created_at                                                        AS school_created_at,
    s.account_type,
    (sub.school_id IS NOT NULL)                                         AS has_subscription_row,
    sub.trial_months,
    COALESCE(sub.blocking_exempt, false)                                AS blocking_exempt,
    sub.blocking_exempt_reason,
    public.school_is_operational(s.id)                                  AS is_operational
FROM public.schools s
LEFT JOIN public.school_subscriptions sub ON sub.school_id = s.id;

COMMENT ON VIEW public.v_school_entitlements IS
    'Entitlements por escuela. Agrega el estado del periodo de prueba: trial_ends_at '
    '(con fallback a registro + 1 mes), is_operational, blocking_exempt y account_type. '
    'has_subscription_row permite distinguir "starter real" de "sin fila" — sin eso el '
    'consumidor no puede decidir fail-closed.';


-- ────────────────────────────────────────────────────────────────────────────
-- 6. expire_trials() — el cron que marca el estado (no bloquea por sí solo)
--
-- Marca trial_expired lo que venció, solo en cuentas reales. Al expirar apaga
-- los addons concedidos por el trial (via='trial_grant'), no los comprados.
-- Devuelve jsonb para que la consola del super admin muestre el resultado.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_expiradas integer := 0;
    v_addons    integer := 0;
    v_ids       uuid[];
BEGIN
    WITH vencidas AS (
        UPDATE public.school_subscriptions ss
           SET status     = 'trial_expired',
               metadata   = ss.metadata || jsonb_build_object(
                                'expired_at',  to_jsonb(now()),
                                'expired_via', 'cron_expire_trials'),
               updated_at = now()
          FROM public.schools s
         WHERE ss.school_id      = s.id
           AND ss.status         = 'trialing'
           AND ss.trial_ends_at IS NOT NULL
           AND ss.trial_ends_at <= now()
           AND s.account_type    = 'real'
        RETURNING ss.school_id
    )
    SELECT array_agg(school_id), count(*) INTO v_ids, v_expiradas FROM vencidas;

    -- Apagar solo los addons que había regalado el trial.
    IF v_ids IS NOT NULL THEN
        WITH apagados AS (
            UPDATE public.school_addons a
               SET enabled     = false,
                   disabled_at = now(),
                   metadata    = a.metadata || jsonb_build_object('disabled_via', 'cron_expire_trials'),
                   updated_at  = now()
             WHERE a.school_id = ANY (v_ids)
               AND a.enabled   = true
               AND a.metadata->>'via' = 'trial_grant'
            RETURNING 1
        )
        SELECT count(*) INTO v_addons FROM apagados;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'ran_at', now(),
        'expiradas', v_expiradas,
        'addons_apagados', COALESCE(v_addons, 0),
        'school_ids', COALESCE(to_jsonb(v_ids), '[]'::jsonb)
    );
END;
$$;

COMMENT ON FUNCTION public.expire_trials() IS
    'Cron diario: marca status=trial_expired las pruebas vencidas de cuentas account_type=real. '
    'No evalúa blocking_exempt a propósito — el estado es la verdad y la exención decide la '
    'consecuencia en school_is_operational(). Apaga solo addons con metadata.via=trial_grant.';

REVOKE ALL ON FUNCTION public.expire_trials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_trials() TO service_role;

-- Cron diario 09:10 UTC (04:10 Bogotá) — mismo patrón idempotente que el resto
-- del repo, y escalonado después de late-fees (07:00) y glosas (08:00).
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
    PERFORM cron.unschedule('expire-trials-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
    'expire-trials-daily',
    '10 9 * * *',
    $cron$ SELECT public.expire_trials(); $cron$
);


-- ────────────────────────────────────────────────────────────────────────────
-- 7. RPCs de super admin — todo operable desde el panel, sin SQL a mano
-- ────────────────────────────────────────────────────────────────────────────

-- 7.1 Fijar el periodo de prueba: por meses desde el registro, o fecha exacta.
CREATE OR REPLACE FUNCTION public.admin_set_trial(
    p_school_id uuid,
    p_months    integer DEFAULT NULL,
    p_ends_at   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_actor    uuid := auth.uid();
    v_creada   timestamptz;
    v_ends     timestamptz;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede fijar el periodo de prueba' USING ERRCODE = '42501';
    END IF;
    IF p_months IS NULL AND p_ends_at IS NULL THEN
        RAISE EXCEPTION 'indica p_months o p_ends_at' USING ERRCODE = '22023';
    END IF;

    SELECT created_at INTO v_creada FROM public.schools WHERE id = p_school_id;
    IF v_creada IS NULL THEN
        RAISE EXCEPTION 'escuela % no existe', p_school_id USING ERRCODE = '23503';
    END IF;

    v_ends := COALESCE(p_ends_at, v_creada + (p_months || ' months')::interval);

    INSERT INTO public.school_subscriptions (
        school_id, plan_code, tier, status, billing_cycle,
        trial_ends_at, trial_months, metadata
    ) VALUES (
        p_school_id, 'starter', 'free',
        CASE WHEN v_ends > now() THEN 'trialing' ELSE 'trial_expired' END,
        'monthly', v_ends, p_months,
        jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_set_trial')
    )
    ON CONFLICT (school_id) DO UPDATE
    SET trial_ends_at = EXCLUDED.trial_ends_at,
        trial_months  = COALESCE(EXCLUDED.trial_months, public.school_subscriptions.trial_months),
        -- No se pisan estados comerciales ya cerrados (active/grandfathered/past_due).
        status = CASE
            WHEN public.school_subscriptions.status IN ('trialing','trial_expired')
                THEN (CASE WHEN EXCLUDED.trial_ends_at > now() THEN 'trialing' ELSE 'trial_expired' END)
            ELSE public.school_subscriptions.status
        END,
        metadata   = public.school_subscriptions.metadata
                     || jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_set_trial'),
        updated_at = now();

    RETURN (
        SELECT jsonb_build_object(
            'ok', true, 'school_id', p_school_id,
            'trial_ends_at', ss.trial_ends_at, 'trial_months', ss.trial_months,
            'status', ss.status,
            'dias_restantes', GREATEST(0, ceil(EXTRACT(epoch FROM (ss.trial_ends_at - now())) / 86400))::int,
            'is_operational', public.school_is_operational(p_school_id))
          FROM public.school_subscriptions ss WHERE ss.school_id = p_school_id
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_trial(uuid, integer, timestamptz) TO authenticated;

-- 7.2 Extender N meses desde donde iba (o desde hoy si ya venció).
CREATE OR REPLACE FUNCTION public.admin_extend_trial(p_school_id uuid, p_months integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_base timestamptz;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede extender la prueba' USING ERRCODE = '42501';
    END IF;

    SELECT GREATEST(COALESCE(ss.trial_ends_at, now()), now())
      INTO v_base
      FROM public.school_subscriptions ss WHERE ss.school_id = p_school_id;

    RETURN public.admin_set_trial(
        p_school_id, NULL,
        COALESCE(v_base, now()) + (p_months || ' months')::interval
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer) TO authenticated;

-- 7.3 Exentar del bloqueo (avisa pero no corta) — el caso Dynasty.
CREATE OR REPLACE FUNCTION public.admin_set_blocking_exempt(
    p_school_id uuid,
    p_exempt    boolean,
    p_reason    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede exentar del bloqueo' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.school_subscriptions (school_id, plan_code, tier, status, blocking_exempt, blocking_exempt_reason, metadata)
    VALUES (p_school_id, 'starter', 'free', 'trialing', p_exempt, p_reason,
            jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_set_blocking_exempt'))
    ON CONFLICT (school_id) DO UPDATE
    SET blocking_exempt        = EXCLUDED.blocking_exempt,
        blocking_exempt_reason = CASE WHEN EXCLUDED.blocking_exempt THEN EXCLUDED.blocking_exempt_reason ELSE NULL END,
        metadata   = public.school_subscriptions.metadata
                     || jsonb_build_object('set_by', v_actor::text, 'set_at', to_jsonb(now()), 'via', 'admin_set_blocking_exempt'),
        updated_at = now();

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'blocking_exempt', p_exempt,
                             'reason', p_reason, 'is_operational', public.school_is_operational(p_school_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_blocking_exempt(uuid, boolean, text) TO authenticated;

-- 7.4 Marcar cuenta real / test / demo (gate G-TEST).
CREATE OR REPLACE FUNCTION public.admin_set_account_type(p_school_id uuid, p_account_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede marcar el tipo de cuenta' USING ERRCODE = '42501';
    END IF;
    IF p_account_type NOT IN ('real','test','demo') THEN
        RAISE EXCEPTION 'account_type inválido: %', p_account_type USING ERRCODE = '23514';
    END IF;

    UPDATE public.schools SET account_type = p_account_type, updated_at = now() WHERE id = p_school_id;

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'account_type', p_account_type,
                             'is_operational', public.school_is_operational(p_school_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_account_type(uuid, text) TO authenticated;

-- 7.5 Expirar ya (para probar el bloqueo sin esperar al cron).
CREATE OR REPLACE FUNCTION public.admin_expire_trial_now(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede expirar la prueba' USING ERRCODE = '42501';
    END IF;
    RETURN public.admin_set_trial(p_school_id, NULL, now() - interval '1 second');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_expire_trial_now(uuid) TO authenticated;

-- 7.6 Reactivar: "hablaron con nosotros" → plan activo, exención limpia.
CREATE OR REPLACE FUNCTION public.admin_reactivate_school(
    p_school_id uuid,
    p_plan_code text DEFAULT 'crecimiento'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede reactivar' USING ERRCODE = '42501';
    END IF;

    PERFORM public.admin_set_school_plan(p_school_id, p_plan_code, 'active');

    UPDATE public.school_subscriptions
       SET blocking_exempt        = false,
           blocking_exempt_reason = NULL,
           current_period_start   = now(),
           current_period_end     = now() + interval '1 month',
           metadata               = metadata || jsonb_build_object(
                                        'reactivated_by', v_actor::text,
                                        'reactivated_at', to_jsonb(now()), 'via', 'admin_reactivate_school'),
           updated_at             = now()
     WHERE school_id = p_school_id;

    RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'plan_code', p_plan_code,
                             'status', 'active', 'is_operational', public.school_is_operational(p_school_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_school(uuid, text) TO authenticated;

-- 7.7 Listado para la consola: quién vence cuándo y qué pasaría.
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
-- Los nombres de salida (status, created_at, account_type, plan_code…) coinciden
-- con columnas reales. Sin esta directiva, cualquier referencia sin calificar
-- rompe con "column reference is ambiguous". Acá todo va calificado, pero la
-- directiva deja el siguiente cambio a prueba de ese error.
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
