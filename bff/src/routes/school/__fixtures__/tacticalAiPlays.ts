/**
 * Jugadas de ejemplo por deporte para las pruebas de la IA de la pizarra (y
 * para la corrida real revisada a ojo). Mismo formato que manda el frontend:
 * claves reales `athlete:<uuid>` (para probar que NO llegan al modelo),
 * rivales como figuras 'opponent' y el balón como figura 'ball'.
 */
import { COURTS, xAtMeters, yAtMeters, type AiSport } from '../tacticalAiShapes';

type Pt = [number, number]; // fracción de la cancha: x desde la banda izq., y desde el fondo RIVAL
interface PlaySpec {
  own: [number, number, string][];
  rivals: Pt[];
  /** Cuadros 2..n: índice del propio → nueva posición. */
  moves: Record<number, Pt>[];
  balls: Pt[];
  /** Flechas del cuadro 1: [desde índice propio, hasta]. */
  runs?: [number, Pt][];
}

const SPECS: Record<AiSport, PlaySpec> = {
  futbol: {
    own: [[0.5, 0.96, 'Arquero'], [0.85, 0.7, 'Lateral der.'], [0.62, 0.78, 'Central'], [0.38, 0.78, 'Central'], [0.15, 0.7, 'Lateral izq.'],
      [0.5, 0.6, 'Volante'], [0.3, 0.5, 'Medio'], [0.7, 0.5, 'Medio'], [0.12, 0.35, 'Extremo izq.'], [0.88, 0.35, 'Extremo der.'], [0.5, 0.3, 'Delantero']],
    rivals: [[0.2, 0.18], [0.4, 0.17], [0.6, 0.17], [0.8, 0.18], [0.4, 0.32], [0.6, 0.32], [0.5, 0.03]],
    moves: [{ 1: [0.92, 0.42], 9: [0.72, 0.27], 4: [0.2, 0.5] }, { 1: [0.93, 0.2], 10: [0.5, 0.13], 7: [0.6, 0.3] }],
    balls: [[0.5, 0.6], [0.92, 0.42], [0.5, 0.13]],
    runs: [[1, [0.92, 0.42]]],
  },
  futbol7: {
    own: [[0.5, 0.95, 'Arquero'], [0.3, 0.75, 'Defensa'], [0.7, 0.75, 'Defensa'], [0.15, 0.5, 'Volante izq.'], [0.5, 0.55, 'Medio'], [0.85, 0.5, 'Volante der.'], [0.5, 0.25, 'Delantero']],
    rivals: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.5, 0.04]],
    moves: [{ 5: [0.88, 0.25], 2: [0.7, 0.55], 4: [0.55, 0.4] }, { 6: [0.45, 0.12], 5: [0.85, 0.12] }],
    balls: [[0.5, 0.55], [0.88, 0.25], [0.45, 0.12]],
  },
  futbol5: {
    own: [[0.5, 0.94, 'Arquero'], [0.5, 0.75, 'Defensa'], [0.2, 0.55, 'Volante izq.'], [0.8, 0.55, 'Volante der.'], [0.5, 0.3, 'Delantero']],
    rivals: [[0.35, 0.25], [0.65, 0.25], [0.5, 0.05]],
    moves: [{ 2: [0.15, 0.3], 1: [0.4, 0.5] }, { 4: [0.6, 0.15], 2: [0.2, 0.15] }],
    balls: [[0.5, 0.75], [0.15, 0.3], [0.6, 0.15]],
  },
  futsal: {
    own: [[0.5, 0.94, 'Arquero'], [0.5, 0.75, 'Cierre'], [0.18, 0.58, 'Ala izq.'], [0.82, 0.58, 'Ala der.'], [0.5, 0.3, 'Pívot']],
    rivals: [[0.3, 0.35], [0.7, 0.35], [0.3, 0.15], [0.7, 0.15], [0.5, 0.03]],
    moves: [{ 1: [0.8, 0.45], 3: [0.85, 0.25], 4: [0.35, 0.22] }, { 3: [0.7, 0.1], 1: [0.6, 0.35] }],
    balls: [[0.5, 0.75], [0.8, 0.45], [0.7, 0.1]],
  },
  voleibol: {
    own: [[0.8, 0.9, 'Zona 1'], [0.65, 0.58, 'Armador'], [0.5, 0.6, 'Central'], [0.2, 0.6, 'Receptor'], [0.2, 0.9, 'Receptor'], [0.5, 0.9, 'Líbero']],
    rivals: [[0.2, 0.42], [0.5, 0.42], [0.8, 0.42], [0.2, 0.12], [0.5, 0.12], [0.8, 0.12]],
    moves: [{ 3: [0.15, 0.56], 2: [0.45, 0.53] }, { 3: [0.18, 0.52] }],
    balls: [[0.5, 0.88], [0.65, 0.56], [0.75, 0.15]],
  },
  baloncesto: {
    own: [[0.5, 0.45, 'Base'], [0.85, 0.3, 'Escolta'], [0.15, 0.3, 'Alero'], [0.35, 0.12, 'Ala-pívot'], [0.65, 0.12, 'Pívot']],
    rivals: [[0.35, 0.25], [0.65, 0.25], [0.2, 0.12], [0.5, 0.08], [0.8, 0.12]],
    moves: [{ 4: [0.58, 0.38] }, { 0: [0.4, 0.2], 4: [0.6, 0.15] }],
    balls: [[0.5, 0.45], [0.48, 0.4], [0.4, 0.2]],
  },
  balonmano: {
    own: [[0.5, 0.97, 'Portero'], [0.05, 0.12, 'Extremo izq.'], [0.25, 0.25, 'Lateral izq.'], [0.5, 0.28, 'Central'], [0.75, 0.25, 'Lateral der.'], [0.95, 0.12, 'Extremo der.'], [0.5, 0.16, 'Pivote']],
    rivals: [[0.08, 0.08], [0.25, 0.15], [0.42, 0.17], [0.58, 0.17], [0.75, 0.15], [0.92, 0.08], [0.5, 0.02]],
    moves: [{ 3: [0.62, 0.24], 4: [0.55, 0.22] }, { 4: [0.45, 0.2], 6: [0.4, 0.14] }],
    balls: [[0.5, 0.28], [0.62, 0.24], [0.45, 0.2]],
  },
};

export const FAKE_ROSTER_NAMES = [
  'Juan David Pérez', 'Sofía Gómez', 'Mateo Ramírez', 'Valentina Ruiz', 'Samuel Torres', 'Isabella Castro',
  'Santiago Herrera', 'Mariana López', 'Tomás Rincón', 'Luciana Vargas', 'Emiliano Rojas',
];

export const fakeKey = (i: number) => `athlete:0000000${i}-aaaa-4bbb-8ccc-${String(100000000000 + i)}`;

/** Jugada en formato del frontend + etiquetas (una con NOMBRE para probar el borrado). */
export function samplePlay(sport: AiSport) {
  const c = COURTS[sport];
  const s = SPECS[sport];
  const P = ([fx, fy]: Pt) => ({ x: Math.round(xAtMeters(c, fx * c.widthM) * 10) / 10, y: Math.round(yAtMeters(c, fy * c.lengthM) * 10) / 10 });
  const positions: Pt[][] = [s.own.map(([x, y]) => [x, y] as Pt)];
  for (const mv of s.moves) {
    const prev = positions[positions.length - 1];
    positions.push(prev.map((p, i) => mv[i] ?? p));
  }
  const frames = positions.map((pos, fi) => ({
    id: `f${fi + 1}`,
    duration_ms: fi === 0 ? 1200 : 1500,
    players: pos.map((p, i) => ({ key: fakeKey(i), ...P(p) })),
    ball: null,
    arrows: [
      { type: 'ball', ...(() => { const b = P(s.balls[fi] ?? s.balls[s.balls.length - 1]); return { x1: b.x, y1: b.y, x2: b.x, y2: b.y }; })() },
      ...s.rivals.map((r) => { const q = P(r); return { type: 'opponent', x1: q.x, y1: q.y, x2: q.x, y2: q.y, color: 'red' }; }),
      ...(fi === 0 ? (s.runs ?? []).map(([i, to]) => { const a = P(s.own[i] as unknown as Pt); const b = P(to); return { type: 'arrow', x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: 'yellow' }; }) : []),
      ...(fi === 0 ? [{ type: 'text', x1: 50, y1: 50, x2: 50, y2: 50, text: 'Sofía presiona' }] : []),
    ],
  }));
  const labels: Record<string, string> = {};
  s.own.forEach(([, , label], i) => { labels[fakeKey(i)] = label; });
  labels[fakeKey(1)] = 'Sofi'; // nombre en la etiqueta: no debe llegar al modelo
  return { team_id: '11111111-2222-4333-8444-555555555555', sport, frames, labels, colors: { own: 'green', rival: 'red' } };
}
