import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '@/hooks/useEvents';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Calendar, Clock, Users, Search, List, Map as MapIcon, Filter } from 'lucide-react';
import type { Event, EventFilters } from '@/types/events';
import { SPORT_OPTIONS, COLOMBIAN_CITIES, EVENT_TYPE_OPTIONS } from '@/types/events';
import { EventsMap } from '@/components/events/EventsMap';

export default function EventsMapPage() {
  const navigate = useNavigate();
  const { getPublicEvents, loading } = useEvents();
  const [events, setEvents] = useState<Event[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<EventFilters>({
    sport: '',
    city: '',
    event_type: undefined
  });

  useEffect(() => {
    loadEvents();
  }, [filters]);

  const loadEvents = async () => {
    const data = await getPublicEvents(filters);
    setEvents(data);
  };

  const handleFilterChange = (key: keyof EventFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
  };

  const clearFilters = () => {
    setFilters({ sport: '', city: '', event_type: undefined });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short'
    });
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Gratis';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const hasActiveFilters = filters.sport || filters.city || filters.event_type;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Eventos Deportivos</h1>
              <p className="text-muted-foreground">
                {events.length} evento{events.length !== 1 ? 's' : ''} disponible{events.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1">
                    {[filters.sport, filters.city, filters.event_type].filter(Boolean).length}
                  </Badge>
                )}
              </Button>

              <div className="flex rounded-lg border overflow-hidden">
                <Button
                  variant={viewMode === 'map' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('map')}
                  className="rounded-none gap-1"
                >
                  <MapIcon className="h-4 w-4" />
                  Mapa
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-none gap-1"
                >
                  <List className="h-4 w-4" />
                  Lista
                </Button>
              </div>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex flex-wrap gap-4">
                <Select value={filters.sport || ''} onValueChange={(v) => handleFilterChange('sport', v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Deporte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {SPORT_OPTIONS.map((sport) => (
                      <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.city || ''} onValueChange={(v) => handleFilterChange('city', v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Ciudad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {COLOMBIAN_CITIES.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.event_type || ''} onValueChange={(v) => handleFilterChange('event_type', v as any)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {EVENT_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {viewMode === 'map' ? (
          <div className="h-[calc(100vh-140px)]">
            <EventsMap
              events={events}
              onEventClick={(event) => navigate(`/event/${event.slug}`)}
            />
          </div>
        ) : (
          <div className="container mx-auto px-4 py-6">
            {events.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No hay eventos disponibles</h3>
                  <p className="text-muted-foreground">
                    {hasActiveFilters
                      ? 'Intenta con otros filtros'
                      : 'Pronto habrá nuevos eventos'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((event) => (
                  <Card
                    key={event.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/event/${event.slug}`)}
                  >
                    <CardContent className="p-0">
                      {/* Image or gradient */}
                      <div className="h-32 bg-gradient-to-br from-orange-400 to-amber-500 relative rounded-t-lg">
                        {event.image_url && (
                          <img src={event.image_url} alt={event.title} className="absolute inset-0 w-full h-full object-cover rounded-t-lg" />
                        )}
                        <div className="absolute top-2 left-2 flex gap-1">
                          <Badge variant="secondary">{event.sport}</Badge>
                        </div>
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-white text-black">{formatPrice(event.price)}</Badge>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <h3 className="font-semibold mb-2 line-clamp-1">{event.title}</h3>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(event.event_date)}</span>
                            <Clock className="h-4 w-4 ml-2" />
                            <span>{event.start_time.slice(0, 5)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span className="truncate">{event.city}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>
                              {event.capacity - (event.approved_count || 0)} cupos disponibles
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
