-- =============================================================================
-- 20260821112428_adms_device_ip_check_mode.sql
-- Autor: brylop   Fecha: 2026-08-21   Versión anterior: 20260820125510
-- Objetivo: agrega turnstile_devices.ip_check_mode ('off'|'warn'|'enforce') para
-- migrar el allowlist de IP del protocolo ADMS (/iclock) de un único env var
-- global en Render (ACCESS_DEVICE_IP_ALLOWLIST) a un control POR DISPOSITIVO,
-- usando la columna ip_address que YA EXISTE (y ya es editable por escuela
-- desde AccessControlPage.tsx). Ver docs/specs/adms-ip-allowlist-per-device.md.
--
-- DEFAULT 'off' en todas las filas (incl. las 6 existentes): el código que lee
-- esta columna cae al comportamiento actual (env var global) cuando está en
-- 'off'. Esta migración NO cambia el comportamiento de ningún dispositivo real
-- por sí sola — solo prepara la columna. Activar 'warn'/'enforce' es un paso
-- manual posterior, por escuela, después de verificar su IP pública real.
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
  ADD COLUMN ip_check_mode text NOT NULL DEFAULT 'off'
    CHECK (ip_check_mode IN ('off', 'warn', 'enforce'));

COMMENT ON COLUMN public.turnstile_devices.ip_check_mode IS
  'off = sin chequeo (fallback a ACCESS_DEVICE_IP_ALLOWLIST global). '
  'warn = compara ip_address vs IP real del request y solo loguea/registra '
  'mismatch en adms_device_log, no bloquea. enforce = igual que warn pero '
  'responde 403 si no matchea. Ver docs/specs/adms-ip-allowlist-per-device.md '
  'antes de pasar cualquier device a warn/enforce — hay que confirmar primero '
  'que ip_address tenga la IP PÚBLICA real (no una IP de LAN 192.168.x.x).';

-- Backfill explícito (redundante con el DEFAULT, pero deja constancia en el
-- historial de que las 6 filas existentes a esta fecha quedaron auditadas y
-- puestas en 'off' a propósito, no por omisión).
UPDATE public.turnstile_devices SET ip_check_mode = 'off';

COMMIT;
