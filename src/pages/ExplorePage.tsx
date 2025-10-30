import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  MessageSquare,
  Navigation
} from 'lucide-react';
import { useSchools } from '@/hooks/useSchools';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { CompareSchools } from '@/components/explore/CompareSchools';
import { SchoolReviews } from '@/components/explore/SchoolReviews';
import { SearchModal } from '@/components/explore/SearchModal';
import { useToast } from '@/hooks/use-toast';

export default function ExplorePage() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCity, setSelectedCity] = useState<string>(searchParams.get('city') || 'all');
  const [selectedSport, setSelectedSport] = useState<string>(searchParams.get('sport') || 'all');
  const [priceRange, setPriceRange] = useState<number[]>([0, 500000]);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { schools, loading, cities, sports } = useSchools({
    searchQuery,
    city: selectedCity,
    sport: selectedSport,
  });

  useEffect(() => {
    const search = searchParams.get('search');
    const city = searchParams.get('city');
    const sport = searchParams.get('sport');
    
    if (search) setSearchQuery(search);
    if (city) setSelectedCity(city);
    if (sport) setSelectedSport(sport);
  }, [searchParams]);

  const handleNearMeToggle = () => {
    if (!nearMe) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setNearMe(true);
            toast({
              title: 'Ubicación obtenida',
              description: 'Mostrando escuelas cerca de ti',
            });
          },
          (error) => {
            toast({
              title: 'Error de ubicación',
              description: 'No se pudo obtener tu ubicación. Por favor, habilita los permisos de ubicación.',
              variant: 'destructive',
            });
          }
        );
      } else {
        toast({
          title: 'Ubicación no disponible',
          description: 'Tu navegador no soporta geolocalización',
          variant: 'destructive',
        });
      }
    } else {
      setNearMe(false);
      setUserLocation(null);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Cargando escuelas..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Search Modal */}
      <SearchModal open={searchModalOpen} onOpenChange={setSearchModalOpen} />

      {/* Hero Header with Search */}
      <div className="bg-gradient-hero text-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-6 text-center">
            <h1 className="text-4xl md:text-5xl font-bold">
              Encuentra tu Escuela Deportiva Ideal
            </h1>
            <p className="text-lg text-white/90">
              Miles de programas deportivos para todas las edades
            </p>
            
            {/* Main Search Bar */}
            <div 
              className="relative max-w-2xl mx-auto cursor-pointer"
              onClick={() => setSearchModalOpen(true)}
            >
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar escuelas, deportes, programas..."
                className="pl-12 h-14 text-base bg-white"
                readOnly
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Primary Filters Row */}
              <div className="grid gap-4 md:grid-cols-5">
                {/* Near Me Button */}
                <Button
                  variant={nearMe ? 'default' : 'outline'}
                  onClick={handleNearMeToggle}
                  className="h-10"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Cerca de mí
                </Button>

                {/* City Filter */}
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ciudad" />
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
                    <SelectValue placeholder="Deporte" />
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
                    <SelectValue placeholder="Nivel" />
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
            {(nearMe || selectedCity !== 'all' || selectedSport !== 'all' || selectedLevel !== 'all' || searchQuery || priceRange[0] > 0 || priceRange[1] < 500000) && (
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <span className="text-sm text-muted-foreground">Filtros activos:</span>
                {nearMe && (
                  <Badge variant="secondary" className="gap-1">
                    Cerca de mí
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => {
                        setNearMe(false);
                        setUserLocation(null);
                      }}
                    />
                  </Badge>
                )}
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
                    setNearMe(false);
                    setUserLocation(null);
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
            {nearMe && userLocation && ' cerca de ti'}
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
              setNearMe(false);
              setUserLocation(null);
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
    </div>
  );
}
