/**
 * «Ahora» que avanza: un tic por minuto y al volver a la pestaña. Las consultas
 * de las pantallas van por día (isoDia), así que el tic NO dispara consultas: solo
 * cambia la frase del momento («En 40 minutos entrenas…») y, a medianoche, el día.
 * `fijo` (pruebas) congela la hora.
 */
import { useEffect, useState } from 'react';

export function useAhora(fijo?: Date, cadaMs = 60_000): Date {
  const [ahora, setAhora] = useState(() => fijo ?? new Date());
  useEffect(() => {
    if (fijo) { setAhora(fijo); return; }
    const tic = () => setAhora(new Date());
    const iv = setInterval(tic, cadaMs);
    const vis = () => { if (document.visibilityState === 'visible') tic(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', tic);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('focus', tic);
    };
  }, [fijo, cadaMs]);
  return fijo ?? ahora;
}
