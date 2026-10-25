/**
 * Sincronizador global de listas guardadas sin señal (opcional).
 *
 * La pantalla de Asistencia ya sube sola lo pendiente mientras está abierta.
 * Montando este componente (no pinta nada) en el layout del entrenador, la
 * lista también sube cuando el profe ya se fue a otra pestaña de la app.
 * Usa la misma cola (obtenerCola) que la pantalla: no hay doble envío.
 */
import { useAuth } from '@/contexts/AuthContext';
import { useColaAsistencia } from './useCoachV2Senal';

export function CoachListasSync() {
  const { user } = useAuth();
  useColaAsistencia(user?.id);
  return null;
}
