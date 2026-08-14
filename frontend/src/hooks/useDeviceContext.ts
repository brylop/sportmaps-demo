// frontend/src/hooks/useDeviceContext.ts
//
// Detecta plataforma (web/iOS/Android) y registra el dispositivo del usuario
// en el BFF al loguearse.
//
// - Web/PWA: deviceId = uuid persistido en localStorage. Sin push token.
// - Capacitor (N1): detecta nativo via `window.Capacitor` (sincrono, sin
//   importar el modulo) y, dentro del guard, hace IMPORT DINAMICO de
//   @capacitor/device y @capacitor/push-notifications. Esto mantiene el
//   bundle web limpio: Vite no empaqueta los plugins nativos porque no se
//   importan estaticamente — solo se cargan cuando la app corre en nativo.
//
// Idempotente: el RPC `register_user_device` hace UPSERT por (user_id, device_id).
//
// IMPORTANTE: NO importar @capacitor/* de forma estatica en este archivo
// (ni en codigo compartido web+nativo). Romperia el guard y/o bundlearia
// codigo nativo en la web. Siempre import() dinamico dentro de isNative.

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { bffClient } from '@/lib/api/bffClient';
import { getDisplayMode, getPwaTenantSlug } from '@/pwa/tenant';

const DEVICE_ID_KEY = 'sportmaps_device_id';
const CSRF_HEADERS = { 'X-Requested-With': 'SportMaps' };

interface DevicePlatformInfo {
    platform: 'web' | 'ios' | 'android';
    deviceId: string;
    appVersion: string;
    osVersion?: string;
    deviceModel?: string;
    locale?: string;
    timezone?: string;
    pushToken?: string;
    pushProvider?: 'apns' | 'fcm' | 'web_push';
}

/** True solo dentro de la app nativa Capacitor. Sincrono, no importa modulos. */
function isNativePlatform(): boolean {
    const cap = (window as any).Capacitor;
    return !!cap?.isNativePlatform?.();
}

/**
 * Resuelve la informacion del dispositivo de forma SINCRONA, para que el hook
 * pueda devolver deviceId/platform en el primer render. En nativo, los datos
 * reales (device id estable, OS, push token) se enriquecen async en el effect.
 */
export function getDevicePlatformInfo(): DevicePlatformInfo {
    const cap = (window as any).Capacitor;
    const isNative = isNativePlatform();
    const platform: 'web' | 'ios' | 'android' = isNative
        ? (cap.getPlatform() === 'ios' ? 'ios' : 'android')
        : 'web';

    // Device ID estable (web). En nativo se sobreescribe con Device.getId().
    let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = (crypto?.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    const appVersion = (import.meta as any).env?.VITE_APP_VERSION || 'web-dev';

    return {
        platform,
        deviceId,
        appVersion,
        // El BFF valida os_version max 64 chars; el UA suele superarlo → truncar.
        osVersion: navigator.userAgent.slice(0, 64), // simplificado para web; Capacitor da OS real
        deviceModel: navigator.platform.slice(0, 128),
        locale: navigator.language.slice(0, 16),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, 64),
    };
}

/**
 * En nativo: lee datos reales del dispositivo via @capacitor/device.
 * Import dinamico — nunca se carga en web. Devuelve {} si algo falla.
 */
async function getNativeDeviceDetails(): Promise<Partial<DevicePlatformInfo>> {
    try {
        const { Device } = await import('@capacitor/device');
        const [{ identifier }, info] = await Promise.all([Device.getId(), Device.getInfo()]);
        return {
            deviceId: identifier,           // UUID estable por instalacion (mejor que localStorage)
            osVersion: info.osVersion,
            deviceModel: `${info.manufacturer} ${info.model}`.trim(),
        };
    } catch (err) {
        console.warn('[useDeviceContext] Device.getInfo failed:', (err as Error)?.message);
        return {};
    }
}

/**
 * En nativo: pide permiso de push y resuelve el token APNS/FCM.
 * Import dinamico — nunca se carga en web. Resuelve undefined si el usuario
 * niega el permiso o algo falla (no bloquea el registro del device).
 */
async function getNativePushToken(platform: 'ios' | 'android'): Promise<Pick<DevicePlatformInfo, 'pushToken' | 'pushProvider'>> {
    try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
            perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') return {};

        const token = await new Promise<string | undefined>((resolve) => {
            const timeout = setTimeout(() => resolve(undefined), 10_000);
            PushNotifications.addListener('registration', (t) => {
                clearTimeout(timeout);
                resolve(t.value);
            });
            PushNotifications.addListener('registrationError', () => {
                clearTimeout(timeout);
                resolve(undefined);
            });
            void PushNotifications.register();
        });

        if (!token) return {};
        return { pushToken: token, pushProvider: platform === 'ios' ? 'apns' : 'fcm' };
    } catch (err) {
        console.warn('[useDeviceContext] push registration failed:', (err as Error)?.message);
        return {};
    }
}

/**
 * Hook que se monta una vez por sesion. Al detectar user logueado, registra
 * el device en el BFF. En nativo enriquece con device id real + push token
 * antes de postear. Fire-and-forget (no bloquea UI si falla).
 */
export function useDeviceContext(): { deviceId: string; platform: 'web' | 'ios' | 'android' } {
    const { user } = useAuth();
    const info = getDevicePlatformInfo();

    useEffect(() => {
        if (!user) return;
        let cancelled = false;

        (async () => {
            const payload: DevicePlatformInfo = { ...info };

            // GUARD nativo: solo aqui se cargan los plugins de Capacitor.
            if (isNativePlatform() && (payload.platform === 'ios' || payload.platform === 'android')) {
                const [details, push] = await Promise.all([
                    getNativeDeviceDetails(),
                    getNativePushToken(payload.platform),
                ]);
                Object.assign(payload, details, push);
            }

            if (cancelled) return;

            // Fire-and-forget. Si falla (red, BFF caido) no rompemos la app.
            bffClient
                .post('/api/v1/devices/register', {
                    device_id:     payload.deviceId,
                    platform:      payload.platform,
                    push_token:    payload.pushToken,
                    push_provider: payload.pushProvider,
                    app_version:   payload.appVersion,
                    os_version:    payload.osVersion,
                    device_model:  payload.deviceModel,
                    locale:        payload.locale,
                    timezone:      payload.timezone,
                    // Tracking de instalacion: se manda el modo de visualizacion
                    // en CADA sesion. Es lo unico que funciona en iOS (nunca
                    // dispara `appinstalled`) y ademas clasifica retroactivamente
                    // a los dispositivos que ya existian. installed_at lo sella
                    // un trigger en la BD para que el upsert no lo pise.
                    display_mode:        getDisplayMode(),
                    install_tenant_slug: getPwaTenantSlug(),
                }, CSRF_HEADERS)
                .catch((err) => {
                    console.warn('[useDeviceContext] device register failed:', err?.message);
                });
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    return { deviceId: info.deviceId, platform: info.platform };
}
