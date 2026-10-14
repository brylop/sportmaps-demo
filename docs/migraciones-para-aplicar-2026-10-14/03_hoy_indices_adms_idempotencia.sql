-- 03_hoy — las 3 de hoy: índices (duplicados + parciales), RPC adms_poll de torniquetes, idempotencia de jobs.
-- El BFF funciona con o sin ellas; aplicarlas antes del deploy es lo ideal.
-- Generado 2026-10-14. Correr en el SQL Editor de Supabase, UN archivo a la vez, en orden.


-- ===== 20261014105158_indices_duplicados_y_parciales.sql =====
-- =============================================================================
-- 20261014105158_indices_duplicados_y_parciales.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013193011
-- Objetivo: bajar el Disk IO tras la caída del 2026-10-14 (~14 h sin base).
--   1) Borra 24 índices EXACTAMENTE duplicados (misma tabla, columnas, opclass,
--      expresión y predicado). Cada uno se mantiene en cada INSERT/UPDATE sin
--      servir a ninguna lectura que su gemelo no sirva: frenan toda escritura.
--      Regla por grupo: se conserva el que respalda una constraint o es UNIQUE;
--      si no hay, el de más idx_scan (pg_stat_user_indexes, 2026-10-14).
--   2) Crea dos índices parciales para consultas de jobs que hacían seq scan
--      cada minuto ×3 BFF.
-- Sin CONCURRENTLY: la migración corre en transacción y las tablas son chicas.
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

-- ─── 1. Duplicados exactos ──────────────────────────────────────────────────
-- Formato: DROP <borrado>  -- se queda <gemelo> (motivo)

-- payments
DROP INDEX IF EXISTS public.idx_payments_child_id;          -- se queda idx_payments_child (493k scans)
DROP INDEX IF EXISTS public.idx_transactions_child;         -- se queda idx_payments_child (493k scans)
DROP INDEX IF EXISTS public.idx_payments_school_id;         -- se queda idx_transactions_school (27.9k scans)

-- children
DROP INDEX IF EXISTS public.idx_children_parent_id;         -- se queda idx_children_parent (136k scans)
DROP INDEX IF EXISTS public.idx_children_school_id;         -- se queda idx_children_school (53.8k scans)

-- products
DROP INDEX IF EXISTS public.idx_products_school_id;         -- se queda idx_products_school (173 scans)

-- events (ambos con 0 scans)
DROP INDEX IF EXISTS public.idx_events_event_date;          -- se queda idx_events_date

-- school_members
DROP INDEX IF EXISTS public.idx_school_members_composite;   -- se queda idx_school_members_composite_lookup (1.7M scans)

-- attendance_records
DROP INDEX IF EXISTS public.idx_attendance_records_date;    -- se queda idx_attendance_date (6.9k scans)

-- attendance_sessions
DROP INDEX IF EXISTS public.idx_attendance_sessions_facility_availability; -- se queda idx_attendance_sessions_unique_facility_slot (UNIQUE)

-- user_favorites
DROP INDEX IF EXISTS public.idx_favorites_user_id;          -- se queda idx_user_favorites_user (283 scans)
DROP INDEX IF EXISTS public.idx_favorites_school_id;        -- se queda idx_user_favorites_school (158 scans)

-- Duplicados de un índice que respalda constraint UNIQUE: se queda la constraint.
DROP INDEX IF EXISTS public.idx_school_referrals_code;      -- se queda school_referrals_referral_code_key
DROP INDEX IF EXISTS public.idx_payment_links_token;        -- se queda payment_links_token_key
DROP INDEX IF EXISTS public.idx_payment_splits_epayco_ref;  -- se queda payment_splits_epayco_ref_key
DROP INDEX IF EXISTS public.idx_certs_folio;                -- se queda athlete_certificates_folio_key
DROP INDEX IF EXISTS public.idx_join_qr_slug;               -- se queda school_join_qr_codes_slug_key
DROP INDEX IF EXISTS public.idx_vendor_profiles_user_id;    -- se queda vendor_profiles_user_id_key
DROP INDEX IF EXISTS public.idx_product_categories_slug;    -- se queda product_categories_slug_key
DROP INDEX IF EXISTS public.idx_product_brands_slug;        -- se queda product_brands_slug_key
DROP INDEX IF EXISTS public.idx_vendor_balances_vendor;     -- se queda vendor_balances_vendor_profile_id_key
DROP INDEX IF EXISTS public.idx_wa_messages_wa_id;          -- se queda uq_wa_message_wamid
DROP INDEX IF EXISTS public.idx_wa_ident_contact;           -- se queda uq_wa_ident
DROP INDEX IF EXISTS public.idx_zk_user_mappings_school_pin; -- se queda zk_user_mappings_school_id_zk_pin_key
DROP INDEX IF EXISTS public.idx_athlete_report_snapshots_report; -- se queda athlete_report_snapshots_unique_version

-- ─── 2. Índices parciales para jobs ─────────────────────────────────────────

-- Claim de comandos ZKTeco en el BFF:
--   UPDATE device_commands … WHERE school_id = $1 AND command_type IN (…)
--     AND status = 'pending' AND claimed_at IS NULL AND expires_at > now()
-- ~390k llamadas, todas seq scan.
CREATE INDEX IF NOT EXISTS idx_device_commands_claim_pendiente
    ON public.device_commands (school_id, command_type)
    WHERE status = 'pending' AND claimed_at IS NULL;

-- Barrido de avisos rechazados por Meta (whatsapp-payment-outcome).
CREATE INDEX IF NOT EXISTS idx_wa_messages_outbound_failed
    ON public.whatsapp_messages (created_at)
    WHERE direction = 'outbound' AND status = 'failed';

COMMIT;

-- ===== 20261014105210_adms_getrequest_rpc.sql =====
-- =============================================================================
-- 20261014105210_adms_getrequest_rpc.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014105158
-- Objetivo: colapsar en UNA llamada las tres que hace cada sondeo de
--   GET /iclock/getrequest (los ZKTeco preguntan cada ~10 s):
--     1. PATCH turnstile_devices.last_seen_at      (~1,4 M llamadas)
--     2. SELECT device_commands pendientes          (~860 k)
--     3. PATCH device_commands → 'expired'          (~525 k)
--   public.adms_poll() hace las tres en una transacción y devuelve los
--   comandos pendientes, con la MISMA semántica que el camino viejo:
--     · pendientes = device_id, status='pending', expires_at > now(),
--       ORDER BY issued_at ASC, LIMIT p_limit (5 desde el BFF).
--     · p_exclude_types: el BFF manda ['open_door'] cuando el lector tiene
--       bridge local (has_local_bridge) — ese comando lo ejecuta
--       GET /bridge/door-commands; si saliera por ADMS el F22ID lo marcaría
--       'executed' en falso (VALIDACION-2026-08-25.md, hallazgo 1).
--     · expirar = device_id, status='pending', expires_at < now().
--   Diferencia deliberada: last_seen_at solo se escribe si tiene más de 30 s
--   (o es NULL). Lectores: AccessControlPage (en línea = < 5 min) y
--   alert_offline_access_devices() (15 min). 30 s no cambia ninguno y quita
--   ~2/3 de las escrituras del sondeo.
--   Solo la llama el BFF (service_role). Si no está aplicada, el BFF cae al
--   camino viejo de tres llamadas (PGRST202 / 42883), así que el orden de
--   despliegue código/migración no importa.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.adms_poll(
  p_device_id     uuid,
  p_limit         int    DEFAULT 5,
  p_exclude_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  cmd_seq      bigint,
  command_type text,
  metadata     jsonb
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- 1. Latido (throttled a 30 s).
  UPDATE public.turnstile_devices td
     SET last_seen_at = now()
   WHERE td.id = p_device_id
     AND (td.last_seen_at IS NULL OR td.last_seen_at < now() - interval '30 seconds');

  -- 2. Expirar vencidos (mismo filtro que el PATCH viejo: estricto <).
  UPDATE public.device_commands dc
     SET status = 'expired'
   WHERE dc.device_id = p_device_id
     AND dc.status = 'pending'
     AND dc.expires_at < now();

  -- 3. Pendientes vigentes, en orden de emisión.
  RETURN QUERY
  SELECT dc.id, dc.cmd_seq, dc.command_type, dc.metadata
    FROM public.device_commands dc
   WHERE dc.device_id = p_device_id
     AND dc.status = 'pending'
     AND dc.expires_at > now()
     AND (p_exclude_types IS NULL OR NOT (dc.command_type = ANY (p_exclude_types)))
   ORDER BY dc.issued_at ASC
   LIMIT GREATEST(COALESCE(p_limit, 5), 0);
END;
$$;

COMMENT ON FUNCTION public.adms_poll(uuid, int, text[]) IS
  'Sondeo ADMS (GET /iclock/getrequest): latido last_seen_at (máx. 1 escritura/30 s), expira comandos vencidos y devuelve los pendientes. Solo service_role (BFF).';

REVOKE ALL ON FUNCTION public.adms_poll(uuid, int, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adms_poll(uuid, int, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.adms_poll(uuid, int, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.adms_poll(uuid, int, text[]) TO service_role;

COMMIT;

-- ===== 20261014105326_idempotencia_jobs_concurrentes.sql =====
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

-- Registro en schema_migrations (no cambia objetos).
BEGIN;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261014105158', '20261014105158_indices_duplicados_y_parciales', 'sql-editor 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261014105210', '20261014105210_adms_getrequest_rpc', 'sql-editor 2026-10-14') on conflict (version) do nothing;
insert into supabase_migrations.schema_migrations (version, name, created_by) values ('20261014105326', '20261014105326_idempotencia_jobs_concurrentes', 'sql-editor 2026-10-14') on conflict (version) do nothing;
COMMIT;
