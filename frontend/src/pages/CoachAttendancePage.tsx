import { useState, useMemo, useRef, useEffect } from 'react';
import { todayColombia } from '@/lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  CheckCircle2, XCircle, Clock, AlertCircle, Users, Lock, Edit2,
  Flag, CalendarCheck, Search, UserX, CreditCard, AlertTriangle, ChevronRight, Trophy, Zap, Target, Star, Dumbbell, Layers,
  Calendar as CalendarIcon, TrendingUp, Activity, ScanLine
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getSportVisual } from '@/lib/sportVisuals';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useCoachStaffId } from '@/hooks/useCoachStaffId';
import { AvisoFichaStaff } from '@/components/common/AvisoFichaStaff';
import { useUpdatePTAttendance, useHandleNoShow } from '@/hooks/useAthleteSessionBookings';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useActiveWorkPage } from '@/hooks/useActiveWorkPage';

// ── Tipos ─────────────────────────────────────────────────────────────────────
type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface TeamItem { id: string; name: string; sport: string; current_students: number }
interface OfferingItem { id: string; name: string; offering_type: string; current_students: number }
interface PlanInfo {
  name: string;
  start_date: string | null;
  expires_at: string | null;
  days_left: number | null;
  is_expired: boolean;
  sessions_used: number;
  max_sessions: number | null;
  sessions_remaining: number | null;
  secondary_sessions_used: number;
  max_secondary_sessions: number | null;
  secondary_remaining: number | null;
  payment_status: string | null;
  payment_due_date: string | null;
  price: number | null;
  currency: string | null;
}
/** Reserva del atleta para hoy. Si existe, pasar lista NO le descuenta otra clase. */
interface BookingToday {
  start_time: string | null;
  status: string;
}
interface RosterItem {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  athlete_type: 'child' | 'adult' | 'unregistered';
  user_id?: string | null;
  parent_id?: string | null;
  parent_phone?: string | null;
  enrollment_id?: string | null;
  plan: PlanInfo | null;
  booking_today?: BookingToday | null;
  is_booking?: boolean;
  payment: { status: string; due_date: string | null } | null;
}

/** Resultado del movimiento de crédito que devuelve el BFF por atleta. */
type CreditOutcome =
  | 'deducted' | 'covered_by_booking' | 'returned' | 'booking_released'
  | 'no_plan' | 'no_credits' | 'expired' | 'unchanged';

type CreditTally = {
  deducted: number;
  returned: number;
  noPlan: number;
  covered: string[];
  noCredits: string[];
};

function newTally(): CreditTally {
  return { deducted: 0, returned: 0, noPlan: 0, covered: [], noCredits: [] };
}

function addOutcome(t: CreditTally, outcome: CreditOutcome | undefined, name: string) {
  switch (outcome) {
    case 'deducted':           t.deducted++; break;
    case 'returned':
    case 'booking_released':   t.returned++; break;
    case 'covered_by_booking': t.covered.push(name); break;
    case 'no_plan':            t.noPlan++; break;
    case 'no_credits':
    case 'expired':            t.noCredits.push(name); break;
    default: break;
  }
}

/** El entrenador tiene que entender por qué se descontó o por qué no. */
function describeCredits(t: CreditTally): string | undefined {
  const parts: string[] = [];
  if (t.deducted) parts.push(`se descontó 1 clase a ${t.deducted} atleta${t.deducted > 1 ? 's' : ''}`);
  if (t.covered.length) parts.push(`${t.covered.join(', ')} ya tenía reserva para hoy: no se le descontó`);
  if (t.returned) parts.push(`${t.returned} clase${t.returned > 1 ? 's' : ''} devuelta${t.returned > 1 ? 's' : ''}`);
  if (t.noCredits.length) parts.push(`${t.noCredits.join(', ')} sin clases disponibles en el plan`);
  if (t.noPlan) parts.push(`${t.noPlan} sin plan de clases`);
  return parts.length ? parts.join(' · ') : undefined;
}

/** "martes 12 de agosto" — para que el entrenador vea el día, no un ISO. */
function formatHumanDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function formatHour(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hour = Number(h);
  const suffix = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m ?? '00'} ${suffix}`;
}
interface AttendanceSession {
  id: string;
  team_id: string;
  session_date: string;
  finalized: boolean;
  finalized_at?: string;
}

async function getBearerToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('No autenticado');
  return token;
}

const BFF_URL = import.meta.env.VITE_BFF_URL ?? '';

// ── Sub-componente: badge de estado del plan ──────────────────────────────────


const STATUS_CFG: Record<AttendanceStatus, { label: string; icon: React.ReactNode; active: string; inactive: string }> = {
  present: { label: 'Presente', icon: <CheckCircle2 className="w-3.5 h-3.5" />, active: 'bg-green-500 border-green-500 text-white', inactive: 'border-border text-muted-foreground hover:border-green-400 hover:text-green-500' },
  absent: { label: 'Ausente', icon: <XCircle className="w-3.5 h-3.5" />, active: 'bg-red-500 border-red-500 text-white', inactive: 'border-border text-muted-foreground hover:border-red-400 hover:text-red-500' },
  late: { label: 'Tarde', icon: <Clock className="w-3.5 h-3.5" />, active: 'bg-yellow-500 border-yellow-500 text-white', inactive: 'border-border text-muted-foreground hover:border-yellow-400 hover:text-yellow-500' },
  excused: { label: 'Excusado', icon: <AlertCircle className="w-3.5 h-3.5" />, active: 'bg-blue-500 border-blue-500 text-white', inactive: 'border-border text-muted-foreground hover:border-blue-400 hover:text-blue-500' },
};

function getPlanVisual(name: string = '') {
  const n = name.toLowerCase();
  if (n.includes('elite') || n.includes('premium') || n.includes('oro') || n.includes('gold') || n.includes('black')) {
    return { gradient: 'from-zinc-900 via-zinc-800 to-black', accent: 'text-amber-400', tag: 'bg-amber-400/20 text-amber-400 border-amber-400/30', icon: Trophy, glow: 'shadow-amber-900/20' };
  }
  if (n.includes('combate') || n.includes('mma') || n.includes('box') || n.includes('warrior')) {
    return { gradient: 'from-rose-700 via-rose-800 to-red-950', accent: 'text-white', tag: 'bg-white/20 text-white border-white/20', icon: Target, glow: 'shadow-red-900/30' };
  }
  if (n.includes('gym') || n.includes('fitness') || n.includes('iron')) {
    return { gradient: 'from-orange-500 via-orange-600 to-amber-700', accent: 'text-white', tag: 'bg-white/20 text-white border-white/20', icon: Zap, glow: 'shadow-orange-900/20' };
  }
  if (n.includes('yoga') || n.includes('zen') || n.includes('balance') || n.includes('wellness')) {
    return { gradient: 'from-emerald-500 via-teal-600 to-cyan-700', accent: 'text-white', tag: 'bg-white/20 text-white border-white/20', icon: Star, glow: 'shadow-emerald-900/20' };
  }
  if (n.includes('basico') || n.includes('básico') || n.includes('estandar') || n.includes('base') || n.includes('inicial')) {
    return { gradient: 'from-slate-500 via-slate-600 to-slate-700', accent: 'text-white', tag: 'bg-white/20 text-white border-white/20', icon: Target, glow: 'shadow-slate-900/20' };
  }
  return { gradient: 'from-[#6366f1] via-[#8b5cf6] to-[#a855f7]', accent: 'text-white', tag: 'bg-white/20 text-white border-white/20', icon: Zap, glow: 'shadow-purple-900/30' };
}

// ── PlanInfoCard ───────────────────────────────────────────────────────────────
function PlanInfoCard({ plan }: { plan: PlanInfo }) {
  const payBadge = ({
    paid: { label: 'Al día', cls: 'bg-green-500/10 text-green-600 border-green-500/30' },
    pending: { label: 'Pendiente', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
    overdue: { label: 'Vencido', cls: 'bg-red-500/10 text-red-600 border-red-500/30' },
  } as any)[plan.payment_status ?? 'pending'] ?? { label: 'Sin info', cls: 'bg-muted text-muted-foreground border-border' };

  const expiryColor = plan.is_expired
    ? 'text-red-500'
    : plan.days_left !== null && plan.days_left <= 7
      ? 'text-yellow-500'
      : 'text-muted-foreground';

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center gap-3 text-[11px] flex-wrap">
        {/* Nombre de tarifa + precio */}
        <span className="flex items-center gap-1 font-medium text-muted-foreground">
          {plan.name}
          {plan.price != null && (
            <span className="font-normal opacity-75">
              · {new Intl.NumberFormat('es-CO', {
                  style: 'currency', currency: plan.currency ?? 'COP',
                  maximumFractionDigits: 0,
                }).format(plan.price)}
            </span>
          )}
        </span>

        {/* Clases principales */}
        <span className="flex items-center gap-1 text-muted-foreground">
          <TrendingUp className="w-3 h-3" />
          {plan.max_sessions === null
            ? `${plan.sessions_used} usadas (ilimitadas)`
            : `${plan.sessions_used}/${plan.max_sessions} clases`
          }
        </span>

        {/* Secundarias — solo si aplica */}
        {plan.max_secondary_sessions != null && plan.max_secondary_sessions > 0 && (
          <span className="text-muted-foreground">
            · {plan.secondary_sessions_used}/{plan.max_secondary_sessions} secundarias
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
        {plan.start_date && (
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-3 h-3" />
            Inicio: {new Date(plan.start_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {plan.expires_at && (
          <span className={`flex items-center gap-1 font-medium ${expiryColor}`}>
            <CalendarIcon className="w-3 h-3" />
            {plan.is_expired
              ? 'Plan vencido'
              : plan.days_left !== null && plan.days_left <= 7
                ? `Vence en ${plan.days_left}d`
                : `Vence: ${new Date(plan.expires_at + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
            }
          </span>
        )}
      </div>

      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${payBadge.cls}`}>
        <CreditCard className="w-2.5 h-2.5" />
        {payBadge.label}
        {plan.payment_due_date && plan.payment_status !== 'paid' && (
          <span className="opacity-75">
            · {new Date(plan.payment_due_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CoachAttendancePage({ showPlanSessions = true }: { showPlanSessions?: boolean }) {
  useActiveWorkPage();
  const { user, profile } = useAuth();
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutate: updatePTAttendance, isPending: updatingPT } = useUpdatePTAttendance();

  const [selectedItem, setSelectedItem] = useState<string>('');
  const [isSecondary, setIsSecondary] = useState(false);
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [noShowDialog, setNoShowDialog] = useState<{ open: boolean; session: any | null }>({
    open: false,
    session: null,
  });
  const { mutate: handleNoShow, isPending: processingNoShow } = useHandleNoShow();

  // Walk-in state
  const [walkInSearch, setWalkInSearch] = useState('');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInAthlete, setWalkInAthlete] = useState<RosterItem | null>(null);
  const [walkInProcessing, setWalkInProcessing] = useState(false);

  // Fase 1 — auto-selección de sesión (docs/specs/asistencia-rapida-checkin.md
  // §1.2). Solo informa al coach de qué se auto-eligió y por qué; no cambia
  // ningún dato hasta que guarde.
  const [autoSelectedLabel, setAutoSelectedLabel] = useState<string | null>(null);

  const isTeam     = selectedItem.startsWith('team:');
  const isOffering = selectedItem.startsWith('offering:');
  const isSession  = selectedItem.startsWith('session:');
  const selectedTeamId     = isTeam     ? selectedItem.split(':')[1] : '';
  const selectedOfferingId = isOffering ? selectedItem.split(':')[1] : '';
  const selectedSessionId  = isSession  ? selectedItem.split(':')[1] : '';

  const contextType = isTeam ? 'team' : isOffering ? 'offering' : null;
  const contextId   = selectedTeamId || selectedOfferingId || '';

  const isAdmin = ['admin', 'super_admin', 'school_admin', 'school', 'owner'].includes(
    profile?.role || ''
  );

  // ── 0. Staff profile ────────────────────────────────────────────────────
  const { staffId, estado: estadoFicha, refetch: refetchFicha } = useCoachStaffId();

  // ── Fecha de trabajo ────────────────────────────────────────────────────
  // Por defecto hoy. El entrenador puede retroceder 7 días para completar lo
  // que se le pasó; la administración, sin tope. El BFF vuelve a validar esto
  // mismo: acá solo se evita ofrecer un botón que va a devolver 403.
  const RETRO_DIAS_COACH = 7;
  const hoy = todayColombia();
  const [fechaLista, setFechaLista] = useState<string>(hoy);
  const esRetroactiva = fechaLista !== hoy;

  const fechaMinima = useMemo(() => {
    if (isAdmin) return undefined;                       // sin tope
    const d = new Date(`${hoy}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - RETRO_DIAS_COACH);
    return d.toISOString().slice(0, 10);
  }, [hoy, isAdmin]);

  // ── 1. Equipos ──────────────────────────────────────────────────────────
  const { data: teams = [], isLoading: loadingTeams } = useQuery<TeamItem[]>({
    queryKey: ['coach-teams', schoolId, user?.id, staffId, isAdmin],
    queryFn: async () => {
      if (!schoolId || !user?.id) return [];
      const { data, error } = await (supabase as any)
        .from('teams')
        .select('id, name, sport, current_students, coach_id, team_coaches(coach_id)')
        .eq('school_id', schoolId);
      if (error) throw error;
      return (data || [])
        .filter((team: any) => {
          if (isAdmin) return true;
          const isDirectCoach =
            team.coach_id === user.id || (staffId && team.coach_id === staffId);
          const isAssigned = team.team_coaches?.some(
            (tc: any) => tc.coach_id === user.id || (staffId && tc.coach_id === staffId)
          );
          return isDirectCoach || isAssigned;
        })
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: !!schoolId && !!user?.id,
  });

  // ── 1b. Config por escuela: ¿oculta "Planes" y solo muestra "Equipos"? ───
  // Escuela por escuela — algunas organizan la asistencia por PLAN, no por
  // equipo (mig. 20260902110253). Default false: no cambia nada para nadie
  // salvo la escuela que lo pidió (hoy, Dynasty).
  const { data: teamsOnlyMode = false, isLoading: loadingTeamsOnlyMode } = useQuery<boolean>({
    queryKey: ['coach-attendance-teams-only', schoolId],
    queryFn: async () => {
      if (!schoolId) return false;
      const { data } = await supabase
        .from('school_settings')
        .select('coach_attendance_teams_only')
        .eq('school_id', schoolId)
        .maybeSingle();
      return (data as any)?.coach_attendance_teams_only ?? false;
    },
    enabled: !!schoolId,
  });

  // ── 2. Planes / Offerings ───────────────────────────────────────────────
  const { data: offerings = [], isLoading: loadingOfferings } = useQuery<OfferingItem[]>({
    queryKey: ['school-offerings', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('offerings')
        .select('id, name, offering_type, current_students')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as any as OfferingItem[];
    },
    enabled: !!schoolId,
  });

  // ── 3. Clases programadas hoy (sesiones de planes con offering_id) ──────
  const { data: planSessions = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['coach-plan-sessions', schoolId, staffId, isAdmin],
    queryFn: async () => {
      if (!schoolId) return [];
      const today = todayColombia();
      let query = supabase
        .from('attendance_sessions')
        .select(`id, start_time, end_time, title, offerings!attendance_sessions_offering_id_fkey(name)`)
        .eq('school_id', schoolId)
        .eq('session_date', today)
        .not('offering_id', 'is', null)
        .not('finalized', 'is', true);
      if (!isAdmin) query = query.eq('coach_id', staffId || user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        name: s.title || (s.offerings as any)?.name || 'Clase de Plan',
        start_time: s.start_time,
        end_time: s.end_time,
      }));
    },
    enabled: !!schoolId && (!!user?.id || !!staffId),
  });

  // ── 3b. Sesiones PT Personalizadas ─────────────────────────────────────
  const { data: ptSchedule, isLoading: loadingPT } = useQuery({
    queryKey: ['coach-pt-sessions', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const token = await getBearerToken();
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
      const res = await fetch(`${BFF_URL}/api/v1/trainer/availability/schedule?date=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id,
  });

  const ptSessions     = ptSchedule?.sessions ?? [];
  const ptAvailSlots   = ptSchedule?.availability_slots ?? [];
  const hasAvailability = ptSchedule?.has_availability ?? false;

  // ── 3c. Auto-selección de sesión ────────────────────────────────────────
  // docs/specs/asistencia-rapida-checkin.md §1.2. Se intenta UNA sola vez por
  // carga de página (autoSelectAttemptedRef) — si el coach vuelve a "Volver a
  // la selección", no lo re-secuestra al mismo lugar. Nunca autoselecciona en
  // retroactivo: ahí la elección la hace el coach a propósito.
  const autoSelectAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoSelectAttemptedRef.current) return;
    if (selectedItem) { autoSelectAttemptedRef.current = true; return; }
    if (fechaLista !== hoy) { autoSelectAttemptedRef.current = true; return; }
    if (loadingTeams || loadingOfferings || loadingPlans || loadingPT || loadingTeamsOnlyMode) return;

    autoSelectAttemptedRef.current = true;

    // Señal 1a: una sola clase de plan programada hoy → directo al roster.
    if (planSessions.length === 1) {
      const ps = planSessions[0] as any;
      setSelectedItem(`session:${ps.id}`);
      setAutoSelectedLabel(`Detectamos tu clase de hoy: ${ps.name}`);
      return;
    }
    // Señal 1b: sin clases de plan ni sesiones PT hoy, y un solo equipo asignado.
    // `teamsOnlyMode` (setting por escuela, ver mig. 20260902110253): si la
    // escuela oculta "Planes" para el coach, no hay ambigüedad que temer aunque
    // offerings no esté vacío — para el resto se mantiene el chequeo original.
    if (
      planSessions.length === 0 && ptSessions.length === 0 && teams.length === 1
      && (teamsOnlyMode || offerings.length === 0)
    ) {
      const t = teams[0] as any;
      setSelectedItem(`team:${t.id}`);
      setAutoSelectedLabel(`Detectamos tu equipo de hoy: ${t.name}`);
      return;
    }
    // Señal 2 (caso Dynasty: varios equipos, nada programado) — sugerir el
    // último equipo que este coach usó el mismo día de la semana.
    if (planSessions.length === 0 && teams.length > 1) {
      try {
        const suggestedId = localStorage.getItem(`sm_last_team_weekday_${new Date().getDay()}`);
        const match = suggestedId && teams.find((t: any) => t.id === suggestedId);
        if (match) {
          setSelectedItem(`team:${suggestedId}`);
          setAutoSelectedLabel(`Sugerido: ${(match as any).name} — tu elección habitual este día`);
        }
      } catch {
        // localStorage puede fallar en privado/incógnito: se degrada en silencio
        // al comportamiento de siempre (el coach elige a mano).
      }
    }
  }, [selectedItem, fechaLista, hoy, loadingTeams, loadingOfferings, loadingPlans, loadingPT, loadingTeamsOnlyMode, planSessions, ptSessions, teams, offerings, teamsOnlyMode]);

  // ── 4. Roster unificado (via BFF) ───────────────────────────────────────
  const {
    data: rosterData,
    isLoading: loadingRoster,
  } = useQuery<{ athletes: RosterItem[]; bookings: any[]; atletas_sin_equipo?: number }>({
    queryKey: ['attendance-roster', contextType, contextId],
    queryFn: async () => {
      if (!contextType || !contextId) return { athletes: [], bookings: [] };
      const token = await getBearerToken();
      const res = await fetch(
        `${BFF_URL}/api/v1/attendance/roster/${contextType}/${contextId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Error cargando roster');
      return res.json();
    },
    enabled: !!(contextType && contextId),
  });

  // ── 5. Sesión activa ────────────────────────────────────────────────────
  const { data: sessionData, isLoading: loadingSession } = useQuery<{
    session: AttendanceSession | null;
    records: { child_id?: string; user_id?: string; unregistered_athlete_id?: string; status: string }[];
  }>({
    queryKey: ['attendance-session', selectedItem, fechaLista],
    queryFn: async () => {
      if (!selectedItem) return { session: null, records: [] };
      if (isTeam) {
        const token = await getBearerToken();
        const res = await fetch(`${BFF_URL}/api/v1/attendance/session/${selectedTeamId}?date=${fechaLista}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error consultando sesión');
        return res.json();
      }
      if (isSession) {
        const { data: session, error: sErr } = await supabase
          .from('attendance_sessions')
          .select('id, team_id, session_date, finalized, finalized_at')
          .eq('id', selectedSessionId)
          .single();
        if (sErr) throw sErr;
        const { data: records } = await (supabase as any)
          .from('attendance_records')
          .select('child_id, user_id, unregistered_athlete_id, status')
          .eq('session_id', session.id);
        return { session, records: records || [] };
      }
      if (isOffering) {
        const today = todayColombia();
        const { data: session, error: sErr } = await (supabase as any)
          .from('attendance_sessions')
          .select('id, team_id, session_date, finalized, finalized_at')
          .eq('offering_id', selectedOfferingId)
          .eq('session_date', today)
          .eq('finalized', false)
          .maybeSingle();
        if (sErr || !session) return { session: null, records: [] };
        const { data: records } = await (supabase as any)
          .from('attendance_records')
          .select('child_id, user_id, unregistered_athlete_id, status')
          .eq('session_id', session.id);
        return { session, records: records || [] };
      }
      return { session: null, records: [] };
    },
    enabled: !!selectedItem,
  });

  // Update effect replaces onSuccess (since tanstack v5 doesn't have it on useQuery)
  //
  // Asistencia por excepción (Fase 1.4, docs/specs/asistencia-rapida-checkin.md):
  // si la sesión no tiene registros todavía, arranca con TODOS presentes — el
  // coach solo destilda a los ausentes. presetAppliedKeyRef evita reaplicar el
  // "todos presentes" si sessionData/rosterData se refrescan solos mientras el
  // coach ya venía editando (ej. refetch por window focus): solo se aplica una
  // vez por sesión+fecha. El guardado sigue siendo explícito (botón Guardar) —
  // esto solo cambia estado local, no escribe nada en la base todavía.
  const presetAppliedKeyRef = useRef<string | null>(null);
  useMemo(() => {
    const presetKey = `${selectedItem}|${fechaLista}`;
    if (sessionData?.records?.length) {
      const preloaded: Record<string, AttendanceStatus> = {};
      sessionData.records.forEach((r: any) => {
        const id = r.child_id ?? r.user_id ?? r.unregistered_athlete_id;
        if (id) preloaded[id] = r.status as AttendanceStatus;
      });
      setAttendanceState(preloaded);
      presetAppliedKeyRef.current = presetKey;
    } else if (
      sessionData !== undefined
      && sessionData.session?.finalized !== true
      && (rosterData?.athletes?.length ?? 0) > 0
      && presetAppliedKeyRef.current !== presetKey
    ) {
      const allPresent: Record<string, AttendanceStatus> = {};
      (rosterData?.athletes ?? []).forEach((a) => { allPresent[a.id] = 'present'; });
      setAttendanceState(allPresent);
      presetAppliedKeyRef.current = presetKey;
    }
  }, [sessionData, rosterData, selectedItem, fechaLista]);

  const session = sessionData?.session ?? null;

  // ── Combinar roster + bookings ──────────────────────────────────────────
  const combinedRoster = useMemo<RosterItem[]>(() => {
    const base: RosterItem[] = [...(rosterData?.athletes || [])];
    const baseIds = new Set(base.map((r) => r.id));

    (rosterData?.bookings || []).forEach((b: any) => {
      const personId = b.user_id || b.child_id || b.unregistered_athlete_id;
      if (personId && !baseIds.has(personId)) {
        base.push({
          id: personId,
          full_name: b.person?.full_name ?? 'Atleta',
          avatar_url: b.person?.avatar_url,
          athlete_type: b.child_id ? 'child' : b.unregistered_athlete_id ? 'unregistered' : 'adult',
          enrollment_id: b.enrollment_id,
          plan: null,
          is_booking: true,
          payment: null,
        });
        baseIds.add(personId);
      }
    });

    return base.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [rosterData]);

  const walkInResults = useMemo(() => {
    if (!walkInSearch.trim()) return [];
    const q = walkInSearch.toLowerCase();
    return combinedRoster.filter((a) => a.full_name.toLowerCase().includes(q));
  }, [walkInSearch, combinedRoster]);

  const isFinalized = session?.finalized === true;
  const isEditMode  = session !== null && !isFinalized;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const athletes = combinedRoster;
      const token    = await getBearerToken();

      const presentEntries = Object.entries(attendanceState).filter(([, s]) => s === 'present');
      const otherEntries   = Object.entries(attendanceState).filter(([, s]) => s !== 'present');
      const walkInErrors: string[] = [];
      // Solo aplica al camino de `offering`, que sigue siendo un POST por
      // atleta porque la ruta exige enrollmentId. En equipo y sesión ya no se
      // pierde a nadie: van en el lote y quedan registrados aunque no tengan
      // inscripción (el crédito sale como `no_plan`, la asistencia se guarda).
      const sinInscripcion: string[] = [];
      const tally = newTally();

      /** Traduce una fila del roster al record que espera POST /session. */
      const aRecord = ([id, status]: [string, string]) => {
        const a = athletes.find((x) => x.id === id);
        return {
          childId:               a?.athlete_type === 'child'        ? id : undefined,
          userId:                a?.athlete_type === 'adult'        ? id : undefined,
          unregisteredAthleteId: a?.athlete_type === 'unregistered' ? id : undefined,
          status,
          // Que el BFF le cobre a la inscripción que el entrenador vio en
          // pantalla, en vez de adivinarla por antigüedad.
          enrollmentId: a?.enrollment_id ?? undefined,
          isSecondary,
        };
      };

      // ── Equipo o sesión: TODO en un solo request ────────────────────────
      //
      // Antes eran un POST por atleta presente más uno para el resto: con los
      // 31 de SENIORS, 31 requests. Si el token vencía o se caía la red a
      // mitad, media lista quedaba guardada y la otra media no, y el
      // entrenador no tenía forma de saber cuál era cuál.
      if (isTeam || isSession) {
        const sessionPayload: any = {
          records: [...presentEntries, ...otherEntries].map(aRecord),
          date: fechaLista,
        };
        if (isTeam)      sessionPayload.teamId    = selectedTeamId;
        if (session?.id) sessionPayload.sessionId = session.id;
        else if (isSession) sessionPayload.sessionId = selectedSessionId;

        const res = await fetch(`${BFF_URL}/api/v1/attendance/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(sessionPayload),
        });
        const b = await res.json();
        if (!res.ok) throw new Error(b.error);
        for (const [id, outcome] of Object.entries(b.credit_outcomes ?? {})) {
          addOutcome(tally, outcome as CreditOutcome, athletes.find((x) => x.id === id)?.full_name ?? 'Atleta');
        }
        return tally;
      }

      // ── Offering: un POST por atleta (la ruta pide enrollmentId) ─────────
      for (const [id] of presentEntries) {
        const a = athletes.find((x) => x.id === id);
        if (!a || !a.enrollment_id) {
          sinInscripcion.push(a?.full_name ?? 'Un atleta');
          continue;
        }
        const payload: any = {
          enrollmentId: a.enrollment_id, is_secondary: isSecondary, status: 'present',
          offeringId: selectedOfferingId,
        };
        if (a.athlete_type === 'child')        payload.childId               = id;
        else if (a.athlete_type === 'adult')   payload.userId                = id;
        else                                    payload.unregisteredAthleteId = id;

        const res = await fetch(`${BFF_URL}/api/v1/attendance/walk-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) {
          // Falta de saldo y plan vencido ya NO fallan: la asistencia se registra
          // y el motivo viene en `credit_outcome`. Acá solo quedan errores reales.
          const msgs: Record<string, string> = {
            not_found: `${a.full_name}: sin inscripción activa`,
            no_session: `${a.full_name}: no hay sesión activa`,
          };
          walkInErrors.push(msgs[body.reason] || `${a.full_name}: ${body.error}`);
        } else {
          addOutcome(tally, body.credit_outcome, a.full_name);
        }
      }

      // Otros estados del offering → walk-in por atleta (sin descuento, status != present)
      for (const [id, status] of otherEntries) {
        const a = athletes.find((x) => x.id === id);
        if (!a?.enrollment_id) {
          sinInscripcion.push(a?.full_name ?? 'Un atleta');
          continue;
        }
        const payload: any = {
          enrollmentId: a.enrollment_id,
          offeringId:   selectedOfferingId,
          status,
          is_secondary: false,
        };
        if (a.athlete_type === 'child')        payload.childId               = id;
        else if (a.athlete_type === 'adult')   payload.userId                = id;
        else                                    payload.unregisteredAthleteId = id;

        const res = await fetch(`${BFF_URL}/api/v1/attendance/walk-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const b = await res.json();
        if (!res.ok) {
          // `expired` y `no_credits` ya no son errores: la asistencia se
          // registra igual y el motivo llega en `credit_outcome`.
          walkInErrors.push(`${a.full_name}: ${b.error}`);
        } else {
          addOutcome(tally, b.credit_outcome, a?.full_name ?? 'Atleta');
        }
      }

      if (sinInscripcion.length) {
        walkInErrors.push(
          `${sinInscripcion.join(', ')}: sin inscripción activa — NO se registró su asistencia. ` +
          `Asígnale un plan desde Atletas y vuelve a pasarle lista.`
        );
      }
      if (walkInErrors.length) throw new Error(walkInErrors.join('\n'));
      return tally;
    },
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedItem] });
      queryClient.invalidateQueries({ queryKey: ['attendance-roster', contextType, contextId] });
      toast({ title: '✅ Asistencia guardada', description: describeCredits(t) });
    },
    onError: (e: any) => {
      // El guardado es atleta por atleta: un fallo parcial deja parte grabada.
      // Sin refrescar, la pantalla seguiría mostrando el estado optimista y el
      // entrenador no sabría cuáles sí entraron.
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedItem] });
      queryClient.invalidateQueries({ queryKey: ['attendance-roster', contextType, contextId] });
      toast({ title: 'Algunos registros no se guardaron', description: e.message, variant: 'destructive' });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!session?.id) throw new Error('No hay sesión activa para finalizar.');
      const token = await getBearerToken();
      const res = await fetch(`${BFF_URL}/api/v1/attendance/session/${session.id}/finalize`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error finalizando sesión');
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedItem, fechaLista] });
      toast({ title: '🏁 Sesión finalizada', description: 'Los datos quedan bloqueados.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error al finalizar', description: err?.message, variant: 'destructive' });
    },
  });

  // Reabrir una lista ya cerrada. El cierre automático corre cada noche sobre
  // todo lo que tenga fecha anterior a hoy, así que sin esto una lista mal
  // llena quedaba mal para siempre.
  const reopenMutation = useMutation({
    mutationFn: async () => {
      if (!session?.id) throw new Error('No hay sesión que reabrir.');
      const token = await getBearerToken();
      const res = await fetch(`${BFF_URL}/api/v1/attendance/session/${session.id}/reopen`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error reabriendo la sesión');
      return body;
    },
    onSuccess: (b: any) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedItem, fechaLista] });
      toast({ title: '🔓 Lista reabierta', description: b?.aviso });
    },
    onError: (err: any) => {
      toast({ title: 'No se pudo reabrir', description: err?.message, variant: 'destructive' });
    },
  });

  const handleWalkIn = async (athlete: RosterItem) => {
    if (!athlete.enrollment_id) {
      toast({ title: 'Sin inscripción activa', description: `${athlete.full_name} no tiene una inscripción activa en esta escuela.`, variant: 'destructive' });
      return;
    }
    setWalkInProcessing(true);
    try {
      const token = await getBearerToken();
      const payload: any = { enrollmentId: athlete.enrollment_id, status: 'present' };
      if (isTeam) payload.teamId = selectedTeamId;
      if (isSession) payload.sessionId = selectedSessionId;
      if (athlete.athlete_type === 'child') payload.childId = athlete.id;
      else if (athlete.athlete_type === 'adult') payload.userId = athlete.id;
      else payload.unregisteredAthleteId = athlete.id;

      const res = await fetch(`${BFF_URL}/api/v1/attendance/walk-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error en walk-in');

      setAttendanceState((prev) => ({ ...prev, [athlete.id]: 'present' }));
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedItem] });
      queryClient.invalidateQueries({ queryKey: ['attendance-roster', contextType, contextId] });

      const walkInMsg: Record<string, string> = {
        deducted:           'Asistencia registrada · se descontó 1 clase del plan.',
        covered_by_booking: 'Asistencia registrada · ya tenía reserva para hoy, no se descontó otra clase.',
        no_plan:            'Asistencia registrada · no maneja plan de clases.',
        no_credits:         'Asistencia registrada · el plan no tiene clases disponibles.',
        expired:            'Asistencia registrada · el plan está vencido.',
      };
      toast({
        title: `✅ ${athlete.full_name} registrado`,
        description: walkInMsg[body.credit_outcome] ?? 'Asistencia registrada.',
      });
      setWalkInOpen(false);
      setWalkInSearch('');
      setWalkInAthlete(null);
    } catch (err: any) {
      toast({ title: 'Error en walk-in', description: err.message, variant: 'destructive' });
    } finally {
      setWalkInProcessing(false);
    }
  };

  const handleItemChange = (val: string) => {
    setSelectedItem(val);
    setAttendanceState({});
    setAutoSelectedLabel(null);
    // Recuerda el equipo elegido por día de la semana — es la señal 2 de la
    // auto-selección (§1.2) para escuelas sin sesión programada (caso Dynasty).
    if (val.startsWith('team:')) {
      try {
        localStorage.setItem(`sm_last_team_weekday_${new Date().getDay()}`, val.split(':')[1]);
      } catch {
        // localStorage puede fallar en privado/incógnito; no bloquea nada, solo
        // significa que la próxima vez no habrá sugerencia.
      }
    }
  };

  const markAllPresent = () => {
    const newState: Record<string, AttendanceStatus> = {};
    combinedRoster.forEach((s) => (newState[s.id] = 'present'));
    setAttendanceState(newState);
    toast({ title: '✅ Todos marcados como presentes' });
  };

  const getButtonVariant = (studentId: string, status: AttendanceStatus) =>
    attendanceState[studentId] === status ? 'default' : 'outline';

  const markedCount = Object.keys(attendanceState).length;
  const isBusy = saveMutation.isPending || finalizeMutation.isPending;
  const isLoading = loadingTeams || loadingOfferings || loadingPlans || loadingPT;

  return (
    <div className="space-y-6 pb-24 sm:pb-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asistencias</h1>
          <p className="text-muted-foreground mt-1">Toma lista rápidamente</p>
        </div>
        <Button
          variant="outline"
          className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
          onClick={() => navigate('/coach-attendance/scan')}
        >
          <ScanLine className="w-4 h-4" />
          Escanear carnet
        </Button>
      </div>

      {/* Sin ficha de staff no matchea ningún equipo y la lista queda vacía,
          igual que si no tuviera nada asignado. El admin no la necesita: ve
          todos los equipos sin filtrar. */}
      {!isAdmin && (
        <AvisoFichaStaff
          estado={estadoFicha}
          onReintentar={refetchFicha}
          queSePierde="tus equipos para pasar lista"
        />
      )}

      {!selectedItem ? (
        <div className="space-y-8">
          {/* Equipos */}
          {teams.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Equipos Regulares</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team: any) => {
                  const vis = getSportVisual(team.sport);
                  return (
                    <Card
                      key={team.id}
                      onClick={() => handleItemChange(`team:${team.id}`)}
                      className="group relative overflow-hidden border-none bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-red-900/40 cursor-pointer"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl border border-white/20 shrink-0">
                            {vis.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Coach</p>
                            <h4 className="text-lg font-black leading-tight truncate uppercase tracking-tighter">{team.name}</h4>
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              <Badge variant="outline" className="border-white/30 text-white bg-white/10 text-[10px] font-bold py-0 px-2 h-5 lowercase">
                                <Trophy className="h-3 w-3 mr-1" />{team.sport || 'Deporte'}
                              </Badge>
                              <div className="flex items-center gap-1.5 px-2 py-0 h-5 bg-white/10 rounded-full border border-white/20 text-[10px] font-bold">
                                <Users className="w-3 h-3" />
                                {team.current_students}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 opacity-40 self-center shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Planes — oculto SOLO para escuelas con teamsOnlyMode (mig.
              20260902110253, hoy únicamente Dynasty). `offerings` trae TODO el
              catálogo activo de la escuela sin filtrar por coach (a diferencia
              de `teams`, que sí filtra por team_coaches/coach_id) — en una
              escuela grande y multi-disciplina es ruido. Pero otras escuelas
              organizan la asistencia por PLAN y no por equipo — para esas,
              ocultarlo les rompería el flujo real, así que el default es
              mostrarlo como siempre. */}
          {!teamsOnlyMode && offerings.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Planes</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {offerings.map((off) => {
                  const visual = getPlanVisual(off.name);
                  const VisualIcon = visual.icon;
                  return (
                    <Card
                      key={off.id}
                      onClick={() => handleItemChange(`offering:${off.id}`)}
                      className={`group relative overflow-hidden border-none bg-gradient-to-br ${visual.gradient} text-white shadow-lg transition-all hover:scale-[1.02] ${visual.glow} cursor-pointer`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
                            <VisualIcon className={`h-7 w-7 ${visual.accent}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Mis Planes</p>
                            <h4 className="text-lg font-black leading-tight truncate uppercase tracking-tighter">{off.name}</h4>
                            <div className="flex items-center gap-2 mt-3">
                              <div className="flex items-center gap-1 px-2 py-0 h-5 bg-white/10 rounded-full border border-white/20 text-[10px] font-bold capitalize">
                                <Zap className="h-3 w-3" />
                                {off.offering_type?.replace(/_/g, ' ') ?? 'Plan'}
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-0 h-5 bg-white/10 rounded-full border border-white/20 text-[10px] font-bold">
                                <Users className="w-3 h-3" />
                                {off.current_students}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 opacity-40 self-center shrink-0" />
                        </div>
                        <VisualIcon className="absolute -bottom-3 -right-3 h-20 w-20 opacity-10 rotate-12" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reservas del día (Solo para PT) */}
          {ptSessions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                    Reservas del día
                  </h2>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold py-0 h-5 border-indigo-200 text-indigo-600 bg-indigo-50">
                  PT Sessions
                </Badge>
              </div>

              <div className="space-y-3">
                {ptSessions.map((sess: any) => {
                  const isCompleted = sess.status === 'completed';
                  return (
                    <Card key={sess.id} className="overflow-hidden border-border/40 hover:border-indigo-200 transition-all bg-card/60 backdrop-blur-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Avatar del Cliente */}
                          <Avatar className="h-12 w-12 border-2 border-indigo-100/50 shadow-sm shrink-0">
                            <AvatarImage src={sess.client?.avatar_url || ''} />
                            <AvatarFallback className="bg-indigo-50 text-indigo-600 text-xs font-bold">
                              {sess.client?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'C'}
                            </AvatarFallback>
                          </Avatar>

                          {/* Info de la Sesión */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="text-sm font-bold truncate text-foreground">
                                {sess.client?.full_name || 'Nuevo Cliente'}
                              </h4>
                              {isCompleted ? (
                                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] py-0 h-4">Asistió</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] py-0 h-4 opacity-50">Pendiente</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1 font-medium bg-muted/50 px-1.5 py-0.5 rounded-md">
                                <Clock className="w-3 h-3" />
                                {sess.session_time?.substring(0, 5)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Activity className="w-3 h-3 text-indigo-400" />
                                Sesión PT
                              </span>
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Advertencia sin rutina */}
                            {!isCompleted && sess.status !== 'no_show' && (!sess.blocks || sess.blocks?.length === 0) && (
                              <div title="Sin rutina asignada" className="h-7 w-7 flex items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              </div>
                            )}

                            {/* Botón Asistió */}
                            <Button
                              size="sm"
                              disabled={updatingPT || sess.status === 'no_show'}
                              variant={isCompleted ? 'secondary' : 'default'}
                              className={`h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                isCompleted
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200 border-none'
                                  : sess.status === 'no_show'
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20'
                              }`}
                              onClick={() => {
                                if (isCompleted || sess.status === 'no_show') return;
                                if (!sess.blocks || sess.blocks?.length === 0) {
                                  toast({
                                    title: '⚠️ Sin rutina asignada',
                                    description: 'Esta sesión no tiene rutina. Puedes continuar o asignarla desde el perfil del cliente.',
                                  });
                                }
                                updatePTAttendance(
                                  { sessionId: sess.id, status: 'completed' },
                                  { onSuccess: () => toast({ title: '✅ Marcado como Asistió' }) }
                                );
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {isCompleted ? 'Asistió' : sess.status === 'no_show' ? 'No asistió' : 'Asistió'}
                            </Button>

                            {/* Botón No asistió */}
                            {!isCompleted && sess.status !== 'no_show' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updatingPT}
                                className="h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                                onClick={() => setNoShowDialog({ open: true, session: sess })}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                No asistió
                              </Button>
                            )}

                            {/* Botón cancelar sesión (PT cancela) */}
                            {!isCompleted && sess.status !== 'no_show' && sess.status !== 'cancelled' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={updatingPT}
                                className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Cancelar sesión"
                                onClick={async () => {
                                  try {
                                    const token = await getBearerToken();
                                    const res = await fetch(`${BFF_URL}/api/v1/trainer/availability/session/${sess.id}`, {
                                      method: 'DELETE',
                                      headers: { Authorization: `Bearer ${token}` },
                                    });
                                    if (!res.ok) throw new Error((await res.json()).error);
                                    toast({ title: '🚫 Sesión cancelada', description: 'El crédito fue devuelto al cliente.' });
                                    queryClient.invalidateQueries({ queryKey: ['coach-pt-sessions'] });
                                  } catch (err: any) {
                                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                  }
                                }}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sesiones de hoy */}
          {showPlanSessions && planSessions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Clases Reservadas Hoy</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {planSessions.map((ps: any) => (
                  <Card
                    key={ps.id}
                    onClick={() => handleItemChange(`session:${ps.id}`)}
                    className="group relative overflow-hidden border-none bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-indigo-900/40 cursor-pointer"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl border border-white/20 shrink-0">
                          <Clock className="h-7 w-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Sesión Hoy</p>
                          <h4 className="text-lg font-black leading-tight truncate uppercase tracking-tighter">{ps.name}</h4>
                          <div className="flex items-center gap-2 mt-3">
                            <div className="flex items-center gap-1.5 px-2 py-0 h-5 bg-white/10 rounded-full border border-white/20 text-[10px] font-bold">
                              {ps.start_time?.substring(0, 5) ?? 'S/H'} – {ps.end_time?.substring(0, 5) ?? 'S/H'}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 opacity-40 self-center shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <Button variant="ghost" className="mb-4 gap-2" onClick={() => { setSelectedItem(''); setAutoSelectedLabel(null); }}>
            <ChevronRight className="w-4 h-4 rotate-180" /> Volver a la selección
          </Button>
          {autoSelectedLabel && (
            <Alert className="mb-4 border-primary/30 bg-primary/5">
              <Zap className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs flex items-center justify-between gap-3 flex-wrap">
                <span>{autoSelectedLabel}</span>
                <button
                  type="button"
                  className="text-primary font-semibold underline underline-offset-2 shrink-0"
                  onClick={() => { setSelectedItem(''); setAutoSelectedLabel(null); }}
                >
                  No es esta, cambiar
                </button>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {selectedItem && (
        <>
          {loadingRoster || loadingSession ? (
            <LoadingSpinner text="Cargando lista..." />
          ) : (
            <>
              {isFinalized && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Sesión finalizada</p>
                      <p className="text-sm">Los registros están bloqueados.</p>
                    </div>
                  </div>
                  <Button
                    variant="outline" size="sm" className="h-8 text-xs"
                    disabled={reopenMutation.isPending}
                    onClick={() => reopenMutation.mutate()}
                  >
                    {reopenMutation.isPending ? 'Reabriendo…' : '🔓 Reabrir para corregir'}
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-4 bg-muted/30 p-4 rounded-xl border">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <p className="font-bold text-sm tracking-tight">{combinedRoster.length} Atletas</p>
                  </div>
                  <div className="h-4 w-[1px] bg-border" />
                  <div className="flex items-center gap-2">
                    <Switch id="secondary-mode-coach" checked={isSecondary} onCheckedChange={setIsSecondary} />
                    <Label htmlFor="secondary-mode-coach" className="text-xs font-bold cursor-pointer uppercase tracking-wider text-muted-foreground">
                      Clase secundaria
                    </Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isFinalized && combinedRoster.length > 0 && (
                    <Button onClick={markAllPresent} variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/5">
                      ✅ Todos presentes
                    </Button>
                  )}
                  {!isFinalized && (
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest gap-1.5" onClick={() => setWalkInOpen(true)}>
                      <Search className="w-3.5 h-3.5" /> Walk-in
                    </Button>
                  )}
                </div>
              </div>

              {/* ── Fecha de la lista ────────────────────────────────────
                  Hasta ahora solo se podía pasar lista del día en curso: el
                  entrenador que olvidaba un día no tenía cómo completarlo. */}
              <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="fecha-lista" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Día de la lista
                  </Label>
                  <Input
                    id="fecha-lista"
                    type="date"
                    value={fechaLista}
                    min={fechaMinima}
                    max={hoy}
                    onChange={(e) => setFechaLista(e.target.value || hoy)}
                    className="h-8 w-auto text-sm"
                  />
                </div>
                {esRetroactiva && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFechaLista(hoy)}>
                    Volver a hoy
                  </Button>
                )}
              </div>

              {esRetroactiva && (
                <Alert>
                  <CalendarCheck className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Estás completando la lista del <strong>{formatHumanDate(fechaLista)}</strong>, no la de hoy.
                    Las clases se descuentan del plan con esa fecha, así que un atleta cuyo plan ya
                    estaba vencido ese día queda registrado pero sin descuento.
                    {!isAdmin && ` Puedes retroceder hasta ${RETRO_DIAS_COACH} días; para algo más antiguo, pídeselo a la administración.`}
                  </AlertDescription>
                </Alert>
              )}

              {/* Quien no tiene equipo asignado no sale en NINGÚN roster. Sin
                  esto, el entrenador no puede distinguirlo de "ese atleta no
                  existe" y lo busca donde nunca va a estar. */}
              {isTeam && (rosterData?.atletas_sin_equipo ?? 0) > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Hay <strong>{rosterData?.atletas_sin_equipo}</strong>{' '}
                    {rosterData?.atletas_sin_equipo === 1 ? 'atleta activo' : 'atletas activos'} en la escuela
                    sin equipo asignado. No {rosterData?.atletas_sin_equipo === 1 ? 'aparece' : 'aparecen'} en
                    esta lista ni en la de ningún otro equipo. Si {rosterData?.atletas_sin_equipo === 1 ? 'entrena' : 'entrenan'}{' '}
                    acá, asígnale{rosterData?.atletas_sin_equipo === 1 ? '' : 's'} equipo desde Atletas —
                    o márca{rosterData?.atletas_sin_equipo === 1 ? 'lo' : 'los'} con Walk-in por hoy.
                  </AlertDescription>
                </Alert>
              )}

                {combinedRoster.map((student) => {
                  const current = attendanceState[student.id];
                  return (
                    <Card key={student.id} className={`overflow-hidden transition-all border ${
                      current === 'present' ? 'border-green-500/40 bg-green-500/5'
                      : current === 'absent' ? 'border-red-500/30 bg-red-500/5'
                      : current === 'late' ? 'border-yellow-500/40 bg-yellow-500/5'
                      : current === 'excused' ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-border bg-card shadow-sm'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 overflow-hidden">
                            {student.avatar_url ? <img src={student.avatar_url} className="w-full h-full object-cover" /> : student.full_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm truncate uppercase tracking-tight">{student.full_name}</p>
                              {student.athlete_type === 'unregistered' && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 gap-1">
                                  <UserX className="w-2.5 h-2.5" /> Invitado
                                </Badge>
                              )}
                              {student.plan?.is_expired && (
                                <Badge variant="destructive" className="text-[10px] h-4 px-1 gap-1 uppercase font-black">
                                  Vencido
                                </Badge>
                              )}
                            </div>
                            {student.plan ? <PlanInfoCard plan={student.plan} /> : (
                              <p className="text-[11px] text-muted-foreground mt-1">No maneja plan de clases</p>
                            )}
                            {student.booking_today && (
                              <p className="text-[11px] mt-1 flex items-center gap-1 text-blue-600 font-medium">
                                <Clock className="w-3 h-3 shrink-0" />
                                {student.booking_today.status === 'attended'
                                  ? `Reserva de hoy ya usada${formatHour(student.booking_today.start_time) ? ` (${formatHour(student.booking_today.start_time)})` : ''}`
                                  : `Ya reservó hoy${formatHour(student.booking_today.start_time) ? ` (${formatHour(student.booking_today.start_time)})` : ''} — no se descuenta otra clase`}
                              </p>
                            )}
                          </div>

                          {!isFinalized ? (
                            <div className="flex gap-1 shrink-0 mt-0.5">
                              {(Object.keys(STATUS_CFG) as AttendanceStatus[]).map((s) => (
                                <button
                                  key={s}
                                  title={STATUS_CFG[s].label}
                                  onClick={() => setAttendanceState((prev) =>
                                    prev[student.id] === s
                                      ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== student.id))
                                      : { ...prev, [student.id]: s }
                                  )}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                                    current === s ? STATUS_CFG[s].active : STATUS_CFG[s].inactive
                                  }`}
                                >
                                  {STATUS_CFG[s].icon}
                                </button>
                              ))}
                            </div>
                          ) : (
                            current ? (
                              <div className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider shrink-0 ${
                                current === 'present' ? 'text-green-500' : current === 'absent' ? 'text-red-500' : 'text-primary'
                              }`}>
                                {STATUS_CFG[current].icon}
                                {STATUS_CFG[current].label}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground shrink-0 italic">Sin marcar</span>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

              {!isFinalized && combinedRoster.length > 0 && (
                <div className="sticky bottom-16 sm:bottom-0 z-10 bg-background/95 backdrop-blur border-t pt-3 pb-3 flex flex-col sm:flex-row gap-3">
                  <Button className="flex-1" size="lg" onClick={() => saveMutation.mutate()} disabled={isBusy}>
                    {saveMutation.isPending ? 'Guardando...' : 'Guardar asistencia'}
                  </Button>
                  {isEditMode && (
                    <Button variant="destructive" size="lg" onClick={() => setFinalizeDialogOpen(true)} disabled={isBusy}>
                      <Flag className="w-4 h-4 mr-2" /> Finalizar sesión
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Dialogs: Finalize, Walk-in (omitted for brevity in this replace, user provided full file) */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Finalizar sesión</DialogTitle>
            <DialogDescription>Una vez finalizada, los registros quedarán bloqueados.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { setFinalizeDialogOpen(false); finalizeMutation.mutate(); }}>Sí, finalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Walk-in — Registro en Recepción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Buscar por nombre..." value={walkInSearch} onChange={(e) => setWalkInSearch(e.target.value)} />
            <div className="max-h-60 overflow-y-auto space-y-2">
              {walkInResults.map((a) => (
                <button key={a.id} className="w-full text-left p-3 border rounded-lg hover:bg-muted" onClick={() => setWalkInAthlete(a)}>
                  {a.full_name}
                </button>
              ))}
            </div>
            {walkInAthlete && (
              <div className="border p-4 rounded-xl bg-muted/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
                    {walkInAthlete.avatar_url ? <img src={walkInAthlete.avatar_url} className="w-full h-full object-cover" /> : walkInAthlete.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm uppercase tracking-tight">{walkInAthlete.full_name}</p>
                    <Badge variant="outline" className="text-[10px] h-4 mt-0.5">Atleta</Badge>
                  </div>
                </div>
                {walkInAthlete.plan ? <PlanInfoCard plan={walkInAthlete.plan} /> : (
                  <p className="text-xs text-muted-foreground bg-white/50 p-2 rounded border border-dashed text-center">Sin plan activo</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkInOpen(false)}>Cancelar</Button>
            <Button disabled={!walkInAthlete || walkInProcessing} onClick={() => walkInAthlete && handleWalkIn(walkInAthlete)}>
              {walkInProcessing ? 'Registrando...' : 'Registrar entrada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: No asistió */}
      <Dialog
        open={noShowDialog.open}
        onOpenChange={(open) => !open && setNoShowDialog({ open: false, session: null })}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              ¿Qué hacer con la sesión?
            </DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">
                {noShowDialog.session?.client?.full_name}
              </span>{' '}
              no asistió a la sesión de las{' '}
              <span className="font-semibold">
                {noShowDialog.session?.session_time?.substring(0, 5)}
              </span>.
              ¿Deseas devolver el crédito o descontarlo?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-2">
            {/* Devolver crédito */}
            <button
              disabled={processingNoShow}
              onClick={() =>
                handleNoShow(
                  { sessionId: noShowDialog.session.id, action: 'return_credit' },
                  {
                    onSuccess: () => {
                      toast({
                        title: '↩️ Crédito devuelto',
                        description: 'La sesión fue cancelada y el crédito restaurado al cliente.',
                      });
                      setNoShowDialog({ open: false, session: null });
                    },
                    onError: (e: any) =>
                      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
                  }
                )
              }
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-blue-700">
                Devolver crédito
              </span>
              <span className="text-[10px] text-blue-500 text-center leading-tight">
                Cancela la sesión y restaura el crédito al cliente
              </span>
            </button>

            {/* Descontar crédito */}
            <button
              disabled={processingNoShow}
              onClick={() =>
                handleNoShow(
                  { sessionId: noShowDialog.session.id, action: 'deduct' },
                  {
                    onSuccess: () => {
                      toast({
                        title: '✂️ Crédito descontado',
                        description: 'La sesión fue marcada como inasistencia.',
                      });
                      setNoShowDialog({ open: false, session: null });
                    },
                    onError: (e: any) =>
                      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
                  }
                )
              }
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-red-700">
                Descontar crédito
              </span>
              <span className="text-[10px] text-red-500 text-center leading-tight">
                Marca inasistencia sin devolver el crédito
              </span>
            </button>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={processingNoShow}
              onClick={() => setNoShowDialog({ open: false, session: null })}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}