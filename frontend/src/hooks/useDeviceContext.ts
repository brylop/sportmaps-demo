// frontend/src/hooks/useDeviceContext.ts
//
// Detecta plataforma (web/iOS/Android) y registra el dispositivo del usuario
// en el BFF al loguearse. Preparado para Capacitor (Fase 7) — hoy solo
// registra web/PWA. Cuando se instale @capacitor/core + plugins, el hook
// detecta `Capacitor.isNativePlatform()` y agrega push_token APNS/FCM.
//
// Idempotente: el RPC `register_user_device` hace UPSERT por (user_id, device_id).
// device_id se persiste en localStorage para web (sobrevive recargas pero NO
// cross-device). En Capacitor se usaria Capacitor.Device.getId() (UUID estable
// por instalacion).

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { bffClient } from '@/lib/api/bffClient';

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

/**
 * Resuelve la informacion del dispositivo actual.
 *
 * - Web/PWA: deviceId persistido en localStorage (crypto.randomUUID).
 * - Capacitor (futuro): detecta nativo y delega a @capacitor/device.
 *
 * Mantener este helper sincronico para que el hook pueda llamarlo en
 * el primer render. La parte async (push tokens) se hace en useEffect.
 */
export function getDevicePlatformInfo(): DevicePlatformInfo {
    // Detectar Capacitor sin importar el modulo si aun no esta instalado.
    // window.Capacitor existe solo dentro de la app nativa.
    const cap = (window as any).Capacitor;
    const isNative = !!cap?.isNativePlatform?.();
    const platform: 'web' | 'ios' | 'android' = isNative
        ? (cap.getPlatform() === 'ios' ? 'ios' : 'android')
        : 'web';

    // Device ID estable
    let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = (crypto?.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    // App version desde el build (Vite la expone via define)
    const appVersion = (import.meta as any).env?.VITE_APP_VERSION || 'web-dev';

    return {
        platform,
        deviceId,
        appVersion,
        osVersion: navigator.userAgent, // simplificado para web; Capacitor da OS real
        deviceModel: navigator.platform,
        locale: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
}

/**
 * Hook que se monta una vez por sesion. Al detectar user logueado, llama
 * al BFF para registrar el device. Fire-and-forget (no bloquea UI si falla).
 */
export function useDeviceContext(): { deviceId: string; platform: 'web' | 'ios' | 'android' } {
    const { user } = useAuth();
    const info = getDevicePlatformInfo();

    useEffect(() => {
        if (!user) return;

        // Fire-and-forget. Si falla (red, BFF caido) no rompemos la app.
        bffClient
            .post('/api/v1/devices/register', {
                device_id:     info.deviceId,
                platform:      info.platform,
                push_token:    info.pushToken,
                push_provider: info.pushProvider,
                app_version:   info.appVersion,
                os_version:    info.osVersion,
                device_model:  info.deviceModel,
                locale:        info.locale,
                timezone:      info.timezone,
            }, CSRF_HEADERS)
            .catch((err) => {
                // Log a console — sin Sentry todavia en mobile (Fase 7).
                console.warn('[useDeviceContext] device register failed:', err?.message);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    return { deviceId: info.deviceId, platform: info.platform };
}
