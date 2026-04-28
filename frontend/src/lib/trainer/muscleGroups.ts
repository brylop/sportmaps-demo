/**
 * muscleGroups.ts
 * Clasificación de ejercicios por grupo muscular y categoría.
 * 
 * Cubre: peso libre, máquinas, bandas elásticas, peso corporal,
 * cardio, HIIT, flexibilidad, yoga, funcional, rehabilitación y más.
 * 
 * Ubicación: src/lib/trainer/muscleGroups.ts
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type MuscleGroup =
  | 'Pecho'
  | 'Espalda'
  | 'Hombros'
  | 'Bíceps'
  | 'Tríceps'
  | 'Piernas'
  | 'Glúteos'
  | 'Core'
  | 'Cardio'
  | 'HIIT'
  | 'Flexibilidad'
  | 'Funcional'
  | 'Calentamiento'
  | 'Otros';

export type BlockCategory =
  | 'strength'
  | 'cardio'
  | 'hiit'
  | 'flexibility'
  | 'warmup'
  | 'cooldown'
  | 'functional';

export interface MuscleGroupConfig {
  label:    MuscleGroup;
  emoji:    string;
  color:    string;         // Tailwind text color
  bg:       string;         // Tailwind bg color
  border:   string;         // Tailwind border color
  unit:     string;         // Unidad principal del grupo
  order:    number;         // Orden de visualización
}

// ── Config visual por grupo muscular ─────────────────────────────────────────

export const MUSCLE_GROUP_CONFIG: Record<MuscleGroup, MuscleGroupConfig> = {
  Pecho:         { label: 'Pecho',         emoji: '💪', color: 'text-red-500',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     unit: 'kg',  order: 1  },
  Espalda:       { label: 'Espalda',       emoji: '🏋️', color: 'text-blue-600',   bg: 'bg-blue-600/10',   border: 'border-blue-600/20',   unit: 'kg',  order: 2  },
  Hombros:       { label: 'Hombros',       emoji: '🔱', color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20', unit: 'kg',  order: 3  },
  Bíceps:        { label: 'Bíceps',        emoji: '💪', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', unit: 'kg',  order: 4  },
  Tríceps:       { label: 'Tríceps',       emoji: '💪', color: 'text-amber-500',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  unit: 'kg',  order: 5  },
  Piernas:       { label: 'Piernas',       emoji: '🦵', color: 'text-green-600',  bg: 'bg-green-600/10',  border: 'border-green-600/20',  unit: 'kg',  order: 6  },
  Glúteos:       { label: 'Glúteos',       emoji: '🍑', color: 'text-pink-500',   bg: 'bg-pink-500/10',   border: 'border-pink-500/20',   unit: 'kg',  order: 7  },
  Core:          { label: 'Core',          emoji: '⚡', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', unit: 'rep', order: 8  },
  Cardio:        { label: 'Cardio',        emoji: '❤️', color: 'text-blue-500',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   unit: 'min', order: 9  },
  HIIT:          { label: 'HIIT',          emoji: '🔥', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', unit: 'rpe', order: 10 },
  Flexibilidad:  { label: 'Flexibilidad',  emoji: '🧘', color: 'text-teal-500',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20',   unit: 'min', order: 11 },
  Funcional:     { label: 'Funcional',     emoji: '🎯', color: 'text-cyan-500',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   unit: 'kg',  order: 12 },
  Calentamiento: { label: 'Calentamiento', emoji: '🌡️', color: 'text-rose-400',   bg: 'bg-rose-400/10',   border: 'border-rose-400/20',   unit: 'min', order: 13 },
  Otros:         { label: 'Otros',         emoji: '📦', color: 'text-slate-500',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  unit: '-',   order: 14 },
};

// ── Mapa de palabras clave → grupo muscular ───────────────────────────────────
// Cada entrada es un array de substrings que, si aparecen en el nombre del
// ejercicio (normalizado a lowercase sin tildes), lo asignan al grupo.

export const MUSCLE_KEYWORD_MAP: Array<{ keywords: string[]; group: MuscleGroup }> = [

  // ══ PECHO ══════════════════════════════════════════════════════════════════
  {
    group: 'Pecho',
    keywords: [
      'press banca', 'press de banca', 'bench press', 'banca plana',
      'press inclinado', 'incline press', 'press declinado', 'decline press',
      'peck dec', 'pec deck', 'pec-deck', 'aperturas', 'flyes', 'fly pecho',
      'cruce de poleas pecho', 'cable crossover', 'press con mancuernas',
      'dips pecho', 'fondos pecho', 'push up', 'flexion de pecho',
      'lagartija', 'flexiones', 'press suizo', 'svend press',
      'press con banda pecho', 'aperturas con banda',
    ],
  },

  // ══ ESPALDA ════════════════════════════════════════════════════════════════
  {
    group: 'Espalda',
    keywords: [
      'dominadas', 'pull up', 'chin up', 'jalon', 'jalón', 'lat pulldown',
      'pull down', 'remo', 'row', 'remo con barra', 'remo con mancuerna',
      'remo en polea', 'remo en maquina', 'seated row', 'cable row',
      'peso muerto', 'deadlift', 'peso muerto rumano', 'rdl',
      'peso muerto sumo', 'sumo deadlift', 'good morning',
      'hiperextension', 'hyperextension', 'superman', 'face pull',
      'pull over', 'pullover', 'encogimiento de hombros trapecio',
      't-bar row', 'pendlay row', 'meadows row',
      'remo con banda', 'pull apart', 'band pull',
      'espalda', 'back', 'dorsal',
    ],
  },

  // ══ HOMBROS ════════════════════════════════════════════════════════════════
  {
    group: 'Hombros',
    keywords: [
      'press militar', 'overhead press', 'ohp', 'press arnold',
      'press con mancuernas hombro', 'press hombro', 'shoulder press',
      'elevaciones laterales', 'lateral raise', 'elevacion lateral',
      'elevaciones frontales', 'front raise', 'elevacion frontal',
      'pajarito', 'rear delt fly', 'deltoides posterior', 'face pull hombro',
      'upright row', 'remo al menton', 'encogimiento', 'shrug', 'trapecio',
      'press en maquina hombro', 'hombros con banda', 'band lateral raise',
      'hombro', 'deltoides', 'shoulder',
    ],
  },

  // ══ BÍCEPS ═════════════════════════════════════════════════════════════════
  {
    group: 'Bíceps',
    keywords: [
      'curl biceps', 'curl de biceps', 'bicep curl', 'biceps curl',
      'curl con barra', 'barbell curl', 'curl con mancuernas',
      'curl martillo', 'hammer curl', 'curl predicador', 'preacher curl',
      'curl concentrado', 'concentration curl', 'curl en polea',
      'curl con banda', 'resistance band curl', 'curl inclinado',
      'zottman curl', 'spider curl', 'curl 21',
      'biceps', 'bicep',
    ],
  },

  // ══ TRÍCEPS ════════════════════════════════════════════════════════════════
  {
    group: 'Tríceps',
    keywords: [
      'extension de triceps', 'triceps extension', 'extensión de tríceps',
      'exntesion de triceps', 'skull crusher', 'rompe cabezas',
      'press frances', 'french press', 'fondos triceps', 'dips triceps',
      'patada de triceps', 'kickback', 'triceps kickback',
      'pushdown', 'push down', 'jalón en polea triceps',
      'extension en polea', 'cable extension', 'overhead extension',
      'extension con banda', 'band extension', 'close grip bench',
      'press agarre cerrado', 'jm press',
      'triceps', 'tríceps',
    ],
  },

  // ══ PIERNAS ════════════════════════════════════════════════════════════════
  {
    group: 'Piernas',
    keywords: [
      'sentadilla', 'squat', 'sentadilla con barra', 'barbell squat',
      'sentadilla goblet', 'goblet squat', 'sentadilla sumo',
      'sentadilla bulgara', 'bulgarian squat', 'split squat',
      'sentadilla hack', 'hack squat', 'sentadilla frontal', 'front squat',
      'prensa', 'leg press', 'prensa de pierna',
      'extensiones de cuadriceps', 'leg extension', 'extension de cuadriceps',
      'femoral', 'curl femoral', 'leg curl', 'hamstring curl',
      'peso muerto piernas', 'nordic curl', 'good morning pierna',
      'zancada', 'lunge', 'estocada', 'reverse lunge', 'walking lunge',
      'step up', 'caja', 'box step',
      'calf raise', 'elevacion de talones', 'pantorrilla',
      'sissy squat', 'wall sit', 'sentadilla isometrica',
      'piernas con banda', 'monster walk',
      'cuadriceps', 'cuadricep', 'quads', 'hamstring',
    ],
  },

  // ══ GLÚTEOS ════════════════════════════════════════════════════════════════
  {
    group: 'Glúteos',
    keywords: [
      'hip thrust', 'glute bridge', 'puente de gluteos', 'puente gluteo',
      'patada de gluteo', 'donkey kick', 'kickback gluteo',
      'abduccion de cadera', 'hip abduction', 'aduccion de cadera',
      'fire hydrant', 'clamshell', 'almeja',
      'peso muerto gluteos', 'rdl gluteos',
      'sentadilla gluteos', 'squat gluteo',
      'gluteos con banda', 'resistance band glutes',
      'sumo gluteo', 'cable kickback',
      'gluteos', 'gluteo', 'glutes', 'glute',
    ],
  },

  // ══ CORE ═══════════════════════════════════════════════════════════════════
  {
    group: 'Core',
    keywords: [
      'plancha', 'plank', 'side plank', 'plancha lateral',
      'abdominales', 'crunch', 'sit up', 'situp',
      'crunch bicicleta', 'bicycle crunch', 'mountain climber',
      'elevacion de piernas', 'leg raise', 'hanging leg raise',
      'dragon flag', 'ab wheel', 'rueda abdominal',
      'russian twist', 'giro ruso', 'woodchop', 'leñador',
      'dead bug', 'pallof press', 'hollow body',
      'hiperextension core', 'vacuums', 'stomach vacuum',
      'core con banda', 'cable crunch', 'crunch en polea',
      'oblicuos', 'oblique', 'lumbares', 'lumbar',
      'core', 'abdomen', 'abdominal',
    ],
  },

  // ══ CARDIO ═════════════════════════════════════════════════════════════════
  {
    group: 'Cardio',
    keywords: [
      'cardio', 'trotar', 'trotando', 'correr', 'running', 'carrera',
      'caminata', 'caminar', 'walking', 'marcha',
      'bicicleta', 'cycling', 'ciclismo', 'spinning',
      'eliptica', 'elliptical', 'escaladora', 'stair master',
      'remo cardio', 'rowing machine', 'ergometro',
      'cuerda', 'saltar la cuerda', 'jump rope', 'salto de cuerda',
      'natacion', 'swimming', 'nado',
      'aerobico', 'aerobic', 'aeróbico',
      'zumba', 'baile', 'dance',
      'futbol', 'basketball', 'deporte',
    ],
  },

  // ══ HIIT ═══════════════════════════════════════════════════════════════════
  {
    group: 'HIIT',
    keywords: [
      'hiit', 'hit', 'tabata', 'circuito', 'circuit',
      'burpee', 'burpees',
      'jumping jack', 'saltos', 'jump squat', 'squat jump',
      'box jump', 'salto al cajón', 'broad jump',
      'sprint', 'velocidad', 'interval',
      'battle rope', 'cuerdas rusas',
      'thruster', 'clean', 'snatch',
      'crossfit', 'wod', 'amrap', 'emom',
      'kettlebell swing', 'swing con pesa',
    ],
  },

  // ══ FLEXIBILIDAD ═══════════════════════════════════════════════════════════
  {
    group: 'Flexibilidad',
    keywords: [
      'flexibilidad', 'flexibility', 'estiramiento', 'stretch', 'stretching',
      'yoga', 'pilates',
      'foam roller', 'rodillo', 'liberacion miofascial',
      'movilidad', 'mobility', 'movimiento articular',
      'pigeon pose', 'paloma', 'hip flexor stretch',
      'isquiotibiales estiramiento', 'hamstring stretch',
      'hip opener', 'abridor de cadera',
      'thoracic rotation', 'rotacion toracica',
      'world greatest stretch',
    ],
  },

  // ══ FUNCIONAL ══════════════════════════════════════════════════════════════
  {
    group: 'Funcional',
    keywords: [
      'funcional', 'functional',
      'tgu', 'turkish get up', 'levantamiento turco',
      'farmer walk', 'cargada del granjero', 'carry',
      'tire flip', 'giro de llanta',
      'sled push', 'sled pull', 'trineo',
      'sandbag', 'bolsa de arena',
      'medicine ball', 'balon medicinal', 'slam',
      'bosu', 'balance',
      'suspension trx', 'trx',
      'pliometrico', 'plyometric',
      'agilidad', 'agility', 'escalera de agilidad',
    ],
  },

  // ══ CALENTAMIENTO ══════════════════════════════════════════════════════════
  {
    group: 'Calentamiento',
    keywords: [
      'calentamiento', 'warm up', 'warmup', 'entrada en calor',
      'movilidad articular', 'articulaciones',
      'activacion', 'activation',
      'vuelta calma', 'cooldown', 'cool down', 'enfriamiento', 'calma',
      'respiracion', 'breathing',
    ],
  },
];

// ── Función principal de clasificación ───────────────────────────────────────

/**
 * Normaliza un string: minúsculas, sin tildes, sin caracteres especiales.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ')     // reemplazar especiales por espacio
    .replace(/\s+/g, ' ')             // colapsar espacios
    .trim();
}

/**
 * Dado un stat_type (ej: 'fuerza_press_banca') o un nombre de ejercicio,
 * retorna el MuscleGroup correspondiente.
 */
export function getMuscleGroup(input: string): MuscleGroup {
  if (!input) return 'Otros';

  // Quitar prefijo de stat_type si viene con él
  const cleaned = input
    .replace(/^(fuerza_|cardio_|hiit_|flexibilidad_|calentamiento_|rpe_fuerza_|rpe_hiit_)/, '')
    .replace(/_/g, ' ');

  const normalized = normalize(cleaned);

  // Buscar coincidencia en el mapa de keywords
  for (const { keywords, group } of MUSCLE_KEYWORD_MAP) {
    for (const keyword of keywords) {
      if (normalized.includes(normalize(keyword))) {
        return group;
      }
    }
  }

  // Fallback por tipo de stat (si el prefijo está disponible)
  if (input.startsWith('cardio_'))        return 'Cardio';
  if (input.startsWith('hiit_'))          return 'HIIT';
  if (input.startsWith('flexibilidad_'))  return 'Flexibilidad';
  if (input.startsWith('calentamiento_')) return 'Calentamiento';

  return 'Otros';
}

/**
 * Agrupa un array de PRs por grupo muscular.
 * Retorna un Map ordenado según MUSCLE_GROUP_CONFIG.order.
 */
export function groupPRsByMuscle<T extends { stat_type: string }>(
  prs: T[]
): Map<MuscleGroup, T[]> {
  const grouped = new Map<MuscleGroup, T[]>();

  for (const pr of prs) {
    const group = getMuscleGroup(pr.stat_type);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(pr);
  }

  // Ordenar el Map según el order del config
  return new Map(
    [...grouped.entries()].sort(
      ([a], [b]) => MUSCLE_GROUP_CONFIG[a].order - MUSCLE_GROUP_CONFIG[b].order
    )
  );
}

/**
 * Retorna el nombre para mostrar de un stat_type.
 * Ej: 'fuerza_press_banca' → 'Press Banca'
 */
export function getDisplayName(statType: string): string {
  const cleaned = statType
    .replace(/^(fuerza_|cardio_|hiit_|flexibilidad_|calentamiento_|rpe_fuerza_|rpe_hiit_)/, '')
    .replace(/_/g, ' ');

  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}
