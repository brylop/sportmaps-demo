import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_REST_SECONDS = 90;

interface UseRestTimerOptions {
  onFinished?: () => void;
}

export function useRestTimer({ onFinished }: UseRestTimerOptions = {}) {
  const [isRunning,  setIsRunning]  = useState(false);
  const [isPaused,   setIsPaused]   = useState(false);
  const [remaining,  setRemaining]  = useState(0);
  const [total,      setTotal]      = useState(0);

  const intervalRef  = useRef<NodeJS.Timeout | null>(null);
  const onFinishedRef = useRef(onFinished);
  
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback((seconds: number = DEFAULT_REST_SECONDS) => {
    clearTimer();
    setTotal(seconds);
    setRemaining(seconds);
    setIsRunning(true);
    setIsPaused(false);
  }, [clearTimer]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const skip = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setIsPaused(false);
    setRemaining(0);
    onFinishedRef.current?.();
  }, [clearTimer]);

  const adjust = useCallback((delta: number) => {
    setRemaining((prev) => {
      const next = Math.max(0, prev + delta);
      if (next === 0) {
        // Si el tiempo llega a cero, saltamos o finalizamos de inmediato
        setTimeout(() => {
          clearTimer();
          setIsRunning(false);
          setIsPaused(false);
          onFinishedRef.current?.();
        }, 0);
      }
      return next;
    });
  }, [clearTimer]);

  // Manejar el tick del temporizador
  useEffect(() => {
    if (!isRunning || isPaused) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          // Llamar al callback al final de la pila de eventos
          setTimeout(() => {
            onFinishedRef.current?.();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimer();
  }, [isRunning, isPaused, clearTimer]);

  const progress = total > 0 ? remaining / total : 0;

  return {
    remaining,
    total,
    progress,
    isPaused,
    isActive: isRunning,
    start,
    pause,
    resume,
    skip,
    adjust,
  };
}
