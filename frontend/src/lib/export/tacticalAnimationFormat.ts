/**
 * ¿Qué sale al exportar la jugada animada: video o GIF?
 * (spec docs/specs/pizarra-nivel-tacticalpad.md §4 «Export de video»).
 *
 * Módulo LIVIANO a propósito (sin React, sin jsPDF, sin react-dom/server): el
 * menú de exportar lo importa directo para rotular el ítem («Video» o
 * «Animación GIF») sin cargar el trabajo pesado.
 *
 *  - MediaRecorder + canvas.captureStream + algún mimeType de video → video.
 *  - Si falta cualquiera (Safari viejo, WebView de iOS, Capacitor…) → GIF.
 */

export type TacticalVideoFormat = 'auto' | 'mp4' | 'webm';

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

/** Lo mínimo del entorno que se mira (inyectable en las pruebas). */
export interface AnimationEnv {
  MediaRecorder?: { isTypeSupported?: (t: string) => boolean };
  HTMLCanvasElement?: { prototype: object };
}

function defaultEnv(): AnimationEnv | undefined {
  return typeof window === 'undefined' ? undefined : (globalThis as AnimationEnv);
}

/** ¿Se puede grabar video aquí? (para habilitar el ítem del menú sin intentarlo). */
export function canRecordVideo(env: AnimationEnv | undefined = defaultEnv()): boolean {
  if (!env) return false;
  const MR = env.MediaRecorder;
  if (!MR || typeof MR.isTypeSupported !== 'function') return false;
  const canvasProto = env.HTMLCanvasElement?.prototype;
  if (!canvasProto || !('captureStream' in canvasProto)) return false;
  const isTypeSupported = MR.isTypeSupported.bind(MR);
  return pickVideoMime((t) => isTypeSupported(t)) !== null;
}

export type TacticalAnimationKind = 'video' | 'gif';

/** Video si el navegador lo graba; si no, GIF. */
export function pickAnimationKind(env?: AnimationEnv): TacticalAnimationKind {
  return canRecordVideo(env ?? defaultEnv()) ? 'video' : 'gif';
}

/** Rótulo del ítem del menú: dice con palabras qué archivo va a salir. */
export function animationLabel(kind: TacticalAnimationKind): string {
  return kind === 'video' ? 'Video de la jugada' : 'Animación GIF de la jugada';
}
