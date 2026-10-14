/**
 * Historial de deshacer/rehacer de la pizarra táctica (T1). Lógica pura sobre
 * un objeto mutable (vive en un useRef del tablero): se prueba en unidad
 * (src/test/tacticalHistory.test.ts).
 *
 * `base` es el estado ya anotado; `commit` lo empuja a `undo` cuando llega uno
 * distinto (comparado por `key`). Toda acción del tablero (mover jugadores,
 * dibujar, agregar/quitar/REORDENAR cuadros, cambiar la duración) entra por
 * aquí sin que cada función tenga que acordarse.
 */
export interface HistoryState<T> {
  undo: T[];
  redo: T[];
  base: T | null;
  baseKey: string;
}

export const HISTORY_CAP = 50;

export function emptyHistory<T>(): HistoryState<T> {
  return { undo: [], redo: [], base: null, baseKey: '' };
}

/** Fija el estado de partida sin crear un paso (carga, o tras deshacer). */
export function historySetBase<T>(h: HistoryState<T>, snap: T, key: string): void {
  h.base = snap;
  h.baseKey = key;
}

/** Anota `snap` como paso nuevo. false si no hay base o no cambió nada. */
export function historyCommit<T>(h: HistoryState<T>, snap: T, key: string, cap = HISTORY_CAP): boolean {
  if (h.base === null) return false;
  if (key === h.baseKey) return false;
  h.undo.push(h.base);
  if (h.undo.length > cap) h.undo.shift();
  h.redo = [];
  h.base = snap;
  h.baseKey = key;
  return true;
}

/** Vuelve un paso. Devuelve el estado a aplicar, o null si no hay. */
export function historyUndo<T>(h: HistoryState<T>, keyOf: (s: T) => string): T | null {
  if (h.base === null || h.undo.length === 0) return null;
  const prev = h.undo.pop() as T;
  h.redo.push(h.base);
  historySetBase(h, prev, keyOf(prev));
  return prev;
}

/** Rehace un paso. Devuelve el estado a aplicar, o null si no hay. */
export function historyRedo<T>(h: HistoryState<T>, keyOf: (s: T) => string): T | null {
  if (h.base === null || h.redo.length === 0) return null;
  const next = h.redo.pop() as T;
  h.undo.push(h.base);
  historySetBase(h, next, keyOf(next));
  return next;
}
