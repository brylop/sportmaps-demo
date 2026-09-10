-- =============================================================================
-- 20260909222343_whatsapp_optin_baja_sin_consentimiento.sql
-- Autor: brylop   Fecha: 2026-09-10   Versión anterior: 20260909215933
--
-- Objetivo: corregir dos defectos encontrados al revisar 20260909215933 (que ya
-- estaba commiteada, por eso el fix va acá y no editándola). NINGUNA de las dos
-- migraciones se había aplicado todavía: se aplican en orden y el estado final
-- es el correcto.
--
-- DEFECTO 1 — la baja fabricaba consentimiento.
--   wa_register_optin, cuando un número que NUNCA dio opt-in mandaba STOP,
--   insertaba la fila con opted_in_at = now() y source = 'user_confirmed',
--   usando el propio mensaje de STOP como source_ref. O sea: una fila que afirma
--   "esta persona confirmó que quiere recibir mensajes", cuya prueba es un
--   mensaje diciendo lo contrario. Es exactamente lo que el spec existe para
--   impedir, y lo que Meta miraría en una auditoría (riesgo R-C).
--   Fix: opted_in_at pasa a ser nullable, con un CHECK que igual obliga a la fila
--   a afirmar algo, y una fuente propia 'baja_directa'.
--
-- DEFECTO 2 — la baja podía hacer perder el mensaje entrante.
--   El PERFORM de wa_register_optin dentro de wa_ingest_inbound_message corría
--   suelto: cualquier error suyo abortaba la transacción completa y con ella el
--   insert del mensaje ya guardado. Un efecto secundario no puede tumbar la
--   ingesta. Fix: bloque de excepción propio, degrada con WARNING.
--
-- Spec: docs/specs/whatsapp-optin-y-rastreo-de-plantillas.md
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. opted_in_at pasa a nullable + el CHECK que sostiene el significado
-- =============================================================================
ALTER TABLE public.whatsapp_optins
    ALTER COLUMN opted_in_at DROP NOT NULL;

COMMENT ON COLUMN public.whatsapp_optins.opted_in_at IS
    'Cuándo consintió. NULL = nunca consintió (fila creada solo para registrar '
    'una baja pedida por un número que jamás dio opt-in).';

-- Una fila tiene que afirmar algo: o consintió, o pidió la baja. Las dos en NULL
-- sería una fila sin significado.
ALTER TABLE public.whatsapp_optins
    DROP CONSTRAINT IF EXISTS chk_wa_optin_dice_algo;
ALTER TABLE public.whatsapp_optins
    ADD CONSTRAINT chk_wa_optin_dice_algo
    CHECK (opted_in_at IS NOT NULL OR opted_out_at IS NOT NULL);


-- =============================================================================
-- 2. Nueva fuente 'baja_directa'
--
-- El CHECK de `source` en 20260909215933 es inline y quedó con nombre generado
-- por Postgres. Se localiza por su definición en vez de adivinar el nombre.
-- =============================================================================
DO $$
DECLARE
    v_name text;
BEGIN
    SELECT con.conname INTO v_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'whatsapp_optins'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) LIKE '%user_confirmed%'
     LIMIT 1;

    IF v_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.whatsapp_optins DROP CONSTRAINT %I', v_name);
    END IF;
END;
$$;

ALTER TABLE public.whatsapp_optins
    DROP CONSTRAINT IF EXISTS chk_wa_optin_source;
ALTER TABLE public.whatsapp_optins
    ADD CONSTRAINT chk_wa_optin_source
    CHECK (source IN (
        'user_confirmed',    -- respondió que sí en WhatsApp
        'form_inscripcion',  -- casilla explícita (fase 4)
        'invitacion',
        'import',            -- autorización previa de la escuela
        'admin_manual',
        'baja_directa'       -- pidió la baja sin haber consentido nunca
    ));


-- =============================================================================
-- 3. El índice de activos ahora exige consentimiento real
-- =============================================================================
DROP INDEX IF EXISTS public.idx_wa_optin_school_activo;
CREATE INDEX IF NOT EXISTS idx_wa_optin_school_activo
    ON public.whatsapp_optins(school_id)
    WHERE opted_in_at IS NOT NULL AND opted_out_at IS NULL;


-- =============================================================================
-- 4. wa_register_optin — la baja deja de inventar un opt-in
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
        -- dio opt-in, la fila se crea igual para dejar constancia de que pidió no
        -- ser contactado — que es justo lo que hay que respetar.
        --
        -- opted_in_at queda en NULL y source es 'baja_directa', ignorando p_source
        -- a propósito. En el DO UPDATE no se tocan source ni source_ref: si SÍ
        -- había consentimiento previo, su prueba original se conserva intacta.
        INSERT INTO public.whatsapp_optins (
            integration_id, school_id, contact_wa_id, parent_id,
            opted_in_at, opted_out_at, source, source_ref
        ) VALUES (
            p_integration_id, p_school_id, p_contact_wa_id, p_parent_id,
            NULL, now(), 'baja_directa', p_source_ref
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
-- 5. wa_can_send_template — una fila 'baja_directa' no es consentimiento
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
           AND o.opted_in_at   IS NOT NULL   -- las filas 'baja_directa' no consintieron
           AND o.opted_out_at  IS NULL
    )
    AND NOT public.wa_is_blocked(p_integration_id, p_contact_wa_id);
$$;

REVOKE ALL ON FUNCTION public.wa_can_send_template(uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_can_send_template(uuid, text) TO service_role;


-- =============================================================================
-- 6. wa_ingest_inbound_message — la baja no puede tumbar la ingesta
--
-- Idéntica a la versión de 20260909215933 salvo el bloque 3: el registro de la
-- baja va aislado en su propio bloque de excepción y pasa 'baja_directa'.
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
    v_conv_id   uuid;
    v_msg_id    uuid;
    v_norm      text;
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
        -- Aislado en su propio bloque: si el registro de la baja fallara por lo
        -- que sea, NO puede llevarse por delante la transacción y hacer que se
        -- pierda el mensaje entrante. El mensaje ya está guardado arriba; la baja
        -- es un efecto secundario y se degrada sola.
        BEGIN
            PERFORM public.wa_register_optin(
                p_integration_id, p_school_id, p_contact_wa_id,
                'baja_directa', p_wa_message_id, NULL, true
            );
            v_opted_out := true;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'wa_ingest: no se pudo registrar la baja de % (%): %',
                p_contact_wa_id, p_wa_message_id, SQLERRM;
        END;
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

COMMIT;
