import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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
  X,
  DollarSign,
  Target,
  MessageSquare
} from 'lucide-react';
import { useSchools } from '@/hooks/useSchools';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { CompareSchools } from '@/components/explore/CompareSchools';
import { SchoolReviews } from '@/components/explore/SchoolReviews';

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<number[]>([0, 500000]);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
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
          <div className="space-y-6">
            {/* Primary Filters Row */}
            <div className="grid gap-4 md:grid-cols-4">
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

              {/* Level Filter */}
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los niveles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los niveles</SelectItem>
                  <SelectItem value="principiante">Principiante</SelectItem>
                  <SelectItem value="intermedio">Intermedio</SelectItem>
                  <SelectItem value="avanzado">Avanzado</SelectItem>
                  <SelectItem value="profesional">Profesional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Range Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Rango de Presupuesto Mensual
              </Label>
              <div className="px-2">
                <Slider
                  min={0}
                  max={500000}
                  step={10000}
                  value={priceRange}
                  onValueChange={setPriceRange}
                  className="mb-2"
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>${priceRange[0].toLocaleString('es-CO')}</span>
                  <span>${priceRange[1].toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Filters */}
          {(selectedCity !== 'all' || selectedSport !== 'all' || selectedLevel !== 'all' || searchQuery || priceRange[0] > 0 || priceRange[1] < 500000) && (
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
              {selectedLevel !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Nivel: {selectedLevel}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedLevel('all')}
                  />
                </Badge>
              )}
              {(priceRange[0] > 0 || priceRange[1] < 500000) && (
                <Badge variant="secondary" className="gap-1">
                  Precio: ${priceRange[0].toLocaleString()} - ${priceRange[1].toLocaleString()}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setPriceRange([0, 500000])}
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
                  setSelectedLevel('all');
                  setPriceRange([0, 500000]);
                }}
              >
                Limpiar todo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Count and Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <p className="text-sm text-muted-foreground">
          {schools.length} {schools.length === 1 ? 'escuela encontrada' : 'escuelas encontradas'}
        </p>
        <CompareSchools schools={schools} />
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

                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/schools/${school.id}`);
                    }}
                  >
                    Ver Detalles
                  </Button>
                  <SchoolReviews 
                    schoolId={school.id}
                    schoolName={school.name}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
