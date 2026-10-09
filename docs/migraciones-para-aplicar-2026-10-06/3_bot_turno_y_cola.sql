-- Pegar COMPLETO en el SQL Editor. Candado de turno del bot (ráfagas) y vencimiento de la cola.
-- =============================================================================
-- 20261006090725_whatsapp_bot_turno_y_vencimiento_cola.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261006084303
-- Objetivo: dos columnas para el bot de WhatsApp (análisis
--   docs/analisis/whatsapp-conversaciones-dynasty-2026-10-06.md):
--
--   P5 · whatsapp_conversations.bot_turno_hasta — candado (lease) por
--        conversación. El 06-oct el webhook corría un turno por mensaje, en
--        paralelo: 4 salientes en 2 s, fuera de orden, con estados de pago
--        duplicados. Los 3 BFF lo toman con un UPDATE condicional
--        (bot_turno_hasta nulo o vencido) desde whatsapp-turno-agrupado.service.
--
--   P1 · whatsapp_inbound_queue.vencida_at — cuándo el job de vencimiento
--        pasó la fila a la escuela (buzón + push + correo + un mensaje a la
--        familia). Una sola vez por fila entre los 3 BFF. NO se reusa
--        `outcome_notified_at`: esa columna es del aviso de aprobación del
--        pago (whatsapp-payment-outcome.job) y marcarla lo silenciaría.
--
-- Sin estas columnas el BFF funciona igual que antes (sin candado; vencimiento
-- con freno de 24 h por conversación): el código detecta el error de columna.
-- Solo columnas e índice parcial; no toca RLS, policies ni funciones.
-- =============================================================================

BEGIN;

ALTER TABLE public.whatsapp_conversations
    ADD COLUMN IF NOT EXISTS bot_turno_hasta timestamptz;

COMMENT ON COLUMN public.whatsapp_conversations.bot_turno_hasta IS
    'Lease del turno del bot (P5, 2026-10-06): mientras sea futuro, otro turno de esta conversación espera. Lo toma/suelta whatsapp-turno-agrupado.service.';

ALTER TABLE public.whatsapp_inbound_queue
    ADD COLUMN IF NOT EXISTS vencida_at timestamptz;

COMMENT ON COLUMN public.whatsapp_inbound_queue.vencida_at IS
    'Cuándo el job whatsapp-cola-vencimiento pasó esta fila a la escuela por llevar >10 min sin desenlace (P1, 2026-10-06). No cierra la fila.';

-- El job barre cada 2 min las filas sin desenlace: índice parcial chico.
CREATE INDEX IF NOT EXISTS idx_wa_inbound_queue_sin_desenlace
    ON public.whatsapp_inbound_queue (created_at)
    WHERE status IN ('pending', 'processing') AND vencida_at IS NULL;

COMMIT;

insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261006090725', '20261006090725_whatsapp_bot_turno_y_vencimiento_cola', 'sql-editor 2026-10-06') on conflict (version) do nothing;
