// Agenda del profesional de salud: utilidades de fecha en hora Colombia y
// lecturas que no están en api.ts (solicitudes, citas del cliente, reportes).
//
// Fechas: appointment_date es 'YYYY-MM-DD' y appointment_time 'HH:MM:SS' en
// hora Colombia. Toda la aritmética de días se hace sobre el string con
// Date.UTC (sin huso), nunca con toISOString() de una fecha local.
import { supabase } from '@/integrations/supabase/client';
import { todayColombia } from '@/lib/dateUtils';
import type { AppointmentStatus, AthleteInjury, AvailabilityBlock, AvailabilityException, WellnessAppointment } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('No autenticado');
  return data.user.id;
}

// ── Fechas (strings, sin huso) ───────────────────────────────────────────────
function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado (igual que service_availability.day_of_week). */
export function dayOfWeekISO(iso: string): number {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Lunes de la semana de `iso`. */
export function weekStartISO(iso: string): string {
  const dow = dayOfWeekISO(iso);
  return addDaysISO(iso, dow === 0 ? -6 : 1 - dow);
}

/** 'YYYY-MM' → primer y último día del mes, y el primer día del mes siguiente. */
export function monthRangeISO(ym: string): { from: string; to: string; nextFrom: string } {
  const [y, m] = ym.split('-').map(Number);
  const from = `${ym}-01`;
  const nextFrom = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { from, to: addDaysISO(nextFrom, -1), nextFrom };
}

export function currentMonthColombia(): string {
  return todayColombia().slice(0, 7);
}

/** 'YYYY-MM-DD HH:MM' de ahora en Colombia, comparable con date + time de una cita. */
export function nowColombiaStamp(): string {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

export function appointmentStamp(a: Pick<WellnessAppointment, 'appointment_date' | 'appointment_time'>): string {
  return `${a.appointment_date} ${a.appointment_time.slice(0, 5)}`;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Inicio de un día Colombia como timestamptz (para filtrar created_at). */
export function colombiaDayStart(iso: string): string {
  return `${iso}T00:00:00-05:00`;
}

export function formatCOP(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

/** Tono del badge de estado con variante oscura. */
export const APPOINTMENT_STATUS_TONE_DARK: Record<AppointmentStatus, string> = {
  pending: 'dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  confirmed: 'dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  completed: 'dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  cancelled: 'dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  no_show: 'dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

/** Bloque de color de la cita en la vista semanal. */
export const APPOINTMENT_BLOCK_TONE: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-950/60 dark:border-amber-600 dark:text-amber-100',
  confirmed: 'bg-emerald-100 border-emerald-500 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-600 dark:text-emerald-100',
  completed: 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-200',
  cancelled: 'bg-rose-50 border-rose-300 text-rose-700 line-through opacity-70 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300',
  no_show: 'bg-slate-50 border-slate-300 text-slate-500 opacity-70 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400',
};

export const MODALITY_LABEL: Record<WellnessAppointment['modality'], string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  domicilio: 'Domicilio',
};

export const PAYMENT_STATUS_LABEL: Record<WellnessAppointment['payment_status'], string> = {
  not_required: 'Sin cobro registrado',
  pending: 'Pago por acordar',
  paid: 'Pagada',
  courtesy: 'Cortesía',
  refunded: 'Reembolsada',
};

export const SERVICE_SUGGESTIONS = [
  'Valoración inicial',
  'Sesión de fisioterapia',
  'Control',
  'Masaje deportivo',
  'Teleconsulta',
];

// ── Lecturas del profesional ─────────────────────────────────────────────────
/** Solicitudes por confirmar (pending) desde hoy. */
export async function listPendingRequests(): Promise<WellnessAppointment[]> {
  const me = await uid();
  return must(await db.from('wellness_appointments').select('*').eq('professional_id', me)
    .eq('status', 'pending').gte('appointment_date', todayColombia())
    .order('appointment_date').order('appointment_time'));
}

export interface VendorSummary {
  id: string;
  avg_rating: number | null;
  reviews_count: number | null;
  verification_status: string | null;
}

export async function getMyVendorSummary(): Promise<VendorSummary | null> {
  const me = await uid();
  return must(await db.from('vendor_profiles').select('id, avg_rating, reviews_count, verification_status')
    .eq('user_id', me).maybeSingle());
}

export async function countMyAppointments(filter: { from?: string; to?: string; statuses?: AppointmentStatus[] }): Promise<number> {
  const me = await uid();
  let q = db.from('wellness_appointments').select('id', { count: 'exact', head: true }).eq('professional_id', me);
  if (filter.from) q = q.gte('appointment_date', filter.from);
  if (filter.to) q = q.lte('appointment_date', filter.to);
  if (filter.statuses) q = q.in('status', filter.statuses);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

// ── Lectura del cliente (atleta / acudiente) ─────────────────────────────────
export type ClientAppointment = Pick<WellnessAppointment,
  'id' | 'professional_id' | 'patient_id' | 'athlete_id' | 'child_id' | 'booked_by' | 'athlete_name' |
  'appointment_date' | 'appointment_time' | 'duration_minutes' | 'service_type' | 'status' | 'price' |
  'payment_status' | 'is_courtesy' | 'modality' | 'location' | 'meeting_url' | 'cancellation_reason' | 'notes'> & {
  professional: { full_name: string | null; avatar_url: string | null } | null;
  service_listing: { name: string | null } | null;
};

/**
 * Citas del lado del cliente por RPC: trae el nombre del profesional sin abrir
 * `profiles` (su RLS no lo deja ver) y nunca las notas internas del profesional
 * (`notes` aquí es lo que escribió el cliente al reservar).
 * La RPC resuelve sola los hijos del acudiente.
 */
export async function listMyClientAppointments(): Promise<ClientAppointment[]> {
  return (must(await db.rpc('get_my_appointments')) as ClientAppointment[] | null) ?? [];
}

// ── Reportes del profesional ─────────────────────────────────────────────────
export interface ProfessionalMonthReport {
  appointments: Pick<WellnessAppointment, 'id' | 'status' | 'appointment_date' | 'duration_minutes' | 'patient_id'>[];
  newPatients: number;
  episodesOpened: number;
  discharges: number;
  openEpisodes: number;
  activeInjuries: Pick<AthleteInjury, 'id' | 'body_region'>[];
  availability: AvailabilityBlock[];
  exceptions: AvailabilityException[];
}

export async function getProfessionalMonthReport(ym: string): Promise<ProfessionalMonthReport> {
  const me = await uid();
  const { from, to, nextFrom } = monthRangeISO(ym);
  const tsFrom = colombiaDayStart(from);
  const tsTo = colombiaDayStart(nextFrom);
  const count = async (q: Promise<{ count: number | null; error: unknown }>) => {
    const { count: c, error } = await q;
    if (error) throw error;
    return c ?? 0;
  };

  const vendor = must(await db.from('vendor_profiles').select('id').eq('user_id', me).maybeSingle()) as { id: string } | null;

  const [appointments, newPatients, episodesOpened, discharges, openEpisodes, activeInjuries, availability, exceptions] =
    await Promise.all([
      db.from('wellness_appointments').select('id, status, appointment_date, duration_minutes, patient_id')
        .eq('professional_id', me).gte('appointment_date', from).lte('appointment_date', to)
        .then((r: { data: unknown; error: unknown }) => must(r) as ProfessionalMonthReport['appointments']),
      count(db.from('clinical_patients').select('id', { count: 'exact', head: true })
        .eq('professional_id', me).gte('created_at', tsFrom).lt('created_at', tsTo)),
      count(db.from('clinical_episodes').select('id', { count: 'exact', head: true })
        .eq('professional_id', me).gte('opened_at', tsFrom).lt('opened_at', tsTo)),
      count(db.from('clinical_episodes').select('id', { count: 'exact', head: true })
        .eq('professional_id', me).eq('status', 'alta').gte('closed_at', tsFrom).lt('closed_at', tsTo)),
      count(db.from('clinical_episodes').select('id', { count: 'exact', head: true })
        .eq('professional_id', me).eq('status', 'abierto')),
      db.from('athlete_injuries').select('id, body_region').eq('professional_id', me).eq('status', 'activa')
        .then((r: { data: unknown; error: unknown }) => must(r) as ProfessionalMonthReport['activeInjuries']),
      vendor
        ? db.from('service_availability').select('*').eq('vendor_profile_id', vendor.id).eq('is_active', true)
          .then((r: { data: unknown; error: unknown }) => must(r) as AvailabilityBlock[])
        : Promise.resolve([] as AvailabilityBlock[]),
      vendor
        ? db.from('service_availability_exceptions').select('*').eq('vendor_profile_id', vendor.id)
          .gte('exception_date', from).lte('exception_date', to)
          .then((r: { data: unknown; error: unknown }) => must(r) as AvailabilityException[])
        : Promise.resolve([] as AvailabilityException[]),
    ]);

  return {
    appointments: appointments ?? [], newPatients, episodesOpened, discharges, openEpisodes,
    activeInjuries: activeInjuries ?? [], availability: availability ?? [], exceptions: exceptions ?? [],
  };
}

/** Minutos ofrecidos en el mes según la disponibilidad semanal menos las excepciones. */
export function offeredMinutesInMonth(ym: string, blocks: AvailabilityBlock[], exceptions: AvailabilityException[]): number {
  const { from, to } = monthRangeISO(ym);
  let total = 0;
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    const dow = dayOfWeekISO(d);
    const dayEx = exceptions.filter((e) => e.exception_date === d);
    if (dayEx.some((e) => !e.start_time)) continue;
    for (const b of blocks.filter((x) => x.day_of_week === dow && x.is_active)) {
      const s = timeToMinutes(b.start_time);
      const e = timeToMinutes(b.end_time);
      let mins = Math.max(0, e - s);
      for (const ex of dayEx) {
        if (!ex.start_time || !ex.end_time) continue;
        const os = Math.max(s, timeToMinutes(ex.start_time));
        const oe = Math.min(e, timeToMinutes(ex.end_time));
        if (oe > os) mins -= oe - os;
      }
      total += Math.max(0, mins);
    }
  }
  return total;
}
