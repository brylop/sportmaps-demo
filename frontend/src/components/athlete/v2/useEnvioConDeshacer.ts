/**
 * «Un toque y Deshacer» sin borrar nada en la base: la escritura se manda
 * cuando pasan los segundos del aviso. «Deshacer» la cancela antes de salir.
 * Si la pantalla se cierra antes, se manda en ese momento (no se pierde).
 */
import { useCallback, useEffect, useRef } from 'react';

export const SEGUNDOS_DESHACER = 8;

export function useEnvioConDeshacer() {
  const pendiente = useRef<{ timer: ReturnType<typeof setTimeout>; run: () => void } | null>(null);

  useEffect(
    () => () => {
      const p = pendiente.current;
      if (p) {
        clearTimeout(p.timer);
        pendiente.current = null;
        p.run();
      }
    },
    [],
  );

  const programar = useCallback((run: () => void) => {
    const anterior = pendiente.current;
    if (anterior) {
      clearTimeout(anterior.timer);
      anterior.run();
    }
    const p = {
      run,
      timer: setTimeout(() => {
        if (pendiente.current === p) pendiente.current = null;
        run();
      }, SEGUNDOS_DESHACER * 1000),
    };
    pendiente.current = p;
  }, []);

  /** true si alcanzó a cancelar el envío. */
  const deshacer = useCallback(() => {
    const p = pendiente.current;
    if (!p) return false;
    clearTimeout(p.timer);
    pendiente.current = null;
    return true;
  }, []);

  return { programar, deshacer };
}
