-- =============================================================================
-- 20260902181550_reactivar_cron_expire_overdue_enrollments.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902181143
-- Objetivo: reactivar el cron `expire-overdue-enrollments` (job_id 2, 08:00
-- UTC / 03:00 COT), pausado el 2026-09-02 en la migración `20260902172435`
-- mientras se resolvían Bloqueador A y B — docs/specs/vigencia-cobranza-y-sesiones-unificado.md.
--
-- Checklist antes de reactivar (todo verificado hoy mismo, 2026-09-02):
--   - Bloqueador A: fn_expire_overdue_enrollments respeta payment_grace_days
--     + ventana de 7 días + excluye pausados (migración 20260902171932).
--   - Bloqueador B: trigger dispara en INSERT y UPDATE, las 3 rutas de cobro
--     (QR/efectivo-manual/autopay) setean offering_plan_id (migración
--     20260902174423).
--   - Backfill de las 135 inscripciones ya afectadas: 72 no ambiguas +
--     15 Dynasty + 8 resto (MMA Blair Team/Academia Superior/Escuela Demo) —
--     migraciones 20260902175555, 20260902180236, 20260902181143. Con guarda
--     GREATEST (nunca baja un expires_at ya bueno).
--   - Auditado: 58 inscripciones activas siguen pasadas de la ventana de
--     gracia+7 en toda la plataforma. 16 comparten expires_at=2026-08-05
--     (15 Dynasty + 1 GYM RM) — investigado: NO es un bug, es un lote de
--     inscripción masiva de Dynasty (2026-07-06, mismo minuto de creación)
--     que nunca pagó ni renovó. Candidatas legítimas a cancelar, igual que
--     el resto de las 58.
--
-- Decisión del usuario 2026-09-02: reactivar ahora.
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
  active := true
);

COMMIT;
