-- ============================================================================
-- Eventos de cuenta de WhatsApp — lo que Meta avisa y nadie escuchaba
--
-- El webhook estaba suscrito SOLO a `messages`. Todo lo demás que Meta manda se
-- perdía, incluidas las cosas que rompen el canal sin hacer ruido:
--
--   · `message_template_status_update` — Meta desactiva o rechaza una plantilla.
--     La cobranza deja de salir y el primer aviso sería que nadie paga.
--   · `template_category_update`       — una plantilla cambia de categoría. Ya
--     pasó: `pago_vence_hoy` y `pago_recordatorio_previo` están en MARKETING sin
--     que nadie lo pidiera, y nos enteramos preguntándole a Graph a mano.
--     Marketing cuesta más y exige un consentimiento distinto del que tenemos.
--   · `phone_number_quality_update`    — la calidad baja. En rojo el número
--     queda restringido y se acaba el canal.
--   · `account_update`                 — restricción o baneo de la cuenta.
--   · `business_capability_update`     — cambia el límite de envío. Hoy estamos
--     en TIER_250: 250 destinatarios distintos cada 24 h, y Dynasty tiene 194
--     acudientes con pagos pendientes. Entra raspando.
--
-- Se guarda el evento CRUDO además de los campos que interesan: son estructuras
-- de Meta que cambian sin aviso, y perder el payload por no haber previsto un
-- campo sería repetir el error de haber descartado los `statuses`.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_account_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Nullable a propósito: varios de estos eventos llegan a nivel WABA y no
    -- traen phone_number_id, así que no siempre se puede resolver la escuela.
    -- Perder el evento por no poder atribuirlo sería peor que guardarlo suelto.
    integration_id uuid REFERENCES public.school_whatsapp_integrations(id) ON DELETE SET NULL,
    school_id      uuid REFERENCES public.schools(id) ON DELETE SET NULL,

    -- El `field` del webhook: message_template_status_update, etc.
    field         text NOT NULL,
    waba_id       text,
    phone_number_id text,

    -- Lo que se extrae para poder consultar sin abrir el jsonb.
    template_name text,
    /* APPROVED | REJECTED | PAUSED | DISABLED | PENDING… (plantillas)
       GREEN | YELLOW | RED (calidad)  ·  el evento manda strings libres */
    nuevo_estado  text,
    estado_previo text,
    motivo        text,

    payload       jsonb NOT NULL,
    -- Para que la pantalla pueda marcar lo ya visto sin borrar el historial.
    visto_at      timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_account_events IS
    'Eventos de Meta que NO son mensajes: estado y categoría de plantillas, calidad '
    'del número, restricciones de cuenta y límites de envío. Hasta 2026-09-12 el '
    'webhook los descartaba.';

CREATE INDEX IF NOT EXISTS idx_wa_account_events_recientes
    ON public.whatsapp_account_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_account_events_sin_ver
    ON public.whatsapp_account_events (school_id, created_at DESC)
    WHERE visto_at IS NULL;

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Explícito desde el nacimiento: los default privileges del esquema le dan
-- acceso a `anon` y `authenticated` a cada tabla nueva, y `REVOKE FROM PUBLIC`
-- no los quita. Es la trampa que ya se cerró dos veces en este módulo.
REVOKE ALL ON public.whatsapp_account_events FROM PUBLIC;
REVOKE ALL ON public.whatsapp_account_events FROM anon;
REVOKE ALL ON public.whatsapp_account_events FROM authenticated;

GRANT SELECT ON public.whatsapp_account_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_account_events TO service_role;

ALTER TABLE public.whatsapp_account_events ENABLE ROW LEVEL SECURITY;

-- La escuela ve SUS eventos. Los que llegan sin escuela resuelta (nivel WABA) no
-- los ve nadie desde la app: son de plataforma y se miran por consola.
DROP POLICY IF EXISTS "wa_account_events_admin_select" ON public.whatsapp_account_events;
CREATE POLICY "wa_account_events_admin_select" ON public.whatsapp_account_events
    FOR SELECT TO authenticated
    USING (school_id IS NOT NULL AND public.is_school_admin(school_id));

DROP POLICY IF EXISTS "wa_account_events_no_direct_write" ON public.whatsapp_account_events;
CREATE POLICY "wa_account_events_no_direct_write" ON public.whatsapp_account_events
    FOR INSERT TO authenticated WITH CHECK (false);
