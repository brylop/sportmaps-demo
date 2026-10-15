/**
 * «Ajustes de la pizarra» (M6g, docs/specs/pizarra-m6-paridad-tacticalpad.md §4).
 * Lógica PURA: sin React ni DOM (el almacenamiento entra por parámetro).
 *
 * Son preferencias del COACH, no de la jugada: la curva de velocidad, los
 * rastros, las etiquetas y el tema valen para todas sus jugadas. Lo que sí
 * cambia la jugada (la posesión del balón) va en el jsonb de los cuadros
 * (`TacticalFrame.ball_owner`, ver tacticalPossession.ts).
 *
 * Persistencia: localStorage con la clave NAMESPACEADA por el id del usuario
 * (`tactical_board_settings:<uuid>`). Por qué no una tabla:
 *  - Son ajustes de vista, baratos de perder; no justifican una migración ni
 *    lecturas a la base (que es una sola para todos los ambientes y su Disk IO
 *    ya tumbó la plataforma, ver CLAUDE.md «Disk IO»).
 *  - El riesgo de localStorage es que se filtre entre usuarios del mismo
 *    teléfono (docs/gotchas-tecnicos.md). Se cubre dos veces: la clave lleva el
 *    id del usuario (otro usuario lee SU clave, nunca la ajena) y el signOut
 *    borra todo lo que empieza con el prefijo (clearBoardSettings).
 *  - Sin usuario (sesión aún cargando) no se lee ni se escribe nada: se usan
 *    los valores por defecto.
 */

// ─── Curvas de velocidad ────────────────────────────────────────────────────

export type AnimationCurve = 'suave' | 'lineal' | 'rapida_inicio' | 'rapida_final';

export const ANIMATION_CURVES: { id: AnimationCurve; label: string; hint: string }[] = [
  { id: 'suave', label: 'Suave', hint: 'Arranca y frena despacio (la de siempre)' },
  { id: 'lineal', label: 'Lineal', hint: 'Misma velocidad todo el recorrido' },
  { id: 'rapida_inicio', label: 'Rápida al inicio', hint: 'Sale rápido y frena al llegar' },
  { id: 'rapida_final', label: 'Rápida al final', hint: 'Sale despacio y acelera al llegar' },
];

const CURVE_IDS = new Set<string>(ANIMATION_CURVES.map((c) => c.id));

export function isAnimationCurve(v: unknown): v is AnimationCurve {
  return typeof v === 'string' && CURVE_IDS.has(v);
}

/** Progreso con la curva elegida. Entra y sale en 0-1 (recorta lo de afuera);
 *  todas valen 0 en 0, 1 en 1 y son monótonas crecientes. «Suave» es la
 *  easeInOutCubic de siempre, así una jugada vieja se ve igual. */
export function applyCurve(curve: AnimationCurve | null | undefined, t: number): number {
  const x = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  switch (curve) {
    case 'lineal':
      return x;
    case 'rapida_inicio': // easeOutCubic: casi todo el recorrido al principio
      return 1 - Math.pow(1 - x, 3);
    case 'rapida_final': // easeInCubic: casi todo el recorrido al final
      return x * x * x;
    case 'suave':
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}

// ─── Preferencias ───────────────────────────────────────────────────────────

export type BoardTheme = 'oscuro' | 'claro';

export interface TacticalBoardSettings {
  curve: AnimationCurve;
  /** Rastro del recorrido de los jugadores locales durante la animación. */
  routeHome: boolean;
  /** Ídem del equipo visitante / rival. */
  routeAway: boolean;
  /** Trayectoria del balón durante la animación. */
  ballTrail: boolean;
  /** La trayectoria del balón como línea discontinua (si no, continua). */
  ballTrailDashed: boolean;
  /** Muestra el selector de posesión del balón en cada cuadro. */
  possession: boolean;
  /** Nombre del jugador siempre visible bajo su ficha. */
  labelsAlways: boolean;
  theme: BoardTheme;
}

export const DEFAULT_BOARD_SETTINGS: Readonly<TacticalBoardSettings> = Object.freeze({
  curve: 'suave',
  routeHome: false,
  routeAway: false,
  ballTrail: false,
  ballTrailDashed: true,
  possession: false,
  labelsAlways: false,
  theme: 'oscuro',
});

const BOOL_KEYS = ['routeHome', 'routeAway', 'ballTrail', 'ballTrailDashed', 'possession', 'labelsAlways'] as const;

/** Lo que venga (JSON viejo, roto o de otra versión) → ajustes válidos. */
export function normalizeBoardSettings(raw: unknown): TacticalBoardSettings {
  const out: TacticalBoardSettings = { ...DEFAULT_BOARD_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (isAnimationCurve(r.curve)) out.curve = r.curve;
  for (const k of BOOL_KEYS) if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  if (r.theme === 'claro' || r.theme === 'oscuro') out.theme = r.theme;
  return out;
}

// ─── Almacenamiento por usuario ─────────────────────────────────────────────

/** Prefijo común: el signOut borra por prefijo (AuthContext). */
export const BOARD_SETTINGS_PREFIX = 'tactical_board_settings:';

export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function defaultStorage(): SettingsStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // Safari privado / sitio bloqueado
  }
}

export function boardSettingsKey(userId: string): string {
  return `${BOARD_SETTINGS_PREFIX}${userId}`;
}

/** Ajustes del usuario. Sin usuario o sin almacenamiento: los por defecto. */
export function loadBoardSettings(userId: string | null | undefined, storage: SettingsStorage | null = defaultStorage()): TacticalBoardSettings {
  if (!userId || !storage) return { ...DEFAULT_BOARD_SETTINGS };
  try {
    const raw = storage.getItem(boardSettingsKey(userId));
    return normalizeBoardSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_BOARD_SETTINGS };
  }
}

/** Guarda los ajustes del usuario. Sin usuario no guarda nada (no hay de quién). */
export function saveBoardSettings(
  userId: string | null | undefined,
  settings: TacticalBoardSettings,
  storage: SettingsStorage | null = defaultStorage(),
): boolean {
  if (!userId || !storage) return false;
  try {
    storage.setItem(boardSettingsKey(userId), JSON.stringify(normalizeBoardSettings(settings)));
    return true;
  } catch {
    return false; // cuota llena / bloqueado: se queda en memoria esta sesión
  }
}

/** Borra los ajustes de TODOS los usuarios del dispositivo (signOut). */
export function clearBoardSettings(storage: SettingsStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(BOARD_SETTINGS_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => storage.removeItem(k));
  } catch {
    /* nada que limpiar */
  }
}

// ─── Lo que viaja a la reproducción, al export y al 3D ──────────────────────

/** Subconjunto de los ajustes que cambia cómo se DIBUJA la animación. Lo
 *  reciben la capa de reproducción 2D, el GIF/video y el visor 3D. */
export interface TacticalPlaybackOptions {
  curve: AnimationCurve;
  routeHome: boolean;
  routeAway: boolean;
  ballTrail: boolean;
  ballTrailDashed: boolean;
}

export function playbackOptionsOf(s: TacticalBoardSettings): TacticalPlaybackOptions {
  return {
    curve: s.curve,
    routeHome: s.routeHome,
    routeAway: s.routeAway,
    ballTrail: s.ballTrail,
    ballTrailDashed: s.ballTrailDashed,
  };
}

export type TeamSide = 'home' | 'away';

/**
 * Equipo de una clave de jugador. Hoy la pizarra pone un solo equipo (el
 * local); el rival entra con claves `rival:…` / `away:…` / `opp:…` (o
 * `rival#n`), que es lo que usa la superposición de la IA y el equipo
 * visitante. Todo lo demás es local.
 */
export function teamOfKey(key: string): TeamSide {
  return /^(rival|away|opp|opponent|visitante)[:#]/i.test(key) ? 'away' : 'home';
}
