/**
 * Formaciones fijas de la pizarra táctica (F2 de
 * docs/specs/rediseno-seguimiento-deportivo.md): la cancha arranca llena sin
 * depender de estadísticas de partidos. Coordenadas 0-100 de cancha COMPLETA,
 * arco propio abajo (y alto = defensa, y bajo = ataque), la misma convención
 * de generateFormation442() y de suggestLabel().
 *
 * Lógica pura, sin React: se puede probar en unidad.
 */
import type { PlacedSlot } from './tacticalBoardLogic';

/** Las cuatro de antes de M6a conservan clave, etiqueta y coordenadas
 *  (src/test/fixtures/formacionesHistoricas.json lo vigila). */
export const LEGACY_FORMATION_KEYS = ['4-3-3', '4-4-2', '3-5-2', 'f7-2-3-1'] as const;
/** Clave de una formación: las viejas (literal) o cualquiera del catálogo M6a. */
export type FormationKey = (typeof LEGACY_FORMATION_KEYS)[number] | (string & {});

export interface FormationSlot { x: number; y: number; label: string }

/** Familias de fútbol 11 en la galería (M6a). */
export type FootballFormationGroup = 'Clásicas' | 'Modernas' | 'Defensivas' | 'Ofensivas' | 'Históricas' | 'Fútbol 7';

export interface Formation {
  key: FormationKey;
  /** Lo que se ve en el menú y en el botón: "4-3-3", "2-3-1 (F7)". */
  label: string;
  /** Jugadores en cancha, arquero incluido (11 o 7). */
  players: number;
  slots: FormationSlot[];
  /** Familia en la galería (M6a). */
  group?: FootballFormationGroup;
  /** Una línea: qué es y cuándo se usa (M6a). */
  description?: string;
}

// Alturas de las líneas: dentro de las franjas de suggestLabel (Arquero ≥78,
// Defensa 48-78, Medio 22-48, Delantero <22) para que, si el coach mueve a un
// jugador, la etiqueta sugerida no salte a otra línea sin motivo.
const GK_Y = 92;
const DEF_Y = 70;
const MID_Y = 45;
const FWD_Y = 18;

// ─── Catálogo M6a (fútbol 11) ───────────────────────────────────────────────
// Fuentes: Wikipedia «Formation (association football)» (históricas y
// modernas) y la galería de TacticalPad. Coordenadas en % del tablero, arco
// propio abajo; líneas dentro de las franjas de suggestLabel. Etiquetas únicas
// dentro de cada formación («Central izq.», «Central der.»). Las cuatro viejas
// (arriba) no se tocan.

type Row = [x: number, y: number, label: string];

const BACK4: Row[] = [[14, 68, 'Lateral izq.'], [37, 72, 'Central izq.'], [63, 72, 'Central der.'], [86, 68, 'Lateral der.']];
const BACK3: Row[] = [[26, 70, 'Central izq.'], [50, 73, 'Central'], [74, 70, 'Central der.']];
const BACK5: Row[] = [[10, 62, 'Carrilero izq.'], [30, 71, 'Central izq.'], [50, 74, 'Central'], [70, 71, 'Central der.'], [90, 62, 'Carrilero der.']];
const BACK2: Row[] = [[34, 70, 'Zaguero izq.'], [66, 70, 'Zaguero der.']];
const MID4_WB: Row[] = [[12, 46, 'Carrilero izq.'], [38, 49, 'Volante izq.'], [62, 49, 'Volante der.'], [88, 46, 'Carrilero der.']];
const DOUBLE_PIVOT: Row[] = [[37, 54, 'Volante de marca izq.'], [63, 54, 'Volante de marca der.']];

function f11(key: string, group: FootballFormationGroup, description: string, rows: Row[], label = key): Formation {
  return {
    key,
    label,
    players: 11,
    group,
    description,
    slots: [{ x: 50, y: GK_Y, label: 'Arquero' }, ...rows.map(([x, y, l]) => ({ x, y, label: l }))],
  };
}

function buildM6aFormations(): Formation[] {
  return [
    // Clásicas
    f11('4-5-1', 'Clásicas', 'Cinco volantes y un punta: bloque compacto que cierra el medio.', [
      ...BACK4, [12, 44, 'Volante izq.'], [32, 48, 'Volante mixto izq.'], [50, 53, 'Volante de marca'], [68, 48, 'Volante mixto der.'], [88, 44, 'Volante der.'], [50, 18, 'Delantero'],
    ]),
    f11('4-4-1-1', 'Clásicas', '4-4-2 con un segundo delantero que baja a recibir entre líneas.', [
      ...BACK4, [14, 44, 'Volante izq.'], [38, 47, 'Volante central izq.'], [62, 47, 'Volante central der.'], [86, 44, 'Volante der.'], [50, 31, 'Segundo delantero'], [50, 16, 'Delantero'],
    ]),
    f11('5-3-2', 'Clásicas', 'Tres centrales y dos carrileros: sólido atrás, salida rápida con dos puntas.', [
      ...BACK5, [28, 46, 'Volante izq.'], [50, 51, 'Volante de marca'], [72, 46, 'Volante der.'], [37, 18, 'Delantero izq.'], [63, 18, 'Delantero der.'],
    ]),
    // Modernas
    f11('4-2-3-1', 'Modernas', 'Doble pivote, tres volantes ofensivos y un punta: la más usada hoy.', [
      ...BACK4, ...DOUBLE_PIVOT, [16, 34, 'Extremo izq.'], [50, 32, 'Enganche'], [84, 34, 'Extremo der.'], [50, 16, 'Delantero'],
    ]),
    f11('4-2-3-1-estrecho', 'Modernas', '4-2-3-1 con los extremos por dentro: los laterales dan la amplitud.', [
      ...BACK4, ...DOUBLE_PIVOT, [28, 31, 'Volante ofensivo izq.'], [50, 34, 'Enganche'], [72, 31, 'Volante ofensivo der.'], [50, 16, 'Delantero'],
    ], '4-2-3-1 estrecho'),
    f11('4-1-2-1-2', 'Modernas', '4-4-2 en rombo: volante de marca, dos interiores, enganche y dos puntas.', [
      ...BACK4, [50, 56, 'Volante de marca'], [27, 45, 'Volante izq.'], [73, 45, 'Volante der.'], [50, 33, 'Enganche'], [37, 17, 'Delantero izq.'], [63, 17, 'Delantero der.'],
    ], '4-1-2-1-2 (rombo)'),
    f11('4-3-1-2', 'Modernas', 'Tres volantes y un enganche detrás de dos delanteros: juego por dentro.', [
      ...BACK4, [28, 50, 'Volante izq.'], [50, 54, 'Volante de marca'], [72, 50, 'Volante der.'], [50, 33, 'Enganche'], [36, 18, 'Delantero izq.'], [64, 18, 'Delantero der.'],
    ]),
    f11('4-3-2-1', 'Modernas', '«Árbol de Navidad»: dos medias puntas detrás de un solo delantero.', [
      ...BACK4, [26, 50, 'Volante izq.'], [50, 54, 'Volante de marca'], [74, 50, 'Volante der.'], [35, 30, 'Media punta izq.'], [65, 30, 'Media punta der.'], [50, 16, 'Delantero'],
    ]),
    f11('4-1-4-1', 'Modernas', 'Un pivote detrás de cuatro volantes: presión y control del medio.', [
      ...BACK4, [50, 56, 'Volante de marca'], [12, 42, 'Volante izq.'], [36, 42, 'Interior izq.'], [64, 42, 'Interior der.'], [88, 42, 'Volante der.'], [50, 17, 'Delantero'],
    ]),
    f11('4-1-2-3', 'Modernas', '4-3-3 con un pivote y dos interiores: salida limpia y tres puntas.', [
      ...BACK4, [50, 56, 'Volante de marca'], [32, 42, 'Interior izq.'], [68, 42, 'Interior der.'], [18, 20, 'Extremo izq.'], [50, 17, 'Delantero'], [82, 20, 'Extremo der.'],
    ]),
    f11('4-2-2-2', 'Modernas', '«Cuadrado mágico»: doble pivote, dos volantes ofensivos y dos puntas.', [
      ...BACK4, [38, 54, 'Volante de marca izq.'], [62, 54, 'Volante de marca der.'], [20, 34, 'Volante ofensivo izq.'], [80, 34, 'Volante ofensivo der.'], [38, 17, 'Delantero izq.'], [62, 17, 'Delantero der.'],
    ]),
    f11('4-1-3-2', 'Modernas', 'Un volante de marca fuerte y tres volantes adelantados con dos puntas.', [
      ...BACK4, [50, 56, 'Volante de marca'], [16, 40, 'Volante izq.'], [50, 40, 'Volante central'], [84, 40, 'Volante der.'], [37, 18, 'Delantero izq.'], [63, 18, 'Delantero der.'],
    ]),
    f11('4-6-0', 'Modernas', 'Sin delantero fijo («falso 9»): cuatro volantes ofensivos que rotan arriba.', [
      ...BACK4, [36, 54, 'Volante de marca izq.'], [64, 54, 'Volante de marca der.'], [14, 32, 'Extremo izq.'], [38, 29, 'Media punta izq.'], [62, 29, 'Media punta der.'], [86, 32, 'Extremo der.'],
    ]),
    f11('3-4-3', 'Modernas', 'Tres centrales, carrileros y tres puntas: ataque ancho con línea de tres.', [
      ...BACK3, ...MID4_WB, [18, 21, 'Extremo izq.'], [50, 17, 'Delantero'], [82, 21, 'Extremo der.'],
    ]),
    f11('3-4-2-1', 'Modernas', 'Línea de tres, carrileros y dos medias puntas detrás del 9.', [
      ...BACK3, ...MID4_WB, [34, 29, 'Media punta izq.'], [66, 29, 'Media punta der.'], [50, 16, 'Delantero'],
    ]),
    f11('3-4-1-2', 'Modernas', 'Variante del 3-5-2 con un enganche detrás de dos delanteros.', [
      ...BACK3, ...MID4_WB, [50, 32, 'Enganche'], [36, 17, 'Delantero izq.'], [64, 17, 'Delantero der.'],
    ]),
    f11('3-2-4-1', 'Modernas', 'Tres atrás, doble pivote y cuatro por delante: la «caja» de la posesión.', [
      ...BACK3, [38, 55, 'Volante de marca izq.'], [62, 55, 'Volante de marca der.'], [12, 36, 'Extremo izq.'], [38, 33, 'Interior izq.'], [62, 33, 'Interior der.'], [88, 36, 'Extremo der.'], [50, 16, 'Delantero'],
    ]),
    f11('3-6-1', 'Modernas', 'Posesión con seis en el medio y un solo punta.', [
      ...BACK3, [10, 46, 'Carrilero izq.'], [38, 54, 'Volante de marca izq.'], [62, 54, 'Volante de marca der.'], [90, 46, 'Carrilero der.'], [30, 32, 'Media punta izq.'], [70, 32, 'Media punta der.'], [50, 16, 'Delantero'],
    ]),
    // Defensivas
    f11('5-4-1', 'Defensivas', 'Línea de cinco y cuatro volantes: bloque bajo con un punta aislado.', [
      ...BACK5, [14, 44, 'Volante izq.'], [38, 48, 'Volante central izq.'], [62, 48, 'Volante central der.'], [86, 44, 'Volante der.'], [50, 18, 'Delantero'],
    ]),
    f11('5-2-2-1', 'Defensivas', 'Cinco atrás, doble pivote y dos medias puntas para el contragolpe.', [
      ...BACK5, [38, 52, 'Volante de marca izq.'], [62, 52, 'Volante de marca der.'], [30, 32, 'Media punta izq.'], [70, 32, 'Media punta der.'], [50, 16, 'Delantero'],
    ]),
    f11('5-2-1-2', 'Defensivas', 'Cinco atrás con enganche y dos puntas: cierra y sale rápido.', [
      ...BACK5, [38, 52, 'Volante de marca izq.'], [62, 52, 'Volante de marca der.'], [50, 36, 'Enganche'], [37, 18, 'Delantero izq.'], [63, 18, 'Delantero der.'],
    ]),
    f11('5-2-3', 'Defensivas', 'Cinco atrás y tres puntas: defiende con muchos y contragolpea con tres.', [
      ...BACK5, [38, 50, 'Volante izq.'], [62, 50, 'Volante der.'], [18, 22, 'Extremo izq.'], [50, 18, 'Delantero'], [82, 22, 'Extremo der.'],
    ]),
    // Ofensivas
    f11('3-2-5', 'Ofensivas', 'El 4-3-3 en ataque: un lateral se cierra al medio y cinco atacan la última línea.', [
      [26, 66, 'Central izq.'], [50, 68, 'Central der.'], [74, 66, 'Lateral der.'], [38, 50, 'Lateral izq. (por dentro)'], [62, 50, 'Volante de marca'],
      [8, 22, 'Extremo izq.'], [32, 24, 'Interior izq.'], [50, 16, 'Delantero'], [68, 24, 'Interior der.'], [92, 22, 'Extremo der.'],
    ], '3-2-5 (4-3-3 en ataque)'),
    f11('3-4-3-rombo', 'Ofensivas', 'Tres atrás y medio en rombo: superioridad por dentro y tres puntas.', [
      ...BACK3, [50, 56, 'Volante de marca'], [16, 44, 'Volante izq.'], [84, 44, 'Volante der.'], [50, 34, 'Enganche'], [18, 20, 'Extremo izq.'], [50, 16, 'Delantero'], [82, 20, 'Extremo der.'],
    ], '3-4-3 rombo'),
    f11('3-3-4', 'Ofensivas', 'Cuatro arriba para remontar, con tres volantes que sostienen.', [
      ...BACK3, [24, 50, 'Volante izq.'], [50, 52, 'Volante central'], [76, 50, 'Volante der.'], [12, 22, 'Extremo izq.'], [38, 18, 'Delantero izq.'], [62, 18, 'Delantero der.'], [88, 22, 'Extremo der.'],
    ]),
    f11('3-3-1-3', 'Ofensivas', 'Presión alta estilo Ajax: tres atrás, enganche y tres puntas.', [
      ...BACK3, [20, 50, 'Volante izq.'], [50, 52, 'Volante de marca'], [80, 50, 'Volante der.'], [50, 34, 'Enganche'], [16, 18, 'Extremo izq.'], [50, 15, 'Delantero'], [84, 18, 'Extremo der.'],
    ]),
    f11('3-3-3-1', 'Ofensivas', 'Muy ofensiva y compacta: tres líneas de tres detrás de un 9.', [
      ...BACK3, [22, 52, 'Volante izq.'], [50, 54, 'Volante de marca'], [78, 52, 'Volante der.'], [18, 32, 'Extremo izq.'], [50, 32, 'Enganche'], [82, 32, 'Extremo der.'], [50, 15, 'Delantero'],
    ]),
    f11('4-2-1-3', 'Ofensivas', 'Doble pivote, un enganche y tres delanteros (el Inter de Mourinho).', [
      ...BACK4, ...DOUBLE_PIVOT, [50, 36, 'Enganche'], [18, 20, 'Extremo izq.'], [50, 16, 'Delantero'], [82, 20, 'Extremo der.'],
    ]),
    // Históricas
    f11('2-3-5', 'Históricas', 'La «Pirámide» (fines del siglo XIX a los años 30): dos zagueros y cinco delanteros.', [
      ...BACK2, [20, 48, 'Medio izq.'], [50, 50, 'Centromedio'], [80, 48, 'Medio der.'], [8, 22, 'Extremo izq.'], [30, 20, 'Interior izq.'], [50, 17, 'Delantero centro'], [70, 20, 'Interior der.'], [92, 22, 'Extremo der.'],
    ], '2-3-5 (Pirámide)'),
    f11('2-3-2-3', 'Históricas', 'El «Método» de Pozzo (Italia campeona en 1934 y 1938).', [
      ...BACK2, [20, 52, 'Medio izq.'], [50, 54, 'Centromedio'], [80, 52, 'Medio der.'], [34, 36, 'Interior izq.'], [66, 36, 'Interior der.'], [12, 20, 'Extremo izq.'], [50, 17, 'Delantero centro'], [88, 20, 'Extremo der.'],
    ], '2-3-2-3 (Método)'),
    f11('3-2-2-3', 'Históricas', 'La «WM» de Chapman (Arsenal, años 20): nace el defensa central.', [
      [20, 68, 'Zaguero izq.'], [50, 72, 'Central'], [80, 68, 'Zaguero der.'], [36, 52, 'Medio izq.'], [64, 52, 'Medio der.'], [34, 36, 'Interior izq.'], [66, 36, 'Interior der.'], [12, 20, 'Extremo izq.'], [50, 17, 'Delantero centro'], [88, 20, 'Extremo der.'],
    ], '3-2-2-3 (WM)'),
    f11('3-2-3-2', 'Históricas', 'La «WW» de la Hungría de los 50: el 9 retrasado arma el juego.', [
      [20, 68, 'Zaguero izq.'], [50, 72, 'Central'], [80, 68, 'Zaguero der.'], [36, 54, 'Medio izq.'], [64, 54, 'Medio der.'], [14, 34, 'Extremo izq.'], [50, 36, 'Delantero retrasado'], [86, 34, 'Extremo der.'], [36, 18, 'Interior izq.'], [64, 18, 'Interior der.'],
    ], '3-2-3-2 (WW)'),
    f11('4-2-4', 'Históricas', 'El Brasil de 1958: cuatro defensas, dos volantes y cuatro delanteros.', [
      ...BACK4, [38, 48, 'Volante izq.'], [62, 48, 'Volante der.'], [12, 22, 'Extremo izq.'], [38, 18, 'Delantero izq.'], [62, 18, 'Delantero der.'], [88, 22, 'Extremo der.'],
    ]),
    f11('1-4-3-2', 'Históricas', 'El «Catenaccio» italiano: un líbero detrás de cuatro marcadores.', [
      [50, 80, 'Líbero'], [14, 66, 'Lateral izq.'], [37, 70, 'Marcador izq.'], [63, 70, 'Marcador der.'], [86, 66, 'Lateral der.'],
      [28, 46, 'Volante izq.'], [50, 50, 'Volante de marca'], [72, 46, 'Volante der.'], [37, 20, 'Delantero izq.'], [63, 20, 'Delantero der.'],
    ], 'Catenaccio (1-4-3-2)'),
  ];
}

export const FORMATIONS: Formation[] = [
  {
    key: '4-3-3',
    group: 'Clásicas',
    description: 'Tres volantes y tres puntas: presión alta y amplitud con los extremos.',
    label: '4-3-3',
    players: 11,
    slots: [
      { x: 50, y: GK_Y, label: 'Arquero' },
      { x: 14, y: DEF_Y - 2, label: 'Lateral izq.' },
      { x: 37, y: DEF_Y + 2, label: 'Central' },
      { x: 63, y: DEF_Y + 2, label: 'Central' },
      { x: 86, y: DEF_Y - 2, label: 'Lateral der.' },
      { x: 28, y: MID_Y, label: 'Medio' },
      { x: 50, y: MID_Y + 2, label: 'Volante' },
      { x: 72, y: MID_Y, label: 'Medio' },
      { x: 18, y: FWD_Y + 3, label: 'Extremo izq.' },
      { x: 50, y: FWD_Y, label: 'Delantero' },
      { x: 82, y: FWD_Y + 3, label: 'Extremo der.' },
    ],
  },
  {
    key: '4-4-2',
    group: 'Clásicas',
    description: '4-4-2 plano: dos líneas de cuatro y dos delanteros; el más equilibrado.',
    label: '4-4-2',
    players: 11,
    slots: [
      { x: 50, y: GK_Y, label: 'Arquero' },
      { x: 14, y: DEF_Y - 2, label: 'Lateral izq.' },
      { x: 37, y: DEF_Y + 2, label: 'Central' },
      { x: 63, y: DEF_Y + 2, label: 'Central' },
      { x: 86, y: DEF_Y - 2, label: 'Lateral der.' },
      { x: 14, y: MID_Y - 2, label: 'Volante izq.' },
      { x: 38, y: MID_Y + 2, label: 'Medio' },
      { x: 62, y: MID_Y + 2, label: 'Medio' },
      { x: 86, y: MID_Y - 2, label: 'Volante der.' },
      { x: 36, y: FWD_Y, label: 'Delantero' },
      { x: 64, y: FWD_Y, label: 'Delantero' },
    ],
  },
  {
    key: '3-5-2',
    group: 'Clásicas',
    description: 'Tres centrales y carrileros que suben: dominio del medio con dos puntas.',
    label: '3-5-2',
    players: 11,
    slots: [
      { x: 50, y: GK_Y, label: 'Arquero' },
      { x: 26, y: DEF_Y, label: 'Central' },
      { x: 50, y: DEF_Y + 3, label: 'Central' },
      { x: 74, y: DEF_Y, label: 'Central' },
      { x: 10, y: MID_Y - 3, label: 'Carrilero izq.' },
      { x: 31, y: MID_Y, label: 'Medio' },
      { x: 50, y: MID_Y + 2, label: 'Volante' },
      { x: 69, y: MID_Y, label: 'Medio' },
      { x: 90, y: MID_Y - 3, label: 'Carrilero der.' },
      { x: 36, y: FWD_Y, label: 'Delantero' },
      { x: 64, y: FWD_Y, label: 'Delantero' },
    ],
  },
  {
    key: 'f7-2-3-1',
    group: 'Fútbol 7',
    description: 'Para planteles de 7: dos defensas, tres en el medio y un delantero.',
    label: '2-3-1 (F7)',
    players: 7,
    slots: [
      { x: 50, y: GK_Y, label: 'Arquero' },
      { x: 32, y: DEF_Y, label: 'Defensa' },
      { x: 68, y: DEF_Y, label: 'Defensa' },
      { x: 16, y: MID_Y, label: 'Volante izq.' },
      { x: 50, y: MID_Y + 2, label: 'Medio' },
      { x: 84, y: MID_Y, label: 'Volante der.' },
      { x: 50, y: FWD_Y, label: 'Delantero' },
    ],
  },
  // M6a: el resto del catálogo (galería). Van DESPUÉS: FORMATIONS[0] sigue
  // siendo el 4-3-3 de respaldo de formationByKey.
  ...buildM6aFormations(),
];

export function formationByKey(key: FormationKey): Formation {
  return FORMATIONS.find((f) => f.key === key) ?? FORMATIONS[0];
}

/** Formación con la que arranca una cancha vacía: 4-3-3 si el roster alcanza
 *  para fútbol 11; si no, la de fútbol 7 (un equipo de 8-10 niños casi
 *  siempre juega F7, y un 4-3-3 con 3 huecos se ve roto). */
export function defaultFormationFor(rosterSize: number): Formation {
  return formationByKey(rosterSize >= 11 ? '4-3-3' : 'f7-2-3-1');
}

/**
 * Ubica jugadores en una formación sobre la cancha VACÍA. `keys` ya viene en
 * el orden en que se reparten (el primero va al arco). Sobran slots → quedan
 * en `emptySlots` (marcadores a los que se arrastra a alguien); sobran
 * jugadores → no se ubican (quedan disponibles en el panel Jugadores).
 */
export function placeInFormation(
  keys: string[],
  // Estructural (solo key + slots): acepta también las formaciones de otros
  // deportes de tacticalSports.ts (T4), que tienen `key: string`.
  formation: Pick<Formation, 'slots'> & { key: string },
): { placed: Record<string, PlacedSlot>; emptySlots: { id: string; slot_label: string; x: number; y: number }[] } {
  const placed: Record<string, PlacedSlot> = {};
  formation.slots.forEach((slot, i) => {
    const key = keys[i];
    if (!key) return;
    placed[key] = { x: slot.x, y: slot.y, slot_label: slot.label, labelIsCustom: false, jersey_number: '' };
  });
  const emptySlots = formation.slots
    .map((s, i) => ({ id: `formation:${formation.key}:${i}`, slot_label: s.label, x: s.x, y: s.y }))
    .slice(keys.length);
  return { placed, emptySlots };
}

/** Orden en que se reparte el roster: por nombre (el roster no trae dorsal),
 *  con collator en español para que tildes y ñ ordenen como se espera. */
export function sortRosterForFormation<T extends { full_name: string }>(subjects: T[]): T[] {
  const collator = new Intl.Collator('es', { sensitivity: 'base' });
  return [...subjects].sort((a, b) => collator.compare(a.full_name, b.full_name));
}

/** Slots de la formación en el formato de applyPresetSlots (reubicar a los
 *  que ya están en cancha en el slot más cercano). */
export function formationAsPresetSlots(formation: Pick<Formation, 'slots'>): { slot_label: string; x: number; y: number }[] {
  return formation.slots.map((s) => ({ slot_label: s.label, x: s.x, y: s.y }));
}
