-- =============================================================================
-- 20260910082720_limpiar_pausas_vencidas_en_cron_de_vencimiento.sql
-- Autor: brylop   Fecha: 2026-09-10   Versión anterior: 20260910082323
-- Objetivo: fix de la Fase 1 de docs/specs/pausa-vacaciones-enrollments.md.
--
-- APLICADA EN LA BASE 2026-09-10 vía `apply_migration`.
-- =============================================================================
--
-- EL BUG
--
-- `enrollments.paused_reason` se setea al aprobar la pausa y solo se limpia en
-- `resume_enrollment`. Cuando la pausa termina **sola** (pasa el último mes y
-- nadie toca el botón de reactivar), la columna queda pegada para siempre.
--
-- Y `fn_expire_overdue_enrollments` (cron diario, 08:00 UTC / 03:00 COT)
-- excluye pausados con `AND e.paused_reason IS NULL`. O sea: la primera
-- inscripción que completara una pausa natural quedaba **exenta del
-- vencimiento de por vida**.
--
-- Hoy no hay ninguna pausa viva (`pause_enabled = false` en las 368 escuelas),
-- así que el bug no alcanzó a tocar datos — pero se disparaba con la primera
-- escuela que prendiera el flag.
--
-- EL ARREGLO
--
-- La misma función, antes de vencer, limpia las pausas cuya ventana ya pasó. Va
-- ahí y no en un cron nuevo porque es el mismo dominio, el mismo horario y el
-- mismo único consumidor de la columna: un segundo cron sería una pieza más que
-- mantener sincronizada.
--
-- Se limpia contra `paused_until` —que `pause_aplicar` setea al primer día del
-- mes SIGUIENTE al último mes pausado, en hora Colombia— y no contra la vista:
-- es la misma tabla que se está actualizando, y así se evita el join.
--
-- **No borra historia.** La solicitud sigue en `enrollment_pause_requests` con
-- su `status='approved'` y sus meses, que es lo que decide el cobro. Limpiar las
-- columnas de `enrollments` solo apaga el estado VIGENTE, que es justo lo que
-- dejó de ser cierto.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_expire_overdue_enrollments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_count       integer;
  v_despausadas integer;
  v_today_col   date;
BEGIN
  v_today_col := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date;

  -- 1. Pausas que ya terminaron solas: se apaga el estado vigente para que la
  --    inscripción vuelva a ser candidata a vencimiento (y para que la UI no
  --    la muestre en pausa). La historia queda en enrollment_pause_requests.
  UPDATE enrollments e
  SET paused_reason    = NULL,
      paused_at        = NULL,
      paused_until     = NULL,
      paused_by        = NULL,
      pause_request_id = NULL,
      updated_at       = now()
  WHERE e.paused_reason IS NOT NULL
    AND e.paused_until IS NOT NULL
    AND (e.paused_until AT TIME ZONE 'America/Bogota')::date <= v_today_col;

  GET DIAGNOSTICS v_despausadas = ROW_COUNT;

  -- 2. Vencimiento, igual que antes (D1: grace de la escuela + 7 días).
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
      + 7
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
    'success',     true,
    'expired',     v_count,
    'despausadas', v_despausadas,
    'ran_at',      now(),
    'date_used',   v_today_col
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_expire_overdue_enrollments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_expire_overdue_enrollments() TO service_role;

COMMENT ON FUNCTION public.fn_expire_overdue_enrollments() IS
  'Cron expire-overdue-enrollments (08:00 UTC / 03:00 COT). Dos pasos: (1) limpia enrollments.paused_* de las pausas cuya ventana ya paso — sin esto la columna quedaba pegada para siempre cuando la pausa terminaba sola y la inscripcion nunca mas vencia; (2) cancela active -> cancelled cuando expires_at + payment_grace_days + 7 dias de ventana < hoy (Colombia), salvo pausados y salvo la excepcion de sesiones agotables. La historia de pausas vive en enrollment_pause_requests y es la que decide el cobro; estas columnas solo reflejan el estado vigente.';

COMMIT;
