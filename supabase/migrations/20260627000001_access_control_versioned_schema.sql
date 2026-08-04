-- ════════════════════════════════════════════════════════════════════════════
-- Control de Acceso ZKTeco (ADMS) — Esquema versionado + RLS + fixes
-- ════════════════════════════════════════════════════════════════════════════
-- Contexto: las tablas turnstile_devices, access_events, device_commands y
-- zk_user_mappings fueron creadas a mano en producción (RMGYM) y no eran
-- reproducibles (doc handoff #7). Esta migración las versiona de forma
-- idempotente, habilita RLS en zk_user_mappings (linter ERROR
-- rls_disabled_in_public) y agrega:
--   - device_commands.cmd_seq  -> ID corto para el F22 (evita truncado de UUID
--     que dejaba comandos en 'pending' reenviándose en loop infinito).
--   - índice único de dedup en access_events (frena el flood de ATTLOG).
--   - limpieza de comandos pending atascados.
--
-- Idempotente: CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS. No choca
-- con el esquema actual de producción.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Tablas (best-effort para ambientes frescos; skip en prod) ─────────────

CREATE TABLE IF NOT EXISTS public.turnstile_devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL,
  serial_number text NOT NULL,
  device_name   text,
  ip_address    text,
  port          integer,
  direction     text NOT NULL DEFAULT 'both',
  location      text,
  is_active     boolean NOT NULL DEFAULT true,
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT turnstile_devices_serial_school_uniq UNIQUE (school_id, serial_number)
);

CREATE TABLE IF NOT EXISTS public.zk_user_mappings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id               uuid NOT NULL,
  zk_pin                  integer NOT NULL,
  user_id                 uuid,
  unregistered_athlete_id uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zk_user_mappings_school_pin_uniq UNIQUE (school_id, zk_pin)
);

CREATE TABLE IF NOT EXISTS public.access_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id               uuid NOT NULL,
  device_id               uuid,
  user_id                 uuid,
  unregistered_athlete_id uuid,
  direction               text,
  access_granted          boolean NOT NULL DEFAULT false,
  denial_reason           text,
  check_in_method         text,
  zk_user_id              integer,
  raw_event               jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at             timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.device_commands (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL,
  device_id     uuid NOT NULL,
  command_type  text NOT NULL,
  direction     text,
  status        text NOT NULL DEFAULT 'pending',
  issued_by     uuid,
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  executed_at   timestamptz,
  error_message text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 2. Columnas que producción puede no tener todavía ────────────────────────

-- metadata ya fue agregada a mano en prod; idempotente por si falta en otro env.
ALTER TABLE public.device_commands
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- access_events: soporte de atletas no registrados (commits recientes).
ALTER TABLE public.access_events
  ADD COLUMN IF NOT EXISTS unregistered_athlete_id uuid;

-- ─── 3. cmd_seq: ID corto de comando para el F22 (fix loop infinito) ──────────
-- El F22 trunca el UUID que devuelve en /iclock/devicecmd (buffer fijo), por eso
-- el PATCH device_commands?id=eq.<uuid-truncado> daba 22P02/400 y el comando se
-- quedaba 'pending' reenviándose para siempre. Con un entero corto no se trunca.

CREATE SEQUENCE IF NOT EXISTS public.device_commands_cmd_seq;

ALTER TABLE public.device_commands
  ADD COLUMN IF NOT EXISTS cmd_seq bigint;

ALTER TABLE public.device_commands
  ALTER COLUMN cmd_seq SET DEFAULT nextval('public.device_commands_cmd_seq');

-- Backfill de filas existentes sin cmd_seq.
UPDATE public.device_commands
   SET cmd_seq = nextval('public.device_commands_cmd_seq')
 WHERE cmd_seq IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS device_commands_cmd_seq_idx
  ON public.device_commands (cmd_seq);

-- ─── 4. Dedup de ATTLOG (frena el flood de eventos repetidos) ─────────────────
-- NULLs son distintos en índices únicos => eventos manuales (zk_user_id NULL)
-- nunca colisionan; solo se deduplican los eventos reales del lector.

-- 4.a Limpiar duplicados PREEXISTENTES (el flood los generó) — si no, el
--     CREATE UNIQUE INDEX falla. Conserva una fila por combinación.
DELETE FROM public.access_events a
USING public.access_events b
WHERE a.device_id IS NOT NULL
  AND a.zk_user_id IS NOT NULL
  AND a.ctid < b.ctid
  AND a.device_id   = b.device_id
  AND a.zk_user_id  = b.zk_user_id
  AND a.occurred_at = b.occurred_at;

-- 4.b Índice único de dedup.
CREATE UNIQUE INDEX IF NOT EXISTS access_events_dedup_idx
  ON public.access_events (device_id, zk_user_id, occurred_at);

-- ─── 5. Limpieza de comandos pending atascados (corta el loop en vivo) ────────

UPDATE public.device_commands
   SET status = 'expired',
       error_message = COALESCE(error_message, 'Auto-expirado por migración 20260627000001 (loop de cmd ID truncado)')
 WHERE status = 'pending'
   AND issued_at < now() - interval '1 hour';

-- ─── 6. RLS en zk_user_mappings (linter ERROR rls_disabled_in_public) ─────────
-- El BFF usa service_role (bypassa RLS). Esta policy solo restringe el acceso
-- directo vía PostgREST: únicamente admins de la escuela. Usa el helper
-- SECURITY DEFINER existente check_is_school_admin (no auto-recursivo).

ALTER TABLE public.zk_user_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zk_user_mappings_admin_all ON public.zk_user_mappings;
CREATE POLICY zk_user_mappings_admin_all
  ON public.zk_user_mappings
  FOR ALL
  TO authenticated
  USING (public.check_is_school_admin(school_id))
  WITH CHECK (public.check_is_school_admin(school_id));

-- ─── 7. Reload del esquema para PostgREST ─────────────────────────────────────
NOTIFY pgrst, 'reload schema';
