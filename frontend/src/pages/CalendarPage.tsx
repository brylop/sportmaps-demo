import { useState } from 'react';
<<<<<<< HEAD
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PermissionGate } from '@/components/PermissionGate';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
=======
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/PermissionGate';
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  MapPin,
<<<<<<< HEAD
  Plus
} from 'lucide-react';
import { format, parseISO, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_type: 'training' | 'match' | 'meeting' | 'evaluation' | 'other';
  start_time: string;
  end_time: string;
  location?: string;
  all_day: boolean;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // 1. Fetch Events from Supabase
  const { data: events, isLoading } = useQuery({
    queryKey: ['my-calendar-events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Traemos eventos del usuario
      // Nota: En un futuro, aquí podrías hacer un join con 'teams' 
      // para traer eventos de equipo aunque no los haya creado el usuario.
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as CalendarEvent[];
    },
    enabled: !!user?.id,
  });

  // Helpers de UI
  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      training: 'bg-blue-100 text-blue-700 border-blue-200',
      match: 'bg-orange-100 text-orange-700 border-orange-200',
      meeting: 'bg-purple-100 text-purple-700 border-purple-200',
      evaluation: 'bg-green-100 text-green-700 border-green-200',
      other: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return colors[type] || colors.other;
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      training: 'Entrenamiento',
      match: 'Partido',
      meeting: 'Reunión',
      evaluation: 'Evaluación',
      other: 'Evento'
    };
    return labels[type] || 'Evento';
  };

  // Filtros de eventos
  const eventsForDate = (date: Date) => {
    if (!events) return [];
    return events.filter(event => 
      isSameDay(parseISO(event.start_time), date)
    );
  };

  const upcomingEvents = events
    ? events
        .filter(event => new Date(event.start_time) >= new Date())
        .slice(0, 5)
    : [];

  // Generación de días del calendario
  const calendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: es });
    const endDate = endOfWeek(monthEnd, { locale: es });

    return eachDayOfInterval({
      start: startDate,
      end: endDate,
    });
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando tu calendario..." />;
  }

  const selectedDayEvents = eventsForDate(selectedDate);
=======
  Users,
  Plus
} from 'lucide-react';

interface Event {
  id: string;
  title: string;
  date: Date;
  time: string;
  location?: string;
  type: 'training' | 'match' | 'meeting' | 'evaluation';
  participants?: number;
}

const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Entrenamiento Táctico',
    date: new Date(2025, 9, 1),
    time: '16:00 - 18:00',
    location: 'Cancha Principal',
    type: 'training',
    participants: 22
  },
  {
    id: '2',
    title: 'Partido vs. Academia Norte',
    date: new Date(2025, 9, 3),
    time: '10:00 - 12:00',
    location: 'Estadio Municipal',
    type: 'match',
    participants: 30
  },
  {
    id: '3',
    title: 'Evaluación Física',
    date: new Date(2025, 9, 5),
    time: '09:00 - 11:00',
    location: 'Centro Médico',
    type: 'evaluation',
    participants: 15
  },
  {
    id: '4',
    title: 'Reunión con Padres',
    date: new Date(2025, 9, 7),
    time: '18:00 - 19:30',
    location: 'Sala de Conferencias',
    type: 'meeting',
    participants: 40
  }
];

export default function CalendarPage() {
  const { profile } = useAuth();
  const { can } = usePermissions();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const getEventTypeColor = (type: Event['type']) => {
    const colors = {
      training: 'bg-blue-500/10 text-blue-600 border-blue-200',
      match: 'bg-orange-500/10 text-orange-600 border-orange-200',
      meeting: 'bg-purple-500/10 text-purple-600 border-purple-200',
      evaluation: 'bg-green-500/10 text-green-600 border-green-200'
    };
    return colors[type];
  };

  const getEventTypeLabel = (type: Event['type']) => {
    const labels = {
      training: 'Entrenamiento',
      match: 'Partido',
      meeting: 'Reunión',
      evaluation: 'Evaluación'
    };
    return labels[type];
  };

  const eventsForDate = (date: Date) => {
    return mockEvents.filter(
      event => event.date.toDateString() === date.toDateString()
    );
  };

  const upcomingEvents = mockEvents
    .filter(event => event.date >= new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
<<<<<<< HEAD
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi Calendario</h1>
          <p className="text-muted-foreground">
            Gestiona tus entrenamientos, partidos y eventos
          </p>
        </div>
        
        {/* Botón para ir a la versión avanzada/gestión */}
        <PermissionGate permission="calendar:create">
          <Button className="gap-2" onClick={() => navigate('/calendar-advanced')}>
            <Plus className="h-4 w-4" />
            Gestionar Eventos
          </Button>
        </PermissionGate>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Calendar View (Left Side - Larger) */}
        <Card className="md:col-span-7 lg:col-span-8 h-fit">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 capitalize">
                <CalendarIcon className="h-5 w-5 text-primary" />
                {format(currentDate, 'MMMM yyyy', { locale: es })}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={nextMonth}>
=======
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi Calendario</h1>
          <p className="text-muted-foreground">
          Gestiona tus entrenamientos, partidos y eventos
        </p>
      </div>
      
      {/* Only users with calendar:create permission can see this button */}
      <PermissionGate permission="calendar:create">
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Evento
        </Button>
      </PermissionGate>
    </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Calendar View */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                >
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
<<<<<<< HEAD
            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 lg:gap-2">
              {calendarDays().map((day, i) => {
                const dayEvents = eventsForDate(day);
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      min-h-[80px] p-2 rounded-lg border text-left transition-all relative flex flex-col items-start justify-start hover:border-primary/50
                      ${!isCurrentMonth ? 'bg-muted/20 text-muted-foreground border-transparent' : 'bg-card'}
                      ${isSelected ? 'ring-2 ring-primary border-primary' : 'border-border'}
                      ${isTodayDate ? 'bg-primary/5' : ''}
                    `}
                  >
                    <span className={`
                      text-sm w-6 h-6 flex items-center justify-center rounded-full mb-1
                      ${isTodayDate ? 'bg-primary text-primary-foreground font-bold' : 'font-medium'}
                    `}>
                      {format(day, 'd')}
                    </span>
                    
                    {/* Dots for events */}
                    <div className="flex flex-wrap gap-1 w-full">
                      {dayEvents.slice(0, 4).map((ev, idx) => {
                        const colorClass = getEventTypeColor(ev.event_type).split(' ')[0]; // Get just the bg color
                        return (
                          <div 
                            key={idx} 
                            className={`h-1.5 w-1.5 rounded-full ${colorClass.replace('bg-', 'bg-')}`} 
                            title={ev.title}
                          />
                        );
                      })}
                      {dayEvents.length > 4 && (
                        <span className="text-[10px] text-muted-foreground leading-none">+</span>
=======
            {/* Simple Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: 35 }, (_, i) => {
                const day = i - 5; // Adjust for month start
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const hasEvents = eventsForDate(date).length > 0;
                const isToday = date.toDateString() === new Date().toDateString();
                
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={`
                      p-3 rounded-lg text-sm transition-all hover:bg-accent
                      ${date.getMonth() !== currentDate.getMonth() ? 'text-muted-foreground opacity-40' : ''}
                      ${isToday ? 'bg-primary text-primary-foreground font-bold' : ''}
                      ${selectedDate?.toDateString() === date.toDateString() ? 'ring-2 ring-primary' : ''}
                    `}
                  >
                    <div className="flex flex-col items-center">
                      <span>{date.getDate()}</span>
                      {hasEvents && (
                        <div className="w-1 h-1 rounded-full bg-primary mt-1" />
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

<<<<<<< HEAD
        {/* Side Panel (Right Side) */}
        <div className="md:col-span-5 lg:col-span-4 space-y-6">
          {/* Selected Date Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg capitalize">
                {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDayEvents.length === 0 ? (
                <EmptyState
                  icon={CalendarIcon}
                  title="Sin eventos"
                  description="No tienes nada programado para este día."
                  className="py-8"
                />
              ) : (
                <div className="space-y-4">
                  {selectedDayEvents.map(event => (
                    <div key={event.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-card hover:shadow-sm transition-all">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-sm">{event.title}</h4>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 ${getEventTypeColor(event.event_type)}`}>
                          {getEventTypeLabel(event.event_type)}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{event.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-md font-medium text-muted-foreground">
                Próximamente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center">No hay eventos futuros</p>
                ) : (
                  upcomingEvents.map(event => (
                    <div key={event.id} className="flex gap-3 items-center">
                      <div className={`w-1 h-8 rounded-full ${getEventTypeColor(event.event_type).split(' ')[0]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(event.start_time), "d MMM, HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
=======
        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próximos Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingEvents.map((event, index) => (
                <div
                  key={event.id}
                  className="p-3 rounded-lg border hover:border-primary/50 transition-all cursor-pointer animate-in slide-in-from-right"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={getEventTypeColor(event.type)}>
                      {getEventTypeLabel(event.type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {event.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <h4 className="font-medium text-sm mb-2">{event.title}</h4>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {event.time}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </div>
                    )}
                    {event.participants && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {event.participants} participantes
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Date Events */}
      {selectedDate && eventsForDate(selectedDate).length > 0 && (
        <Card className="animate-in fade-in duration-300">
          <CardHeader>
            <CardTitle>
              Eventos del {selectedDate.toLocaleDateString('es-ES', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {eventsForDate(selectedDate).map(event => (
                <div
                  key={event.id}
                  className="p-4 rounded-lg border hover:shadow-sm transition-all"
                >
                  <Badge className={`mb-3 ${getEventTypeColor(event.type)}`}>
                    {getEventTypeLabel(event.type)}
                  </Badge>
                  <h3 className="font-semibold mb-3">{event.title}</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {event.time}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {event.location}
                      </div>
                    )}
                    {event.participants && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {event.participants} participantes
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" className="flex-1">
                      Ver Detalles
                    </Button>
                    
                    {/* Show edit/delete buttons only if user has permissions */}
                    <PermissionGate permission="calendar:edit">
                      <Button variant="ghost" size="icon">
                        <Clock className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                    
                    <PermissionGate permission="calendar:delete">
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Users className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
