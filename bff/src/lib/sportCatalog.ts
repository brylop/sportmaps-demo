/**
 * Catálogo ÚNICO de deportes para la pizarra (M1 de
 * docs/specs/pizarra-multideporte-3d-ia.md, decisiones D1-D3).
 *
 * `teams.sport`, `schools.sports[]` y `school_staff.sports[]` son TEXTO LIBRE
 * con el NOMBRE VISIBLE del deporte ("Fútbol", "Cheerleading All-Star",
 * "Voleibol — Metodólogo"…), no un slug. Este archivo es el único lugar que
 * convierte ese texto en un deporte con su nivel de pizarra:
 *
 *   completa → fútbol 11/7/5, futsal, voleibol, baloncesto, balonmano
 *   cancha   → waterpolo, tenis, pádel, vóley playa (pizarra de cancha en M5;
 *              mientras tanto NO se muestra nada)
 *   ninguna  → el resto (natación, karate, porrismo…) y lo desconocido
 *
 * Lo desconocido NO se adivina: queda en `ninguna` con match 'ninguno' y sale
 * en `npm run deportes:sin-mapear` para mapearlo aquí.
 *
 * ESPEJO: bff/src/lib/sportCatalog.ts es una copia IDÉNTICA (el BFF filtra la
 * biblioteca con esto). bff/src/lib/sportCatalog.mirror.test.ts falla si las
 * dos copias difieren: se edita aquí y se copia allá.
 *
 * Sin imports a propósito: lo importan el frontend, el BFF y un script de Node
 * (--experimental-strip-types), así que solo usa sintaxis de tipos borrable.
 */

export type BoardLevel = 'completa' | 'cancha' | 'ninguna';

/** Canchas de la pizarra (mismo orden y claves que TACTICAL_SPORTS de
 *  frontend/src/lib/school/tacticalSports.ts y EXERCISE_SPORTS del BFF). */
export const BOARD_SPORTS = [
  'futbol',
  'futbol7',
  'futbol5',
  'futsal',
  'voleibol',
  'baloncesto',
  'balonmano',
  'generico',
] as const;
export type BoardSport = (typeof BOARD_SPORTS)[number];

export const FOOTBALL_BOARD_SPORTS: readonly BoardSport[] = ['futbol', 'futbol7', 'futbol5'];

export interface SportEntry {
  key: string;
  /** Nombre visible en español de Colombia. */
  label: string;
  boardLevel: BoardLevel;
  /** Cancha de la pizarra que le corresponde (si tiene). En 'cancha' es la
   *  más parecida, para M5; hoy no abre nada. */
  tacticalSport?: BoardSport;
  /** Sinónimos y variantes (se comparan normalizados: sin tildes, minúsculas,
   *  sin guiones ni plurales). */
  aliases: string[];
}

export interface ResolvedSport {
  key: string;
  label: string;
  boardLevel: BoardLevel;
  tacticalSport?: BoardSport;
  /** exacto: el texto (o su parte antes de «—», «(»…) es un nombre del
   *  catálogo. aproximado: contiene un nombre del catálogo («Fútbol
   *  formativo»). ninguno: no se reconoce. */
  match: 'exacto' | 'aproximado' | 'ninguno';
}

export const SPORT_CATALOG: readonly SportEntry[] = [
  // ── Pizarra completa ──────────────────────────────────────────────────────
  { key: 'futbol', label: 'Fútbol', boardLevel: 'completa', tacticalSport: 'futbol',
    aliases: ['futbol', 'soccer', 'futbol 11', 'futbol once', 'f11', 'futbol de campo', 'balompie'] },
  { key: 'futbol7', label: 'Fútbol 7', boardLevel: 'completa', tacticalSport: 'futbol7',
    aliases: ['futbol 7', 'futbol7', 'futbol siete', 'f7', 'futbol 7 vs 7'] },
  { key: 'futbol5', label: 'Fútbol 5', boardLevel: 'completa', tacticalSport: 'futbol5',
    aliases: ['futbol 5', 'futbol5', 'futbol cinco', 'f5', 'minifutbol', 'mini futbol'] },
  { key: 'futsal', label: 'Fútbol sala', boardLevel: 'completa', tacticalSport: 'futsal',
    aliases: ['futsal', 'futbol sala', 'futbol de sala', 'futbolsala', 'futbol de salon', 'microfutbol', 'micro futbol'] },
  { key: 'voleibol', label: 'Voleibol', boardLevel: 'completa', tacticalSport: 'voleibol',
    aliases: ['voleibol', 'voleybol', 'voley', 'volley', 'volleyball', 'volley ball', 'volei', 'voleibol de sala', 'paravoleibol', 'voleibol sentado'] },
  { key: 'baloncesto', label: 'Baloncesto', boardLevel: 'completa', tacticalSport: 'baloncesto',
    aliases: ['baloncesto', 'basquet', 'basquetbol', 'basket', 'basketball', 'basket ball', 'baloncesto en silla de ruedas', 'basquet en silla de ruedas'] },
  { key: 'balonmano', label: 'Balonmano', boardLevel: 'completa', tacticalSport: 'balonmano',
    aliases: ['balonmano', 'handball', 'hand ball', 'handbol'] },

  // ── Pizarra de cancha (M5; hoy sin pizarra) ───────────────────────────────
  { key: 'waterpolo', label: 'Waterpolo', boardLevel: 'cancha', aliases: ['waterpolo', 'water polo', 'polo acuatico'] },
  { key: 'tenis', label: 'Tenis', boardLevel: 'cancha', aliases: ['tenis', 'tenis de campo', 'tennis'] },
  { key: 'padel', label: 'Pádel', boardLevel: 'cancha', aliases: ['padel', 'paddle', 'padel tenis', 'paddle tenis'] },
  { key: 'voley_playa', label: 'Vóley playa', boardLevel: 'cancha', tacticalSport: 'voleibol',
    aliases: ['voley playa', 'voleibol playa', 'voleibol de playa', 'volley playa', 'beach volley', 'beach volleyball', 'voley arena', 'voleibol de arena'] },

  // ── Sin pizarra ───────────────────────────────────────────────────────────
  { key: 'natacion', label: 'Natación', boardLevel: 'ninguna', aliases: ['natacion', 'paranatacion', 'natacion carreras'] },
  { key: 'saltos_acuaticos', label: 'Saltos acuáticos', boardLevel: 'ninguna', aliases: ['saltos acuaticos', 'clavados'] },
  { key: 'actividades_subacuaticas', label: 'Actividades subacuáticas', boardLevel: 'ninguna', aliases: ['actividades subacuaticas', 'buceo', 'apnea'] },
  { key: 'gimnasia', label: 'Gimnasia', boardLevel: 'ninguna',
    aliases: ['gimnasia', 'gimnasia artistica', 'gimnasia ritmica', 'gimnasia olimpica', 'gimnasia aerobica', 'trampolin'] },
  { key: 'cheerleading', label: 'Porrismo (cheerleading)', boardLevel: 'ninguna',
    aliases: ['porrismo', 'porras', 'cheerleading', 'cheer', 'cheerleading all star', 'cheerleading all stars', 'all star cheerleading', 'cheer all star'] },
  { key: 'patinaje', label: 'Patinaje', boardLevel: 'ninguna',
    aliases: ['patinaje', 'patinaje de velocidad', 'patinaje de velocidad en linea', 'patinaje de carreras', 'patinaje en linea', 'patinaje carreras'] },
  { key: 'patinaje_artistico', label: 'Patinaje artístico', boardLevel: 'ninguna', aliases: ['patinaje artistico'] },
  { key: 'karate', label: 'Karate', boardLevel: 'ninguna', aliases: ['karate', 'karate do', 'karatedo'] },
  { key: 'mma', label: 'Artes marciales mixtas', boardLevel: 'ninguna', aliases: ['mma', 'artes marciales mixtas'] },
  { key: 'artes_marciales', label: 'Artes marciales', boardLevel: 'ninguna', aliases: ['artes marciales'] },
  { key: 'boxeo', label: 'Boxeo', boardLevel: 'ninguna', aliases: ['boxeo', 'boxing'] },
  { key: 'kickboxing', label: 'Kickboxing', boardLevel: 'ninguna', aliases: ['kickboxing', 'kick boxing'] },
  { key: 'muay_thai', label: 'Muay thai', boardLevel: 'ninguna', aliases: ['muay thai', 'muaythai'] },
  { key: 'taekwondo', label: 'Taekwondo', boardLevel: 'ninguna', aliases: ['taekwondo', 'tae kwon do'] },
  { key: 'judo', label: 'Judo', boardLevel: 'ninguna', aliases: ['judo'] },
  { key: 'jiujitsu', label: 'Jiu-jitsu', boardLevel: 'ninguna', aliases: ['jiujitsu', 'jiu jitsu', 'brazilian jiu jitsu', 'bjj'] },
  { key: 'hapkido', label: 'Hapkido', boardLevel: 'ninguna', aliases: ['hapkido'] },
  { key: 'wushu', label: 'Wushu', boardLevel: 'ninguna', aliases: ['wushu', 'kung fu'] },
  { key: 'sambo', label: 'Sambo', boardLevel: 'ninguna', aliases: ['sambo'] },
  { key: 'savate', label: 'Savate', boardLevel: 'ninguna', aliases: ['savate'] },
  { key: 'lucha', label: 'Lucha', boardLevel: 'ninguna', aliases: ['lucha', 'lucha libre', 'lucha olimpica', 'lucha grecorromana'] },
  { key: 'esgrima', label: 'Esgrima', boardLevel: 'ninguna', aliases: ['esgrima'] },
  { key: 'golf', label: 'Golf', boardLevel: 'ninguna', aliases: ['golf'] },
  { key: 'atletismo', label: 'Atletismo', boardLevel: 'ninguna', aliases: ['atletismo', 'para atletismo', 'paraatletismo'] },
  { key: 'triatlon', label: 'Triatlón', boardLevel: 'ninguna', aliases: ['triatlon', 'duatlon'] },
  { key: 'crossfit', label: 'CrossFit', boardLevel: 'ninguna', aliases: ['crossfit', 'cross fit'] },
  { key: 'crosstraining', label: 'Crosstraining', boardLevel: 'ninguna', aliases: ['crosstraining', 'cross training', 'entrenamiento funcional'] },
  { key: 'gimnasio', label: 'Gimnasio y acondicionamiento', boardLevel: 'ninguna',
    aliases: ['gimnasio', 'gym', 'fitness', 'entrenamiento personal', 'entrenador personal', 'acondicionamiento fisico', 'preparacion fisica'] },
  { key: 'pesas', label: 'Levantamiento de pesas', boardLevel: 'ninguna', aliases: ['levantamiento de pesas', 'halterofilia', 'pesas'] },
  { key: 'powerlifting', label: 'Levantamiento de potencia', boardLevel: 'ninguna', aliases: ['levantamiento de potencia', 'powerlifting', 'para powerlifting'] },
  { key: 'fisicoculturismo', label: 'Fisicoculturismo', boardLevel: 'ninguna', aliases: ['fisicoculturismo'] },
  { key: 'piraguismo', label: 'Piragüismo', boardLevel: 'ninguna',
    aliases: ['piraguismo', 'piraguismo eslalon', 'piraguismo esprint', 'piraguismo slalom', 'piraguismo sprint', 'canotaje', 'canoa', 'kayak'] },
  { key: 'remo', label: 'Remo', boardLevel: 'ninguna', aliases: ['remo'] },
  { key: 'vela', label: 'Vela', boardLevel: 'ninguna', aliases: ['vela'] },
  { key: 'surf', label: 'Surf', boardLevel: 'ninguna', aliases: ['surf'] },
  { key: 'esqui_nautico', label: 'Esquí náutico', boardLevel: 'ninguna', aliases: ['esqui nautico', 'wakeboard'] },
  { key: 'ciclismo', label: 'Ciclismo', boardLevel: 'ninguna', aliases: ['ciclismo', 'bmx', 'bmx race', 'ciclomontanismo'] },
  { key: 'tenis_mesa', label: 'Tenis de mesa', boardLevel: 'ninguna', aliases: ['tenis de mesa', 'ping pong'] },
  { key: 'squash', label: 'Squash', boardLevel: 'ninguna', aliases: ['squash'] },
  { key: 'racquetball', label: 'Ráquetbol', boardLevel: 'ninguna', aliases: ['racquetball', 'raquetbol'] },
  { key: 'badminton', label: 'Bádminton', boardLevel: 'ninguna', aliases: ['badminton'] },
  { key: 'rugby', label: 'Rugby', boardLevel: 'ninguna', aliases: ['rugby', 'rugby en silla de ruedas'] },
  { key: 'beisbol', label: 'Béisbol', boardLevel: 'ninguna', aliases: ['beisbol', 'baseball'] },
  { key: 'softbol', label: 'Sóftbol', boardLevel: 'ninguna', aliases: ['softbol', 'softball'] },
  { key: 'hockey', label: 'Hockey', boardLevel: 'ninguna', aliases: ['hockey', 'hockey sobre cesped', 'hockey sobre hielo', 'hockey en linea'] },
  { key: 'escalada', label: 'Escalada', boardLevel: 'ninguna', aliases: ['escalada', 'escalada deportiva'] },
  { key: 'skateboarding', label: 'Skateboarding', boardLevel: 'ninguna', aliases: ['skateboarding', 'skate'] },
  { key: 'danza', label: 'Danza y baile deportivo', boardLevel: 'ninguna', aliases: ['danza', 'baile deportivo', 'danza y baile deportivo'] },
  { key: 'ajedrez', label: 'Ajedrez', boardLevel: 'ninguna', aliases: ['ajedrez'] },
  { key: 'bolos', label: 'Bolos', boardLevel: 'ninguna', aliases: ['bolos', 'bowling'] },
  { key: 'billar', label: 'Billar', boardLevel: 'ninguna', aliases: ['billar'] },
  { key: 'tejo', label: 'Tejo', boardLevel: 'ninguna', aliases: ['tejo', 'minitejo'] },
  { key: 'equitacion', label: 'Equitación', boardLevel: 'ninguna', aliases: ['equitacion', 'ecuestre', 'hipica'] },
  { key: 'coleo', label: 'Coleo', boardLevel: 'ninguna', aliases: ['coleo'] },
  { key: 'tiro', label: 'Tiro deportivo', boardLevel: 'ninguna', aliases: ['tiro', 'tiro deportivo', 'tiro con arco', 'arqueria'] },
  { key: 'boccia', label: 'Boccia', boardLevel: 'ninguna', aliases: ['boccia'] },
  { key: 'orientacion', label: 'Orientación', boardLevel: 'ninguna', aliases: ['orientacion'] },
  { key: 'motociclismo', label: 'Motociclismo', boardLevel: 'ninguna', aliases: ['motociclismo', 'motocross'] },
  { key: 'automovilismo', label: 'Automovilismo', boardLevel: 'ninguna', aliases: ['automovilismo', 'automovilismo deportivo', 'karts', 'karting'] },
  { key: 'motonautica', label: 'Motonáutica', boardLevel: 'ninguna', aliases: ['motonautica'] },
  { key: 'paintball', label: 'Paintball', boardLevel: 'ninguna', aliases: ['paintball', 'paint ball'] },
  { key: 'ultimate', label: 'Ultimate (disco volador)', boardLevel: 'ninguna', aliases: ['ultimate', 'disco volador', 'frisbee'] },
  { key: 'bridge', label: 'Bridge', boardLevel: 'ninguna', aliases: ['bridge'] },
  { key: 'multideporte', label: 'Multideporte', boardLevel: 'ninguna', aliases: ['multideporte', 'polideportivo', 'varios deportes'] },
];

// ─── Normalización ──────────────────────────────────────────────────────────

/** Minúsculas, sin tildes, todo lo que no es letra o número → espacio. */
export function normalizeSportText(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Forma canónica para comparar: normalizada y sin plural ("all stars" =
 *  "all star", "multideportes" = "multideporte"). Se aplica igual a los
 *  sinónimos y al texto, así que "tenis" → "teni" no rompe nada. */
function canon(s: string): string {
  return normalizeSportText(s)
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w))
    .join(' ');
}

/** Lo que va antes de «—», «–», « - », «(», «:» o «/»: "Voleibol — Metodólogo"
 *  → "Voleibol"; "MMA (Artes Marciales Mixtas)" → "MMA". Quita también
 *  "Coordinador(a) de" / "Entrenador(a) de" ("Coordinadora de Tenis"). */
function headOf(raw: string): string {
  const head = raw.split(/\s*[—–(:/]\s*|\s+-\s+/)[0] ?? raw;
  return head.replace(/^\s*(coordinador|coordinadora|entrenador|entrenadora|profesor|profesora|instructor|instructora)\s+de\s+/i, '');
}

const ALIAS_INDEX: Map<string, SportEntry> = (() => {
  const m = new Map<string, SportEntry>();
  for (const e of SPORT_CATALOG) {
    for (const a of [e.label, ...e.aliases]) {
      const k = canon(a);
      if (k && !m.has(k)) m.set(k, e);
    }
  }
  return m;
})();

/** Sinónimos ordenados de más largo a más corto (para "contiene"). */
const ALIASES_BY_LENGTH: [string, SportEntry][] = [...ALIAS_INDEX.entries()].sort((a, b) => b[0].length - a[0].length);

/** Último recurso para los deportes de pizarra (lo que ya reconocía
 *  sportFromTeam antes de M1): "Futbol formativo", "Basket femenino"…
 *  Futsal ANTES que fútbol: "fútbol sala" contiene "fútbol". */
function boardFamilyByKeyword(text: string): BoardSport | null {
  if (!text) return null;
  if (/\bfutsal\b|futbol\s*(de\s*)?sala|futbol\s*de\s*salon|micro\s*futbol|\bmicro\b/.test(text)) return 'futsal';
  if (/volei|voley|volley/.test(text)) return 'voleibol';
  if (/balonce|basket|basquet/.test(text)) return 'baloncesto';
  if (/balonmano|handball|hand\s*ball/.test(text)) return 'balonmano';
  if (/futbol|soccer|\bfut\b/.test(text)) return 'futbol';
  return null;
}

const toResolved = (e: SportEntry, match: ResolvedSport['match']): ResolvedSport => ({
  key: e.key,
  label: e.label,
  boardLevel: e.boardLevel,
  ...(e.tacticalSport ? { tacticalSport: e.tacticalSport } : {}),
  match,
});

const ENTRY_BY_KEY = new Map(SPORT_CATALOG.map((e) => [e.key, e]));
export const sportEntry = (key: string): SportEntry | undefined => ENTRY_BY_KEY.get(key);

const cache = new Map<string, ResolvedSport>();

/**
 * Texto libre de deporte → deporte del catálogo con su nivel de pizarra.
 *   1. igual a un nombre o sinónimo (sin tildes, mayúsculas, guiones ni plurales);
 *   2. igual tras quitar lo que va después de «—» / «(» / « - »;
 *   3. contiene un nombre del catálogo como palabras completas («Fútbol
 *      formativo», «Baloncesto en silla de ruedas -Bsrcolombia») → aproximado;
 *   4. palabra clave de un deporte de pizarra (lo que leía sportFromTeam) → aproximado;
 *   5. si no: desconocido, sin pizarra, para el reporte.
 */
export function resolveSport(text: string | null | undefined): ResolvedSport {
  const raw = (text ?? '').trim();
  const hit = cache.get(raw);
  if (hit) return hit;
  const out = resolveUncached(raw);
  if (cache.size < 2000) cache.set(raw, out);
  return out;
}

function resolveUncached(raw: string): ResolvedSport {
  if (!raw) return { key: 'desconocido', label: 'Sin deporte', boardLevel: 'ninguna', match: 'ninguno' };
  const full = canon(raw);
  const exact = ALIAS_INDEX.get(full) ?? ALIAS_INDEX.get(canon(headOf(raw)));
  if (exact) return toResolved(exact, 'exacto');

  const padded = ` ${full} `;
  for (const [alias, e] of ALIASES_BY_LENGTH) {
    if (padded.includes(` ${alias} `)) return toResolved(e, 'aproximado');
  }
  const family = boardFamilyByKeyword(normalizeSportText(raw));
  if (family) {
    const e = ENTRY_BY_KEY.get(family);
    if (e) return toResolved(e, 'aproximado');
  }
  return { key: 'desconocido', label: raw, boardLevel: 'ninguna', match: 'ninguno' };
}

function asResolved(s: string | ResolvedSport | null | undefined): ResolvedSport {
  if (s && typeof s === 'object') return s;
  return resolveSport(typeof s === 'string' ? s : null);
}

/** D2/D3: ¿abre la pizarra táctica y su biblioteca? Solo nivel «completa». */
export const hasTacticalBoard = (s: string | ResolvedSport | null | undefined): boolean =>
  asResolved(s).boardLevel === 'completa';

/** D3: lo futbolero de verdad (principios de juego, evaluación de la sesión,
 *  bloques de fútbol, panorama «Fútbol»). Fútbol 11/7/5; futsal NO. */
export const isFootballSport = (s: string | ResolvedSport | null | undefined): boolean => {
  const r = asResolved(s);
  return !!r.tacticalSport && r.boardLevel === 'completa' && FOOTBALL_BOARD_SPORTS.includes(r.tacticalSport);
};

// ─── Deporte de la pizarra a partir del EQUIPO ──────────────────────────────

export interface TeamSportInput {
  sport?: string | null;
  name?: string | null;
  category_name?: string | null;
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

/** Minúsculas, sin tildes y con `_` como espacio, conservando guiones (lo que
 *  leía sportFromTeam antes de M1: "Sub-5" debe seguir siendo edad). */
const softNorm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/_/g, ' ').trim();

/**
 * Cancha de la pizarra para un equipo (lo que antes calculaba sportFromTeam):
 * `teams.sport` por resolveSport; si viene vacío, el nombre del equipo y de la
 * categoría por palabra clave. Fútbol 7/5 solo si está escrito en el deporte o
 * el equipo ("F7", "Fútbol 5", "7 vs 7"); "Sub 7" es edad. Deporte sin cancha
 * de pizarra (natación, tenis, porrismo…) → 'generico'. Sin nada → fútbol 11.
 */
export function boardSportFromTeam(team: TeamSportInput | null | undefined): BoardSport {
  if (!team) return 'futbol';
  const sportText = softNorm(team.sport);
  const extra = `${softNorm(team.name)} ${softNorm(team.category_name)}`.trim();
  let base: BoardSport | null;
  if (sportText) {
    const r = resolveSport(team.sport);
    base = r.tacticalSport ?? null;
    if (!base) return 'generico';
  } else {
    base = boardFamilyByKeyword(normalizeSportText(extra));
    if (!base) return 'futbol';
  }
  if (!FOOTBALL_BOARD_SPORTS.includes(base)) return base;
  // Fútbol: ¿el equipo/categoría dice futsal (deporte "Fútbol", equipo "Futsal Sub 12")?
  if (boardFamilyByKeyword(normalizeSportText(extra)) === 'futsal') return 'futsal';
  const size = footballSize(sportText) ?? footballSize(extra);
  if (size === 7) return 'futbol7';
  if (size === 5) return 'futbol5';
  if (size === 11) return 'futbol';
  return base;
}

/** Lo que una pantalla necesita saber del equipo para la pizarra (D3). */
export interface TeamBoardAccess {
  /** Cancha con la que abre la pizarra. */
  sport: BoardSport;
  /** Abre «Tablero táctico», jugadas guardadas y biblioteca. */
  hasTacticalBoard: boolean;
  /** Lo futbolero: principios de juego, evaluación, bloques y panorama «Fútbol». */
  isFootball: boolean;
}

export function teamBoardAccess(team: TeamSportInput | null | undefined): TeamBoardAccess {
  const r = resolveSport(team?.sport);
  return {
    sport: boardSportFromTeam(team),
    hasTacticalBoard: hasTacticalBoard(r),
    isFootball: isFootballSport(r),
  };
}

// ─── Deportes de una ESCUELA (D1: la biblioteca solo muestra estos) ────────

/**
 * Canchas de pizarra de una escuela = ∪ deporte de cada equipo ACTIVO (con
 * boardSportFromTeam, así un equipo "Fútbol 7 Sub 10" aporta Fútbol 7) ∪
 * `schools.sports`. Solo deportes de pizarra completa. 'generico'
 * («Preparación física») va siempre, al final. Orden de BOARD_SPORTS.
 */
export function schoolBoardSports(input: {
  teams?: readonly TeamSportInput[] | null;
  schoolSports?: readonly (string | null)[] | null;
}): BoardSport[] {
  const set = new Set<BoardSport>(['generico']);
  for (const t of input.teams ?? []) {
    if (!t || !hasTacticalBoard(t.sport)) continue;
    set.add(boardSportFromTeam(t));
  }
  for (const s of input.schoolSports ?? []) {
    const r = resolveSport(s);
    if (r.boardLevel === 'completa' && r.tacticalSport) set.add(r.tacticalSport);
  }
  return BOARD_SPORTS.filter((s) => set.has(s));
}
