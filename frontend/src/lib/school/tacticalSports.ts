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

export const TACTICAL_SPORTS = [
  'futbol',
  'futbol7',
  'futbol5',
  'futsal',
  'voleibol',
  'baloncesto',
  'balonmano',
  'generico',
] as const;
export type TacticalSport = (typeof TACTICAL_SPORTS)[number];

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
export const COURT_METERS: Record<Exclude<TacticalSport, 'futbol'>, { w: number; l: number }> = {
  futbol7: { w: 40, l: 60 },
  futbol5: { w: 25, l: 40 },
  futsal: { w: 20, l: 40 },
  voleibol: { w: 9, l: 18 },
  baloncesto: { w: 15, l: 28 },
  balonmano: { w: 20, l: 40 },
  generico: { w: 40, l: 50 },
};

const FRAMES: Record<Exclude<TacticalSport, 'futbol'>, CourtFrame> = {
  futbol7: courtFrameFor(COURT_METERS.futbol7.w, COURT_METERS.futbol7.l),
  futbol5: courtFrameFor(COURT_METERS.futbol5.w, COURT_METERS.futbol5.l),
  futsal: courtFrameFor(COURT_METERS.futsal.w, COURT_METERS.futsal.l),
  // Voleibol deja más aire en los fondos: el saque se hace detrás de la línea.
  voleibol: courtFrameFor(COURT_METERS.voleibol.w, COURT_METERS.voleibol.l, 288, 290),
  baloncesto: courtFrameFor(COURT_METERS.baloncesto.w, COURT_METERS.baloncesto.l),
  balonmano: courtFrameFor(COURT_METERS.balonmano.w, COURT_METERS.balonmano.l),
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
  generico: frameToPct(FRAMES.generico),
};

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

/** Minúsculas, sin tildes y con `_` como espacio ("Fútbol Sala" y el slug
 *  "futbol_sala" → "futbol sala"). */
const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, ' ').trim();

type Family = 'futbol' | 'futsal' | 'voleibol' | 'baloncesto' | 'balonmano';

function familyOf(text: string): Family | null {
  if (!text) return null;
  // Futsal ANTES que fútbol: "fútbol sala" contiene "fútbol".
  if (/\bfutsal\b|futbol\s*(de\s*)?sala|futbol\s*de\s*salon|micro\s*-?\s*futbol|\bmicro\b/.test(text)) return 'futsal';
  if (/volei|voley|volley|\bvolei?bol\b|voleibol/.test(text)) return 'voleibol';
  if (/balonce|basket|basquet|\bbasquetbol|\bbaloncesto/.test(text)) return 'baloncesto';
  if (/balonmano|handball|hand\s*ball/.test(text)) return 'balonmano';
  if (/futbol|soccer|\bfut\b/.test(text)) return 'futbol';
  return null;
}

/** Modalidad 7 / 5 / 11 escrita explícitamente ("F7", "Fútbol 7", "7 vs 7",
 *  "7x7"). OJO: "Sub 7" o "Sub-5" son categorías de EDAD, no modalidad. */
function footballSize(text: string): 7 | 5 | 11 | null {
  for (const n of [7, 5, 11] as const) {
    const re = new RegExp(
      `(^|[^a-z0-9])(f|fut|futbol|soccer)\\s*-?\\s*${n}(?![0-9])|(^|[^0-9])${n}\\s*(vs|v|x|contra)\\s*${n}(?![0-9])`,
    );
    if (re.test(text)) return n;
  }
  return null;
}

/**
 * Deporte de la pizarra para un equipo. Lee el NOMBRE VISIBLE del deporte
 * (`teams.sport` guarda "Fútbol", "Voleibol", "Baloncesto"…, no el slug) y,
 * si no alcanza, el nombre del equipo y de la categoría. "Fútbol Sala" y
 * "Microfútbol" = futsal. Fútbol 7/5 solo si está escrito ("F7", "Fútbol 5",
 * "7 vs 7"); "Sub 7" es edad y no cuenta. Lo que no tiene cancha propia
 * (natación, tenis, porrismo…) cae a 'generico'.
 */
export function sportFromTeam(team: { sport?: string | null; name?: string | null; category_name?: string | null } | null | undefined): TacticalSport {
  if (!team) return DEFAULT_SPORT;
  const sport = norm(team.sport);
  const extra = `${norm(team.name)} ${norm(team.category_name)}`.trim();
  const family = familyOf(sport) ?? (sport ? null : familyOf(extra));
  if (!family) return sport ? 'generico' : DEFAULT_SPORT;
  if (family !== 'futbol') {
    return family;
  }
  // Fútbol: ¿el equipo/categoría dice futsal (deporte "Fútbol", equipo "Futsal Sub 12")?
  if (familyOf(extra) === 'futsal') return 'futsal';
  const size = footballSize(sport) ?? footballSize(extra);
  if (size === 7) return 'futbol7';
  if (size === 5) return 'futbol5';
  return 'futbol';
}
