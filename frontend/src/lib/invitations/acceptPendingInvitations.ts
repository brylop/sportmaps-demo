import { supabase } from '@/integrations/supabase/client';

/**
 * Backstop de MEMBRESÍA: acepta TODAS las invitaciones pendientes del correo de
 * la sesión (parent/athlete), sin depender de localStorage ni del link de la
 * invitación (que se pierde si el correo se abre en otro dispositivo, o si la
 * persona simplemente entra a /register por su cuenta).
 *
 * Vivía solo en DashboardPage, y ahí no alcanzaba: un registro nuevo tiene
 * `onboarding_completed = false`, el dashboard lo manda a /onboarding/<rol>
 * antes de que nada corra, y si la persona no termina el asistente la
 * invitación queda 'pending' para siempre aunque la cuenta exista. Besser,
 * 2026-09-25: 3 acudientes con cuenta creada y 0 vinculados por esto.
 *
 * accept_invitation_pro es idempotente (marca 'accepted' + ON CONFLICT en la
 * membresía), así que llamarlo desde varias pantallas no duplica nada.
 *
 * Devuelve cuántas aceptó y los nombres de las escuelas, para que la pantalla
 * pueda avisar («te vinculamos con X»). Nunca lanza: es un backstop, no un
 * paso del flujo.
 */
export async function acceptPendingInvitations(): Promise<{ accepted: number; schools: string[] }> {
  const schools: string[] = [];
  let accepted = 0;
  try {
    const { data: myInvites } = await (supabase.rpc as any)('get_my_invitations');
    const pend = ((myInvites as any[]) || []).filter(
      (i) => i?.status === 'pending' && ['parent', 'athlete'].includes(String(i?.role_to_assign || '').toLowerCase()),
    );
    for (const inv of pend) {
      const { error } = await (supabase.rpc as any)('accept_invitation_pro', { p_invite_id: inv.id });
      if (error) {
        console.warn('auto-accept invite fallo', inv.id, error.message);
        continue;
      }
      accepted += 1;
      const name = String(inv?.school_name || '').trim();
      if (name && !schools.includes(name)) schools.push(name);
    }
  } catch (e) {
    console.warn('auto-accept pending invites no-op:', e);
  }
  return { accepted, schools };
}
