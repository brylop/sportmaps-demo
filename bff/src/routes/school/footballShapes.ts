/**
 * Validación de las figuras de la pizarra táctica (flechas, curvas, zonas,
 * recorridos de balón y material de entrenamiento) que llegan en el jsonb
 * `arrows` de alineaciones y plantillas. No hay constraint SQL equivalente:
 * esta función es el único filtro antes de guardar.
 *
 * Vive aparte de football.ts para poder probarla en unidad sin cargar el
 * router (que al importarse arrastra el cliente de Supabase y sus variables
 * de entorno). Lógica pura: sin Express, sin base.
 */

export const VALID_ARROW_COLORS = ['white', 'yellow', 'red', 'blue', 'green', 'orange', 'purple', 'pink', 'black'] as const;
export const VALID_SHAPE_TYPES = [
  'arrow', 'curve', 'zone', 'ball_path',
  'cone', 'marker', 'ball', 'goal', 'mini_goal', 'hurdle', 'ring', 'ladder', 'pole', 'mannequin', 'opponent',
  'freehand', 'text',
] as const;
/** Lápiz libre (2026-09-30): `points` es [x,y,x,y,…] en % de cancha. El
 *  frontend simplifica el trazo antes de guardar; el tope frena un jsonb
 *  gigante (un garabato de 2 minutos sin simplificar), no a un trazo normal. */
export const FREEHAND_MAX_POINTS = 600;
/** Texto sobre la cancha: una consigna corta ("presión alta"), no un párrafo. */
export const TEXT_MAX_LENGTH = 80;
export const VALID_BALL_PATH_KINDS = ['pase', 'remate', 'penal'] as const;
/** Mismo rango que OBJ_SIZE_MIN/MAX del frontend con un margen: el slider va
 *  de 0.5 a 3, acá se acepta 0.25–4 para no rechazar un valor legítimo por
 *  redondeo y sí rechazar basura (0, negativos, 1000). */
export const SHAPE_SIZE_MIN = 0.25;
export const SHAPE_SIZE_MAX = 4;
/** Topes de cantidad: sin ellos un cliente (o un bug) podía guardar un jsonb de
 *  megas -- el único freno era el límite global de 5 MB del body. Un tablero real
 *  tiene decenas de figuras; 300 deja margen de sobra a un coach que dibuja mucho. */
export const MAX_SHAPES = 300;
export const MAX_PRESET_SLOTS = 40;
export const MAX_PRESET_NAME = 80;
export const MAX_SLOT_LABEL = 40;
/** Giro: el frontend guarda 0-359, pero un -45 histórico es válido; fuera de
 *  ±360 es basura, no un giro. */
export const SHAPE_ROT_ABS_MAX = 360;

const isPlainObject = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Figuras del modo pizarra (P2d) -- coordenadas en el mismo espacio 0-100
 *  que slots/x/y, para que el frontend no tenga que manejar dos sistemas.
 *  "type" es opcional (compat con flechas guardadas antes de curva/zona). */
export function validateArrows(arrows: any[]): string[] {
  const errors: string[] = [];
  if (arrows.length > MAX_SHAPES) {
    errors.push(`demasiadas figuras: máximo ${MAX_SHAPES}.`);
    return errors;
  }
  for (const a of arrows) {
    // Un null/número/arreglo en la lista reventaba con TypeError (500) en vez
    // de un 422 claro.
    if (!isPlainObject(a)) {
      errors.push('figura inválida: debe ser un objeto.');
      continue;
    }
    for (const key of ['x1', 'y1', 'x2', 'y2'] as const) {
      if (typeof a[key] !== 'number' || a[key] < 0 || a[key] > 100) {
        errors.push(`${key} inválido en una flecha: debe estar entre 0 y 100.`);
      }
    }
    if (a.color !== undefined && !VALID_ARROW_COLORS.includes(a.color)) {
      errors.push(`color de flecha inválido: ${a.color}`);
    }
    if (a.type !== undefined && !VALID_SHAPE_TYPES.includes(a.type)) {
      errors.push(`type de figura inválido: ${a.type}`);
    }
    // Campos opcionales agregados 2026-09-24 (tamaño, giro, tipo de recorrido
    // del balón). Ausentes = válidos; presentes = deben tener sentido.
    if (a.size !== undefined && (typeof a.size !== 'number' || !Number.isFinite(a.size) || a.size < SHAPE_SIZE_MIN || a.size > SHAPE_SIZE_MAX)) {
      errors.push(`size inválido en una figura: debe estar entre ${SHAPE_SIZE_MIN} y ${SHAPE_SIZE_MAX}.`);
    }
    if (a.rot !== undefined && (typeof a.rot !== 'number' || !Number.isFinite(a.rot) || Math.abs(a.rot) > SHAPE_ROT_ABS_MAX)) {
      errors.push(`rot inválido en una figura: debe ser un número de grados entre -${SHAPE_ROT_ABS_MAX} y ${SHAPE_ROT_ABS_MAX}.`);
    }
    if (a.kind !== undefined && !VALID_BALL_PATH_KINDS.includes(a.kind)) {
      errors.push(`kind de recorrido inválido: ${a.kind}`);
    }
    // Lápiz y texto: x1..y2 siguen siendo obligatorios (caja del trazo /
    // posición del texto), así que todo lo de arriba aplica igual.
    if (a.type === 'freehand') {
      const pts = a.points;
      if (!Array.isArray(pts) || pts.length < 4 || pts.length % 2 !== 0) {
        errors.push('points inválido en un trazo: debe ser [x,y,x,y,…] con al menos 2 puntos.');
      } else if (pts.length / 2 > FREEHAND_MAX_POINTS) {
        errors.push(`trazo demasiado largo: máximo ${FREEHAND_MAX_POINTS} puntos.`);
      } else if (pts.some((n: unknown) => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100)) {
        errors.push('points inválido en un trazo: cada coordenada debe estar entre 0 y 100.');
      }
    } else if (a.points !== undefined) {
      errors.push('points solo aplica a un trazo de lápiz (type freehand).');
    }
    if (a.type === 'text') {
      if (typeof a.text !== 'string' || a.text.trim().length === 0) {
        errors.push('text vacío en un texto de la pizarra.');
      } else if (a.text.length > TEXT_MAX_LENGTH) {
        errors.push(`texto demasiado largo: máximo ${TEXT_MAX_LENGTH} caracteres.`);
      }
    } else if (a.text !== undefined) {
      errors.push('text solo aplica a una figura de texto (type text).');
    }
  }
  return errors;
}

/** Deja SOLO los campos conocidos de cada figura. Antes el objeto del cliente
 *  se guardaba tal cual y cualquier campo extra (o un texto enorme en un campo
 *  inventado) terminaba en el jsonb. Se llama DESPUÉS de validateArrows. */
export function sanitizeArrows(arrows: any[]): Record<string, unknown>[] {
  return arrows.map((a) => {
    const out: Record<string, unknown> = { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 };
    if (a.type !== undefined) out.type = a.type;
    if (a.color !== undefined) out.color = a.color;
    if (a.size !== undefined) out.size = a.size;
    if (a.rot !== undefined) out.rot = a.rot;
    if (a.kind !== undefined) out.kind = a.kind;
    if (a.type === 'freehand') out.points = a.points;
    if (a.type === 'text') out.text = a.text.trim();
    return out;
  });
}

/** Slots de una plantilla: solo layout (D8) -- slot_label + x/y. */
export function validatePresetSlots(slots: any[]): string[] {
  const errors: string[] = [];
  if (slots.length > MAX_PRESET_SLOTS) {
    errors.push(`demasiados slots: máximo ${MAX_PRESET_SLOTS}.`);
    return errors;
  }
  for (const s of slots) {
    if (!isPlainObject(s)) {
      errors.push('slot inválido: debe ser un objeto.');
      continue;
    }
    if (typeof s.slot_label !== 'string' || !s.slot_label.trim()) {
      errors.push('Cada slot necesita slot_label.');
    } else if (s.slot_label.trim().length > MAX_SLOT_LABEL) {
      errors.push(`slot_label demasiado largo (máximo ${MAX_SLOT_LABEL} caracteres): "${s.slot_label.slice(0, 20)}…"`);
    }
    if (typeof s.x !== 'number' || !Number.isFinite(s.x) || s.x < 0 || s.x > 100) {
      errors.push(`x inválido en slot "${s.slot_label}": debe estar entre 0 y 100.`);
    }
    if (typeof s.y !== 'number' || !Number.isFinite(s.y) || s.y < 0 || s.y > 100) {
      errors.push(`y inválido en slot "${s.slot_label}": debe estar entre 0 y 100.`);
    }
  }
  return errors;
}

export function sanitizeSlots(slots: any[]): { slot_label: string; x: number; y: number }[] {
  return slots.map((s) => ({ slot_label: s.slot_label.trim(), x: s.x, y: s.y }));
}

// ─── Jugada animada por cuadros (T1, docs/specs/pizarra-nivel-tacticalpad.md §4) ──
// `frames` jsonb en match_lineups y team_tactical_presets (migración
// 20261008155454). El CHECK de la base solo mira que sea un arreglo de 1-30 y
// su tamaño; la forma de cada cuadro la valida esto.

export const MAX_FRAMES = 30;
export const FRAME_MS_MIN = 200;
export const FRAME_MS_MAX = 10000;
/** Dos equipos de 11 + banca de sobra. Igual que MAX_FRAME_PLAYERS del frontend. */
export const MAX_FRAME_PLAYERS = 60;
export const MAX_FRAME_KEY = 120;
export const MAX_FRAME_ID = 64;
/** Mismo tope que el CHECK de la base (pg_column_size ≤ 512 KB). Se mide sobre
 *  el JSON ya saneado: es lo que se guarda. */
export const MAX_FRAMES_BYTES = 512 * 1024;

const isCoord = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

/**
 * Valida la lista de cuadros. `null` es válido (= la jugada es un solo cuadro).
 * Los errores llevan el número de cuadro (1-based) para que el mensaje sirva.
 */
export function validateFrames(frames: unknown): string[] {
  if (frames === null) return [];
  if (!Array.isArray(frames)) return ['frames debe ser una lista de cuadros o null.'];
  if (frames.length === 0) return ['frames vacío: manda null para una jugada de un solo cuadro.'];
  if (frames.length > MAX_FRAMES) return [`demasiados cuadros: máximo ${MAX_FRAMES}.`];
  const errors: string[] = [];
  frames.forEach((f, i) => {
    const n = i + 1;
    if (!isPlainObject(f)) {
      errors.push(`cuadro ${n}: debe ser un objeto.`);
      return;
    }
    if (typeof f.id !== 'string' || !f.id.trim() || f.id.length > MAX_FRAME_ID) {
      errors.push(`cuadro ${n}: id inválido.`);
    }
    if (typeof f.duration_ms !== 'number' || !Number.isFinite(f.duration_ms) || f.duration_ms < FRAME_MS_MIN || f.duration_ms > FRAME_MS_MAX) {
      errors.push(`cuadro ${n}: duration_ms debe estar entre ${FRAME_MS_MIN} y ${FRAME_MS_MAX}.`);
    }
    if (!Array.isArray(f.players)) {
      errors.push(`cuadro ${n}: players debe ser una lista.`);
    } else if (f.players.length > MAX_FRAME_PLAYERS) {
      errors.push(`cuadro ${n}: demasiados jugadores (máximo ${MAX_FRAME_PLAYERS}).`);
    } else {
      const seen = new Set<string>();
      for (const p of f.players) {
        if (!isPlainObject(p)) {
          errors.push(`cuadro ${n}: jugador inválido.`);
          continue;
        }
        if (typeof p.key !== 'string' || !p.key || p.key.length > MAX_FRAME_KEY) {
          errors.push(`cuadro ${n}: key de jugador inválida (texto de 1 a ${MAX_FRAME_KEY} caracteres).`);
        } else if (seen.has(p.key)) {
          errors.push(`cuadro ${n}: jugador repetido (${p.key.slice(0, 40)}).`);
        } else {
          seen.add(p.key);
        }
        if (!isCoord(p.x) || !isCoord(p.y)) {
          errors.push(`cuadro ${n}: x/y de un jugador deben estar entre 0 y 100.`);
        }
      }
    }
    if (f.ball !== null && f.ball !== undefined) {
      if (!isPlainObject(f.ball) || !isCoord(f.ball.x) || !isCoord(f.ball.y)) {
        errors.push(`cuadro ${n}: ball debe ser null o {x, y} entre 0 y 100.`);
      }
    }
    if (!Array.isArray(f.arrows)) {
      errors.push(`cuadro ${n}: arrows debe ser una lista.`);
    } else {
      for (const e of validateArrows(f.arrows)) errors.push(`cuadro ${n}: ${e}`);
    }
  });
  if (errors.length > 0) return errors;
  const bytes = Buffer.byteLength(JSON.stringify(sanitizeFrames(frames)), 'utf8');
  if (bytes > MAX_FRAMES_BYTES) {
    return [`la jugada animada es demasiado grande (${Math.ceil(bytes / 1024)} KB; máximo ${MAX_FRAMES_BYTES / 1024} KB). Quita cuadros o figuras.`];
  }
  return [];
}

/** Deja solo los campos conocidos de cada cuadro (y de sus figuras). Se llama
 *  DESPUÉS de validateFrames. */
export function sanitizeFrames(frames: any[]): Record<string, unknown>[] {
  return frames.map((f) => ({
    id: String(f.id).trim(),
    duration_ms: Math.round(f.duration_ms),
    players: f.players.map((p: any) => ({ key: p.key, x: p.x, y: p.y })),
    ball: f.ball ? { x: f.ball.x, y: f.ball.y } : null,
    arrows: sanitizeArrows(f.arrows),
  }));
}

/** La columna `frames` todavía no existe en esta base (migración
 *  20261008155454 sin aplicar): PostgREST responde 42703 (select) o PGRST204
 *  (insert/update con una columna que no está en su caché). El BFF sigue
 *  funcionando sin animación en vez de responder 500 a todo. */
export function isMissingFramesColumn(err: unknown): boolean {
  if (!isPlainObject(err)) return false;
  const code = String(err.code ?? '');
  const msg = `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`;
  return (code === '42703' || code === 'PGRST204') && /frames/.test(msg);
}
