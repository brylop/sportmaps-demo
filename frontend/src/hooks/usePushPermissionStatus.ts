import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isNativePlatform } from '@/lib/openExternalUrl';

export type PushPermissionState =
  | 'unsupported'   // Navegador no soporta push (Safari sin PWA instalada)
  | 'granted'       // Ya aceptó y tiene suscripción activa
  | 'denied'        // Bloqueó explícitamente
  | 'prompt'        // Nunca ha decidido → mostrar banner
  | 'loading';      // Verificando

export function usePushPermissionStatus() {
  const { user } = useAuth();
  const [state, setState] = useState<PushPermissionState>('loading');

  useEffect(() => {
    if (!user?.id) return;

    async function check() {
      // 0. NATIVO primero. El WebView de Android no expone la Push API del
      //    navegador, asi que el chequeo de 'PushManager' de abajo lo daria por
      //    'unsupported' y el usuario se queda sin ninguna via para activarlas.
      //    En nativo el permiso lo manda el SO y lo lee el plugin de Capacitor.
      if (isNativePlatform()) {
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          const perm = await PushNotifications.checkPermissions();
          setState(
            perm.receive === 'granted' ? 'granted'
            : perm.receive === 'denied' ? 'denied'
            : 'prompt'
          );
        } catch {
          setState('unsupported');
        }
        return;
      }

      // 1. Soporte del navegador
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState('unsupported');
        return;
      }

      const permission = Notification.permission;

      // 2. Bloqueado explícitamente — no hay nada que hacer
      if (permission === 'denied') {
        setState('denied');
        return;
      }

      // 3. Ya concedido — verificar si hay suscripción real en BD
      if (permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();

          if (sub) {
            // Verificar que está guardada en Supabase
            const { count } = await supabase
              .from('push_subscriptions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user!.id)
              .eq('endpoint', sub.endpoint);

            setState(count && count > 0 ? 'granted' : 'prompt');
          } else {
            // Permiso concedido pero sin suscripción activa → re-suscribir
            setState('prompt');
          }
        } catch {
          setState('prompt');
        }
        return;
      }

      // 4. 'default' → nunca ha decidido
      setState('prompt');
    }

    check();
  }, [user?.id]);

  return state;
}
