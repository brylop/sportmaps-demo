import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Hook para solicitar permiso de notificaciones push y guardar la suscripción en Supabase.
 * Requiere VITE_VAPID_PUBLIC_KEY en .env.
 * Las notificaciones push se envían desde una Edge Function cuando se inserta en `notifications`.
 */
export function usePushSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unsupported'>('idle');

  const subscribe = useCallback(async () => {
    if (!user) {
      toast.error('Debes iniciar sesión para activar notificaciones push');
      return false;
    }
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
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await saveSubscription(existing);
        setStatus('granted');
        toast.success('Notificaciones push ya activadas');
        return true;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
