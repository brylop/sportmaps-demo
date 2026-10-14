/**
 * Pintor de la jugada animada en un <canvas> fuera de la página: lo comparten
 * el video (MediaRecorder, tacticalVideo.ts) y el GIF (tacticalGif.ts), así la
 * interpolación y el dibujo son uno solo (spec docs/specs/pizarra-nivel-tacticalpad.md §4, T2).
 *
 * Capas, para que alcance a 30 fps en un celular de gama media:
 *  - FONDO por cuadro (cacheado): cancha + figuras de ese cuadro, rasterizado
 *    UNA vez desde TacticalStaticSvg (SVG → <img>, misma técnica que tacticalImage.tsx).
 *    Las figuras solo cambian al final de cada transición, así que hay a lo sumo
 *    un fondo por cuadro.
 *  - JUGADORES y BALÓN: se dibujan con canvas 2D en cada paso (copian el dibujo
 *    de renderPlayer/BallGlyph de TacticalStaticSvg). Rasterizar el SVG entero en
 *    cada paso no llega a tiempo real y MediaRecorder graba en tiempo real.
 */
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import { isGoalkeeperLabel } from '@/lib/school/tacticalPalette';
import type { TacticalSport } from '@/lib/school/tacticalSports';
import { tacticalSvgMarkup } from './tacticalImage';
import { framesDuration, interpolateFrames } from './tacticalInterpolation';
import { svgMarkupToImage } from './tacticalExportUtils';

// ─── Dibujo de jugadores y balón (copia de TacticalStaticSvg) ──────────────

export const VIEW_W = 300;
export const VIEW_H = 340;
const PIN_R = 11;
const FONT = 'Helvetica, Arial, sans-serif';

function initialsOf(name: string) {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dibuja en unidades del viewBox (300×340): el ctx ya viene escalado. */
function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, jersey: number | null | undefined) {
  const text = jersey != null && String(jersey) !== '' ? String(jersey) : initialsOf(label);
  const fill = label && isGoalkeeperLabel(label) ? '#eab308' : '#10b981';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(x, y + 1.2, PIN_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, PIN_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (text) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${text.length > 2 ? 7 : 8.5}px ${FONT}`;
    ctx.fillText(text, x, y + 0.3);
  }
  if (label) {
    const w = Math.min(44, Math.max(14, label.length * 3.1 + 6));
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, x - w / 2, y + PIN_R + 1.5, w, 7.5, 3.75);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 5.2px ${FONT}`;
    ctx.fillText(label.length > 14 ? `${label.slice(0, 13)}…` : label, x, y + PIN_R + 5.4);
  }
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const r = 5;
  const k = r / 6;
  ctx.fillStyle = '#fafafa';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = k;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  const pent = [[0, -2.4], [2.3, -0.7], [1.4, 2], [-1.4, 2], [-2.3, -0.7]];
  pent.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * k, y + py * k) : ctx.moveTo(x + px * k, y + py * k)));
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * ((2 * Math.PI) / 5);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 4.3 * k, y + Math.sin(a) * 4.3 * k, 1.1 * k, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Par y ≥ 2 (los codecs de video lo exigen; al GIF no le molesta). */
export const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export interface TacticalRendererOptions {
  frames: TacticalFrame[];
  playerLabels?: Record<string, string>;
  playerJerseys?: Record<string, number | null>;
  width: number;
  /** Cancha de fondo (T4). Sin deporte = fútbol 11. Mismo viewBox 300×340 en todas. */
  sport?: TacticalSport | null;
  /** Pausa en el primer cuadro antes de arrancar y en el último al terminar. */
  holdStartMs: number;
  holdEndMs: number;
  /** El GIF lee los píxeles en cada cuadro (getImageData). */
  willReadFrequently?: boolean;
  signal?: AbortSignal;
}

export interface TacticalFrameRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Duración total en ms: pausa inicial + jugada + pausa final. */
  length: number;
  /** Pinta el instante `elapsed` (ms desde el inicio, pausa inicial incluida). */
  draw: (elapsed: number) => void;
  /** Suelta la memoria del canvas (iOS tiene un tope de memoria de canvas por página). */
  dispose: () => void;
}

export const abortError = () => new DOMException('Exportación cancelada', 'AbortError');

export async function createTacticalFrameRenderer(opts: TacticalRendererOptions): Promise<TacticalFrameRenderer> {
  const { frames, playerLabels, playerJerseys, signal } = opts;
  const width = even(opts.width);
  const height = even((width * VIEW_H) / VIEW_W);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', opts.willReadFrequently ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new Error('Canvas no disponible.');

  // Fondos cacheados ANTES de pintar, así el bucle no espera decodificaciones.
  // Cuadros con las mismas figuras comparten fondo.
  const layerByKey = new Map<string, HTMLImageElement>();
  const layerOfFrame: HTMLImageElement[] = [];
  for (const f of frames) {
    const key = JSON.stringify(f.arrows || []);
    let img = layerByKey.get(key);
    if (!img) {
      img = await svgMarkupToImage(tacticalSvgMarkup([], f.arrows || [], width, opts.sport));
      layerByKey.set(key, img);
    }
    layerOfFrame.push(img);
    if (signal?.aborted) throw abortError();
  }

  const scale = width / VIEW_W;
  const total = framesDuration(frames);
  const length = opts.holdStartMs + total + opts.holdEndMs;

  const draw = (elapsed: number) => {
    const st = interpolateFrames(frames, elapsed - opts.holdStartMs);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(layerOfFrame[st.arrowsFrameIndex], 0, 0, width, height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const p of st.players) {
      if (p.opacity <= 0.01) continue;
      ctx.globalAlpha = p.opacity;
      const label = (playerLabels?.[p.key] ?? (p.key.startsWith('slot:') ? p.key.slice(5) : '')).trim();
      drawPlayer(ctx, p.x * 3, p.y * 3.4, label, playerJerseys?.[p.key]);
    }
    if (st.ball && st.ball.opacity > 0.01) {
      ctx.globalAlpha = st.ball.opacity;
      drawBall(ctx, st.ball.x * 3, st.ball.y * 3.4);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const dispose = () => {
    layerByKey.clear();
    layerOfFrame.length = 0;
    canvas.width = 0;
    canvas.height = 0;
  };

  return { canvas, ctx, width, height, length, draw, dispose };
}
