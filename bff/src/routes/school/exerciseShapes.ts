/**
 * Validación de la Biblioteca de ejercicios (pizarra T3, spec
 * docs/specs/pizarra-nivel-tacticalpad.md §4): campos del ejercicio y la jugada
 * `board` = { players, arrows, frames }.
 *
 * Igual que footballShapes.ts, vive aparte del router para probarla en unidad
 * sin cargar Express ni el cliente de Supabase. Lógica pura.
 *
 * Las figuras (arrows) se validan con el MISMO validateArrows/sanitizeArrows
 * de las alineaciones: una figura que la pizarra guarda en un partido tiene
 * que poder guardarse en la biblioteca y al revés.
 */
import { validateArrows, sanitizeArrows, MAX_SLOT_LABEL } from './footballShapes';

export const EXERCISE_SPORTS = [
  'futbol', 'futbol7', 'futbol5', 'futsal', 'voleibol', 'baloncesto', 'balonmano', 'generico',
] as const;
export type ExerciseSport = (typeof EXERCISE_SPORTS)[number];

export const MAX_EXERCISE_NAME = 120;
export const MAX_OBJECTIVE = 1000;
export const MAX_DESCRIPTION = 4000;
export const MAX_AGE_GROUP = 60;
export const MAX_MATERIALS = 500;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 240;

/** Mismos topes de tacticalFrames.ts (frontend) y del spec: 30 cuadros. */
export const MAX_FRAMES = 30;
export const MIN_FRAME_MS = 200;
export const MAX_FRAME_MS = 10000;
export const MAX_BOARD_PLAYERS = 40;
/** Igual que MAX_FRAME_PLAYERS de tacticalFrames.ts (frontend). */
export const MAX_FRAME_PLAYERS = 60;
export const MAX_PLAYER_KEY = 80;
export const MAX_FRAME_ID = 40;

const isPlainObject = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const inPitch = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;

export interface BoardPlayer { key: string; slot_label: string; x: number; y: number; jersey_number?: number | null }
export interface BoardFrame {
  id: string;
  duration_ms: number;
  players: { key: string; x: number; y: number }[];
  ball: { x: number; y: number } | null;
  arrows: Record<string, unknown>[];
}
export interface ExerciseBoard { players: BoardPlayer[]; arrows: Record<string, unknown>[]; frames: BoardFrame[] }

/** Valida y limpia la jugada. `board` ausente/null = jugada vacía (un
 *  ejercicio puede ser solo texto: un circuito físico no necesita cancha). */
export function validateBoard(board: unknown): { errors: string[]; board: ExerciseBoard | null } {
  const errors: string[] = [];
  if (board === undefined || board === null) return { errors, board: { players: [], arrows: [], frames: [] } };
  if (!isPlainObject(board)) return { errors: ['board debe ser un objeto { players, arrows, frames }.'], board: null };

  const rawPlayers = board.players ?? [];
  const rawArrows = board.arrows ?? [];
  const rawFrames = board.frames ?? [];
  if (!Array.isArray(rawPlayers)) errors.push('board.players debe ser una lista.');
  if (!Array.isArray(rawArrows)) errors.push('board.arrows debe ser una lista.');
  if (!Array.isArray(rawFrames)) errors.push('board.frames debe ser una lista.');
  if (errors.length) return { errors, board: null };

  // Jugadores (puestos): solo layout, sin atleta real. La key esperada es
  // 'slot#<índice>' (presetSlotKey del frontend, formato de «Mis jugadas»);
  // no se exige para no romper una jugada guardada con otra convención.
  if (rawPlayers.length > MAX_BOARD_PLAYERS) {
    errors.push(`demasiados jugadores: máximo ${MAX_BOARD_PLAYERS}.`);
  } else {
    const seen = new Set<string>();
    for (const p of rawPlayers) {
      if (!isPlainObject(p)) { errors.push('jugador inválido: debe ser un objeto.'); continue; }
      if (typeof p.key !== 'string' || !p.key.trim() || p.key.length > MAX_PLAYER_KEY) {
        errors.push(`key inválida en un jugador (1-${MAX_PLAYER_KEY} caracteres).`);
      } else if (seen.has(p.key)) {
        errors.push(`jugador repetido: ${p.key.slice(0, 40)}`);
      } else {
        seen.add(p.key);
      }
      if (typeof p.slot_label !== 'string' || !p.slot_label.trim() || p.slot_label.trim().length > MAX_SLOT_LABEL) {
        errors.push(`slot_label inválido en un jugador (1-${MAX_SLOT_LABEL} caracteres).`);
      }
      if (!inPitch(p.x) || !inPitch(p.y)) errors.push('x/y inválidos en un jugador: deben estar entre 0 y 100.');
      if (p.jersey_number !== undefined && p.jersey_number !== null
        && !(Number.isInteger(p.jersey_number) && p.jersey_number >= 0 && p.jersey_number <= 99)) {
        errors.push('jersey_number inválido: entero entre 0 y 99.');
      }
    }
  }

  const arrowErrors = validateArrows(rawArrows);
  errors.push(...arrowErrors);

  // Cuadros (T1): mismo formato que tacticalFrames.ts.
  if (rawFrames.length > MAX_FRAMES) {
    errors.push(`demasiados cuadros: máximo ${MAX_FRAMES}.`);
  } else {
    rawFrames.forEach((f: unknown, i: number) => {
      const n = i + 1;
      if (!isPlainObject(f)) { errors.push(`cuadro ${n} inválido: debe ser un objeto.`); return; }
      if (typeof f.id !== 'string' || !f.id.trim() || f.id.length > MAX_FRAME_ID) {
        errors.push(`cuadro ${n}: id inválido.`);
      }
      if (typeof f.duration_ms !== 'number' || !Number.isFinite(f.duration_ms)
        || f.duration_ms < MIN_FRAME_MS || f.duration_ms > MAX_FRAME_MS) {
        errors.push(`cuadro ${n}: duration_ms debe estar entre ${MIN_FRAME_MS} y ${MAX_FRAME_MS}.`);
      }
      if (!Array.isArray(f.players)) {
        errors.push(`cuadro ${n}: players debe ser una lista.`);
      } else if (f.players.length > MAX_FRAME_PLAYERS) {
        errors.push(`cuadro ${n}: máximo ${MAX_FRAME_PLAYERS} jugadores.`);
      } else {
        for (const p of f.players) {
          if (!isPlainObject(p) || typeof p.key !== 'string' || !p.key.trim() || p.key.length > MAX_PLAYER_KEY
            || !inPitch(p.x) || !inPitch(p.y)) {
            errors.push(`cuadro ${n}: jugador inválido (key + x/y entre 0 y 100).`);
            break;
          }
        }
      }
      if (f.ball !== null && f.ball !== undefined && !(isPlainObject(f.ball) && inPitch(f.ball.x) && inPitch(f.ball.y))) {
        errors.push(`cuadro ${n}: ball debe ser null o { x, y } entre 0 y 100.`);
      }
      const frameArrows = f.arrows ?? [];
      if (!Array.isArray(frameArrows)) {
        errors.push(`cuadro ${n}: arrows debe ser una lista.`);
      } else {
        for (const e of validateArrows(frameArrows)) errors.push(`cuadro ${n}: ${e}`);
      }
    });
  }

  if (errors.length) return { errors, board: null };

  return {
    errors,
    board: {
      players: rawPlayers.map((p: any) => ({
        key: p.key.trim(),
        slot_label: p.slot_label.trim(),
        x: p.x,
        y: p.y,
        ...(p.jersey_number !== undefined && p.jersey_number !== null ? { jersey_number: p.jersey_number } : {}),
      })),
      arrows: sanitizeArrows(rawArrows),
      frames: rawFrames.map((f: any) => ({
        id: f.id.trim(),
        duration_ms: Math.round(f.duration_ms),
        players: f.players.map((p: any) => ({ key: p.key.trim(), x: p.x, y: p.y })),
        ball: f.ball ? { x: f.ball.x, y: f.ball.y } : null,
        arrows: sanitizeArrows(f.arrows ?? []),
      })),
    },
  };
}

function optText(v: unknown, field: string, max: number, errors: string[]): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') { errors.push(`${field} debe ser texto.`); return undefined; }
  const t = v.trim();
  if (t.length > max) { errors.push(`${field} demasiado largo: máximo ${max} caracteres.`); return undefined; }
  return t.length ? t : null;
}

export interface ExerciseFields {
  name?: string;
  objective?: string | null;
  minutes?: number | null;
  age_group?: string | null;
  materials?: string | null;
  tags?: string[];
  sport?: ExerciseSport;
  description?: string | null;
  board?: ExerciseBoard;
}

/**
 * Valida el cuerpo de POST (partial=false: name obligatorio) o PUT
 * (partial=true: solo lo que venga). Devuelve SOLO los campos conocidos:
 * school_id, created_by, is_template, times_used nunca salen del cliente.
 */
export function validateExerciseInput(body: unknown, partial: boolean): { errors: string[]; fields: ExerciseFields } {
  const errors: string[] = [];
  const fields: ExerciseFields = {};
  if (!isPlainObject(body)) return { errors: ['Cuerpo inválido.'], fields };

  if (body.name !== undefined || !partial) {
    if (typeof body.name !== 'string' || !body.name.trim()) errors.push('name es requerido.');
    else if (body.name.trim().length > MAX_EXERCISE_NAME) errors.push(`name demasiado largo: máximo ${MAX_EXERCISE_NAME} caracteres.`);
    else fields.name = body.name.trim();
  }

  const objective = optText(body.objective, 'objective', MAX_OBJECTIVE, errors);
  if (objective !== undefined) fields.objective = objective;
  const age = optText(body.age_group, 'age_group', MAX_AGE_GROUP, errors);
  if (age !== undefined) fields.age_group = age;
  const materials = optText(body.materials, 'materials', MAX_MATERIALS, errors);
  if (materials !== undefined) fields.materials = materials;
  const description = optText(body.description, 'description', MAX_DESCRIPTION, errors);
  if (description !== undefined) fields.description = description;

  if (body.minutes !== undefined) {
    if (body.minutes === null || body.minutes === '') fields.minutes = null;
    else {
      const m = typeof body.minutes === 'string' ? Number(body.minutes) : body.minutes;
      if (typeof m !== 'number' || !Number.isInteger(m) || m < MIN_MINUTES || m > MAX_MINUTES) {
        errors.push(`minutes debe ser un entero entre ${MIN_MINUTES} y ${MAX_MINUTES}.`);
      } else fields.minutes = m;
    }
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) errors.push('tags debe ser una lista.');
    else {
      const clean: string[] = [];
      for (const t of body.tags) {
        if (typeof t !== 'string') { errors.push('cada etiqueta debe ser texto.'); break; }
        const v = t.trim().toLowerCase();
        if (!v) continue;
        if (v.length > MAX_TAG_LENGTH) { errors.push(`etiqueta demasiado larga: máximo ${MAX_TAG_LENGTH} caracteres.`); break; }
        if (!clean.includes(v)) clean.push(v);
      }
      if (clean.length > MAX_TAGS) errors.push(`demasiadas etiquetas: máximo ${MAX_TAGS}.`);
      fields.tags = clean;
    }
  }

  if (body.sport !== undefined) {
    if (!EXERCISE_SPORTS.includes(body.sport)) errors.push(`sport inválido: ${String(body.sport).slice(0, 20)}`);
    else fields.sport = body.sport;
  }

  if (body.board !== undefined || !partial) {
    const { errors: be, board } = validateBoard(body.board);
    if (be.length) errors.push(...be.map((e) => `jugada: ${e}`));
    else if (board) fields.board = board;
  }

  return { errors, fields };
}

/** Texto de búsqueda seguro para el filtro `or=(name.ilike.*q*,…)` de
 *  PostgREST: sin comas, paréntesis ni comodines que rompan o amplíen el filtro. */
export function sanitizeSearch(q: unknown): string {
  if (typeof q !== 'string') return '';
  return q.replace(/[,()*%\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
