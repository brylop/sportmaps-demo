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
import { Checkbox } from '@/components/ui/checkbox';
import { Search, MapPin, Star, Filter, X, DollarSign, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';

const SPORTS = ['Fútbol', 'Baloncesto', 'Tenis', 'Voleibol', 'Natación', 'Gimnasia', 'Artes Marciales'];
const AMENITIES = ['Piscina', 'Gimnasio', 'Cafetería', 'Parqueadero', 'Wi-Fi', 'Vestuarios', 'Duchas'];
const CITIES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga'];

interface SchoolWithPrice {
  id: string;
  name: string;
  city: string;
  rating: number | null;
  total_reviews: number | null;
  sports: string[] | null;
  amenities: string[] | null;
  logo_url: string | null;
  description: string | null;
  min_price: number;
  max_price: number;
}

export default function AdvancedSearchPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    query: '',
    city: '',
    sports: [] as string[],
    amenities: [] as string[],
    minRating: 0,
    maxPrice: 1000000, // Aumentado a 1M para cubrir más rangos
    minAge: 5,
    maxAge: 18
  });

  // Fetch real schools data
  const { data: schools, isLoading } = useQuery({
    queryKey: ['schools-advanced-search'],
    queryFn: async () => {
      // Traemos escuelas y sus programas para calcular precios
      const { data, error } = await supabase
        .from('schools')
        .select(`
          *,
          programs (
            price_monthly,
            active
          )
        `)
        .eq('is_demo', false); // Opcional: filtrar solo reales o demos según preferencia

      if (error) throw error;

      // Procesar datos para calcular rango de precios
      return data.map((school: any) => {
        const activePrograms = school.programs?.filter((p: any) => p.active) || [];
        const prices = activePrograms.map((p: any) => p.price_monthly);
        const min_price = prices.length > 0 ? Math.min(...prices) : 0;
        const max_price = prices.length > 0 ? Math.max(...prices) : 0;

        return {
          ...school,
          min_price,
          max_price,
        } as SchoolWithPrice;
      });
    },
  });

  // Filter logic
  const filteredSchools = schools?.filter(school => {
    // Text Search
    if (filters.query && !school.name.toLowerCase().includes(filters.query.toLowerCase())) {
      return false;
    }
    // City
    if (filters.city && school.city !== filters.city) {
      return false;
    }
    // Sports (Any match)
    if (filters.sports.length > 0) {
      const schoolSports = school.sports || [];
      if (!filters.sports.some(sport => schoolSports.includes(sport))) {
        return false;
      }
    }
    // Amenities (All match - stricter filter)
    if (filters.amenities.length > 0) {
      const schoolAmenities = school.amenities || [];
      if (!filters.amenities.every(amenity => schoolAmenities.includes(amenity))) {
        return false;
      }
    }
    // Rating
    if ((school.rating || 0) < filters.minRating) {
      return false;
    }
    // Price (If school has price, min price must be within filter range)
    if (school.min_price > filters.maxPrice) {
      return false;
    }

    return true;
  }) || [];

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
      maxPrice: 1000000,
      minAge: 5,
      maxAge: 18
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Buscando escuelas..." />;
  }

  return (
    <div className="container mx-auto p-6 animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Búsqueda Avanzada</h1>
        <p className="text-muted-foreground">
          Encuentra la escuela deportiva ideal ajustando todos los detalles
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <Card className="lg:col-span-1 h-fit sticky top-4">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
              {(filters.query || filters.city || filters.sports.length > 0 || filters.amenities.length > 0) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
                  <X className="w-3 h-3 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search Query */}
            <div className="space-y-2">
              <Label>Nombre</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Ej: Academia Elite..."
                  value={filters.query}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  className="pl-9"
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

            {/* Price Slider */}
            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Precio Máximo</Label>
                <span className="text-xs text-muted-foreground font-medium">
                  {formatPrice(filters.maxPrice)}
                </span>
              </div>
              <Slider
                value={[filters.maxPrice]}
                onValueChange={([value]) => setFilters({ ...filters, maxPrice: value })}
                max={1000000}
                step={50000}
                className="py-2"
              />
            </div>

            {/* Rating Slider */}
            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Calificación Mínima</Label>
                <span className="text-xs text-muted-foreground font-medium">
                  {filters.minRating > 0 ? `${filters.minRating} estrellas` : 'Cualquiera'}
                </span>
              </div>
              <Slider
                value={[filters.minRating]}
                onValueChange={([value]) => setFilters({ ...filters, minRating: value })}
                max={5}
                step={0.5}
                className="py-2"
              />
            </div>

            {/* Sports Checkboxes */}
            <div className="space-y-3">
              <Label>Deportes</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {SPORTS.map(sport => (
                  <div key={sport} className="flex items-center space-x-2">
                    <Checkbox
                      id={`sport-${sport}`}
                      checked={filters.sports.includes(sport)}
                      onCheckedChange={() => toggleArrayFilter('sports', sport)}
                    />
                    <label htmlFor={`sport-${sport}`} className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {sport}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Amenities Checkboxes */}
            <div className="space-y-3">
              <Label>Servicios / Instalaciones</Label>
              <div className="space-y-2">
                {AMENITIES.map(amenity => (
                  <div key={amenity} className="flex items-center space-x-2">
                    <Checkbox
                      id={`amenity-${amenity}`}
                      checked={filters.amenities.includes(amenity)}
                      onCheckedChange={() => toggleArrayFilter('amenities', amenity)}
                    />
                    <label htmlFor={`amenity-${amenity}`} className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {amenity}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Area */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader className="py-4">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                {filteredSchools.length} {filteredSchools.length === 1 ? 'Escuela encontrada' : 'Escuelas encontradas'}
              </CardTitle>
            </CardHeader>
          </Card>

          {filteredSchools.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No se encontraron resultados"
              description="Intenta ajustar los filtros para encontrar lo que buscas."
              actionLabel="Limpiar Filtros"
              onAction={clearFilters}
            />
          ) : (
            <div className="grid gap-4">
              {filteredSchools.map(school => (
                <Card 
                  key={school.id}
                  className="group cursor-pointer hover:shadow-md transition-all duration-300 hover:border-primary/50"
                  onClick={() => navigate(`/schools/${school.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Image/Logo Placeholder */}
                      <div className="w-full md:w-48 h-32 bg-muted rounded-lg shrink-0 overflow-hidden">
                        {school.logo_url ? (
                          <img src={school.logo_url} alt={school.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-secondary/30 text-muted-foreground">
                            <span className="text-4xl font-bold opacity-20">{school.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-bold group-hover:text-primary transition-colors truncate">
                              {school.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {school.city}
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                <span className="font-medium text-foreground">{school.rating?.toFixed(1) || 'New'}</span>
                                <span>({school.total_reviews || 0})</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground mb-1">Desde</p>
                            <div className="font-bold text-lg text-primary">
                              {school.min_price > 0 ? formatPrice(school.min_price) : 'Consultar'}
                            </div>
                            <p className="text-xs text-muted-foreground">/mes</p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {school.sports?.slice(0, 4).map(sport => (
                              <Badge key={sport} variant="secondary" className="text-xs">
                                {sport}
                              </Badge>
                            ))}
                            {(school.sports?.length || 0) > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{(school.sports?.length || 0) - 4}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {school.amenities?.slice(0, 3).map(amenity => (
                              <span key={amenity} className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-primary/50" />
                                {amenity}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}