-- =============================================================================
-- 20260902171533_versionar_fn_expire_overdue_enrollments_drift.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902170826
-- Objetivo: sacar fn_expire_overdue_enrollments() del drift (vivía en la base,
-- corriendo desde antes de docs/specs/cobranza-vencidos-estados-y-alertas.md,
-- sin una sola CREATE FUNCTION en el repo). Fase 0 de ese spec: versionar SIN
-- cambiar comportamiento todavía — el fix real (grace period + exclusión de
-- pausados, §4.2) es la Fase 1, bloqueada por la decisión de producto D1
-- (¿sigue cancelando automático, o pasa a una bandeja humana?).
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

-- Cuerpo idéntico al que corre hoy en la base (verificado contra pg_proc antes
-- de escribir esta migración) — cero cambio de comportamiento a propósito.
CREATE OR REPLACE FUNCTION public.fn_expire_overdue_enrollments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_count      integer;
  v_today_col  date;
BEGIN
  -- Fecha actual en Colombia (UTC-5) — independiente de la zona del servidor
  v_today_col := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date;

  UPDATE enrollments
  SET
    status     = 'cancelled',
    updated_at = now()
  WHERE
    status     = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < v_today_col
    AND NOT (
      offering_plan_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM offering_plans op
        WHERE op.id = offering_plan_id
          AND op.max_sessions IS NOT NULL
          AND COALESCE(sessions_used, 0) < op.max_sessions
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',   true,
    'expired',   v_count,
    'ran_at',    now(),
    'date_used', v_today_col
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_expire_overdue_enrollments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_expire_overdue_enrollments() TO service_role;

COMMENT ON FUNCTION public.fn_expire_overdue_enrollments() IS
    'Cancela active -> cancelled cuando expires_at < hoy (Colombia), salvo excepción de sesiones agotables. BUG CONOCIDO, sin corregir en esta migración a propósito (ver docs/specs/cobranza-vencidos-estados-y-alertas.md §2 y §4.2): no respeta school_settings.payment_grace_days (apply_late_fees sí lo respeta — dos políticas de gracia distintas sobre el mismo concepto) y no excluye inscripciones pausadas (paused_reason no existe todavía). Cron expire-overdue-enrollments, 08:00 UTC (03:00 COT). El fix real es la Fase 1 del spec, bloqueada por la decisión de producto D1.';

COMMIT;
