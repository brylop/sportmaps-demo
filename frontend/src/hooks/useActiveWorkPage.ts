import { useEffect } from 'react';
import { useIdleConfig } from '@/contexts/IdleConfigContext';

/**
 * Declara que la página actual es de "trabajo activo" (rutinas, formularios complejos,
 * carga de asistencia, onboarding, etc.).
 *
 * Efecto: extiende el timeout de inactividad a 30 minutos mientras la página esté montada.
 * Al desmontar (navegar a otra ruta), vuelve automáticamente al modo normal.
 *
 * Uso — una sola línea al inicio del componente de página:
 *   useActiveWorkPage();
 */
export function useActiveWorkPage() {
  const { setActiveWorkMode, setNormalMode } = useIdleConfig();

  useEffect(() => {
    setActiveWorkMode();
    return () => {
      setNormalMode();
    };
  }, [setActiveWorkMode, setNormalMode]);
}
