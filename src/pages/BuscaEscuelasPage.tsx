import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent } from '@/components/ui/card';
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
  Phone,
  Mail,
  ExternalLink,
  ArrowLeft,
  Filter,
  List,
  Map as MapIcon,
  X,
  Navigation,
  CheckCircle2
} from 'lucide-react';
import { useSchools } from '@/hooks/useSchools';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { useToast } from '@/hooks/use-toast';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Sport icons configuration
const sportIcons: Record<string, string> = {
  'Fútbol': '⚽',
  'Natación': '🏊',
  'Tenis': '🎾',
  'Baloncesto': '🏀',
  'Voleibol': '🏐',
  'Atletismo': '🏃',
  'Gimnasia': '🤸',
  'Karate': '🥋',
  'Patinaje': '⛸️',
  'Ciclismo': '🚴',
};

// Sports data with images for the grid
const sportsData = [
  { name: 'Fútbol', icon: '⚽', image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=300&fit=crop' },
  { name: 'Natación', icon: '🏊', image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&h=300&fit=crop' },
  { name: 'Tenis', icon: '🎾', image: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&h=300&fit=crop' },
  { name: 'Baloncesto', icon: '🏀', image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=300&fit=crop' },
  { name: 'Patinaje', icon: '⛸️', image: 'https://images.unsplash.com/photo-1593786267440-8a0b19fd1767?w=400&h=300&fit=crop' },
  { name: 'Karate', icon: '🥋', image: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=400&h=300&fit=crop' },
];

// Custom marker icon
const createCustomIcon = (sport: string) => {
  const icon = sportIcons[sport] || '🏟️';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background: linear-gradient(135deg, hsl(222, 47%, 40%), hsl(222, 47%, 30%)); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 3px solid white;">${icon}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
};

// Component to fit map bounds to markers
function FitBounds({ schools }: { schools: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (schools.length > 0) {
      const validSchools = schools.filter(s => s.latitude && s.longitude);
      if (validSchools.length > 0) {
        const bounds = L.latLngBounds(
          validSchools.map(s => [Number(s.latitude), Number(s.longitude)])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [schools, map]);
  
  return null;
}

export default function BuscaEscuelasPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCity, setSelectedCity] = useState<string>(searchParams.get('city') || 'all');
  const [selectedSport, setSelectedSport] = useState<string>(searchParams.get('sport') || 'all');
  const [viewMode, setViewMode] = useState<'hybrid' | 'map' | 'list'>('hybrid');
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { schools, loading, error, cities, sports, refetch } = useSchools({
    searchQuery,
    city: selectedCity,
    sport: selectedSport,
  });

  // Filter schools with valid coordinates
  const schoolsWithCoords = useMemo(() => 
    schools.filter(s => s.latitude && s.longitude),
    [schools]
  );

  // Default center (Bogotá)
  const defaultCenter: [number, number] = [4.6097, -74.0817];
  
  const mapCenter = useMemo(() => {
    if (schoolsWithCoords.length > 0) {
      const avgLat = schoolsWithCoords.reduce((sum, s) => sum + Number(s.latitude), 0) / schoolsWithCoords.length;
      const avgLng = schoolsWithCoords.reduce((sum, s) => sum + Number(s.longitude), 0) / schoolsWithCoords.length;
      return [avgLat, avgLng] as [number, number];
    }
    return defaultCenter;
  }, [schoolsWithCoords]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCity('all');
    setSelectedSport('all');
  };

  const hasActiveFilters = searchQuery || selectedCity !== 'all' || selectedSport !== 'all';

  if (loading) {
    return <LoadingSpinner fullScreen text="Cargando escuelas..." />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-lg">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <Link 
              to="/"
              className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Inicio</span>
            </Link>
            
            <h1 className="text-xl font-bold">Busca tu Escuela Deportiva</h1>
            
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'hybrid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('hybrid')}
                className="text-primary-foreground"
              >
                <MapIcon className="h-4 w-4 mr-1" />
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('map')}
                className="text-primary-foreground"
              >
                <MapIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="text-primary-foreground"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Sports Grid (Quick Filters) */}
      <div className="bg-muted/50 border-b py-4 overflow-x-auto">
        <div className="container mx-auto px-4">
          <div className="flex gap-3 min-w-max">
            {sportsData.map((sport) => (
              <button
                key={sport.name}
                onClick={() => setSelectedSport(selectedSport === sport.name ? 'all' : sport.name)}
                className={`relative group flex-shrink-0 rounded-xl overflow-hidden transition-all duration-300 ${
                  selectedSport === sport.name 
                    ? 'ring-4 ring-primary ring-offset-2 scale-105' 
                    : 'hover:scale-105'
                }`}
              >
                <div className="w-28 h-20 relative">
                  <img 
                    src={sport.image} 
                    alt={sport.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                    <span className="text-lg mr-1">{sport.icon}</span>
                    <span className="text-xs font-medium">{sport.name}</span>
                  </div>
                  {selectedSport === sport.name && (
                    <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                      <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-background border-b py-3 px-4 sticky top-0 z-[1000]">
        <div className="container mx-auto">
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar escuela o localidad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* City Filter */}
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Localidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sport Filter (Desktop) */}
            <Select value={selectedSport} onValueChange={setSelectedSport} >
              <SelectTrigger className="w-40 hidden md:flex">
                <SelectValue placeholder="Deporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {sports.map((sport) => (
                  <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          {/* Results Count */}
          <div className="mt-2 text-sm text-muted-foreground">
            {schools.length} {schools.length === 1 ? 'escuela encontrada' : 'escuelas encontradas'}
            {selectedSport !== 'all' && ` de ${selectedSport}`}
            {selectedCity !== 'all' && ` en ${selectedCity}`}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Map Section */}
        {(viewMode === 'hybrid' || viewMode === 'map') && (
          <div className={`relative ${viewMode === 'map' ? 'flex-1' : 'lg:w-2/3'} h-[50vh] lg:h-auto`}>
            <MapContainer
              center={mapCenter}
              zoom={12}
              className="w-full h-full z-0"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {schoolsWithCoords.map((school) => (
                <Marker
                  key={school.id}
                  position={[Number(school.latitude), Number(school.longitude)]}
                  icon={createCustomIcon(school.sports?.[0] || '')}
                  eventHandlers={{
                    click: () => setSelectedSchool(school.id),
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <h3 className="font-bold text-base mb-1">{school.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                        <MapPin className="h-3 w-3" />
                        {school.address}, {school.city}
                      </div>
                      {school.rating && (
                        <div className="flex items-center gap-1 mb-2">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{school.rating.toFixed(1)}</span>
                          <span className="text-muted-foreground text-xs">
                            ({school.total_reviews} reseñas)
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {school.sports?.slice(0, 3).map((sport) => (
                          <Badge key={sport} variant="secondary" className="text-xs">
                            {sportIcons[sport] || '🏟️'} {sport}
                          </Badge>
                        ))}
                      </div>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => navigate(`/schools/${school.id}`)}
                      >
                        Ver Detalles
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              ))}
              
              <FitBounds schools={schoolsWithCoords} />
            </MapContainer>
          </div>
        )}

        {/* Schools List */}
        {(viewMode === 'hybrid' || viewMode === 'list') && (
          <div className={`${viewMode === 'list' ? 'flex-1' : 'lg:w-1/3'} overflow-y-auto bg-background`}>
            <div className="p-4 space-y-4">
              {schools.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="No hay escuelas"
                  description="No se encontraron escuelas con los filtros seleccionados"
                  actionLabel="Limpiar filtros"
                  onAction={clearFilters}
                />
              ) : (
                schools.map((school) => (
                  <Card 
                    key={school.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedSchool === school.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedSchool(school.id);
                      if (viewMode === 'hybrid' && school.latitude && school.longitude) {
                        // Scroll to map on mobile
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* School Logo/Image */}
                        <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
                          {school.logo_url ? (
                            <img 
                              src={school.logo_url} 
                              alt={school.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-primary/20 to-secondary/20">
                              {sportIcons[school.sports?.[0] || ''] || '🏟️'}
                            </div>
                          )}
                        </div>

                        {/* School Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-base line-clamp-1">{school.name}</h3>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="line-clamp-1">{school.city}</span>
                              </div>
                            </div>
                            {school.verified && (
                              <Badge variant="secondary" className="flex-shrink-0 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Verificada
                              </Badge>
                            )}
                          </div>

                          {/* Rating */}
                          {school.rating && school.rating > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-medium text-sm">{school.rating.toFixed(1)}</span>
                              <span className="text-muted-foreground text-xs">
                                ({school.total_reviews} reseñas)
                              </span>
                            </div>
                          )}

                          {/* Sports */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {school.sports?.slice(0, 3).map((sport) => (
                              <Badge key={sport} variant="outline" className="text-xs py-0">
                                {sportIcons[sport] || '🏟️'} {sport}
                              </Badge>
                            ))}
                            {(school.sports?.length || 0) > 3 && (
                              <Badge variant="outline" className="text-xs py-0">
                                +{(school.sports?.length || 0) - 3}
                              </Badge>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 mt-3">
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/schools/${school.id}`);
                              }}
                            >
                              Ver Detalles
                            </Button>
                            {school.phone && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`tel:${school.phone}`, '_self');
                                }}
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
