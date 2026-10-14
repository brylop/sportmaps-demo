/**
 * Lo mínimo del visor 3D (M4) que la pizarra necesita ANTES de cargar el
 * chunk de three: ¿hay WebGL2?, el aviso de caída a 2D y la forma de la
 * entrada (lo que ya arma «Exportar»). Puro y liviano a propósito: esto sí
 * entra al chunk de la pizarra; todo lo demás va en el chunk del visor.
 */
import type { TacticalArrow } from './footballQueries';
import type { TacticalFrame } from './tacticalFrames';
import type { TacticalSport } from './tacticalSports';

/** WebGL2 disponible. `create` se inyecta en las pruebas. */
export function detectWebGL2(create: () => { getContext: (id: string) => unknown } | null = defaultCanvas): boolean {
  try {
    const c = create();
    if (!c) return false;
    const gl = c.getContext('webgl2') as { getExtension?: (n: string) => { loseContext?: () => void } | null } | null;
    if (!gl) return false;
    // Suelta el contexto de prueba ya: el navegador tiene un cupo de contextos.
    gl.getExtension?.('WEBGL_lose_context')?.loseContext?.();
    return true;
  } catch {
    return false;
  }
}

function defaultCanvas() {
  return typeof document === 'undefined' ? null : document.createElement('canvas');
}

export const FALLBACK_TOAST = 'Tu celular no soporta bien el 3D; seguimos en 2D';

// ─── Entrada del visor ──────────────────────────────────────────────────────

/** Lo que el visor necesita de la pizarra (subconjunto estructural de
 *  TacticalExportInput, lo mismo que ya arma «Exportar»). */
export interface Viewer3DSource {
  frames: TacticalFrame[] | null;
  players: { x: number; y: number; label?: string | null; jersey?: number | null }[];
  arrows: TacticalArrow[];
  playerLabels?: Record<string, string>;
  playerJerseys?: Record<string, number | null>;
  sport?: TacticalSport | null;
  title?: string | null;
  /** Segundo juego de cuadros encima (en rojo): los rivales de un
   *  contraataque o variante de la IA (M3). Mismo reloj que la jugada. */
  overlayFrames?: TacticalFrame[] | null;
  /** Etiquetas ya humanizadas de la superposición («Rival 3»). */
  overlayLabels?: Record<string, string>;
  /** Leyenda de la superposición («Contraataque del rival»). */
  overlayName?: string;
  /** Tarjeta de la IA tal cual: el visor la convierte en jugada + superposición
   *  al abrir (tactical3dSuggestion.ts, en el chunk del 3D, no en la pizarra). */
  aiSuggestion?: { kind: 'contraataque' | 'variante'; titulo: string; frames: TacticalFrame[] } | null;
}

/** Piso de fps forzado desde afuera (solo lo usan los e2e con WebGL por
 *  software: `window.__TACTICAL3D_MIN_FPS__ = 0`). */
export function minFpsOverride(): number | undefined {
  const v = typeof window === 'undefined' ? undefined : (window as { __TACTICAL3D_MIN_FPS__?: unknown }).__TACTICAL3D_MIN_FPS__;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}
