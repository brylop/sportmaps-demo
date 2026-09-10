-- =============================================================================
-- 20260909215933_whatsapp_optin_y_rastreo_de_plantillas.sql
-- Autor: brylop   Fecha: 2026-09-10   Versión anterior: 20260909215903
--
-- Objetivo: registrar el CONSENTIMIENTO explícito de cada número de WhatsApp
-- para recibir mensajes iniciados por la escuela (plantillas), y rastrear el
-- estado de aprobación de las plantillas en Meta.
--
-- Fase 1 del plan v2 del canal de WhatsApp.
-- Spec: docs/specs/whatsapp-optin-y-rastreo-de-plantillas.md
--
-- LA DISTINCIÓN QUE SOSTIENE TODO ESTO:
--   · Que el usuario escriba primero abre la VENTANA de 24h → habilita responder
--     texto libre. Vive en whatsapp_conversations.last_inbound_at (ya existía).
--   · El OPT-IN es otra cosa: habilita mandarle plantillas fuera de esa ventana
--     (toda la cobranza). Requiere una acción afirmativa del usuario. Es esta tabla.
--   Confundirlos es el riesgo R14 del bloque (que una escuela nos tumbe el Tech
--   Provider). Política de Meta verificada el 2026-09-09: "you have received opt-in
--   permission from the recipient confirming that they wish to receive subsequent
--   messages" — https://whatsappbusiness.com/policy
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Destino de la FK compuesta
--
-- Permite que whatsapp_optins referencie (integration_id, school_id) juntos, de
-- modo que el school_id desnormalizado —que la policy de RLS necesita sin join—
-- no pueda divergir de la escuela real de la integración. Redundante con la PK,
-- pero Postgres exige un índice único sobre el par exacto para aceptar la
-- referencia. Un CHECK no serviría: no puede mirar otra tabla.
-- =============================================================================
ALTER TABLE public.school_whatsapp_integrations
    DROP CONSTRAINT IF EXISTS uq_wa_integration_id_school;
ALTER TABLE public.school_whatsapp_integrations
    ADD CONSTRAINT uq_wa_integration_id_school UNIQUE (id, school_id);


-- =============================================================================
-- 2. whatsapp_optins — consentimiento explícito, por número y por integración
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_optins (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    integration_id   uuid NOT NULL,
    school_id        uuid NOT NULL,
    contact_wa_id    text NOT NULL,

    -- Se llena si/cuando el contacto se identifica por OTP. Puede quedar NULL
    -- para siempre: el consentimiento es del NÚMERO, no de la persona.
    parent_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

    opted_in_at      timestamptz NOT NULL,
    opted_out_at     timestamptz,

    -- text + CHECK, no CREATE TYPE (convención del repo).
    -- TODAS son fuentes explícitas. NO existe un valor para "abrió la ventana":
    -- eso no es consentimiento y no se guarda acá.
    source           text NOT NULL CHECK (source IN (
                         'user_confirmed',    -- respondió que sí en WhatsApp
                         'form_inscripcion',  -- casilla explícita (fase 4)
                         'invitacion',
                         'import',            -- autorización previa de la escuela
                         'admin_manual'
                     )),

    -- Prueba del consentimiento: wa_message_id de la confirmación, id de la
    -- inscripción, lote de importación. NOT NULL a propósito: hace imposible
    -- por diseño registrar un opt-in sin poder decir de dónde salió.
    source_ref       text NOT NULL,

    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_wa_optin UNIQUE (integration_id, contact_wa_id),

    CONSTRAINT fk_wa_optin_integration
        FOREIGN KEY (integration_id, school_id)
        REFERENCES public.school_whatsapp_integrations(id, school_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_optin_school_activo
    ON public.whatsapp_optins(school_id)
    WHERE opted_out_at IS NULL;

COMMENT ON TABLE public.whatsapp_optins IS
    'Consentimiento EXPLÍCITO por número + integración para recibir plantillas. '
    'No confundir con la ventana de 24h (whatsapp_conversations.last_inbound_at): '
    'escribir primero NO es opt-in. Escritura solo por RPC/service_role.';

COMMENT ON COLUMN public.whatsapp_optins.source_ref IS
    'Prueba del consentimiento (wa_message_id de la confirmación, id de inscripción, lote).';


-- =============================================================================
-- 3. RLS
--
-- Lectura acotada al dueño de la escuela, igual que whatsapp_conversations.
-- DEUDA CONOCIDA: el patrón owner_id de WA1 deja fuera a los administradores que
-- no son dueños; el inbox de la fase 4 no le sirve a nadie salvo al dueño. Se
-- corrige en bloque (las 5 policies de WA1 + esta) antes de cerrar esa fase, con
-- su propia medición de radio. Ver §3 del spec.
-- =============================================================================
ALTER TABLE public.whatsapp_optins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_optin_owner_select" ON public.whatsapp_optins;
CREATE POLICY "wa_optin_owner_select" ON public.whatsapp_optins
    FOR SELECT TO authenticated
    USING (school_id IN (SELECT id FROM public.schools WHERE owner_id = auth.uid()));

-- Explícita en vez de ausente, para que se lea la intención. Sin FOR ALL: esa
-- forma validaría los INSERT con la expresión del USING (invariante I3).
DROP POLICY IF EXISTS "wa_optin_no_direct_write" ON public.whatsapp_optins;
CREATE POLICY "wa_optin_no_direct_write" ON public.whatsapp_optins
    FOR INSERT TO authenticated WITH CHECK (false);


-- =============================================================================
-- 4. RPC wa_register_optin — registra o revoca el consentimiento
-- =============================================================================
CREATE OR REPLACE FUNCTION public.wa_register_optin(
    p_integration_id uuid,
    p_school_id      uuid,
    p_contact_wa_id  text,
    p_source         text,
    p_source_ref     text,
    p_parent_id      uuid DEFAULT NULL,
    p_opt_out        boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_id uuid;
BEGIN
    IF p_opt_out THEN
        -- La baja NUNCA borra la fila: estampa opted_out_at. Si el número nunca
        -- dio opt-in, la fila se crea igual para dejar constancia de que pidió
        -- no ser contactado — que es justo lo que hay que respetar.
        INSERT INTO public.whatsapp_optins (
            integration_id, school_id, contact_wa_id, parent_id,
            opted_in_at, opted_out_at, source, source_ref
        ) VALUES (
            p_integration_id, p_school_id, p_contact_wa_id, p_parent_id,
            now(), now(), p_source, p_source_ref
        )
        ON CONFLICT (integration_id, contact_wa_id) DO UPDATE SET
            opted_out_at = now(),
            parent_id    = COALESCE(EXCLUDED.parent_id, public.whatsapp_optins.parent_id),
            updated_at   = now()
        RETURNING id INTO v_id;

        RETURN jsonb_build_object('ok', true, 'opted_out', true, 'optin_id', v_id);
    END IF;

    INSERT INTO public.whatsapp_optins (
        integration_id, school_id, contact_wa_id, parent_id,
        opted_in_at, opted_out_at, source, source_ref
    ) VALUES (
        p_integration_id, p_school_id, p_contact_wa_id, p_parent_id,
        now(), NULL, p_source, p_source_ref
    )
    ON CONFLICT (integration_id, contact_wa_id) DO UPDATE SET
        opted_in_at  = now(),
        opted_out_at = NULL,
        source       = EXCLUDED.source,
        source_ref   = EXCLUDED.source_ref,
        parent_id    = COALESCE(EXCLUDED.parent_id, public.whatsapp_optins.parent_id),
        updated_at   = now()
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('ok', true, 'opted_out', false, 'optin_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.wa_register_optin(uuid, uuid, text, text, text, uuid, boolean)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_register_optin(uuid, uuid, text, text, text, uuid, boolean)
    TO service_role;


-- =============================================================================
-- 5. RPC wa_can_send_template — la pregunta obligatoria antes de TODO envío
--
-- Junta consentimiento y kill-switch en una sola pregunta, para que ningún
-- camino de envío pueda consultar uno y olvidarse del otro (riesgo R-B).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.wa_can_send_template(
    p_integration_id uuid,
    p_contact_wa_id  text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.whatsapp_optins o
         WHERE o.integration_id = p_integration_id
           AND o.contact_wa_id  = p_contact_wa_id
           AND o.opted_out_at  IS NULL
    )
    AND NOT public.wa_is_blocked(p_integration_id, p_contact_wa_id);
$$;

REVOKE ALL ON FUNCTION public.wa_can_send_template(uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_can_send_template(uuid, text) TO service_role;


-- =============================================================================
-- 6. RPC wa_window_is_open — el otro lado del par (se cablea en la fase 4)
--
-- Fuera de la ventana de 24h el texto libre falla con el error 131047 de Meta y
-- el mensaje se pierde EN SILENCIO. Queda creada desde ahora para que el par sea
-- explícito: texto libre pregunta por la ventana, plantilla por el opt-in.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.wa_window_is_open(
    p_integration_id uuid,
    p_contact_wa_id  text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT c.last_inbound_at > now() - interval '24 hours'
           FROM public.whatsapp_conversations c
          WHERE c.integration_id = p_integration_id
            AND c.contact_wa_id  = p_contact_wa_id),
        false);
$$;

REVOKE ALL ON FUNCTION public.wa_window_is_open(uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_window_is_open(uuid, text) TO service_role;


-- =============================================================================
-- 7. wa_ingest_inbound_message — se REEMPLAZA para detectar la baja
--
-- El archivo de WA1 no se toca (migraciones inmutables): se redefine acá.
-- Único cambio respecto de WA1: si el mensaje entrante es una palabra de baja,
-- se registra el opt-out en la MISMA transacción.
--
-- Lo que deliberadamente NO hace: estampar opt-in por recibir un mensaje.
-- Recibir un mensaje abre la ventana (last_inbound_at, más abajo) y nada más.
-- =============================================================================
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
    v_conv_id  uuid;
    v_msg_id   uuid;
    v_norm     text;
    v_opted_out boolean := false;
BEGIN
    -- 1. Upsert conversación (esto es lo que mantiene la ventana de 24h)
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
        -- No se evalúa la baja: ya se evaluó en la primera pasada.
        UPDATE public.whatsapp_conversations
           SET unread_count = GREATEST(0, unread_count - 1)
         WHERE id = v_conv_id;
        RETURN jsonb_build_object('ok', true, 'duplicate', true, 'conversation_id', v_conv_id);
    END IF;

    -- 3. Baja por palabra clave (requisito de Meta).
    --
    -- Se normaliza y se compara contra el mensaje COMPLETO, nunca por subcadena.
    -- Con subcadena, "quiero cancelar la clase del sábado" daría de baja al padre
    -- de toda la cobranza y nadie se enteraría hasta que dejara de pagar. Por eso
    -- 'cancelar' a secas tampoco está en la lista.
    v_norm := btrim(lower(COALESCE(p_text_body, '')));
    v_norm := translate(v_norm, 'áéíóúüñ', 'aeiouun');
    v_norm := regexp_replace(v_norm, '[^a-z0-9 ]', '', 'g');
    v_norm := btrim(regexp_replace(v_norm, '\s+', ' ', 'g'));

    IF v_norm = ANY (ARRAY[
        'stop', 'baja', 'cancelar suscripcion', 'desuscribir', 'no molestar', 'salir'
    ]) THEN
        PERFORM public.wa_register_optin(
            p_integration_id, p_school_id, p_contact_wa_id,
            'user_confirmed', p_wa_message_id, NULL, true
        );
        v_opted_out := true;
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'duplicate', false,
        'conversation_id', v_conv_id, 'message_id', v_msg_id,
        'opted_out', v_opted_out
    );
END;
$$;

REVOKE ALL ON FUNCTION public.wa_ingest_inbound_message(uuid, uuid, text, text, text, text, text, jsonb, timestamptz)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_ingest_inbound_message(uuid, uuid, text, text, text, text, text, jsonb, timestamptz)
    TO service_role;


-- =============================================================================
-- 8. payment_message_templates — rastreo del estado en Meta
--
-- OJO: las filas con school_id IS NULL son las plantillas globales por defecto.
-- Una plantilla de Meta vive en el WABA de UNA escuela concreta, así que estas
-- columnas solo tienen sentido con school_id NOT NULL. El registro de la fase 3
-- debe CLONAR la global a una fila de la escuela y estampar ahí el resultado.
-- No se fuerza con CHECK porque rompería las filas globales existentes.
-- =============================================================================
ALTER TABLE public.payment_message_templates
    ADD COLUMN IF NOT EXISTS meta_template_name     text,
    ADD COLUMN IF NOT EXISTS meta_template_status   text,
    ADD COLUMN IF NOT EXISTS meta_template_language text DEFAULT 'es',
    ADD COLUMN IF NOT EXISTS meta_synced_at         timestamptz;

ALTER TABLE public.payment_message_templates
    DROP CONSTRAINT IF EXISTS chk_meta_template_status;
ALTER TABLE public.payment_message_templates
    ADD CONSTRAINT chk_meta_template_status
    CHECK (meta_template_status IS NULL OR meta_template_status IN
          ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'));

COMMENT ON COLUMN public.payment_message_templates.meta_template_name IS
    'Nombre de la plantilla en Meta. Solo aplica a filas con school_id NOT NULL: '
    'una plantilla aprobada vive en el WABA de una escuela concreta.';

-- NOTA: no hay backfill de opt-ins. Los contactos que ya escribieron abrieron
-- la ventana, no consintieron; insertarlos sería fabricar consentimiento. La
-- captura se hace conversacionalmente (§5 del spec) y la tabla arranca vacía.

COMMIT;
