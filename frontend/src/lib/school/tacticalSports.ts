/**
 * Catálogo de deportes de la pizarra táctica (T4 de
 * docs/specs/pizarra-nivel-tacticalpad.md): fondo, medidas de la cancha,
 * jugadores por lado, formaciones de arranque y material que tiene sentido.
 *
 * Lógica pura, sin React: se prueba en unidad (src/test/tacticalSports.test.ts).
 *
 * Coordenadas: TODAS las canchas viven en el mismo espacio que la de fútbol
 * (x 0-100, y 0-100 → viewBox 300×340 con x*3, y*3.4). Así lo guardado
 * (jugadores, figuras, cuadros) no depende del deporte: una jugada de futsal
 * abierta en "genérico" se ve en el mismo lugar. Cada cancha se dibuja
 * proporcional DENTRO de ese espacio, centrada y con márgenes (el piso
 * alrededor es la zona libre del coliseo). Para no desperdiciar ancho en el
 * celular (pantalla vertical), se permite estirar el ancho hasta MAX_STRETCH
 * veces la escala del largo — la cancha de fútbol 11 ya está estirada así.
 *
 * Arco/canasta propios ABAJO (y alto), rival ARRIBA, igual que fútbol.
 */
import { FORMATIONS as FOOTBALL_FORMATIONS } from './tacticalFormations';
import { OBJECT_TYPES, type ObjectType } from './tacticalGeometry';
import { boardSportFromTeam, type BoardSport, type TeamSportInput } from '@/lib/sports/sportCatalog';

export const TACTICAL_SPORTS = [
  'futbol',
  'futbol7',
  'futbol5',
  'futsal',
  'voleibol',
  'baloncesto',
  'balonmano',
  // M6f: deportes de nivel «cancha» (pizarra sin biblioteca).
  'rugby',
  'futbol_americano',
  'tenis',
  'padel',
  'badminton',
  'voley_playa',
  'hockey_cesped',
  'hockey_patines',
  'netball',
  'waterpolo',
  'ultimate',
  'generico',
] as const;
export type TacticalSport = (typeof TACTICAL_SPORTS)[number];

// Las canchas son las mismas del catálogo único de deportes (sportCatalog.ts):
// si una lista cambia sin la otra, esto no compila.
type SameUnion<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const SAME_SPORTS: SameUnion<TacticalSport, BoardSport> = true;
void SAME_SPORTS;

export const DEFAULT_SPORT: TacticalSport = 'futbol';

export const isTacticalSport = (v: unknown): v is TacticalSport =>
  typeof v === 'string' && (TACTICAL_SPORTS as readonly string[]).includes(v);

// ─── Geometría de la cancha dentro del viewBox 300×340 ──────────────────────

export const BOARD_W = 300;
export const BOARD_H = 340;
/** Tope de estiramiento del ancho respecto del largo (1 = proporción real). */
export const MAX_STRETCH = 1.3;

/** Rectángulo de juego en unidades del viewBox + escala metro→unidad. */
export interface CourtFrame {
  /** Esquina superior izquierda de la línea exterior. */
  ox: number;
  oy: number;
  /** Ancho y largo dibujados (unidades del viewBox). */
  w: number;
  h: number;
  /** Unidades por metro, a lo ancho (x) y a lo largo (y). */
  sx: number;
  sy: number;
  /** Medidas reales en metros (ancho × largo). */
  widthM: number;
  lengthM: number;
}

/** Arma el marco: el largo llena `availH`, el ancho se ajusta a la proporción
 *  real (estirada hasta MAX_STRETCH) sin pasar `availW`, y todo se centra. */
export function courtFrameFor(widthM: number, lengthM: number, availW = 288, availH = 328): CourtFrame {
  const sy = Math.min(availH / lengthM, (availW / widthM) * MAX_STRETCH);
  const sx = Math.min(availW / widthM, sy * MAX_STRETCH);
  const w = widthM * sx;
  const h = lengthM * sy;
  return { ox: (BOARD_W - w) / 2, oy: (BOARD_H - h) / 2, w, h, sx, sy, widthM, lengthM };
}

/** Rectángulo de juego en % del tablero (el espacio de lo guardado). */
export interface CourtRectPct { x0: number; y0: number; x1: number; y1: number }

export const frameToPct = (f: CourtFrame): CourtRectPct => ({
  x0: (f.ox / BOARD_W) * 100,
  y0: (f.oy / BOARD_H) * 100,
  x1: ((f.ox + f.w) / BOARD_W) * 100,
  y1: ((f.oy + f.h) / BOARD_H) * 100,
});

// ─── Formaciones ────────────────────────────────────────────────────────────

/** Mismo formato de slot que tacticalFormations.ts (placeInFormation lo
 *  acepta tal cual: solo lee `slots`). */
export interface SportFormationSlot { x: number; y: number; label: string }
export interface SportFormation {
  key: string;
  label: string;
  players: number;
  slots: SportFormationSlot[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Formación escrita en % de la CANCHA (0-100 a lo ancho y a lo largo, arco
 *  propio en 100) → % del TABLERO, que es lo que se guarda. */
function onCourt(rect: CourtRectPct, key: string, label: string, slots: SportFormationSlot[]): SportFormation {
  return {
    key,
    label,
    players: slots.length,
    slots: slots.map((s) => ({
      label: s.label,
      x: round1(rect.x0 + (s.x / 100) * (rect.x1 - rect.x0)),
      y: round1(rect.y0 + (s.y / 100) * (rect.y1 - rect.y0)),
    })),
  };
}

// ─── Catálogo ───────────────────────────────────────────────────────────────

/** Colores de la cancha. `line` debe contrastar con `court`; `surround` es el
 *  piso fuera de las líneas (zona libre). */
export interface CourtColors {
  court: string;
  surround: string;
  line: string;
  /** Pintura secundaria (zona de baloncesto, área de balonmano/futsal). */
  accent?: string;
}

export interface TacticalSportDef {
  key: TacticalSport;
  /** Nombre visible en español. */
  label: string;
  /** viewBox del tablero: IGUAL para todos (coordenadas agnósticas). */
  viewBox: string;
  /** Marco de la cancha dentro del viewBox (null en fútbol 11: usa el dibujo
   *  histórico de FootballPitchBackground, de borde a borde). */
  frame: CourtFrame | null;
  /** Rectángulo de juego en % del tablero. */
  court: CourtRectPct;
  playersPerSide: number;
  /** ¿Hay arquero/portero? (pines amarillos, zoom de arqueros). */
  hasGoalkeeper: boolean;
  formations: SportFormation[];
  /** Material que tiene sentido en la paleta (subconjunto de OBJECT_TYPES,
   *  en el mismo orden). */
  objects: ObjectType[];
  colors: CourtColors;
}

const VIEWBOX = `0 0 ${BOARD_W} ${BOARD_H}`;

const objectsExcept = (...out: ObjectType[]): ObjectType[] => OBJECT_TYPES.filter((t) => !out.includes(t));

// Medidas reales (ancho × largo, metros). Fútbol 7 y 5 varían por liga; se
// toma la medida típica de escuela (F7 40×60; F5 sintética 25×40).
//
// M6f — medidas OFICIALES (líneas exteriores; fuente al lado):
//   rugby            70 × 120: 100 m entre líneas de ensayo + 2 in-goal de 10 m
//                    (World Rugby, Law 1: máx. 100 × 70, in-goal 6-22 m). XV y 7s.
//   futbol_americano 48,77 × 109,73: 53⅓ × 120 yardas con las zonas de anotación
//                    de 10 yd (NFL Rule 1, Sec. 1; NCAA Rule 1-2 igual).
//   tenis            10,97 × 23,77: cancha de dobles (ITF Rules of Tennis, Rule 1).
//   padel            10 × 20: medidas interiores (FIP, Reglamento de juego, 1).
//   badminton        6,10 × 13,40: cancha de dobles (BWF Laws of Badminton, 1).
//   voley_playa      8 × 16 (FIVB Official Beach Volleyball Rules, Regla 1.1).
//   hockey_cesped    55 × 91,40 (FIH Rules of Hockey, «Field of play» 1.1).
//   hockey_patines   20 × 40: pista estándar internacional, esquinas de 3 m
//                    (World Skate, Rink Hockey Rules of the Game 2026, art. 1.8).
//   netball          15,25 × 30,50 (World Netball Rules of Netball, 1.1).
//   waterpolo        20 × 25 entre líneas de gol (World Aquatics, certificación
//                    de piscinas de waterpolo 2026; reglas WP 1.1: 20-30 × 10-20).
//   ultimate         37 × 100: zona central de 64 m + zonas de anotación de 18 m
//                    (WFDF Rules of Ultimate 2025-2028, Apéndice A).
export const COURT_METERS: Record<Exclude<TacticalSport, 'futbol'>, { w: number; l: number }> = {
  futbol7: { w: 40, l: 60 },
  futbol5: { w: 25, l: 40 },
  futsal: { w: 20, l: 40 },
  voleibol: { w: 9, l: 18 },
  baloncesto: { w: 15, l: 28 },
  balonmano: { w: 20, l: 40 },
  rugby: { w: 70, l: 120 },
  futbol_americano: { w: 48.768, l: 109.728 },
  tenis: { w: 10.97, l: 23.77 },
  padel: { w: 10, l: 20 },
  badminton: { w: 6.1, l: 13.4 },
  voley_playa: { w: 8, l: 16 },
  hockey_cesped: { w: 55, l: 91.4 },
  hockey_patines: { w: 20, l: 40 },
  netball: { w: 15.25, l: 30.5 },
  waterpolo: { w: 20, l: 25 },
  ultimate: { w: 37, l: 100 },
  generico: { w: 40, l: 50 },
};

const frameOf = (s: Exclude<TacticalSport, 'futbol'>, availW?: number, availH?: number) =>
  courtFrameFor(COURT_METERS[s].w, COURT_METERS[s].l, availW, availH);

const FRAMES: Record<Exclude<TacticalSport, 'futbol'>, CourtFrame> = {
  futbol7: courtFrameFor(COURT_METERS.futbol7.w, COURT_METERS.futbol7.l),
  futbol5: courtFrameFor(COURT_METERS.futbol5.w, COURT_METERS.futbol5.l),
  futsal: courtFrameFor(COURT_METERS.futsal.w, COURT_METERS.futsal.l),
  // Voleibol deja más aire en los fondos: el saque se hace detrás de la línea.
  voleibol: courtFrameFor(COURT_METERS.voleibol.w, COURT_METERS.voleibol.l, 288, 290),
  baloncesto: courtFrameFor(COURT_METERS.baloncesto.w, COURT_METERS.baloncesto.l),
  balonmano: courtFrameFor(COURT_METERS.balonmano.w, COURT_METERS.balonmano.l),
  rugby: frameOf('rugby'),
  futbol_americano: frameOf('futbol_americano'),
  // Raqueta y red: aire en los fondos (se saca y se juega detrás de la línea).
  tenis: frameOf('tenis', 288, 250),
  padel: frameOf('padel', 270, 300),
  badminton: frameOf('badminton', 288, 280),
  voley_playa: frameOf('voley_playa', 288, 270),
  hockey_cesped: frameOf('hockey_cesped'),
  hockey_patines: frameOf('hockey_patines', 280, 318),
  netball: frameOf('netball', 288, 300),
  waterpolo: frameOf('waterpolo', 270, 300),
  ultimate: frameOf('ultimate'),
  generico: courtFrameFor(COURT_METERS.generico.w, COURT_METERS.generico.l),
};

/** Rectángulo de la cancha de fútbol 11 (FootballPitchBackground: 6..294 × 6..334). */
const FOOTBALL_RECT: CourtRectPct = { x0: 2, y0: (6 / 340) * 100, x1: 98, y1: (334 / 340) * 100 };

const R = {
  futbol7: frameToPct(FRAMES.futbol7),
  futbol5: frameToPct(FRAMES.futbol5),
  futsal: frameToPct(FRAMES.futsal),
  voleibol: frameToPct(FRAMES.voleibol),
  baloncesto: frameToPct(FRAMES.baloncesto),
  balonmano: frameToPct(FRAMES.balonmano),
  rugby: frameToPct(FRAMES.rugby),
  futbol_americano: frameToPct(FRAMES.futbol_americano),
  tenis: frameToPct(FRAMES.tenis),
  padel: frameToPct(FRAMES.padel),
  badminton: frameToPct(FRAMES.badminton),
  voley_playa: frameToPct(FRAMES.voley_playa),
  hockey_cesped: frameToPct(FRAMES.hockey_cesped),
  hockey_patines: frameToPct(FRAMES.hockey_patines),
  netball: frameToPct(FRAMES.netball),
  waterpolo: frameToPct(FRAMES.waterpolo),
  ultimate: frameToPct(FRAMES.ultimate),
  generico: frameToPct(FRAMES.generico),
};

/** Material de las canchas de red (sin arcos ni maniquíes). */
const NET_OBJECTS: ObjectType[] = ['cone', 'marker', 'ball', 'hurdle', 'ring', 'ladder', 'pole', 'opponent'];

const GRASS: CourtColors = { court: '#1f8a3f', surround: '#0e5c28', line: '#ffffff' };

export const SPORTS: Record<TacticalSport, TacticalSportDef> = {
  futbol: {
    key: 'futbol',
    label: 'Fútbol 11',
    viewBox: VIEWBOX,
    frame: null,
    court: FOOTBALL_RECT,
    playersPerSide: 11,
    hasGoalkeeper: true,
    // Las de fútbol 11 son las MISMAS de tacticalFormations.ts (ya en % del tablero).
    formations: FOOTBALL_FORMATIONS.filter((f) => f.players === 11).map((f) => ({
      key: f.key, label: f.label, players: f.players, slots: f.slots.map((s) => ({ ...s })),
    })),
    objects: [...OBJECT_TYPES],
    colors: GRASS,
  },
  futbol7: {
    key: 'futbol7',
    label: 'Fútbol 7',
    viewBox: VIEWBOX,
    frame: FRAMES.futbol7,
    court: R.futbol7,
    playersPerSide: 7,
    hasGoalkeeper: true,
    formations: [
      onCourt(R.futbol7, 'f7-2-3-1', '2-3-1', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 30, y: 74, label: 'Defensa' },
        { x: 70, y: 74, label: 'Defensa' },
        { x: 14, y: 50, label: 'Volante izq.' },
        { x: 50, y: 54, label: 'Medio' },
        { x: 86, y: 50, label: 'Volante der.' },
        { x: 50, y: 24, label: 'Delantero' },
      ]),
      onCourt(R.futbol7, 'f7-3-2-1', '3-2-1', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 18, y: 74, label: 'Lateral izq.' },
        { x: 50, y: 78, label: 'Central' },
        { x: 82, y: 74, label: 'Lateral der.' },
        { x: 32, y: 50, label: 'Medio' },
        { x: 68, y: 50, label: 'Medio' },
        { x: 50, y: 24, label: 'Delantero' },
      ]),
    ],
    objects: [...OBJECT_TYPES],
    colors: GRASS,
  },
  futbol5: {
    key: 'futbol5',
    label: 'Fútbol 5',
    viewBox: VIEWBOX,
    frame: FRAMES.futbol5,
    court: R.futbol5,
    playersPerSide: 5,
    hasGoalkeeper: true,
    formations: [
      onCourt(R.futbol5, 'f5-1-2-1', '1-2-1 (rombo)', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 50, y: 76, label: 'Defensa' },
        { x: 18, y: 56, label: 'Volante izq.' },
        { x: 82, y: 56, label: 'Volante der.' },
        { x: 50, y: 32, label: 'Delantero' },
      ]),
      onCourt(R.futbol5, 'f5-2-2', '2-2 (cuadrado)', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 28, y: 72, label: 'Defensa' },
        { x: 72, y: 72, label: 'Defensa' },
        { x: 28, y: 40, label: 'Delantero' },
        { x: 72, y: 40, label: 'Delantero' },
      ]),
    ],
    objects: [...OBJECT_TYPES],
    colors: { court: '#1a7a3a', surround: '#334155', line: '#ffffff' },
  },
  futsal: {
    key: 'futsal',
    label: 'Futsal',
    viewBox: VIEWBOX,
    frame: FRAMES.futsal,
    court: R.futsal,
    playersPerSide: 5,
    hasGoalkeeper: true,
    formations: [
      onCourt(R.futsal, 'fs-1-2-1', '1-2-1 (rombo)', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 50, y: 76, label: 'Cierre' },
        { x: 18, y: 58, label: 'Ala izq.' },
        { x: 82, y: 58, label: 'Ala der.' },
        { x: 50, y: 34, label: 'Pívot' },
      ]),
      onCourt(R.futsal, 'fs-2-2', '2-2 (cuadrado)', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 28, y: 72, label: 'Cierre' },
        { x: 72, y: 72, label: 'Cierre' },
        { x: 28, y: 42, label: 'Ala' },
        { x: 72, y: 42, label: 'Pívot' },
      ]),
    ],
    objects: [...OBJECT_TYPES],
    colors: { court: '#1f5fa8', surround: '#0f2f57', line: '#ffffff', accent: '#2f76c4' },
  },
  voleibol: {
    key: 'voleibol',
    label: 'Voleibol',
    viewBox: VIEWBOX,
    frame: FRAMES.voleibol,
    court: R.voleibol,
    playersPerSide: 6,
    hasGoalkeeper: false,
    formations: [
      // Zonas de rotación mirando a la red (arriba): adelante 4-3-2, atrás 5-6-1.
      onCourt(R.voleibol, 'vb-rotacion', 'Rotación (zonas 1-6)', [
        { x: 80, y: 86, label: 'Zona 1' },
        { x: 80, y: 61, label: 'Zona 2' },
        { x: 50, y: 61, label: 'Zona 3' },
        { x: 20, y: 61, label: 'Zona 4' },
        { x: 20, y: 86, label: 'Zona 5' },
        { x: 50, y: 86, label: 'Zona 6' },
      ]),
      onCourt(R.voleibol, 'vb-recepcion-w', 'Recepción en W', [
        { x: 72, y: 54, label: 'Armador' },
        { x: 14, y: 66, label: 'Receptor' },
        { x: 50, y: 70, label: 'Receptor' },
        { x: 86, y: 66, label: 'Receptor' },
        { x: 30, y: 86, label: 'Receptor' },
        { x: 70, y: 86, label: 'Líbero' },
      ]),
    ],
    objects: ['cone', 'marker', 'ball', 'hurdle', 'ring', 'ladder', 'pole', 'opponent'],
    colors: { court: '#d9692b', surround: '#1f5fa8', line: '#ffffff' },
  },
  baloncesto: {
    key: 'baloncesto',
    label: 'Baloncesto',
    viewBox: VIEWBOX,
    frame: FRAMES.baloncesto,
    court: R.baloncesto,
    playersPerSide: 5,
    hasGoalkeeper: false,
    formations: [
      // Defensas en zona frente a la canasta propia (abajo).
      onCourt(R.baloncesto, 'bk-2-3', 'Zona 2-3', [
        { x: 34, y: 70, label: 'Base' },
        { x: 66, y: 70, label: 'Escolta' },
        { x: 16, y: 85, label: 'Alero' },
        { x: 50, y: 89, label: 'Pívot' },
        { x: 84, y: 85, label: 'Ala-pívot' },
      ]),
      onCourt(R.baloncesto, 'bk-1-3-1', 'Zona 1-3-1', [
        { x: 50, y: 64, label: 'Base' },
        { x: 18, y: 76, label: 'Escolta' },
        { x: 50, y: 78, label: 'Pívot' },
        { x: 82, y: 76, label: 'Alero' },
        { x: 50, y: 92, label: 'Ala-pívot' },
      ]),
    ],
    objects: ['cone', 'marker', 'ball', 'hurdle', 'ring', 'ladder', 'pole', 'mannequin', 'opponent'],
    colors: { court: '#d4a373', surround: '#8b5a2b', line: '#1e293b', accent: '#1e4f8f' },
  },
  balonmano: {
    key: 'balonmano',
    label: 'Balonmano',
    viewBox: VIEWBOX,
    frame: FRAMES.balonmano,
    court: R.balonmano,
    playersPerSide: 7,
    hasGoalkeeper: true,
    formations: [
      onCourt(R.balonmano, 'bm-6-0', 'Defensa 6-0', [
        { x: 50, y: 96, label: 'Portero' },
        { x: 7, y: 89, label: 'Exterior izq.' },
        { x: 24, y: 82, label: 'Lateral izq.' },
        { x: 41, y: 79.5, label: 'Central' },
        { x: 59, y: 79.5, label: 'Central' },
        { x: 76, y: 82, label: 'Lateral der.' },
        { x: 93, y: 89, label: 'Exterior der.' },
      ]),
      onCourt(R.balonmano, 'bm-5-1', 'Defensa 5-1', [
        { x: 50, y: 96, label: 'Portero' },
        { x: 7, y: 89, label: 'Exterior izq.' },
        { x: 27, y: 82, label: 'Lateral izq.' },
        { x: 50, y: 80, label: 'Central' },
        { x: 73, y: 82, label: 'Lateral der.' },
        { x: 93, y: 89, label: 'Exterior der.' },
        { x: 50, y: 66, label: 'Avanzado' },
      ]),
    ],
    objects: objectsExcept('mini_goal'),
    colors: { court: '#24589a', surround: '#b45309', line: '#ffffff', accent: '#3b82c4' },
  },
  // ── M6f: nivel «cancha» (jugadores libres + 1-2 posiciones de arranque) ──
  rugby: {
    key: 'rugby',
    label: 'Rugby',
    viewBox: VIEWBOX,
    frame: FRAMES.rugby,
    court: R.rugby,
    // Rugby 7 (lo que juegan las escuelas); el XV se arma agregando jugadores.
    playersPerSide: 7,
    hasGoalkeeper: false,
    formations: [
      onCourt(R.rugby, 'rg7-recepcion', 'Rugby 7: recepción del saque', [
        { x: 25, y: 60, label: 'Pilar izq.' },
        { x: 50, y: 60, label: 'Talonador' },
        { x: 75, y: 60, label: 'Pilar der.' },
        { x: 40, y: 71, label: 'Medio scrum' },
        { x: 62, y: 73, label: 'Apertura' },
        { x: 28, y: 82, label: 'Centro' },
        { x: 80, y: 82, label: 'Ala' },
      ]),
      onCourt(R.rugby, 'rg7-defensa', 'Rugby 7: defensa en línea', [
        { x: 8, y: 58, label: 'Ala' },
        { x: 23, y: 58, label: 'Centro' },
        { x: 37, y: 58, label: 'Apertura' },
        { x: 50, y: 58, label: 'Pilar izq.' },
        { x: 63, y: 58, label: 'Talonador' },
        { x: 77, y: 58, label: 'Pilar der.' },
        { x: 50, y: 74, label: 'Medio scrum (barredor)' },
      ]),
    ],
    objects: objectsExcept('goal', 'mini_goal'),
    colors: GRASS,
  },
  futbol_americano: {
    key: 'futbol_americano',
    label: 'Fútbol americano',
    viewBox: VIEWBOX,
    frame: FRAMES.futbol_americano,
    court: R.futbol_americano,
    playersPerSide: 11,
    hasGoalkeeper: false,
    formations: [
      // Ofensiva en I sobre la yarda 50, atacando hacia arriba.
      onCourt(R.futbol_americano, 'fa-formacion-i', 'Ofensiva en I', [
        { x: 36, y: 51, label: 'Tackle izq.' },
        { x: 43, y: 51, label: 'Guardia izq.' },
        { x: 50, y: 51, label: 'Centro' },
        { x: 57, y: 51, label: 'Guardia der.' },
        { x: 64, y: 51, label: 'Tackle der.' },
        { x: 71, y: 52, label: 'Ala cerrada' },
        { x: 6, y: 51, label: 'Receptor abierto' },
        { x: 90, y: 53, label: 'Receptor (flanker)' },
        { x: 50, y: 55, label: 'Mariscal de campo' },
        { x: 50, y: 60, label: 'Fullback' },
        { x: 50, y: 65, label: 'Corredor' },
      ]),
      onCourt(R.futbol_americano, 'fa-defensa-4-3', 'Defensa 4-3', [
        { x: 36, y: 52, label: 'Ala defensiva' },
        { x: 45, y: 52, label: 'Tackle defensivo' },
        { x: 55, y: 52, label: 'Tackle defensivo' },
        { x: 64, y: 52, label: 'Ala defensiva' },
        { x: 32, y: 58, label: 'Apoyador' },
        { x: 50, y: 59, label: 'Apoyador central' },
        { x: 68, y: 58, label: 'Apoyador' },
        { x: 8, y: 56, label: 'Esquinero' },
        { x: 92, y: 56, label: 'Esquinero' },
        { x: 35, y: 70, label: 'Profundo' },
        { x: 65, y: 70, label: 'Profundo' },
      ]),
    ],
    objects: objectsExcept('goal', 'mini_goal'),
    colors: { court: '#2f7d32', surround: '#1b4d1f', line: '#ffffff', accent: '#1e3a8a' },
  },
  tenis: {
    key: 'tenis',
    label: 'Tenis',
    viewBox: VIEWBOX,
    frame: FRAMES.tenis,
    court: R.tenis,
    playersPerSide: 2,
    hasGoalkeeper: false,
    formations: [
      onCourt(R.tenis, 'tn-dobles-saque', 'Dobles: saque', [
        { x: 66, y: 99, label: 'Sacador' },
        { x: 30, y: 63, label: 'En la red' },
      ]),
      onCourt(R.tenis, 'tn-dobles-red', 'Dobles: los dos en la red', [
        { x: 28, y: 63, label: 'Jugador izq.' },
        { x: 72, y: 63, label: 'Jugador der.' },
      ]),
    ],
    objects: NET_OBJECTS,
    colors: { court: '#2f6db5', surround: '#3f8a5a', line: '#ffffff' },
  },
  padel: {
    key: 'padel',
    label: 'Pádel',
    viewBox: VIEWBOX,
    frame: FRAMES.padel,
    court: R.padel,
    playersPerSide: 2,
    hasGoalkeeper: false,
    formations: [
      onCourt(R.padel, 'pd-saque', 'Saque', [
        { x: 72, y: 96, label: 'Sacador' },
        { x: 28, y: 62, label: 'En la red' },
      ]),
      onCourt(R.padel, 'pd-red', 'Los dos en la red', [
        { x: 28, y: 62, label: 'Revés' },
        { x: 72, y: 62, label: 'Drive' },
      ]),
    ],
    objects: NET_OBJECTS,
    colors: { court: '#2563a8', surround: '#0f172a', line: '#ffffff' },
  },
  badminton: {
    key: 'badminton',
    label: 'Bádminton',
    viewBox: VIEWBOX,
    frame: FRAMES.badminton,
    court: R.badminton,
    playersPerSide: 2,
    hasGoalkeeper: false,
    formations: [
      onCourt(R.badminton, 'bd-ataque', 'Dobles: ataque (adelante-atrás)', [
        { x: 50, y: 62, label: 'Delantero' },
        { x: 50, y: 88, label: 'Zaguero' },
      ]),
      onCourt(R.badminton, 'bd-defensa', 'Dobles: defensa (lado a lado)', [
        { x: 27, y: 78, label: 'Jugador izq.' },
        { x: 73, y: 78, label: 'Jugador der.' },
      ]),
    ],
    objects: NET_OBJECTS,
    colors: { court: '#15803d', surround: '#8a5a2b', line: '#ffffff' },
  },
  voley_playa: {
    key: 'voley_playa',
    label: 'Vóley playa',
    viewBox: VIEWBOX,
    frame: FRAMES.voley_playa,
    court: R.voley_playa,
    playersPerSide: 2,
    hasGoalkeeper: false,
    formations: [
      onCourt(R.voley_playa, 'vp-recepcion', 'Recepción 2 contra 2', [
        { x: 28, y: 80, label: 'Bloqueador' },
        { x: 72, y: 80, label: 'Defensor' },
      ]),
      onCourt(R.voley_playa, 'vp-bloqueo', 'Bloqueo y defensa', [
        { x: 50, y: 53, label: 'Bloqueador' },
        { x: 50, y: 84, label: 'Defensor' },
      ]),
    ],
    objects: NET_OBJECTS,
    colors: { court: '#ecd29a', surround: '#d6b26b', line: '#1d4ed8' },
  },
  hockey_cesped: {
    key: 'hockey_cesped',
    label: 'Hockey sobre césped',
    viewBox: VIEWBOX,
    frame: FRAMES.hockey_cesped,
    court: R.hockey_cesped,
    playersPerSide: 11,
    hasGoalkeeper: true,
    formations: [
      onCourt(R.hockey_cesped, 'hc-4-3-3', '4-3-3', [
        { x: 50, y: 97, label: 'Portero' },
        { x: 15, y: 80, label: 'Defensa izq.' },
        { x: 38, y: 83, label: 'Defensa central' },
        { x: 62, y: 83, label: 'Defensa central' },
        { x: 85, y: 80, label: 'Defensa der.' },
        { x: 25, y: 60, label: 'Volante' },
        { x: 50, y: 63, label: 'Volante central' },
        { x: 75, y: 60, label: 'Volante' },
        { x: 18, y: 36, label: 'Delantero izq.' },
        { x: 50, y: 33, label: 'Delantero centro' },
        { x: 82, y: 36, label: 'Delantero der.' },
      ]),
    ],
    objects: [...OBJECT_TYPES],
    colors: { court: '#1d5fa8', surround: '#1f7a3f', line: '#ffffff' },
  },
  hockey_patines: {
    key: 'hockey_patines',
    label: 'Hockey sobre patines',
    viewBox: VIEWBOX,
    frame: FRAMES.hockey_patines,
    court: R.hockey_patines,
    playersPerSide: 5,
    hasGoalkeeper: true,
    formations: [
      onCourt(R.hockey_patines, 'hp-rombo', 'Rombo (1-2-1)', [
        { x: 50, y: 90, label: 'Portero' },
        { x: 50, y: 75, label: 'Defensa' },
        { x: 20, y: 58, label: 'Ala izq.' },
        { x: 80, y: 58, label: 'Ala der.' },
        { x: 50, y: 38, label: 'Delantero' },
      ]),
      onCourt(R.hockey_patines, 'hp-cuadrado', 'Cuadrado (2-2)', [
        { x: 50, y: 90, label: 'Portero' },
        { x: 30, y: 74, label: 'Defensa' },
        { x: 70, y: 74, label: 'Defensa' },
        { x: 30, y: 46, label: 'Delantero' },
        { x: 70, y: 46, label: 'Delantero' },
      ]),
    ],
    objects: objectsExcept('mini_goal'),
    colors: { court: '#c99a5b', surround: '#1f2937', line: '#b91c1c', accent: '#1d4ed8' },
  },
  netball: {
    key: 'netball',
    label: 'Netball',
    viewBox: VIEWBOX,
    frame: FRAMES.netball,
    court: R.netball,
    playersPerSide: 7,
    hasGoalkeeper: false,
    formations: [
      // Pase central: cada una en el tercio que le toca, atacando hacia arriba.
      onCourt(R.netball, 'nb-pase-central', 'Pase central', [
        { x: 50, y: 14, label: 'Tiradora (GS)' },
        { x: 34, y: 27, label: 'Ataque de gol (GA)' },
        { x: 76, y: 29, label: 'Ala de ataque (WA)' },
        { x: 50, y: 50, label: 'Centro (C)' },
        { x: 24, y: 71, label: 'Ala de defensa (WD)' },
        { x: 62, y: 73, label: 'Defensa de gol (GD)' },
        { x: 50, y: 86, label: 'Guardia de gol (GK)' },
      ]),
    ],
    objects: ['cone', 'marker', 'ball', 'hurdle', 'ring', 'ladder', 'pole', 'mannequin', 'opponent'],
    colors: { court: '#1f6f8b', surround: '#14404f', line: '#ffffff' },
  },
  waterpolo: {
    key: 'waterpolo',
    label: 'Waterpolo',
    viewBox: VIEWBOX,
    frame: FRAMES.waterpolo,
    court: R.waterpolo,
    playersPerSide: 7,
    hasGoalkeeper: true,
    formations: [
      // Ataque 3-3 sobre el arco de arriba (boya en el centro, a 2-3 m).
      onCourt(R.waterpolo, 'wp-3-3', 'Ataque 3-3', [
        { x: 50, y: 97, label: 'Portero' },
        { x: 50, y: 11, label: 'Boya (centro)' },
        { x: 14, y: 12, label: 'Extremo izq.' },
        { x: 86, y: 12, label: 'Extremo der.' },
        { x: 26, y: 26, label: 'Lateral izq.' },
        { x: 74, y: 26, label: 'Lateral der.' },
        { x: 50, y: 30, label: 'Punto' },
      ]),
    ],
    objects: ['cone', 'marker', 'ball', 'goal', 'ring', 'opponent'],
    colors: { court: '#1e88c9', surround: '#cbd5e1', line: '#ffffff' },
  },
  ultimate: {
    key: 'ultimate',
    label: 'Ultimate',
    viewBox: VIEWBOX,
    frame: FRAMES.ultimate,
    court: R.ultimate,
    playersPerSide: 7,
    hasGoalkeeper: false,
    formations: [
      onCourt(R.ultimate, 'ul-vertical', 'Stack vertical', [
        { x: 50, y: 70, label: 'Lanzador (handler)' },
        { x: 30, y: 74, label: 'Lanzador' },
        { x: 50, y: 56, label: 'Cortador' },
        { x: 50, y: 49, label: 'Cortador' },
        { x: 50, y: 42, label: 'Cortador' },
        { x: 50, y: 35, label: 'Cortador' },
        { x: 50, y: 28, label: 'Cortador' },
      ]),
      onCourt(R.ultimate, 'ul-horizontal', 'Stack horizontal', [
        { x: 30, y: 68, label: 'Lanzador' },
        { x: 50, y: 72, label: 'Lanzador (handler)' },
        { x: 70, y: 68, label: 'Lanzador' },
        { x: 14, y: 48, label: 'Cortador' },
        { x: 38, y: 48, label: 'Cortador' },
        { x: 62, y: 48, label: 'Cortador' },
        { x: 86, y: 48, label: 'Cortador' },
      ]),
    ],
    objects: ['cone', 'marker', 'ball', 'hurdle', 'ring', 'ladder', 'pole', 'mannequin', 'opponent'],
    colors: GRASS,
  },
  generico: {
    key: 'generico',
    label: 'Genérico',
    viewBox: VIEWBOX,
    frame: FRAMES.generico,
    court: R.generico,
    playersPerSide: 6,
    hasGoalkeeper: false,
    formations: [
      onCourt(R.generico, 'gen-3-3', 'Dos líneas de 3', [
        { x: 20, y: 80, label: 'Jugador 1' },
        { x: 50, y: 80, label: 'Jugador 2' },
        { x: 80, y: 80, label: 'Jugador 3' },
        { x: 20, y: 60, label: 'Jugador 4' },
        { x: 50, y: 60, label: 'Jugador 5' },
        { x: 80, y: 60, label: 'Jugador 6' },
      ]),
    ],
    objects: [...OBJECT_TYPES],
    colors: { court: '#3f5f4f', surround: '#1f2937', line: '#ffffff' },
  },
};

export const sportDef = (s: TacticalSport | null | undefined): TacticalSportDef => SPORTS[isTacticalSport(s) ? s : DEFAULT_SPORT];

/** Opciones para un selector, en orden del catálogo. */
export const SPORT_OPTIONS = TACTICAL_SPORTS.map((k) => ({ value: k, label: SPORTS[k].label }));

// ─── Deporte a partir del equipo ────────────────────────────────────────────

/**
 * Deporte de la pizarra para un equipo. UNA sola fuente de verdad desde M1:
 * delega en boardSportFromTeam de lib/sports/sportCatalog.ts (resolveSport
 * sobre `teams.sport`, que guarda el NOMBRE VISIBLE: "Fútbol", "Voleibol"…).
 * "Fútbol Sala" y "Microfútbol" = futsal. Fútbol 7/5 solo si está escrito
 * ("F7", "Fútbol 5", "7 vs 7"); "Sub 7" es edad y no cuenta. Tenis, rugby,
 * waterpolo… (nivel «cancha», M6f) tienen su cancha. Lo que no tiene cancha
 * propia (natación, porrismo…) cae a 'generico'. Si el equipo
 * abre o no la pizarra lo dice teamBoardAccess / hasTacticalBoard, no esto.
 */
export function sportFromTeam(team: TeamSportInput | null | undefined): TacticalSport {
  return boardSportFromTeam(team);
}
