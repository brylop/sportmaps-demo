-- ============================================================================
-- Cola de comprobantes entrantes de WhatsApp
--
-- Plan: docs/specs/whatsapp-cola-de-comprobantes-plan.md (revisión 2)
--
-- La tabla `whatsapp_inbound_queue` YA EXISTE en la base pero nunca tuvo
-- migración. Esta migración la formaliza (para que un ambiente nuevo la
-- reproduzca) y cierra los huecos que tiene. Medido el 2026-09-11: 0 filas, lo
-- que permite endurecerla sin medir radio — no hay dato que romper.
-- ============================================================================

-- ── A. La tabla, como está hoy ──────────────────────────────────────────────
-- No-op en la base actual; existe para que un ambiente limpio la reproduzca.
CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_queue (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        uuid REFERENCES public.schools(id),
    wa_phone_number  text NOT NULL,
    wa_message_id    text UNIQUE,
    wa_timestamp     timestamptz,
    message_type     text NOT NULL,
    media_url        text,
    media_mime_type  text,
    media_caption    text,
    text_body        text,
    detected_intent  text,
    matched_parent_id uuid REFERENCES public.profiles(id),
    matched_child_id  uuid REFERENCES public.children(id),
    status           text NOT NULL DEFAULT 'pending',
    processed_at     timestamptz,
    result_ref_id    uuid,
    result_type      text,
    error_message    text,
    retries          integer NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── B. Endurecer ────────────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_inbound_queue
    -- El resto del módulo se llavea por integración; esta se llaveaba por
    -- school_id + wa_phone_number. Una escuela con dos números no se podía
    -- desambiguar, ni resolver el token para bajar el archivo.
    ADD COLUMN IF NOT EXISTS integration_id uuid,
    -- Ruta en el bucket. Se estampa ANTES del OCR: la URL de media de Meta
    -- expira, así que un reintento tardío ya no puede bajar el archivo y el
    -- comprobante del padre se perdía sin dejar rastro.
    ADD COLUMN IF NOT EXISTS storage_path   text,
    -- Lease del worker. Sin esto, un proceso que muere entre el claim y el
    -- final deja la fila en 'processing' para siempre, sin que nadie la mire.
    ADD COLUMN IF NOT EXISTS locked_until   timestamptz,
    -- Backoff de los reintentos transitorios (red, 429, OCR caído).
    ADD COLUMN IF NOT EXISTS next_retry_at  timestamptz;

ALTER TABLE public.whatsapp_inbound_queue
    ALTER COLUMN school_id      SET NOT NULL,
    -- Es el UNIQUE que da la idempotencia contra el reintento de Meta. Nullable
    -- significaba que varias filas con NULL convivían y ahí se caía la
    -- protección entera.
    ALTER COLUMN wa_message_id  SET NOT NULL,
    ALTER COLUMN integration_id SET NOT NULL;

-- FK COMPUESTA contra el UNIQUE (id, school_id) de school_whatsapp_integrations
-- (puesto por la migración de opt-in): impide colar una integración de OTRA
-- escuela sin necesidad de un trigger.
--
-- ON DELETE RESTRICT, deliberadamente NO CASCADE: borrar una integración no
-- puede borrar el rastro de un comprobante que movió plata.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_wa_queue_integracion') THEN
        ALTER TABLE public.whatsapp_inbound_queue
            ADD CONSTRAINT fk_wa_queue_integracion
            FOREIGN KEY (integration_id, school_id)
            REFERENCES public.school_whatsapp_integrations (id, school_id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- `ADD CONSTRAINT` no admite IF NOT EXISTS, así que los CHECK van envueltos para
-- que la migración se pueda re-correr.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wa_queue_status') THEN
        ALTER TABLE public.whatsapp_inbound_queue
            ADD CONSTRAINT chk_wa_queue_status CHECK (status IN (
                'pending',       -- esperando al worker
                'processing',    -- tomada, con lease vigente
                'waiting_user',  -- el bot preguntó a cuál pago aplicar y espera
                'done',
                'failed',        -- error permanente, va al inbox
                'ignored'        -- no era un comprobante; NO es un fallo
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wa_queue_result') THEN
        ALTER TABLE public.whatsapp_inbound_queue
            ADD CONSTRAINT chk_wa_queue_result CHECK (
                result_type IS NULL OR result_type IN
                ('payment_receipt', 'glosa', 'escalated', 'none')
            );
    END IF;
END $$;

-- ── C. Permisos ─────────────────────────────────────────────────────────────
-- Medido el 2026-09-11: anon Y authenticated tenían DELETE/INSERT/SELECT/UPDATE.
-- Revocar solo de anon y PUBLIC dejaba el agujero grande abierto — authenticated
-- es cualquiera con cuenta, incluido un acudiente de otra escuela. Los default
-- privileges del esquema otorgan esto a cada tabla nueva y REVOKE FROM PUBLIC
-- no los quita: hay que revocar de cada rol explícitamente.
REVOKE ALL ON public.whatsapp_inbound_queue FROM PUBLIC;
REVOKE ALL ON public.whatsapp_inbound_queue FROM anon;
REVOKE ALL ON public.whatsapp_inbound_queue FROM authenticated;

-- El inbox de la escuela lee por la policy, que necesita el GRANT de SELECT.
GRANT SELECT ON public.whatsapp_inbound_queue TO authenticated;
-- DELETE incluido por la retención a 90 días.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_inbound_queue TO service_role;

ALTER TABLE public.whatsapp_inbound_queue ENABLE ROW LEVEL SECURITY;

-- Escritura denegada de forma EXPLÍCITA, no por ausencia de policy (invariante I3).
DROP POLICY IF EXISTS "wa_queue_no_direct_write" ON public.whatsapp_inbound_queue;
CREATE POLICY "wa_queue_no_direct_write" ON public.whatsapp_inbound_queue
    FOR INSERT TO authenticated WITH CHECK (false);

-- Se CONSERVA `wa_queue_admin_select` tal como está: usa is_school_admin(), que
-- es el patrón correcto (un admin que no sea el dueño sí ve) y es el modelo a
-- seguir cuando se corrija la deuda de owner_id de las tablas de WA1.

-- ── D. Índice de trabajo ────────────────────────────────────────────────────
-- El índice que existe cubre toda la tabla por estado; el worker solo pregunta
-- por lo pendiente, y con el tiempo el 99% de las filas será 'done'.
CREATE INDEX IF NOT EXISTS idx_wa_queue_pendientes
    ON public.whatsapp_inbound_queue (created_at)
    WHERE status IN ('pending', 'processing');

-- ── E. Nada ─────────────────────────────────────────────────────────────────
-- El lease se apoya en updated_at, y el trigger `set_wa_queue_updated_at` YA
-- existe en la tabla (verificado el 2026-09-11). Queda anotado para que nadie lo
-- agregue dos veces.

COMMENT ON TABLE public.whatsapp_inbound_queue IS
    'Comprobantes y archivos que llegan por WhatsApp. El webhook encola y retorna; '
    'el worker baja, guarda en el bucket, extrae y aplica. Ver '
    'docs/specs/whatsapp-cola-de-comprobantes-plan.md';
COMMENT ON COLUMN public.whatsapp_inbound_queue.storage_path IS
    'Ruta en el bucket payment-receipts. Se estampa ANTES del OCR porque la URL '
    'de media de Meta expira y un reintento tardío ya no podría bajarla.';
COMMENT ON COLUMN public.whatsapp_inbound_queue.locked_until IS
    'Lease del worker. Vencido = la fila se rescata aunque esté en processing.';
