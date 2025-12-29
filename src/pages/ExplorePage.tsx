import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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
  Navigation,
  CheckCircle2,
  ArrowLeft,
  Map
} from 'lucide-react';
import { useSchools } from '@/hooks/useSchools';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { CompareSchools } from '@/components/explore/CompareSchools';
import { SchoolReviews } from '@/components/explore/SchoolReviews';
import { SearchModal } from '@/components/explore/SearchModal';
import { SchoolMap } from '@/components/explore/SchoolMap';
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
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | undefined>();
  const [hoveredSchoolId, setHoveredSchoolId] = useState<string | undefined>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { schools, loading, error, cities, sports } = useSchools({
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

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <ErrorState
              title="Error de conexión"
              message="No se pudieron cargar las escuelas. Revisa tu conexión a internet e intenta nuevamente."
              onRetry={() => window.location.reload()}
              retryLabel="Recargar página"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Search Modal */}
      <SearchModal open={searchModalOpen} onOpenChange={setSearchModalOpen} />

      {/* Back to Dashboard Button */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <Link 
            to="/dashboard"
            className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Link>
        </div>
      </div>

      {/* Hero Header with Search - Compact */}
      <div className="relative bg-gradient-to-br from-primary via-primary/90 to-secondary text-white py-8 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '32px 32px'
          }} />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto space-y-4 text-center">
            <div className="space-y-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                🏆 {schools.length} escuelas disponibles
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                Encuentra tu Escuela Deportiva
              </h1>
            </div>
            
            {/* Main Search Bar */}
            <div 
              className="relative max-w-2xl mx-auto cursor-pointer group"
              onClick={() => setSearchModalOpen(true)}
            >
              <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl group-hover:bg-white/30 transition-all" />
              <div className="relative">
                <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Busca fútbol, natación, tenis..."
                  className="pl-12 pr-4 h-12 text-base bg-white rounded-xl shadow-2xl border-0 focus:ring-4 focus:ring-white/50"
                  readOnly
                />
              </div>
            </div>

            {/* Quick Search Suggestions */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
              {['Fútbol', 'Natación', 'Tenis', 'Baloncesto', 'Karate'].map((sport) => (
                <Badge 
                  key={sport}
                  variant="outline" 
                  className="border-white/30 text-white hover:bg-white/20 cursor-pointer text-xs"
                  onClick={() => {
                    setSelectedSport(sport);
                  }}
                >
                  {sport}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MAP SECTION - PROMINENTLY DISPLAYED */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Map className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold">Mapa de Escuelas</h2>
            <Badge variant="secondary">{schools.length} ubicaciones</Badge>
          </div>
          <Button
            variant={nearMe ? 'default' : 'outline'}
            onClick={handleNearMeToggle}
            size="sm"
          >
            <Navigation className="h-4 w-4 mr-2" />
            {nearMe ? 'Ubicación activa' : 'Cerca de mí'}
          </Button>
        </div>
        <SchoolMap
          schools={schools}
          userLocation={userLocation}
          selectedSchoolId={selectedSchoolId}
          onSchoolSelect={setSelectedSchoolId}
          hoveredSchoolId={hoveredSchoolId}
          onSchoolHover={(id) => setHoveredSchoolId(id || undefined)}
        />
      </div>

      {/* Age Groups Section */}
      <div className="bg-muted/30 py-12 border-y">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Explora por edad</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { label: 'Familia', sublabel: 'Todas las edades', icon: '👨‍👩‍👧‍👦', range: '' },
              { label: 'Primera infancia', sublabel: '0 - 5 años', icon: '👶', range: '0-5' },
              { label: 'Niños', sublabel: '6 - 11 años', icon: '🧒', range: '6-11' },
              { label: 'Adolescentes', sublabel: '12 - 17 años', icon: '🧑', range: '12-17' },
              { label: 'Jóvenes', sublabel: '18 - 26 años', icon: '👱', range: '18-26' },
              { label: 'Adultos', sublabel: '27 - 59 años', icon: '🧔', range: '27-59' },
            ].map((group, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedAgeRange(group.range);
                  const element = document.getElementById('results-section');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`flex flex-col items-center gap-3 p-4 rounded-2xl bg-background hover:bg-accent transition-all group ${
                  selectedAgeRange === group.range ? 'ring-2 ring-primary bg-accent' : ''
                }`}
              >
                <div className="text-5xl group-hover:scale-110 transition-transform">
                  {group.icon}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">{group.label}</p>
                  <p className="text-xs text-muted-foreground">{group.sublabel}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div id="results-section" className="container mx-auto px-4 py-8 space-y-6">
        {/* Filters Section */}
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Primary Filters Row */}
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Refina tu búsqueda</h3>
              </div>
              
              <div className="grid gap-4 md:grid-cols-5">
                {/* Near Me Button */}
                <Button
                  variant={nearMe ? 'default' : 'outline'}
                  onClick={handleNearMeToggle}
                  className="h-11"
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
            {(nearMe || selectedCity !== 'all' || selectedSport !== 'all' || selectedLevel !== 'all' || searchQuery || selectedAgeRange || priceRange[0] > 0 || priceRange[1] < 500000) && (
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
                {selectedAgeRange && (
                  <Badge variant="secondary" className="gap-1">
                    Edad: {selectedAgeRange} años
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => setSelectedAgeRange('')}
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
                    setSelectedAgeRange('');
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
          <>
            {/* Schools Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Escuelas Disponibles</h2>
                <p className="text-muted-foreground mt-1">
                  Haz clic en una escuela para ver sus programas
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {schools.map((school) => (
                <Card
                  key={school.id}
                  className={`group overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 ${
                    hoveredSchoolId === school.id || selectedSchoolId === school.id
                      ? 'border-primary shadow-xl ring-2 ring-primary/20' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => navigate(`/schools/${school.id}`)}
                  onMouseEnter={() => setHoveredSchoolId(school.id)}
                  onMouseLeave={() => setHoveredSchoolId(undefined)}
                >
                  {/* Cover Image */}
                  <div className="relative h-56 bg-gradient-to-br from-primary/20 to-secondary/20 bg-cover bg-center overflow-hidden">
                    {school.cover_image_url ? (
                      <img 
                        src={school.cover_image_url} 
                        alt={school.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Trophy className="h-16 w-16 text-white/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {school.verified && (
                      <Badge 
                        className="absolute top-3 right-3 bg-white/90 text-foreground border-0"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verificada
                      </Badge>
                    )}
                  </div>

                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <CardTitle className="text-xl line-clamp-2 group-hover:text-primary transition-colors">
                          {school.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span className="line-clamp-1">{school.city}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 px-3 py-1 bg-yellow-50 rounded-full border border-yellow-200">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold text-yellow-700">{school.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {school.total_reviews} reseñas
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Description */}
                    {school.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {school.description}
                      </p>
                    )}

                    {/* Sports */}
                    {school.sports && school.sports.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {school.sports.slice(0, 4).map((sport) => (
                          <Badge key={sport} variant="secondary" className="text-xs font-medium">
                            {sport}
                          </Badge>
                        ))}
                        {school.sports.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{school.sports.length - 4} más
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        className="flex-1 group-hover:shadow-md transition-shadow" 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/schools/${school.id}`);
                        }}
                      >
                        Ver Programas
                        <Target className="h-4 w-4 ml-2" />
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
          </>
        )}
      </div>
    </div>
  );
}
