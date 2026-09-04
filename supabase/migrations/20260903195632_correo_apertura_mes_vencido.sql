-- =============================================================================
-- 20260903195632_correo_apertura_mes_vencido.sql
-- Autor: brylop   Fecha: 2026-09-04   Versión anterior: 20260903171854
-- Objetivo: soporte de datos para dos correos automáticos, apagados por
-- defecto por escuela:
--   1. Al abrir el mes (open_month genera la mensualidad) → aviso de cobro.
--   2. Al pasar los días de gracia (apply_late_fees pasa el pago a 'overdue')
--      → recordatorio de vencido.
-- Ninguna de las dos funciones SQL se toca: el envío lo hace un job del BFF
-- por *polling* sobre las marcas de idempotencia que se agregan acá, mismo
-- patrón que payments.reminder_sent_at / late_fee_applied_at.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS charge_notifications_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.charge_notifications_enabled IS
    'Un solo toggle gobierna los dos correos automáticos del ciclo de facturación: '
    '(1) aviso al generarse la mensualidad del mes, (2) recordatorio al pasar los '
    'días de gracia sin pagar. Apagado por defecto — opt-in por escuela.';

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS charge_notice_sent_at  timestamptz,
    ADD COLUMN IF NOT EXISTS overdue_notice_sent_at timestamptz;

COMMENT ON COLUMN public.payments.charge_notice_sent_at IS
    'Cuándo se envió el correo de "cobro generado" (job del BFF, no la apertura '
    'del mes en sí). NULL = aún no enviado. Idempotencia del correo 1.';
COMMENT ON COLUMN public.payments.overdue_notice_sent_at IS
    'Cuándo se envió el correo de "pago vencido" tras pasar los días de gracia '
    '(job del BFF, después de que apply_late_fees() marca el pago overdue). '
    'NULL = aún no enviado. Idempotencia del correo 2.';

COMMIT;
