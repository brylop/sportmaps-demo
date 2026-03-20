import { useState, useMemo } from 'react';
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
  Calendar as CalendarIcon, TrendingUp
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getSportVisual } from '@/lib/sportVisuals';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';

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
  is_booking?: boolean;
  payment: { status: string; due_date: string | null } | null;
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
export default function CoachAttendancePage() {
  const { user, profile } = useAuth();
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedItem, setSelectedItem] = useState<string>('');
  const [isSecondary, setIsSecondary] = useState(false);
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);

  // Walk-in state
  const [walkInSearch, setWalkInSearch] = useState('');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInAthlete, setWalkInAthlete] = useState<RosterItem | null>(null);
  const [walkInProcessing, setWalkInProcessing] = useState(false);

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
  const { data: staffData } = useQuery({
    queryKey: ['staff-profile', user?.id, schoolId],
    queryFn: async () => {
      if (!user?.id || !schoolId) return null;
      const { data } = await supabase
        .from('school_staff')
        .select('id')
        .eq('coach_auth_id', user.id)
        .eq('school_id', schoolId)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!schoolId
  });
  const staffId = staffData?.id;

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
      const today = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('attendance_sessions')
        .select(`id, start_time, end_time, title, offering_plans!attendance_sessions_offering_id_fkey(name)`)
        .eq('school_id', schoolId)
        .eq('session_date', today)
        .not('offering_id', 'is', null)
        .not('finalized', 'is', true);
      if (!isAdmin) query = query.eq('coach_id', staffId || user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        name: s.title || (s.offering_plans as any)?.name || 'Clase de Plan',
        start_time: s.start_time,
        end_time: s.end_time,
      }));
    },
    enabled: !!schoolId && (!!user?.id || !!staffId),
  });

  // ── 4. Roster unificado (via BFF) ───────────────────────────────────────
  const {
    data: rosterData,
    isLoading: loadingRoster,
  } = useQuery<{ athletes: RosterItem[]; bookings: any[] }>({
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
    queryKey: ['attendance-session', selectedItem],
    queryFn: async () => {
      if (!selectedItem) return { session: null, records: [] };
      if (isTeam) {
        const token = await getBearerToken();
        const res = await fetch(`${BFF_URL}/api/v1/attendance/session/${selectedTeamId}`, {
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
        const today = new Date().toISOString().split('T')[0];
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
  useMemo(() => {
    if (sessionData?.records?.length) {
      const preloaded: Record<string, AttendanceStatus> = {};
      sessionData.records.forEach((r: any) => {
        const id = r.child_id ?? r.user_id ?? r.unregistered_athlete_id;
        if (id) preloaded[id] = r.status as AttendanceStatus;
      });
      setAttendanceState(preloaded);
    }
  }, [sessionData]);

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

      // Presentes → walk-in con descuento
      for (const [id] of presentEntries) {
        const a = athletes.find((x) => x.id === id);
        if (!a || !a.enrollment_id) continue;
        const payload: any = { enrollmentId: a.enrollment_id, is_secondary: isSecondary, status: 'present' };
        if (isTeam)     payload.teamId     = selectedTeamId;
        if (isSession)  payload.sessionId  = selectedSessionId;
        if (isOffering) payload.offeringId = selectedOfferingId;
        if (a.athlete_type === 'child')        payload.childId               = id;
        else if (a.athlete_type === 'adult')   payload.userId                = id;
        else                                    payload.unregisteredAthleteId = id;

        const res = await fetch(`${BFF_URL}/api/v1/attendance/walk-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json();
          const msgs: Record<string, string> = {
            expired:              `${a.full_name}: plan vencido`,
            no_credits:           `${a.full_name}: sin clases disponibles`,
            no_secondary_credits: `${a.full_name}: sin clases secundarias`,
            not_found:            `${a.full_name}: sin plan activo`,
          };
          walkInErrors.push(msgs[body.reason] || `${a.full_name}: ${body.error}`);
        }
      }

      // Otros estados → registro sin descuento
      if (otherEntries.length > 0) {
        if (isTeam || isSession) {
          // Equipo o Sesión existente → POST /session directo
          const records = otherEntries.map(([id, status]) => {
            const a = athletes.find((x) => x.id === id);
            return {
              childId:               a?.athlete_type === 'child'        ? id : undefined,
              userId:                a?.athlete_type === 'adult'         ? id : undefined,
              unregisteredAthleteId: a?.athlete_type === 'unregistered' ? id : undefined,
              status,
            };
          });
          const sessionPayload: any = { records };
          if (isTeam)      sessionPayload.teamId    = selectedTeamId;
          if (session?.id) sessionPayload.sessionId = session.id;

          const res = await fetch(`${BFF_URL}/api/v1/attendance/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(sessionPayload),
          });
          if (!res.ok) { const b = await res.json(); throw new Error(b.error); }

        } else if (isOffering) {
          // Offering → walk-in por cada atleta (sin descuento porque status != present)
          for (const [id, status] of otherEntries) {
            const a = athletes.find((x) => x.id === id);
            if (!a?.enrollment_id) continue;
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
            // Ignorar errores de plan en estados no-present
            if (!res.ok) {
              const b = await res.json();
              if (!['expired', 'no_credits', 'no_session'].includes(b.reason)) {
                throw new Error(b.error);
              }
            }
          }
        }
      }

      if (walkInErrors.length) throw new Error(walkInErrors.join('\n'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedItem] });
      toast({ title: '✅ Asistencia guardada' });
    },
    onError: (e: any) => toast({ title: 'Algunos registros no se guardaron', description: e.message, variant: 'destructive' }),
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
      queryClient.invalidateQueries({ queryKey: ['attendance-session', selectedItem] });
      toast({ title: '🏁 Sesión finalizada', description: 'Los datos quedan bloqueados.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error al finalizar', description: err?.message, variant: 'destructive' });
    },
  });

  const handleWalkIn = async (athlete: RosterItem) => {
    if (!athlete.enrollment_id) {
      toast({ title: 'Sin plan activo', description: `${athlete.full_name} no tiene un plan activo.`, variant: 'destructive' });
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

      toast({ title: `✅ ${athlete.full_name} registrado`, description: 'Asistencia registrada y crédito descontado.' });
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
  const isLoading = loadingTeams || loadingOfferings || loadingPlans;

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      <div>
        <h1 className="text-3xl font-bold">Asistencias</h1>
        <p className="text-muted-foreground mt-1">Toma lista rápidamente</p>
      </div>

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

          {/* Planes */}
          {offerings.length > 0 && (
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

          {/* Sesiones de hoy */}
          {planSessions.length > 0 && (
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
                              {ps.start_time.substring(0, 5)} – {ps.end_time.substring(0, 5)}
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
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => setSelectedItem('')}>
          <ChevronRight className="w-4 h-4 rotate-180" /> Volver a la selección
        </Button>
      )}

      {selectedItem && (
        <>
          {loadingRoster || loadingSession ? (
            <LoadingSpinner text="Cargando lista..." />
          ) : (
            <>
              {isFinalized && (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
                  <Lock className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Sesión finalizada</p>
                    <p className="text-sm">Los registros están bloqueados.</p>
                  </div>
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
                              <p className="text-[11px] text-muted-foreground mt-1">Sin plan activo</p>
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
    </div>
  );
}