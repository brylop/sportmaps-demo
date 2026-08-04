export const MET_VALUES: Record<string, number> = {
  warmup: 3.5,
  strength: 5.5,
  cardio: 8.5,
  hiit: 11.0,
  flexibility: 2.5,
  cooldown: 2.0,
  funcional: 6.5,
  yoga: 3.0,
  otro: 4.0
};

export const DIFFICULTY_MULTIPLIERS: Record<string, number> = {
  principiante: 0.8,
  intermedio: 1.0,
  avanzado: 1.25,
  elite: 1.5
};

export interface CalorieParams {
  type:              string;
  duration_minutes?: number;
  sets?:             number;
  reps?:             string | number;
  difficulty?:       string;
  weight_kg?:        number;
  // ✅ Nuevos campos opcionales de wger — si no vienen, se usa el comportamiento actual
  muscle_count?:     number;   // número de músculos principales del ejercicio
  is_compound?:      boolean;  // true para movimientos multi-articulares
  equipment_id?:     number;   // ID de equipamiento de wger
}

/**
 * Calcula el gasto calórico estimado para un ejercicio.
 */
export function calculateExerciseCalories(params: CalorieParams): number {
  const {
    type,
    duration_minutes = 0,
    sets             = 0,
    reps             = 0,
    difficulty       = 'intermedio',
    weight_kg        = 75,
    muscle_count     = 1,
    is_compound      = false,
    equipment_id,
  } = params;

  let met      = MET_VALUES[type.toLowerCase()] ?? 4.0;
  const diffMult = DIFFICULTY_MULTIPLIERS[difficulty.toLowerCase()] ?? 1.0;

  // ── Factor de complejidad muscular (solo fuerza) ──────────────────────────
  // Cuantos más músculos activa el ejercicio, mayor gasto calórico real.
  // Fuente: investigación de METs por número de grupos musculares activados.
  if (type === 'strength' || type === 'funcional') {
    if (is_compound && muscle_count >= 3) {
      met *= 1.35;  // compound pesado: sentadilla, peso muerto, press banca → +35%
    } else if (muscle_count >= 2) {
      met *= 1.15;  // semi-compound: fondos, remo, pulldown → +15%
    }
    // isolation (curl, extensión): sin modificación
  }

  // ── Factor de equipamiento ────────────────────────────────────────────────
  // La barra exige mayor estabilización muscular → más calorías.
  // La máquina guía el movimiento → menos activación total.
  const equipmentFactor: Record<number, number> = {
    1:  1.10,  // Barbell — mayor demanda de estabilización
    3:  1.05,  // Dumbbell — algo de estabilización unilateral
    10: 1.05,  // Kettlebell
    6:  0.90,  // Resistance band
    4:  0.88,  // Machine — movimiento guiado
    7:  1.00,  // Bodyweight
    8:  0.95,  // Cable
  };

  if (equipment_id && equipmentFactor[equipment_id] !== undefined) {
    met *= equipmentFactor[equipment_id];
  }

  // ── Duración efectiva ──────────────────────────────────────────────────────
  let effectiveMinutes = duration_minutes;
  if (!effectiveMinutes && type === 'strength' && sets > 0) {
    effectiveMinutes = sets * 1.5;  // ~1.5 min por set incluyendo descanso activo
  }

  // ── Calorías base: MET × dificultad × peso × horas ───────────────────────
  let calories = (met * diffMult * 3.5 * weight_kg / 200) * (effectiveMinutes || 0);

  // Bono por volumen mecánico en fuerza (0.15 kcal por rep)
  if (type === 'strength') {
    const totalReps = sets * (parseInt(String(reps)) || 0);
    calories += totalReps * 0.15;
  }

  return Math.round(calories);
}

/**
 * Convierte de Lb a Kg
 */
export function lbToKg(lb: number): number {
  return lb * 0.453592;
}

/**
 * Convierte de Kg a Lb
 */
export function kgToLb(kg: number): number {
  return kg / 0.453592;
}
