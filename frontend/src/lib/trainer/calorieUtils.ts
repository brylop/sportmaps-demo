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
  type: string;
  duration_minutes?: number;
  sets?: number;
  reps?: string | number;
  difficulty?: string;
  weight_kg?: number;
}

/**
 * Calcula el gasto calórico estimado para un ejercicio.
 */
export function calculateExerciseCalories(params: CalorieParams): number {
  const { 
    type, 
    duration_minutes = 0, 
    sets = 0, 
    reps = 0, 
    difficulty = 'intermedio', 
    weight_kg = 75 
  } = params;

  const met = MET_VALUES[type.toLowerCase()] || 4.0;
  const diffMult = DIFFICULTY_MULTIPLIERS[difficulty.toLowerCase()] || 1.0;
  
  let calories = 0;

  // Fórmula base: (MET * 3.5 * Peso / 200) * Duración
  // Si no hay duración definida (ej: en fuerza), estimamos 1 minuto por cada set de 10-12 reps
  let effectiveMinutes = duration_minutes;
  if (!effectiveMinutes && type === 'strength' && sets > 0) {
    effectiveMinutes = sets * 1.5; // Estimación de 1.5 min por set incluyendo descanso activo
  }

  calories = (met * diffMult * 3.5 * weight_kg / 200) * (effectiveMinutes || 0);

  // Bono por volumen mecánico en fuerza (0.15 kcal por rep)
  if (type === 'strength') {
    const totalReps = sets * (parseInt(reps.toString()) || 0);
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
