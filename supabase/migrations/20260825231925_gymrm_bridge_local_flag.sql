-- =============================================================================
-- 20260825231925_gymrm_bridge_local_flag.sql
-- Autor: judegor99   Fecha: 2026-08-26   Versión anterior: 20260821141913
-- Objetivo: marcar qué turnstile_devices tienen un bridge local (pyzk) que
--   resuelve la apertura física por fuera de ADMS, para que `getrequest`
--   deje de mandarles `CONTROL DEVICE` (comando que el F22ID acepta con
--   Return:0 pero no ejecuta físicamente — ver scripts/gymrm-door-bridge/).
--   Sin este flag, ADMS puede marcar `open_door` como `executed` en falso
--   antes de que el bridge llegue a reclamarlo. Ver INF-12 en docs/ROADMAP.md.
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

ALTER TABLE public.turnstile_devices
  ADD COLUMN IF NOT EXISTS has_local_bridge boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.turnstile_devices.has_local_bridge IS
  'true = hay un script local (SDK pyzk, red LAN del gym) atendiendo este '
  'dispositivo para open_door. getrequest en access-adms.ts no debe mandarle '
  'CONTROL DEVICE por ADMS en ese caso: el firmware lo acepta (Return:0) pero '
  'no mueve el relé, y marcarlo executed sin abrir la puerta es peor que no '
  'entregarlo. No afecta enroll_user/delete_user/set_group/reboot/set_drive_time '
  '-- esos siguen siempre por ADMS, funcionan bien hoy.';

-- GYM RM: los dos lectores confirmados en la sesión de validación 2026-08-25
-- (JJA1254900899 entrada / JJA1254900898 salida) ya tienen door_bridge.py
-- instalable. No se activa por school_id completo a propósito: si mañana se
-- suma un tercer dispositivo a la escuela sin bridge propio, no hereda esto.
UPDATE public.turnstile_devices
   SET has_local_bridge = true
 WHERE serial_number IN ('JJA1254900899', 'JJA1254900898');

-- ─── Reclamo atómico para /bridge/door-commands ──────────────────────────────
-- No se reutiliza el valor 'claimed' sobre `status` porque no hay certeza de
-- que exista o no un CHECK constraint vivo sobre esa columna (no aparece en
-- ningún archivo de este historial de migraciones -- pudo agregarse a mano
-- en el SQL editor de Supabase, el mismo patrón que ya denuncia INF-7). Una
-- columna nueva evita esa duda por completo: no toca el significado de
-- `status`, así que ningún filtro existente (`getrequest`, `/overdue`, etc.)
-- que compara `status` cambia de comportamiento.
ALTER TABLE public.device_commands
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

COMMENT ON COLUMN public.device_commands.claimed_at IS
  'Sellado por GET /bridge/door-commands al reclamar un open_door pendiente '
  'para ejecutarlo por SDK local (pyzk). NULL = no reclamado todavia. '
  'Independiente de `status`, que sigue siendo pending hasta el ack real.';

COMMIT;
