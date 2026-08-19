import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isNativePlatform } from '@/lib/openExternalUrl';
import { syncDeviceRegistration } from '@/hooks/useDeviceContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Hook para solicitar permiso de notificaciones push.
 *
 * Dos caminos, y hay que respetarlos:
 * - NATIVO (Capacitor): permiso del SO + token FCM/APNS via
 *   @capacitor/push-notifications, y el token viaja al BFF en `user_devices`.
 * - WEB/PWA: VAPID + service worker + `pushManager`, y la suscripcion queda en
 *   `push_subscriptions` de Supabase. Requiere VITE_VAPID_PUBLIC_KEY.
 *
 * OJO: hasta 2026-08-17 este hook solo tenia el camino web, y el banner lo
 * llamaba sin mirar la plataforma. Dentro de la app Android el WebView no
 * implementa la Push API, asi que `pushManager` reventaba siempre y el usuario
 * veia "No se pudo activar notificaciones push" sin ninguna forma de activarlas.
 * Si alguien vuelve a quitar el guard de nativo, se repite.
 */
export function usePushSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unsupported'>('idle');

  const subscribe = useCallback(async () => {
    if (!user) {
      toast.error('Debes iniciar sesión para activar notificaciones push');
      return false;
    }

    // ── Camino NATIVO ────────────────────────────────────────────────────────
    if (isNativePlatform()) {
      setStatus('loading');
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') {
          setStatus('denied');
          // En Android, negar dos veces lo deja bloqueado: la app ya no puede
          // volver a preguntar y hay que ir a los ajustes del sistema.
          toast.info('Permiso denegado. Actívalo en los ajustes del teléfono, en Notificaciones.');
          return false;
        }

        // Re-registrar el device para que el token recien concedido llegue al BFF:
        // el registro del login pudo haber viajado sin token.
        const { pushGranted } = await syncDeviceRegistration();
        if (!pushGranted) {
          setStatus('denied');
          toast.error('No se pudo obtener el token de notificaciones. Reintenta en un momento.');
          return false;
        }

        setStatus('granted');
        toast.success('Notificaciones activadas');
        return true;
      } catch (err) {
        console.error('[push] registro nativo fallo:', err);
        setStatus('denied');
        toast.error('No se pudo activar notificaciones');
        return false;
      }
    }

    // ── Camino WEB / PWA ─────────────────────────────────────────────────────
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      toast.error('Tu navegador no soporta notificaciones push');
      return false;
    }
    if (!VAPID_PUBLIC_KEY) {
      console.warn('VITE_VAPID_PUBLIC_KEY no configurada. Genera con: npx web-push generate-vapid-keys');
      toast.error('Notificaciones push no configuradas en el servidor');
      return false;
    }

    setStatus('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        toast.info('Permiso de notificaciones denegado');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        // Si la suscripción del navegador fue creada con OTRA clave VAPID
        // (rotación de llaves), el envío falla con 403. Detectarlo comparando
        // la applicationServerKey y re-suscribir con la clave actual.
        const existingKey = existing.options?.applicationServerKey;
        const existingBytes = existingKey ? new Uint8Array(existingKey) : null;
        const sameKey = !!existingBytes
          && existingBytes.length === appServerKey.length
          && existingBytes.every((b, i) => b === appServerKey[i]);
        if (sameKey) {
          await saveSubscription(existing);
          setStatus('granted');
          toast.success('Notificaciones push ya activadas');
          return true;
        }
        await existing.unsubscribe(); // clave distinta → rotar
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });

      await saveSubscription(subscription);
      setStatus('granted');
      toast.success('Notificaciones push activadas');
      return true;
    } catch (err) {
      console.error('Error subscribing to push:', err);
      toast.error('No se pudo activar notificaciones push');
      setStatus('denied');
      return false;
    }
  }, [user]);

  const saveSubscription = async (subscription: PushSubscription) => {
    const json = subscription.toJSON();
    const key = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!key || !auth) throw new Error('Invalid subscription keys');

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user!.id,
        endpoint: json.endpoint,
        p256dh: key,
        auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: 'endpoint' }
    );
    if (error) throw error;
  };

  const checkStatus = useCallback(async () => {
    if (!('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    const perm = Notification.permission;
    if (perm === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? 'granted' : 'idle');
    } else if (perm === 'denied') {
      setStatus('denied');
    } else {
      setStatus('idle');
    }
  }, []);

  return { subscribe, status, checkStatus };
}

// El retorno se declara sobre ArrayBuffer y no sobre el ArrayBufferLike que
// asume `Uint8Array` pelado: pushManager.subscribe pide un BufferSource, y un
// Uint8Array<ArrayBufferLike> podria estar respaldado por SharedArrayBuffer.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
