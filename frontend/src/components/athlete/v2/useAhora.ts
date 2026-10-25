/**
 * «Ahora» que avanza: se recalcula cada minuto y al volver a la pestaña
 * (visibilitychange / focus), sin consultas extra. Con `fija` (pruebas) no se mueve.
 */
import { useEffect, useState } from 'react';

export const TIC_AHORA_MS = 60_000;

export function useAhora(fija?: Date): Date {
  const [ahora, setAhora] = useState<Date>(() => fija ?? new Date());

  useEffect(() => {
    if (fija) return undefined;
    const tic = () => setAhora(new Date());
    const alVolver = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') tic();
    };
    const id = window.setInterval(tic, TIC_AHORA_MS);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [fija]);

  return fija ?? ahora;
}
