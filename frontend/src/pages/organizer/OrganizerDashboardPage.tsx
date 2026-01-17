import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvents } from '@/hooks/useEvents';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Calendar,
  Users,
  MapPin,
  Clock,
  Eye,
  Settings,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import type { Event, EventStats } from '@/types/events';

export default function OrganizerDashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { getMyEvents, getOrganizerStats, loading } = useEvents();
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [eventsData, statsData] = await Promise.all([
      getMyEvents(),
      getOrganizerStats()
    ]);
    setEvents(eventsData);
    setStats(statsData);
  };

  const getStatusBadge = (status: Event['status']) => {
    const variants: Record<Event['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'outline', label: 'Borrador' },
      active: { variant: 'default', label: 'Activo' },
      closed: { variant: 'secondary', label: 'Cerrado' },
      cancelled: { variant: 'destructive', label: 'Cancelado' },
      completed: { variant: 'secondary', label: 'Completado' }
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Gratis';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Hola, {profile?.full_name?.split(' ')[0] || 'Organizador'} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus eventos deportivos desde aquí
          </p>
        </div>
        <Button onClick={() => navigate('/organizer/create-event')} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Crear Evento
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Eventos Totales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.total_events || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Eventos Activos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats?.active_events || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              Pendientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{stats?.pending_registrations || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Inscritos Aprobados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{stats?.approved_registrations || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mis Eventos
          </CardTitle>
          <CardDescription>
            {events.length === 0 ? 'Aún no tienes eventos creados' : `${events.length} evento(s) creado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No tienes eventos aún</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primer evento y comienza a recibir inscripciones
              </p>
              <Button onClick={() => navigate('/organizer/create-event')} className="gap-2">
                <Plus className="h-4 w-4" />
                Crear mi primer evento
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer gap-4"
                  onClick={() => navigate(`/organizer/event/${event.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{event.title}</h3>
                      {getStatusBadge(event.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(event.event_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {event.start_time.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.city}
                      </span>
                      <span className="font-medium text-primary">
                        {formatPrice(event.price)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/event/${event.slug}`, '_blank');
                      }}
                      className="gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      Ver público
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/organizer/event/${event.id}`);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
