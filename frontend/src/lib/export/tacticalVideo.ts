/**
 * Video de la jugada animada (spec docs/specs/pizarra-nivel-tacticalpad.md §4, T2).
 *
 * Se pinta la animación en un <canvas> fuera de la página y se graba con
 * canvas.captureStream() + MediaRecorder. Todo en el cliente: cero almacenamiento.
 *
 * Capas, para que alcance a 30 fps en un celular de gama media:
 *  - FONDO por cuadro (cacheado): cancha + figuras de ese cuadro, rasterizado
 *    UNA vez desde TacticalStaticSvg (SVG → <img>, misma técnica que tacticalImage.tsx).
 *    Las figuras solo cambian al final de cada transición, así que hay a lo sumo
 *    un fondo por cuadro.
 *  - JUGADORES y BALÓN: se dibujan con canvas 2D en cada paso (copian el dibujo
 *    de renderPlayer/BallGlyph de TacticalStaticSvg). Rasterizar el SVG entero en
 *    cada paso no llega a tiempo real y MediaRecorder graba en tiempo real.
 *
 * MediaRecorder graba a reloj de pared: la grabación dura lo que dura la jugada.
 * Sin MediaRecorder (o sin captureStream) se lanza TacticalVideoUnsupportedError
 * para que la UI ofrezca «Descargar imagen».
 */
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import { isGoalkeeperLabel } from '@/lib/school/tacticalPalette';
import { tacticalSvgMarkup } from './tacticalImage';
import { framesDuration, interpolateFrames } from './tacticalInterpolation';
import { svgMarkupToImage } from './tacticalExportUtils';

export type TacticalVideoFormat = 'auto' | 'mp4' | 'webm';

export interface ExportVideoOptions {
  frames: TacticalFrame[];
  playerLabels?: Record<string, string>;
  playerJerseys?: Record<string, number | null>;
  fps?: number;
  width?: number;
  format?: TacticalVideoFormat;
  /** Pausa en el primer cuadro antes de arrancar y en el último al terminar. */
  holdStartMs?: number;
  holdEndMs?: number;
  /** 0-1 a medida que avanza la grabación. */
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

export interface ExportVideoResult {
  blob: Blob;
  mime: string;
  ext: 'mp4' | 'webm';
}

export type TacticalVideoUnsupportedReason = 'no_media_recorder' | 'no_capture_stream' | 'no_codec' | 'too_few_frames';

/** Error tipado: la UI lo distingue para ofrecer la imagen en lugar del video. */
export class TacticalVideoUnsupportedError extends Error {
  readonly code = 'TACTICAL_VIDEO_UNSUPPORTED' as const;
  constructor(readonly reason: TacticalVideoUnsupportedReason) {
    super(
      reason === 'too_few_frames'
        ? 'La jugada necesita al menos 2 cuadros para hacer un video.'
        : 'Este navegador no puede grabar video. Descarga la imagen.',
    );
    this.name = 'TacticalVideoUnsupportedError';
  }
}

export function isTacticalVideoUnsupported(e: unknown): e is TacticalVideoUnsupportedError {
  return !!e && typeof e === 'object' && (e as { code?: string }).code === 'TACTICAL_VIDEO_UNSUPPORTED';
}

const MP4_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];
const WEBM_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

/** Primer tipo que el navegador graba. MP4 primero: WhatsApp lo abre en todos lados. */
export function pickVideoMime(
  isTypeSupported: (t: string) => boolean,
  format: TacticalVideoFormat = 'auto',
): { mime: string; ext: 'mp4' | 'webm' } | null {
  const order = format === 'mp4' ? MP4_TYPES : format === 'webm' ? WEBM_TYPES : [...MP4_TYPES, ...WEBM_TYPES];
  for (const t of order) {
    try {
      if (isTypeSupported(t)) return { mime: t, ext: t.startsWith('video/mp4') ? 'mp4' : 'webm' };
    } catch {
      /* algunos navegadores lanzan con codecs que no conocen */
    }
  }
  return null;
}

/** ¿Se puede grabar video aquí? (para habilitar el ítem del menú sin intentarlo). */
export function canRecordVideo(): boolean {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return false;
  if (typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return false;
  return pickVideoMime((t) => MediaRecorder.isTypeSupported(t)) !== null;
}

// ─── Dibujo de jugadores y balón (copia de TacticalStaticSvg) ──────────────

const VIEW_W = 300;
const VIEW_H = 340;
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

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export async function exportVideo(opts: ExportVideoOptions): Promise<ExportVideoResult> {
  const { frames, playerLabels, playerJerseys, signal, onProgress } = opts;
  const fps = Math.min(60, Math.max(10, opts.fps ?? 30));
  const width = even(opts.width ?? 720);
  const height = even((width * VIEW_H) / VIEW_W);
  const holdStart = opts.holdStartMs ?? 600;
  const holdEnd = opts.holdEndMs ?? 1200;

  if (!frames || frames.length < 2) throw new TacticalVideoUnsupportedError('too_few_frames');
  if (typeof MediaRecorder === 'undefined') throw new TacticalVideoUnsupportedError('no_media_recorder');
  const picked = pickVideoMime((t) => MediaRecorder.isTypeSupported(t), opts.format ?? 'auto');
  if (!picked) throw new TacticalVideoUnsupportedError('no_codec');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  if (typeof canvas.captureStream !== 'function') throw new TacticalVideoUnsupportedError('no_capture_stream');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new TacticalVideoUnsupportedError('no_capture_stream');

  // Fondos cacheados ANTES de grabar, así el bucle no espera decodificaciones.
  // Cuadros con las mismas figuras comparten fondo.
  const layerByKey = new Map<string, HTMLImageElement>();
  const layerOfFrame: HTMLImageElement[] = [];
  for (const f of frames) {
    const key = JSON.stringify(f.arrows || []);
    let img = layerByKey.get(key);
    if (!img) {
      img = await svgMarkupToImage(tacticalSvgMarkup([], f.arrows || [], width));
      layerByKey.set(key, img);
    }
    layerOfFrame.push(img);
    if (signal?.aborted) throw new DOMException('Exportación cancelada', 'AbortError');
  }

  const scale = width / VIEW_W;
  const total = framesDuration(frames);
  const length = holdStart + total + holdEnd;

  const draw = (elapsed: number) => {
    const st = interpolateFrames(frames, elapsed - holdStart);
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
  };

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: picked.mime, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error('Falló la grabación del video.'));
  });

  draw(0);
  recorder.start(250);
  const t0 = performance.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (signal?.aborted) return reject(new DOMException('Exportación cancelada', 'AbortError'));
        const elapsed = performance.now() - t0;
        draw(Math.min(elapsed, length));
        onProgress?.(Math.min(1, elapsed / length));
        if (elapsed >= length) return resolve();
        // setTimeout y no requestAnimationFrame: rAF se congela si la pestaña
        // queda de fondo y el video saldría cortado.
        setTimeout(tick, 1000 / fps);
      };
      tick();
    });
    // Un cuadro más para que el último quede grabado.
    await new Promise((r) => setTimeout(r, 1000 / fps + 50));
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
  }
  await stopped;

  const mime = picked.mime.split(';')[0];
  return { blob: new Blob(chunks, { type: mime }), mime, ext: picked.ext };
}
