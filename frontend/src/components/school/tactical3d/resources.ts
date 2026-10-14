import { useEffect, useMemo, type DependencyList } from 'react';
/**
 * Contabilidad de recursos de GPU del visor 3D: cada geometría, material y
 * textura que el visor crea a mano pasa por `track` y se libera con `release`.
 * Al cerrar el visor `live` vuelve a 0 y cada contexto WebGL abierto se pierde
 * (lo verifica la prueba de abrir/cerrar 5 veces).
 */

interface Disposable { dispose: () => void }

export const tactical3dStats = {
  /** Recursos creados a mano y todavía sin liberar. */
  live: 0,
  created: 0,
  contextsCreated: 0,
  contextsLost: 0,
};

export function track<T extends Disposable>(obj: T): T {
  tactical3dStats.live += 1;
  tactical3dStats.created += 1;
  return obj;
}

export function release(...objs: (Disposable | null | undefined)[]) {
  for (const o of objs) {
    if (!o) continue;
    o.dispose();
    tactical3dStats.live -= 1;
  }
}

/** Recursos de un componente de la escena: se crean con `factory` (cada uno
 *  con `track`) y se liberan al desmontar o al cambiar `deps`. Solo dentro del
 *  <Canvas>: el reconciliador de three no corre en StrictMode, así que el
 *  efecto no se monta dos veces. */
export function useResources<T extends Record<string, Disposable>>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const res = useMemo(factory, deps);
  useEffect(() => () => release(...Object.values(res)), [res]);
  return res;
}
