// Tipos del módulo de profesionales de salud (fisioterapia primero).
// Fuente de verdad: supabase/migrations/20261006094145, …094147 y …094149.
// El custodio de la historia es el PROFESIONAL: toda tabla lleva professional_id.

export type ConsentType = 'datos_sensibles' | 'tratamiento' | 'compartir_disponibilidad';
export const REQUIRED_CONSENTS: ConsentType[] = ['datos_sensibles', 'tratamiento'];

export type PatientStatus = 'activo' | 'alta' | 'archivado';
export type DocumentType = 'CC' | 'TI' | 'RC' | 'CE' | 'PA' | 'PPT' | 'NUIP' | 'OTRO';
export type BloodType = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';

export interface ClinicalPatient {
  id: string;
  professional_id: string;
  profile_id: string | null;
  child_id: string | null;
  unregistered_athlete_id: string | null;
  full_name: string;
  document_type: DocumentType | null;
  document_number: string | null;
  birth_date: string | null;
  sex: 'F' | 'M' | 'X' | null;
  phone: string | null;
  email: string | null;
  sport: string | null;
  occupation: string | null;
  eps_name: string | null;
  blood_type: BloodType | null;
  allergies: string | null;
  medical_background: string | null;
  medications: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  guardian_document: string | null;
  guardian_profile_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  status: PatientStatus;
  source: 'manual' | 'marketplace' | 'invitacion';
  created_at: string;
  updated_at: string;
}

/** Campos que el profesional puede escribir (el vínculo con cuentas lo pone una RPC). */
export type ClinicalPatientInput = Partial<Omit<ClinicalPatient,
  'id' | 'professional_id' | 'profile_id' | 'child_id' | 'unregistered_athlete_id' |
  'guardian_profile_id' | 'source' | 'created_at' | 'updated_at'>> & { full_name: string };

export interface ClinicalConsent {
  id: string;
  professional_id: string;
  patient_id: string;
  consent_type: ConsentType;
  version: string;
  text_snapshot: string;
  granted_by_profile_id: string | null;
  granted_by_name: string;
  relationship: 'titular' | 'madre' | 'padre' | 'acudiente' | 'representante_legal';
  channel: 'app' | 'presencial_firma';
  evidence_path: string | null;
  granted_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export interface ConsentText {
  consent_type: ConsentType;
  version: string;
  title: string;
  body: string;
  required: boolean;
}

export type Specialty = 'fisioterapia' | 'nutricion' | 'psicologia' | 'medicina_deportiva';
export type EpisodeStatus = 'abierto' | 'alta' | 'cerrado_sin_alta';

export interface ClinicalEpisode {
  id: string;
  professional_id: string;
  patient_id: string;
  specialty: Specialty;
  reason: string;
  status: EpisodeStatus;
  treatment_goals: string | null;
  planned_sessions: number | null;
  frequency: string | null;
  opened_at: string;
  closed_at: string | null;
  discharge_summary: string | null;
  created_at: string;
  updated_at: string;
}

export type NoteType = 'valoracion_inicial' | 'evolucion' | 'alta' | 'nota_aclaratoria' | 'otro';

/** Valoración estructurada de fisioterapia guardada en clinical_notes.data. */
export interface PhysioAssessmentData {
  anamnesis?: string;
  mechanism?: string;            // mecanismo de lesión
  onset_date?: string;
  pain_location?: string;
  pain_character?: string;       // punzante, quemante, sordo…
  aggravating?: string;
  relieving?: string;
  /** Mapa corporal: regiones marcadas con intensidad EVA 0-10. */
  body_map?: { region: string; side?: 'izquierdo' | 'derecho' | 'bilateral' | 'na'; intensity: number }[];
  /** Goniometría (grados). */
  rom?: { joint: string; movement: string; side?: string; active?: number | null; passive?: number | null; normal?: number | null }[];
  /** Fuerza muscular Daniels 0-5. */
  strength?: { muscle: string; side?: string; grade: number }[];
  special_tests?: { name: string; side?: string; result: 'positivo' | 'negativo' | 'no_concluyente' }[];
  functional_tests?: { name: string; result: string }[];
  posture?: string;
  gait?: string;
  techniques?: string[];         // técnicas aplicadas en la sesión
  home_plan?: string;
}

export interface ClinicalNote {
  id: string;
  professional_id: string;
  patient_id: string;
  episode_id: string;
  appointment_id: string | null;
  note_type: NoteType;
  occurred_at: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  pain_before: number | null;
  pain_after: number | null;
  data: PhysioAssessmentData;
  addendum_of: string | null;
  addendum_reason: string | null;
  author_name: string | null;
  author_license: string | null;
  signed_at: string;
  created_at: string;
}

export type ClinicalNoteInput = Pick<ClinicalNote, 'patient_id' | 'episode_id' | 'note_type'> &
  Partial<Pick<ClinicalNote, 'appointment_id' | 'occurred_at' | 'subjective' | 'objective' | 'assessment' |
    'plan' | 'pain_before' | 'pain_after' | 'data' | 'addendum_of' | 'addendum_reason'>>;

export interface ClinicalDiagnosis {
  id: string;
  professional_id: string;
  patient_id: string;
  episode_id: string;
  cie10_code: string;
  description: string;
  kind: 'principal' | 'relacionado';
  status: 'activo' | 'resuelto' | 'descartado';
  status_changed_at: string | null;
  created_at: string;
}

export interface Cie10Code { code: string; description: string; chapter: string | null }
export const CIE10_PATTERN = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$/;

export interface ClinicalAttachment {
  id: string;
  professional_id: string;
  patient_id: string;
  episode_id: string | null;
  note_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  created_at: string;
}

export type AvailabilityStatus = 'no_disponible' | 'restringido' | 'disponible';
export type RtpStage = 'reposo' | 'rehabilitacion' | 'entrenamiento_modificado' | 'entrenamiento_completo' | 'competencia';

export const BODY_REGIONS = [
  'cabeza', 'cuello', 'hombro', 'brazo', 'codo', 'antebrazo', 'muneca', 'mano', 'torax', 'abdomen',
  'espalda_alta', 'espalda_baja', 'cadera', 'ingle', 'muslo_anterior', 'muslo_posterior', 'rodilla',
  'pierna', 'tobillo', 'pie', 'otra',
] as const;
export type BodyRegion = typeof BODY_REGIONS[number];

export interface AthleteInjury {
  id: string;
  professional_id: string;
  patient_id: string;
  episode_id: string | null;
  body_region: BodyRegion;
  side: 'izquierdo' | 'derecho' | 'bilateral' | 'na';
  injury_type: 'muscular' | 'ligamentosa' | 'tendinosa' | 'osea' | 'articular' | 'contusion' | 'meniscal' | 'neurologica' | 'conmocion' | 'otra';
  mechanism: 'contacto' | 'sin_contacto' | 'sobreuso' | 'desconocido';
  context: 'entrenamiento' | 'partido' | 'fuera_deporte' | 'desconocido';
  severity: 'minima' | 'leve' | 'moderada' | 'grave';
  is_recurrence: boolean;
  description: string | null;
  occurred_on: string;
  status: 'activa' | 'resuelta';
  availability_status: AvailabilityStatus;
  rtp_stage: RtpStage;
  restrictions: string | null;
  expected_return: string | null;
  returned_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseLibraryItem {
  id: string;
  professional_id: string | null;
  name: string;
  description: string | null;
  body_region: string | null;
  category: 'movilidad' | 'fortalecimiento' | 'estiramiento' | 'propiocepcion' | 'cardio' | 'respiracion' | 'otro' | null;
  video_url: string | null;
  is_active: boolean;
}

export interface ExerciseAssignment {
  id: string;
  professional_id: string;
  patient_id: string;
  episode_id: string | null;
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  frequency_per_week: number;
  instructions: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  exercise?: ExerciseLibraryItem;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface WellnessAppointment {
  id: string;
  professional_id: string;
  patient_id: string | null;
  athlete_id: string | null;
  child_id: string | null;
  booked_by: string | null;
  athlete_name: string | null;
  appointment_date: string;      // YYYY-MM-DD (hora Colombia)
  appointment_time: string;      // HH:MM:SS
  duration_minutes: number;
  service_type: string;
  service_listing_id: string | null;
  status: AppointmentStatus;
  notes: string | null;           // internas del profesional
  client_notes: string | null;    // lo que escribió el cliente al reservar
  price: number;
  payment_status: 'not_required' | 'pending' | 'paid' | 'courtesy' | 'refunded';
  is_courtesy: boolean;
  booking_source: 'direct' | 'marketplace' | 'referral' | 'invite';
  modality: 'presencial' | 'virtual' | 'domicilio';
  location: string | null;
  meeting_url: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  is_demo: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityBlock {
  id: string;
  vendor_profile_id: string;
  day_of_week: number;           // 0 = domingo
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_time_minutes: number;
  max_concurrent: number;
  is_active: boolean;
}

export interface AvailabilityException {
  id: string;
  vendor_profile_id: string;
  exception_date: string;
  start_time: string | null;     // null = día completo
  end_time: string | null;
  reason: string | null;
}

/** get_my_health_summary(): lo que ve el paciente o el acudiente. */
export interface HealthSummaryPatient {
  patient_id: string;
  patient_name: string;
  child_id: string | null;
  is_self: boolean | null;
  professional: { id: string; name: string | null; practice: string | null; specialty: string | null; phone: string | null; avatar_url: string | null };
  consents: { id: string; type: ConsentType; version: string; granted_at: string; granted_by: string }[];
  pending_consents: (ConsentText & { type: ConsentType })[];
  episodes: (Pick<ClinicalEpisode, 'id' | 'specialty' | 'reason' | 'status' | 'treatment_goals' | 'planned_sessions' |
    'frequency' | 'opened_at' | 'closed_at' | 'discharge_summary'> & { sessions_done: number })[];
  injuries: Pick<AthleteInjury, 'id' | 'body_region' | 'side' | 'status' | 'availability_status' | 'rtp_stage' |
    'restrictions' | 'expected_return' | 'occurred_on' | 'returned_on'>[];
  exercises: {
    assignment_id: string; name: string; description: string | null; video_url: string | null;
    sets: number | null; reps: number | null; hold_seconds: number | null; frequency_per_week: number;
    instructions: string | null; start_date: string; end_date: string | null; done_dates: string[];
  }[];
  upcoming_appointments: {
    id: string; date: string; time: string; duration_minutes: number; service_type: string;
    status: AppointmentStatus; modality: string; location: string | null; meeting_url: string | null;
  }[];
}

/** get_school_athlete_availability(): lo único que ven coach y escuela. */
export interface SchoolAthleteAvailability {
  child_id: string | null;
  profile_id: string | null;
  athlete_name: string;
  availability_status: AvailabilityStatus;
  rtp_stage: RtpStage;
  restrictions: string | null;
  expected_return: string | null;
  body_region: BodyRegion;
  updated_at: string;
  professional_name: string | null;
}

export interface ClinicalInviteInfo {
  ok: boolean;
  error?: 'INVITACION_NO_ENCONTRADA' | 'INVITACION_USADA' | 'INVITACION_VENCIDA';
  professional_name?: string;
  practice_name?: string | null;
  specialty?: string | null;
  patient_first_name?: string;
  expires_at?: string;
  consents?: (ConsentText & { type: ConsentType })[];
}
