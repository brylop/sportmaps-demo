import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';

const PERFILES_DE_ESCUELA = new Set(['school', 'school_admin', 'owner', 'admin', 'super_admin']);

/**
 * Perfil de escuela o plataforma que además es miembro de una sede como coach
 * (las sedes del Club Campestre Demo). Sus pantallas clásicas de coach le
 * muestran los equipos de TODA la escuela; la V2 del entrenador solo los
 * asignados y lo dejaría sin lista. Se queda con lo de siempre.
 */
export const esPerfilDeEscuela = (profileRole: string | null | undefined): boolean =>
  PERFILES_DE_ESCUELA.has(profileRole ?? '');

/**
 * Rol con el que la persona está usando la app ahora. En multirol manda el de
 * la escuela activa (`currentUserRole`), no `profile.role`: el Inicio, la barra
 * de abajo y las pestañas V2 tienen que decidir con el MISMO rol o se mezclan
 * (barra de deportista con el Inicio del acudiente). Un perfil de escuela
 * conserva su rol de perfil (ver `esPerfilDeEscuela`).
 */
export function useRolActivo(): string | null {
  const { profile } = useAuth();
  const { currentUserRole } = useSchoolContext();
  if (esPerfilDeEscuela(profile?.role)) return profile?.role ?? null;
  return (currentUserRole ?? profile?.role ?? null) as string | null;
}
