/**
 * ÚNICO lugar donde se decide quién organiza un torneo (pantallas de administración).
 * Hoy: el admin de la escuela dueña (`events.school_id` = escuela del usuario, `creator_role = 'school'`).
 * Cuando entre el rol organizador (ligas, federaciones), se cambia aquí y nada más.
 * Lo público y el anotador sin cuenta NO pasan por aquí (ni por school_members).
 */
import { supabase } from '../../config/supabase';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { LiveError, loadEvent, type LiveEvent } from './tournament-live.service';

/** ¿Esta escuela organiza este torneo? (versión booleana para las rutas heredadas de events.route). */
export async function schoolOrganizesTournament(eventId: string, schoolId: string | null | undefined): Promise<boolean> {
  if (!schoolId) return false;
  const { data } = await supabase.from('events').select('id').eq('id', eventId).eq('school_id', schoolId).eq('creator_role', 'school').maybeSingle();
  return !!data;
}

/** Carga el torneo si el usuario lo organiza; si no, 403 (sin escuela) o 404 (no es suyo). */
export async function assertTournamentOrganizer(req: AuthenticatedRequest, eventId: string): Promise<LiveEvent> {
  const schoolId = req.schoolId;
  if (!schoolId) throw new LiveError(403, 'sin_escuela', 'No se pudo resolver la escuela del usuario.');
  const ev = await loadEvent(eventId);
  if (!ev || ev.school_id !== schoolId) throw new LiveError(404, 'torneo_no_encontrado', 'Torneo no encontrado');
  if (!(await schoolOrganizesTournament(eventId, schoolId))) throw new LiveError(404, 'torneo_no_encontrado', 'Torneo no encontrado');
  return ev;
}
