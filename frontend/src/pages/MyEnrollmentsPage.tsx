import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Users, Calendar, Clock, MapPin, Zap, Trophy,
  ChevronRight, CalendarCheck, Map as MapIcon,
  Building2, Star, Target, CalendarDays,
  XCircle, CheckCircle2, X, ChevronLeft,
} from 'lucide-react';
import {
  format, parseISO, addDays, startOfDay,
  startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useEnrollments } from '@/hooks/useEnrollments';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSportVisual } from '@/lib/sportVisuals';
import { useToast } from '@/hooks/use-toast';
import { AthleteClassBooking } from '@/components/athlete/AthleteClassBooking';
import {
  useAvailableSessions,
  useUpcomingSessions,
  useMyBookings,
  useMySecondaryBookings,
  useBookSession,
  useBookSecondarySession,
  useCancelBooking,
  useCancelSecondaryBooking,
  useFacilitySlots,
  useAthleteFacilities,
  BookableSession,
} from '@/hooks/useAthleteSessionBookings';

// ─── Constants ────────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

function fmtDateShort(d: string) {
  if (!d) return '';
  return format(parseISO(d), "EEE d MMM", { locale: es });
}

function fmtDateLong(d: string) {
  if (!d) return '';
  return format(parseISO(d), "EEEE d 'de' MMMM", { locale: es });
}

function groupByDate(sessions: BookableSession[]) {
  return sessions.reduce<Record<string, BookableSession[]>>((acc, s) => {
    acc[s.session_date] = [...(acc[s.session_date] ?? []), s];
    return acc;
  }, {});
}

// próximos 14 días a partir de mañana:
function getNextAvailableDates(count = 14) {
  const dates: string[] = [];
  let d = startOfDay(new Date());
  while (dates.length < count) {
    d = addDays(d, 1);
    dates.push(format(d, 'yyyy-MM-dd'));
  }
  return dates;
}

function getPlanVisual(name: string = '') {
  const n = name.toLowerCase();
  
  if (n.includes('elite') || n.includes('premium') || n.includes('oro') || n.includes('gold') || n.includes('black')) {
    return {
      gradient: 'from-zinc-900 via-zinc-800 to-black',
      accent: 'text-amber-400',
      tag: 'bg-amber-400/20 text-amber-400 border-amber-400/30',
      icon: Trophy,
      glow: 'shadow-amber-900/20',
      label: 'PLAN'
    };
  }
  
  if (n.includes('combate') || n.includes('mma') || n.includes('box') || n.includes('warrior')) {
    return {
      gradient: 'from-rose-700 via-rose-800 to-red-950',
      accent: 'text-white',
      tag: 'bg-white/20 text-white border-white/20',
      icon: Target,
      glow: 'shadow-red-900/30',
      label: 'PLAN'
    };
  }
  
  if (n.includes('gym') || n.includes('fitness') || n.includes('musculo') || n.includes('iron')) {
    return {
      gradient: 'from-orange-500 via-orange-600 to-amber-700',
      accent: 'text-white',
      tag: 'bg-white/20 text-white border-white/20',
      icon: Zap,
      glow: 'shadow-orange-900/20',
      label: 'PLAN'
    };
  }
  
  if (n.includes('yoga') || n.includes('zen') || n.includes('paz') || n.includes('balance') || n.includes('wellness')) {
    return {
      gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
      accent: 'text-white',
      tag: 'bg-white/20 text-white border-white/20',
      icon: Star,
      glow: 'shadow-emerald-900/20',
      label: 'PLAN'
    };
  }

  if (n.includes('basico') || n.includes('básico') || n.includes('estandar') || n.includes('estándar') || n.includes('base') || n.includes('inicial')) {
    return {
      gradient: 'from-slate-500 via-slate-600 to-slate-700',
      accent: 'text-white',
      tag: 'bg-white/20 text-white border-white/20',
      icon: Target,
      glow: 'shadow-slate-900/20',
      label: 'PLAN'
    };
  }

  if (n.includes('full') || n.includes('completo') || n.includes('total') || n.includes('platinum')) {
    return {
      gradient: 'from-blue-600 via-blue-700 to-indigo-900',
      accent: 'text-white',
      tag: 'bg-white/20 text-white border-white/20',
      icon: Zap,
      glow: 'shadow-blue-900/30',
      label: 'PLAN'
    };
  }
  
  // Default (Blue/Purple)
  return {
    gradient: 'from-[#6366f1] via-[#8b5cf6] to-[#a855f7]',
    accent: 'text-white',
    tag: 'bg-white/20 text-white border-white/20',
    icon: Zap,
    glow: 'shadow-purple-900/30',
    label: 'PLAN'
  };
}



// ─── Shared Stat ──────────────────────────────────────────────────────────────

const StatItem = ({ icon: Icon, label, value, colorClass }: {
  icon: any; label: string; value: number | string; colorClass: string;
}) => (
  <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-card border border-border/40 shadow-sm transition-all hover:border-primary/20">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass} shadow-inner`}>
      <Icon className="h-6 w-6" />
    </div>
    <div>
      <p className="text-2xl font-black leading-tight tracking-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60">{label}</p>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyEnrollmentsPage() {
  const { activeEnrollments, loading: activeIsLoading } = useEnrollments();
  const { data: upcomingData } = useUpcomingSessions();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'groups' | 'classes' | 'reservations'>('groups');
  // ── Modal State ──
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [scheduleEnrollment, setScheduleEnrollment] = useState<any>(null);
  const [reservingFacility, setReservingFacility] = useState<{ id: string; name: string } | null>(null);

  // ── Reservas Confirmadas del Atleta ──
  const { data: myBookingsData, isLoading: myBookingsLoading } = useMyBookings();
  const { data: mySecBookings, isLoading: mySecLoading } = useMySecondaryBookings();
  const { data: facilitiesData, isLoading: facilitiesLoading } = useAthleteFacilities();
  const { mutate: cancelBooking, isPending: isCanceling } = useCancelBooking();
  const [cancelingBookingId, setCancelingBookingId] = useState<string | null>(null);

  const athleteFacilities = facilitiesData?.facilities ?? [];

  if (activeIsLoading || myBookingsLoading || mySecLoading || !activeEnrollments) {
    return <LoadingSpinner fullScreen text="Cargando tu portal..." />;
  }

  const teamEnrollments = activeEnrollments.filter((e: any) => e.team_id && !e.offering_plan_id);
  const planEnrollments = activeEnrollments.filter((e: any) => e.offering_plan_id);

  const upcomingSessions = upcomingData?.sessions ?? [];
  
  // Encontrar si algún plan tiene secundarias (GYM) para el label de la pestaña
  const enrollmentWithSec = activeEnrollments.find((e: any) => (e.offering_plans?.max_secondary_sessions ?? 0) > 0);
  const secondaryLabel = enrollmentWithSec?.offering_plans?.secondary_session_label || 'Reservas';

  const totalMyClasses = myBookingsData?.filter((b: any) => b.status?.toLowerCase() !== 'cancelled').length ?? 0;
  const totalMyReservations = mySecBookings?.filter((b: any) => b.status?.toLowerCase() !== 'cancelled').length ?? 0;

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="container max-w-7xl mx-auto px-4 pt-2 space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">Portal del Atleta</p>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">Mis Inscripciones</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatItem icon={Users}    label="Equipos"  value={teamEnrollments.length} colorClass="bg-blue-500/10 text-blue-500" />
          <StatItem icon={Zap}      label="Planes"   value={planEnrollments.length} colorClass="bg-purple-500/10 text-purple-500" />
          <StatItem icon={Calendar} label="Clases"   value={totalMyClasses}          colorClass="bg-green-500/10 text-green-500" />
          <StatItem icon={MapIcon}  label="Reservas" value={totalMyReservations}                      colorClass="bg-amber-500/10 text-amber-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── Main content ── */}
          <div className="lg:col-span-8 space-y-6">

            {/* Tabs */}
            <div className="flex gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/30 w-fit">
              {[
                { key: 'groups',       icon: Trophy,        label: 'Mis Grupos',  count: (teamEnrollments.length + planEnrollments.length) },
                { key: 'classes',      icon: CalendarCheck, label: 'Mis Clases',  count: totalMyClasses },
                { key: 'reservations', icon: MapPin,        label: 'Mis Reservas',count: totalMyReservations },
              ].map(({ key, icon: Icon, label, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    activeTab === key
                      ? 'bg-background text-foreground shadow-lg border border-border/50'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {count != null && count > 0 && <span className="opacity-40">{count}</span>}
                </button>
              ))}
            </div>

            {/* Tab: Mis Grupos */}
            {activeTab === 'groups' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Equipos */}
                <section>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                    Equipos ({teamEnrollments.length})
                  </h3>
                  {teamEnrollments.length === 0 ? (
                    <EmptyDashed icon={Users} text="No estás inscrito en ningún equipo de formación">
                      <Button variant="outline" size="sm" onClick={() => navigate('/explore')}>Buscar equipos</Button>
                    </EmptyDashed>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {teamEnrollments.map((e: any) => (
                        <TeamCard key={e.id} enrollment={e} onClick={() => setSelectedTeam(e)} />
                      ))}
                    </div>
                  )}
                </section>

                {/* Planes */}
                <section>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                    Planes ({planEnrollments.length})
                  </h3>
                  {planEnrollments.length === 0 ? (
                    <EmptyDashed icon={Zap} text="No tienes planes o membresías activas">
                      <Button variant="outline" size="sm" onClick={() => navigate('/explore')}>Ver membresías</Button>
                    </EmptyDashed>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {planEnrollments.map((e: any) => (
                        <PlanCard key={e.id} enrollment={e} onClick={() => setScheduleEnrollment(e)} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Tab: Mis Clases */}
            {activeTab === 'classes' && (
              <div className="animate-in fade-in duration-500">
                <MyBookingsTab 
                  hasSecondary={!!enrollmentWithSec} 
                  secLabel={secondaryLabel}
                  filter="primary"
                />
              </div>
            )}

            {/* Tab: Mis Reservas */}
            {activeTab === 'reservations' && (
              <div className="animate-in fade-in duration-500">
                <MyBookingsTab 
                  hasSecondary={!!enrollmentWithSec} 
                  secLabel={secondaryLabel}
                  filter="secondary"
                />
              </div>
            )}
          </div>

          {/* ── Side panel ── */}
          <div className="lg:col-span-4 space-y-6 sticky top-8">

            {/* Clases Programadas — datos reales */}
            <Card className="border-border/40 bg-muted/20">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Clases Programadas</h4>
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                </div>

                {upcomingSessions.length === 0 && !myBookingsData?.length ? (
                  <div className="py-6 text-center border-2 border-dashed border-border/40 rounded-xl px-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 leading-relaxed">
                      No hay clases programadas esta semana
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Reservas confirmadas del atleta - Filtrado para futuras o hoy */}
                    {myBookingsData
                      ?.filter((b) => {
                        const s = b.attendance_sessions;
                        if (!s) return false;
                        const today = new Date().toLocaleDateString('en-CA');
                        return s.session_date >= today;
                      })
                      .slice(0, 4)
                      .map((b) => {
                        const s = b.attendance_sessions;
                        if (!s) return null;

                        const today = new Date().toLocaleDateString('en-CA');
                        const isPast = s.session_date < today;

                        // Nombre: plan o equipo
                        const contextName = b.enrollments?.offering_plans?.name
                          ?? b.enrollments?.teams?.name
                          ?? 'Clase';

                        return (
                          <div key={b.id} className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                            isPast ? 'bg-muted/20 border-border/20 opacity-60' : 'bg-primary/5 border-primary/20'
                          }`}>
                            <div className="text-center shrink-0 w-10">
                              <p className="text-[9px] font-black uppercase text-muted-foreground capitalize leading-none">
                                {format(parseISO(s.session_date), 'EEE', { locale: es })}
                              </p>
                              <p className="text-lg font-black leading-tight">
                                {format(parseISO(s.session_date), 'd')}
                              </p>
                            </div>
                            <div className="w-px h-8 bg-border/40" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{contextName}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" />
                                {fmtTime(s.start_time)} — {fmtTime(s.end_time)}
                              </p>
                              {s.school_staff?.full_name && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                  {s.school_staff.full_name}
                                </p>
                              )}
                            </div>

                            {!isPast && !s.finalized && b.status === 'confirmed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelingBookingId(b.id);
                                }}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-background shadow-sm border rounded-full hover:text-destructive hover:border-destructive/30"
                                title="Cancelar clase"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {(!(!isPast && !s.finalized && b.status === 'confirmed')) && (
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 transition-opacity group-hover:opacity-20" />
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Instalaciones */}
            <Card className="border-border/40 bg-muted/20">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Instalaciones</h4>
                  <Badge variant="outline" className="text-[9px] h-4 py-0 font-bold border-green-500/30 text-green-500 bg-green-500/5">
                    {athleteFacilities.length}
                  </Badge>
                </div>

                {facilitiesLoading ? (
                  <div className="h-16 rounded-xl bg-muted/40 animate-pulse" />
                ) : athleteFacilities.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-4">
                    Tu escuela no tiene instalaciones disponibles
                  </p>
                ) : (
                  <div className="space-y-3">
                    {athleteFacilities.map((facility) => (
                      <div key={facility.id} className="flex items-center gap-4 bg-card/60 p-4 rounded-2xl border border-border/40">
                        <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center border border-border/50 shadow-sm">
                          <Building2 className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-black uppercase tracking-tight leading-none mb-1">{facility.name}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter opacity-70">{facility.type}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReservingFacility(facility);
                          }}
                          className="h-8 text-[10px] font-black uppercase px-4 border-border/80 hover:bg-primary/5 hover:border-primary/20"
                        >
                          Reservar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {selectedTeam && (
        <TeamDetailModal enrollment={selectedTeam} onClose={() => setSelectedTeam(null)} />
      )}

      {scheduleEnrollment && (
        <ScheduleClassModal
          enrollment={scheduleEnrollment}
          facilityId={athleteFacilities[0]?.id ?? ''}
          facilityName={athleteFacilities[0]?.name ?? ''}
          onClose={() => setScheduleEnrollment(null)}
        />
      )}

      {reservingFacility && (
        <FacilityReserveModal
          facilityId={reservingFacility.id}
          facilityName={reservingFacility.name}
          enrollment={planEnrollments[0] ?? null}
          onClose={() => setReservingFacility(null)}
        />
      )}

      {/* ── AlertDialog: Cancelar Reserva ── */}
      <AlertDialog
        open={!!cancelingBookingId}
        onOpenChange={(open) => !open && setCancelingBookingId(null)}
      >
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              ¿Cancelar esta clase?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción liberará tu cupo y se devolverá el crédito a tu plan.
              ¿Estás seguro que deseas cancelar tu asistencia?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={isCanceling}>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelingBookingId) {
                  cancelBooking(cancelingBookingId, {
                    onSuccess: () => {
                      toast({ title: '✅ Clase cancelada', description: 'Tu cupo ha sido liberado correctamente.' });
                      setCancelingBookingId(null);
                    },
                    onError: (err: any) => {
                      toast({ title: 'Error', description: err.message, variant: 'destructive' });
                    },
                  });
                }
              }}
              disabled={isCanceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCanceling ? 'Cancelando...' : 'Sí, cancelar clase'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function TeamCard({ enrollment, onClick }: { enrollment: any; onClick?: () => void }) {
  const vis = getSportVisual(enrollment.program?.sport);
  return (
    <Card
      onClick={onClick}
      className="group relative overflow-hidden border-none bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-red-900/40 cursor-pointer"
    >
      <CardContent className="p-6">
        <Badge className="absolute top-3 right-3 bg-black/20 text-white border-white/20 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
          ACTIVO
        </Badge>
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl border border-white/20 shrink-0">
            {vis.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Equipo</p>
            <h4 className="text-xl font-black leading-tight truncate uppercase tracking-tighter">{enrollment.program?.name}</h4>
            <div className="flex items-center gap-3 mt-4">
              <Badge variant="outline" className="border-white/30 text-white bg-white/10 text-[10px] font-bold py-0.5 px-2">
                <Trophy className="h-3 w-3 mr-1" />{enrollment.program?.sport || 'Deporte'}
              </Badge>
            </div>
          </div>
          <ChevronRight className="h-6 w-6 opacity-40 self-center" />
        </div>
      </CardContent>
    </Card>
  );
}

function PlanCard({ enrollment, onClick }: { enrollment: any; onClick?: () => void }) {
  const plan = enrollment.plan_details;
  const isUnlimited = !plan || plan.max_sessions === null;
  const creditsLeft = isUnlimited ? null : Math.max(0, (plan?.max_sessions ?? 0) - (enrollment.sessions_used ?? 0));
  const hasSecondary = (plan?.max_secondary_sessions ?? 0) > 0;
  const secLeft = Math.max(0, (plan?.max_secondary_sessions ?? 0) - (enrollment.secondary_sessions_used ?? 0));
  const secLabel = plan?.secondary_session_label || 'GYM';

  // "Plan" (Offering) arriba, "Tarifa" (offering_plan) abajo
  const offeringName = enrollment.offering?.name || enrollment.program?.name || 'Mi Plan';
  const tariffName = enrollment.offering_plan?.name || 'Plan';
  
  // Usar el nombre de la TARIFA (Full, Gold, etc) para el visual
  const visual = getPlanVisual(tariffName);
  const VisualIcon = visual.icon;

  // Días restantes
  const daysLeft = enrollment.expires_at
    ? Math.max(0, Math.ceil((new Date(enrollment.expires_at).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <Card
      onClick={onClick}
      className={`group relative overflow-hidden border-none bg-gradient-to-br ${visual.gradient} text-white shadow-lg transition-all hover:scale-[1.02] ${visual.glow} cursor-pointer`}
    >
      <CardContent className="p-6">
        <Badge className={`absolute top-3 right-3 ${visual.tag} text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity`}>
          ACTIVO
        </Badge>

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
            <VisualIcon className={`h-7 w-7 ${visual.accent}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1 truncate">
              {offeringName}
            </p>
            <h4 className="text-xl font-black leading-tight truncate uppercase tracking-tighter">
              {tariffName}
            </h4>

            {/* Créditos */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full border border-white/20 text-[10px] font-bold">
                <Zap className="h-3 w-3" />
                {isUnlimited ? 'Ilimitadas' : `${creditsLeft} clases`}
              </div>
              {hasSecondary && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full border border-white/20 text-[10px] font-bold">
                  <Building2 className="h-3 w-3" />
                  {secLeft}/{plan.max_secondary_sessions} {secLabel}
                </div>
              )}
            </div>

            {daysLeft !== null && (
              <p className="text-[10px] font-bold opacity-60 flex items-center gap-1 mt-2">
                <Clock className="h-3 w-3" />
                {daysLeft} días restantes
              </p>
            )}
          </div>
          <ChevronRight className="h-6 w-6 opacity-40 self-center shrink-0" />
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
          <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Toca para gestionar clases</p>
          <CalendarCheck className="h-3.5 w-3.5 opacity-60" />
        </div>

        <VisualIcon className="absolute -bottom-4 -right-4 h-32 w-32 opacity-10 rotate-12" />
      </CardContent>
    </Card>
  );
}

// ─── Modal: Gestión de clases ─────────────────────────────────────────────────

function ScheduleClassModal({ enrollment, facilityId, facilityName, onClose }: {
  enrollment: any;
  facilityId: string;
  facilityName: string;
  onClose: () => void;
}) {
  const plan = enrollment.plan_details;
  const isUnlimited = !plan || plan.max_sessions === null;
  const creditsLeft = isUnlimited ? null : Math.max(0, (plan?.max_sessions ?? 0) - (enrollment.sessions_used ?? 0));
  const hasSecondary = (plan?.max_secondary_sessions ?? 0) > 0;
  const secLeft = Math.max(0, (plan?.max_secondary_sessions ?? 0) - (enrollment.secondary_sessions_used ?? 0));
  const secLabel = plan?.secondary_session_label || 'GYM';
  const planName = enrollment.program?.name ?? plan?.name ?? '';
  const teamName = enrollment.program?.name ?? '';

  const [tab, setTab] = useState<'primary' | 'secondary'>('primary');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogTitle className="sr-only">Gestión de Clases</DialogTitle>

        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-border/30">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Gestión de Clases</p>
          <h2 className="text-lg font-black tracking-tight">{teamName}</h2>
        </div>

        {/* Plan summary bar */}
        <div className="px-6 py-3 border-b border-border/30 bg-muted/20 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{planName}</p>
              <p className="text-xs font-black">{isUnlimited ? '∞ ilimitadas' : `${creditsLeft} clase${creditsLeft !== 1 ? 's' : ''} disponibles`}</p>
            </div>
          </div>
          {hasSecondary && (
            <>
              <div className="w-px h-8 bg-border/40" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{secLabel}</p>
                  <p className="text-xs font-black">{secLeft}/{plan.max_secondary_sessions} disponibles</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 pb-1">
          <div className="flex gap-1 p-1 bg-muted/40 rounded-lg border border-border/30">
            <ModalTab active={tab === 'primary'} onClick={() => setTab('primary')}>
              <Zap className="h-3 w-3" /> Clases
            </ModalTab>
            {hasSecondary && (
              <ModalTab active={tab === 'secondary'} onClick={() => setTab('secondary')}>
                <Building2 className="h-3 w-3" /> {secLabel}
              </ModalTab>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1">
          {tab === 'primary' && (
            <PrimarySessionsTab
              enrollment={enrollment}
              creditsLeft={creditsLeft}
              isUnlimited={isUnlimited}
              planName={planName}
            />
          )}
          {tab === 'secondary' && hasSecondary && (
            <SecondarySessionsTab
              enrollment={enrollment}
              facilityId={facilityId}
              facilityName={facilityName}
              secLabel={secLabel}
              secLeft={secLeft}
              maxSec={plan.max_secondary_sessions}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModalTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
        active ? 'bg-background text-foreground shadow-sm border border-border/40' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

// ── Tab: Clases Principales ───────────────────────────────────────────────────

function PrimarySessionsTab({ enrollment, creditsLeft, isUnlimited, planName }: {
  enrollment: any; creditsLeft: number | null; isUnlimited: boolean; planName: string;
}) {
  const { data, isLoading } = useAvailableSessions();
  const { mutate: book, isPending } = useBookSession();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<BookableSession | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Filtrar sesiones:
  // - Si el enrollment tiene offering_plan_id → buscar por offering_id en la sesión
  // - Si solo tiene team_id → buscar por team_id
  const allSessions = useMemo(() => {
    const sessions = data?.sessions ?? [];

    // 1. Intentar match exacto por enrollment_id (el BFF ya lo resolvió)
    const byEnrollment = sessions.filter(
      (s) =>
        s.enrollment_id === enrollment.id &&
        (s.booking_status === 'open' || s.booking_status === 'already_booked')
    );
    if (byEnrollment.length > 0) return byEnrollment;

    // 2. Plan desacoplado → usar offering_id que ahora viene del RPC
    if (enrollment.offering_id) {
      const byOffering = sessions.filter(
        (s) =>
          s.offering_id === enrollment.offering_id &&
          (s.booking_status === 'open' || s.booking_status === 'already_booked')
      );
      if (byOffering.length > 0) return byOffering;
    }

    // 3. Solo equipo (team_id != null, sin plan desacoplado)
    if (enrollment.team_id) {
      return sessions.filter(
        (s) =>
          s.team?.id === enrollment.team_id &&
          (s.booking_status === 'open' || s.booking_status === 'already_booked')
      );
    }

    return [];
  }, [data, enrollment]);

  const availableDates = useMemo(() =>
    new Set(allSessions.map(s => s.session_date))
  , [allSessions]);

  const sessionsForDay = useMemo(() => {
    if (!selectedDate) return [];
    return allSessions
      .filter(s => s.session_date === selectedDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [allSessions, selectedDate]);

  if (isLoading) return <SkeletonList />;

  const noCredits = !isUnlimited && (creditsLeft ?? 0) <= 0;
  if (noCredits) {
    return <EmptyCenter icon={Zap} title="Sin créditos disponibles"
      desc={`Tu plan ${planName} no tiene más clases este período`} color="amber" />;
  }
  if (allSessions.length === 0) {
    return <EmptyCenter icon={CalendarCheck} title="Sin clases disponibles"
      desc="No hay horarios programados. Consulta con tu academia." />;
  }

  // Calendario
  const monthStart  = startOfMonth(calendarDate);
  const monthEnd    = endOfMonth(calendarDate);
  const days        = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad    = (monthStart.getDay() + 6) % 7; // Lu=0
  const todayDate   = startOfDay(new Date());

  return (
    <>
      <div className="space-y-4">
        {/* Mini calendario */}
        <div className="rounded-xl border border-border/40 overflow-hidden bg-muted/10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <button onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}
              className="p-1 rounded-md hover:bg-muted/60 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-black uppercase tracking-wider capitalize">
              {format(calendarDate, 'MMMM yyyy', { locale: es })}
            </p>
            <button onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}
              className="p-1 rounded-md hover:bg-muted/60 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center border-b border-border/20">
            {['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map(d => (
              <div key={d} className="py-2 text-[10px] font-black text-muted-foreground uppercase">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 p-1">
            {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
            {days.map(day => {
              const dateStr    = format(day, 'yyyy-MM-dd');
              const hasSess    = availableDates.has(dateStr);
              const isPast     = isBefore(day, todayDate);
              const isToday_   = isToday(day);
              const isSelected = selectedDate === dateStr;

              return (
                <button key={dateStr} disabled={!hasSess || isPast}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`
                    relative flex flex-col items-center justify-center py-2 mx-0.5 my-0.5
                    text-xs font-semibold rounded-lg transition-all
                    ${isSelected
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : hasSess && !isPast
                        ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
                        : 'text-muted-foreground/30 cursor-default'
                    }
                    ${isToday_ && !isSelected ? 'ring-1 ring-primary/50' : ''}
                  `}
                >
                  {format(day, 'd')}
                  {hasSess && !isPast && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Horarios del día seleccionado */}
        {selectedDate ? (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground capitalize">
              {format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })}
              {' · '}{sessionsForDay.length} horario{sessionsForDay.length !== 1 ? 's' : ''}
            </p>
            {sessionsForDay.map(s => (
              <SessionSlot key={s.id} session={s} noCredits={noCredits}
                isBooking={isPending} onBook={() => setConfirming(s)} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-center text-muted-foreground py-2">
            Selecciona un día <span className="text-primary font-semibold">disponible</span> para ver los horarios
          </p>
        )}
      </div>

      {/* Dialog confirmación */}
      <AlertDialog open={!!confirming} onOpenChange={(o) => { if (!o) setConfirming(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar clase</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border p-3 space-y-1 bg-muted/20">
                  <p className="font-bold text-foreground">{confirming?.team.name}</p>
                  <p className="text-muted-foreground capitalize text-xs">
                    {confirming?.session_date
                      ? format(parseISO(confirming.session_date), "EEEE d 'de' MMMM", { locale: es })
                      : ''}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {fmtTime(confirming?.start_time ?? '')} — {fmtTime(confirming?.end_time ?? '')}
                  </p>
                  {confirming?.coach?.name && (
                    <p className="text-muted-foreground text-xs">Coach: {confirming.coach.name}</p>
                  )}
                </div>
                <div className={`rounded-lg px-3 py-2 text-xs font-medium border ${
                  isUnlimited
                    ? 'bg-green-500/10 text-green-700 border-green-200'
                    : 'bg-amber-500/10 text-amber-700 border-amber-200'
                }`}>
                  {isUnlimited
                    ? 'Plan ilimitado — no se descuenta crédito'
                    : `Se usará 1 clase (quedarán ${(creditsLeft ?? 1) - 1})`}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={() => {
              if (!confirming) return;
              book({ session_id: confirming.id, enrollment_id: confirming.enrollment_id }, {
                onSuccess: () => {
                  toast({ title: '✅ Clase agendada',
                    description: `${format(parseISO(confirming.session_date), "EEE d MMM", { locale: es })} · ${fmtTime(confirming.start_time)}` });
                  setConfirming(null);
                  setSelectedDate(null);
                },
                onError: (err: any) => {
                  toast({ title: 'Error', description: err.message, variant: 'destructive' });
                  setConfirming(null);
                },
              });
            }}>
              {isPending ? 'Agendando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Tab: Clases Secundarias (GYM) ─────────────────────────────────────────────

function SecondarySessionsTab({ enrollment, facilityId, facilityName, secLabel, secLeft, maxSec }: {
  enrollment: any; facilityId: string; facilityName: string;
  secLabel: string; secLeft: number; maxSec: number;
}) {
  const { mutate: bookSec, isPending } = useBookSecondarySession();
  const { toast } = useToast();
  
  // Hoy en Colombia (UTC-5)
  const todayStr = useMemo(() => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().split('T')[0], []);
  
  // State for multi-selection
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedSlots, setSelectedSlots] = useState<{ start: string; end: string }[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);

  const { data: slotsData, isLoading: slotsLoading } = useFacilitySlots(facilityId, selectedDate);
  const availableDates = getNextAvailableDates(14);
  const slots = slotsData?.slots ?? [];

  const toggleSlot = (slot: { start: string; end: string; available: boolean; already_booked: boolean }) => {
    if (!slot.available || slot.already_booked) return;

    const exists = selectedSlots.find(s => s.start === slot.start);
    if (exists) {
      setSelectedSlots(selectedSlots.filter(s => s.start !== slot.start));
    } else {
      if (selectedSlots.length >= 2) {
        toast({ title: "Máximo 2 horas", description: "Solo puedes agendar hasta 2 horas por transacción.", variant: "destructive" });
        return;
      }
      setSelectedSlots([...selectedSlots, { start: slot.start, end: slot.end }]);
    }
  };

  const calculateCredits = () => {
    if (selectedSlots.length === 0) return 0;
    if (selectedSlots.length === 1) return 1;
    
    const sorted = [...selectedSlots].sort((a, b) => a.start.localeCompare(b.start));
    if (sorted[0].end === sorted[1].start) return 1; // Consecutive
    
    return 2; // Not consecutive
  };

  const creditsNeeded = calculateCredits();

  if (secLeft <= 0) {
    return (
      <EmptyCenter icon={Building2} title={`Sin clases ${secLabel}`}
        desc={`Has usado las ${maxSec} clases incluidas en tu plan este período`} color="blue" />
    );
  }

  return (
    <>
      <div className="px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20 mb-3 flex items-center justify-between">
        <p className="text-[11px] text-blue-600 font-medium flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          {facilityName} · {secLeft} de {maxSec} {secLabel} disponibles
        </p>
        {selectedSlots.length > 0 && (
          <Button size="sm" className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700" onClick={() => setIsConfirming(true)}>
            Agendar {selectedSlots.length} {selectedSlots.length === 1 ? 'hora' : 'horas'}
          </Button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {availableDates.map(date => {
          const isSel = selectedDate === date;
          const d = parseISO(date);
          return (
            <button
              key={date}
              onClick={() => { setSelectedDate(date); setSelectedSlots([]); }}
              className={`shrink-0 flex flex-col items-center px-4 py-2.5 rounded-2xl border transition-all ${
                isSel
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20'
                  : 'bg-muted/30 border-border/40 hover:border-blue-400/30'
              }`}
            >
              <span className={`uppercase text-[9px] font-black tracking-widest ${isSel ? 'text-white/70' : 'text-muted-foreground'}`}>
                {format(d, 'EEE', { locale: es })}
              </span>
              <span className="text-base font-black leading-tight mt-0.5">{format(d, 'd')}</span>
            </button>
          );
        })}
      </div>

      {slotsLoading ? (
        <SkeletonList />
      ) : slots.length === 0 ? (
        <EmptyCenter icon={Building2} title="Instalación cerrada"
          desc="No hay horarios disponibles para este día" color="blue" />
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => {
            const isSelected = selectedSlots.some(s => s.start === slot.start);
            const isBooked = slot.already_booked;

            return (
              <Card 
                key={slot.start} 
                onClick={() => toggleSlot(slot)}
                className={`overflow-hidden border-border/40 transition-all cursor-pointer ${
                  isBooked ? 'bg-green-500/5 border-green-500/30 opacity-80' : 
                  isSelected ? 'bg-blue-600/10 border-blue-600 shadow-md transform scale-[1.01]' : 
                  !slot.available ? 'opacity-40 grayscale cursor-not-allowed' :
                  'hover:border-blue-400/40 hover:bg-muted/10'
                }`}
              >
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-1 self-stretch rounded-full ${
                      isBooked ? 'bg-green-600' : isSelected ? 'bg-blue-600' : 'bg-blue-400/30'
                    }`} />
                    <div className="text-center shrink-0 w-16">
                      <p className="text-sm font-black leading-none">{fmtTime(slot.start + ':00')}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{fmtTime(slot.end + ':00')}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold">{facilityName}</p>
                        {isBooked && <Badge className="text-[9px] h-4 px-1.5 bg-green-600">Agendada</Badge>}
                        {isSelected && <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-blue-600 text-blue-600 bg-blue-500/5">Seleccionada</Badge>}
                        {!slot.available && !isBooked && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Ocupado</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> 1 hora · Uso libre
                      </p>
                    </div>
                    {isBooked ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : isSelected ? (
                      <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      </div>
                    ) : (
                      <div className={`h-5 w-5 rounded-full border-2 transition-colors ${
                        !slot.available ? 'border-muted' : 'border-muted hover:border-blue-400'
                      }`} />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Confirmar agendamiento
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                <div className="rounded-2xl border border-border/50 p-4 bg-muted/20 space-y-3">
                  <div className="pb-2 border-b border-border/30">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Instalación</p>
                    <p className="font-bold text-foreground">{facilityName}</p>
                  </div>
                  
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Fecha y Horarios</p>
                    <p className="text-foreground font-bold text-sm capitalize mb-2">{fmtDateLong(selectedDate ?? '')}</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {selectedSlots.sort((a,b) => a.start.localeCompare(b.start)).map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-background/50 rounded-lg px-2.5 py-1.5 border border-border/30">
                          <Clock className="h-3 w-3 text-blue-600" />
                          <p className="text-foreground text-xs font-bold">
                            {fmtTime(s.start + ':00')} — {fmtTime(s.end + ':00')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className={`rounded-xl px-4 py-3 text-sm font-medium border-2 ${
                  creditsNeeded === 1 ? 'bg-emerald-500/5 text-emerald-700 border-emerald-500/20' : 'bg-blue-500/5 text-blue-700 border-blue-500/20'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${creditsNeeded === 1 ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'}`}>
                      <Zap className="h-4 w-4 fill-current" />
                    </div>
                    <div>
                      <p className="font-black text-sm">
                        Costo: {creditsNeeded} {creditsNeeded === 1 ? 'crédito' : 'créditos'}
                      </p>
                      <p className="text-[10px] opacity-70">
                        {creditsNeeded === 1 
                          ? 'Ahorras 1 crédito por reservar horas consecutivas.' 
                          : 'Se descuentan créditos individuales por horas separadas.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/10 p-3 rounded-xl border border-dashed border-border flex items-center gap-2 justify-center">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Te quedarán <span className="text-foreground font-bold">{secLeft - creditsNeeded}</span> clases {secLabel}.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <AlertDialogCancel className="rounded-2xl border-border/50 font-bold hover:bg-muted/50">Volver</AlertDialogCancel>
            <AlertDialogAction 
              disabled={isPending} 
              onClick={() => {
                if (!selectedDate || selectedSlots.length === 0) return;
                bookSec({ 
                  enrollment_id: enrollment.id, 
                  facility_id: facilityId, 
                  reservation_date: selectedDate, 
                  slots: selectedSlots.map(s => ({ start_time: s.start, end_time: s.end }))
                }, {
                  onSuccess: () => {
                    toast({ title: "Reserva confirmada", description: "Tus clases de gimnasio han sido agendadas." });
                    setIsConfirming(false);
                    setSelectedSlots([]);
                  },
                  onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                });
              }}
              className="rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
            >
              {isPending ? 'Procesando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Tab: Mis Reservas ─────────────────────────────────────────────────────────

function MyBookingsTab({ hasSecondary, secLabel, filter = 'all' }: { 
  hasSecondary: boolean; 
  secLabel: string;
  filter?: 'all' | 'primary' | 'secondary';
}) {
  const { data: primary,   isLoading: l1 } = useMyBookings();
  const { data: secondary, isLoading: l2 } = useMySecondaryBookings();
  const { mutate: cancelP, isPending: cp } = useCancelBooking();
  const { mutate: cancelS, isPending: cs } = useCancelSecondaryBooking();
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState<{ id: string; type: 'p' | 's'; label: string } | null>(null);

  if (l1 || l2) return <SkeletonList />;

  const primaryBookings = (filter === 'all' || filter === 'primary') ? (primary ?? []).filter((b: any) => b.status?.toLowerCase() !== 'cancelled') : [];
  const secondaryBookings = (filter === 'all' || filter === 'secondary') ? (secondary ?? []).filter((b: any) => b.status?.toLowerCase() !== 'cancelled') : [];

  if (primaryBookings.length === 0 && secondaryBookings.length === 0) {
    return <EmptyCenter icon={Calendar} title="Sin reservas activas" desc='Agenda clases desde la pestaña de Grupos' />;
  }

  return (
    <>
      <div className="space-y-5">
        {primaryBookings.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Clases de mi Plan</p>
            <div className="space-y-2">
              {primaryBookings.map((b: any) => {
                const s = b.attendance_sessions;
                if (!s) return null;
                const sessionDate = parseISO(s.session_date);
                const isPast = isBefore(sessionDate, startOfDay(new Date()));
                const isToday = format(sessionDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <Card key={b.id} className="overflow-hidden border-border/40">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-1 self-stretch rounded-full ${isPast ? 'bg-muted-foreground/30' : 'bg-primary'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-xs">{s.teams?.name}</p>
                            {s.finalized && <Badge variant="secondary" className="text-[9px] h-4">Finalizada</Badge>}
                            {b.status === 'attended' && <Badge className="text-[9px] h-4 bg-green-600">Asistió</Badge>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                            {fmtDateShort(s.session_date)} · {fmtTime(s.start_time)} — {fmtTime(s.end_time)}
                          </p>
                        </div>
                        {!isPast && !s.finalized && b.status === 'confirmed' && (
                          <Button variant="ghost" size="sm" onClick={() => setCancelling({ id: b.id, type: 'p', label: fmtDateShort(s.session_date) })}
                            className="shrink-0 h-7 px-2 hover:text-destructive">
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {secondaryBookings.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{secLabel}</p>
            <div className="space-y-2">
              {secondaryBookings.map((b: any) => {
                const resvDate = parseISO(b.reservation_date);
                const isPast = isBefore(resvDate, startOfDay(new Date()));
                const isToday = format(resvDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <Card key={b.id} className="overflow-hidden border-border/40">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-1 self-stretch rounded-full ${isPast ? 'bg-muted-foreground/30' : 'bg-blue-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs">{b.facilities?.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                            {fmtDateShort(b.reservation_date)} · {fmtTime(b.start_time)} — {fmtTime(b.end_time)}
                          </p>
                        </div>
                        {!isPast && b.status !== 'cancelled' && (
                          <Button variant="ghost" size="sm" onClick={() => setCancelling({ id: b.id, type: 's', label: fmtDateShort(b.reservation_date) })}
                            className="shrink-0 h-7 px-2 hover:text-destructive">
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!cancelling} onOpenChange={(o) => { if (!o) setCancelling(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar reserva</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Cancelar la clase del {cancelling?.label}? El crédito será devuelto a tu plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" disabled={cp || cs}
              onClick={() => {
                if (!cancelling) return;
                const fn = cancelling.type === 'p' ? cancelP : cancelS;
                (fn as any)(cancelling.id, {
                  onSuccess: () => { toast({ title: 'Reserva cancelada', description: 'Crédito devuelto a tu plan.' }); setCancelling(null); },
                  onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); setCancelling(null); },
                });
              }}>
              {(cp || cs) ? 'Cancelando...' : 'Sí, cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Modal: Reservar Instalación (standalone) ─────────────────────────────────
// Para el botón "Reservar" del side panel — usa SecondarySessionsTab
// Solo disponible si el atleta tiene un enrollment con secundarias

function FacilityReserveModal({ facilityId, facilityName, enrollment, onClose }: {
  facilityId: string; facilityName: string; enrollment: any | null; onClose: () => void;
}) {
  const plan = enrollment?.plan_details;
  const hasSecondary = (plan?.max_secondary_sessions ?? 0) > 0;
  const secLeft = Math.max(0, (plan?.max_secondary_sessions ?? 0) - (enrollment?.secondary_sessions_used ?? 0));
  const secLabel = plan?.secondary_session_label || 'GYM';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogTitle className="sr-only">Reservar {facilityName}</DialogTitle>

        <div className="px-6 pt-5 pb-3 border-b border-border/30">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Instalación</p>
          <h2 className="text-lg font-black tracking-tight">{facilityName}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!enrollment || !hasSecondary ? (
            <EmptyCenter icon={Building2} title="Sin acceso al gimnasio"
              desc="Tu plan actual no incluye clases de gimnasio. Consulta con tu academia los planes disponibles." color="blue" />
          ) : (
            <SecondarySessionsTab
              enrollment={enrollment}
              facilityId={facilityId}
              facilityName={facilityName}
              secLabel={secLabel}
              secLeft={secLeft}
              maxSec={plan.max_secondary_sessions}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Session Slot ─────────────────────────────────────────────────────────────

function SessionSlot({ session, noCredits, isBooking, onBook }: {
  session: BookableSession; noCredits: boolean; isBooking: boolean; onBook: () => void;
}) {
  const isFull   = session.booking_status === 'full';
  const isBooked = session.already_booked;
  const isDisabled = noCredits || isFull || isBooked || isBooking;

  return (
    <Card className={`overflow-hidden border-border/40 transition-all ${
      isBooked ? 'bg-primary/5 border-primary/20' :
      isFull   ? 'opacity-50' :
      noCredits ? 'opacity-60' :
      'hover:border-primary/30'
    }`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={`w-1 self-stretch rounded-full ${isBooked ? 'bg-primary' : isFull ? 'bg-muted-foreground/20' : 'bg-primary/30'}`} />
          <div className="text-center shrink-0 w-16">
            <p className="text-sm font-black leading-none">{fmtTime(session.start_time)}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{fmtTime(session.end_time)}</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {session.coach?.name && <p className="text-xs font-semibold">{session.coach.name}</p>}
              {isBooked  && <Badge className="text-[9px] h-4 px-1.5 bg-primary">Agendada</Badge>}
              {isFull    && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Llena</Badge>}
              {noCredits && <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-300 text-amber-600">Sin créditos</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{session.available_spots}/{session.max_capacity}</span>
              <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />1h</span>
            </div>
          </div>
          {isBooked ? (
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <Button size="sm" onClick={onBook} disabled={isDisabled} className="shrink-0 h-8 text-xs gap-1">
              <CalendarCheck className="h-3.5 w-3.5" /> Agendar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Modal: Detalle Equipo ────────────────────────────────────────────────────

function TeamDetailModal({ enrollment, onClose }: { enrollment: any; onClose: () => void }) {
  const { program } = enrollment;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-3xl border-0 shadow-2xl">
        <DialogTitle className="sr-only">{program.name}</DialogTitle>
        <div className="relative bg-gradient-to-br from-red-600 to-red-800 p-6 pb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">Equipo activo</p>
          <h2 className="font-black text-2xl text-white leading-tight">{program.name}</h2>
          <p className="text-white/50 text-sm capitalize mt-1">{program.sport}</p>
        </div>
        <div className="p-6 space-y-4 bg-card">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-muted/30 rounded-2xl p-3.5 border border-border col-span-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Escuela</p>
              <p className="font-bold text-sm uppercase">{program.school?.name}</p>
            </div>
            <div className="bg-muted/30 rounded-2xl p-3.5 border border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ciudad</p>
              <p className="font-bold text-sm capitalize">{program.school?.city}</p>
            </div>
            <div className="bg-muted/30 rounded-2xl p-3.5 border border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Estado</p>
              <p className="font-bold text-sm capitalize">{enrollment.status}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full rounded-2xl h-11 font-bold" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Micro UI ─────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse border border-border/30" />
      ))}
    </div>
  );
}

function EmptyDashed({ icon: Icon, text, children }: { icon: any; text: string; children?: React.ReactNode }) {
  return (
    <div className="p-8 rounded-2xl border-2 border-dashed border-border/40 text-center space-y-4">
      <Icon className="h-10 w-10 text-muted-foreground/30 mx-auto" />
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}

function EmptyCenter({ icon: Icon, title, desc, color = 'muted' }: {
  icon: any; title: string; desc: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    muted:  'bg-muted/40 text-muted-foreground',
    amber:  'bg-amber-500/10 text-amber-500',
    blue:   'bg-blue-500/10 text-blue-500',
    green:  'bg-green-500/10 text-green-500',
  };
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorMap[color] ?? colorMap.muted}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-bold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{desc}</p>
    </div>
  );
}
