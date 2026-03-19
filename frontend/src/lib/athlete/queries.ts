/**
 * Athlete Module — Supabase Queries
 * 
 * Centralized queries for all athlete-specific data.
 * All queries are scoped by auth.uid() via RLS.
 * 
 * ⚠️ NEVER reference parent/child/student tables from here.
 */
import { supabase } from '@/integrations/supabase/client';

// ─── Dashboard Stats ────────────────────────────────────────
export async function getAthleteDashboardStats() {
  const { data, error } = await (supabase as any).rpc('get_athlete_dashboard_stats');
  if (error) throw error;
  return data as {
    trainings_this_month: number;
    current_level: string | null;
    next_session_days: number | null;
    pending_payments_total: number;
    pending_payments_count: number;
    active_enrollments: number;
    active_teams: number;
    age_category: string;
  };
}

// ─── Profile ─────────────────────────────────────────────────
export async function getAthleteProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateAthleteProfile(userId: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

// ─── Bookings ────────────────────────────────────────────────
export async function getAthleteBookings(userId: string, filters?: { status?: string }) {
  let query = (supabase as any)
    .from('bookings')
    .select(`
      *,
      teams:team_id (
        name, sport, price_monthly,
        schools:school_id (name, address, logo_url, city)
      )
    `)
    .eq('athlete_id', userId)
    .order('scheduled_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export interface AthleteEnrollment {
  id: string;
  enrollment_status: string;
  start_date: string;
  end_date: string | null;
  expires_at: string | null;
  sessions_used: number;
  team_id: string | null;
  team_name: string;
  sport: string;
  level: string;
  image_url: string | null;
  price_monthly: number;
  school_id: string;
  school_name: string;
  school_logo: string | null;
  school_primary_color: string;
  payment_id: string | null;
  payment_status: string | null;
  payment_amount_cents: number | null;
  payment_due_date: string | null;
  has_pending_payment: boolean;
  has_processing_payment: boolean;
}

// ─── Enrollments ─────────────────────────────────────────────
export async function getAthleteEnrollments() {
  const { data, error } = await (supabase as any).rpc('get_athlete_enrollments');
  if (error) throw error;
  return data as AthleteEnrollment[];
}

// ─── Teams ───────────────────────────────────────────────────
export async function getAthleteTeams(userId: string) {
  const { data, error } = await (supabase as any)
    .from('team_members')
    .select(`
      *,
      teams (
        id, name, sport_id,
        sports (name),
        team_members (
          profiles (full_name, avatar_url)
        )
      )
    `)
    .eq('profile_id', userId)
    .eq('status', 'active');

  if (error) throw error;
  return data;
}

// ─── Training Logs ───────────────────────────────────────────
export async function getTrainingLogs(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('training_logs')
    .select('*')
    .eq('athlete_id', userId)
    .order('training_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ─── Athlete Stats ───────────────────────────────────────────
export async function getAthleteStats(userId: string, limit = 30) {
  const { data, error } = await supabase
    .from('athlete_stats')
    .select('*')
    .eq('athlete_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ─── Wellness Evaluations (Read-only for athlete) ────────────
export async function getWellnessEvaluations(userId: string) {
  const { data, error } = await supabase
    .from('wellness_evaluations')
    .select('*')
    .eq('athlete_id', userId)
    .order('evaluated_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ─── Payments ────────────────────────────────────────────────
export async function getAthletePayments(params: {
  status?: string | null;
  page?: number;
  limit?: number;
}) {
  const { data, error } = await supabase.rpc('get_athlete_payments', {
    p_status: params.status || null,
    p_page: params.page || 1,
    p_limit: params.limit || 20
  });

  if (error) throw error;
  return data as unknown as {
    data: any[];
    total: number;
    summary: {
      count_approved: number;
      pending_cents: number;
      approved_cents: number;
      count_pending: number;
      count_total: number;
    };
  };
}

export async function submitAthleteInstallment(params: {
  athletePaymentId: string;
  amountCents: number;
  receiptUrl: string;
  receiptDate: string;
  paymentMethod: string;
  notes?: string;
}) {
  const { data, error } = await (supabase as any).rpc('submit_athlete_installment', {
    p_athlete_payment_id: params.athletePaymentId,
    p_amount_cents: params.amountCents,
    p_receipt_url: params.receiptUrl,
    p_receipt_date: params.receiptDate,
    p_payment_method: params.paymentMethod,
    ...(params.notes ? { p_notes: params.notes } : {})
  });
  if (error) throw error;
  return data;
}

// ─── Calendar Events (unified) ──────────────────────────────
export async function getAthleteCalendarEvents(userId: string, startDate: string, endDate: string) {
  // 1. Bookings (trials + sessions)
  const { data: bookings, error: bErr } = await (supabase as any)
    .from('bookings')
    .select(`
      id, scheduled_at, booking_type, status, notes,
      teams:team_id (name, sport,
        schools:school_id (name, address))
    `)
    .eq('athlete_id', userId)
    .gte('scheduled_at', startDate)
    .lte('scheduled_at', endDate)
    .not('status', 'eq', 'cancelled');

  if (bErr) throw bErr;

  return (bookings || []).map(b => ({
    id: b.id,
    title: b.teams?.name || 'Sesión',
    start: b.scheduled_at,
    type: b.booking_type as 'trial' | 'session' | 'program',
    status: b.status,
    school: b.teams?.schools?.name,
    address: b.teams?.schools?.address,
    sport: b.teams?.sport,
  }));
}

// ─── Training Log Mutations ──────────────────────────────────
export async function createTrainingLog(data: {
  athlete_id: string;
  training_date: string;
  exercise_type: string;
  duration_minutes: number;
  intensity: 'low' | 'medium' | 'high' | 'max';
  calories_burned?: number | null;
  notes?: string | null;
}) {
  const { error } = await supabase.from('training_logs').insert(data);
  if (error) throw error;
}

export async function deleteTrainingLog(id: string) {
  const { error } = await supabase.from('training_logs').delete().eq('id', id);
  if (error) throw error;
}
// ─── Goals ───────────────────────────────────────────────────
export async function getAthleteGoals(userId: string) {
  const { data, error } = await supabase
    .from('athlete_goals')
    .select('*')
    .eq('athlete_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createGoal(data: {
  athlete_id: string;
  title: string;
  description?: string | null;
  target_date?: string | null;
}) {
  const { error } = await supabase.from('athlete_goals').insert(data);
  if (error) throw error;
}

export async function updateGoal(id: string, updates: { progress?: number; status?: string; title?: string; description?: string }) {
  const { error } = await supabase
    .from('athlete_goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from('athlete_goals').delete().eq('id', id);
  if (error) throw error;
}

// ─── Utility ─────────────────────────────────────────────────
export function calculateAge(dob: string | Date): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export function getAgeCategory(dob: string | Date): string {
  const age = calculateAge(dob);
  if (age >= 5 && age <= 6) return 'Tiny';
  if (age >= 7 && age <= 8) return 'Mini';
  if (age >= 9 && age <= 12) return 'Youth';
  if (age >= 13 && age <= 15) return 'Junior';
  if (age >= 16 && age <= 17) return 'Senior';
  return 'Open';
}
