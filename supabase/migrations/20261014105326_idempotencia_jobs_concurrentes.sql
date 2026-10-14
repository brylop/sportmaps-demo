-- =============================================================================
-- 20261014105326_idempotencia_jobs_concurrentes.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014105210
-- Objetivo: que los crons que corren a la vez en los 3 BFF (dev/stg/prod, una
-- sola base) no dupliquen efectos.
--
--   1. device_commands: índice ÚNICO parcial sobre los comandos de bloqueo por
--      mora PENDIENTES que emite el job (issued_by IS NULL). El job
--      access-auto-block inserta y trata el 23505 como «ya lo encoló otra
--      instancia». En vivo (45 días): 22 grupos de disable_user ×3 y 150 de
--      set_group ×2 en el mismo minuto.
--      · Solo los tipos de bloqueo (set_group / disable_user / enable_user) y
--        solo issued_by IS NULL: open_door, enroll_user, set_drive_time y los
--        comandos MANUALES (issued_by = admin) pueden repetirse legítimamente y
--        no los toca — ninguna ruta de usuario puede recibir un 23505 nuevo.
--      · Clave: (device_id, command_type, pin, group). `group` va con COALESCE
--        porque en disable/enable_user no existe y NULL no colisiona en UNIQUE.
--   2. athlete_reports.send_claimed_at: reclamo con lease del envío del
--      Informe Mensual (report-delivery.service.ts). Sin esto, dos procesos
--      leían los mismos informes con sent_at NULL y mandaban el correo 2–3×.
--
-- bridge_heartbeats no necesita DDL: el reclamo es un UPDATE condicional sobre
-- alerted_at IS NULL en el BFF.
-- =============================================================================

BEGIN;

-- ── 1a. Limpiar pendientes muertos antes de crear el índice ──────────────────
-- Vencidos: mismo criterio que adms_poll / el GET /iclock/getrequest (estricto <).
-- En vivo al 2026-10-14: 46 set_group pendientes del job, todos vencidos
-- (2026-08-16 → 2026-09-16), 30 claves distintas → 16 duplicados. No se borra
-- nada: quedan como 'expired' (estado ya permitido por el CHECK).
UPDATE public.device_commands
   SET status = 'expired'
 WHERE status = 'pending'
   AND expires_at < now();

-- Duplicados vigentes que pudieran quedar (carrera entre instancias): se
-- conserva el más antiguo por clave; el resto pasa a 'expired'.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY device_id, command_type,
                        (metadata ->> 'pin'), COALESCE(metadata ->> 'group', '')
           ORDER BY issued_at ASC NULLS LAST, cmd_seq ASC NULLS LAST, id
         ) AS rn
    FROM public.device_commands
   WHERE status = 'pending'
     AND issued_by IS NULL
     AND command_type IN ('set_group', 'disable_user', 'enable_user')
)
UPDATE public.device_commands dc
   SET status = 'expired',
       error_message = 'duplicado por crons concurrentes (20261014105326)'
  FROM ranked r
 WHERE dc.id = r.id
   AND r.rn > 1;

-- ── 1b. Índice único parcial ─────────────────────────────────────────────────
-- La tabla es chica (pendientes ~0 tras la limpieza); sin CONCURRENTLY porque
-- va dentro de la transacción.
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_commands_bloqueo_job_pendiente
    ON public.device_commands (
        device_id,
        command_type,
        (metadata ->> 'pin'),
        (COALESCE(metadata ->> 'group', ''))
    )
 WHERE status = 'pending'
   AND issued_by IS NULL
   AND command_type IN ('set_group', 'disable_user', 'enable_user');

COMMENT ON INDEX public.uq_device_commands_bloqueo_job_pendiente IS
  'Un solo comando de bloqueo por mora PENDIENTE por (lector, tipo, PIN, grupo) emitido por el job (issued_by NULL). Los 3 BFF corren el cron a la vez: el 23505 = ya lo encoló otra instancia. Ver access-auto-block.job.ts.';

-- ── 2. Lease del envío del Informe Mensual ───────────────────────────────────
ALTER TABLE public.athlete_reports
  ADD COLUMN IF NOT EXISTS send_claimed_at timestamptz;

COMMENT ON COLUMN public.athlete_reports.send_claimed_at IS
  'Reclamo (lease) del envío por correo: lo sella el proceso que va a mandar el informe, solo si sent_at IS NULL y no hay otro reclamo vigente. Si el envío falla se libera (NULL); si el proceso muere, otro lo retoma al vencer el lease. sent_at sigue siendo la marca de «enviado».';

COMMIT;
