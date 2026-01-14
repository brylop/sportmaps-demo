import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PermissionGate } from '@/components/PermissionGate';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  MapPin,
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
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
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

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