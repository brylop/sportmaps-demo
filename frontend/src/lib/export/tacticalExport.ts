/**
 * Exportar la pizarra táctica (spec docs/specs/pizarra-nivel-tacticalpad.md, T2):
 * imagen PNG, ficha del ejercicio en PDF, video de la jugada y compartir.
 *
 * Punto de entrada único; cada pieza vive en su archivo:
 *  - tacticalPdf.ts          ficha A4
 *  - tacticalVideo.ts        MediaRecorder sobre canvas
 *  - tacticalShare.ts        Web Share API / descarga + wa.me
 *  - tacticalInterpolation.ts interpolación pura de cuadros
 */
import type { TacticalArrow } from '@/lib/school/footballQueries';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import type { TacticalStaticPlayer } from '@/components/school/TacticalStaticSvg';
import { renderTacticalPng } from './tacticalImage';
import { canvasToBlob, loadImage } from './tacticalExportUtils';

export { exportExercisePdf, stripSlots, type ExercisePdfInput } from './tacticalPdf';
export {
  exportVideo,
  canRecordVideo,
  pickVideoMime,
  isTacticalVideoUnsupported,
  TacticalVideoUnsupportedError,
  type ExportVideoOptions,
  type ExportVideoResult,
  type TacticalVideoFormat,
} from './tacticalVideo';
export { shareFile, whatsappTextUrl, isMobileDevice, type ShareResult, type ShareMethod } from './tacticalShare';
export { interpolateFrames, framesDuration, frameToStatic, easeInOutCubic, type InterpolatedState } from './tacticalInterpolation';
export { exportFileName, cleanPdfText } from './tacticalExportUtils';

/** Lo que la pizarra entrega al menú de exportar. */
export interface TacticalExportInput {
  title: string;
  teamName?: string | null;
  /** null o 1 cuadro = jugada estática. */
  frames: TacticalFrame[] | null;
  /** Estado que se ve AHORA en la pizarra (para el PNG). */
  players: TacticalStaticPlayer[];
  arrows: TacticalArrow[];
  /** `TacticalFramePlayer.key` → nombre a mostrar bajo el disco. */
  playerLabels?: Record<string, string>;
  /** `TacticalFramePlayer.key` → dorsal. */
  playerJerseys?: Record<string, number | null>;
  objective?: string | null;
  minutes?: number | string | null;
  ageGroup?: string | null;
  materials?: string | null;
  description?: string | null;
}

export interface ExportPngInput {
  players: TacticalStaticPlayer[];
  arrows: TacticalArrow[];
  title?: string | null;
  teamName?: string | null;
  /** Ancho del PNG en px (1080 = nítido en WhatsApp sin pesar de más). */
  widthPx?: number;
}

const BRAND_GREEN = '#1a6118';

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Jugada → PNG con una franja abajo: título + equipo a la izquierda, «SportMaps» a la derecha. */
export async function exportPng(input: ExportPngInput): Promise<Blob> {
  const width = Math.round(input.widthPx ?? 1080);
  const { dataUrl, aspect } = await renderTacticalPng(input.players || [], input.arrows || [], width);
  const pitchH = Math.round(width * aspect);
  const band = Math.max(48, Math.round(width * 0.085));
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = pitchH + band;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible.');
  ctx.drawImage(img, 0, 0, width, pitchH);

  ctx.fillStyle = BRAND_GREEN;
  ctx.fillRect(0, pitchH, width, band);
  const pad = Math.round(band * 0.32);
  const brandFont = Math.round(band * 0.3);
  ctx.font = `800 ${brandFont}px Helvetica, Arial, sans-serif`;
  const brand = 'SportMaps';
  const brandW = ctx.measureText(brand).width;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillText(brand, width - pad, pitchH + band / 2);

  const maxW = width - pad * 3 - brandW;
  const title = (input.title ?? '').trim();
  const team = (input.teamName ?? '').trim();
  ctx.textAlign = 'left';
  if (title && team) {
    ctx.font = `700 ${Math.round(band * 0.28)}px Helvetica, Arial, sans-serif`;
    ctx.fillText(fitText(ctx, title, maxW), pad, pitchH + band * 0.36);
    ctx.globalAlpha = 0.85;
    ctx.font = `500 ${Math.round(band * 0.22)}px Helvetica, Arial, sans-serif`;
    ctx.fillText(fitText(ctx, team, maxW), pad, pitchH + band * 0.7);
    ctx.globalAlpha = 1;
  } else if (title || team) {
    ctx.font = `700 ${Math.round(band * 0.3)}px Helvetica, Arial, sans-serif`;
    ctx.fillText(fitText(ctx, title || team, maxW), pad, pitchH + band / 2);
  }

  return canvasToBlob(canvas, 'image/png');
}
