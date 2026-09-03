-- =============================================================================
-- 20260902112738_absence_events_no_show_and_threshold.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902110253
-- Objetivo: piezas de esquema para la Pieza D del spec de asistencia
-- (docs/specs/asistencia-rapida-checkin.md §4 — ausencia como evento):
--   1. `check_in_method` admite 'no_show' — hoy el CHECK solo dejaba
--      'manual'|'turnstile'|'qr'; un registro de ausencia generado por el
--      sistema (no por nadie escaneando ni tildando) necesita su propio valor.
--   2. `school_settings.absence_alert_threshold` — cuántas ausencias
--      consecutivas antes de escalar al admin (D3 del spec: default 2,
--      configurable, nunca sin default — mismo argumento que ya se usó para
--      `coach_attendance_teams_only`: un setting sin default es un setting
--      apagado para siempre).
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

ALTER TABLE public.attendance_records
    DROP CONSTRAINT IF EXISTS attendance_records_check_in_method_check;

ALTER TABLE public.attendance_records
    ADD CONSTRAINT attendance_records_check_in_method_check
    CHECK (check_in_method = ANY (ARRAY['manual'::text, 'turnstile'::text, 'qr'::text, 'no_show'::text]));

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS absence_alert_threshold int NOT NULL DEFAULT 2
        CHECK (absence_alert_threshold > 0);

COMMENT ON COLUMN public.school_settings.absence_alert_threshold IS
    'Ausencias consecutivas de un atleta antes de escalar aviso al admin de la escuela (pieza D del spec de asistencia). Default 2.';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'attendance_records_check_in_method_check';
SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'school_settings' AND column_name = 'absence_alert_threshold';
