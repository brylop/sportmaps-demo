import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeCalendar } from '@/hooks/useRealtime';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time: string;
  location?: string;
  all_day: boolean;
}

export default function CalendarAdvancedPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'training',
    start_time: '',
    end_time: '',
    location: '',
    all_day: false
  });

  // Demo events
  const demoEvents: CalendarEvent[] = [
    {
      id: '1',
      title: 'Entrenamiento Fútbol Sub-12',
      description: 'Práctica de técnica y táctica',
      event_type: 'training',
      start_time: new Date(Date.now() + 86400000).toISOString(),
      end_time: new Date(Date.now() + 90000000).toISOString(),
      location: 'Campo Principal',
      all_day: false
    },
    {
      id: '2',
      title: 'Partido amistoso',
      description: 'vs Club Deportivo Central',
      event_type: 'match',
      start_time: new Date(Date.now() + 172800000).toISOString(),
      end_time: new Date(Date.now() + 180000000).toISOString(),
      location: 'Estadio Municipal',
      all_day: false
    },
    {
      id: '3',
      title: 'Reunión con padres',
      description: 'Actualización de progreso trimestral',
      event_type: 'meeting',
      start_time: new Date(Date.now() + 259200000).toISOString(),
      end_time: new Date(Date.now() + 262800000).toISOString(),
      location: 'Sala de conferencias',
      all_day: false
    }
  ];

  const [events] = useState<CalendarEvent[]>(demoEvents);

  // Real-time calendar updates
  useRealtimeCalendar(() => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: typeof newEvent) => {
      // This would create in actual database
      toast({
        title: '✅ Evento creado',
        description: `${eventData.title} ha sido agregado al calendario`,
      });
      return eventData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setDialogOpen(false);
      resetForm();
    }
  });

  const resetForm = () => {
    setNewEvent({
      title: '',
      description: '',
      event_type: 'training',
      start_time: '',
      end_time: '',
      location: '',
      all_day: false
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEventMutation.mutate(newEvent);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'training':
        return 'bg-blue-500';
      case 'match':
        return 'bg-green-500';
      case 'meeting':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'training':
        return 'Entrenamiento';
      case 'match':
        return 'Partido';
      case 'meeting':
        return 'Reunión';
      default:
        return 'Otro';
    }
  };

  const todaysEvents = events.filter(event => {
    const eventDate = new Date(event.start_time);
    const today = selectedDate || new Date();
    return eventDate.toDateString() === today.toDateString();
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Calendario Avanzado</h1>
          <p className="text-muted-foreground">
            Gestiona tus entrenamientos, partidos y reuniones
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Evento
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Calendario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              locale={es}
            />
          </CardContent>
        </Card>

        {/* Events for selected date */}
        <Card>
          <CardHeader>
            <CardTitle>
              Eventos - {selectedDate ? format(selectedDate, 'PPPP', { locale: es }) : 'Hoy'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todaysEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay eventos para este día
              </p>
            ) : (
              todaysEvents.map((event) => (
                <Card key={event.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold">{event.title}</h3>
                      <Badge className={getEventTypeColor(event.event_type)}>
                        {getEventTypeLabel(event.event_type)}
                      </Badge>
                    </div>
                    
                    {event.description && (
                      <p className="text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {format(new Date(event.start_time), 'HH:mm')} - {format(new Date(event.end_time), 'HH:mm')}
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {event.location}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming events */}
      <Card>
        <CardHeader>
          <CardTitle>Próximos Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${getEventTypeColor(event.event_type)}`} />
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.start_time), 'PPP', { locale: es })} a las {format(new Date(event.start_time), 'HH:mm')}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">
                  {getEventTypeLabel(event.event_type)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Evento</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_type">Tipo de Evento *</Label>
              <Select
                value={newEvent.event_type}
                onValueChange={(value) => setNewEvent({ ...newEvent, event_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="training">Entrenamiento</SelectItem>
                  <SelectItem value="match">Partido</SelectItem>
                  <SelectItem value="meeting">Reunión</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_time">Hora de Inicio *</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  value={newEvent.start_time}
                  onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_time">Hora de Fin *</Label>
                <Input
                  id="end_time"
                  type="datetime-local"
                  value={newEvent.end_time}
                  onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                value={newEvent.location}
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                placeholder="Campo deportivo, sala, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Detalles adicionales del evento..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createEventMutation.isPending}>
                {createEventMutation.isPending ? 'Creando...' : 'Crear Evento'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
