/**
 * Compartir un archivo exportado de la pizarra (T2): Web Share API nivel 2 en
 * el celular (abre la hoja de compartir: WhatsApp, correo…); en escritorio, o
 * si el navegador no comparte archivos, se descarga con file-saver y se
 * devuelve un enlace wa.me con el texto para abrir WhatsApp aparte.
 */
import { saveAs } from 'file-saver';

export type ShareMethod = 'share' | 'download' | 'cancelled';

export interface ShareResult {
  method: ShareMethod;
  /** Enlace wa.me con el texto (sin archivo: wa.me no adjunta). */
  whatsappUrl: string;
}

export function whatsappTextUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Celular o tablet: la hoja de compartir del sistema tiene WhatsApp a mano. */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  // iPadOS se presenta como Mac con pantalla táctil.
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
}

export async function shareFile(blob: Blob, filename: string, text: string): Promise<ShareResult> {
  const whatsappUrl = whatsappTextUrl(text);
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && isMobileDevice() && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    let can = false;
    try {
      can = nav.canShare({ files: [file] });
    } catch {
      can = false;
    }
    if (can) {
      try {
        await nav.share({ files: [file], text, title: filename });
        return { method: 'share', whatsappUrl };
      } catch (e) {
        // El usuario cerró la hoja: no descargar a sus espaldas.
        if (e instanceof Error && e.name === 'AbortError') return { method: 'cancelled', whatsappUrl };
        // NotAllowedError (se venció el gesto del usuario) u otro: se descarga.
      }
    }
  }
  saveAs(blob, filename);
  return { method: 'download', whatsappUrl };
}
