import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIdleConfig, IDLE_TIMEOUTS } from '@/contexts/IdleConfigContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

/**
 * IdleTimer v2 — Gestión inteligente de inactividad.
 *
 * Modos de operación:
 * - normal:       Timeout 10 min, warning a los 9:30
 * - active_work:  Timeout 30 min, warning a los 29:00
 *                 (activado por useActiveWorkPage() en páginas de trabajo)
 *
 * Pausa automática:
 * - Si hay formularios con cambios sin guardar (useUnsavedChanges),
 *   el timer queda suspendido y se reanuda cuando se guardan/descartan.
 */
export const IdleTimer = () => {
  const { user, signOut } = useAuth();
  const { mode, hasUnsavedChanges } = useIdleConfig();

  const [showWarning, setShowWarning] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number>(IDLE_TIMEOUTS.COUNTDOWN_SECONDS);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Refs para acceder a valores actuales dentro de callbacks sin recrearlos
  const showWarningRef = useRef(showWarning);
  const isLoggingOutRef = useRef(isLoggingOut);
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  const modeRef = useRef(mode);

  useEffect(() => { showWarningRef.current = showWarning; }, [showWarning]);
  useEffect(() => { isLoggingOutRef.current = isLoggingOut; }, [isLoggingOut]);
  useEffect(() => { hasUnsavedRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    timeoutRef.current = null;
    warningRef.current = null;
    countdownRef.current = null;
  }, []);

  const startCountdown = useCallback(() => {
    setRemainingTime(IDLE_TIMEOUTS.COUNTDOWN_SECONDS);
    countdownRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleFinalLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    setIsLoggingOut(true);
    setShowWarning(false);
    clearAllTimers();
    console.log('[Auth] Idle timeout reached. Signing out...');
    await signOut();
    setIsLoggingOut(false);
  }, [signOut, clearAllTimers]);

  // ─── Timer principal ────────────────────────────────────────────────────────

  const resetTimer = useCallback(() => {
    // No reiniciar si el modal ya está visible, si está cerrando sesión,
    // o si hay cambios sin guardar (el timer queda suspendido)
    if (showWarningRef.current || isLoggingOutRef.current || hasUnsavedRef.current) return;

    clearAllTimers();

    const timeoutMs = modeRef.current === 'active_work'
      ? IDLE_TIMEOUTS.ACTIVE_WORK_MS
      : IDLE_TIMEOUTS.NORMAL_MS;

    const warningMs = modeRef.current === 'active_work'
      ? IDLE_TIMEOUTS.ACTIVE_WORK_WARNING_MS
      : IDLE_TIMEOUTS.NORMAL_WARNING_MS;

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, warningMs);

    timeoutRef.current = setTimeout(() => {
      handleFinalLogout();
    }, timeoutMs);
  }, [clearAllTimers, startCountdown, handleFinalLogout]);

  // ─── Reanudar timer cuando se limpian los cambios sin guardar ──────────────

  useEffect(() => {
    if (!user) return;

    if (hasUnsavedChanges) {
      // Pausar: limpiar timers mientras haya cambios pendientes
      // (solo si el modal no está ya visible)
      if (!showWarning) {
        clearAllTimers();
      }
    } else {
      // Reanudar: el usuario guardó o descartó cambios
      resetTimer();
    }
  }, [hasUnsavedChanges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Reiniciar timer cuando cambia el modo (normal ↔ active_work) ──────────

  useEffect(() => {
    if (!user || showWarning) return;
    resetTimer();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Registro de eventos de actividad ──────────────────────────────────────

  useEffect(() => {
    if (!user) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handleActivity = () => resetTimer();

    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimer(); // Arrancar el timer al montar / al iniciar sesión

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      clearAllTimers();
    };
  }, [user, resetTimer, clearAllTimers]);

  // ─── Acción: mantener sesión abierta ───────────────────────────────────────

  const stayLoggedIn = useCallback(() => {
    setShowWarning(false);
    clearAllTimers();
    resetTimer();
  }, [clearAllTimers, resetTimer]);

  // ─── No renderizar si no hay usuario ───────────────────────────────────────

  if (!user) return null;

  // ─── Modal de advertencia ──────────────────────────────────────────────────

  const isActiveMode = mode === 'active_work';

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent className="z-[10000]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            ⚠️ ¿Sigues ahí?
            {isActiveMode && (
              <Badge variant="secondary" className="text-xs font-normal">
                Modo trabajo activo
              </Badge>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base space-y-1">
            <span className="block">
              Tu sesión está a punto de expirar por inactividad.
              Se cerrará automáticamente en{' '}
              <span className="font-bold text-destructive">{remainingTime} segundos</span>.
            </span>
            {hasUnsavedChanges && (
              <span className="block text-amber-600 dark:text-amber-400 text-sm font-medium">
                ⚠️ Tienes cambios sin guardar que se perderán.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={stayLoggedIn}
            className="w-full sm:w-auto"
          >
            Mantener sesión abierta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
