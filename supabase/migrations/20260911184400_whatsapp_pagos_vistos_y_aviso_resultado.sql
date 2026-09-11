-- ============================================================================
-- Que el bot pueda hablar de un pago YA HECHO, y avisar su resultado
--
-- Dos huecos que salieron de la prueba en vivo del 2026-09-11, los dos sobre la
-- conversación y no sobre la lógica.
--
-- 1. `wa_get_payment_status` filtraba `status IN ('pending','partial','overdue')`
--    — o sea, solo devolvía LO QUE SE DEBE. Cuando el acudiente preguntó «¿y el
--    de la mensualidad?», la herramienta no devolvió nada y el modelo concluyó,
--    razonando bien sobre lo que recibió, que «no te aparece registrado un cobro
--    por concepto de mensualidad». La mensualidad existía y estaba PAGADA, y la
--    escuela se la había aprobado siete minutos antes.
--
--    Decirle a un papá que el cobro que acaba de pagar no existe es peor que no
--    responderle: queda pensando que perdió la plata.
--
-- 2. No había forma de saber si ya se le avisó al acudiente el resultado de su
--    comprobante, así que un job que avise no podía existir sin arriesgarse a
--    repetir el mensaje en cada vuelta.
-- ============================================================================

-- ── 1. El bot ve también lo ya pagado ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.wa_get_payment_status(
    p_parent_id uuid,
    p_school_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
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
            -- Traducción explícita para el modelo, que no tiene por qué conocer
            -- los estados internos ni inventar su significado.
            CASE p.status
                WHEN 'paid'              THEN 'pagado y confirmado por la escuela'
                WHEN 'awaiting_approval' THEN 'comprobante recibido, la escuela lo está revisando'
                WHEN 'glosado'           THEN 'la escuela pidió una aclaración sobre este pago'
                WHEN 'rejected'          THEN 'el comprobante fue rechazado'
                WHEN 'overdue'           THEN 'pendiente y vencido'
                ELSE 'pendiente de pago'
            END AS estado_legible,
            p.payment_date,
            (p.status IN ('pending','partial','overdue')) AS debe_pagarse,
            (p.due_date < (now() AT TIME ZONE 'America/Bogota')::date
             AND p.status IN ('pending','partial','overdue')) AS vencido
        FROM public.payments p
        WHERE p.parent_id = p_parent_id
          AND p.school_id = p_school_id
          AND (
              -- Lo que se debe, siempre.
              p.status IN ('pending','partial','overdue')
              -- Y lo resuelto hace poco, para poder responder «¿y el que pagué?».
              -- 60 días cubre la pregunta real («el de este mes») sin volcarle al
              -- modelo el histórico entero.
              OR (p.status IN ('paid','awaiting_approval','glosado','rejected')
                  AND p.updated_at > now() - interval '60 days')
          )
        ORDER BY (p.status IN ('pending','partial','overdue')) DESC, p.due_date ASC
        LIMIT 20
    ) t;
$$;

COMMENT ON FUNCTION public.wa_get_payment_status(uuid, uuid) IS
    'Estado de pagos del acudiente en una escuela para el bot: lo pendiente MÁS lo '
    'resuelto en los últimos 60 días. Antes solo devolvía deuda, y el bot llegó a '
    'negar la existencia de un pago que el acudiente acababa de hacer.';

REVOKE ALL ON FUNCTION public.wa_get_payment_status(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_get_payment_status(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.wa_get_payment_status(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_get_payment_status(uuid, uuid) TO service_role;

-- ── 2. Marca de «ya le avisé el resultado» ──────────────────────────────────
-- La fila de la cola ya enlaza el comprobante con el pago y con la conversación,
-- así que es el lugar natural para recordar si el desenlace se comunicó. Sin
-- esta marca, un job que avise repetiría el mensaje en cada vuelta.
ALTER TABLE public.whatsapp_inbound_queue
    ADD COLUMN IF NOT EXISTS outcome_notified_at timestamptz;

COMMENT ON COLUMN public.whatsapp_inbound_queue.outcome_notified_at IS
    'Cuándo se le avisó al acudiente por WhatsApp que su comprobante quedó aprobado '
    'o rechazado. NULL = el desenlace todavía no volvió al chat donde entró.';

CREATE INDEX IF NOT EXISTS idx_wa_queue_sin_avisar
    ON public.whatsapp_inbound_queue (result_ref_id)
    WHERE result_type = 'payment_receipt' AND outcome_notified_at IS NULL;
