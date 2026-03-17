import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string) {
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...binary].map(c => c.charCodeAt(0)));
}

export async function subscribeToPush(userId: string, schoolId?: string) {
  if (!('PushManager' in window)) {
    console.warn('[PWA] Push Notifications no soportadas en este navegador.');
    return null;
  }

  const reg = await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[PWA] Permiso de notificaciones denegado.');
    return null;
  }

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY ? urlBase64ToUint8Array(VAPID_PUBLIC_KEY) : undefined
    });

    const { endpoint, keys } = sub.toJSON() as any;

    if (!endpoint || !keys) {
      throw new Error('Suscripción push incompleta');
    }
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id:    userId,
      school_id:  schoolId ?? null,
      endpoint,
      p256dh:     keys.p256dh,
      auth:       keys.auth,
      user_agent: navigator.userAgent,
    }, { onConflict: 'endpoint' });

    if (error) throw error;

    console.log('[PWA] Suscrito a notificaciones push');
    return sub;
  } catch (err) {
    console.error('[PWA] Error suscribiendo push:', err);
    return null;
  }
}

export async function unsubscribeFromPush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const { endpoint } = sub;
  await sub.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  console.log('[PWA] Cancelada suscripción push');
}
