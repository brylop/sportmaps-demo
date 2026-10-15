/**
 * Qué muestra el formulario de una sesión de entrenamiento según el deporte
 * del equipo (D3 de docs/specs/pizarra-multideporte-3d-ia.md). Lógica pura:
 * se prueba en src/test/sessionFormLayout.test.ts.
 *
 * Antes de M1 todo colgaba de `isFootball`: solo fútbol tenía bloques, y la
 * pizarra y la biblioteca viven DENTRO de los bloques. Ahora:
 *
 *   · hasTacticalBoard (fútbol 11/7/5, futsal, voleibol, baloncesto,
 *     balonmano): bloques con «Tablero táctico» y «Desde la biblioteca».
 *     M6f: también los de nivel «cancha» (rugby, tenis, waterpolo…), pero
 *     SOLO con «Tablero táctico»: no tienen biblioteca (teamSport fuera de
 *     LIBRARY_BOARD_SPORTS). Sin teamSport (llamador viejo) no cambia nada.
 *   · isFootball (fútbol 11/7/5): además principios de juego, evaluación de la
 *     sesión y la plantilla de bloques del Excel de Club Carmel.
 *   · el resto: ejercicios sueltos (drills) y calentamiento, como siempre.
 *
 * Un equipo de pizarra que NO es de fútbol y ya tenía sesiones guardadas con
 * ejercicios sueltos (y sin bloques) las sigue editando como ejercicios: pasar
 * esa sesión a bloques escondería lo que el coach escribió.
 */
import { sportDef, type TacticalSport } from './tacticalSports';
import { isLibraryBoardSport } from '@/lib/sports/sportCatalog';

export type BlockTemplateKind = 'futbol' | 'generico';

export interface SessionFormLayoutInput {
  isFootball?: boolean;
  /** Si no viene, vale lo mismo que isFootball (llamadores de antes de M1). */
  hasTacticalBoard?: boolean;
  teamSport?: TacticalSport;
  session?: { session_blocks?: unknown; drills?: unknown } | null;
}

export interface SessionFormLayout {
  editor: 'blocks' | 'drills';
  /** Botón «Tablero táctico» en cada bloque. */
  showBoardButtons: boolean;
  /** «Desde la biblioteca» en cada bloque (deportes con biblioteca). */
  showLibraryButton: boolean;
  showGamePrinciples: boolean;
  showWarmup: boolean;
  showEvaluation: boolean;
  /** Componente «Arqueros» en el selector del bloque (deportes con arquero/portero). */
  showGoalkeeperComponent: boolean;
  blockTemplate: BlockTemplateKind;
}

const hasNamedItems = (v: unknown) =>
  Array.isArray(v) && v.some((d) => d && typeof d === 'object' && typeof (d as { name?: unknown }).name === 'string' && (d as { name: string }).name.trim() !== '');

export function sessionFormLayout(input: SessionFormLayoutInput): SessionFormLayout {
  const isFootball = !!input.isFootball;
  const hasBoard = input.hasTacticalBoard ?? isFootball;
  const s = input.session;
  const legacyDrills = !!s && hasNamedItems(s.drills) && !(Array.isArray(s.session_blocks) && s.session_blocks.length > 0);
  const editor: SessionFormLayout['editor'] = isFootball || (hasBoard && !legacyDrills) ? 'blocks' : 'drills';
  const showBoardButtons = editor === 'blocks' && (hasBoard || isFootball);
  return {
    editor,
    showBoardButtons,
    showLibraryButton: showBoardButtons && (!input.teamSport || isLibraryBoardSport(input.teamSport)),
    showGamePrinciples: isFootball,
    // Fútbol tiene su bloque «Calentamiento»; los demás conservan el campo.
    showWarmup: !isFootball,
    showEvaluation: isFootball,
    showGoalkeeperComponent: isFootball || (hasBoard && !!input.teamSport && sportDef(input.teamSport).hasGoalkeeper),
    blockTemplate: isFootball ? 'futbol' : 'generico',
  };
}
