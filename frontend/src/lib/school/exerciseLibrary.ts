/**
 * Biblioteca de ejercicios — pizarra T3 (docs/specs/pizarra-nivel-tacticalpad.md).
 * Llamadas al BFF /api/v1/school/exercises (bff/src/routes/school/exercises.ts)
 * y helpers puros para pasar de la pizarra a la jugada guardada y de vuelta.
 */
import { bffClient } from '@/lib/api/bffClient';
import type { TacticalArrow } from './footballQueries';
import { presetSlotKey, presetSlotIndex, type TacticalFrame } from './tacticalFrames';
import type { TacticalStaticPlayer } from '@/components/school/TacticalStaticSvg';

export type ExerciseSport =
  | 'futbol' | 'futbol7' | 'futbol5' | 'futsal'
  | 'voleibol' | 'baloncesto' | 'balonmano' | 'generico';

export const EXERCISE_SPORT_LABEL: Record<ExerciseSport, string> = {
  futbol: 'Fútbol 11',
  futbol7: 'Fútbol 7',
  futbol5: 'Fútbol 5',
  futsal: 'Fútbol sala',
  voleibol: 'Voleibol',
  baloncesto: 'Baloncesto',
  balonmano: 'Balonmano',
  generico: 'Genérico',
};

/** Puesto de la jugada guardada: sin atleta real, solo etiqueta y posición.
 *  `key` = presetSlotKey(i) = 'slot#<i>' (i = índice en board.players): el
 *  MISMO formato de los cuadros de «Mis jugadas» (team_tactical_presets), así
 *  la pizarra carga un ejercicio con su misma maquinaria de plantillas
 *  (applyPresetSlots + mapPresetFrames) usando slots = board.players. */
export interface ExerciseBoardPlayer {
  key: string;
  slot_label: string;
  x: number;
  y: number;
  jersey_number?: number | null;
}

export interface ExerciseBoard {
  players: ExerciseBoardPlayer[];
  arrows: TacticalArrow[];
  frames: TacticalFrame[];
}

export interface TrainingExercise {
  id: string;
  school_id: string | null;
  created_by: string | null;
  name: string;
  objective: string | null;
  minutes: number | null;
  age_group: string | null;
  materials: string | null;
  tags: string[];
  sport: ExerciseSport;
  description: string | null;
  board: Partial<ExerciseBoard>;
  is_template: boolean;
  is_active: boolean;
  times_used: number;
  created_at: string;
  updated_at: string;
}

export interface ExerciseInput {
  name: string;
  objective?: string | null;
  minutes?: number | null;
  age_group?: string | null;
  materials?: string | null;
  tags?: string[];
  sport?: ExerciseSport;
  description?: string | null;
  board?: ExerciseBoard;
}

export interface ExerciseListParams {
  q?: string;
  sport?: ExerciseSport;
  tag?: string;
  mine?: boolean;
  /** true = solo plantillas SportMaps; false = solo de mi escuela; undefined = ambas. */
  templates?: boolean;
  limit?: number;
}

export interface InsertIntoSessionResult {
  lineup_id: string;
  session_id: string | null;
  block_id: string;
  exercise_id: string;
  block: Record<string, unknown> | null;
}

const BASE = '/api/v1/school/exercises';

export async function listExercises(params: ExerciseListParams = {}): Promise<TrainingExercise[]> {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.sport) query.set('sport', params.sport);
  if (params.tag) query.set('tag', params.tag);
  if (params.mine) query.set('mine', 'true');
  if (params.templates !== undefined) query.set('templates', String(params.templates));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return bffClient.get<TrainingExercise[]>(qs ? `${BASE}?${qs}` : BASE);
}

export async function getExercise(id: string): Promise<TrainingExercise> {
  return bffClient.get<TrainingExercise>(`${BASE}/${id}`);
}

export async function createExercise(payload: ExerciseInput): Promise<TrainingExercise> {
  return bffClient.post<TrainingExercise>(BASE, payload);
}

export async function updateExercise(id: string, payload: Partial<ExerciseInput>): Promise<TrainingExercise> {
  return bffClient.put<TrainingExercise>(`${BASE}/${id}`, payload);
}

export async function deleteExercise(id: string): Promise<void> {
  await bffClient.delete(`${BASE}/${id}`);
}

/** Copia el ejercicio al bloque. Con `session_id` (sesión ya guardada) también
 *  completa el bloque en session_blocks; sin él hace falta `team_id` y solo se
 *  arma la jugada del bloque (match_lineups con source_id = block_id). */
export async function insertExerciseIntoSession(
  exerciseId: string,
  payload: { block_id: string; session_id?: string | null; team_id?: string | null },
): Promise<InsertIntoSessionResult> {
  return bffClient.post<InsertIntoSessionResult>(`${BASE}/${exerciseId}/insert-into-session`, payload);
}

// ─── Helpers puros ──────────────────────────────────────────────────────────

/** Etiqueta visible de una key de cuadro: el slot_label del puesto si la key
 *  es 'slot#i', o la etiqueta de un 'slot:<etiqueta>' (playerKey sin atleta). */
export function labelFromKey(key: string, players: ExerciseBoardPlayer[] = []): string {
  const idx = presetSlotIndex(key);
  if (idx !== null) return players[idx]?.slot_label ?? '';
  return key.startsWith('slot:') ? key.slice(5) : '';
}

/** La jugada de la biblioteca con la forma de una plantilla de «Mis jugadas»
 *  (slots + arrows + frames con keys 'slot#i'): lo que applyPreset() de la
 *  pizarra ya sabe cargar. */
export function exerciseAsPresetShape(board: Partial<ExerciseBoard> | null | undefined): {
  slots: { slot_label: string; x: number; y: number }[];
  arrows: TacticalArrow[];
  frames: TacticalFrame[] | null;
} {
  const players = Array.isArray(board?.players) ? board!.players : [];
  const frames = Array.isArray(board?.frames) && board!.frames.length > 0 ? board!.frames : null;
  return {
    slots: players.map((p) => ({ slot_label: p.slot_label, x: p.x, y: p.y })),
    arrows: Array.isArray(board?.arrows) ? board!.arrows : [],
    frames,
  };
}

/** Jugadores y figuras del PRIMER cuadro, listos para TacticalStaticSvg
 *  (miniatura de la tarjeta). El balón del cuadro se dibuja como objeto. */
export function exerciseThumbnail(board: Partial<ExerciseBoard> | null | undefined): {
  players: TacticalStaticPlayer[];
  arrows: TacticalArrow[];
} {
  const players = Array.isArray(board?.players) ? board!.players : [];
  const frames = Array.isArray(board?.frames) ? board!.frames : [];
  const first = frames[0];
  const byKey = new Map(players.map((p) => [p.key, p]));
  const staticPlayers: TacticalStaticPlayer[] = first && Array.isArray(first.players) && first.players.length > 0
    ? first.players.map((fp) => {
        const p = byKey.get(fp.key);
        return { x: fp.x, y: fp.y, label: p?.slot_label ?? labelFromKey(fp.key, players), jersey: p?.jersey_number ?? null };
      })
    : players.map((p) => ({ x: p.x, y: p.y, label: p.slot_label, jersey: p.jersey_number ?? null }));
  const arrows: TacticalArrow[] = first && Array.isArray(first.arrows) ? [...first.arrows] : Array.isArray(board?.arrows) ? [...board!.arrows] : [];
  if (first?.ball) {
    arrows.push({ type: 'ball', x1: first.ball.x, y1: first.ball.y, x2: first.ball.x, y2: first.ball.y });
  }
  return { players: staticPlayers, arrows };
}

/** Arma la jugada que se guarda en la biblioteca desde lo que hay en la
 *  pizarra. Se queda con la POSICIÓN y el PUESTO, nunca con el atleta: el
 *  ejercicio se reusa con otros equipos. Cada jugador pasa a ser el puesto
 *  'slot#i' (i = orden en `players`) y los cuadros se traducen con `key` (la
 *  key que el jugador tiene en los cuadros de la pizarra: subjectKey o
 *  presetSlotKey). Un jugador de un cuadro que no está en `players` se descarta. */
export function boardFromPitch(input: {
  players: { key: string; x: number | null | undefined; y: number | null | undefined; slot_label?: string | null; jersey_number?: number | string | null }[];
  arrows: TacticalArrow[];
  frames?: TacticalFrame[] | null;
}): ExerciseBoard {
  const keyMap = new Map<string, string>();
  const players: ExerciseBoardPlayer[] = [];
  for (const p of input.players) {
    if (p.x == null || p.y == null) continue;
    const key = presetSlotKey(players.length);
    keyMap.set(p.key, key);
    const jersey = p.jersey_number === '' || p.jersey_number == null ? null : Number(p.jersey_number);
    players.push({
      key,
      slot_label: (p.slot_label ?? '').trim().slice(0, 40) || `Jugador ${players.length + 1}`,
      x: Math.min(100, Math.max(0, Number(p.x))),
      y: Math.min(100, Math.max(0, Number(p.y))),
      ...(jersey !== null && Number.isInteger(jersey) && jersey >= 0 && jersey <= 99 ? { jersey_number: jersey } : {}),
    });
  }
  const frames: TacticalFrame[] = (input.frames ?? []).length > 1
    ? (input.frames ?? []).map((f) => ({
        ...f,
        players: f.players.flatMap((fp) => {
          const key = keyMap.get(fp.key);
          return key ? [{ key, x: fp.x, y: fp.y }] : [];
        }),
      }))
    : []; // un solo cuadro = jugada quieta: players + arrows alcanzan.
  return { players, arrows: input.arrows, frames };
}
