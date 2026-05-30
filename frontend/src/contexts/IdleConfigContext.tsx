import { createContext, useContext, useState, useCallback, useMemo } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type IdleMode = 'normal' | 'active_work';

interface IdleConfigContextType {
  /** Modo actual del timeout */
  mode: IdleMode;
  /** IDs de formularios con cambios sin guardar activos */
  unsavedForms: Set<string>;
  /** True si hay al menos un formulario con cambios pendientes */
  hasUnsavedChanges: boolean;
  /** Registrar una página como 'trabajo activo' (extiende timeout a 30 min) */
  setActiveWorkMode: () => void;
  /** Volver al modo normal */
  setNormalMode: () => void;
  /** Registrar un formulario con cambios sin guardar (pausa el timer) */
  registerUnsavedForm: (formId: string) => void;
  /** Liberar un formulario (guardado o descartado) */
  unregisterUnsavedForm: (formId: string) => void;
}

// ─── Timeouts centralizados ───────────────────────────────────────────────────
// Todos los valores en un solo lugar para fácil ajuste futuro.

export const IDLE_TIMEOUTS = {
  /** Timeout normal de navegación: 10 minutos */
  NORMAL_MS: 10 * 60 * 1000,
  /** Warning antes del logout en modo normal: 9:30 min */
  NORMAL_WARNING_MS: 9.5 * 60 * 1000,
  /** Timeout en páginas de trabajo activo: 30 minutos */
  ACTIVE_WORK_MS: 30 * 60 * 1000,
  /** Warning antes del logout en modo trabajo activo: 29:00 min */
  ACTIVE_WORK_WARNING_MS: 29 * 60 * 1000,
  /** Segundos de countdown en el modal de advertencia */
  COUNTDOWN_SECONDS: 30,
} as const;

// ─── Context ──────────────────────────────────────────────────────────────────

const IdleConfigContext = createContext<IdleConfigContextType | undefined>(undefined);

export function IdleConfigProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<IdleMode>('normal');
  const [unsavedForms, setUnsavedForms] = useState<Set<string>>(new Set());

  const setActiveWorkMode = useCallback(() => setMode('active_work'), []);
  const setNormalMode = useCallback(() => setMode('normal'), []);

  const registerUnsavedForm = useCallback((formId: string) => {
    setUnsavedForms(prev => {
      const next = new Set(prev);
      next.add(formId);
      return next;
    });
  }, []);

  const unregisterUnsavedForm = useCallback((formId: string) => {
    setUnsavedForms(prev => {
      const next = new Set(prev);
      next.delete(formId);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    mode,
    unsavedForms,
    hasUnsavedChanges: unsavedForms.size > 0,
    setActiveWorkMode,
    setNormalMode,
    registerUnsavedForm,
    unregisterUnsavedForm,
  }), [mode, unsavedForms, setActiveWorkMode, setNormalMode, registerUnsavedForm, unregisterUnsavedForm]);

  return (
    <IdleConfigContext.Provider value={value}>
      {children}
    </IdleConfigContext.Provider>
  );
}

export function useIdleConfig() {
  const ctx = useContext(IdleConfigContext);
  if (!ctx) throw new Error('useIdleConfig must be used within IdleConfigProvider');
  return ctx;
}
