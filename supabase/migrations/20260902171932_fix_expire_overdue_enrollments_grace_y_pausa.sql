-- =============================================================================
-- 20260902171932_fix_expire_overdue_enrollments_grace_y_pausa.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902171545
-- Objetivo: Fase 1 de docs/specs/cobranza-vencidos-estados-y-alertas.md §4.1/§4.2.
-- Decisión de producto D1 confirmada con el usuario 2026-09-02: híbrido — sigue
-- cancelando automático, pero da 7 días de ventana (mismo umbral que el aviso
-- overdue_7d de la escalera de cobranza) antes de cerrar, en vez de cancelar el
-- día siguiente al vencimiento como hace hoy.
--
-- Dos cambios:
--   1. Agrega columnas de pausa a enrollments (schema únicamente — todavía no
--      hay UI que las setee; eso es un fase aparte, bloqueada por D4 del spec
--      sobre quién puede pedir la pausa). paused_reason queda NULL para el
--      100% de las filas hoy, así que su exclusión abajo es un no-op seguro.
--   2. Corrige fn_expire_overdue_enrollments: respeta school_settings.
--      payment_grace_days (mismo grace que ya usa apply_late_fees()) + 7 días
--      de ventana adicional, y excluye pausados.
--
-- Fuera de alcance a propósito: apply_late_fees() también debería excluir
-- pausados por el mismo spec, pero payments no tiene enrollment_id — habría
-- que matchear por identidad de atleta (mismo patrón que athleteFilter() en
-- bff/src/routes/attendance.ts), y esa función aplica recargos reales de
-- dinero a las 368 escuelas. Se deja para cuando exista la UI de pausa (nadie
-- puede pausar todavía, así que hoy tampoco hay nada que excluir ahí).
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

-- §4.1 — columnas de pausa (lo único que genuinamente no existe). No se toca
-- `status`: la pausa es una propiedad de la vigencia, no del ciclo de vida de
-- la inscripción (enroll_status sigue siendo 'active').
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS paused_reason text
      CHECK (paused_reason IN ('injury', 'vacation', 'other')),
  ADD COLUMN IF NOT EXISTS paused_at     timestamptz,
  ADD COLUMN IF NOT EXISTS paused_until  timestamptz;

COMMENT ON COLUMN public.enrollments.paused_reason IS
    'NULL = no pausada. Sin UI que la setee todavía (bloqueado por decisión D4 del spec de cobranza: ¿quién puede pedir la pausa?) — hoy es 100% NULL. fn_expire_overdue_enrollments ya la excluye.';

-- §4.2 — fix del bloqueador crítico, con D1 = híbrido (7 días de ventana).
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
  v_today_col := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date;

  UPDATE enrollments e
  SET
    status     = 'cancelled',
    updated_at = now()
  WHERE
    e.status     = 'active'
    AND e.expires_at IS NOT NULL
    AND e.paused_reason IS NULL
    AND (
      e.expires_at
      + COALESCE(
          (SELECT ss.payment_grace_days FROM public.school_settings ss WHERE ss.school_id = e.school_id),
          0
        )
      + 7   -- D1: ventana de aviso antes del cierre automático (mismo umbral que overdue_7d)
    ) < v_today_col
    AND NOT (
      e.offering_plan_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.offering_plans op
        WHERE op.id = e.offering_plan_id
          AND op.max_sessions IS NOT NULL
          AND COALESCE(e.sessions_used, 0) < op.max_sessions
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
    'Cancela active -> cancelled cuando expires_at + payment_grace_days + 7 días de ventana < hoy (Colombia), salvo pausados y salvo la excepción de sesiones agotables. D1 confirmado 2026-09-02: híbrido — sigue siendo automático, pero con 7 días de margen tras el grace period antes de cerrar (antes: cero gracia, cancelaba al día siguiente del vencimiento). Cron expire-overdue-enrollments, 08:00 UTC (03:00 COT). apply_late_fees() sigue sin excluir pausados — ver nota al inicio de esta migración.';

COMMIT;
