import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Trophy, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function SearchFilters() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    location: '',
    sport: '',
    priceRange: '',
    level: ''
  });

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (filters.location) params.append('city', filters.location);
    if (filters.sport) params.append('sport', filters.sport);
    if (filters.priceRange) params.append('price', filters.priceRange);
    if (filters.level) params.append('level', filters.level);
    
    navigate(`/explore?${params.toString()}`);
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Búsqueda Avanzada</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Ubicación
            </Label>
            <Input
              id="location"
              placeholder="Ciudad o región"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            />
          </div>

          {/* Sport */}
          <div className="space-y-2">
            <Label htmlFor="sport" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Disciplina
            </Label>
            <Select value={filters.sport} onValueChange={(value) => setFilters({ ...filters, sport: value })}>
              <SelectTrigger id="sport">
                <SelectValue placeholder="Selecciona deporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="futbol">Fútbol</SelectItem>
                <SelectItem value="basketball">Basketball</SelectItem>
                <SelectItem value="natacion">Natación</SelectItem>
                <SelectItem value="tenis">Tenis</SelectItem>
                <SelectItem value="voleibol">Voleibol</SelectItem>
                <SelectItem value="atletismo">Atletismo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <Label htmlFor="price" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Presupuesto
            </Label>
            <Select value={filters.priceRange} onValueChange={(value) => setFilters({ ...filters, priceRange: value })}>
              <SelectTrigger id="price">
                <SelectValue placeholder="Rango de precio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-100000">$0 - $100,000</SelectItem>
                <SelectItem value="100000-200000">$100,000 - $200,000</SelectItem>
                <SelectItem value="200000-300000">$200,000 - $300,000</SelectItem>
                <SelectItem value="300000+">$300,000+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Level */}
          <div className="space-y-2">
            <Label htmlFor="level" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Nivel
            </Label>
            <Select value={filters.level} onValueChange={(value) => setFilters({ ...filters, level: value })}>
              <SelectTrigger id="level">
                <SelectValue placeholder="Nivel deportivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="principiante">Principiante</SelectItem>
                <SelectItem value="intermedio">Intermedio</SelectItem>
                <SelectItem value="avanzado">Avanzado</SelectItem>
                <SelectItem value="profesional">Profesional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleSearch} className="w-full md:w-auto" size="lg">
          <Search className="h-4 w-4 mr-2" />
          Buscar Escuelas
        </Button>
      </CardContent>
    </Card>
  );
}
