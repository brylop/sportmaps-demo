// Etiquetas en español para los valores del módulo clínico. Un solo lugar para
// que pantalla del profesional, del acudiente y del coach digan lo mismo.
import type {
  AppointmentStatus, AvailabilityStatus, BodyRegion, ConsentType, EpisodeStatus, NoteType, RtpStage, Specialty,
} from './types';

export const CONSENT_LABEL: Record<ConsentType, string> = {
  datos_sensibles: 'Tratamiento de datos de salud',
  tratamiento: 'Consentimiento informado de tratamiento',
  compartir_disponibilidad: 'Compartir disponibilidad con la escuela',
};

export const SPECIALTY_LABEL: Record<Specialty, string> = {
  fisioterapia: 'Fisioterapia',
  nutricion: 'Nutrición',
  psicologia: 'Psicología',
  medicina_deportiva: 'Medicina deportiva',
};

export const EPISODE_STATUS_LABEL: Record<EpisodeStatus, string> = {
  abierto: 'En tratamiento',
  alta: 'Alta',
  cerrado_sin_alta: 'Cerrado sin alta',
};

export const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  valoracion_inicial: 'Valoración inicial',
  evolucion: 'Evolución',
  alta: 'Alta',
  nota_aclaratoria: 'Nota aclaratoria',
  otro: 'Otra nota',
};

export const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  no_disponible: 'No disponible',
  restringido: 'Restringido',
  disponible: 'Disponible',
};

/** Clases de Tailwind por estado (badge). */
export const AVAILABILITY_TONE: Record<AvailabilityStatus, string> = {
  no_disponible: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
  restringido: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
  disponible: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
};

export const RTP_STAGE_LABEL: Record<RtpStage, string> = {
  reposo: 'Reposo',
  rehabilitacion: 'Rehabilitación',
  entrenamiento_modificado: 'Entrenamiento modificado',
  entrenamiento_completo: 'Entrenamiento completo',
  competencia: 'Apto para competir',
};
export const RTP_STAGES: RtpStage[] = ['reposo', 'rehabilitacion', 'entrenamiento_modificado', 'entrenamiento_completo', 'competencia'];

export const BODY_REGION_LABEL: Record<BodyRegion, string> = {
  cabeza: 'Cabeza', cuello: 'Cuello', hombro: 'Hombro', brazo: 'Brazo', codo: 'Codo', antebrazo: 'Antebrazo',
  muneca: 'Muñeca', mano: 'Mano', torax: 'Tórax', abdomen: 'Abdomen', espalda_alta: 'Espalda alta',
  espalda_baja: 'Espalda baja', cadera: 'Cadera', ingle: 'Ingle', muslo_anterior: 'Muslo anterior',
  muslo_posterior: 'Muslo posterior', rodilla: 'Rodilla', pierna: 'Pierna', tobillo: 'Tobillo', pie: 'Pie', otra: 'Otra',
};

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Por confirmar',
  confirmed: 'Confirmada',
  completed: 'Realizada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
  no_show: 'bg-slate-100 text-slate-500 border-slate-200',
};

/** Traduce los códigos que lanzan las RPC y los triggers a un mensaje humano. */
const ERRORES: Record<string, string> = {
  CONSENTIMIENTO_REQUERIDO: 'Falta el consentimiento del paciente (o de su acudiente) para datos de salud y tratamiento.',
  PACIENTE_DE_OTRO_PROFESIONAL: 'Ese paciente no está en tu lista.',
  PACIENTE_NO_ENCONTRADO: 'No encontramos ese paciente.',
  PACIENTE_YA_VINCULADO: 'Ese paciente ya está vinculado con este profesional.',
  VINCULO_SOLO_POR_INVITACION: 'La cuenta del paciente se vincula solo con una invitación.',
  HISTORIA_CLINICA_INMUTABLE: 'Las notas firmadas no se editan ni se borran. Agrega una nota aclaratoria.',
  EPISODIO_CERRADO: 'El episodio está cerrado. Abre uno nuevo o agrega una nota aclaratoria.',
  RESUMEN_DE_ALTA_REQUERIDO: 'Escribe el resumen de alta (mínimo 10 caracteres).',
  HORARIO_OCUPADO: 'Ese horario ya está ocupado.',
  HORARIO_NO_DISPONIBLE: 'Ese horario ya no está disponible. Elige otro.',
  SERVICIO_NO_DISPONIBLE: 'Este servicio no está disponible para reservar.',
  NO_PUEDES_RESERVARTE: 'No puedes reservar tu propio servicio.',
  MENOR_NO_ENCONTRADO: 'No encontramos a ese menor en tu cuenta.',
  CITA_NO_CANCELABLE: 'Esta cita ya no se puede cancelar.',
  CITA_YA_PASO: 'La cita ya pasó.',
  CITA_NO_ENCONTRADA: 'No encontramos la cita.',
  INVITACION_INVALIDA: 'La invitación no es válida, ya se usó o venció.',
  INVITACION_NO_ENCONTRADA: 'No encontramos la invitación.',
  INVITACION_USADA: 'Esta invitación ya se usó.',
  INVITACION_VENCIDA: 'La invitación venció. Pídele al profesional una nueva.',
  INVITACION_PROPIA: 'No puedes aceptar tu propia invitación.',
  CONSENTIMIENTOS_REQUERIDOS: 'Debes aceptar el tratamiento de datos y el consentimiento informado.',
  FIRMANTE_REQUERIDO: 'Escribe el nombre de quien firmó.',
  FECHA_FUTURA: 'La fecha de la nota no puede ser futura.',
  FECHA_INVALIDA: 'Fecha no válida.',
  EJERCICIO_NO_ENCONTRADO: 'No encontramos ese ejercicio.',
  EJERCICIO_INVALIDO: 'Ese ejercicio no está en tu biblioteca.',
  EPISODIO_INVALIDO: 'El episodio no corresponde a este paciente.',
  EPISODIO_INMUTABLE: 'No se puede cambiar el paciente ni la fecha de apertura del episodio.',
  NOTA_ORIGINAL_INVALIDA: 'La nota que intentas aclarar no pertenece a este episodio.',
  CITA_INVALIDA: 'La cita no pertenece a tu agenda.',
  EVIDENCIA_INVALIDA: 'El documento firmado debe estar en tu carpeta.',
  CONSENTIMIENTO_NO_ENCONTRADO: 'No encontramos ese consentimiento o ya fue revocado.',
  CONSENTIMIENTO_INVALIDO: 'Tipo de consentimiento no válido.',
  CONSENTIMIENTO_INMUTABLE: 'Los consentimientos no se editan ni se borran; se revocan.',
  LESION_INMUTABLE: 'No se puede cambiar el profesional de la lesión.',
  ACCION_INVALIDA: 'Acción no válida.',
  NO_AUTENTICADO: 'Inicia sesión para continuar.',
};

export function clinicalErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err
    ? String((err as { message: unknown }).message) : String(err ?? '');
  const code = Object.keys(ERRORES).find((k) => raw.includes(k));
  return code ? ERRORES[code] : raw || 'Ocurrió un error. Intenta de nuevo.';
}

export function ageFrom(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}
