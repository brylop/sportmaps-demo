-- =============================================================================
-- 20260905111458_access_auto_block_overdue.sql
-- Autor: judegor99   Fecha: 2026-09-05   Versión anterior: 20260905105310
-- Objetivo: feature flag por escuela para automatizar el bloqueo físico en el
-- torniquete de quien tiene un pago vencido (payments.status='overdue') —
-- mismo mecanismo ya probado en campo en GYM RM (set_group / "Grp=2" nativo
-- del lector, un segundo horario sin horas permitidas), hoy 100% manual vía
-- POST /api/v1/access/set-access-group.
--
-- Por qué payments.status y no enrollments.expires_at: la señal de expires_at
-- vive detrás de fn_expire_overdue_enrollments (sin versionar, cancela sin
-- respetar payment_grace_days) y de un trigger de reactivación con un punto
-- ciego de 77 inscripciones (docs/specs/vigencia-cobranza-y-sesiones-unificado.md
-- §1.7/§2) — automatizar un bloqueo FÍSICO sobre esa señal hereda el riesgo de
-- dejar a alguien bloqueado en la puerta después de haber pagado. payments.status
-- ya respeta el grace period vía apply_late_fees() y el UPDATE a 'paid' se
-- escribe directo en las 3 rutas de cobro que tienen el bug de expires_at, así
-- que no hereda ese punto ciego.
--
-- Opt-in por escuela (default false), mismo patrón que hours_plan_enabled/
-- late_fee_enabled: bloquear físicamente a un cliente es de alto impacto,
-- ninguna escuela debería activarlo sin decidirlo. Se activa acá mismo para
-- Dreamers Gymnastics como piloto (school_id confirmado con el usuario).
-- El job que reconcilia (bff/src/jobs/access-auto-block.job.ts) hace
-- SELECT + INSERT sobre tablas ya cubiertas por RLS de service_role — no
-- necesita RPC nueva.
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
  ADD COLUMN IF NOT EXISTS access_auto_block_overdue_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.access_auto_block_overdue_enabled IS
  'Feature flag: si es true, el job access-auto-block (cada 15 min) bloquea '
  'automáticamente en el torniquete (set_group, Grp=2) a quien tenga un pago '
  'con status=overdue, y desbloquea (Grp=1) apenas deje de tenerlo. Requiere '
  'zk_user_mappings poblado y turnstile_devices activos en la escuela — sin '
  'eso el job no encuentra a quién bloquear y no hace nada. Default false: '
  'opt-in explícito por escuela, mismo criterio que hours_plan_enabled/'
  'late_fee_enabled — bloquear físicamente a un cliente es de alto impacto.';

-- Piloto: Dreamers Gymnastics (torniquetes ZKTeco activos + banco de horas ya
-- validado en esta misma escuela — confirmado con el usuario 2026-09-05).
UPDATE public.school_settings
   SET access_auto_block_overdue_enabled = true
 WHERE school_id = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';

COMMIT;

NOTIFY pgrst, 'reload schema';
