import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Star, DollarSign, Users, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';

const SPORTS = ['Fútbol', 'Baloncesto', 'Tenis', 'Voleibol', 'Natación', 'Gimnasia'];
const AMENITIES = ['Piscina', 'Gimnasio', 'Cafetería', 'Parqueadero', 'Wi-Fi', 'Vestuarios'];
const CITIES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga'];

export default function AdvancedSearchPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    query: '',
    city: '',
    sports: [] as string[],
    amenities: [] as string[],
    minRating: 0,
    maxPrice: 500000,
    minAge: 5,
    maxAge: 18
  });

  // Demo schools data
  const demoSchools = [
    {
      id: '1',
      name: 'Academia Deportiva Elite',
      city: 'Bogotá',
      rating: 4.8,
      total_reviews: 156,
      sports: ['Fútbol', 'Baloncesto', 'Tenis'],
      amenities: ['Piscina', 'Gimnasio', 'Cafetería', 'Parqueadero'],
      logo_url: null,
      description: 'Academia líder en formación deportiva integral',
      price_range: '$200.000 - $350.000'
    },
    {
      id: '2',
      name: 'Club Deportivo Champions',
      city: 'Medellín',
      rating: 4.6,
      total_reviews: 98,
      sports: ['Fútbol', 'Voleibol', 'Natación'],
      amenities: ['Piscina', 'Vestuarios', 'Wi-Fi', 'Cafetería'],
      logo_url: null,
      description: 'Formando campeones desde 1995',
      price_range: '$180.000 - $300.000'
    },
    {
      id: '3',
      name: 'Escuela de Tenis ProMasters',
      city: 'Bogotá',
      rating: 4.9,
      total_reviews: 203,
      sports: ['Tenis'],
      amenities: ['Gimnasio', 'Cafetería', 'Parqueadero', 'Wi-Fi'],
      logo_url: null,
      description: 'Especialistas en tenis de alto rendimiento',
      price_range: '$250.000 - $450.000'
    }
  ];

  const filteredSchools = demoSchools.filter(school => {
    if (filters.query && !school.name.toLowerCase().includes(filters.query.toLowerCase())) {
      return false;
    }
    if (filters.city && school.city !== filters.city) {
      return false;
    }
    if (filters.sports.length > 0 && !filters.sports.some(sport => school.sports.includes(sport))) {
      return false;
    }
    if (filters.amenities.length > 0 && !filters.amenities.some(amenity => school.amenities.includes(amenity))) {
      return false;
    }
    if (school.rating < filters.minRating) {
      return false;
    }
    return true;
  });

  const toggleArrayFilter = (key: 'sports' | 'amenities', value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      city: '',
      sports: [],
      amenities: [],
      minRating: 0,
      maxPrice: 500000,
      minAge: 5,
      maxAge: 18
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Búsqueda Avanzada de Escuelas</h1>
        <p className="text-muted-foreground">
          Encuentra la escuela deportiva perfecta con nuestros filtros avanzados
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Limpiar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search Query */}
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Nombre de la escuela..."
                  value={filters.query}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Select
                value={filters.city}
                onValueChange={(value) => setFilters({ ...filters, city: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las ciudades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {CITIES.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sports */}
            <div className="space-y-2">
              <Label>Deportes</Label>
              <div className="space-y-2">
                {SPORTS.map(sport => (
                  <div key={sport} className="flex items-center space-x-2">
                    <Checkbox
                      id={sport}
                      checked={filters.sports.includes(sport)}
                      onCheckedChange={() => toggleArrayFilter('sports', sport)}
                    />
                    <label htmlFor={sport} className="text-sm cursor-pointer">
                      {sport}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Amenities */}
            <div className="space-y-2">
              <Label>Instalaciones</Label>
              <div className="space-y-2">
                {AMENITIES.map(amenity => (
                  <div key={amenity} className="flex items-center space-x-2">
                    <Checkbox
                      id={amenity}
                      checked={filters.amenities.includes(amenity)}
                      onCheckedChange={() => toggleArrayFilter('amenities', amenity)}
                    />
                    <label htmlFor={amenity} className="text-sm cursor-pointer">
                      {amenity}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div className="space-y-2">
              <Label>Calificación mínima: {filters.minRating}</Label>
              <Slider
                value={[filters.minRating]}
                onValueChange={([value]) => setFilters({ ...filters, minRating: value })}
                max={5}
                step={0.5}
              />
            </div>

            {/* Age Range */}
            <div className="space-y-2">
              <Label>Rango de edad: {filters.minAge} - {filters.maxAge} años</Label>
              <Slider
                value={[filters.minAge, filters.maxAge]}
                onValueChange={([min, max]) => setFilters({ ...filters, minAge: min, maxAge: max })}
                max={18}
                min={5}
                step={1}
              />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {filteredSchools.length} Escuela{filteredSchools.length !== 1 ? 's' : ''} Encontrada{filteredSchools.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
          </Card>

          {filteredSchools.map(school => (
            <Card 
              key={school.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/schools/${school.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{school.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {school.city}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {school.rating} ({school.total_reviews} reseñas)
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Desde</p>
                    <p className="font-semibold">{school.price_range}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{school.description}</p>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold mb-2">Deportes:</p>
                    <div className="flex flex-wrap gap-2">
                      {school.sports.map(sport => (
                        <Badge key={sport} variant="secondary">{sport}</Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-semibold mb-2">Instalaciones:</p>
                    <div className="flex flex-wrap gap-2">
                      {school.amenities.map(amenity => (
                        <Badge key={amenity} variant="outline">{amenity}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <Button className="w-full">
                  Ver Detalles
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
