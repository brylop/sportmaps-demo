-- ============================================================
-- SPORTMAPS — Fase A: plan_upgrade_requests
--
-- Captura cada intento de upgrade/activacion de addon desde
-- admin app o landing. El super_admin procesa manualmente:
--   1. Recibe notificacion (via notifications table existente)
--   2. Ve /admin/upgrade-requests con la lista
--   3. Contacta al cliente por WhatsApp / email
--   4. Cuando confirma pago (Wompi/MP/transferencia), marca
--      processed=true y la funcion actualiza
--      school_subscriptions / school_addons.
--
-- Decision firme: NO replicamos pasarela en landing aun.
-- El super_admin es el bottleneck manual hasta Fase 6 pagos.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Tabla plan_upgrade_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plan_upgrade_requests (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    requested_by            uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Que pidio el usuario
    request_type            text        NOT NULL
                                        CHECK (request_type IN ('plan_upgrade','plan_downgrade','addon_activate','addon_deactivate','payment_update','contact_sales')),
    requested_plan_code     text                  CHECK (requested_plan_code IS NULL OR requested_plan_code IN ('starter','crecimiento','profesional','elite','enterprise')),
    requested_addon_key     text                  CHECK (requested_addon_key IS NULL OR requested_addon_key IN ('tournaments','access_control','biomech','nutrition','whitelabel','whatsapp','wompi','mp')),
    requested_billing_cycle text                  CHECK (requested_billing_cycle IS NULL OR requested_billing_cycle IN ('monthly','annual')),

    -- Snapshot al momento del request
    current_plan_code       text,
    current_status          text,

    -- Estado del procesamiento
    status                  text        NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending','contacted','processed','rejected','cancelled')),
    contact_method          text                  CHECK (contact_method IS NULL OR contact_method IN ('whatsapp','email','call','in_person')),

    -- Procesamiento manual
    processed_by            uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,
    processed_at            timestamptz,
    processed_amount_cents  integer,
    processed_notes         text,

    -- Origen (admin app vs landing)
    source                  text        NOT NULL DEFAULT 'unknown'
                                        CHECK (source IN ('admin_app','landing','admin_panel','whatsapp','unknown')),
    source_url              text,
    user_agent              text,

    metadata                jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_upgrade_requests_school ON public.plan_upgrade_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_plan_upgrade_requests_pending ON public.plan_upgrade_requests(created_at DESC)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_plan_upgrade_requests_status ON public.plan_upgrade_requests(status, created_at DESC);

COMMENT ON TABLE public.plan_upgrade_requests IS
    'Cada intento de upgrade/activacion/pago iniciado por una escuela. '
    'Procesado manualmente por super_admin hasta Fase 6 (cobro automatico). '
    'Fuente principal de visibilidad sobre demanda de planes pagos.';

-- ============================================================
-- 2. Trigger updated_at (reusa set_updated_at existente)
-- ============================================================

DROP TRIGGER IF EXISTS plan_upgrade_requests_set_updated_at ON public.plan_upgrade_requests;
CREATE TRIGGER plan_upgrade_requests_set_updated_at
    BEFORE UPDATE ON public.plan_upgrade_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. RLS plan_upgrade_requests
--
-- Lectura:
--   - Admins de la escuela pueden ver SUS propios requests (historial)
--   - super_admin ve todos
-- Escritura:
--   - Admins de la escuela: solo INSERT (no UPDATE — solo el flow oficial los modifica)
--   - super_admin: ALL
-- ============================================================

ALTER TABLE public.plan_upgrade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_upgrade_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_upgrade_requests_select ON public.plan_upgrade_requests;
CREATE POLICY plan_upgrade_requests_select
    ON public.plan_upgrade_requests
    FOR SELECT
    TO authenticated
    USING (
        public.is_school_admin(school_id)
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS plan_upgrade_requests_insert ON public.plan_upgrade_requests;
CREATE POLICY plan_upgrade_requests_insert
    ON public.plan_upgrade_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_school_admin(school_id)
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS plan_upgrade_requests_super_admin_all ON public.plan_upgrade_requests;
CREATE POLICY plan_upgrade_requests_super_admin_all
    ON public.plan_upgrade_requests
    FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS plan_upgrade_requests_super_admin_delete ON public.plan_upgrade_requests;
CREATE POLICY plan_upgrade_requests_super_admin_delete
    ON public.plan_upgrade_requests
    FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- ============================================================
-- 4. Funcion para aprobar/procesar un request
--
-- SECURITY DEFINER + chequeo manual de is_super_admin para
-- que el procesamiento sea atomico: marca el request como
-- processed Y actualiza school_subscriptions / school_addons.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_process_upgrade_request(
    p_request_id    uuid,
    p_notes         text DEFAULT NULL,
    p_amount_cents  integer DEFAULT NULL,
    p_contact_method text DEFAULT 'whatsapp'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_req       public.plan_upgrade_requests%ROWTYPE;
    v_processor uuid := auth.uid();
    v_result    jsonb;
BEGIN
    -- Solo super_admin puede procesar
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede procesar upgrade requests'
            USING ERRCODE = '42501';
    END IF;

    -- Lock del request para evitar doble procesamiento
    SELECT * INTO v_req
    FROM public.plan_upgrade_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'upgrade request % no existe', p_request_id
            USING ERRCODE = '02000';
    END IF;

    IF v_req.status = 'processed' THEN
        RAISE EXCEPTION 'request % ya fue procesado', p_request_id
            USING ERRCODE = '23000';
    END IF;

    -- Aplica el cambio segun el tipo
    IF v_req.request_type = 'plan_upgrade' OR v_req.request_type = 'plan_downgrade' THEN
        UPDATE public.school_subscriptions
        SET plan_code = COALESCE(v_req.requested_plan_code, plan_code),
            tier = CASE
                WHEN v_req.requested_plan_code = 'starter'      THEN 'free'
                WHEN v_req.requested_plan_code = 'enterprise'   THEN 'enterprise'
                WHEN v_req.requested_plan_code IS NOT NULL      THEN 'pro'
                ELSE tier
            END,
            status = 'active',
            billing_cycle = COALESCE(v_req.requested_billing_cycle, billing_cycle),
            metadata = metadata || jsonb_build_object(
                'last_upgrade_request_id', p_request_id::text,
                'last_processed_by',       v_processor::text,
                'last_processed_at',       to_jsonb(now())
            )
        WHERE school_id = v_req.school_id;
    ELSIF v_req.request_type = 'addon_activate' AND v_req.requested_addon_key IS NOT NULL THEN
        INSERT INTO public.school_addons (school_id, addon_key, enabled, monthly_price_cents, metadata)
        VALUES (
            v_req.school_id,
            v_req.requested_addon_key,
            true,
            COALESCE(p_amount_cents, 0),
            jsonb_build_object('activated_via_request', p_request_id::text)
        )
        ON CONFLICT (school_id, addon_key) DO UPDATE
        SET enabled = true,
            enabled_at = now(),
            disabled_at = NULL,
            monthly_price_cents = COALESCE(p_amount_cents, public.school_addons.monthly_price_cents);
    ELSIF v_req.request_type = 'addon_deactivate' AND v_req.requested_addon_key IS NOT NULL THEN
        UPDATE public.school_addons
        SET enabled = false,
            disabled_at = now()
        WHERE school_id = v_req.school_id
          AND addon_key = v_req.requested_addon_key;
    END IF;

    -- Marca el request como procesado
    UPDATE public.plan_upgrade_requests
    SET status           = 'processed',
        processed_by     = v_processor,
        processed_at     = now(),
        processed_notes  = p_notes,
        processed_amount_cents = p_amount_cents,
        contact_method   = p_contact_method
    WHERE id = p_request_id;

    v_result := jsonb_build_object(
        'request_id', p_request_id,
        'status', 'processed',
        'school_id', v_req.school_id,
        'request_type', v_req.request_type,
        'processed_at', now()
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.rpc_process_upgrade_request(uuid, text, integer, text) IS
    'Aplica el upgrade/activacion del request al school. Solo super_admin. '
    'Actualiza school_subscriptions o school_addons segun el tipo. '
    'Atomico: marca request=processed + cambia la suscripcion en una sola transaccion.';

GRANT EXECUTE ON FUNCTION public.rpc_process_upgrade_request(uuid, text, integer, text) TO authenticated;

-- ============================================================
-- 5. Notificar al super_admin al insertar un nuevo request
--
-- Usa la tabla notifications existente. Inserta una notificacion
-- por cada super_admin activo. El frontend de super_admin
-- escucha realtime y muestra un badge en /admin/upgrade-requests.
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_notify_super_admin_on_upgrade_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_name text;
    v_requester_email text;
    v_addon_name text;
    v_title text;
    v_body  text;
BEGIN
    -- Lookup nombre escuela
    SELECT name INTO v_school_name FROM public.schools WHERE id = NEW.school_id;

    -- Lookup email del que hizo el request
    SELECT email INTO v_requester_email FROM auth.users WHERE id = NEW.requested_by;

    -- Construye titulo y cuerpo segun el tipo
    v_title := CASE NEW.request_type
        WHEN 'plan_upgrade'      THEN 'Solicitud de upgrade de plan'
        WHEN 'plan_downgrade'    THEN 'Solicitud de cambio de plan'
        WHEN 'addon_activate'    THEN 'Solicitud de activacion de addon'
        WHEN 'addon_deactivate'  THEN 'Solicitud de baja de addon'
        WHEN 'payment_update'    THEN 'Solicitud de actualizacion de pago'
        WHEN 'contact_sales'     THEN 'Lead de ventas'
        ELSE 'Solicitud de plan'
    END;

    v_body := COALESCE(v_school_name, 'Escuela') || ' (' || COALESCE(v_requester_email, 'sin email') || ') pidio: '
            || COALESCE(NEW.requested_plan_code, NEW.requested_addon_key, NEW.request_type);

    -- Inserta una notificacion por cada super_admin (role='admin' en profiles)
    -- Nota: la tabla notifications no tiene columna metadata — usamos link
    -- que apunta a /admin/upgrade-requests/{id} con el request_id embebido.
    INSERT INTO public.notifications (user_id, school_id, type, title, message, link)
    SELECT
        p.id,
        NEW.school_id,
        'upgrade_request',
        v_title,
        v_body,
        '/admin/upgrade-requests/' || NEW.id::text
    FROM public.profiles p
    WHERE p.role = 'admin';

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- No fallar el INSERT del request si la notificacion falla
    RAISE WARNING 'No se pudo notificar super_admin para request %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_upgrade_requests_notify_super_admin ON public.plan_upgrade_requests;
CREATE TRIGGER plan_upgrade_requests_notify_super_admin
    AFTER INSERT ON public.plan_upgrade_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_notify_super_admin_on_upgrade_request();

-- ============================================================
-- 6. Refresh PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload config';

COMMIT;
