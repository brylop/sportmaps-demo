/**
 * Jugadas guardadas ANTES de M6d (estilos de línea, zonas nuevas, foco,
 * numeración, diálogo «Campo»). `m6dOldPlays.baseline.json` guarda su SVG tal
 * como lo dibujaba c88f43a3: tacticalM6dCompat.test.tsx exige que sigan
 * saliendo idénticas. Regenerar SOLO si el cambio de dibujo es a propósito.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { TacticalStaticSvg, type TacticalStaticPlayer } from '@/components/school/TacticalStaticSvg';
import type { TacticalArrow } from '@/lib/school/footballQueries';
import type { TacticalSport } from '@/lib/school/tacticalSports';

export const OLD_SHAPES: TacticalArrow[] = [
  { x1: 12, y1: 70, x2: 30, y2: 40 }, // flecha de antes de `type`
  { type: 'arrow', x1: 10, y1: 10, x2: 20, y2: 20, color: 'yellow' },
  { type: 'curve', x1: 30, y1: 30, x2: 40, y2: 50, color: 'red' },
  { type: 'zone', x1: 50, y1: 50, x2: 70, y2: 60, color: 'blue' },
  { type: 'ball_path', x1: 20, y1: 80, x2: 50, y2: 40, kind: 'pase' },
  { type: 'ball_path', x1: 20, y1: 80, x2: 50, y2: 5, kind: 'remate' },
  { type: 'ball_path', x1: 50, y1: 85, x2: 50, y2: 98, kind: 'penal', color: 'pink' },
  { type: 'freehand', x1: 10, y1: 10, x2: 30, y2: 30, points: [10, 10, 15, 20, 20, 15, 30, 30], color: 'purple' },
  { type: 'text', x1: 50, y1: 50, x2: 50, y2: 50, text: 'Presión alta', color: 'black' },
  { type: 'cone', x1: 5, y1: 5, x2: 5, y2: 5 },
  { type: 'goal', x1: 50, y1: 97, x2: 50, y2: 97, rot: 180 },
  { type: 'ladder', x1: 80, y1: 40, x2: 80, y2: 40, size: 1.5 },
  { type: 'opponent', x1: 60, y1: 30, x2: 60, y2: 30, color: 'red' },
];

export const OLD_PLAYERS: TacticalStaticPlayer[] = [
  { x: 50, y: 92, label: 'Arquero', jersey: 1 },
  { x: 25, y: 70, label: 'Lateral izquierdo', jersey: 3 },
  { x: 50, y: 50, label: 'Volante' },
  { x: 70, y: 20, label: 'Delantero', jersey: 9 },
  { x: 10, y: 10, label: 'Suplente', role: 'bench' },
];

const SPORTS: (TacticalSport | undefined)[] = [undefined, 'futbol', 'futbol7', 'futbol5', 'futsal', 'voleibol', 'baloncesto', 'balonmano', 'generico'];

/** nombre del caso → SVG serializado. */
export function renderOldPlays(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const sport of SPORTS) {
    out[`jugada vieja · ${sport ?? 'sin deporte'}`] = renderToStaticMarkup(
      <TacticalStaticSvg players={OLD_PLAYERS} arrows={OLD_SHAPES} width={600} sport={sport} />,
    );
  }
  out['cancha vacía · fútbol 11'] = renderToStaticMarkup(<TacticalStaticSvg players={[]} arrows={[]} />);
  return out;
}
