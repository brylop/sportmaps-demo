/**
 * wgerTypes.ts
 * Tipos que describen los datos de ejercicios provenientes del proxy BFF → wger.
 * 
 * Estos tipos deben mantenerse sincronizados con la interfaz WgerExercise
 * definida en bff/src/routes/trainer/wger.ts
 * 
 * Ubicación: src/lib/trainer/wgerTypes.ts
 */

// ── Tipos base ────────────────────────────────────────────────────────────────

export interface WgerMuscle {
  id:       number;   // ID de wger (1=Bíceps, 2=Hombros, 6=Abs, etc.)
  name_en:  string;   // "Biceps", "Chest", "Abs", "Hamstrings"...
  is_front: boolean;  // true = músculo anterior, false = posterior
}

export interface WgerEquipment {
  id:   number;  // 1=Barra, 3=Mancuernas, 4=Máquina, 6=Banda, 7=Peso corporal
  name: string;  // "Barbell", "Dumbbell", "Machine"...
}

export interface WgerExercise {
  wger_id:           number | null;
  free_db_id:        string | null;   // ID en free-exercise-db
  name_es:           string | null;  // nombre en español
  name_en:           string;         // nombre en inglés (siempre disponible)
  description:       string | null;  // instrucciones (instrucciones libres o fallback wger)
  muscles:           WgerMuscle[];   // músculos principales (ordenados por relevancia)
  muscles_secondary: WgerMuscle[];   // músculos secundarios
  equipment:         WgerEquipment[];
  images:            string[];       // URLs absolutas
  category:          string;         // "Arms", "Chest", "Legs", "Abs", "Shoulders"...
  level:             string | null;  // "beginner" | "intermediate" | "expert"
  mechanic:          string | null;  // "compound" | "isolation"
  is_compound:       boolean;        // true si muscles.length >= 3 o mechanic es compound
}

// ── Respuesta del endpoint de búsqueda ───────────────────────────────────────

export interface WgerSearchResponse {
  query:   string;
  results: WgerExercise[];
  cached:  boolean;
  error?:  'timeout' | string;
}

// ── Datos wger que se guardan en un bloque de rutina ─────────────────────────
// Solo guardamos lo necesario para renderizar el demo visual y calcular calorías.
// Las imágenes y descripción se guardan para no depender de wger en tiempo de ejecución.

export interface WgerBlockData {
  wger_id:          number | null;
  free_db_id?:      string | null;
  wger_name_es:     string | null;    // nombre canónico en español de wger
  wger_name_en:     string;           // nombre en inglés
  wger_description: string | null;    // instrucciones de ejecución
  wger_images:      string[];         // URLs de imágenes de demostración
  muscle_ids:       number[];         // IDs de músculos principales (para calorías y stats)
  muscle_names:     string[];         // nombres en inglés de músculos (para display)
  equipment_id:     number | null;    // ID del equipamiento principal
  equipment_name:   string | null;    // nombre del equipamiento
  is_compound:      boolean;          // para el factor de calorías
  level?:           string | null;
  mechanic?:        string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convierte un WgerExercise a los datos que se guardan en el bloque.
 * Se llama cuando el entrenador selecciona un ejercicio del autocompletado.
 */
export function wgerExerciseToBlockData(ex: WgerExercise): WgerBlockData {
  return {
    wger_id:          ex.wger_id,
    free_db_id:       ex.free_db_id,
    wger_name_es:     ex.name_es,
    wger_name_en:     ex.name_en,
    wger_description: ex.description,
    wger_images:      ex.images,
    muscle_ids:       ex.muscles.map((m) => m.id),
    muscle_names:     ex.muscles.map((m) => m.name_en),
    equipment_id:     ex.equipment[0]?.id ?? null,
    equipment_name:   ex.equipment[0]?.name ?? null,
    is_compound:      ex.is_compound,
    level:            ex.level ?? null,
    mechanic:         ex.mechanic ?? null,
  };
}

/**
 * Retorna el nombre para mostrar de un ejercicio.
 * Prioriza español → inglés → fallback genérico.
 */
export function getWgerDisplayName(data: WgerBlockData | null | undefined): string | null {
  if (!data) return null;
  return data.wger_name_es ?? data.wger_name_en ?? null;
}

/**
 * IDs de equipamiento de wger para el cálculo de calorías.
 */
export const WGER_EQUIPMENT_IDS = {
  BARBELL:    1,
  DUMBBELL:   3,
  MACHINE:    4,
  GYM_MAT:    4,   // colchoneta (peso corporal)
  BANDS:      6,   // bandas elásticas
  BODYWEIGHT: 7,
  CABLE:      8,
  KETTLEBELL: 10,
} as const;
