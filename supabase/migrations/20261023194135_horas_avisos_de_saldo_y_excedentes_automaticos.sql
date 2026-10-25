-- =============================================================================
-- 20261023194135_horas_avisos_de_saldo_y_excedentes_automaticos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-24   Versión anterior: 20261023093127
-- Objetivo: ajustes por escuela para (1) la escalera de avisos de saldo de horas
--   (app + correo) y (2) la confirmación automática de excedentes bajo tope, más
--   la marca «ya avisé» por período del banco de horas.
-- Plan: docs/specs/dreamers-horas-agotadas-bloqueo-y-excedentes-automaticos.md (§2.1, §3, §4)
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
-- Qué NO hace (a propósito):
--   · NO agrega `access_auto_block_no_hours_enabled`: el bloqueo físico por horas
--     quedó invalidado el 2026-10-23 (el MB360 guarda el bit de «deshabilitado»
--     pero no lo usa para negar la entrada; ver el plan). Esa columna se agrega
--     cuando exista un mecanismo de bloqueo que funcione.
--   · NO crea tablas ni funciones. No cambia el comportamiento de ninguna
--     escuela: todos los defaults son «apagado» (avisos '{}', topes NULL).
--   · NO enciende nada para Dreamers: activar sus avisos es un UPDATE aparte, con
--     el visto bueno de la escuela (ver el final de este archivo).
-- =============================================================================

BEGIN;

-- 1. Ajustes por escuela --------------------------------------------------------
-- Escalones de aviso de saldo, como PORCENTAJE de horas que le queda al atleta
-- (p. ej. {50,20,0}). '{}' = sin avisos. El BFF valida que cada valor esté entre
-- 0 y 100 (un CHECK sobre un arreglo necesitaría subconsulta, que Postgres no
-- permite en un CHECK).
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS hour_bank_balance_notice_steps integer[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS hour_bank_balance_notice_email_enabled boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS hour_bank_overage_auto_confirm_max_hours numeric NULL,
    ADD COLUMN IF NOT EXISTS hour_bank_overage_auto_confirm_max_amount numeric NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_settings_overage_auto_max_hours_pos') THEN
        ALTER TABLE public.school_settings
            ADD CONSTRAINT school_settings_overage_auto_max_hours_pos
            CHECK (hour_bank_overage_auto_confirm_max_hours IS NULL OR hour_bank_overage_auto_confirm_max_hours > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_settings_overage_auto_max_amount_pos') THEN
        ALTER TABLE public.school_settings
            ADD CONSTRAINT school_settings_overage_auto_max_amount_pos
            CHECK (hour_bank_overage_auto_confirm_max_amount IS NULL OR hour_bank_overage_auto_confirm_max_amount > 0);
    END IF;
END
$$;

COMMENT ON COLUMN public.school_settings.hour_bank_balance_notice_steps IS
    'Escalones (% de horas restantes) en los que se avisa el saldo del banco de horas, p. ej. {50,20,0}. {} = sin avisos.';
COMMENT ON COLUMN public.school_settings.hour_bank_balance_notice_email_enabled IS
    'true = los avisos de saldo también salen por correo (push/in-app salen siempre que haya escalones).';
COMMENT ON COLUMN public.school_settings.hour_bank_overage_auto_confirm_max_hours IS
    'Tope de horas de un excedente que se confirma solo. NULL = sin confirmación automática por horas. Se exigen TODOS los topes definidos.';
COMMENT ON COLUMN public.school_settings.hour_bank_overage_auto_confirm_max_amount IS
    'Tope de valor ($) de un excedente que se confirma solo. NULL = sin confirmación automática por valor. Se exigen TODOS los topes definidos.';

-- 2. Marca «ya avisé» por período ----------------------------------------------
-- {"50": "2026-10-12T15:04:05Z", "20": "..."}: escalón -> cuándo se avisó. Si el saldo
-- vuelve a subir por encima del umbral (recarga) el BFF borra ese escalón y una
-- segunda bajada avisa de nuevo.
ALTER TABLE public.hour_bank_periods
    ADD COLUMN IF NOT EXISTS balance_notices jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.hour_bank_periods.balance_notices IS
    'Escalones de aviso de saldo ya enviados en este período: {"escalón%": "fecha ISO"}.';

COMMIT;

-- =============================================================================
-- DESPUÉS de aplicar (NO va dentro de la migración; solo con el visto bueno de Dreamers):
--   -- encender los avisos de Dreamers (50 %, 20 % y 0 %):
--   -- UPDATE public.school_settings
--   --    SET hour_bank_balance_notice_steps = '{50,20,0}'
--   --  WHERE school_id = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
-- Verificación sugerida (por nombre de objeto, sin listar el catálogo):
--   select column_name, data_type, column_default from information_schema.columns
--    where table_name = 'school_settings' and column_name like 'hour_bank_%notice%';
--   select column_name, data_type from information_schema.columns
--    where table_name = 'hour_bank_periods' and column_name = 'balance_notices';
-- =============================================================================
