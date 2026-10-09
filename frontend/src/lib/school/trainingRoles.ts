/**
 * Quién MIRA y quién HACE en la planificación de entrenamientos (spec
 * docs/specs/rediseno-seguimiento-deportivo.md §3: "Dueño = MIRAR").
 *
 * Una sola lista para el mesociclo, las semanas sueltas, el formulario de la
 * sesión y la pizarra: antes cada pantalla decidía por su cuenta y el dueño
 * veía controles de edición en una y no en otra. super_admin queda editable
 * (soporte).
 */
export const TRAINING_READ_ONLY_ROLES = ['owner', 'school', 'school_admin', 'admin', 'viewer'] as const;

export function isTrainingReadOnlyRole(role: string | null | undefined): boolean {
  return (TRAINING_READ_ONLY_ROLES as readonly string[]).includes(role || '');
}
