import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  MapPin,
  Star,
  Trophy,
  X
} from 'lucide-react';
import { useSchools } from '@/hooks/useSchools';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const navigate = useNavigate();

  const { schools, loading, cities, sports } = useSchools({
    searchQuery,
    city: selectedCity,
    sport: selectedSport,
  });

  if (loading) {
    return <LoadingSpinner fullScreen text="Cargando escuelas..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Explorar Escuelas Deportivas</h1>
        <p className="text-muted-foreground">
          Descubre las mejores academias y centros deportivos en tu ciudad
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar escuelas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* City Filter */}
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las ciudades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las ciudades</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sport Filter */}
            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los deportes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los deportes</SelectItem>
                {sports.map((sport) => (
                  <SelectItem key={sport} value={sport}>
                    {sport}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters */}
          {(selectedCity !== 'all' || selectedSport !== 'all' || searchQuery) && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-sm text-muted-foreground">Filtros activos:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Búsqueda: {searchQuery}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSearchQuery('')}
                  />
                </Badge>
              )}
              {selectedCity !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Ciudad: {selectedCity}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedCity('all')}
                  />
                </Badge>
              )}
              {selectedSport !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Deporte: {selectedSport}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedSport('all')}
                  />
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCity('all');
                  setSelectedSport('all');
                }}
              >
                Limpiar todo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {schools.length} {schools.length === 1 ? 'escuela encontrada' : 'escuelas encontradas'}
        </p>
      </div>

      {/* Schools Grid */}
      {schools.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No se encontraron escuelas"
          description="Intenta ajustar tus filtros de búsqueda"
          actionLabel="Limpiar filtros"
          onAction={() => {
            setSearchQuery('');
            setSelectedCity('all');
            setSelectedSport('all');
          }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {schools.map((school) => (
            <Card
              key={school.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/schools/${school.id}`)}
            >
              {/* Cover Image */}
              <div
                className="h-48 bg-gradient-to-br from-primary/20 to-secondary/20 bg-cover bg-center"
                style={
                  school.cover_image_url
                    ? { backgroundImage: `url(${school.cover_image_url})` }
                    : undefined
                }
              />

              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <CardTitle className="text-xl line-clamp-1">
                      {school.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="line-clamp-1">{school.city}</span>
                    </div>
                  </div>
                  {school.verified && (
                    <Badge variant="default" className="shrink-0">
                      Verificada
                    </Badge>
                  )}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{school.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({school.total_reviews} reseñas)
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Description */}
                {school.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {school.description}
                  </p>
                )}

                {/* Sports */}
                {school.sports && school.sports.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {school.sports.slice(0, 3).map((sport) => (
                      <Badge key={sport} variant="secondary" className="text-xs">
                        {sport}
                      </Badge>
                    ))}
                    {school.sports.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{school.sports.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <Button className="w-full" variant="outline">
                  Ver Detalles
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
