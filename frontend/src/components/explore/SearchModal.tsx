import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MapPin, Star, TrendingUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchSuggestion {
  id: string;
  name: string;
  city: string;
  sport?: string;
  rating: number;
  category: 'school' | 'sport' | 'city';
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches] = useState<string[]>([
    'Fútbol en Bogotá',
    'Natación para niños',
    'Tenis',
  ]);
  const navigate = useNavigate();

  // Sugerencias de escuelas reales para demo
  const demoSchools: SearchSuggestion[] = [
    { id: '1', name: 'Academia de Tenis Rafael Nadal', city: 'Bogotá', sport: 'Tenis', rating: 4.9, category: 'school' },
    { id: '2', name: 'Escuela de Fútbol Real Madrid', city: 'Medellín', sport: 'Fútbol', rating: 4.8, category: 'school' },
    { id: '3', name: 'FCBEscola Colombia', city: 'Bogotá', sport: 'Fútbol', rating: 4.9, category: 'school' },
    { id: '4', name: 'Academia Colsanitas', city: 'Bogotá', sport: 'Tenis', rating: 4.7, category: 'school' },
    { id: '5', name: 'Escuela de Natación Michael Phelps', city: 'Cali', sport: 'Natación', rating: 4.8, category: 'school' },
    { id: '6', name: 'Academia Millonarios', city: 'Bogotá', sport: 'Fútbol', rating: 4.6, category: 'school' },
    { id: '7', name: 'Club de Tenis El Campín', city: 'Bogotá', sport: 'Tenis', rating: 4.5, category: 'school' },
    { id: '8', name: 'Escuela de Baloncesto NBA', city: 'Medellín', sport: 'Baloncesto', rating: 4.7, category: 'school' },
    { id: '9', name: 'Academia de Atletismo', city: 'Cali', sport: 'Atletismo', rating: 4.6, category: 'school' },
    { id: '10', name: 'Escuela de Karate Shotokan', city: 'Bogotá', sport: 'Karate', rating: 4.8, category: 'school' },
  ];

  useEffect(() => {
    if (query.length > 0) {
      // Filtrar sugerencias basadas en la búsqueda
      const filtered = demoSchools.filter(
        (school) =>
          school.name.toLowerCase().includes(query.toLowerCase()) ||
          school.city.toLowerCase().includes(query.toLowerCase()) ||
          school.sport?.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 6));
    } else {
      setSuggestions([]);
    }
  }, [query]);

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    onOpenChange(false);
    // Navegar a explore con filtros según el tipo
    if (suggestion.category === 'school') {
      navigate(`/explore?search=${encodeURIComponent(suggestion.name)}`);
    } else if (suggestion.sport) {
      navigate(`/explore?sport=${encodeURIComponent(suggestion.sport)}`);
    }
  };

  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
  };

  const popularSports = ['Fútbol', 'Natación', 'Tenis', 'Baloncesto', 'Karate', 'Atletismo'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl">Buscar escuelas y deportes</DialogTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar escuelas, deportes, programas..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-12 text-base"
              autoFocus
            />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Sugerencias basadas en búsqueda */}
            {suggestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Sugerencias
                </h3>
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Search className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{suggestion.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{suggestion.city}</span>
                          {suggestion.sport && (
                            <>
                              <span>•</span>
                              <span>{suggestion.sport}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{suggestion.rating}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Búsquedas recientes */}
            {query.length === 0 && recentSearches.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Búsquedas recientes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => handleRecentSearchClick(search)}
                    >
                      {search}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Deportes populares */}
            {query.length === 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Deportes populares</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {popularSports.map((sport) => (
                    <Button
                      key={sport}
                      variant="outline"
                      className="justify-start"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/explore?sport=${encodeURIComponent(sport)}`);
                      }}
                    >
                      {sport}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Sin resultados */}
            {query.length > 0 && suggestions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-2">No se encontraron resultados para "{query}"</p>
                <p className="text-sm">Intenta con otro término de búsqueda</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
