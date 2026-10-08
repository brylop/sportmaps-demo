/**
 * Jugada táctica → PNG (data URL) para incrustar en un jsPDF.
 *
 * Serializa TacticalStaticSvg con renderToStaticMarkup y lo pinta en un
 * <canvas> a través de un <img>. No usa html2canvas: html2canvas re-dibuja el
 * DOM a mano y con SVG anidados, patrones y markers se queda corto; el
 * navegador pintando su propio SVG es exacto y no monta nada en la página.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import type { TacticalArrow } from '@/lib/school/footballQueries';
import { TacticalStaticSvg, type TacticalStaticPlayer } from '@/components/school/TacticalStaticSvg';

/** Ancho en px del PNG. 600 px a ~70 mm ≈ 220 dpi: nítido impreso, liviano. */
const DEFAULT_WIDTH_PX = 600;

export function tacticalSvgMarkup(players: TacticalStaticPlayer[], arrows: TacticalArrow[], widthPx = DEFAULT_WIDTH_PX): string {
  return renderToStaticMarkup(<TacticalStaticSvg players={players} arrows={arrows} width={widthPx} />);
}

export async function renderTacticalPng(
  players: TacticalStaticPlayer[],
  arrows: TacticalArrow[],
  widthPx = DEFAULT_WIDTH_PX,
): Promise<{ dataUrl: string; aspect: number }> {
  const heightPx = Math.round((widthPx * 340) / 300);
  const markup = tacticalSvgMarkup(players, arrows, widthPx);
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo dibujar la jugada táctica.'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.drawImage(img, 0, 0, widthPx, heightPx);
    return { dataUrl: canvas.toDataURL('image/png'), aspect: heightPx / widthPx };
  } finally {
    URL.revokeObjectURL(url);
  }
}
