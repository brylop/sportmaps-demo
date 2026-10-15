/**
 * Pantalla completa de la pizarra (M6g). La pizarra ya es un diálogo que tapa
 * la ventana; «pantalla completa» además esconde la barra del navegador.
 *
 * - Con Fullscreen API se pide sobre el DOCUMENTO entero (no sobre el
 *   diálogo): los menús, toasts y diálogos de Radix se montan en un portal en
 *   <body>, y si el elemento en pantalla completa fuera el diálogo quedarían
 *   por fuera, invisibles.
 * - iPhone (Safari no expone la API fuera de <video>): modo «ventana fija»,
 *   el diálogo se fija a la vista VISIBLE (100dvh, sin la franja que tapa la
 *   barra de Safari con 100vh) y se oculta lo que no es la cancha.
 */
type FsDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export type FullscreenMode = 'native' | 'fallback';

export function nativeFullscreenAvailable(doc: Document = document): boolean {
  const d = doc as FsDoc;
  const el = d.documentElement as FsEl | null;
  return !!el && (
    (d.fullscreenEnabled === true && typeof el.requestFullscreen === 'function')
    || (d.webkitFullscreenEnabled === true && typeof el.webkitRequestFullscreen === 'function')
  );
}

export function isNativeFullscreen(doc: Document = document): boolean {
  const d = doc as FsDoc;
  return !!(d.fullscreenElement ?? d.webkitFullscreenElement);
}

/** Entra a pantalla completa. Devuelve el modo que quedó: si la API no está o
 *  el navegador la niega, el que llama usa la ventana fija. */
export async function enterBoardFullscreen(doc: Document = document): Promise<FullscreenMode> {
  if (!nativeFullscreenAvailable(doc)) return 'fallback';
  const el = doc.documentElement as FsEl;
  try {
    if (typeof el.requestFullscreen === 'function') await el.requestFullscreen();
    else await el.webkitRequestFullscreen?.();
    return 'native';
  } catch {
    return 'fallback';
  }
}

export async function exitBoardFullscreen(doc: Document = document): Promise<void> {
  if (!isNativeFullscreen(doc)) return;
  const d = doc as FsDoc;
  try {
    if (typeof d.exitFullscreen === 'function') await d.exitFullscreen();
    else await d.webkitExitFullscreen?.();
  } catch {
    /* ya había salido */
  }
}

/** Estilo de la ventana fija (iOS sin Fullscreen API). Va inline en el
 *  DialogContent: le gana a .dialog-safe sin tocar el componente compartido. */
export const FALLBACK_FULLSCREEN_STYLE = {
  position: 'fixed',
  left: 0,
  top: 0,
  // La base del DialogContent lo centra con translate(-50%, -50%).
  transform: 'none',
  width: '100vw',
  height: '100dvh',
  maxHeight: '100dvh',
  zIndex: 60,
} as const;
