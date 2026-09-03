-- =============================================================================
-- 20260902172435_pausar_cron_expire_overdue_enrollments_hasta_bloqueador_b.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902171932
-- Objetivo: pausar el cron `expire-overdue-enrollments` (job_id 2, corre
-- 08:00 UTC / 03:00 COT) por decisión explícita del usuario 2026-09-02.
--
-- Motivo: al medir el radio del fix de grace period (migración 20260902171932,
-- "Bloqueador A" del spec unificado docs/specs/vigencia-cobranza-y-sesiones-unificado.md
-- §3.1) se encontraron en vivo 3 inscripciones activas de familias que SÍ
-- pagaron, pero que `trg_extend_enrollment_on_payment_paid` nunca extendió por
-- el bug ya documentado como "Bloqueador B" (§3.2 del mismo spec — el trigger
-- no dispara en pago por QR, registro manual en efectivo, ni autopay). Esas 3
-- llevan MESES vencidas (no días), así que ya están más allá de la ventana de
-- 7 días del fix de grace — el cron de esta noche las habría cancelado igual.
--
-- El spec ya advertía esto en §3.3: "Orden obligatorio: arreglar B antes que
-- A, o el fix de A solo pospone el problema". Se construyó A primero de todos
-- modos (ver nota en el spec, sección Fase 2) porque ya estaba en curso al
-- descubrirse el problema de orden. En vez de apurar el fix de B (que tiene
-- una decisión de diseño sin resolver, D5 del spec, y toca 3 rutas de pago en
-- vivo), el usuario eligió pausar el cron entero hasta resolver B con calma.
--
-- REACTIVAR cuando Bloqueador B (Fase 1 del spec unificado) esté construido —
-- hasta entonces NINGUNA inscripción se cancela automáticamente por vigencia
-- vencida, ni las genuinamente impagas. No es gratis: hay que vigilar cartera
-- vencida por otro medio (OverdueAccountsCard, badge de asistencia) mientras
-- tanto — ya lo hacían, pero ahora es la ÚNICA red.
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

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'expire-overdue-enrollments'),
  active := false
);

COMMIT;
