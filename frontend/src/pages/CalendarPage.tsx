import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/PermissionGate';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  MapPin,
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
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
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

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
