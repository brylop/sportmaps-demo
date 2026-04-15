import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Calendar,
  MapPin,
  Search,
  Eye,
  Settings,
  Ticket,
  Users,
} from 'lucide-react';
import type { Event } from '@/types/events';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicado' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'completed', label: 'Completado' },
];

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  draft: { variant: 'outline', label: 'Borrador' },
  published: { variant: 'default', label: 'Publicado' },
  active: { variant: 'default', label: 'Activo' },
  closed: { variant: 'secondary', label: 'Cerrado' },
  cancelled: { variant: 'destructive', label: 'Cancelado' },
  completed: { variant: 'secondary', label: 'Completado' },
};

export default function OrganizerEventsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await bffClient.get<any[]>('/api/v1/events/mine');
      setEvents(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = events.filter((e) => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.city || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  const counts = {
    all: events.length,
    draft: events.filter(e => e.status === 'draft').length,
    published: events.filter(e => e.status === 'published').length,
    closed: events.filter(e => e.status === 'closed').length,
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mis Eventos</h1>
          <p className="text-muted-foreground">{events.length} evento(s) en total</p>
        </div>
        <Button onClick={() => navigate('/organizer/create-event')} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Evento
        </Button>
      </div>

      {/* Quick stat pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'Total', count: counts.all, filter: 'all' },
          { label: 'Borradores', count: counts.draft, filter: 'draft' },
          { label: 'Publicados', count: counts.published, filter: 'published' },
          { label: 'Cerrados', count: counts.closed, filter: 'closed' },
        ].map(({ label, count, filter }) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === filter
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-accent'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o ciudad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Events grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              {events.length === 0 ? 'No tienes eventos aún' : 'Sin resultados'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {events.length === 0
                ? 'Crea tu primer evento deportivo'
                : 'Prueba con otros filtros de búsqueda'}
            </p>
            {events.length === 0 && (
              <Button onClick={() => navigate('/organizer/create-event')} className="gap-2">
                <Plus className="h-4 w-4" />
                Crear Evento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event) => {
            const cfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft;
            return (
              <Card
                key={event.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/organizer/event/${event.id}`)}
              >
                {event.image_url && (
                  <div className="h-32 overflow-hidden rounded-t-lg">
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardContent className={event.image_url ? 'pt-4' : 'pt-6'}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold line-clamp-2">{event.title}</h3>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(event.event_date)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.city || 'Sin ciudad'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Ticket className="h-3.5 w-3.5" />
                      {event.sport}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/event/${event.slug}`, '_blank');
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/organizer/event/${event.id}`);
                      }}
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Gestionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
