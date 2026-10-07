// Acceso a datos del módulo clínico. Las tablas nuevas todavía no están en
// integrations/supabase/types.ts, así que se consulta con un cliente sin tipar
// y se tipa a mano con lib/clinical/types.ts.
//
// Reglas que impone la base (no las reimplementes en el front):
//  · Todo lo clínico se filtra por professional_id = auth.uid() vía RLS.
//  · Notas firmadas: sin UPDATE ni DELETE. Correcciones = nota_aclaratoria.
//  · Sin consentimiento (datos_sensibles + tratamiento) no se abre episodio,
//    ni se escribe nota, diagnóstico, lesión o ejercicio.
//  · El vínculo paciente ↔ cuenta (adulto/menor) solo lo ponen las RPC.
import { supabase } from '@/integrations/supabase/client';
import type {
  AthleteInjury, AvailabilityBlock, AvailabilityException, ClinicalAttachment, ClinicalConsent,
  ClinicalDiagnosis, ClinicalEpisode, ClinicalInviteInfo, ClinicalNote, ClinicalNoteInput, ClinicalPatient,
  ClinicalPatientInput, Cie10Code, ConsentText, ConsentType, ExerciseAssignment, ExerciseLibraryItem,
  HealthSummaryPatient, SchoolAthleteAvailability, WellnessAppointment,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('No autenticado');
  return data.user.id;
}

function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

// ── Pacientes ────────────────────────────────────────────────────────────────
export async function listPatients(): Promise<ClinicalPatient[]> {
  return must(await db.from('clinical_patients').select('*').order('full_name'));
}

export async function getPatient(id: string): Promise<ClinicalPatient> {
  return must(await db.from('clinical_patients').select('*').eq('id', id).single());
}

export async function createPatient(input: ClinicalPatientInput): Promise<ClinicalPatient> {
  const professional_id = await uid();
  return must(await db.from('clinical_patients').insert({ ...input, professional_id }).select('*').single());
}

export async function updatePatient(id: string, patch: Partial<ClinicalPatientInput>): Promise<ClinicalPatient> {
  return must(await db.from('clinical_patients').update(patch).eq('id', id).select('*').single());
}

export async function logClinicalAccess(patientId: string, action: 'ver_historia' | 'imprimir_historia' | 'ver_adjunto') {
  await db.rpc('log_clinical_access', { p_patient_id: patientId, p_action: action });
}

// ── Consentimientos ──────────────────────────────────────────────────────────
export async function listConsents(patientId: string): Promise<ClinicalConsent[]> {
  return must(await db.from('clinical_consents').select('*').eq('patient_id', patientId).order('granted_at', { ascending: false }));
}

export async function listCurrentConsentTexts(): Promise<ConsentText[]> {
  return must(await db.from('clinical_consent_texts').select('consent_type, version, title, body, required')
    .eq('is_current', true).order('required', { ascending: false }));
}

export async function recordPresencialConsent(args: {
  patientId: string; types: ConsentType[]; signedByName: string;
  relationship: ClinicalConsent['relationship']; evidencePath?: string | null;
}): Promise<number> {
  return must(await db.rpc('record_clinical_consent_presencial', {
    p_patient_id: args.patientId, p_types: args.types, p_signed_by_name: args.signedByName,
    p_relationship: args.relationship, p_evidence_path: args.evidencePath ?? null,
  }));
}

/** Paciente / acudiente desde la app. */
export async function grantConsents(patientId: string, types: ConsentType[]): Promise<number> {
  return must(await db.rpc('grant_clinical_consents', { p_patient_id: patientId, p_types: types }));
}

export async function revokeConsent(consentId: string, reason?: string) {
  must(await db.rpc('revoke_clinical_consent', { p_consent_id: consentId, p_reason: reason ?? null }));
}

// ── Invitaciones ─────────────────────────────────────────────────────────────
export async function createInvite(patientId: string): Promise<{ token: string; expires_at: string }> {
  return must(await db.rpc('create_clinical_invite', { p_patient_id: patientId }));
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}/salud/invitacion/${token}`;
}

export async function getInvite(token: string): Promise<ClinicalInviteInfo> {
  return must(await db.rpc('get_clinical_invite', { p_token: token }));
}

export async function acceptInvite(token: string, childId: string | null, types: ConsentType[]): Promise<string> {
  return must(await db.rpc('accept_clinical_invite', { p_token: token, p_child_id: childId, p_types: types }));
}

// ── Historia clínica ─────────────────────────────────────────────────────────
export async function listEpisodes(patientId: string): Promise<ClinicalEpisode[]> {
  return must(await db.from('clinical_episodes').select('*').eq('patient_id', patientId).order('opened_at', { ascending: false }));
}

/** Episodios abiertos de todos los pacientes (seguimientos). */
export async function listOpenEpisodes(): Promise<(ClinicalEpisode & { patient: Pick<ClinicalPatient, 'id' | 'full_name'> })[]> {
  return must(await db.from('clinical_episodes')
    .select('*, patient:clinical_patients!clinical_episodes_patient_id_fkey(id, full_name)')
    .eq('status', 'abierto').order('opened_at', { ascending: false }));
}

export async function createEpisode(input: Pick<ClinicalEpisode, 'patient_id' | 'reason'> &
  Partial<Pick<ClinicalEpisode, 'specialty' | 'treatment_goals' | 'planned_sessions' | 'frequency'>>): Promise<ClinicalEpisode> {
  const professional_id = await uid();
  return must(await db.from('clinical_episodes').insert({ ...input, professional_id }).select('*').single());
}

export async function updateEpisode(id: string, patch: Partial<Pick<ClinicalEpisode,
  'treatment_goals' | 'planned_sessions' | 'frequency' | 'status' | 'discharge_summary' | 'reason'>>): Promise<ClinicalEpisode> {
  return must(await db.from('clinical_episodes').update(patch).eq('id', id).select('*').single());
}

export async function listNotes(patientId: string): Promise<ClinicalNote[]> {
  return must(await db.from('clinical_notes').select('*').eq('patient_id', patientId).order('occurred_at', { ascending: true }));
}

export async function createNote(input: ClinicalNoteInput): Promise<ClinicalNote> {
  const professional_id = await uid();
  return must(await db.from('clinical_notes').insert({ ...input, professional_id, data: input.data ?? {} }).select('*').single());
}

export async function listDiagnoses(patientId: string): Promise<ClinicalDiagnosis[]> {
  return must(await db.from('clinical_diagnoses').select('*').eq('patient_id', patientId).order('created_at'));
}

export async function createDiagnosis(input: Pick<ClinicalDiagnosis, 'patient_id' | 'episode_id' | 'cie10_code' | 'description' | 'kind'>): Promise<ClinicalDiagnosis> {
  const professional_id = await uid();
  return must(await db.from('clinical_diagnoses').insert({ ...input, professional_id }).select('*').single());
}

export async function setDiagnosisStatus(id: string, status: ClinicalDiagnosis['status']) {
  must(await db.from('clinical_diagnoses').update({ status }).eq('id', id));
}

export async function searchCie10(q: string): Promise<Cie10Code[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const safe = term.replace(/[%,()]/g, ' ');
  return must(await db.from('cie10_codes').select('*')
    .or(`code.ilike.${safe.toUpperCase()}%,description.ilike.%${safe}%`).order('code').limit(20));
}

// ── Adjuntos (bucket privado clinical-files/<professional_id>/<patient_id>/…) ─
export async function listAttachments(patientId: string): Promise<ClinicalAttachment[]> {
  return must(await db.from('clinical_attachments').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }));
}

export async function uploadAttachment(args: { patientId: string; episodeId?: string | null; noteId?: string | null;
  file: File; description?: string }): Promise<ClinicalAttachment> {
  const professional_id = await uid();
  const clean = args.file.name.replace(/[^\w.-]+/g, '_').slice(-80);
  const path = `${professional_id}/${args.patientId}/${Date.now()}_${clean}`;
  const up = await supabase.storage.from('clinical-files').upload(path, args.file, { upsert: false, contentType: args.file.type });
  if (up.error) throw up.error;
  return must(await db.from('clinical_attachments').insert({
    professional_id, patient_id: args.patientId, episode_id: args.episodeId ?? null, note_id: args.noteId ?? null,
    storage_path: path, file_name: args.file.name, mime_type: args.file.type || null, size_bytes: args.file.size,
    description: args.description ?? null,
  }).select('*').single());
}

/** Sube un documento (p. ej. consentimiento firmado) y devuelve su ruta. */
export async function uploadClinicalFile(patientId: string, file: File): Promise<string> {
  const professional_id = await uid();
  const clean = file.name.replace(/[^\w.-]+/g, '_').slice(-80);
  const path = `${professional_id}/${patientId}/consentimientos/${Date.now()}_${clean}`;
  const up = await supabase.storage.from('clinical-files').upload(path, file, { upsert: false, contentType: file.type });
  if (up.error) throw up.error;
  return path;
}

export async function signedAttachmentUrl(path: string, seconds = 300): Promise<string> {
  const { data, error } = await supabase.storage.from('clinical-files').createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}

// ── Lesiones ─────────────────────────────────────────────────────────────────
export async function listInjuries(patientId: string): Promise<AthleteInjury[]> {
  return must(await db.from('athlete_injuries').select('*').eq('patient_id', patientId).order('occurred_on', { ascending: false }));
}

/** Lesiones activas de todos mis pacientes (tablero de disponibilidad del profesional). */
export async function listActiveInjuries(): Promise<(AthleteInjury & { patient: Pick<ClinicalPatient, 'id' | 'full_name'> })[]> {
  return must(await db.from('athlete_injuries')
    .select('*, patient:clinical_patients!athlete_injuries_patient_id_fkey(id, full_name)')
    .eq('status', 'activa').order('updated_at', { ascending: false }));
}

export async function createInjury(input: Omit<AthleteInjury, 'id' | 'professional_id' | 'created_at' | 'updated_at' | 'returned_on' | 'status'> &
  Partial<Pick<AthleteInjury, 'status'>>): Promise<AthleteInjury> {
  const professional_id = await uid();
  return must(await db.from('athlete_injuries').insert({ ...input, professional_id }).select('*').single());
}

export async function updateInjury(id: string, patch: Partial<Omit<AthleteInjury, 'id' | 'professional_id' | 'patient_id' | 'created_at' | 'updated_at'>>): Promise<AthleteInjury> {
  return must(await db.from('athlete_injuries').update(patch).eq('id', id).select('*').single());
}

export async function listInjuryEvents(injuryId: string) {
  return must(await db.from('athlete_injury_events').select('*').eq('injury_id', injuryId).order('created_at')) as {
    id: number; status: string; availability_status: string; rtp_stage: string; restrictions: string | null;
    expected_return: string | null; created_at: string;
  }[];
}

// ── Ejercicios ───────────────────────────────────────────────────────────────
export async function listExerciseLibrary(): Promise<ExerciseLibraryItem[]> {
  return must(await db.from('exercise_library').select('*').eq('is_active', true).order('name'));
}

export async function createLibraryExercise(input: Pick<ExerciseLibraryItem, 'name'> &
  Partial<Pick<ExerciseLibraryItem, 'description' | 'body_region' | 'category' | 'video_url'>>): Promise<ExerciseLibraryItem> {
  const professional_id = await uid();
  return must(await db.from('exercise_library').insert({ ...input, professional_id }).select('*').single());
}

export async function listAssignments(patientId: string): Promise<ExerciseAssignment[]> {
  return must(await db.from('exercise_assignments').select('*, exercise:exercise_library(*)')
    .eq('patient_id', patientId).order('created_at', { ascending: false }));
}

export async function createAssignment(input: Pick<ExerciseAssignment, 'patient_id' | 'exercise_id'> &
  Partial<Pick<ExerciseAssignment, 'episode_id' | 'sets' | 'reps' | 'hold_seconds' | 'frequency_per_week' | 'instructions' | 'start_date' | 'end_date'>>): Promise<ExerciseAssignment> {
  const professional_id = await uid();
  return must(await db.from('exercise_assignments').insert({ ...input, professional_id }).select('*, exercise:exercise_library(*)').single());
}

export async function updateAssignment(id: string, patch: Partial<Pick<ExerciseAssignment,
  'sets' | 'reps' | 'hold_seconds' | 'frequency_per_week' | 'instructions' | 'end_date' | 'is_active'>>) {
  must(await db.from('exercise_assignments').update(patch).eq('id', id));
}

export async function listExerciseLogs(patientId: string, sinceISO: string) {
  return must(await db.from('exercise_logs').select('assignment_id, done_on, pain, comment')
    .eq('patient_id', patientId).gte('done_on', sinceISO).order('done_on', { ascending: false })) as {
    assignment_id: string; done_on: string; pain: number | null; comment: string | null;
  }[];
}

/** Paciente / acudiente marca un ejercicio como hecho (o lo desmarca). */
export async function logExerciseDone(assignmentId: string, doneOn?: string, pain?: number | null, comment?: string) {
  must(await db.rpc('log_exercise_done', { p_assignment_id: assignmentId, p_done_on: doneOn ?? null,
    p_pain: pain ?? null, p_comment: comment ?? null }));
}
export async function unlogExerciseDone(assignmentId: string, doneOn: string) {
  must(await db.rpc('unlog_exercise_done', { p_assignment_id: assignmentId, p_done_on: doneOn }));
}

// ── Lecturas para paciente / acudiente / escuela ─────────────────────────────
export async function getMyHealthSummary(): Promise<HealthSummaryPatient[]> {
  return (must(await db.rpc('get_my_health_summary')) as HealthSummaryPatient[] | null) ?? [];
}

export async function getSchoolAthleteAvailability(schoolId: string): Promise<SchoolAthleteAvailability[]> {
  return (must(await db.rpc('get_school_athlete_availability', { p_school_id: schoolId })) as SchoolAthleteAvailability[] | null) ?? [];
}

// ── Agenda ───────────────────────────────────────────────────────────────────
export async function listMyAgenda(fromISO: string, toISO: string): Promise<WellnessAppointment[]> {
  const me = await uid();
  return must(await db.from('wellness_appointments').select('*').eq('professional_id', me)
    .gte('appointment_date', fromISO).lte('appointment_date', toISO)
    .order('appointment_date').order('appointment_time'));
}

export async function listPatientAppointments(patientId: string): Promise<WellnessAppointment[]> {
  return must(await db.from('wellness_appointments').select('*').eq('patient_id', patientId)
    .order('appointment_date', { ascending: false }).order('appointment_time', { ascending: false }));
}

export async function createAppointment(input: Pick<WellnessAppointment, 'appointment_date' | 'appointment_time' | 'duration_minutes' | 'service_type'> &
  Partial<Pick<WellnessAppointment, 'patient_id' | 'athlete_name' | 'notes' | 'modality' | 'location' | 'meeting_url' | 'price' | 'service_listing_id' | 'status'>>): Promise<WellnessAppointment> {
  const professional_id = await uid();
  return must(await db.from('wellness_appointments').insert({
    status: 'confirmed', booking_source: 'direct', ...input, professional_id,
  }).select('*').single());
}

export async function updateAppointment(id: string, patch: Partial<Pick<WellnessAppointment,
  'appointment_date' | 'appointment_time' | 'duration_minutes' | 'status' | 'notes' | 'modality' | 'location' |
  'meeting_url' | 'cancellation_reason' | 'payment_status' | 'service_type'>>): Promise<WellnessAppointment> {
  return must(await db.from('wellness_appointments').update(patch).eq('id', id).select('*').single());
}

/** Cliente: reserva desde el marketplace (la cita nace 'pending'). */
export async function requestServiceAppointment(args: { serviceListingId: string; date: string; time: string;
  childId?: string | null; notes?: string | null }): Promise<string> {
  return must(await db.rpc('request_service_appointment', {
    p_service_listing_id: args.serviceListingId, p_date: args.date, p_time: args.time,
    p_child_id: args.childId ?? null, p_notes: args.notes ?? null,
  }));
}

/** Cliente: cancela su cita. */
export async function cancelMyAppointment(id: string, reason?: string) {
  must(await db.rpc('cancel_my_appointment', { p_appointment_id: id, p_reason: reason ?? null }));
}

// ── Disponibilidad (por vendor_profile del profesional) ──────────────────────
export async function getMyVendorProfile(): Promise<{ id: string; display_name: string; verification_status: string;
  professional_license: string | null; rethus_number: string | null; professional_specialty: string | null } | null> {
  const me = await uid();
  const res = await db.from('vendor_profiles')
    .select('id, display_name, verification_status, professional_license, rethus_number, professional_specialty')
    .eq('user_id', me).maybeSingle();
  return must(res);
}

export async function listAvailability(vendorProfileId: string): Promise<AvailabilityBlock[]> {
  return must(await db.from('service_availability').select('*').eq('vendor_profile_id', vendorProfileId)
    .order('day_of_week').order('start_time'));
}

export async function upsertAvailabilityBlock(block: Omit<AvailabilityBlock, 'id'> & { id?: string }): Promise<AvailabilityBlock> {
  return must(await db.from('service_availability').upsert(block).select('*').single());
}

export async function deleteAvailabilityBlock(id: string) {
  must(await db.from('service_availability').delete().eq('id', id));
}

export async function listAvailabilityExceptions(vendorProfileId: string, fromISO: string): Promise<AvailabilityException[]> {
  return must(await db.from('service_availability_exceptions').select('*').eq('vendor_profile_id', vendorProfileId)
    .gte('exception_date', fromISO).order('exception_date'));
}

export async function createAvailabilityException(input: Omit<AvailabilityException, 'id'>): Promise<AvailabilityException> {
  return must(await db.from('service_availability_exceptions').insert(input).select('*').single());
}

export async function deleteAvailabilityException(id: string) {
  must(await db.from('service_availability_exceptions').delete().eq('id', id));
}

export interface AvailableSlotsResult {
  slots: { start_time: string; end_time: string; duration_minutes: number }[];
  /** PROFESIONAL_NO_DISPONIBLE (sin verificar o inactivo) | SERVICIO_NO_DISPONIBLE */
  error?: string;
  full?: boolean;     // se llenó el cupo diario del servicio
  blocked?: boolean;  // el profesional bloqueó ese día
}

export async function getAvailableSlotsDetailed(vendorProfileId: string, serviceListingId: string | null, dateISO: string): Promise<AvailableSlotsResult> {
  const data = must(await db.rpc('get_available_slots', {
    p_vendor_profile_id: vendorProfileId, p_service_listing_id: serviceListingId, p_date: dateISO,
  })) as Partial<AvailableSlotsResult> | null;
  return { slots: data?.slots ?? [], error: data?.error, full: data?.full, blocked: data?.blocked };
}

export async function getAvailableSlots(vendorProfileId: string, serviceListingId: string | null, dateISO: string) {
  return (await getAvailableSlotsDetailed(vendorProfileId, serviceListingId, dateISO)).slots;
}

/** Mensaje para el cliente cuando un día no tiene horarios. */
export function emptySlotsReason(r: AvailableSlotsResult | undefined): string {
  if (r?.error === 'PROFESIONAL_NO_DISPONIBLE') return 'Este profesional todavía no recibe reservas en línea.';
  if (r?.error === 'SERVICIO_NO_DISPONIBLE') return 'Este servicio ya no está disponible.';
  if (r?.blocked) return 'El profesional no atiende ese día. Prueba otra fecha.';
  if (r?.full) return 'Ya no quedan cupos ese día. Prueba otra fecha.';
  return 'No hay horarios disponibles ese día. Prueba otra fecha.';
}
