import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar as CalendarIcon, Clock, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';

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
}

export default function CalendarAdvancedPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'training',
    start_time: '',
    end_time: '',
    location: '',
    all_day: false
  });

  // 1. Fetch Events
  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
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

  // 2. Create Event Mutation
  const createEventMutation = useMutation({
    mutationFn: async (eventData: typeof newEvent) => {
      if (!user) throw new Error('Usuario no autenticado');

      const { error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: user.id,
          title: eventData.title,
          description: eventData.description || null,
          event_type: eventData.event_type,
          start_time: eventData.start_time, // Asegúrate de que el input datetime-local envíe ISO string o compatible
          end_time: eventData.end_time,
          location: eventData.location || null,
          all_day: eventData.all_day
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: '✅ Evento creado',
        description: `${newEvent.title} ha sido agregado al calendario`,
      });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el evento',
        variant: 'destructive',
      });
    }
  });

  // Set default times when opening dialog
  useEffect(() => {
    if (dialogOpen && selectedDate) {
      const start = new Date(selectedDate);
      start.setHours(9, 0, 0, 0); // 9:00 AM default
      
      const end = new Date(selectedDate);
      end.setHours(10, 0, 0, 0); // 10:00 AM default

      // Format for datetime-local input: YYYY-MM-DDTHH:mm
      const formatForInput = (date: Date) => {
        const offset = date.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
        return localISOTime;
      };

      setNewEvent(prev => ({
        ...prev,
        start_time: formatForInput(start),
        end_time: formatForInput(end)
      }));
    }
  }, [dialogOpen, selectedDate]);

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
      case 'training': return 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200';
      case 'match': return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200';
      case 'meeting': return 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'training': return 'Entrenamiento';
      case 'match': return 'Partido';
      case 'meeting': return 'Reunión';
      default: return 'Otro';
    }
  };

  // Filter events for the selected date
  const todaysEvents = events?.filter(event => {
    if (!selectedDate) return false;
    const eventDate = new Date(event.start_time);
    return eventDate.toDateString() === selectedDate.toDateString();
  }) || [];

  // Upcoming events (future)
  const upcomingEvents = events?.filter(event => {
    return new Date(event.start_time) > new Date();
  }).slice(0, 5) || [];

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando calendario..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Calendario</h1>
          <p className="text-muted-foreground mt-1">
            Organiza tus actividades deportivas
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Evento
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Calendar & Upcoming */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardContent className="p-4 flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border shadow-sm"
                locale={es}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Próximos Eventos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay eventos futuros programados
                </p>
              ) : (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="flex gap-3 items-start border-l-2 border-primary pl-3 py-1">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.start_time), "d 'de' MMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Daily Schedule */}
        <div className="lg:col-span-8">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Agenda del {selectedDate ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es }) : 'Día'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todaysEvents.length === 0 ? (
                <EmptyState
                  icon={CalendarIcon}
                  title="Día libre"
                  description="No tienes eventos programados para esta fecha."
                  actionLabel="Crear Evento"
                  onAction={() => setDialogOpen(true)}
                  className="py-12"
                />
              ) : (
                <div className="space-y-4">
                  {todaysEvents.map((event) => (
                    <Card key={event.id} className="hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: 'hsl(var(--primary))' }}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-lg">{event.title}</h3>
                              <Badge className={getEventTypeColor(event.event_type)} variant="outline">
                                {getEventTypeLabel(event.event_type)}
                              </Badge>
                            </div>
                            
                            {event.description && (
                              <p className="text-sm text-muted-foreground">
                                {event.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                              <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                                <Clock className="w-3 h-3" />
                                {format(new Date(event.start_time), 'HH:mm')} - {format(new Date(event.end_time), 'HH:mm')}
                              </div>
                              
                              {event.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {event.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Evento</DialogTitle>
            <DialogDescription>Agrega una actividad a tu calendario personal.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Ej: Entrenamiento físico"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_type">Tipo *</Label>
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
              
              <div className="space-y-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Ej: Cancha 1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Inicio *</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  value={newEvent.start_time}
                  onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_time">Fin *</Label>
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
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Detalles adicionales..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createEventMutation.isPending}>
                {createEventMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Evento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}