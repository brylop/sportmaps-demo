/**
 * «Guardar con Deshacer» de la V2: la escritura se programa y corre a los 8 s.
 * Si el profe toca «Deshacer» antes, no se escribe nada (no hay que revertir
 * en la base cosas que ya avisaron a las familias). Si la pantalla se cierra
 * antes de los 8 s, lo pendiente se ejecuta al desmontar: tocar «Guardar» y
 * salir nunca pierde la evaluación.
 */
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export const DESHACER_MS = 8000;

interface Pendiente {
  timer: ReturnType<typeof setTimeout>;
  run: () => Promise<void>;
}

export function useAccionConDeshacer() {
  const pendientes = useRef(new Map<string, Pendiente>());

  const ejecutar = useCallback(async (id: string) => {
    const p = pendientes.current.get(id);
    if (!p) return;
    pendientes.current.delete(id);
    clearTimeout(p.timer);
    await p.run();
  }, []);

  /**
   * Programa `run` y muestra el aviso con «Deshacer».
   * `onDeshacer` restaura lo que la pantalla ya mostró como hecho.
   */
  const programar = useCallback(
    (id: string, mensaje: string, run: () => Promise<void>, onDeshacer?: () => void) => {
      const previo = pendientes.current.get(id);
      if (previo) clearTimeout(previo.timer);
      const timer = setTimeout(() => { void ejecutar(id); }, DESHACER_MS);
      pendientes.current.set(id, { timer, run });
      toast.success(mensaje, {
        id: `deshacer-${id}`,
        duration: DESHACER_MS,
        action: {
          label: 'Deshacer',
          onClick: () => {
            const p = pendientes.current.get(id);
            if (!p) return;
            clearTimeout(p.timer);
            pendientes.current.delete(id);
            onDeshacer?.();
          },
        },
      });
    },
    [ejecutar],
  );

  const hayPendiente = useCallback((id: string) => pendientes.current.has(id), []);

  useEffect(() => {
    const mapa = pendientes.current;
    return () => {
      // Salir de la pantalla no cancela: lo que se guardó, se guarda.
      for (const [id, p] of mapa) {
        clearTimeout(p.timer);
        mapa.delete(id);
        void p.run();
      }
    };
  }, []);

  return { programar, hayPendiente, ejecutarYa: ejecutar };
}
