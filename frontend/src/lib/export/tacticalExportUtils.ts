/**
 * Utilidades compartidas del export de la pizarra (T2): carga de imágenes,
 * texto apto para las fuentes estándar de jsPDF y nombres de archivo.
 */

/** Carga una imagen (data URL u object URL) y espera a que decodifique. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo dibujar la jugada táctica.'));
    el.src = src;
  });
}

/** SVG serializado → <img> listo para drawImage (misma técnica que tacticalImage.tsx). */
export async function svgMarkupToImage(markup: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))), type);
  });
}

/** Caracteres extra de WinAnsi (lo que las fuentes estándar de jsPDF pintan
 *  además de Latin-1). Igual que clean() de MesocycleExportButton: fuera de
 *  eso un carácter sale como basura, así que se cambia o se quita (emojis…). */
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
export function cleanPdfText(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[→⇒➜➔]/g, '->')
    .replace(/[←⇐]/g, '<-')
    .replace(/[✓✔]/g, 'v')
    .replace(/[^\n\t\x20-\xFF]/g, (ch) => (WIN_ANSI_EXTRA.includes(ch) ? ch : ''))
    .trim();
}

/** «Salida de balón 4-4-2» → «salida-de-balon-4-4-2». */
export function slugify(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

export function exportFileName(title: string | undefined, ext: string, prefix = 'jugada'): string {
  const slug = slugify(title || '');
  return `${slug ? `${prefix}-${slug}` : prefix}.${ext}`;
}
