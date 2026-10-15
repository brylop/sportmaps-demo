/**
 * «Ver en 3D» de una tarjeta de la IA (M3 + M4 de
 * docs/specs/pizarra-multideporte-3d-ia.md). Vive en el chunk del visor 3D
 * (solo lo importa Tactical3DModal): la pizarra manda la sugerencia tal cual
 * en `Viewer3DSource.aiSuggestion` y esto se calcula recién al abrir el 3D.
 *
 * Lo que se ve depende de la tarjeta:
 *  - contraataque: la jugada del coach (lo mismo que arma «Exportar») y,
 *    encima en rojo, SOLO los rivales de la sugerencia con sus trazos;
 *  - variante: la variante de los propios (con sus etiquetas de puesto) y,
 *    encima en rojo, los rivales de la sugerencia.
 * Ninguna clave interna llega a la pantalla: los rivales salen «Rival N».
 */
import { DEFAULT_FRAME_MS, MAX_FRAMES, type TacticalFrame } from './tacticalFrames';
import type { Viewer3DSource } from './tactical3dLaunch';

/** Mismo prefijo que tacticalAi.RIVAL_KEY_PREFIX (sin importarlo: este
 *  archivo va en el chunk del visor y aquel en el de la pizarra). */
const RIVAL = 'rival:';
const isRival = (k: string) => k.startsWith(RIVAL);

/** «rival:3» → «Rival 3» (lo que se ve en 3D encima de la figura). */
export const rivalLabel = (k: string) => `Rival ${Number(k.slice(RIVAL.length)) || '?'}`;

export interface AiSuggestion3D {
  kind: 'contraataque' | 'variante';
  titulo: string;
  frames: TacticalFrame[];
}

export function suggestionViewer3D(base: Viewer3DSource, s: AiSuggestion3D): Viewer3DSource {
  const frames = s.frames.slice(0, MAX_FRAMES);
  const dur = (f: TacticalFrame) => (Number.isFinite(f.duration_ms) ? f.duration_ms : DEFAULT_FRAME_MS);
  const overlayLabels: Record<string, string> = {};
  const overlayFrames: TacticalFrame[] = frames.map((f, i) => {
    const rivals = f.players.filter((p) => isRival(p.key));
    for (const p of rivals) overlayLabels[p.key] = rivalLabel(p.key);
    return {
      id: `ia-r${i}`,
      duration_ms: dur(f),
      players: rivals.map((p) => ({ key: p.key, x: p.x, y: p.y })),
      ball: null,
      // En el contraataque los trazos son del rival; en la variante, de los propios.
      arrows: s.kind === 'contraataque' ? f.arrows.map((a) => ({ ...a })) : [],
    };
  });
  const rest: Viewer3DSource = { ...base, aiSuggestion: null };
  if (s.kind === 'contraataque') {
    return { ...rest, overlayFrames, overlayLabels, overlayName: 'Contraataque del rival' };
  }
  const own: TacticalFrame[] = frames.map((f, i) => ({
    id: `ia-v${i}`,
    duration_ms: dur(f),
    players: f.players.filter((p) => !isRival(p.key)).map((p) => ({ key: p.key, x: p.x, y: p.y })),
    ball: f.ball ? { ...f.ball } : null,
    arrows: f.arrows.map((a) => ({ ...a })),
  }));
  return {
    ...rest,
    frames: own,
    title: s.titulo || base.title,
    overlayFrames,
    overlayLabels,
    overlayName: 'Rivales',
  };
}

/** Lo que el visor dibuja: la fuente tal cual o, si viene de una tarjeta de la IA, resuelta. */
export function resolveViewerSource(src: Viewer3DSource): Viewer3DSource {
  return src.aiSuggestion ? suggestionViewer3D(src, src.aiSuggestion) : src;
}
