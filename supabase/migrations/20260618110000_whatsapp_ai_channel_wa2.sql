-- ============================================================
-- SPORTMAPS — WhatsApp AI Channel (Bloque 6) — WA2: bot + OTP
--
-- Sobre la fundación WA1, agrega:
--   1. whatsapp_message_drafts  (modo asistido: el bot propone, el admin aprueba)
--   2. RPC wa_start_identification  (arranca OTP: busca padre por email + guarda hash)
--   3. RPC wa_verify_otp            (verifica código → vincula parent_id + identified)
--   4. RPC wa_get_payment_status    (tool del intent: pagos del padre en ESTA escuela)
--
-- Decisiones honradas:
--   - OTP obligatorio antes de datos sensibles (decisión #4, riesgo R17):
--     el parent_id SOLO se setea tras verificar el código enviado al email.
--   - Aislamiento por tenant: los pagos se filtran por parent_id AND school_id
--     de la integración (un padre nunca ve datos de otra escuela por este número).
--   - OTP nunca en claro: se guarda solo el hash sha256 (el BFF genera y hashea).
--   - Modo asistido por defecto: el bot escribe drafts, no envía (decisión #3).
--
-- Política de la casa: search_path en TODA función, RLS estricta,
-- escritura solo service_role/RPC, SELECT acotado al dueño de la escuela.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. whatsapp_message_drafts — cola de aprobación (modo asistido)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_message_drafts (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    integration_id   uuid NOT NULL REFERENCES public.school_whatsapp_integrations(id) ON DELETE CASCADE,

    -- Texto que el bot propone enviar. El admin lo aprueba (o edita en UI).
    proposed_text    text NOT NULL,
    -- Contexto de cómo se generó (intent detectado, tool usada, resultado).
    tool_context     jsonb,
    -- Qué proveedor LLM lo generó (auditoría + comparar calidad).
    llm_provider     text,

    status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','sent','expired')),
    approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at      timestamptz,
    sent_at          timestamptz,
    -- Si el admin editó el texto antes de enviar, se guarda aquí.
    edited_text      text,

    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_drafts_conversation ON public.whatsapp_message_drafts(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_drafts_pending ON public.whatsapp_message_drafts(integration_id) WHERE status = 'pending';

ALTER TABLE public.whatsapp_message_drafts ENABLE ROW LEVEL SECURITY;

-- SELECT: dueño de la escuela (para el inbox de aprobación).
DROP POLICY IF EXISTS "wa_drafts_owner_select" ON public.whatsapp_message_drafts;
CREATE POLICY "wa_drafts_owner_select" ON public.whatsapp_message_drafts
    FOR SELECT TO authenticated
    USING (conversation_id IN (
        SELECT c.id FROM public.whatsapp_conversations c
        JOIN public.schools s ON s.id = c.school_id
        WHERE s.owner_id = auth.uid()
    ));

DROP POLICY IF EXISTS "wa_drafts_no_direct_write" ON public.whatsapp_message_drafts;
CREATE POLICY "wa_drafts_no_direct_write" ON public.whatsapp_message_drafts
    FOR INSERT TO authenticated WITH CHECK (false);

COMMENT ON TABLE public.whatsapp_message_drafts IS
    'Modo asistido: respuestas propuestas por el bot que el admin aprueba antes de enviar.';


-- ============================================================
-- 2. RPC wa_start_identification — arranca OTP
--
-- El BFF: (a) genera un código de 6 dígitos, (b) lo hashea (sha256),
-- (c) llama a esta RPC con el email que dio el contacto. La RPC busca un
-- profile con ese email; si existe, guarda el candidato parent_id + hash +
-- expiración en whatsapp_identifications (upsert por integración+contacto).
--
-- Devuelve { ok, email_matches_parent, masked_email }. El BFF solo envía el
-- correo si email_matches_parent = true (no filtra si el email existe o no
-- mediante el texto del bot — responde igual para no permitir enumeración).
-- ============================================================
CREATE OR REPLACE FUNCTION public.wa_start_identification(
    p_integration_id  uuid,
    p_contact_wa_id   text,
    p_email           text,
    p_otp_hash        text,
    p_expires_at      timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_parent_id uuid;
    v_email     text := lower(trim(p_email));
BEGIN
    -- Buscar un profile con ese email. (No distinguimos rol aquí: la
    -- autorización real la da tener pagos/hijos en ESTA escuela, que se
    -- valida al leer datos.)
    SELECT id INTO v_parent_id
    FROM public.profiles
    WHERE lower(email) = v_email
    LIMIT 1;

    INSERT INTO public.whatsapp_identifications (
        integration_id, contact_wa_id, parent_id, email,
        otp_hash, otp_expires_at, attempts, verified_at, updated_at
    ) VALUES (
        p_integration_id, p_contact_wa_id, v_parent_id, v_email,
        p_otp_hash, p_expires_at, 0, NULL, now()
    )
    ON CONFLICT (integration_id, contact_wa_id) DO UPDATE SET
        parent_id      = EXCLUDED.parent_id,
        email          = EXCLUDED.email,
        otp_hash       = EXCLUDED.otp_hash,
        otp_expires_at = EXCLUDED.otp_expires_at,
        attempts       = 0,
        verified_at    = NULL,
        updated_at     = now();

    RETURN jsonb_build_object(
        'ok', true,
        'email_matches_parent', v_parent_id IS NOT NULL
    );
END;
$$;

REVOKE ALL ON FUNCTION public.wa_start_identification(uuid, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_start_identification(uuid, text, text, text, timestamptz) TO service_role;


-- ============================================================
-- 3. RPC wa_verify_otp — verifica el código y vincula identidad
--
-- Compara el hash recibido contra el guardado, valida expiración y límite de
-- intentos (5). En éxito: marca verified_at, y setea parent_id + identified
-- en la conversación (aquí es donde la conversación queda "confiable").
-- ============================================================
CREATE OR REPLACE FUNCTION public.wa_verify_otp(
    p_integration_id  uuid,
    p_contact_wa_id   text,
    p_otp_hash        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_ident   public.whatsapp_identifications%ROWTYPE;
BEGIN
    SELECT * INTO v_ident
    FROM public.whatsapp_identifications
    WHERE integration_id = p_integration_id
      AND contact_wa_id = p_contact_wa_id;

    IF NOT FOUND OR v_ident.otp_hash IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'no_pending_otp');
    END IF;

    IF v_ident.verified_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'already_verified', true, 'parent_id', v_ident.parent_id);
    END IF;

    IF v_ident.attempts >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
    END IF;

    IF v_ident.otp_expires_at < now() THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'expired');
    END IF;

    IF v_ident.otp_hash <> p_otp_hash THEN
        UPDATE public.whatsapp_identifications
           SET attempts = attempts + 1, updated_at = now()
         WHERE id = v_ident.id;
        RETURN jsonb_build_object('ok', false, 'reason', 'wrong_code',
                                  'attempts_left', 5 - (v_ident.attempts + 1));
    END IF;

    -- Éxito: marcar verificado y consumir el hash.
    UPDATE public.whatsapp_identifications
       SET verified_at = now(), otp_hash = NULL, updated_at = now()
     WHERE id = v_ident.id;

    -- Vincular la conversación (aquí queda "identificada").
    UPDATE public.whatsapp_conversations
       SET parent_id = v_ident.parent_id, identified = true, updated_at = now()
     WHERE integration_id = p_integration_id
       AND contact_wa_id = p_contact_wa_id;

    RETURN jsonb_build_object('ok', true, 'parent_id', v_ident.parent_id);
END;
$$;

REVOKE ALL ON FUNCTION public.wa_verify_otp(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_verify_otp(uuid, text, text) TO service_role;


-- ============================================================
-- 4. RPC wa_get_payment_status — tool del intent get_payment_status
--
-- Devuelve los pagos pendientes/vencidos del padre EN ESTA ESCUELA.
-- Aislamiento por tenant: filtra por parent_id AND school_id (riesgo R17).
-- Nunca recibe el phone; recibe el parent_id ya verificado + la escuela de
-- la integración (que el BFF resuelve por routing).
-- ============================================================
CREATE OR REPLACE FUNCTION public.wa_get_payment_status(
    p_parent_id  uuid,
    p_school_id  uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    FROM (
        SELECT
            p.concept,
            GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0) AS saldo,
            p.amount,
            COALESCE(p.amount_paid, 0) AS amount_paid,
            p.due_date,
            p.status,
            (p.due_date < (now() AT TIME ZONE 'America/Bogota')::date) AS vencido
        FROM public.payments p
        WHERE p.parent_id = p_parent_id
          AND p.school_id = p_school_id
          AND p.status IN ('pending','partial','overdue')
        ORDER BY p.due_date ASC
        LIMIT 20
    ) t;
$$;

REVOKE ALL ON FUNCTION public.wa_get_payment_status(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_get_payment_status(uuid, uuid) TO service_role;


COMMIT;
