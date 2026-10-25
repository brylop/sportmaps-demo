import { supabase } from '@/integrations/supabase/client';

/**
 * Marcar notificaciones como leídas / eliminarlas.
 *
 * Por qué existe (bug 2026-10-24): un UPDATE que la RLS filtra NO da error —
 * PostgREST responde 204 con 0 filas. Las policies RESTRICTIVE `trial_block_*`
 * de `notifications` dejaban fuera las filas con school_id NULL, y la página y
 * la campana invalidaban la query como si todo hubiera salido bien: el contador
 * se quedaba igual sin ningún aviso. Aquí se pide `select('id')` para CONTAR
 * lo que de verdad cambió y se reporta como error cuando era esperable cambiar
 * algo y no cambió nada.
 */

export class NotificationsNotUpdatedError extends Error {
  constructor(action: 'read' | 'delete') {
    super(
      action === 'read'
        ? 'No se pudieron marcar las notificaciones como leídas.'
        : 'No se pudo eliminar la notificación.',
    );
    this.name = 'NotificationsNotUpdatedError';
  }
}

/** Marca una notificación del usuario como leída. Devuelve las filas cambiadas. */
export async function markNotificationRead(userId: string, id: string): Promise<number> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id');
  if (error) throw error;
  const n = data?.length ?? 0;
  if (n === 0) throw new NotificationsNotUpdatedError('read');
  return n;
}

/**
 * Marca TODAS las no leídas del usuario (no solo las 10 que muestra la lista).
 * `expectedUnread` es lo que la UI ve sin leer: si era > 0 y no cambió nada,
 * es un error (RLS), no un «ya estaba todo leído».
 */
export async function markAllNotificationsRead(userId: string, expectedUnread: number): Promise<number> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
    .select('id');
  if (error) throw error;
  const n = data?.length ?? 0;
  if (n === 0 && expectedUnread > 0) throw new NotificationsNotUpdatedError('read');
  return n;
}

/** Elimina una notificación del usuario. */
export async function deleteNotification(userId: string, id: string): Promise<number> {
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id');
  if (error) throw error;
  const n = data?.length ?? 0;
  if (n === 0) throw new NotificationsNotUpdatedError('delete');
  return n;
}
