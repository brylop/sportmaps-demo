import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeNotifications } from '@/hooks/useRealtime';

/**
 * Conecta Supabase Realtime a la tabla notifications.
 * Cuando llega una nueva notificación, invalida la query para refrescar la lista.
 * Se renderiza dentro de AuthLayout para usuarios autenticados.
 */
export function RealtimeNotificationsProvider() {
  const queryClient = useQueryClient();

  useRealtimeNotifications(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  });

  return null;
}
