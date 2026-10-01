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

/** Figuras del modo pizarra (P2d) -- coordenadas en el mismo espacio 0-100
 *  que slots/x/y, para que el frontend no tenga que manejar dos sistemas.
 *  "type" es opcional (compat con flechas guardadas antes de curva/zona). */
export function validateArrows(arrows: any[]): string[] {
  const errors: string[] = [];
  for (const a of arrows) {
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
    if (a.rot !== undefined && (typeof a.rot !== 'number' || !Number.isFinite(a.rot))) {
      errors.push('rot inválido en una figura: debe ser un número (grados).');
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
