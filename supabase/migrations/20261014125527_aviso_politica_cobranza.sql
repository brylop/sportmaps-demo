-- =============================================================================
-- 20261014125527_aviso_politica_cobranza.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014112226
-- Objetivo: aviso de política de cobranza por escuela, destacado en los correos
--   de recordatorio de cobro (recordatorios-cobro.service →
--   BrandedEmailTemplates.recordatorioCobro). Pedido del usuario 2026-10-14
--   para Besser: «Quien acumule más de un mes de retraso no podrá hacer uso de
--   los servicios del club». Es texto de la escuela (su reglamento), no una
--   regla que el sistema aplique: el bloqueo real va por sus propios flags.
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

-- NULL = sin aviso (todas las escuelas salvo Besser). Corto a propósito: es un
-- recuadro de una o dos líneas, no un reglamento.
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS collection_policy_notice text
        CHECK (collection_policy_notice IS NULL OR char_length(collection_policy_notice) BETWEEN 1 AND 300);

COMMENT ON COLUMN public.school_settings.collection_policy_notice IS
    'Aviso de política de cobranza de la escuela, destacado en los correos de recordatorio de cobro. NULL = sin aviso. Máx. 300 caracteres. Migración 20261014125527.';

UPDATE public.school_settings
   SET collection_policy_notice = 'Quien acumule más de un mes de retraso en el pago no podrá hacer uso de los servicios del club.'
 WHERE school_id = '759eee9d-05cb-4958-b84a-2560f77e3683';

COMMIT;
