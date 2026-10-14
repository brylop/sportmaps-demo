/**
 * Paquetes de la Biblioteca de ejercicios (pizarra M2, D4 de
 * docs/specs/pizarra-multideporte-3d-ia.md): formato del ARCHIVO de
 * importación/exportación y su validación. Lógica pura, sin Express ni
 * Supabase (se prueba en unidad, igual que exerciseShapes.ts).
 *
 * Archivo (.json):
 *   {
 *     format: 'sportmaps-ejercicios', version: 1, exported_at?,
 *     pack: { name, description?, sport, version? },
 *     exercises: [{ name, objective?, minutes?, age_group?, materials?, tags?,
 *                   sport?, description?, board? }]
 *   }
 *
 * Reglas de la importación (el archivo es dato NO confiable):
 *   · formato y versión exactos; ≤ 200 ejercicios; el archivo ≤ 4 MB.
 *   · cada ejercicio pasa por validateExerciseInput (los MISMOS topes y la
 *     misma validación de jugada/cuadros que guardar desde la pizarra).
 *   · deporte del paquete y de cada ejercicio: del catálogo Y de los deportes
 *     de la escuela (D1); «Preparación física» siempre.
 *   · sin HTML ni `javascript:` en ningún texto (nombre, objetivo, textos de
 *     la pizarra, puestos…). React lo escaparía igual; se rechaza para que un
 *     archivo así no circule entre escuelas.
 *   · NUNCA se usan ids del archivo: validateExerciseInput solo devuelve los
 *     campos conocidos (id, school_id, created_by, is_template, times_used se
 *     descartan) y las keys de los jugadores se reescriben a 'slot#i', así un
 *     id de atleta metido como key no llega a la base.
 *   · si algo no valida se rechaza TODO, con la lista de errores.
 */
import {
  validateExerciseInput,
  EXERCISE_SPORTS,
  type ExerciseBoard,
  type ExerciseFields,
  type ExerciseSport,
} from './exerciseShapes';

export const PACK_FILE_FORMAT = 'sportmaps-ejercicios';
export const PACK_FILE_VERSION = 1;
export const MAX_PACK_EXERCISES = 200;
export const MAX_PACK_NAME = 120;
export const MAX_PACK_DESCRIPTION = 1000;
export const MAX_PACK_VERSION = 100000;
/** Por debajo del límite global de express.json (5 MB) y del tope de la RPC. */
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const MAX_REPORTED_ERRORS = 50;

export const PACK_SPORT_LABEL: Record<ExerciseSport, string> = {
  futbol: 'Fútbol 11',
  futbol7: 'Fútbol 7',
  futbol5: 'Fútbol 5',
  futsal: 'Fútbol sala',
  voleibol: 'Voleibol',
  baloncesto: 'Baloncesto',
  balonmano: 'Balonmano',
  generico: 'Preparación física',
};

const isPlainObject = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const MARKUP_RE = /<\s*\/?\s*[a-z!?][^>]*>|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/i;
/** ¿El texto trae HTML/script? (etiquetas, `javascript:`…) */
export function hasMarkup(v: unknown): boolean {
  return typeof v === 'string' && MARKUP_RE.test(v);
}

const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SLOT_INDEX_KEY = /^slot#\d{1,3}$/;
const SLOT_LABEL_KEY = /^slot:.{1,40}$/;

/**
 * Jugada sin identidades: cada jugador pasa a 'slot#<i>' (su orden) y los
 * cuadros se traducen con esa misma tabla. Un jugador de un cuadro que no está
 * en la jugada solo sobrevive si su key ya es un puesto ('slot#i' o
 * 'slot:<etiqueta>' sin uuid); cualquier otra key (un id de atleta, un
 * subjectKey de la pizarra) se descarta.
 */
export function anonymizeBoard(board: Partial<ExerciseBoard> | null | undefined): ExerciseBoard {
  const players = Array.isArray(board?.players) ? board!.players : [];
  const arrows = Array.isArray(board?.arrows) ? board!.arrows : [];
  const frames = Array.isArray(board?.frames) ? board!.frames : [];
  const keyMap = new Map<string, string>();
  const outPlayers = players.map((p, i) => {
    const key = `slot#${i}`;
    keyMap.set(p.key, key);
    return {
      key,
      slot_label: p.slot_label,
      x: p.x,
      y: p.y,
      ...(p.jersey_number !== undefined && p.jersey_number !== null ? { jersey_number: p.jersey_number } : {}),
    };
  });
  const outFrames = frames.map((f) => ({
    id: f.id,
    duration_ms: f.duration_ms,
    players: (Array.isArray(f.players) ? f.players : []).flatMap((fp) => {
      const mapped = keyMap.get(fp.key);
      if (mapped) return [{ key: mapped, x: fp.x, y: fp.y }];
      const safe = SLOT_INDEX_KEY.test(fp.key) || (SLOT_LABEL_KEY.test(fp.key) && !UUID_ANYWHERE.test(fp.key));
      return safe ? [{ key: fp.key, x: fp.x, y: fp.y }] : [];
    }),
    ball: f.ball ? { x: f.ball.x, y: f.ball.y } : null,
    arrows: Array.isArray(f.arrows) ? f.arrows : [],
  }));
  return { players: outPlayers, arrows, frames: outFrames };
}

/** Textos de la jugada (puestos y figuras de texto) para el control de HTML. */
function boardTexts(board: unknown): string[] {
  if (!isPlainObject(board)) return [];
  const out: string[] = [];
  const pushArrowTexts = (arrows: unknown) => {
    if (!Array.isArray(arrows)) return;
    for (const a of arrows) if (isPlainObject(a) && typeof a.text === 'string') out.push(a.text);
  };
  if (Array.isArray(board.players)) {
    for (const p of board.players) if (isPlainObject(p) && typeof p.slot_label === 'string') out.push(p.slot_label);
  }
  pushArrowTexts(board.arrows);
  if (Array.isArray(board.frames)) for (const f of board.frames) if (isPlainObject(f)) pushArrowTexts(f.arrows);
  return out;
}

export interface PackMeta {
  name: string;
  description: string | null;
  sport: ExerciseSport;
  version: number;
}

export type PackExercise = Omit<ExerciseFields, 'name' | 'sport' | 'board'> & {
  name: string;
  sport: ExerciseSport;
  board: ExerciseBoard;
};

export interface PackSummary {
  name: string;
  sport: ExerciseSport | null;
  exercises: number;
  /** Deportes de los ejercicios, en el orden del catálogo. */
  sports: ExerciseSport[];
}

export interface PackValidation {
  errors: string[];
  value: { pack: PackMeta; exercises: PackExercise[] } | null;
  summary: PackSummary | null;
}

const short = (s: unknown, n = 40) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * Valida el archivo completo contra los deportes de la escuela.
 * `allowedSports`: loadSchoolLibrarySports() (ya incluye 'generico').
 */
export function validatePackFile(raw: unknown, allowedSports: readonly string[]): PackValidation {
  const errors: string[] = [];
  const allowed = new Set<string>([...allowedSports, 'generico']);
  const sportName = (s: string) => PACK_SPORT_LABEL[s as ExerciseSport] ?? s;

  if (!isPlainObject(raw)) {
    return { errors: ['El archivo no es un paquete de SportMaps (se esperaba un objeto JSON).'], value: null, summary: null };
  }
  if (raw.format !== PACK_FILE_FORMAT) {
    errors.push(`Formato desconocido: se esperaba «${PACK_FILE_FORMAT}».`);
  }
  if (raw.version !== PACK_FILE_VERSION) {
    errors.push(`Versión de formato no soportada (${short(raw.version, 10) || 'sin versión'}): esta app lee la versión ${PACK_FILE_VERSION}.`);
  }
  if (errors.length) return { errors, value: null, summary: null };

  // ── Paquete ──────────────────────────────────────────────────────────────
  const p = raw.pack;
  let meta: PackMeta | null = null;
  if (!isPlainObject(p)) {
    errors.push('Falta «pack» (nombre y deporte del paquete).');
  } else {
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name) errors.push('El paquete no tiene nombre.');
    else if (name.length > MAX_PACK_NAME) errors.push(`Nombre del paquete demasiado largo: máximo ${MAX_PACK_NAME} caracteres.`);
    else if (hasMarkup(name)) errors.push('El nombre del paquete trae HTML o código: no se permite.');

    let description: string | null = null;
    if (p.description !== undefined && p.description !== null) {
      if (typeof p.description !== 'string') errors.push('La descripción del paquete debe ser texto.');
      else if (p.description.trim().length > MAX_PACK_DESCRIPTION) errors.push(`Descripción del paquete demasiado larga: máximo ${MAX_PACK_DESCRIPTION} caracteres.`);
      else if (hasMarkup(p.description)) errors.push('La descripción del paquete trae HTML o código: no se permite.');
      else description = p.description.trim() || null;
    }

    let sport: ExerciseSport | null = null;
    if (!(EXERCISE_SPORTS as readonly unknown[]).includes(p.sport)) {
      errors.push(`Deporte del paquete inválido: ${short(p.sport, 20) || 'vacío'}.`);
    } else if (!allowed.has(p.sport)) {
      errors.push(`El paquete es de ${sportName(p.sport)}, un deporte que tu escuela no tiene.`);
    } else {
      sport = p.sport as ExerciseSport;
    }

    let version = 1;
    if (p.version !== undefined && p.version !== null) {
      if (!Number.isInteger(p.version) || p.version < 1 || p.version > MAX_PACK_VERSION) {
        errors.push(`Versión del paquete inválida: entero entre 1 y ${MAX_PACK_VERSION}.`);
      } else version = p.version;
    }

    if (name && sport) meta = { name, description, sport, version };
  }

  // ── Ejercicios ───────────────────────────────────────────────────────────
  const list = raw.exercises;
  if (!Array.isArray(list)) {
    errors.push('Falta la lista «exercises».');
    return { errors, value: null, summary: null };
  }
  if (list.length === 0) errors.push('El paquete no trae ejercicios.');
  if (list.length > MAX_PACK_EXERCISES) {
    errors.push(`Demasiados ejercicios (${list.length}): máximo ${MAX_PACK_EXERCISES} por paquete.`);
    return { errors, value: null, summary: null };
  }

  const exercises: PackExercise[] = [];
  list.forEach((ex: unknown, i: number) => {
    const tag = (name?: unknown) => `Ejercicio ${i + 1}${short(name) ? ` («${short(name)}»)` : ''}`;
    if (!isPlainObject(ex)) { errors.push(`${tag()}: debe ser un objeto.`); return; }
    const where = tag(ex.name);

    // Solo los campos conocidos; el deporte por defecto es el del paquete.
    const input = { ...ex, sport: ex.sport ?? meta?.sport ?? (isPlainObject(p) ? p.sport : undefined) };
    const { errors: exErrors, fields } = validateExerciseInput(input, false);
    for (const e of exErrors) errors.push(`${where}: ${e}`);

    for (const [field, label] of [
      ['name', 'nombre'], ['objective', 'objetivo'], ['description', 'organización'],
      ['materials', 'material'], ['age_group', 'categoría'],
    ] as const) {
      if (hasMarkup(ex[field])) errors.push(`${where}: el ${label} trae HTML o código: no se permite.`);
    }
    if (Array.isArray(ex.tags) && ex.tags.some(hasMarkup)) errors.push(`${where}: una etiqueta trae HTML o código.`);
    if (boardTexts(ex.board).some(hasMarkup)) errors.push(`${where}: un texto de la jugada trae HTML o código.`);

    if (fields.sport && !allowed.has(fields.sport)) {
      errors.push(`${where}: es de ${sportName(fields.sport)}, un deporte que tu escuela no tiene.`);
    }
    if (exErrors.length === 0 && fields.name && fields.sport && fields.board) {
      exercises.push({ ...fields, name: fields.name, sport: fields.sport, board: anonymizeBoard(fields.board) });
    }
  });

  const sportsInFile = new Set<ExerciseSport>(exercises.map((e) => e.sport));
  const summary: PackSummary = {
    name: meta?.name ?? (isPlainObject(p) && typeof p.name === 'string' ? short(p.name, MAX_PACK_NAME) : ''),
    sport: meta?.sport ?? null,
    exercises: list.length,
    sports: EXERCISE_SPORTS.filter((s) => sportsInFile.has(s)),
  };

  if (errors.length) {
    const shown = errors.slice(0, MAX_REPORTED_ERRORS);
    if (errors.length > MAX_REPORTED_ERRORS) shown.push(`… y ${errors.length - MAX_REPORTED_ERRORS} errores más.`);
    return { errors: shown, value: null, summary };
  }
  return { errors: [], value: { pack: meta!, exercises }, summary };
}

/** Fila de training_exercises que se exporta (solo contenido). */
export interface ExportableExercise {
  name: string;
  objective: string | null;
  minutes: number | null;
  age_group: string | null;
  materials: string | null;
  tags: string[] | null;
  sport: string;
  description: string | null;
  board: Partial<ExerciseBoard> | null;
}

export interface PackFile {
  format: typeof PACK_FILE_FORMAT;
  version: typeof PACK_FILE_VERSION;
  exported_at: string;
  pack: { name: string; description: string | null; sport: string; version: number };
  exercises: {
    name: string; objective: string | null; minutes: number | null; age_group: string | null;
    materials: string | null; tags: string[]; sport: string; description: string | null; board: ExerciseBoard;
  }[];
}

/**
 * Archivo de exportación. Lista blanca de campos: sin id, school_id,
 * created_by, pack_id, is_template ni contadores; la jugada sin identidades.
 */
export function buildPackFile(
  pack: { name: string; description: string | null; sport: string; version: number | null },
  rows: readonly ExportableExercise[],
  now: Date = new Date(),
): PackFile {
  return {
    format: PACK_FILE_FORMAT,
    version: PACK_FILE_VERSION,
    exported_at: now.toISOString(),
    pack: { name: pack.name, description: pack.description ?? null, sport: pack.sport, version: pack.version ?? 1 },
    exercises: rows.map((r) => ({
      name: r.name,
      objective: r.objective ?? null,
      minutes: r.minutes ?? null,
      age_group: r.age_group ?? null,
      materials: r.materials ?? null,
      tags: Array.isArray(r.tags) ? r.tags : [],
      sport: r.sport,
      description: r.description ?? null,
      board: anonymizeBoard(r.board),
    })),
  };
}

/** Nombre de archivo seguro: «paquete-futbol-fundamentos-y-juego.json». */
export function packFileName(name: string): string {
  const slug = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `paquete-${slug || 'ejercicios'}.json`;
}
