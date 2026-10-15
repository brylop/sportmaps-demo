-- =============================================================================
-- 20261014152633_wa_estado_pagos_con_mora.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014133326
-- Objetivo: el bot de WhatsApp dice cuánto del saldo es recargo por mora.
-- =============================================================================
-- wa_get_payment_status (última versión: 20260911184400) no devolvía
-- late_fee_amount, así que el bot (whatsapp-bot.service.ts, «pagos
-- pendientes», y whatsapp-reglas-turno.ts, «ya pagué») no podía mostrar la
-- línea «Recargo por mora $Y». Además el saldo ahora descuenta el pronto pago
-- ya aplicado, la misma regla que el enlace público, la app y el débito
-- automático (amount - amount_paid - early_payment_discount_applied).
-- Mismo cuerpo que 20260911184400 salvo esas dos columnas.
-- =============================================================================

BEGIN;

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
            GREATEST(p.amount - COALESCE(p.amount_paid, 0)
                     - COALESCE(p.early_payment_discount_applied, 0), 0) AS saldo,
            p.amount,
            COALESCE(p.amount_paid, 0) AS amount_paid,
            -- Parte del saldo que es recargo por mora (ya sumado en amount).
            COALESCE(p.late_fee_amount, 0) AS late_fee_amount,
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
                WHEN 'partial'           THEN 'abonado, falta saldo por pagar'
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
              OR (p.status IN ('paid','awaiting_approval','glosado','rejected')
                  AND p.updated_at > now() - interval '60 days')
          )
        ORDER BY (p.status IN ('pending','partial','overdue')) DESC, p.due_date ASC
        LIMIT 20
    ) t;
$$;

COMMENT ON FUNCTION public.wa_get_payment_status(uuid, uuid) IS
    'Estado de pagos del acudiente en una escuela para el bot: lo pendiente MÁS lo '
    'resuelto en los últimos 60 días, con el saldo (descontando abonos y pronto pago) '
    'y cuánto de él es recargo por mora (late_fee_amount).';

REVOKE ALL ON FUNCTION public.wa_get_payment_status(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_get_payment_status(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.wa_get_payment_status(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_get_payment_status(uuid, uuid) TO service_role;

COMMIT;
