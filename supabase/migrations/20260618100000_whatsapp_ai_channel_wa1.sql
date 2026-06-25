-- ============================================================
-- SPORTMAPS — WhatsApp AI Channel (Bloque 6) — WA1: fundación
--
-- Canal WhatsApp oficial vía Meta Cloud API, modelo Tech Provider
-- multi-tenant: UN webhook recibe los mensajes de TODAS las escuelas;
-- el routing se hace por phone_number_id -> school_id.
--
-- Esta migración crea SOLO la base necesaria para WA1/WA2 core:
--   1. school_whatsapp_integrations  (routing + credenciales cifradas)
--   2. whatsapp_settings             (config del bot por integración)
--   3. whatsapp_conversations        (hilo por contacto)
--   4. whatsapp_messages             (mensajes in/out, idempotente)
--   5. whatsapp_identifications      (OTP por email — decisión #4)
--   6. whatsapp_blocked_numbers      (kill por número — riesgo R14)
--
-- Decisiones de arquitectura honradas:
--   - Multi-tenant routing por phone_number_id (UNIQUE)
--   - Modo asistido por defecto el primer mes (whatsapp_settings.mode)
--   - OTP obligatorio antes de datos sensibles (whatsapp_identifications)
--   - RLS por parent_id verificado (nunca por phone solo) — riesgo R17
--   - Token Meta cifrado en reposo (columna *_encrypted; AES-256-GCM en BFF
--     con clave en env WHATSAPP_TOKEN_ENC_KEY + rotación — decisión #9)
--
-- Política de la casa: search_path en TODA función, RLS estricta,
-- escritura solo vía service_role/RPC, SELECT acotado al dueño de la escuela.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. school_whatsapp_integrations — routing + credenciales
-- ============================================================
CREATE TABLE IF NOT EXISTS public.school_whatsapp_integrations (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id            uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,

    -- Identificadores Meta (el phone_number_id es la LLAVE de routing multi-tenant)
    phone_number_id      text NOT NULL,
    waba_id              text,                -- WhatsApp Business Account ID
    business_id          text,               -- Meta Business (portfolio) ID
    display_phone_number text,               -- +57 300 ... (humano, para UI)

    -- Credenciales cifradas en reposo. NUNCA en texto plano.
    -- El BFF cifra con AES-256-GCM (clave en env) antes de insertar.
    access_token_encrypted text,             -- token de sistema / long-lived cifrado
    -- Verify token del webhook (se compara contra el query param de Meta en GET).
    -- No es secreto de alto valor pero se guarda para validar el challenge por tenant.
    verify_token         text,

    status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','active','suspended','disconnected')),
    suspended_reason     text,
    suspended_at         timestamptz,

    connected_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    connected_at         timestamptz,
    token_rotated_at     timestamptz,        -- soporte rotación cada 60d (decisión #9)

    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    -- Una integración por phone_number_id en todo el sistema (routing determinista)
    CONSTRAINT uq_wa_integration_phone_number_id UNIQUE (phone_number_id)
);

-- Una escuela puede tener varios números (multi-sede), pero el routing es por phone_number_id.
CREATE INDEX IF NOT EXISTS idx_wa_integration_school
    ON public.school_whatsapp_integrations(school_id);
CREATE INDEX IF NOT EXISTS idx_wa_integration_status
    ON public.school_whatsapp_integrations(status) WHERE status = 'active';

ALTER TABLE public.school_whatsapp_integrations ENABLE ROW LEVEL SECURITY;

-- SELECT: dueño de la escuela. El token cifrado igual no es legible sin la clave del BFF.
DROP POLICY IF EXISTS "wa_integration_owner_select" ON public.school_whatsapp_integrations;
CREATE POLICY "wa_integration_owner_select" ON public.school_whatsapp_integrations
    FOR SELECT TO authenticated
    USING (school_id IN (SELECT id FROM public.schools WHERE owner_id = auth.uid()));

-- Escritura solo service_role / RPC (el frontend nunca toca credenciales).
DROP POLICY IF EXISTS "wa_integration_no_direct_write" ON public.school_whatsapp_integrations;
CREATE POLICY "wa_integration_no_direct_write" ON public.school_whatsapp_integrations
    FOR INSERT TO authenticated WITH CHECK (false);

COMMENT ON TABLE public.school_whatsapp_integrations IS
    'Routing multi-tenant WhatsApp: phone_number_id -> school_id. Credenciales Meta cifradas en reposo.';


-- ============================================================
-- 2. whatsapp_settings — config del bot por integración
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id    uuid NOT NULL REFERENCES public.school_whatsapp_integrations(id) ON DELETE CASCADE,

    -- Modo asistido por defecto el primer mes (decisión #3). Auto requiere
    -- confirmación explícita del admin + flag VITE_FLAG_WHATSAPP_AUTO_MODE.
    mode              text NOT NULL DEFAULT 'assisted'
                      CHECK (mode IN ('assisted','auto')),
    -- Hasta cuándo se fuerza asistido (default: 30 días desde alta). El BFF
    -- ignora 'auto' si now() < assisted_until.
    assisted_until    timestamptz,

    ai_enabled        boolean NOT NULL DEFAULT true,
    welcome_message   text,
    -- Horario de atención (para respuestas fuera de horario). jsonb libre.
    business_hours    jsonb,
    -- Idioma por defecto del bot.
    default_locale    text NOT NULL DEFAULT 'es',

    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_wa_settings_integration UNIQUE (integration_id)
);

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_settings_owner_select" ON public.whatsapp_settings;
CREATE POLICY "wa_settings_owner_select" ON public.whatsapp_settings
    FOR SELECT TO authenticated
    USING (integration_id IN (
        SELECT i.id FROM public.school_whatsapp_integrations i
        JOIN public.schools s ON s.id = i.school_id
        WHERE s.owner_id = auth.uid()
    ));

DROP POLICY IF EXISTS "wa_settings_no_direct_write" ON public.whatsapp_settings;
CREATE POLICY "wa_settings_no_direct_write" ON public.whatsapp_settings
    FOR INSERT TO authenticated WITH CHECK (false);


-- ============================================================
-- 3. whatsapp_conversations — hilo por contacto
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id    uuid NOT NULL REFERENCES public.school_whatsapp_integrations(id) ON DELETE CASCADE,
    school_id         uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,

    -- Número del contacto en formato WhatsApp (E.164 sin '+', tal cual lo manda Meta).
    contact_wa_id     text NOT NULL,
    contact_name      text,                  -- profile name que envía Meta (no confiable para identidad)

    -- Identidad verificada. parent_id SOLO se setea tras OTP exitoso (riesgo R17).
    parent_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    identified        boolean NOT NULL DEFAULT false,

    status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','snoozed','closed')),
    assigned_to       uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    last_message_at   timestamptz,
    last_inbound_at   timestamptz,
    unread_count      integer NOT NULL DEFAULT 0,

    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    -- Un hilo por (integración, contacto)
    CONSTRAINT uq_wa_conversation UNIQUE (integration_id, contact_wa_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_school        ON public.whatsapp_conversations(school_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_integration   ON public.whatsapp_conversations(integration_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_last_msg      ON public.whatsapp_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_parent        ON public.whatsapp_conversations(parent_id) WHERE parent_id IS NOT NULL;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_conv_owner_select" ON public.whatsapp_conversations;
CREATE POLICY "wa_conv_owner_select" ON public.whatsapp_conversations
    FOR SELECT TO authenticated
    USING (school_id IN (SELECT id FROM public.schools WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "wa_conv_no_direct_write" ON public.whatsapp_conversations;
CREATE POLICY "wa_conv_no_direct_write" ON public.whatsapp_conversations
    FOR INSERT TO authenticated WITH CHECK (false);


-- ============================================================
-- 4. whatsapp_messages — mensajes (idempotente por wa_message_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    integration_id   uuid NOT NULL REFERENCES public.school_whatsapp_integrations(id) ON DELETE CASCADE,

    -- ID de mensaje de Meta (wamid.*). UNIQUE -> idempotencia natural del webhook.
    wa_message_id    text,
    direction        text NOT NULL CHECK (direction IN ('inbound','outbound')),

    from_wa_id       text,
    to_wa_id         text,
    type             text NOT NULL DEFAULT 'text'
                     CHECK (type IN ('text','image','audio','video','document','sticker','location','interactive','button','template','system','unsupported')),
    text_body        text,
    payload          jsonb,                  -- mensaje crudo de Meta (para tipos ricos)

    status           text NOT NULL DEFAULT 'received'
                     CHECK (status IN ('received','queued','sent','delivered','read','failed')),
    ai_generated     boolean NOT NULL DEFAULT false,
    error_detail     text,

    -- timestamp de Meta (epoch -> timestamptz). created_at = cuando lo guardamos.
    wa_timestamp     timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_wa_message_wamid UNIQUE (wa_message_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_conversation ON public.whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_integration  ON public.whatsapp_messages(integration_id);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_msg_owner_select" ON public.whatsapp_messages;
CREATE POLICY "wa_msg_owner_select" ON public.whatsapp_messages
    FOR SELECT TO authenticated
    USING (conversation_id IN (
        SELECT c.id FROM public.whatsapp_conversations c
        JOIN public.schools s ON s.id = c.school_id
        WHERE s.owner_id = auth.uid()
    ));

DROP POLICY IF EXISTS "wa_msg_no_direct_write" ON public.whatsapp_messages;
CREATE POLICY "wa_msg_no_direct_write" ON public.whatsapp_messages
    FOR INSERT TO authenticated WITH CHECK (false);


-- ============================================================
-- 5. whatsapp_identifications — OTP por email (decisión #4 / riesgo R17)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_identifications (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id   uuid NOT NULL REFERENCES public.school_whatsapp_integrations(id) ON DELETE CASCADE,
    contact_wa_id    text NOT NULL,

    -- Candidato a vincular: se confirma al verificar OTP.
    parent_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    email            text,                   -- email contra el que se envió el OTP

    -- Nunca guardamos el OTP en claro: solo su hash (sha256).
    otp_hash         text,
    otp_expires_at   timestamptz,
    attempts         integer NOT NULL DEFAULT 0,
    verified_at      timestamptz,

    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_wa_ident UNIQUE (integration_id, contact_wa_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_ident_contact ON public.whatsapp_identifications(integration_id, contact_wa_id);

ALTER TABLE public.whatsapp_identifications ENABLE ROW LEVEL SECURITY;
-- Sin policies para authenticated: tabla sensible, SOLO service_role/RPC.
DROP POLICY IF EXISTS "wa_ident_no_access" ON public.whatsapp_identifications;
CREATE POLICY "wa_ident_no_access" ON public.whatsapp_identifications
    FOR SELECT TO authenticated USING (false);

COMMENT ON TABLE public.whatsapp_identifications IS
    'OTP por email para verificar identidad del contacto WhatsApp antes de exponer datos sensibles. Solo service_role.';


-- ============================================================
-- 6. whatsapp_blocked_numbers — kill por número (riesgo R14)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_blocked_numbers (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- integration_id NULL = bloqueo GLOBAL (super admin) para todas las escuelas.
    integration_id   uuid REFERENCES public.school_whatsapp_integrations(id) ON DELETE CASCADE,
    contact_wa_id    text NOT NULL,
    reason           text,
    blocked_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_blocked_scope
    ON public.whatsapp_blocked_numbers(COALESCE(integration_id, '00000000-0000-0000-0000-000000000000'::uuid), contact_wa_id);

ALTER TABLE public.whatsapp_blocked_numbers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wa_blocked_no_access" ON public.whatsapp_blocked_numbers;
CREATE POLICY "wa_blocked_no_access" ON public.whatsapp_blocked_numbers
    FOR SELECT TO authenticated USING (false);


-- ============================================================
-- 7. RPC wa_ingest_inbound_message — ingesta idempotente del webhook
--
-- Llamada por el BFF (service_role) al recibir un mensaje entrante ya
-- validado por HMAC. Hace en UNA transacción:
--   - upsert de la conversación (por integración + contacto)
--   - insert idempotente del mensaje (UNIQUE wa_message_id)
--   - actualiza contadores del hilo
-- Devuelve { ok, conversation_id, message_id, duplicate }.
-- ============================================================
CREATE OR REPLACE FUNCTION public.wa_ingest_inbound_message(
    p_integration_id  uuid,
    p_school_id       uuid,
    p_contact_wa_id   text,
    p_contact_name    text,
    p_wa_message_id   text,
    p_type            text,
    p_text_body       text,
    p_payload         jsonb,
    p_wa_timestamp    timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_conv_id uuid;
    v_msg_id  uuid;
BEGIN
    -- 1. Upsert conversación
    INSERT INTO public.whatsapp_conversations (
        integration_id, school_id, contact_wa_id, contact_name,
        status, last_message_at, last_inbound_at, unread_count
    ) VALUES (
        p_integration_id, p_school_id, p_contact_wa_id, p_contact_name,
        'open', p_wa_timestamp, p_wa_timestamp, 1
    )
    ON CONFLICT (integration_id, contact_wa_id) DO UPDATE SET
        contact_name    = COALESCE(EXCLUDED.contact_name, public.whatsapp_conversations.contact_name),
        status          = CASE WHEN public.whatsapp_conversations.status = 'closed'
                               THEN 'open' ELSE public.whatsapp_conversations.status END,
        last_message_at = GREATEST(public.whatsapp_conversations.last_message_at, EXCLUDED.last_message_at),
        last_inbound_at = GREATEST(public.whatsapp_conversations.last_inbound_at, EXCLUDED.last_inbound_at),
        unread_count    = public.whatsapp_conversations.unread_count + 1,
        updated_at      = now()
    RETURNING id INTO v_conv_id;

    -- 2. Insert idempotente del mensaje
    INSERT INTO public.whatsapp_messages (
        conversation_id, integration_id, wa_message_id, direction,
        from_wa_id, type, text_body, payload, status, wa_timestamp
    ) VALUES (
        v_conv_id, p_integration_id, p_wa_message_id, 'inbound',
        p_contact_wa_id, COALESCE(p_type, 'text'), p_text_body, p_payload, 'received', p_wa_timestamp
    )
    ON CONFLICT (wa_message_id) DO NOTHING
    RETURNING id INTO v_msg_id;

    IF v_msg_id IS NULL THEN
        -- Mensaje ya procesado (reintento de Meta). Revertir el +1 de unread.
        UPDATE public.whatsapp_conversations
           SET unread_count = GREATEST(0, unread_count - 1)
         WHERE id = v_conv_id;
        RETURN jsonb_build_object('ok', true, 'duplicate', true, 'conversation_id', v_conv_id);
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'duplicate', false,
        'conversation_id', v_conv_id, 'message_id', v_msg_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.wa_ingest_inbound_message(uuid, uuid, text, text, text, text, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_ingest_inbound_message(uuid, uuid, text, text, text, text, text, jsonb, timestamptz) TO service_role;


-- ============================================================
-- 8. RPC wa_record_outbound_message — registrar mensaje saliente
-- ============================================================
CREATE OR REPLACE FUNCTION public.wa_record_outbound_message(
    p_conversation_id uuid,
    p_integration_id  uuid,
    p_wa_message_id   text,
    p_type            text,
    p_text_body       text,
    p_payload         jsonb,
    p_ai_generated    boolean,
    p_to_wa_id        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_msg_id uuid;
BEGIN
    INSERT INTO public.whatsapp_messages (
        conversation_id, integration_id, wa_message_id, direction,
        to_wa_id, type, text_body, payload, status, ai_generated, wa_timestamp
    ) VALUES (
        p_conversation_id, p_integration_id, p_wa_message_id, 'outbound',
        p_to_wa_id, COALESCE(p_type, 'text'), p_text_body, p_payload, 'sent',
        COALESCE(p_ai_generated, false), now()
    )
    ON CONFLICT (wa_message_id) DO NOTHING
    RETURNING id INTO v_msg_id;

    UPDATE public.whatsapp_conversations
       SET last_message_at = now(), unread_count = 0, updated_at = now()
     WHERE id = p_conversation_id;

    RETURN jsonb_build_object('ok', true, 'message_id', v_msg_id);
END;
$$;

REVOKE ALL ON FUNCTION public.wa_record_outbound_message(uuid, uuid, text, text, text, jsonb, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_record_outbound_message(uuid, uuid, text, text, text, jsonb, boolean, text) TO service_role;


-- ============================================================
-- 9. RPC wa_is_blocked — chequeo de bloqueo (global o por integración)
-- ============================================================
CREATE OR REPLACE FUNCTION public.wa_is_blocked(
    p_integration_id uuid,
    p_contact_wa_id  text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.whatsapp_blocked_numbers b
        WHERE b.contact_wa_id = p_contact_wa_id
          AND (b.integration_id IS NULL OR b.integration_id = p_integration_id)
    );
$$;

REVOKE ALL ON FUNCTION public.wa_is_blocked(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_is_blocked(uuid, text) TO service_role;


COMMIT;
