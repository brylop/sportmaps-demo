import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Search, 
  School, 
  ShoppingBag, 
  Stethoscope, 
  MapPin, 
  Star,
  TrendingUp,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'school' | 'product' | 'professional';
  title: string;
  subtitle: string;
  rating?: number;
  distance?: string;
  price?: number;
  image?: string;
}

interface GlobalSearchProps {
  className?: string;
  placeholder?: string;
  onResultSelect?: (result: SearchResult) => void;
}

export function GlobalSearch({ className, placeholder = "Buscar escuelas, productos, profesionales...", onResultSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<{
    schools: SearchResult[];
    products: SearchResult[];
    professionals: SearchResult[];
  }>({ schools: [], products: [], professionals: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults({ schools: [], products: [], professionals: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Search schools
        const { data: schoolsData } = await supabase
          .from('schools')
          .select('id, name, city, rating, sports, logo_url')
          .or(`name.ilike.%${query}%,city.ilike.%${query}%,sports.cs.{${query}}`)
          .limit(5);

        // Search products
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name, category, price, rating, image_url')
          .or(`name.ilike.%${query}%,category.ilike.%${query}%`)
          .limit(5);

        // Search wellness professionals (from profiles with wellness role)
        const { data: professionalsData } = await supabase
          .from('profiles')
          .select('id, full_name, bio, avatar_url')
          .eq('role', 'wellness_professional')
          .ilike('full_name', `%${query}%`)
          .limit(5);

        setResults({
          schools: (schoolsData || []).map(s => ({
            id: s.id,
            type: 'school' as const,
            title: s.name,
            subtitle: `${s.city} • ${s.sports?.slice(0, 2).join(', ') || 'Deportes varios'}`,
            rating: s.rating || 0,
            image: s.logo_url || undefined,
          })),
          products: (productsData || []).map(p => ({
            id: p.id,
            type: 'product' as const,
            title: p.name,
            subtitle: p.category,
            rating: p.rating || 0,
            price: p.price,
            image: p.image_url || undefined,
          })),
          professionals: (professionalsData || []).map(p => ({
            id: p.id,
            type: 'professional' as const,
            title: p.full_name,
            subtitle: p.bio?.slice(0, 50) || 'Profesional de salud',
            image: p.avatar_url || undefined,
          })),
        });
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    
    if (onResultSelect) {
      onResultSelect(result);
      return;
    }

    switch (result.type) {
      case 'school':
        navigate(`/school/${result.id}`);
        break;
      case 'product':
        navigate(`/shop?product=${result.id}`);
        break;
      case 'professional':
        navigate(`/wellness?professional=${result.id}`);
        break;
    }
  };

  const totalResults = results.schools.length + results.products.length + results.professionals.length;
  const hasResults = totalResults > 0;

  const popularSearches = ['Fútbol', 'Natación', 'Nutricionista', 'Balones', 'Tenis'];

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-12 pr-10 h-12 text-base rounded-xl border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg max-h-[70vh] overflow-y-auto">
          <div className="p-4">
            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="loading-spinner h-8 w-8" />
              </div>
            )}

            {/* No Query - Show Popular */}
            {!query && !loading && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>Búsquedas populares</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map((term) => (
                    <Badge
                      key={term}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => {
                        setQuery(term);
                        inputRef.current?.focus();
                      }}
                    >
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {query && !loading && !hasResults && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron resultados para "{query}"</p>
                <p className="text-sm mt-1">Intenta con otros términos</p>
              </div>
            )}

            {/* Results by Category */}
            {query && !loading && hasResults && (
              <div className="space-y-4">
                {/* Schools */}
                {results.schools.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <School className="h-4 w-4 text-primary" />
                      <span>Escuelas</span>
                      <Badge variant="secondary" className="ml-auto">{results.schools.length}</Badge>
                    </div>
                    <div className="space-y-1">
                      {results.schools.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                        >
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {result.image ? (
                              <img src={result.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                            ) : (
                              <School className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                          {result.rating !== undefined && result.rating > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="h-4 w-4 text-accent fill-current" />
                              <span>{result.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Products */}
                {results.products.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <ShoppingBag className="h-4 w-4 text-accent" />
                      <span>Productos</span>
                      <Badge variant="secondary" className="ml-auto">{results.products.length}</Badge>
                    </div>
                    <div className="space-y-1">
                      {results.products.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                        >
                          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                            {result.image ? (
                              <img src={result.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                            ) : (
                              <ShoppingBag className="h-5 w-5 text-accent" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                          {result.price && (
                            <span className="font-bold text-primary">
                              ${result.price.toLocaleString('es-CO')}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Professionals */}
                {results.professionals.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Stethoscope className="h-4 w-4 text-green-600" />
                      <span>Profesionales de Salud</span>
                      <Badge variant="secondary" className="ml-auto">{results.professionals.length}</Badge>
                    </div>
                    <div className="space-y-1">
                      {results.professionals.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                        >
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            {result.image ? (
                              <img src={result.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <Stethoscope className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* View All */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    navigate(`/explore?search=${encodeURIComponent(query)}`);
                    setIsOpen(false);
                  }}
                >
                  Ver todos los resultados para "{query}"
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
