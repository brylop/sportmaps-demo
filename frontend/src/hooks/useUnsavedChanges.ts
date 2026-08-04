import { useEffect, useCallback } from 'react';
import { useIdleConfig } from '@/contexts/IdleConfigContext';

/**
 * Hook para registrar que un formulario tiene cambios sin guardar.
 * Mientras `isDirty` sea true, el IdleTimer queda pausado.
 *
 * Uso:
 *   const { markDirty, markClean } = useUnsavedChanges('routine-editor');
 *
 *   // Cuando el usuario modifica algo:
 *   markDirty();
 *
 *   // Cuando guarda o descarta:
 *   markClean();
 *
 * También acepta un booleano reactivo directo (compatible con react-hook-form isDirty):
 *   useUnsavedChanges('routine-editor', formState.isDirty);
 */
export function useUnsavedChanges(formId: string, isDirty?: boolean) {
  const { registerUnsavedForm, unregisterUnsavedForm } = useIdleConfig();

  // Modo reactivo: si se pasa isDirty como booleano, sincroniza automáticamente
  useEffect(() => {
    if (isDirty === undefined) return;

    if (isDirty) {
      registerUnsavedForm(formId);
    } else {
      unregisterUnsavedForm(formId);
    }
  }, [isDirty, formId, registerUnsavedForm, unregisterUnsavedForm]);

  // Limpiar siempre al desmontar el componente
  useEffect(() => {
    return () => {
      unregisterUnsavedForm(formId);
    };
  }, [formId, unregisterUnsavedForm]);

  // Modo imperativo: markDirty / markClean para usar manualmente
  const markDirty = useCallback(() => {
    registerUnsavedForm(formId);
  }, [formId, registerUnsavedForm]);

  const markClean = useCallback(() => {
    unregisterUnsavedForm(formId);
  }, [formId, unregisterUnsavedForm]);

  return { markDirty, markClean };
}
