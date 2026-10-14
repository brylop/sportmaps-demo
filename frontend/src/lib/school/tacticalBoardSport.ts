/**
 * Lo que la pizarra táctica cambia según el deporte del equipo (T4 de
 * docs/specs/pizarra-nivel-tacticalpad.md): fondo, formaciones del menú,
 * material de la paleta, zoom de arqueros, zonas y largo para la regla.
 *
 * Lógica pura, sin React (src/test/tacticalBoardSport.test.ts).
 *
 * Fútbol 11 devuelve EXACTAMENTE lo de antes de T4 (las formaciones de
 * tacticalFormations.ts, F7 incluida, todo el material, zonas, zoom y 90 m):
 * la pizarra de fútbol no cambia en nada.
 */
import { FORMATIONS, defaultFormationFor, type FormationSlot } from './tacticalFormations';
import { OBJECT_TYPES, type ObjectType } from './tacticalGeometry';
import { DEFAULT_SPORT, isTacticalSport, sportDef, type TacticalSport, type TacticalSportDef } from './tacticalSports';

/** Formación del menú de la pizarra (fútbol: tacticalFormations; otros: el catálogo). */
export interface BoardFormation {
  key: string;
  label: string;
  players: number;
  slots: FormationSlot[];
}

export interface BoardSportConfig {
  sport: TacticalSport;
  def: TacticalSportDef;
  formations: BoardFormation[];
  /** Material de la paleta (subconjunto ordenado de OBJECT_TYPES). */
  objects: ObjectType[];
  /** Zoom al área: solo deportes con arco/portería. */
  allowGkZoom: boolean;
  /** Overlay de zonas (franjas Arquero/Defensa/Medio/Delantero de fútbol 11). */
  showZonesOption: boolean;
  /** Largo real de la cancha (valor inicial de «Largo cancha» de la regla). */
  courtLengthMeters: number;
  /** Alto del TABLERO / largo de la cancha: la regla mide en el tablero y la
   *  cancha de otros deportes ocupa solo una franja (fútbol 11: 1). */
  boardScale: number;
}

/** Metros que representa el alto del tablero para un «Largo cancha» dado. */
export const boardMetersFor = (cfg: Pick<BoardSportConfig, 'boardScale'>, courtLengthMeters: number): number =>
  courtLengthMeters * cfg.boardScale;

/** Largo de la cancha de fútbol que la regla usaba antes de T4. */
export const FOOTBALL_BOARD_METERS = 90;

export function boardSportConfig(sport: TacticalSport | null | undefined): BoardSportConfig {
  const key: TacticalSport = isTacticalSport(sport) ? sport : DEFAULT_SPORT;
  const def = sportDef(key);
  if (key === 'futbol') {
    return {
      sport: key,
      def,
      formations: FORMATIONS,
      objects: [...OBJECT_TYPES],
      allowGkZoom: true,
      showZonesOption: true,
      courtLengthMeters: FOOTBALL_BOARD_METERS,
      boardScale: 1,
    };
  }
  // La cancha ocupa solo una franja del alto del tablero: la regla mide en
  // metros del TABLERO, así que se escala por esa franja.
  const courtFrac = Math.max(0.01, (def.court.y1 - def.court.y0) / 100);
  return {
    sport: key,
    def,
    formations: def.formations,
    objects: def.objects,
    allowGkZoom: def.hasGoalkeeper,
    showZonesOption: false,
    courtLengthMeters: def.frame?.lengthM ?? FOOTBALL_BOARD_METERS,
    boardScale: 1 / courtFrac,
  };
}

/** Formación con la que arranca una cancha vacía. Fútbol 11 conserva la regla
 *  de siempre (4-3-3 con 11+, si no F7); otro deporte arranca con la primera
 *  formación de su catálogo. */
export function defaultBoardFormation(cfg: BoardSportConfig, rosterSize: number): BoardFormation {
  if (cfg.sport === 'futbol') return defaultFormationFor(rosterSize);
  return cfg.formations[0] ?? defaultFormationFor(rosterSize);
}
