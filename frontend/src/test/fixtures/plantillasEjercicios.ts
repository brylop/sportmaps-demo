/**
 * Plantillas SportMaps de la Biblioteca de ejercicios para los deportes que no
 * tenían ninguna (futsal, voleibol, baloncesto, balonmano, fútbol 5 y
 * genérico). FUENTE de la migración
 * supabase/migrations/20261013194057_plantillas_ejercicios_otros_deportes.sql:
 * el SQL de esa migración es `buildTemplatesSql()` tal cual, y
 * src/test/plantillasEjercicios.test.tsx lo verifica (si alguien toca este
 * archivo sin generar una migración NUEVA, el test se pone rojo).
 *
 * Las migraciones son inmutables: para corregir o agregar plantillas después,
 * crear otra migración (npm run migrations:new) y otro fixture, no editar este.
 *
 * Coordenadas: se escriben en % de la CANCHA del deporte (0-100 a lo ancho y a
 * lo largo, arco/canasta propio abajo en y=100, rival arriba en y=0; igual que
 * `onCourt` de tacticalSports.ts) y se pasan a % del TABLERO (lo que se guarda)
 * con el rectángulo de la cancha de ese deporte. Así cada jugada cae dentro de
 * SU cancha y no en la de fútbol 11.
 *
 * Formato de `board` = el de las 12 plantillas de 20261008183744:
 * { players: [{key:'slot#i', slot_label, x, y, jersey_number?}], arrows, frames }
 * con players/arrows = el primer cuadro.
 */
import { SPORTS, type TacticalSport } from '@/lib/school/tacticalSports';
import type { TacticalArrow, TacticalArrowColor } from '@/lib/school/footballQueries';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';
import type { ExerciseBoard, ExerciseBoardPlayer } from '@/lib/school/exerciseLibrary';

export const MIGRATION_VERSION = '20261013194057';
export const MIGRATION_FILE = `supabase/migrations/${MIGRATION_VERSION}_plantillas_ejercicios_otros_deportes.sql`;

type P = [number, number];
type ShapeType = NonNullable<TacticalArrow['type']>;

interface ShapeSpec {
  type: ShapeType;
  /** Origen (o centro de un objeto / texto). */
  a: P;
  /** Destino de flechas, curvas, zonas y recorridos del balón. */
  b?: P;
  color?: TacticalArrowColor;
  kind?: 'pase' | 'remate' | 'penal';
  size?: number;
  rot?: number;
  text?: string;
  /** Solo freehand: puntos del trazo. */
  pts?: P[];
}

interface FrameSpec {
  /** Una posición por puesto, en el orden de `slots`. */
  players: P[];
  /** Índice del puesto que tiene el balón, una posición, o null. */
  ball?: number | P | null;
  /** Rivales (pin rojo). Si un cuadro no los trae, repite los del anterior. */
  opp?: P[];
  /** Arquero/portero rival (pin amarillo). Igual que `opp`. */
  gk?: P | null;
  /** Flechas, pases y notas de ESTE cuadro (lo que pasa hacia el siguiente). */
  shapes?: ShapeSpec[];
  ms?: number;
}

interface TemplateSpec {
  n: number;
  sport: Exclude<TacticalSport, 'futbol' | 'futbol7'>;
  name: string;
  objective: string;
  minutes: number;
  age_group: string;
  materials: string;
  tags: string[];
  description: string;
  slots: { label: string; jersey?: number }[];
  /** Material fijo que se repite en todos los cuadros. */
  statics?: ShapeSpec[];
  frames: FrameSpec[];
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  objective: string;
  minutes: number;
  age_group: string;
  materials: string;
  tags: string[];
  sport: TacticalSport;
  description: string;
  board: ExerciseBoard;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** % de cancha → % de tablero para un deporte. */
function toBoard(sport: TacticalSport, [x, y]: P): P {
  const c = SPORTS[sport].court;
  return [round1(c.x0 + (x / 100) * (c.x1 - c.x0)), round1(c.y0 + (y / 100) * (c.y1 - c.y0))];
}

function shapeToArrow(sport: TacticalSport, s: ShapeSpec): TacticalArrow {
  const [x1, y1] = toBoard(sport, s.a);
  const [x2, y2] = s.b ? toBoard(sport, s.b) : [x1, y1];
  const out: TacticalArrow = { type: s.type, x1, y1, x2, y2 };
  if (s.type === 'freehand') {
    const pts = (s.pts ?? []).map((p) => toBoard(sport, p));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    out.x1 = Math.min(...xs); out.y1 = Math.min(...ys);
    out.x2 = Math.max(...xs); out.y2 = Math.max(...ys);
    out.points = pts.flat();
  }
  if (s.color) out.color = s.color;
  if (s.size !== undefined) out.size = s.size;
  if (s.rot !== undefined) out.rot = s.rot;
  if (s.kind) out.kind = s.kind;
  if (s.text !== undefined) out.text = s.text;
  return out;
}

const uuid = (n: number) => `5b1b0000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function build(t: TemplateSpec): ExerciseTemplate {
  const players: ExerciseBoardPlayer[] = t.slots.map((s, i) => {
    const [x, y] = toBoard(t.sport, t.frames[0].players[i]);
    return { key: `slot#${i}`, slot_label: s.label, x, y, ...(s.jersey !== undefined ? { jersey_number: s.jersey } : {}) };
  });
  let opp: P[] = [];
  let gk: P | null = null;
  const frames: TacticalFrame[] = t.frames.map((f, fi) => {
    if (f.players.length !== t.slots.length) throw new Error(`${t.name}: cuadro ${fi + 1} no trae a todos los puestos`);
    if (f.opp) opp = f.opp;
    if (f.gk !== undefined) gk = f.gk;
    const pos = f.players.map((p) => toBoard(t.sport, p));
    let ball: { x: number; y: number } | null = null;
    if (typeof f.ball === 'number') {
      const [bx, by] = pos[f.ball];
      ball = { x: bx, y: round1(Math.max(0, by - 1.5)) };
    } else if (Array.isArray(f.ball)) {
      const [bx, by] = toBoard(t.sport, f.ball);
      ball = { x: bx, y: by };
    }
    const arrows: TacticalArrow[] = [
      ...(t.statics ?? []).map((s) => shapeToArrow(t.sport, s)),
      ...opp.map((p) => shapeToArrow(t.sport, { type: 'opponent', a: p, color: 'red' })),
      ...(gk ? [shapeToArrow(t.sport, { type: 'opponent', a: gk, color: 'yellow' })] : []),
      ...(f.shapes ?? []).map((s) => shapeToArrow(t.sport, s)),
    ];
    return {
      id: `f${fi + 1}`,
      duration_ms: f.ms ?? 1200,
      players: pos.map(([x, y], i) => ({ key: `slot#${i}`, x, y })),
      ball,
      arrows,
    };
  });
  return {
    id: uuid(t.n),
    name: t.name,
    objective: t.objective,
    minutes: t.minutes,
    age_group: t.age_group,
    materials: t.materials,
    tags: t.tags,
    sport: t.sport,
    description: t.description,
    board: { players, arrows: frames[0].arrows, frames },
  };
}

// Atajos de figuras.
const pase = (a: P, b: P, color: TacticalArrowColor = 'yellow'): ShapeSpec => ({ type: 'ball_path', kind: 'pase', a, b, color });
const remate = (a: P, b: P): ShapeSpec => ({ type: 'ball_path', kind: 'remate', a, b, color: 'red' });
const run = (a: P, b: P, color: TacticalArrowColor = 'white'): ShapeSpec => ({ type: 'arrow', a, b, color });
const curve = (a: P, b: P, color: TacticalArrowColor = 'white'): ShapeSpec => ({ type: 'curve', a, b, color });
const note = (a: P, text: string, color: TacticalArrowColor = 'white', size = 0.9): ShapeSpec => ({ type: 'text', a, text, color, size });
const obj = (type: ShapeType, a: P, color?: TacticalArrowColor, extra: Partial<ShapeSpec> = {}): ShapeSpec => ({ type, a, ...(color ? { color } : {}), ...extra });

const SPECS: TemplateSpec[] = [
  // ─── Futsal (cancha 20×40 m) ──────────────────────────────────────────────
  {
    n: 13,
    sport: 'futsal',
    name: 'Pared y diagonal del ala',
    objective: 'Superar a la defensa con la pared del pívot y el desmarque en diagonal del ala para rematar al primer toque.',
    minutes: 15,
    age_group: 'Sub-10 en adelante',
    materials: '1 arco, 6 balones, 4 petos',
    tags: ['finalización', 'pared', 'desmarque', 'ataque'],
    description: 'Media cancha de futsal. El cierre abre al ala, el pívot da la cara y descarga de primera mientras el ala ataca en diagonal el espacio entre los dos defensores. Remate al primer toque. Empezar con defensores pasivos y luego activos. Rotar puestos cada tres repeticiones y hacerlo por las dos bandas.',
    slots: [{ label: 'Cierre', jersey: 4 }, { label: 'Ala izq.', jersey: 7 }, { label: 'Ala der.', jersey: 10 }, { label: 'Pívot', jersey: 9 }],
    frames: [
      { players: [[50, 72], [18, 58], [82, 58], [50, 30]], ball: 0, opp: [[60, 40], [40, 40]], gk: [50, 3],
        shapes: [pase([50, 72], [82, 58]), run([50, 30], [68, 34])] },
      { players: [[50, 70], [18, 56], [82, 58], [68, 34]], ball: 2,
        shapes: [pase([82, 58], [68, 34]), run([82, 58], [62, 24]), run([18, 56], [30, 22])] },
      { players: [[50, 66], [30, 22], [62, 24], [68, 34]], ball: 3, opp: [[58, 38], [44, 30]],
        shapes: [pase([68, 34], [62, 24])] },
      { players: [[50, 64], [32, 18], [62, 24], [66, 36]], ball: 2,
        shapes: [remate([62, 24], [54, 1])] },
    ],
  },
  {
    n: 14,
    sport: 'futsal',
    name: 'Defensa en rombo: basculación y ayudas',
    objective: 'Mover el rombo defensivo hacia el lado del balón: presión al poseedor, cobertura del compañero y cierre del pase al pívot.',
    minutes: 15,
    age_group: 'Sub-12 en adelante',
    materials: '2 balones, 8 petos, 4 platillos',
    tags: ['defensa', 'basculación', 'presión', 'táctico'],
    description: 'Cuatro defensores en rombo y el arquero contra cuatro atacantes que mueven el balón por fuera. A cada pase el más cercano presiona, el cierre cubre y el ala del lado contrario cierra por dentro. El entrenador detiene la jugada y corrige distancias (3 a 4 m entre defensores).',
    slots: [{ label: 'Arquero', jersey: 1 }, { label: 'Pívot', jersey: 9 }, { label: 'Ala izq.', jersey: 7 }, { label: 'Ala der.', jersey: 10 }, { label: 'Cierre', jersey: 4 }],
    frames: [
      { players: [[50, 95], [50, 52], [28, 64], [72, 64], [50, 78]], ball: [50, 38], opp: [[50, 40], [12, 56], [88, 56], [50, 86]],
        shapes: [pase([50, 40], [88, 56]), run([72, 64], [80, 60]), run([50, 52], [62, 58]), run([50, 78], [60, 80]), run([28, 64], [42, 72])] },
      { players: [[56, 95], [62, 58], [42, 72], [80, 60], [60, 80]], ball: [88, 54], opp: [[50, 40], [12, 56], [88, 56], [54, 86]],
        shapes: [note([86, 47], 'Presiona'), note([76, 84], 'Cubre'), pase([88, 56], [50, 40])] },
      { players: [[50, 95], [50, 52], [28, 64], [72, 64], [50, 78]], ball: [50, 38], opp: [[50, 40], [12, 56], [88, 56], [50, 86]],
        shapes: [note([50, 46], 'Vuelve el rombo')] },
    ],
  },
  {
    n: 15,
    sport: 'futsal',
    name: 'Saque de banda con bloqueo',
    objective: 'Generar un remate claro desde el saque de banda en campo rival con el bloqueo del pívot y un desmarque de apoyo.',
    minutes: 15,
    age_group: 'Sub-12 en adelante',
    materials: '1 arco, 8 balones, petos',
    tags: ['balón parado', 'saque de banda', 'bloqueo', 'remate'],
    description: 'Saque de banda a la altura de la línea de 10 m del rival. El ala saca, el pívot bloquea al defensor del cierre y el cierre recibe de frente para rematar. El otro ala ataca el segundo palo para el rebote. Practicar por las dos bandas y cambiar la señal del saque.',
    slots: [{ label: 'Sacador', jersey: 10 }, { label: 'Cierre', jersey: 4 }, { label: 'Pívot', jersey: 9 }, { label: 'Ala izq.', jersey: 7 }],
    frames: [
      { players: [[99, 30], [50, 46], [56, 22], [24, 32]], ball: [98, 30], opp: [[50, 40], [62, 16], [31, 26], [86, 32]], gk: [50, 3],
        shapes: [run([56, 22], [52, 37])] },
      { players: [[99, 30], [50, 46], [52, 37], [24, 32]], ball: [98, 30],
        shapes: [note([28, 44], 'Bloqueo'), curve([50, 46], [66, 30]), pase([99, 30], [66, 30]), run([24, 32], [34, 14])] },
      { players: [[99, 30], [66, 30], [52, 37], [34, 14]], ball: 1, opp: [[50, 41], [56, 24], [32, 22], [86, 32]],
        shapes: [remate([66, 30], [46, 1])] },
    ],
  },

  // ─── Voleibol (cancha 9×18 m, red en y=50, campo propio abajo) ────────────
  {
    n: 16,
    sport: 'voleibol',
    name: 'Recepción en W, armado y ataque por zona 4',
    objective: 'Recibir el saque con un pase alto y preciso al armador y terminar la jugada con el ataque por zona 4.',
    minutes: 20,
    age_group: 'Sub-12 en adelante',
    materials: 'Red, 10 balones, 6 platillos',
    tags: ['recepción', 'armado', 'ataque', 'táctico'],
    description: 'El entrenador o un compañero saca desde el otro campo. El equipo recibe en W, el líbero o el receptor pasa alto al armador cerca de la red y el armador coloca a zona 4. El atacante abre hacia afuera para tener carrera de impulso. Rotar después de cada tres saques.',
    slots: [{ label: 'Armador', jersey: 1 }, { label: 'Receptor z4', jersey: 4 }, { label: 'Central', jersey: 3 }, { label: 'Receptor z2', jersey: 2 }, { label: 'Receptor z5', jersey: 5 }, { label: 'Líbero', jersey: 6 }],
    frames: [
      { players: [[72, 54], [14, 66], [50, 70], [86, 66], [30, 86], [70, 86]], ball: [80, -4], opp: [[80, -6]],
        shapes: [remate([80, -5], [70, 84])], ms: 1400 },
      { players: [[72, 54], [14, 66], [50, 70], [86, 66], [30, 86], [70, 86]], ball: 5, opp: [[80, -6]],
        shapes: [pase([70, 86], [66, 54]), run([72, 54], [66, 55]), run([14, 66], [8, 74])] },
      { players: [[66, 55], [8, 74], [50, 70], [86, 66], [30, 86], [70, 86]], ball: 0, opp: [[50, 10]],
        shapes: [pase([66, 55], [14, 53]), curve([8, 74], [16, 56])] },
      { players: [[66, 55], [16, 56], [44, 64], [80, 64], [30, 80], [60, 84]], ball: [16, 52],
        shapes: [remate([16, 54], [72, 20])] },
    ],
  },
  {
    n: 17,
    sport: 'voleibol',
    name: 'Bloqueo doble y defensa detrás del bloqueo',
    objective: 'Formar el bloqueo doble ante el ataque rival por la punta y ubicar a los defensores en los huecos que deja el bloqueo.',
    minutes: 20,
    age_group: 'Sub-13 en adelante',
    materials: 'Red, 1 cajón o plataforma para el atacante, 10 balones',
    tags: ['bloqueo', 'defensa', 'cobertura', 'táctico'],
    description: 'Un atacante rival remata desde su zona 4 (sobre un cajón en las categorías menores). El central se desplaza con paso lateral para cerrar el bloqueo con el punta; zona 1 defiende la línea, zona 5 la diagonal, zona 6 el fondo y el atacante de zona 4 cubre la finta. Tres remates y rotar.',
    slots: [{ label: 'Bloqueador z2', jersey: 2 }, { label: 'Central z3', jersey: 3 }, { label: 'Atacante z4', jersey: 4 }, { label: 'Defensor z1', jersey: 1 }, { label: 'Defensor z6', jersey: 6 }, { label: 'Defensor z5', jersey: 5 }],
    frames: [
      { players: [[80, 56], [50, 56], [20, 58], [80, 86], [50, 88], [20, 86]], ball: [60, 42], opp: [[60, 44], [86, 40]],
        shapes: [pase([60, 44], [86, 40]), run([50, 56], [72, 54]), run([80, 56], [86, 54]), run([20, 58], [36, 66]), run([80, 86], [90, 80]), run([20, 86], [24, 76])] },
      { players: [[86, 53], [74, 53], [36, 66], [90, 80], [52, 90], [24, 76]], ball: [86, 38],
        shapes: [{ type: 'zone', a: [66, 50], b: [94, 57], color: 'blue' }, remate([86, 40], [26, 77])] },
      { players: [[86, 53], [74, 53], [36, 66], [90, 80], [52, 90], [24, 76]], ball: 5,
        shapes: [pase([24, 76], [60, 58])] },
    ],
  },
  {
    n: 18,
    sport: 'voleibol',
    name: 'Saque al blanco por zonas',
    objective: 'Sacar con dirección a una zona elegida del campo rival (zonas 1, 6 y 5) con el gesto completo.',
    minutes: 15,
    age_group: 'Sub-9 en adelante',
    materials: 'Red (puede ser baja), 3 aros, 12 balones',
    tags: ['saque', 'técnica', 'iniciación', 'precisión'],
    description: 'Tres aros en el fondo del campo rival marcan las zonas 1, 6 y 5. Cada jugador saca desde detrás de la línea de fondo y canta la zona antes de sacar. Un punto si el balón cae cerca del aro y tres si cae adentro. Los más pequeños sacan por abajo y desde más cerca de la red.',
    slots: [{ label: 'Sacador 1', jersey: 7 }, { label: 'Sacador 2', jersey: 8 }, { label: 'Sacador 3', jersey: 9 }],
    statics: [
      obj('ring', [20, 16], 'yellow'), obj('ring', [50, 16], 'yellow'), obj('ring', [80, 16], 'yellow'),
      note([20, 6], 'Zona 1', 'white', 0.8), note([50, 6], 'Zona 6', 'white', 0.8), note([80, 6], 'Zona 5', 'white', 0.8),
    ],
    frames: [
      { players: [[25, 105], [50, 105], [75, 105]], ball: 0, shapes: [remate([25, 104], [20, 16])], ms: 1400 },
      { players: [[25, 105], [50, 105], [75, 105]], ball: 1, shapes: [remate([50, 104], [50, 16])], ms: 1400 },
      { players: [[25, 105], [50, 105], [75, 105]], ball: 2, shapes: [remate([75, 104], [80, 16])], ms: 1400 },
    ],
  },

  // ─── Baloncesto (cancha 15×28 m, se ataca la canasta de arriba) ──────────
  {
    n: 19,
    sport: 'baloncesto',
    name: 'Bloqueo directo central (pick and roll)',
    objective: 'Leer el bloqueo directo: el base usa la pantalla y decide entre penetrar o pasar al pívot que continúa hacia el aro.',
    minutes: 20,
    age_group: 'Sub-13 en adelante',
    materials: '1 canasta, 5 balones, petos',
    tags: ['bloqueo directo', 'pick and roll', 'ataque', 'finalización', 'táctico'],
    description: 'Cinco contra cinco en media cancha. El pívot sube a poner el bloqueo al defensor del base. El base sale pegado a la pantalla hacia el lado libre; el pívot continúa hacia el aro. Si los dos defensores van al base, pase al pívot; si no, penetración y bandeja. Los demás abren espacio.',
    slots: [{ label: 'Base', jersey: 1 }, { label: 'Escolta', jersey: 2 }, { label: 'Alero', jersey: 3 }, { label: 'Ala-pívot', jersey: 4 }, { label: 'Pívot', jersey: 5 }],
    frames: [
      { players: [[50, 38], [88, 22], [10, 10], [22, 26], [62, 20]], ball: 0, opp: [[50, 32], [82, 20], [14, 13], [27, 22], [60, 14]],
        shapes: [run([62, 20], [56, 35])] },
      { players: [[50, 38], [88, 22], [10, 10], [22, 26], [56, 35]], ball: 0,
        shapes: [note([66, 42], 'Bloqueo'), curve([50, 38], [70, 24])] },
      { players: [[70, 24], [88, 22], [10, 10], [22, 26], [56, 35]], ball: 0, opp: [[62, 28], [82, 20], [14, 13], [30, 20], [66, 20]],
        shapes: [run([56, 35], [52, 14]), pase([70, 24], [52, 15])] },
      { players: [[70, 24], [88, 22], [10, 10], [22, 26], [52, 14]], ball: 4,
        shapes: [remate([52, 14], [50, 6])] },
    ],
  },
  {
    n: 20,
    sport: 'baloncesto',
    name: 'Contraataque 3v2 en tres carriles',
    objective: 'Después del rebote defensivo, ocupar los tres carriles y llegar con ventaja numérica a la canasta rival.',
    minutes: 15,
    age_group: 'Sub-11 en adelante',
    materials: '1 canasta en cada lado, 6 balones, 4 platillos para marcar los carriles',
    tags: ['transición ofensiva', 'contraataque', 'superioridad', 'pase'],
    description: 'El base sale botando por el carril central y los aleros corren abiertos por las bandas. Dos defensores esperan en tándem. El base fija al primer defensor antes de la línea de tres y pasa al alero libre, que termina en bandeja. Si el segundo defensor cierra al alero, pase al otro lado.',
    slots: [{ label: 'Base', jersey: 1 }, { label: 'Alero izq.', jersey: 3 }, { label: 'Alero der.', jersey: 2 }],
    statics: [obj('marker', [33, 55], 'orange'), obj('marker', [67, 55], 'orange'), obj('marker', [33, 35], 'orange'), obj('marker', [67, 35], 'orange')],
    frames: [
      { players: [[50, 82], [12, 84], [88, 84]], ball: 0, opp: [[50, 26], [50, 12]],
        shapes: [run([50, 82], [50, 50]), run([12, 84], [10, 42]), run([88, 84], [90, 42])] },
      { players: [[50, 50], [10, 42], [90, 42]], ball: 0,
        shapes: [run([50, 50], [50, 34]), run([10, 42], [14, 18]), run([90, 42], [86, 18])] },
      { players: [[50, 34], [14, 18], [86, 18]], ball: 0, opp: [[50, 29], [62, 13]],
        shapes: [pase([50, 34], [14, 18])] },
      { players: [[50, 34], [32, 11], [80, 16]], ball: 1,
        shapes: [remate([32, 11], [50, 6])] },
    ],
  },
  {
    n: 21,
    sport: 'baloncesto',
    name: 'Rueda de bandejas',
    objective: 'Automatizar la bandeja con los dos pasos y el pase de salida desde el rebote.',
    minutes: 12,
    age_group: 'Sub-7 en adelante',
    materials: '1 canasta, 1 balón por jugador de la fila de bandeja, 1 platillo',
    tags: ['bandeja', 'técnica', 'iniciación', 'finalización', 'calentamiento'],
    description: 'Dos filas: bandeja (con balón) en el ala derecha y rebote en el ala izquierda. El primero de bandeja bota hacia el aro y lanza con los dos pasos; el de rebote toma el balón y lo pasa al siguiente de la fila de bandeja. Cada uno cambia de fila. Después de cinco minutos, por la izquierda.',
    slots: [{ label: 'Bandeja 1' }, { label: 'Bandeja 2' }, { label: 'Bandeja 3' }, { label: 'Rebote 1' }, { label: 'Rebote 2' }],
    statics: [obj('marker', [78, 32], 'orange')],
    frames: [
      { players: [[80, 36], [86, 43], [92, 50], [18, 30], [10, 40]], ball: 0,
        shapes: [curve([80, 36], [60, 13]), run([18, 30], [42, 10])] },
      { players: [[60, 13], [86, 43], [92, 50], [42, 10], [10, 40]], ball: 0,
        shapes: [remate([60, 13], [50, 6])] },
      { players: [[60, 13], [86, 43], [92, 50], [44, 9], [10, 40]], ball: 3,
        shapes: [pase([44, 9], [86, 43]), run([60, 13], [16, 46]), curve([44, 9], [94, 56])] },
    ],
  },

  // ─── Balonmano (cancha 20×40 m, se ataca la portería de arriba) ──────────
  {
    n: 22,
    sport: 'balonmano',
    name: 'Contraataque directo desde el portero',
    objective: 'Salir rápido después de la parada: pase largo del portero al extremo que corre por la banda y lanzamiento en ventaja.',
    minutes: 15,
    age_group: 'Sub-11 en adelante',
    materials: '2 porterías, 8 balones, platillos',
    tags: ['transición ofensiva', 'contraataque', 'pase', 'lanzamiento'],
    description: 'El entrenador lanza al portero. En el momento de la parada los dos extremos arrancan por la banda. El portero pasa largo al extremo más adelantado, que recibe en carrera y lanza antes de que llegue el defensor que repliega. Alternar el lado y sumar un defensor cuando salga fácil.',
    slots: [{ label: 'Portero', jersey: 1 }, { label: 'Extremo izq.', jersey: 6 }, { label: 'Extremo der.', jersey: 11 }],
    frames: [
      { players: [[50, 95], [8, 80], [92, 80]], ball: 0, opp: [[62, 55]], gk: [50, 3],
        shapes: [run([8, 80], [10, 32]), run([92, 80], [90, 42])] },
      { players: [[50, 95], [10, 32], [90, 42]], ball: 0, opp: [[56, 42]],
        shapes: [pase([50, 95], [11, 30]), run([10, 32], [22, 22])] },
      { players: [[50, 95], [22, 22], [88, 34]], ball: 1, opp: [[44, 30]],
        shapes: [remate([22, 22], [46, 1])] },
    ],
  },
  {
    n: 23,
    sport: 'balonmano',
    name: 'Cruce de central y lateral contra defensa 6:0',
    objective: 'Atacar la defensa 6:0 con un cruce entre el central y el lateral derecho para lanzar desde 9 m con ventaja.',
    minutes: 20,
    age_group: 'Sub-13 en adelante',
    materials: '1 portería, 8 balones, petos',
    tags: ['ataque', 'cruce', 'lanzamiento', 'finalización', 'táctico'],
    description: 'Ataque 3:3 contra defensa 6:0. El central penetra en diagonal hacia el espacio entre el central y el lateral defensores; el lateral derecho cruza por detrás hacia el centro y recibe en carrera para lanzar por encima de la defensa. Si el defensor sale al lanzador, pase al pivote.',
    slots: [{ label: 'Extremo izq.', jersey: 6 }, { label: 'Lateral izq.', jersey: 9 }, { label: 'Central', jersey: 10 }, { label: 'Lateral der.', jersey: 8 }, { label: 'Extremo der.', jersey: 11 }, { label: 'Pivote', jersey: 7 }],
    frames: [
      { players: [[4, 12], [22, 30], [50, 34], [78, 30], [96, 12], [50, 18]], ball: 2,
        opp: [[10, 15], [26, 20], [42, 20], [58, 20], [74, 20], [90, 15]], gk: [50, 3],
        shapes: [run([50, 34], [62, 28]), curve([78, 30], [46, 28])] },
      { players: [[4, 12], [22, 30], [62, 28], [46, 28], [96, 12], [50, 18]], ball: 2,
        opp: [[10, 15], [26, 20], [42, 20], [60, 22], [70, 21], [90, 15]],
        shapes: [pase([62, 28], [46, 28])] },
      { players: [[4, 12], [22, 30], [62, 28], [46, 26], [96, 12], [50, 18]], ball: 3,
        shapes: [remate([46, 26], [44, 1])] },
    ],
  },
  {
    n: 24,
    sport: 'balonmano',
    name: 'Defensa 6:0: desplazamientos y salida al lanzador',
    objective: 'Desplazarse en bloque según el balón y salir a tiempo al lanzador de 9 m sin dejar huecos en la línea.',
    minutes: 20,
    age_group: 'Sub-13 en adelante',
    materials: '6 balones, petos, platillos en la línea de 9 m',
    tags: ['defensa', 'basculación', 'blocaje', 'táctico'],
    description: 'Seis defensores en la línea de 6 m y seis atacantes que circulan el balón. Cuando el balón llega a un lateral, su defensor sale a 8-9 m con los brazos arriba para blocar y los compañeros cierran hacia ese lado. Cuando el balón se va, vuelve a la línea. Cambiar los roles cada dos minutos.',
    slots: [{ label: 'Portero', jersey: 1 }, { label: 'Extremo izq.', jersey: 2 }, { label: 'Lateral izq.', jersey: 3 }, { label: 'Central izq.', jersey: 4 }, { label: 'Central der.', jersey: 5 }, { label: 'Lateral der.', jersey: 6 }, { label: 'Extremo der.', jersey: 7 }],
    frames: [
      { players: [[50, 96], [7, 89], [24, 82], [41, 80], [59, 80], [76, 82], [93, 89]], ball: [50, 64],
        opp: [[4, 92], [24, 68], [50, 66], [76, 68], [96, 92], [50, 85]],
        shapes: [pase([50, 66], [76, 68]), run([76, 82], [76, 74]), run([59, 80], [64, 81]), run([93, 89], [88, 86])] },
      { players: [[54, 96], [10, 88], [28, 82], [46, 81], [64, 81], [76, 74], [88, 86]], ball: [76, 66],
        shapes: [note([76, 61], 'Blocaje'), remate([76, 68], [74, 75])] },
      { players: [[54, 96], [10, 88], [28, 82], [46, 81], [64, 81], [76, 74], [88, 86]], ball: [76, 66],
        shapes: [pase([76, 68], [50, 66]), run([76, 74], [76, 82])] },
    ],
  },

  // ─── Fútbol 5 (cancha 25×40 m) ───────────────────────────────────────────
  {
    n: 25,
    sport: 'futbol5',
    name: 'Rondo 4v1 en cuadrado',
    objective: 'Pasar a uno o dos toques con buen perfil y dar apoyos a los dos lados del poseedor.',
    minutes: 10,
    age_group: 'Sub-7 en adelante',
    materials: '4 platillos, 2 balones, 1 peto',
    tags: ['rondo', 'posesión', 'calentamiento', 'pase'],
    description: 'Cuadrado de 8×8 m. Cuatro por fuera, uno adentro. Máximo dos toques. Los que no tienen el balón se mueven sobre su lado para dar línea de pase. Si el de adentro toca el balón, entra el que perdió. Variante: un toque o pase prohibido al de al lado.',
    slots: [{ label: 'Exterior 1', jersey: 1 }, { label: 'Exterior 2', jersey: 2 }, { label: 'Exterior 3', jersey: 3 }, { label: 'Exterior 4', jersey: 4 }],
    statics: [
      { type: 'zone', a: [34, 40], b: [66, 60], color: 'yellow' },
      obj('cone', [34, 40], 'orange'), obj('cone', [66, 40], 'orange'), obj('cone', [66, 60], 'orange'), obj('cone', [34, 60], 'orange'),
    ],
    frames: [
      { players: [[50, 40], [66, 50], [50, 60], [34, 50]], ball: 0, opp: [[48, 49]],
        shapes: [pase([50, 40], [66, 50]), run([34, 50], [34, 44])] },
      { players: [[50, 40], [66, 50], [50, 60], [34, 44]], ball: 1, opp: [[58, 50]],
        shapes: [pase([66, 50], [50, 60]), run([50, 40], [42, 40])] },
      { players: [[42, 40], [66, 50], [50, 60], [34, 44]], ball: 2, opp: [[53, 56]],
        shapes: [pase([50, 60], [34, 44])] },
    ],
  },
  {
    n: 26,
    sport: 'futbol5',
    name: '2v1 y remate en fútbol 5',
    objective: 'Fijar al defensor con la conducción y decidir entre pase o remate en superioridad numérica.',
    minutes: 15,
    age_group: 'Sub-9 en adelante',
    materials: '1 arco, 8 balones, platillos',
    tags: ['finalización', 'superioridad', 'remate', 'ataque'],
    description: 'Dos atacantes contra un defensor y el arquero desde la mitad de la cancha. El poseedor conduce hacia el defensor; si el defensor lo cierra, pasa al compañero que ataca el segundo palo; si no, remata. Rotar roles cada tres repeticiones.',
    slots: [{ label: 'Atacante 1', jersey: 10 }, { label: 'Atacante 2', jersey: 9 }],
    frames: [
      { players: [[36, 56], [68, 52]], ball: 0, opp: [[52, 34]], gk: [50, 3],
        shapes: [run([36, 56], [46, 38]), curve([68, 52], [64, 22])] },
      { players: [[46, 38], [64, 22]], ball: 0, opp: [[48, 32]],
        shapes: [pase([46, 38], [64, 22])] },
      { players: [[46, 38], [64, 22]], ball: 1, gk: [56, 4],
        shapes: [remate([64, 22], [45, 1])] },
    ],
  },

  // ─── Genérico (espacio de 40×50 m) ───────────────────────────────────────
  {
    n: 27,
    sport: 'generico',
    name: 'Calentamiento por estaciones de coordinación',
    objective: 'Activar el cuerpo y mejorar la coordinación con escalera, aros, vallas bajas y zigzag entre conos.',
    minutes: 15,
    age_group: 'Sub-6 en adelante',
    materials: '1 escalera de coordinación, 3 vallas bajas, 3 aros, 5 conos',
    tags: ['calentamiento', 'coordinación', 'iniciación', 'técnica'],
    description: 'Circuito en U: escalera (un pie en cada cuadro), saltos con pies juntos en los aros, vallas bajas y zigzag entre conos para volver a la salida. Salen con cinco segundos de diferencia. Sirve para cualquier deporte: al final del circuito se puede agregar el gesto técnico (conducción, bote, pase).',
    slots: [{ label: 'Jugador 1' }, { label: 'Jugador 2' }, { label: 'Jugador 3' }],
    statics: [
      obj('ladder', [20, 70], 'yellow', { size: 1.4 }),
      obj('ring', [20, 44], 'blue'), obj('ring', [26, 34], 'blue'), obj('ring', [20, 24], 'blue'),
      obj('hurdle', [40, 14], 'orange'), obj('hurdle', [52, 14], 'orange'), obj('hurdle', [64, 14], 'orange'),
      obj('cone', [80, 28], 'orange'), obj('cone', [72, 42], 'orange'), obj('cone', [80, 56], 'orange'), obj('cone', [72, 70], 'orange'), obj('cone', [80, 84], 'orange'),
    ],
    frames: [
      { players: [[20, 90], [10, 95], [30, 95]], ball: null,
        shapes: [run([20, 88], [20, 52])] },
      { players: [[20, 52], [20, 90], [30, 95]], ball: null,
        shapes: [{ type: 'freehand', a: [20, 52], pts: [[20, 52], [20, 44], [26, 34], [20, 24], [28, 14], [40, 14], [52, 14], [66, 14], [76, 18]], color: 'white' }, run([20, 88], [20, 52])] },
      { players: [[76, 18], [20, 52], [20, 90]], ball: null,
        shapes: [{ type: 'freehand', a: [76, 18], pts: [[76, 18], [80, 28], [72, 42], [80, 56], [72, 70], [80, 84], [66, 94], [42, 95]], color: 'yellow' }],
        ms: 1600 },
    ],
  },
  {
    n: 28,
    sport: 'generico',
    name: 'El pañuelo: reacción y velocidad',
    objective: 'Mejorar la velocidad de reacción y la toma de decisiones con un juego tradicional por equipos.',
    minutes: 10,
    age_group: 'Sub-6 en adelante',
    materials: '1 pañuelo o peto, platillos para las dos líneas',
    tags: ['calentamiento', 'coordinación', 'velocidad de reacción', 'juego'],
    description: 'Dos equipos en líneas enfrentadas, cada jugador con un número. El entrenador sostiene el pañuelo en el centro y canta un número: los dos que lo tienen salen. Quien coge el pañuelo y vuelve a su línea sin ser tocado gana el punto. Variantes: cantar una suma, o salir desde sentados o de espaldas.',
    slots: [
      { label: 'Azul 1', jersey: 1 }, { label: 'Azul 2', jersey: 2 }, { label: 'Azul 3', jersey: 3 },
      { label: 'Rojo 1', jersey: 1 }, { label: 'Rojo 2', jersey: 2 }, { label: 'Rojo 3', jersey: 3 },
    ],
    statics: [
      obj('marker', [20, 88], 'blue'), obj('marker', [80, 88], 'blue'),
      obj('marker', [20, 12], 'red'), obj('marker', [80, 12], 'red'),
    ],
    frames: [
      { players: [[32, 84], [50, 84], [68, 84], [32, 16], [50, 16], [68, 16]], ball: null,
        shapes: [obj('marker', [50, 50], 'pink', { size: 1.3 }), note([76, 50], '«¡El dos!»', 'yellow', 1), run([50, 82], [50, 56]), run([50, 18], [50, 44])] },
      { players: [[32, 84], [50, 56], [68, 84], [32, 16], [50, 44], [68, 16]], ball: null,
        shapes: [obj('marker', [50, 50], 'pink', { size: 1.3 }), run([50, 56], [50, 82]), curve([50, 44], [54, 76], 'red')] },
      { players: [[32, 84], [50, 82], [68, 84], [32, 16], [54, 74], [68, 16]], ball: null,
        shapes: [note([50, 94], 'Punto para los azules', 'yellow', 0.9)] },
    ],
  },
];

export const TEMPLATES: ExerciseTemplate[] = SPECS.map(build);

// ─── SQL de la migración ────────────────────────────────────────────────────

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

const HEADER = `-- =============================================================================
-- ${MIGRATION_VERSION}_plantillas_ejercicios_otros_deportes.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-13   Versión anterior: 20261013165308
-- Objetivo: plantillas SportMaps de la Biblioteca de ejercicios (pizarra T3,
--   docs/specs/pizarra-nivel-tacticalpad.md) para los deportes que no tenían
--   ninguna: futsal, voleibol, baloncesto, balonmano, fútbol 5 y genérico.
--   Solo DATOS: ${TEMPLATES.length} filas en public.training_exercises (school_id NULL,
--   is_template = true), mismo formato de board que las 12 de 20261008183744.
-- =============================================================================
-- GENERADA desde frontend/src/test/fixtures/plantillasEjercicios.ts
-- (buildTemplatesSql). src/test/plantillasEjercicios.test.tsx valida cada
-- jugada (validateExerciseInput / validateFrames del BFF, coordenadas dentro
-- de la cancha del deporte, render con TacticalStaticSvg) y que este archivo
-- sea exactamente lo que genera el fixture.
--
-- Idempotente: ids fijos (ON CONFLICT (id) DO NOTHING) y además no inserta una
-- plantilla del sistema si ya hay otra con el mismo nombre y deporte (por si
-- un super admin la creó a mano antes). No toca las plantillas existentes.
--
-- Depende de 20261008183744_biblioteca_ejercicios_v2 (tabla training_exercises).
-- Inmutable: un cambio va en una migración NUEVA.
-- =============================================================================`;

export function buildTemplatesSql(): string {
  const rows = TEMPLATES.map((t) => [
    `  (${lit(t.id)}::uuid, ${lit(t.name)}, ${lit(t.objective)}, ${t.minutes}, ${lit(t.age_group)}, ${lit(t.materials)},`,
    `   ARRAY[${t.tags.map(lit).join(', ')}]::text[], ${lit(t.sport)}, ${lit(t.description)},`,
    `   ${lit(JSON.stringify(t.board))}::jsonb)`,
  ].join('\n'));
  return `${HEADER}

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.training_exercises') IS NULL THEN
    RAISE EXCEPTION 'Falta public.training_exercises: aplicar 20261008183744_biblioteca_ejercicios_v2 antes que esta migración.';
  END IF;
END $$;

INSERT INTO public.training_exercises
  (id, school_id, created_by, name, objective, minutes, age_group, materials, tags, sport, description, board, is_template, is_active)
SELECT v.id, NULL, NULL, v.name, v.objective, v.minutes, v.age_group, v.materials, v.tags, v.sport, v.description, v.board, true, true
FROM (VALUES
${rows.join(',\n')}
) AS v(id, name, objective, minutes, age_group, materials, tags, sport, description, board)
WHERE NOT EXISTS (
  SELECT 1 FROM public.training_exercises t
   WHERE t.school_id IS NULL
     AND t.sport = v.sport
     AND lower(btrim(t.name)) = lower(btrim(v.name))
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
`;
}
