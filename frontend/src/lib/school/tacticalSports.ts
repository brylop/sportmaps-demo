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
  /** Familia en la galería (M6a): «Zonas», «Rotaciones 5-1», «Ofensivas»… */
  group?: string;
  /** Una línea: qué es y cuándo se usa (M6a). */
  description?: string;
  /** Portero/arquero que sale a jugar (5x4, 7 contra 6): puede no haber
   *  arquero o estar en campo rival. */
  flyingKeeper?: boolean;
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

// ─── Catálogo M6a: el resto de los deportes ─────────────────────────────────
// Galería de formaciones (docs/specs/pizarra-m6-paridad-tacticalpad.md, M6a).
// Fuentes: UEFA y futsal.tech (sistemas de futsal: 3-1, 4-0, 1-2-1, 2-2,
// portero-jugador), JVA Volleyball y manuales de rotación 5-1 (las seis
// rotaciones), coachesclipboard / hooptactics (zonas, mixtas y presiones de
// baloncesto), INEF Madrid y e-balonmano.com (defensas 6:0, 5:1, 4:2, 3:2:1,
// 3:3, mixtas 5+1 y 4+2; ataques 3:3, 2:4 y 7 contra 6).
// Todo en % de la CANCHA (onCourt lo pasa al tablero); arco/canasta propios
// abajo (y = 100); en ataque se juega hacia arriba.

type CourtRow = [x: number, y: number, label: string];

const slotsOf = (rows: CourtRow[]): SportFormationSlot[] => rows.map(([x, y, label]) => ({ x, y, label }));

/** Formación de cancha con su familia y descripción. */
function fm(rect: CourtRectPct, key: string, label: string, group: string, description: string, rows: CourtRow[], flyingKeeper = false): SportFormation {
  return { ...onCourt(rect, key, label, slotsOf(rows)), group, description, ...(flyingKeeper ? { flyingKeeper: true } : {}) };
}

/** Familia y descripción para las formaciones que ya existían (no cambia clave,
 *  etiqueta ni coordenadas). */
const meta = (f: SportFormation, group: string, description: string): SportFormation => ({ ...f, group, description });

// ── Voleibol: las seis rotaciones de 5-1, 4-2 y 6-2, en recepción y en defensa ──

type VbSystem = '5-1' | '4-2' | '6-2';
type VbRole = 'setter' | 'oh' | 'mb' | 'opp';

/** Orden de la planilla en sentido de rotación (zonas 1→6) en la rotación 1. */
const VB_LINEUP: Record<VbSystem, { role: VbRole; name: string }[]> = {
  '5-1': [
    { role: 'setter', name: 'Armador' }, { role: 'oh', name: 'Punta 1' }, { role: 'mb', name: 'Central 1' },
    { role: 'opp', name: 'Opuesto' }, { role: 'oh', name: 'Punta 2' }, { role: 'mb', name: 'Central 2' },
  ],
  '4-2': [
    { role: 'setter', name: 'Armador 1' }, { role: 'oh', name: 'Punta 1' }, { role: 'mb', name: 'Central 1' },
    { role: 'setter', name: 'Armador 2' }, { role: 'oh', name: 'Punta 2' }, { role: 'mb', name: 'Central 2' },
  ],
  '6-2': [
    { role: 'setter', name: 'Armador 1' }, { role: 'oh', name: 'Punta 1' }, { role: 'mb', name: 'Central 1' },
    { role: 'setter', name: 'Armador 2' }, { role: 'oh', name: 'Punta 2' }, { role: 'mb', name: 'Central 2' },
  ],
};

/** x de cada zona mirando a la red (arriba): 4-3-2 adelante, 5-6-1 atrás. */
const VB_ZONE_X: Record<number, number> = { 1: 80, 2: 80, 3: 50, 4: 20, 5: 20, 6: 50 };
const vbFront = (zone: number) => zone >= 2 && zone <= 4;

/** Zona del jugador i (orden de VB_LINEUP) en la rotación r (1-6): en la R1 el
 *  primero saca/está en zona 1; cada rotación lo corre una zona (1→6→5…). */
export function volleyZone(i: number, rotation: number): number {
  return ((((i - (rotation - 1)) % 6) + 6) % 6) + 1;
}

interface VbPlayer { role: VbRole; name: string; zone: number; front: boolean; label: string }

function vbPlayers(system: VbSystem, rotation: number): VbPlayer[] {
  return VB_LINEUP[system].map((p, i) => {
    const zone = volleyZone(i, rotation);
    const front = vbFront(zone);
    let label = p.name;
    // El líbero entra por el central que está atrás.
    if (p.role === 'mb' && !front) label = 'Líbero';
    else if (p.role === 'mb') label = 'Central';
    // 6-2: arma el de atrás; el de adelante ataca como opuesto.
    else if (system === '6-2' && p.role === 'setter') label = front ? 'Opuesto' : 'Armador';
    // 4-2: arma el de adelante; el de atrás defiende.
    else if (system === '4-2' && p.role === 'setter') label = front ? 'Armador' : 'Armador (zaguero)';
    return { ...p, zone, front, label };
  });
}

/** ¿Este jugador arma en esta rotación? */
const vbSets = (system: VbSystem, p: VbPlayer) =>
  p.role === 'setter' && (system === '5-1' || (system === '6-2' ? !p.front : p.front));

/** Recepción de saque: recibe una línea de tres (los dos puntas y el líbero);
 *  los de adelante que no reciben esperan en la red; el armador de atrás
 *  «penetra» desde detrás de su compañero de columna; el resto se esconde. */
function vbReception(system: VbSystem, rotation: number): SportFormationSlot[] {
  const players = vbPlayers(system, rotation);
  const receivers = players
    .filter((p) => p.role === 'oh' || p.label === 'Líbero')
    .sort((a, b) => VB_ZONE_X[a.zone] - VB_ZONE_X[b.zone] || Number(b.front) - Number(a.front));
  const RX = [16, 50, 84];
  return players.map((p) => {
    const ri = receivers.indexOf(p);
    // Alturas separadas lo suficiente para que las fichas (44 px) no se encimen.
    if (ri >= 0) return { label: p.label, x: RX[ri], y: p.front ? 76 : 85 };
    if (p.front) return { label: p.label, x: VB_ZONE_X[p.zone], y: 54 };
    if (vbSets(system, p)) return { label: p.label, x: Math.min(92, VB_ZONE_X[p.zone] + 12), y: 62 };
    return { label: p.label, x: VB_ZONE_X[p.zone], y: 95 };
  });
}

/** Defensa de base (después del cambio de puestos): adelante punta en 4,
 *  central en 3 y armador/opuesto en 2; atrás líbero en 5, punta en 6 y
 *  armador/opuesto en 1. */
function vbDefense(system: VbSystem, rotation: number): SportFormationSlot[] {
  return vbPlayers(system, rotation).map((p) => {
    if (p.front) {
      if (p.role === 'oh') return { label: p.label, x: 20, y: 57 };
      if (p.role === 'mb') return { label: p.label, x: 50, y: 55 };
      return { label: p.label, x: 80, y: 57 };
    }
    if (p.label === 'Líbero') return { label: p.label, x: 20, y: 84 };
    if (p.role === 'oh') return { label: p.label, x: 50, y: 90 };
    return { label: p.label, x: 80, y: 84 };
  });
}

const VB_SYSTEM_DESC: Record<VbSystem, string> = {
  '5-1': 'un armador y un opuesto',
  '4-2': 'dos armadores; arma el de adelante',
  '6-2': 'dos armadores; arma el de atrás',
};

function volleyRotations(system: VbSystem): SportFormation[] {
  const out: SportFormation[] = [];
  for (let r = 1; r <= 6; r++) {
    const setter = vbPlayers(system, r).find((p) => p.role === 'setter')!;
    const where = `armador${system === '5-1' ? '' : ' 1'} en zona ${setter.zone}`;
    out.push({
      ...onCourt(R.voleibol, `vb-${system}-r${r}-recepcion`, `${system} · R${r} recepción`, vbReception(system, r)),
      group: `Rotaciones ${system}`,
      description: `Recepción de saque en la rotación ${r} (${where}); ${VB_SYSTEM_DESC[system]}, el líbero entra por el central de atrás.`,
    });
    out.push({
      ...onCourt(R.voleibol, `vb-${system}-r${r}-defensa`, `${system} · R${r} defensa`, vbDefense(system, r)),
      group: `Rotaciones ${system}`,
      description: `Defensa de base en la rotación ${r} (${where}), ya con el cambio de puestos hecho.`,
    });
  }
  return out;
}

const EXTRA_FORMATIONS = {
  futbol7: [
    fm(R.futbol7, 'f7-3-1-2', '3-1-2', 'Clásicas', 'Tres atrás, un volante y dos delanteros: sólido y directo.', [
      [50, 94, 'Arquero'], [18, 72, 'Lateral izq.'], [50, 76, 'Central'], [82, 72, 'Lateral der.'], [50, 54, 'Volante'], [32, 28, 'Delantero izq.'], [68, 28, 'Delantero der.'],
    ]),
    fm(R.futbol7, 'f7-2-1-2-1', '2-1-2-1', 'Modernas', 'Rombo en el medio: volante de marca, dos interiores y un 9.', [
      [50, 94, 'Arquero'], [32, 76, 'Central izq.'], [68, 76, 'Central der.'], [50, 60, 'Volante de marca'], [24, 44, 'Interior izq.'], [76, 44, 'Interior der.'], [50, 24, 'Delantero'],
    ]),
    fm(R.futbol7, 'f7-2-2-2', '2-2-2', 'Modernas', 'Tres parejas: la más fácil de enseñar en iniciación.', [
      [50, 94, 'Arquero'], [32, 76, 'Central izq.'], [68, 76, 'Central der.'], [30, 52, 'Volante izq.'], [70, 52, 'Volante der.'], [34, 28, 'Delantero izq.'], [66, 28, 'Delantero der.'],
    ]),
    fm(R.futbol7, 'f7-3-3', '3-3', 'Ofensivas', 'Tres atrás y tres arriba: presión alta y mucha llegada.', [
      [50, 94, 'Arquero'], [18, 72, 'Lateral izq.'], [50, 76, 'Central'], [82, 72, 'Lateral der.'], [20, 36, 'Extremo izq.'], [50, 30, 'Delantero'], [80, 36, 'Extremo der.'],
    ]),
    fm(R.futbol7, 'f7-2-1-3', '2-1-3', 'Ofensivas', 'Un volante de marca sostiene a tres atacantes.', [
      [50, 94, 'Arquero'], [32, 76, 'Central izq.'], [68, 76, 'Central der.'], [50, 56, 'Volante de marca'], [18, 30, 'Extremo izq.'], [50, 24, 'Delantero'], [82, 30, 'Extremo der.'],
    ]),
    fm(R.futbol7, 'f7-4-1-1', '4-1-1', 'Defensivas', 'Cuatro atrás para cuidar un resultado, con salida por el volante.', [
      [50, 94, 'Arquero'], [14, 70, 'Lateral izq.'], [38, 76, 'Central izq.'], [62, 76, 'Central der.'], [86, 70, 'Lateral der.'], [50, 52, 'Volante'], [50, 26, 'Delantero'],
    ]),
  ],
  futbol5: [
    fm(R.futbol5, 'f5-3-1', '3-1', 'Clásicas', 'Tres en línea detrás de un delantero que fija a los centrales.', [
      [50, 94, 'Arquero'], [16, 64, 'Volante izq.'], [50, 70, 'Defensa'], [84, 64, 'Volante der.'], [50, 32, 'Delantero'],
    ]),
    fm(R.futbol5, 'f5-4-0', '4-0', 'Modernas', 'Cuatro en línea sin delantero fijo: rotan todos.', [
      [50, 94, 'Arquero'], [12, 54, 'Lateral izq.'], [37, 58, 'Central izq.'], [63, 58, 'Central der.'], [88, 54, 'Lateral der.'],
    ]),
    fm(R.futbol5, 'f5-2-1-1', '2-1-1', 'Modernas', 'Dos atrás, un volante y un delantero: equilibrio en cancha chica.', [
      [50, 94, 'Arquero'], [32, 74, 'Defensa izq.'], [68, 74, 'Defensa der.'], [50, 54, 'Volante'], [50, 30, 'Delantero'],
    ]),
    fm(R.futbol5, 'f5-1-1-2', '1-1-2', 'Ofensivas', 'Un defensa, un volante y dos delanteros arriba.', [
      [50, 94, 'Arquero'], [50, 74, 'Defensa'], [50, 54, 'Volante'], [30, 30, 'Delantero izq.'], [70, 30, 'Delantero der.'],
    ]),
    fm(R.futbol5, 'f5-1-3', '1-3', 'Ofensivas', 'Un solo defensa y tres atacando: para buscar el gol.', [
      [50, 94, 'Arquero'], [50, 72, 'Defensa'], [18, 38, 'Volante izq.'], [50, 30, 'Delantero'], [82, 38, 'Volante der.'],
    ]),
    fm(R.futbol5, 'f5-5x4', '5x4 (arquero-jugador)', 'Especiales', 'El arquero sale a jugar: cinco de campo contra cuatro.', [
      [50, 52, 'Arquero-jugador'], [14, 40, 'Volante izq.'], [86, 40, 'Volante der.'], [30, 14, 'Delantero izq.'], [70, 14, 'Delantero der.'],
    ], true),
  ],
  futsal: [
    fm(R.futsal, 'fs-3-1', '3-1', 'Clásicas', 'Tres en línea y un pívot que fija y descarga: el más usado en élite.', [
      [50, 94, 'Arquero'], [16, 64, 'Ala izq.'], [50, 70, 'Cierre'], [84, 64, 'Ala der.'], [50, 32, 'Pívot'],
    ]),
    fm(R.futsal, 'fs-4-0', '4-0', 'Modernas', 'Cuatro en línea sin pívot: rotación continua y movilidad.', [
      [50, 94, 'Arquero'], [12, 54, 'Ala izq.'], [37, 58, 'Universal izq.'], [63, 58, 'Universal der.'], [88, 54, 'Ala der.'],
    ]),
    fm(R.futsal, 'fs-2-1-1', '2-1-1', 'Modernas', 'Dos cierres, un ala por el centro y un pívot.', [
      [50, 94, 'Arquero'], [32, 74, 'Cierre izq.'], [68, 74, 'Cierre der.'], [50, 54, 'Ala'], [50, 30, 'Pívot'],
    ]),
    fm(R.futsal, 'fs-1-1-2', '1-1-2', 'Ofensivas', 'Un cierre, un ala y dos pívots: dos referencias arriba.', [
      [50, 94, 'Arquero'], [50, 74, 'Cierre'], [50, 54, 'Ala'], [30, 30, 'Pívot izq.'], [70, 30, 'Pívot der.'],
    ]),
    fm(R.futsal, 'fs-1-3', '1-3', 'Ofensivas', 'Solo el cierre atrás y tres atacando: arriesgado, para remontar.', [
      [50, 94, 'Arquero'], [50, 72, 'Cierre'], [18, 38, 'Ala izq.'], [50, 30, 'Pívot'], [82, 38, 'Ala der.'],
    ]),
    fm(R.futsal, 'fs-5x4', '5x4 (portero-jugador)', 'Especiales', 'El portero sale como quinto jugador de campo: superioridad en ataque.', [
      [50, 52, 'Portero-jugador'], [14, 40, 'Ala izq.'], [86, 40, 'Ala der.'], [30, 14, 'Pívot izq.'], [70, 14, 'Pívot der.'],
    ], true),
  ],
  voleibol: [
    ...volleyRotations('5-1'),
    ...volleyRotations('4-2'),
    ...volleyRotations('6-2'),
    fm(R.voleibol, 'vb-def-2-1-3', 'Defensa 2-1-3', 'Defensivas', 'Bloqueo doble, el zaguero 6 sube detrás del bloqueo y tres cubren el fondo.', [
      [78, 53, 'Opuesto'], [64, 53, 'Central'], [22, 62, 'Punta 1'], [55, 70, 'Líbero'], [85, 88, 'Armador'], [15, 88, 'Punta 2'],
    ]),
    fm(R.voleibol, 'vb-def-2-0-4', 'Defensa 2-0-4 (perímetro)', 'Defensivas', 'Bloqueo doble y cuatro defensores en el perímetro de la cancha.', [
      [80, 53, 'Opuesto'], [67, 53, 'Central'], [20, 64, 'Punta 1'], [14, 84, 'Líbero'], [50, 93, 'Punta 2'], [88, 80, 'Armador'],
    ]),
    fm(R.voleibol, 'vb-def-rotacional', 'Defensa rotacional', 'Defensivas', 'El zaguero 1 sube a cubrir la finta y los demás rotan hacia la línea.', [
      [80, 53, 'Opuesto'], [67, 53, 'Central'], [22, 66, 'Punta 1'], [74, 68, 'Armador'], [86, 88, 'Punta 2'], [40, 92, 'Líbero'],
    ]),
  ],
  baloncesto: [
    fm(R.baloncesto, 'bk-individual', 'Individual (hombre a hombre)', 'Defensas', 'Cada uno marca a su jugador en media cancha.', [
      [50, 64, 'Base'], [22, 70, 'Escolta'], [78, 72, 'Alero'], [30, 85, 'Ala-pívot'], [62, 86, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-3-2', 'Zona 3-2', 'Zonas', 'Tres arriba presionan el perímetro y dos cierran la pintura.', [
      [50, 76, 'Base'], [20, 72, 'Escolta'], [80, 72, 'Alero'], [32, 88, 'Ala-pívot'], [68, 88, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-1-2-2', 'Zona 1-2-2', 'Zonas', 'Uno arriba, dos en los aleros y dos al fondo: fuerte contra el tiro exterior.', [
      [50, 64, 'Base'], [22, 74, 'Escolta'], [78, 74, 'Alero'], [32, 88, 'Ala-pívot'], [68, 88, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-2-1-2', 'Zona 2-1-2', 'Zonas', 'Como la 2-3 con el pívot adelantado al tiro libre.', [
      [34, 72, 'Base'], [66, 72, 'Escolta'], [50, 82, 'Pívot'], [16, 88, 'Alero'], [84, 88, 'Ala-pívot'],
    ]),
    fm(R.baloncesto, 'bk-caja-y-uno', 'Caja y uno', 'Zonas', 'Cuatro en caja en la pintura y uno marca al mejor tirador rival.', [
      [50, 60, 'Base'], [34, 79, 'Alero'], [66, 79, 'Ala-pívot'], [34, 91, 'Escolta'], [66, 91, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-triangulo-y-dos', 'Triángulo y dos', 'Zonas', 'Tres en triángulo cierran la pintura y dos marcan a los dos mejores.', [
      [30, 62, 'Base'], [70, 62, 'Escolta'], [50, 78, 'Pívot'], [30, 90, 'Alero'], [70, 90, 'Ala-pívot'],
    ]),
    fm(R.baloncesto, 'bk-presion-1-2-2', 'Presión 1-2-2 (3/4)', 'Presiones', 'Presión en zona desde tres cuartos de cancha para frenar la subida.', [
      [50, 28, 'Base'], [24, 46, 'Escolta'], [76, 46, 'Alero'], [40, 68, 'Ala-pívot'], [60, 84, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-presion-2-2-1', 'Presión 2-2-1', 'Presiones', 'Presión a toda la cancha: dos sobre el saque, dos en media y uno de seguro.', [
      [32, 20, 'Base'], [68, 20, 'Escolta'], [22, 48, 'Alero'], [78, 48, 'Ala-pívot'], [50, 76, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-presion-1-3-1', 'Presión 1-3-1', 'Presiones', 'Presión a toda la cancha con trampas en las bandas.', [
      [50, 18, 'Base'], [14, 44, 'Escolta'], [50, 44, 'Ala-pívot'], [86, 44, 'Alero'], [50, 76, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-presion-individual', 'Presión individual', 'Presiones', 'Hombre a hombre a toda la cancha desde el saque rival.', [
      [50, 10, 'Base'], [30, 24, 'Escolta'], [70, 24, 'Alero'], [40, 40, 'Ala-pívot'], [62, 46, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-5-abierto', '5 abierto', 'Ofensivas', 'Los cinco fuera de la línea de tres: pintura libre para penetrar.', [
      [50, 34, 'Base'], [82, 26, 'Escolta'], [18, 26, 'Alero'], [93, 7, 'Ala-pívot'], [7, 7, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-4-fuera-1-dentro', '4 fuera, 1 dentro', 'Ofensivas', 'Cuatro tiradores abiertos y el pívot en el poste bajo.', [
      [50, 34, 'Base'], [82, 26, 'Escolta'], [18, 26, 'Alero'], [93, 7, 'Ala-pívot'], [63, 12, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-3-fuera-2-dentro', '3 fuera, 2 dentro', 'Ofensivas', 'Tres en el perímetro y dos postes bajos.', [
      [50, 34, 'Base'], [84, 22, 'Escolta'], [16, 22, 'Alero'], [36, 11, 'Ala-pívot'], [64, 11, 'Pívot'],
    ]),
    fm(R.baloncesto, 'bk-cuernos', 'Cuernos (horns)', 'Ofensivas', 'Dos grandes en los codos y dos tiradores en las esquinas.', [
      [50, 38, 'Base'], [34, 21, 'Ala-pívot'], [66, 21, 'Pívot'], [7, 7, 'Escolta'], [93, 7, 'Alero'],
    ]),
    fm(R.baloncesto, 'bk-1-4-alto', '1-4 alto', 'Ofensivas', 'Cuatro en línea a la altura del tiro libre: abre el uno contra uno.', [
      [50, 38, 'Base'], [10, 20, 'Escolta'], [34, 20, 'Ala-pívot'], [66, 20, 'Pívot'], [90, 20, 'Alero'],
    ]),
    fm(R.baloncesto, 'bk-ataque-1-3-1', 'Ataque 1-3-1', 'Ofensivas', 'Para atacar zonas pares: poste alto, dos aleros y un corredor de fondo.', [
      [50, 36, 'Base'], [14, 20, 'Escolta'], [50, 20, 'Pívot'], [86, 20, 'Alero'], [62, 8, 'Ala-pívot'],
    ]),
    fm(R.baloncesto, 'bk-caja', 'Caja (box)', 'Ofensivas', 'Cuatro en caja (dos codos, dos bloques) para cortinas y salidas.', [
      [50, 38, 'Base'], [34, 20, 'Escolta'], [66, 20, 'Alero'], [34, 10, 'Ala-pívot'], [66, 10, 'Pívot'],
    ]),
  ],
  balonmano: [
    fm(R.balonmano, 'bm-4-2', 'Defensa 4-2', 'Defensivas', 'Cuatro en los 6 m y dos avanzados que cortan a los laterales.', [
      [50, 96, 'Portero'], [10, 86, 'Extremo izq.'], [36, 82, 'Central izq.'], [64, 82, 'Central der.'], [90, 86, 'Extremo der.'], [32, 70, 'Avanzado izq.'], [68, 70, 'Avanzado der.'],
    ]),
    fm(R.balonmano, 'bm-3-2-1', 'Defensa 3-2-1', 'Defensivas', 'Defensa escalonada en tres líneas: activa y profunda.', [
      [50, 96, 'Portero'], [18, 86, 'Extremo izq.'], [50, 82, 'Central'], [82, 86, 'Extremo der.'], [30, 74, 'Lateral izq.'], [70, 74, 'Lateral der.'], [50, 64, 'Avanzado'],
    ]),
    fm(R.balonmano, 'bm-3-3', 'Defensa 3-3', 'Defensivas', 'Dos líneas de tres: presiona el tiro de 9 m.', [
      [50, 96, 'Portero'], [16, 86, 'Extremo izq.'], [50, 82, 'Central'], [84, 86, 'Extremo der.'], [26, 72, 'Lateral izq.'], [50, 70, 'Avanzado'], [74, 72, 'Lateral der.'],
    ]),
    fm(R.balonmano, 'bm-5-mas-1', 'Defensa mixta 5+1', 'Defensivas', 'Cinco en zona y uno marca en individual al mejor rival.', [
      [50, 96, 'Portero'], [7, 89, 'Exterior izq.'], [27, 82, 'Lateral izq.'], [50, 80, 'Central'], [73, 82, 'Lateral der.'], [93, 89, 'Exterior der.'], [54, 62, 'Marca individual'],
    ]),
    fm(R.balonmano, 'bm-4-mas-2', 'Defensa mixta 4+2', 'Defensivas', 'Cuatro en zona y dos marcas individuales sobre los lanzadores.', [
      [50, 96, 'Portero'], [10, 88, 'Exterior izq.'], [37, 82, 'Central izq.'], [63, 82, 'Central der.'], [90, 88, 'Exterior der.'], [30, 64, 'Marca individual izq.'], [70, 64, 'Marca individual der.'],
    ]),
    fm(R.balonmano, 'bm-individual', 'Defensa individual', 'Defensivas', 'Cada uno a su jugador, adelantados: para recuperar rápido.', [
      [50, 96, 'Portero'], [8, 74, 'Extremo izq.'], [28, 66, 'Lateral izq.'], [44, 60, 'Central izq.'], [58, 64, 'Central der.'], [74, 66, 'Lateral der.'], [92, 74, 'Extremo der.'],
    ]),
    fm(R.balonmano, 'bm-ataque-3-3', 'Ataque 3-3', 'Ofensivas', 'Tres en la primera línea (laterales y central) y tres en la segunda (extremos y pivote).', [
      [50, 96, 'Portero'], [5, 8, 'Extremo izq.'], [24, 30, 'Lateral izq.'], [50, 34, 'Central'], [76, 30, 'Lateral der.'], [95, 8, 'Extremo der.'], [50, 16, 'Pivote'],
    ]),
    fm(R.balonmano, 'bm-ataque-2-4', 'Ataque 2-4', 'Ofensivas', 'Dos laterales arriba y cuatro en la línea de 6 m con dos pivotes.', [
      [50, 96, 'Portero'], [5, 8, 'Extremo izq.'], [34, 30, 'Lateral izq.'], [66, 30, 'Lateral der.'], [95, 8, 'Extremo der.'], [38, 16, 'Pivote izq.'], [62, 16, 'Pivote der.'],
    ]),
    fm(R.balonmano, 'bm-7-contra-6', 'Ataque 7 contra 6', 'Especiales', 'Sin portero: un jugador de campo más para atacar en superioridad.', [
      [5, 8, 'Extremo izq.'], [22, 28, 'Lateral izq.'], [40, 32, 'Central izq.'], [60, 32, 'Central der.'], [78, 28, 'Lateral der.'], [95, 8, 'Extremo der.'], [50, 16, 'Pivote'],
    ], true),
  ],
  generico: [
    fm(R.generico, 'gen-2-2-2', 'Tres líneas de 2', 'Básicas', 'Tres parejas escalonadas: sirve para cualquier deporte.', [
      [30, 82, 'Jugador 1'], [70, 82, 'Jugador 2'], [30, 62, 'Jugador 3'], [70, 62, 'Jugador 4'], [30, 42, 'Jugador 5'], [70, 42, 'Jugador 6'],
    ]),
    fm(R.generico, 'gen-rombo', 'Rombo 1-2-2-1', 'Básicas', 'Uno atrás, dos parejas y uno adelante.', [
      [50, 84, 'Jugador 1'], [25, 70, 'Jugador 2'], [75, 70, 'Jugador 3'], [25, 52, 'Jugador 4'], [75, 52, 'Jugador 5'], [50, 38, 'Jugador 6'],
    ]),
  ],
} satisfies Partial<Record<TacticalSport, SportFormation[]>>;

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
      group: f.group, description: f.description,
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
      meta(onCourt(R.futbol7, 'f7-2-3-1', '2-3-1', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 30, y: 74, label: 'Defensa' },
        { x: 70, y: 74, label: 'Defensa' },
        { x: 14, y: 50, label: 'Volante izq.' },
        { x: 50, y: 54, label: 'Medio' },
        { x: 86, y: 50, label: 'Volante der.' },
        { x: 50, y: 24, label: 'Delantero' },
      ]), 'Clásicas', 'Dos defensas, tres volantes y un delantero: la base del fútbol 7.'),
      meta(onCourt(R.futbol7, 'f7-3-2-1', '3-2-1', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 18, y: 74, label: 'Lateral izq.' },
        { x: 50, y: 78, label: 'Central' },
        { x: 82, y: 74, label: 'Lateral der.' },
        { x: 32, y: 50, label: 'Medio' },
        { x: 68, y: 50, label: 'Medio' },
        { x: 50, y: 24, label: 'Delantero' },
      ]), 'Clásicas', 'Tres atrás, dos volantes y un punta: segura atrás.'),
      ...EXTRA_FORMATIONS.futbol7,
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
      meta(onCourt(R.futbol5, 'f5-1-2-1', '1-2-1 (rombo)', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 50, y: 76, label: 'Defensa' },
        { x: 18, y: 56, label: 'Volante izq.' },
        { x: 82, y: 56, label: 'Volante der.' },
        { x: 50, y: 32, label: 'Delantero' },
      ]), 'Básicas', 'Rombo: un defensa, dos volantes por banda y un delantero.'),
      meta(onCourt(R.futbol5, 'f5-2-2', '2-2 (cuadrado)', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 28, y: 72, label: 'Defensa' },
        { x: 72, y: 72, label: 'Defensa' },
        { x: 28, y: 40, label: 'Delantero' },
        { x: 72, y: 40, label: 'Delantero' },
      ]), 'Básicas', 'Cuadrado: dos atrás y dos arriba, ideal para iniciación.'),
      ...EXTRA_FORMATIONS.futbol5,
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
      meta(onCourt(R.futsal, 'fs-1-2-1', '1-2-1 (rombo)', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 50, y: 76, label: 'Cierre' },
        { x: 18, y: 58, label: 'Ala izq.' },
        { x: 82, y: 58, label: 'Ala der.' },
        { x: 50, y: 34, label: 'Pívot' },
      ]), 'Básicas', 'Rombo: cierre, dos alas y pívot; ocupa bien los espacios.'),
      meta(onCourt(R.futsal, 'fs-2-2', '2-2 (cuadrado)', [
        { x: 50, y: 94, label: 'Arquero' },
        { x: 28, y: 72, label: 'Cierre' },
        { x: 72, y: 72, label: 'Cierre' },
        { x: 28, y: 42, label: 'Ala' },
        { x: 72, y: 42, label: 'Pívot' },
      ]), 'Básicas', 'Cuadrado: dos cierres y dos arriba; el más sencillo de aprender.'),
      ...EXTRA_FORMATIONS.futsal,
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
      meta(onCourt(R.voleibol, 'vb-rotacion', 'Rotación (zonas 1-6)', [
        { x: 80, y: 86, label: 'Zona 1' },
        { x: 80, y: 61, label: 'Zona 2' },
        { x: 50, y: 61, label: 'Zona 3' },
        { x: 20, y: 61, label: 'Zona 4' },
        { x: 20, y: 86, label: 'Zona 5' },
        { x: 50, y: 86, label: 'Zona 6' },
      ]), 'Básicas', 'Las seis zonas en orden de rotación, para explicar dónde va cada uno.'),
      meta(onCourt(R.voleibol, 'vb-recepcion-w', 'Recepción en W', [
        { x: 72, y: 54, label: 'Armador' },
        { x: 14, y: 66, label: 'Receptor' },
        { x: 50, y: 70, label: 'Receptor' },
        { x: 86, y: 66, label: 'Receptor' },
        { x: 30, y: 86, label: 'Receptor' },
        { x: 70, y: 86, label: 'Líbero' },
      ]), 'Básicas', 'Recepción en W con cinco receptores, típica de iniciación.'),
      ...EXTRA_FORMATIONS.voleibol,
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
      meta(onCourt(R.baloncesto, 'bk-2-3', 'Zona 2-3', [
        { x: 34, y: 70, label: 'Base' },
        { x: 66, y: 70, label: 'Escolta' },
        { x: 16, y: 85, label: 'Alero' },
        { x: 50, y: 89, label: 'Pívot' },
        { x: 84, y: 85, label: 'Ala-pívot' },
      ]), 'Zonas', 'Dos arriba y tres en la línea de fondo: protege la pintura y el rebote.'),
      meta(onCourt(R.baloncesto, 'bk-1-3-1', 'Zona 1-3-1', [
        { x: 50, y: 64, label: 'Base' },
        { x: 18, y: 76, label: 'Escolta' },
        { x: 50, y: 78, label: 'Pívot' },
        { x: 82, y: 76, label: 'Alero' },
        { x: 50, y: 92, label: 'Ala-pívot' },
      ]), 'Zonas', 'Uno arriba, tres a la altura del tiro libre y uno bajo el aro: fuerza pérdidas.'),
      ...EXTRA_FORMATIONS.baloncesto,
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
      meta(onCourt(R.balonmano, 'bm-6-0', 'Defensa 6-0', [
        { x: 50, y: 96, label: 'Portero' },
        { x: 7, y: 89, label: 'Exterior izq.' },
        { x: 24, y: 82, label: 'Lateral izq.' },
        { x: 41, y: 79.5, label: 'Central' },
        { x: 59, y: 79.5, label: 'Central' },
        { x: 76, y: 82, label: 'Lateral der.' },
        { x: 93, y: 89, label: 'Exterior der.' },
      ]), 'Defensivas', 'Los seis en la línea de 6 m: cerrada, la más usada en igualdad.'),
      meta(onCourt(R.balonmano, 'bm-5-1', 'Defensa 5-1', [
        { x: 50, y: 96, label: 'Portero' },
        { x: 7, y: 89, label: 'Exterior izq.' },
        { x: 27, y: 82, label: 'Lateral izq.' },
        { x: 50, y: 80, label: 'Central' },
        { x: 73, y: 82, label: 'Lateral der.' },
        { x: 93, y: 89, label: 'Exterior der.' },
        { x: 50, y: 66, label: 'Avanzado' },
      ]), 'Defensivas', 'Cinco en los 6 m y un avanzado que molesta al central rival.'),
      ...EXTRA_FORMATIONS.balonmano,
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
      meta(onCourt(R.generico, 'gen-3-3', 'Dos líneas de 3', [
        { x: 20, y: 80, label: 'Jugador 1' },
        { x: 50, y: 80, label: 'Jugador 2' },
        { x: 80, y: 80, label: 'Jugador 3' },
        { x: 20, y: 60, label: 'Jugador 4' },
        { x: 50, y: 60, label: 'Jugador 5' },
        { x: 80, y: 60, label: 'Jugador 6' },
      ]), 'Básicas', 'Dos líneas de tres: punto de partida para cualquier deporte.'),
      ...EXTRA_FORMATIONS.generico,
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
 * ("F7", "Fútbol 5", "7 vs 7"); "Sub 7" es edad y no cuenta. Lo que no tiene
 * cancha propia (natación, tenis, porrismo…) cae a 'generico'. Si el equipo
 * abre o no la pizarra lo dice teamBoardAccess / hasTacticalBoard, no esto.
 */
export function sportFromTeam(team: TeamSportInput | null | undefined): TacticalSport {
  return boardSportFromTeam(team);
}
