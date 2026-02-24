import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/PermissionGate';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { LocationAutocomplete } from '@/components/events/LocationAutocomplete';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  ArrowRight,
  Loader2,
  Megaphone,
  Star,
  Dumbbell,
  Users,
  MessageCircle,
  Trophy,
  Swords,
  GraduationCap,
  Waves,
  CircleDot,
  Sparkles,
  ClipboardList,
  Target,
  Pencil,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time: string;
  location?: string;
  all_day: boolean;
  user_id: string;
  sport?: string;
  event_label?: string;
  team_id?: string;
}

// ─── Sport icon mapping ───────────────────────────────────────────────────
const SPORT_ICONS: Record<string, React.ElementType> = {
  'Porrismo': Megaphone,
  'Fútbol': CircleDot,
  'Baloncesto': Target,
  'Natación': Waves,
  'Tenis': Swords,
  'Gimnasia': Sparkles,
  'Atletismo': Dumbbell,
  'Voleibol': CircleDot,
  'Artes Marciales': Swords,
};

const SPORT_COLORS: Record<string, { bg: string; text: string; icon: string; border: string }> = {
  'Porrismo': { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400', icon: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
  'Fútbol': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Baloncesto': { bg: 'bg-orange-500/15', text: 'text-orange-400', icon: 'text-orange-400', border: 'border-orange-500/30' },
  'Natación': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', icon: 'text-cyan-400', border: 'border-cyan-500/30' },
  'Tenis': { bg: 'bg-lime-500/15', text: 'text-lime-400', icon: 'text-lime-400', border: 'border-lime-500/30' },
  'Gimnasia': { bg: 'bg-pink-500/15', text: 'text-pink-300', icon: 'text-pink-300', border: 'border-pink-500/30' },
  'Atletismo': { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: 'text-amber-400', border: 'border-amber-500/30' },
  'Voleibol': { bg: 'bg-yellow-500/15', text: 'text-yellow-400', icon: 'text-yellow-400', border: 'border-yellow-500/30' },
  'Artes Marciales': { bg: 'bg-red-500/15', text: 'text-red-400', icon: 'text-red-400', border: 'border-red-500/30' },
};

const DEFAULT_SPORT_COLOR = { bg: 'bg-primary/15', text: 'text-primary', icon: 'text-primary', border: 'border-primary/30' };

// ─── Sport-specific event type labels ─────────────────────────────────────
const BASE_EVENT_TYPES: Record<string, { label: string; color: string }> = {
  training: { label: 'Entrenamiento', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  match: { label: 'Partido', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  meeting: { label: 'Reunión', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  evaluation: { label: 'Evaluación', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  competition: { label: 'Competencia', color: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' },
  workshop: { label: 'Taller', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  staff_meeting: { label: 'Reunión de Staff', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  other: { label: 'Otro', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
};

const SPORT_EVENT_OVERRIDES: Record<string, Record<string, { label: string; color: string }>> = {
  'Porrismo': {
    training: { label: 'Práctica de Rutina', color: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' },
    match: { label: 'Exhibición', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
    competition: { label: 'Competencia All-Star', color: 'bg-fuchsia-600/20 text-fuchsia-200 border-fuchsia-600/30' },
    workshop: { label: 'Taller Técnica de Vuelo', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
    evaluation: { label: 'Evaluación de Nivel', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  },
  'Fútbol': {
    training: { label: 'Entrenamiento Táctico', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    match: { label: 'Partido Oficial', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    competition: { label: 'Torneo', color: 'bg-emerald-600/20 text-emerald-200 border-emerald-600/30' },
  },
  'Baloncesto': {
    training: { label: 'Práctica de Cancha', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    match: { label: 'Juego Oficial', color: 'bg-orange-600/20 text-orange-200 border-orange-600/30' },
  },
  'Natación': {
    training: { label: 'Entrenamiento en Piscina', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    competition: { label: 'Torneo de Natación', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  },
  'Gimnasia': {
    training: { label: 'Práctica de Aparatos', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
    competition: { label: 'Competencia de Gimnasia', color: 'bg-pink-600/20 text-pink-200 border-pink-600/30' },
  },
  'Atletismo': {
    training: { label: 'Sesión de Pista', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    match: { label: 'Competencia de Pista', color: 'bg-amber-600/20 text-amber-200 border-amber-600/30' },
  },
  'Tenis': {
    training: { label: 'Práctica de Cancha', color: 'bg-lime-500/20 text-lime-300 border-lime-500/30' },
    match: { label: 'Partido de Tenis', color: 'bg-lime-600/20 text-lime-200 border-lime-600/30' },
  },
  'Voleibol': {
    training: { label: 'Práctica de Voleibol', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    match: { label: 'Juego de Voleibol', color: 'bg-yellow-600/20 text-yellow-200 border-yellow-600/30' },
  },
  'Artes Marciales': {
    training: { label: 'Sesión de Dojo', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    match: { label: 'Combate', color: 'bg-red-600/20 text-red-200 border-red-600/30' },
    competition: { label: 'Campeonato', color: 'bg-red-700/20 text-red-100 border-red-700/30' },
  },
};

const EVENT_TYPE_ICONS: Record<string, React.ElementType> = {
  training: Dumbbell,
  match: Swords,
  meeting: MessageCircle,
  evaluation: ClipboardList,
  competition: Trophy,
  workshop: GraduationCap,
  staff_meeting: Users,
  other: CalendarIcon,
};

// ─── Timezone-safe date helpers ───────────────────────────────────────────
function localDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function eventMatchesDate(event: CalendarEvent, date: Date): boolean {
  return localDateOnly(new Date(event.start_time)) === localDateOnly(date);
}

// ─── Component ────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user, profile } = useAuth();
  const { can } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [coachSport, setCoachSport] = useState<string | null>(null);

  // Date picker popover states
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'training',
    startDate: null as Date | null,
    startTime: '09:00',
    endDate: null as Date | null,
    endTime: '10:00',
    location: '',
    all_day: false,
    event_label: '',
  });

  // ── Get sport-specific event types ────────────────────────────────────
  const getEventTypes = useMemo(() => {
    const overrides = coachSport ? SPORT_EVENT_OVERRIDES[coachSport] || {} : {};
    const merged: Record<string, { label: string; color: string }> = {};
    for (const [key, base] of Object.entries(BASE_EVENT_TYPES)) {
      merged[key] = overrides[key] || base;
    }
    return merged;
  }, [coachSport]);

  // ── Fetch coach primary sport ─────────────────────────────────────────
  useEffect(() => {
    if (profile?.role === 'coach' && user?.id) {
      (supabase
        .from('coach_profiles' as any)
        .select('primary_sport')
        .eq('id', user.id)
        .maybeSingle() as any)
        .then(({ data }: { data: { primary_sport: string } | null }) => {
          if (data?.primary_sport) {
            setCoachSport(data.primary_sport);
          }
        });
    }
  }, [profile?.role, user?.id]);

  // ── Fetch events ──────────────────────────────────────────────────────
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return (data || []) as CalendarEvent[];
    },
    enabled: !!user?.id,
  });

  // ── Build ISO timestamps from date+time pickers ───────────────────────
  const buildIso = (date: Date | null, time: string): string => {
    if (!date) return '';
    const [h, m] = time.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  // ── Create event mutation ─────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (fd: typeof formData) => {
      if (!user) throw new Error('No autenticado');
      const startIso = buildIso(fd.startDate, fd.startTime);
      const endIso = buildIso(fd.endDate, fd.endTime);
      if (!startIso || !endIso) throw new Error('Fechas inválidas');

      const payload = {
        user_id: user.id,
        title: fd.title,
        description: fd.description || null,
        event_type: fd.event_type,
        start_time: startIso,
        end_time: endIso,
        location: fd.location || null,
        all_day: fd.all_day,
        sport: coachSport || null,
        event_label: fd.event_label || null,
      };

      const { error } = await (supabase
        .from('calendar_events' as any)
        .insert(payload) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: '✅ Evento creado', description: `${formData.title} agregado al calendario` });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'No se pudo crear', variant: 'destructive' });
    },
  });

  // ── Update event mutation ─────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...fd }: typeof formData & { id: string }) => {
      if (!user) throw new Error('No autenticado');
      const startIso = buildIso(fd.startDate, fd.startTime);
      const endIso = buildIso(fd.endDate, fd.endTime);
      if (!startIso || !endIso) throw new Error('Fechas inválidas');

      const payload = {
        title: fd.title,
        description: fd.description || null,
        event_type: fd.event_type,
        start_time: startIso,
        end_time: endIso,
        location: fd.location || null,
        all_day: fd.all_day,
        sport: coachSport || null,
        event_label: fd.event_label || null,
      };

      const { error } = await (supabase
        .from('calendar_events' as any)
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: '✅ Evento actualizado', description: `${formData.title} ha sido modificado` });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'No se pudo actualizar', variant: 'destructive' });
    },
  });

  // ── Calendar grid computation ─────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const startDow = getDay(monthStart);
    const padBefore = Array.from({ length: startDow }, (_, i) => {
      const d = new Date(monthStart);
      d.setDate(d.getDate() - (startDow - i));
      return { date: d, isCurrentMonth: false };
    });

    const daysWithMonth = days.map(d => ({ date: d, isCurrentMonth: true }));
    const totalCells = 42;
    const remaining = totalCells - padBefore.length - daysWithMonth.length;
    const padAfter = Array.from({ length: remaining }, (_, i) => {
      const d = new Date(monthEnd);
      d.setDate(d.getDate() + i + 1);
      return { date: d, isCurrentMonth: false };
    });

    return [...padBefore, ...daysWithMonth, ...padAfter];
  }, [currentMonth]);

  const eventsForDate = (date: Date) =>
    events.filter(e => eventMatchesDate(e, date));

  const upcomingEvents = useMemo(() => {
    const todayStr = localDateOnly(new Date());
    return events
      .filter(e => localDateOnly(new Date(e.start_time)) >= todayStr)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 5);
  }, [events]);

  // ── Helpers ───────────────────────────────────────────────────────────
  const getIconForEvent = (event: CalendarEvent) => {
    const sport = event.sport || coachSport;
    if (sport && SPORT_ICONS[sport]) return SPORT_ICONS[sport];
    return EVENT_TYPE_ICONS[event.event_type] || CalendarIcon;
  };

  const getColorForEvent = (event: CalendarEvent) => {
    const sport = event.sport || coachSport;
    if (sport && SPORT_COLORS[sport]) return SPORT_COLORS[sport];
    return DEFAULT_SPORT_COLOR;
  };

  const resetForm = () =>
    setFormData({
      title: '',
      description: '',
      event_type: 'training',
      startDate: null,
      startTime: '09:00',
      endDate: null,
      endTime: '10:00',
      location: '',
      all_day: false,
      event_label: '',
    });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    resetForm();
  };

  const handleOpenCreate = () => {
    setEditingEvent(null);
    resetForm();
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        startDate: selectedDate,
        endDate: selectedDate,
      }));
    }
    setDialogOpen(true);
  };

  const handleOpenEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    const startD = new Date(event.start_time);
    const endD = new Date(event.end_time);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      startDate: startD,
      startTime: `${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`,
      endDate: endD,
      endTime: `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`,
      location: event.location || '',
      all_day: event.all_day,
      event_label: event.event_label || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading) return <LoadingSpinner fullScreen text="Cargando calendario..." />;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi Calendario</h1>
          <p className="text-muted-foreground">
            {coachSport
              ? `Gestiona tus actividades de ${coachSport}`
              : 'Gestiona tus entrenamientos, partidos y eventos'}
          </p>
        </div>
        <PermissionGate permission="calendar:create">
          <Button className="gap-2" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            Nuevo Evento
          </Button>
        </PermissionGate>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ──── Calendar Grid (2 cols) ────────────────────────────────── */}
        <Card className="lg:col-span-2 border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl capitalize">
                <CalendarIcon className="h-5 w-5 text-primary" />
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCurrentMonth(new Date())}>
                  Hoy
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(({ date, isCurrentMonth: isCurMonth }, i) => {
                const dayEvents = eventsForDate(date);
                const hasEvents = dayEvents.length > 0;
                const today = isToday(date);
                const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

                const DayIcon = hasEvents ? getIconForEvent(dayEvents[0]) : null;
                const dayColor = hasEvents ? getColorForEvent(dayEvents[0]) : null;

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={`
                      relative p-2 rounded-xl text-sm transition-all duration-200 min-h-[56px]
                      flex flex-col items-center justify-start gap-0.5
                      hover:bg-accent/60 hover:scale-[1.03]
                      ${!isCurMonth ? 'opacity-30 pointer-events-none' : ''}
                      ${today ? 'ring-2 ring-primary bg-primary/10 font-bold' : ''}
                      ${isSelected && !today ? 'ring-2 ring-primary/60 bg-accent/40' : ''}
                      ${hasEvents && isCurMonth && !today ? `${dayColor?.bg} ${dayColor?.border} border` : ''}
                    `}
                  >
                    <span className={`text-xs leading-none ${today ? 'text-primary font-bold' : ''}`}>
                      {date.getDate()}
                    </span>
                    {hasEvents && DayIcon && (
                      <DayIcon className={`h-3.5 w-3.5 mt-0.5 ${dayColor?.icon || 'text-primary'}`} />
                    )}
                    {dayEvents.length > 1 && (
                      <span className="text-[9px] text-muted-foreground leading-none">+{dayEvents.length - 1}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {coachSport && (
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/30">
                <span className="text-xs text-muted-foreground">Deporte:</span>
                {(() => {
                  const SportIcon = SPORT_ICONS[coachSport] || Star;
                  const color = SPORT_COLORS[coachSport] || DEFAULT_SPORT_COLOR;
                  return (
                    <Badge variant="outline" className={`${color.bg} ${color.text} ${color.border} text-xs gap-1`}>
                      <SportIcon className="h-3 w-3" />
                      {coachSport}
                    </Badge>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ──── Upcoming Events ────────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            Próximos Eventos
          </h2>

          {upcomingEvents.length === 0 ? (
            <Card className="border-dashed border-border/50 bg-card/60">
              <CardContent className="py-10 text-center">
                <CalendarIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No hay eventos próximos</p>
                <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={handleOpenCreate}>
                  <Plus className="h-3 w-3" /> Crear Evento
                </Button>
              </CardContent>
            </Card>
          ) : (
            upcomingEvents.map((event, idx) => {
              const Icon = getIconForEvent(event);
              const color = getColorForEvent(event);
              const typeConfig = getEventTypes[event.event_type] || BASE_EVENT_TYPES.other;

              return (
                <Card
                  key={event.id}
                  className="group border-border/40 bg-gradient-to-br from-card/90 to-card/60 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 overflow-hidden animate-in slide-in-from-right"
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${color.bg} ${color.border} border group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`h-6 w-6 ${color.icon}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                          {event.title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{format(new Date(event.start_time), "EEE d MMM · HH:mm", { locale: es })}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeConfig.color}`}>
                            {event.event_label || typeConfig.label}
                          </Badge>
                        </div>
                      </div>

                      <div className="shrink-0 self-start">
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10"
                          onClick={() => handleOpenEdit(event)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* ──── Selected Date Details ──────────────────────────────────────── */}
      {selectedDate && eventsForDate(selectedDate).length > 0 && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300 border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Eventos del {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {eventsForDate(selectedDate).map(event => {
                const Icon = getIconForEvent(event);
                const color = getColorForEvent(event);
                const typeConfig = getEventTypes[event.event_type] || BASE_EVENT_TYPES.other;

                return (
                  <div key={event.id} className="p-4 rounded-xl border border-border/40 bg-gradient-to-br from-card to-card/60 hover:shadow-md transition-all group">
                    <div className="flex gap-3">
                      <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${color.bg} ${color.border} border`}>
                        <Icon className={`h-5 w-5 ${color.icon}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold">{event.title}</h3>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10"
                            onClick={() => handleOpenEdit(event)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded-md">
                            <Clock className="h-3 w-3" />
                            {format(new Date(event.start_time), 'HH:mm')} – {format(new Date(event.end_time), 'HH:mm')}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={`mt-2 text-[10px] ${typeConfig.color}`}>
                          {event.event_label || typeConfig.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ──── Create / Edit Event Dialog ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar Evento' : 'Crear Nuevo Evento'}</DialogTitle>
            <DialogDescription>
              {editingEvent
                ? 'Modifica los datos de tu evento.'
                : coachSport
                  ? `Nuevo evento de ${coachSport} en tu calendario.`
                  : 'Agrega una actividad a tu calendario.'}
            </DialogDescription>
            {coachSport && (
              <div className="flex items-center gap-2 mt-1">
                {(() => {
                  const SportIcon = SPORT_ICONS[coachSport] || Star;
                  const color = SPORT_COLORS[coachSport] || DEFAULT_SPORT_COLOR;
                  return (
                    <Badge variant="outline" className={`${color.bg} ${color.text} ${color.border} text-xs gap-1`}>
                      <SportIcon className="h-3 w-3" />
                      {coachSport}
                    </Badge>
                  );
                })()}
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Campeonato Nacional"
                required
              />
            </div>

            {/* Type + Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Evento *</Label>
                <Select value={formData.event_type} onValueChange={v => setFormData({ ...formData, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(getEventTypes).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Etiqueta personalizada</Label>
                <Input
                  value={formData.event_label}
                  onChange={e => setFormData({ ...formData, event_label: e.target.value })}
                  placeholder={
                    coachSport === 'Porrismo'
                      ? 'Ej: Competencia Nivel 3'
                      : coachSport === 'Fútbol'
                        ? 'Ej: Liga Municipal Sub-15'
                        : 'Ej: Competencia Regional'
                  }
                />
              </div>
            </div>

            {/* Date pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Inicio *</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${!formData.startDate ? 'text-muted-foreground' : ''}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate
                        ? format(formData.startDate, 'PPP', { locale: es })
                        : 'Seleccionar fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.startDate || undefined}
                      onSelect={(d) => {
                        setFormData(prev => ({
                          ...prev,
                          startDate: d || null,
                          endDate: prev.endDate || d || null,
                        }));
                        setStartDateOpen(false);
                      }}
                      locale={es}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Hora de Inicio *</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Fin *</Label>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${!formData.endDate ? 'text-muted-foreground' : ''}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.endDate
                        ? format(formData.endDate, 'PPP', { locale: es })
                        : 'Seleccionar fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.endDate || undefined}
                      onSelect={(d) => {
                        setFormData(prev => ({ ...prev, endDate: d || null }));
                        setEndDateOpen(false);
                      }}
                      locale={es}
                      disabled={(d) => formData.startDate ? d < formData.startDate : false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Hora de Fin *</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Location with autocomplete */}
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <LocationAutocomplete
                value={formData.location}
                onChange={(addr) => setFormData({ ...formData, location: addr })}
                placeholder="Buscar dirección en Colombia..."
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles adicionales..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={isSaving || !formData.startDate || !formData.endDate}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingEvent ? 'Guardar Cambios' : 'Crear Evento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
