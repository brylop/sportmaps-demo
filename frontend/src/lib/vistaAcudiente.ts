import { ACUDIENTE_V2 } from '@/lib/feature-flags';

/**
 * ¿Esta sesión ve las pantallas internas con la presentación V2 del acudiente?
 * (/settings, /notifications, /messages…). Mismo criterio que el layout para
 * el «Volver»: rol activo de la escuela o, si no hay, el del perfil.
 * Los demás roles —escuela incluida— siguen viendo la pantalla de siempre.
 */
export function esAcudienteV2(rol: string | null | undefined): boolean {
  return ACUDIENTE_V2 && rol === 'parent';
}
