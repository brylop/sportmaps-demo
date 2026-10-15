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
import { staticSvgHeight, TacticalStaticSvg, type TacticalStaticPlayer } from '@/components/school/TacticalStaticSvg';
import type { TacticalSport } from '@/lib/school/tacticalSports';
import { chipCaption, chipInnerText, chipLook, type TacticalTeamsConfig } from '@/lib/school/tacticalTeams';
import { isGoalkeeperLabel } from '@/lib/school/tacticalPalette';
import { TeamPlayerGlyph } from '@/components/school/tacticalTeamGlyphs';

/** Ancho en px del PNG. 600 px a ~70 mm ≈ 220 dpi: nítido impreso, liviano. */
const DEFAULT_WIDTH_PX = 600;

/** `sport` (T4): la cancha del deporte del equipo; sin él, fútbol 11 como siempre. */
export function tacticalSvgMarkup(
  players: TacticalStaticPlayer[],
  arrows: TacticalArrow[],
  widthPx = DEFAULT_WIDTH_PX,
  sport?: TacticalSport | null,
  teams?: TacticalTeamsConfig | null,
): string {
  return renderToStaticMarkup(<TacticalStaticSvg players={players} arrows={arrows} width={widthPx} sport={sport} teams={teams} />);
}

export async function renderTacticalPng(
  players: TacticalStaticPlayer[],
  arrows: TacticalArrow[],
  widthPx = DEFAULT_WIDTH_PX,
  sport?: TacticalSport | null,
  teams?: TacticalTeamsConfig | null,
): Promise<{ dataUrl: string; aspect: number }> {
  // M6d: la cámara/orientación del «Campo» cambian la proporción (sin «Campo», 340/300 como siempre).
  const heightPx = staticSvgHeight(arrows, widthPx);
  const markup = tacticalSvgMarkup(players, arrows, widthPx, sport, teams);
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

/** M6b: caja (en unidades del viewBox) de la ficha de un jugador con su
 *  etiqueta, para pintarla como imagen en el video/GIF. */
export function teamPlayerBox(playerScale: number) {
  return { x: -23 * playerScale, y: -14 * playerScale, w: 46 * playerScale, h: 36 * playerScale };
}

/** M6b: SVG suelto de UN jugador propio con la configuración de equipos (el
 *  pintor de cuadros lo rasteriza una vez por jugador). Mismo dibujo que
 *  TacticalStaticSvg. */
export function teamPlayerMarkup(
  teams: TacticalTeamsConfig,
  p: { label?: string | null; jersey?: number | null; name?: string | null },
  pxPerUnit: number,
): string {
  const box = teamPlayerBox(teams.player_scale);
  const label = (p.label ?? '').trim();
  const subject = { number: p.jersey != null && String(p.jersey) !== '' ? String(p.jersey) : null, name: p.name ?? null, position: label || null };
  const look = chipLook(teams.home, !!label && isGoalkeeperLabel(label));
  return renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      width={Math.ceil(box.w * pxPerUnit)} height={Math.ceil(box.h * pxPerUnit)}>
      <TeamPlayerGlyph x={0} y={0} r={11 * teams.player_scale} look={look}
        text={chipInnerText(teams.home, subject)} caption={chipCaption(teams.home, subject)} />
    </svg>,
  );
}
