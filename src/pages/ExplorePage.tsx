import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
  Users,
  Trophy,
  Filter,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface School {
  id: string;
  name: string;
  description: string | null;
  city: string;
  address: string;
  phone: string;
  email: string;
  sports: string[] | null;
  amenities: string[] | null;
  rating: number;
  total_reviews: number;
  verified: boolean;
  logo_url: string | null;
  cover_image_url: string | null;
}

export default function ExplorePage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('rating', { ascending: false });

      if (error) throw error;
      setSchools(data || []);
    } catch (error: any) {
      console.error('Error fetching schools:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las escuelas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSchools = schools.filter((school) => {
    const matchesSearch = !searchQuery ||
      school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.city.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCity = selectedCity === 'all' || school.city === selectedCity;
    
    const matchesSport = selectedSport === 'all' ||
      (school.sports && school.sports.includes(selectedSport));

    return matchesSearch && matchesCity && matchesSport;
  });

  const cities = Array.from(new Set(schools.map(s => s.city))).sort();
  const allSports = Array.from(
    new Set(schools.flatMap(s => s.sports || []))
  ).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
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
                {allSports.map((sport) => (
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
          {filteredSchools.length} {filteredSchools.length === 1 ? 'escuela encontrada' : 'escuelas encontradas'}
        </p>
      </div>

      {/* Schools Grid */}
      {filteredSchools.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No se encontraron escuelas</h3>
          <p className="text-muted-foreground">
            Intenta ajustar tus filtros de búsqueda
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredSchools.map((school) => (
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
