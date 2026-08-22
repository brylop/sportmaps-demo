-- =============================================================================
-- 20260821201133_alerta_dispositivos_acceso_offline.sql
-- Autor: brylop   Fecha: 2026-08-22   Versión anterior: 20260821200453
-- Objetivo: alertar al owner de la escuela cuando un torniquete deja de
-- reportar (turnstile_devices.last_seen_at desactualizado). Hoy esto solo se
-- nota si alguien mira el panel de Access Control a mano — no hay aviso
-- proactivo. Nace del incidente de Dreamers Gymnastics 2026-08-21 (los 2
-- lectores dejaron de reportar ~30 min sin que nadie se enterara hasta que
-- alguien fue a revisar). Ver docs/specs/adms-ip-allowlist-per-device.md y
-- scripts/dreamers-bridge/README.md para el contexto completo del incidente.
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

-- last_alerted_at: para no reenviar la misma alerta en cada tick del cron
-- mientras el dispositivo sigue caído. Se resetea cuando el dispositivo
-- vuelve a reportar (last_seen_at avanza más allá de last_alerted_at),
-- así una caída nueva SÍ vuelve a alertar.
ALTER TABLE public.turnstile_devices
  ADD COLUMN last_alerted_at timestamptz;

COMMENT ON COLUMN public.turnstile_devices.last_alerted_at IS
  'Última vez que alert_offline_access_devices() notificó por este device.
   NULL o < last_seen_at => elegible para una alerta nueva si vuelve a caer.';

-- Umbral de "caído": 15 min sin reportar (3x el intervalo típico de
-- getrequest/heartbeat, ver bff/src/routes/access-adms.ts). Gracia de 30 min
-- desde la creación del device para no alertar sobre uno recién dado de alta
-- en el panel que todavía no fue instalado/conectado físicamente.
CREATE OR REPLACE FUNCTION public.alert_offline_access_devices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_alerted_count int := 0;
  v_device record;
  v_owner_id uuid;
BEGIN
  FOR v_device IN
    SELECT td.id, td.school_id, td.device_name, td.serial_number, td.last_seen_at
    FROM public.turnstile_devices td
    WHERE td.is_active = true
      AND td.created_at < now() - interval '30 minutes'
      AND (td.last_seen_at IS NULL OR td.last_seen_at < now() - interval '15 minutes')
      AND (td.last_alerted_at IS NULL OR td.last_alerted_at < coalesce(td.last_seen_at, td.created_at))
  LOOP
    SELECT s.owner_id INTO v_owner_id
    FROM public.schools s
    WHERE s.id = v_device.school_id;

    IF v_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, school_id, title, message, type, category, read, link)
      VALUES (
        v_owner_id,
        v_device.school_id,
        '📡 Torniquete sin conexión',
        format(
          '%s (%s) dejó de reportar hace más de 15 minutos. Puede seguir abriendo localmente, pero no se está registrando asistencia ni avisos de pago vencido.',
          v_device.device_name, v_device.serial_number
        ),
        'device_offline',
        'access',
        false,
        '/school/access-control'
      );
      v_alerted_count := v_alerted_count + 1;
    END IF;

    UPDATE public.turnstile_devices
    SET last_alerted_at = now()
    WHERE id = v_device.id;
  END LOOP;

  RETURN jsonb_build_object('alerted', v_alerted_count, 'checked_at', now());
END;
$$;

COMMENT ON FUNCTION public.alert_offline_access_devices() IS
  'Cron (cada 5 min): notifica al owner de la escuela si un torniquete activo
   lleva >15 min sin reportar last_seen_at. Una alerta por caída (no repite
   hasta que el device vuelva a conectar y se caiga de nuevo).';

-- Solo pg_cron (via service_role) invoca esto — no es una RPC de cliente.
REVOKE ALL ON FUNCTION public.alert_offline_access_devices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alert_offline_access_devices() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    PERFORM cron.unschedule('alert-offline-access-devices');
EXCEPTION WHEN OTHERS THEN
    NULL; -- el job no existía todavía; no es error
END $$;

SELECT cron.schedule(
    'alert-offline-access-devices',
    '*/5 * * * *',
    $cron$ SELECT public.alert_offline_access_devices(); $cron$
);

COMMIT;
