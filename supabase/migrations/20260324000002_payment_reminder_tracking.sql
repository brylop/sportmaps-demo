-- ============================================================================
-- MIGRACION: Agregar tracking de recordatorios enviados
-- Fecha: 2026-03-24
-- Descripcion: Agrega last_reminder_sent a payments para evitar enviar
--              multiples recordatorios el mismo dia.
-- ============================================================================

-- Columna para saber cuando se envio el ultimo recordatorio
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS last_reminder_sent date;

-- Index para el cron de recordatorios (busca pending/overdue por escuela)
CREATE INDEX IF NOT EXISTS idx_payments_reminder_cron
ON public.payments (school_id, status, due_date)
WHERE status IN ('pending', 'overdue');
