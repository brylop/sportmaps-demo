-- =============================================================================
-- 20260814111326_user_devices_tracking_de_instalacion.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814111324
-- Objetivo: saber qué dispositivos tienen la app INSTALADA, no solo cuáles
--           abrieron el sitio.
--
-- Hoy estamos ciegos: los ~692 registros de user_devices son sesiones web. El
-- evento `appinstalled` se escucha en InstallBanner pero nunca se reporta al
-- backend, y encima no alcanzaría:
--   · iOS/Safari NUNCA dispara appinstalled ("Añadir a inicio" no emite evento),
--     así que toda la base de iPhone quedaría invisible.
--   · Solo suena en el instante de instalar: los dispositivos ya existentes no
--     lo dispararían nunca.
--   · No hay evento de desinstalación.
--
-- Por eso no se registra el evento sino el MODO DE VISUALIZACIÓN en cada sesión
-- (display-mode: standalone / navigator.standalone / Capacitor), que viaja en el
-- POST /api/v1/devices/register que ya se llama una vez por sesión. Ventaja: es
-- retroactivo — los dispositivos existentes se clasifican solos a medida que las
-- familias vuelven a entrar, sin pedirle nada a nadie.
--
-- install_tenant_slug es la pieza para la migración a la app nativa: permite
-- segmentar a quién avisarle y saber si su ícono actual es el de SportMaps o el
-- de su escuela.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columnas de instalación
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_devices
    ADD COLUMN IF NOT EXISTS display_mode        text,
    ADD COLUMN IF NOT EXISTS installed_at        timestamptz,
    ADD COLUMN IF NOT EXISTS last_standalone_at  timestamptz,
    ADD COLUMN IF NOT EXISTS install_tenant_slug text;

-- text + CHECK (no CREATE TYPE), según convención del repo.
-- NULL = todavía no reportado (dispositivo previo a este cambio).
ALTER TABLE public.user_devices
    DROP CONSTRAINT IF EXISTS user_devices_display_mode_check;

ALTER TABLE public.user_devices
    ADD CONSTRAINT user_devices_display_mode_check CHECK (
        display_mode IS NULL OR display_mode = ANY (ARRAY['browser'::text, 'standalone'::text, 'native'::text])
    );

COMMENT ON COLUMN public.user_devices.display_mode IS
    'browser = pestaña normal · standalone = PWA instalada · native = app Capacitor. NULL = aún sin reportar.';
COMMENT ON COLUMN public.user_devices.installed_at IS
    'Primera vez que el dispositivo se vio en standalone/native. No se pisa nunca.';
COMMENT ON COLUMN public.user_devices.last_standalone_at IS
    'Última vez en standalone/native. Su ausencia prolongada delata una desinstalación (no hay evento de uninstall).';
COMMENT ON COLUMN public.user_devices.install_tenant_slug IS
    'Con qué marca se instaló (slug de la escuela, o NULL = SportMaps). Clave para segmentar el aviso de migración a la app nativa.';

-- Índice parcial: las consultas de adopción siempre filtran por instalados, que
-- son una fracción del total.
CREATE INDEX IF NOT EXISTS idx_user_devices_instalados
    ON public.user_devices (install_tenant_slug, last_standalone_at DESC)
    WHERE installed_at IS NOT NULL AND revoked_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. installed_at se sella una sola vez
--
-- El BFF registra el device con un UPSERT, que pisaría installed_at en cada
-- sesión y haría creer que todos instalaron hoy. Se resuelve con trigger para
-- que la regla viva en la base y no dependa de que cada caller la recuerde.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stamp_device_install()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NEW.display_mode IN ('standalone', 'native') THEN
        -- COALESCE: la primera fecha manda. En UPDATE, OLD.installed_at gana.
        NEW.installed_at       := COALESCE(
                                    CASE WHEN TG_OP = 'UPDATE' THEN OLD.installed_at ELSE NULL END,
                                    NEW.installed_at,
                                    now()
                                  );
        NEW.last_standalone_at := now();
    ELSIF TG_OP = 'UPDATE' THEN
        -- Volvió a abrir en navegador: NO se borra installed_at. Que haya
        -- instalado alguna vez es un hecho histórico; si desinstaló se deduce
        -- de last_standalone_at quedando viejo.
        NEW.installed_at       := OLD.installed_at;
        NEW.last_standalone_at := OLD.last_standalone_at;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.stamp_device_install() IS
    'Sella installed_at la primera vez que un dispositivo aparece en standalone/native y refresca last_standalone_at. Evita que el UPSERT del BFF pise la fecha original.';

DROP TRIGGER IF EXISTS trg_stamp_device_install ON public.user_devices;

CREATE TRIGGER trg_stamp_device_install
    BEFORE INSERT OR UPDATE ON public.user_devices
    FOR EACH ROW
    EXECUTE FUNCTION public.stamp_device_install();

COMMIT;
