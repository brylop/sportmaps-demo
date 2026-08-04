-- ============================================================
-- SPORTMAPS — Tabla user_devices (Fase 6.1)
--
-- Registro de dispositivos por usuario (mobile + web PWA + futuras
-- plataformas). Habilita push notifications, login biometrico,
-- analytics de adopcion mobile y rate-limit por dispositivo.
--
-- Llenada por:
--   - Web/PWA: hook useDeviceContext en cada login (auto-registro)
--   - Mobile (Capacitor): en N1, hook detecta nativo y registra con
--     APNS/FCM token
--
-- Politica de la casa: search_path en TODA funcion, RLS estricta.
-- ============================================================

BEGIN;


-- ============================================================
-- 1. user_devices
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_devices (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Identificador estable del dispositivo (Capacitor.Device.getId() o uuid persistido en localStorage para web)
    device_id       text NOT NULL,

    platform        text NOT NULL CHECK (platform IN ('web','ios','android')),
    -- Capacitor expone tambien 'electron' a futuro
    push_token      text,  -- APNS (ios) o FCM (android). NULL para web.
    push_provider   text   CHECK (push_provider IS NULL OR push_provider IN ('apns','fcm','web_push')),

    -- Metadata (todos opcionales, util para analytics + UX)
    app_version     text,
    os_version      text,
    device_model    text,
    locale          text,
    timezone        text,
    user_agent      text,

    -- Lifecycle
    first_seen_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz,  -- soft delete (logout explicito o token expirado)
    revoked_reason  text,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    -- Un dispositivo registrado por usuario es UPSERT (replace push_token / app_version)
    CONSTRAINT uq_user_devices_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user
    ON public.user_devices(user_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_devices_push_token
    ON public.user_devices(push_token) WHERE push_token IS NOT NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen
    ON public.user_devices(last_seen_at DESC) WHERE revoked_at IS NULL;

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- SELECT: solo el owner ve sus propios devices
DROP POLICY IF EXISTS "user_devices_owner_select" ON public.user_devices;
CREATE POLICY "user_devices_owner_select" ON public.user_devices
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- INSERT / UPDATE / DELETE solo via RPC (SECURITY DEFINER) o service_role.
-- El frontend NO toca esta tabla directamente.
DROP POLICY IF EXISTS "user_devices_no_direct_write" ON public.user_devices;
CREATE POLICY "user_devices_no_direct_write" ON public.user_devices
    FOR INSERT TO authenticated WITH CHECK (false);

COMMENT ON TABLE public.user_devices IS
    'Dispositivos registrados por usuario. Habilita push notifications, '
    'analytics mobile y revocacion fina. Insert/update solo via RPC.';


-- ============================================================
-- 2. RPC register_user_device — UPSERT del device del caller
-- ============================================================
--
-- Llamado en cada arranque de la app por el hook useDeviceContext.
-- Idempotente: si el mismo device_id ya existe para este user, actualiza
-- push_token, app_version, last_seen_at, etc. Si no, lo crea.
--
-- NO rate limit estricto — pero el endpoint del BFF puede limitar a
-- ~5 calls/min/user para protegerse de loops.

CREATE OR REPLACE FUNCTION public.register_user_device(
    p_device_id     text,
    p_platform      text,
    p_push_token    text DEFAULT NULL,
    p_push_provider text DEFAULT NULL,
    p_app_version   text DEFAULT NULL,
    p_os_version    text DEFAULT NULL,
    p_device_model  text DEFAULT NULL,
    p_locale        text DEFAULT NULL,
    p_timezone      text DEFAULT NULL,
    p_user_agent    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_id      uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    IF p_device_id IS NULL OR p_device_id = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'device_id_required');
    END IF;
    IF p_platform NOT IN ('web','ios','android') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_platform');
    END IF;

    INSERT INTO public.user_devices (
        user_id, device_id, platform, push_token, push_provider,
        app_version, os_version, device_model, locale, timezone, user_agent,
        first_seen_at, last_seen_at
    ) VALUES (
        v_user_id, p_device_id, p_platform, p_push_token, p_push_provider,
        p_app_version, p_os_version, p_device_model, p_locale, p_timezone, p_user_agent,
        now(), now()
    )
    ON CONFLICT (user_id, device_id) DO UPDATE SET
        platform       = EXCLUDED.platform,
        push_token     = COALESCE(EXCLUDED.push_token, public.user_devices.push_token),
        push_provider  = COALESCE(EXCLUDED.push_provider, public.user_devices.push_provider),
        app_version    = COALESCE(EXCLUDED.app_version, public.user_devices.app_version),
        os_version     = COALESCE(EXCLUDED.os_version, public.user_devices.os_version),
        device_model   = COALESCE(EXCLUDED.device_model, public.user_devices.device_model),
        locale         = COALESCE(EXCLUDED.locale, public.user_devices.locale),
        timezone       = COALESCE(EXCLUDED.timezone, public.user_devices.timezone),
        user_agent     = COALESCE(EXCLUDED.user_agent, public.user_devices.user_agent),
        last_seen_at   = now(),
        revoked_at     = NULL,        -- re-activar si se habia revocado
        revoked_reason = NULL,
        updated_at     = now()
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.register_user_device(text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_user_device(text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;


-- ============================================================
-- 3. RPC revoke_user_device — logout / pierdo el device
-- ============================================================

CREATE OR REPLACE FUNCTION public.revoke_user_device(
    p_device_id text,
    p_reason    text DEFAULT 'user_logout'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    UPDATE public.user_devices
       SET revoked_at     = now(),
           revoked_reason = p_reason,
           push_token     = NULL,    -- limpiar para no recibir push despues
           updated_at     = now()
     WHERE user_id = v_user_id
       AND device_id = p_device_id
       AND revoked_at IS NULL;

    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_user_device(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_user_device(text, text) TO authenticated, service_role;


COMMIT;
