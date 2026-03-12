import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Navigation,
  CheckCircle2,
  ArrowLeft,
  Map as MapIcon,
  Filter,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  Building2,
  SlidersHorizontal,
  Compass,
  Heart,
} from 'lucide-react';
import { useExplorar, useCategorias, useEscuelasCerca, type School } from '@/hooks/useExplorar';
import { SchoolMap } from '@/components/explore/SchoolMap';
import { CompareSchools } from '@/components/explore/CompareSchools';
import { SchoolReviews } from '@/components/explore/SchoolReviews';
import { useToast } from '@/hooks/use-toast';

// ─── School Card ──────────────────────────────────────────────────────────────

function SchoolCard({ school, onClick }: { school: School; onClick: () => void }) {
  return (
    <Card
      className="group overflow-hidden hover:shadow-2xl transition-all duration-500 cursor-pointer border border-border/50 hover:border-primary/40 bg-card/80 backdrop-blur-sm"
      onClick={onClick}
    >
      {/* Cover */}
      <div className="relative h-48 bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 overflow-hidden">
        {school.cover_image_url ? (
          <img
            src={school.cover_image_url}
            alt={school.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
            <Trophy className="h-14 w-14 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Verified badge */}
        {school.verified && (
          <Badge className="absolute top-3 right-3 bg-white/95 text-primary border-0 shadow-lg text-xs font-semibold px-2.5 py-1">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verificada
          </Badge>
        )}

        {/* Logo */}
        {school.logo_url && (
          <div className="absolute bottom-3 left-3">
            <img
              src={school.logo_url}
              alt=""
              className="w-10 h-10 rounded-lg border-2 border-white shadow-lg object-cover bg-white"
            />
          </div>
        )}

        {/* Price chip */}
        {school.min_price && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1.5 rounded-lg">
            Desde ${school.min_price.toLocaleString('es-CO')}
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Name & city */}
        <div>
          <h3 className="font-bold text-base line-clamp-1 group-hover:text-primary transition-colors">
            {school.name}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <MapPin className="h-3 w-3" />
            <span className="line-clamp-1">{school.city || 'Colombia'}</span>
          </div>
        </div>

        {/* Rating + reviews */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
              {(school.avg_rating || 0).toFixed(1)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {school.review_count || 0} reseñas
          </span>
          {school.program_count > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {school.program_count} programas
              </span>
            </>
          )}
        </div>

        {/* Sports tags */}
        {school.sports && school.sports.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {school.sports.slice(0, 3).map((sport) => (
              <Badge key={sport} variant="secondary" className="text-[10px] font-medium px-2 py-0.5">
                {sport}
              </Badge>
            ))}
            {school.sports.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                +{school.sports.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* CTA */}
        <Button className="w-full h-9 text-xs font-semibold shadow-sm group-hover:shadow-md transition-shadow" size="sm">
          Ver programas
          <Sparkles className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SchoolCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 w-full rounded-none" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function PaginationControls({
  page,
  pages,
  total,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  if (pages <= 1) return null;

  const visiblePages = useMemo(() => {
    const arr: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, page + 2);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, pages]);

  return (
    <div className="flex items-center justify-center gap-2 pt-6">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="h-9"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {visiblePages[0] > 1 && (
        <>
          <Button variant="ghost" size="sm" className="h-9 w-9" onClick={() => onPageChange(1)}>1</Button>
          {visiblePages[0] > 2 && <span className="text-muted-foreground text-sm">…</span>}
        </>
      )}

      {visiblePages.map((p) => (
        <Button
          key={p}
          variant={p === page ? 'default' : 'ghost'}
          size="sm"
          className="h-9 w-9"
          onClick={() => onPageChange(p)}
        >
          {p}
        </Button>
      ))}

      {visiblePages[visiblePages.length - 1] < pages && (
        <>
          {visiblePages[visiblePages.length - 1] < pages - 1 && <span className="text-muted-foreground text-sm">…</span>}
          <Button variant="ghost" size="sm" className="h-9 w-9" onClick={() => onPageChange(pages)}>{pages}</Button>
        </>
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        className="h-9"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <span className="text-xs text-muted-foreground ml-3">
        {total} resultados
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Hooks
  const {
    schools,
    pagination,
    filters,
    loading,
    error,
    updateFilter,
    clearFilters,
    goToPage,
  } = useExplorar();

  const { categorias } = useCategorias();

  // Local UI state
  const [showMap, setShowMap] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | undefined>();
  const [localSearch, setLocalSearch] = useState('');

  // Sync URL params on mount
  useEffect(() => {
    const q = searchParams.get('search');
    const city = searchParams.get('city');
    const sport = searchParams.get('sport');
    if (q) { setLocalSearch(q); updateFilter('query', q); }
    if (city) updateFilter('city', city);
    if (sport) updateFilter('sport', sport);
  }, []); // eslint-disable-line

  // Popular sports for quick filters
  const quickSports = ['Fútbol', 'Natación', 'Tenis', 'Cheerleading', 'Baloncesto', 'Karate', 'Gimnasia'];

  const handleNearMe = () => {
    if (!nearMe) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLocation(loc);
            setNearMe(true);
            updateFilter('lat', loc.lat);
            updateFilter('lng', loc.lng);
            updateFilter('distance_km', 10);
            updateFilter('order_by', 'distance');
            toast({ title: '📍 Ubicación obtenida', description: 'Mostrando escuelas cerca de ti' });
          },
          () => {
            toast({ title: 'Error de ubicación', description: 'Habilita permisos de ubicación', variant: 'destructive' });
          }
        );
      }
    } else {
      setNearMe(false);
      setUserLocation(null);
      updateFilter('lat', undefined);
      updateFilter('lng', undefined);
      updateFilter('distance_km', undefined);
      updateFilter('order_by', 'rating');
    }
  };

  const hasActiveFilters = !!(
    filters.query || filters.city || filters.sport || filters.price_max ||
    filters.rating_min || filters.age || filters.verified || nearMe
  );

  // Map-compatible schools (need lat/lng fields mapped)
  const mapSchools = useMemo(() =>
    schools.map(s => ({
      ...s,
      latitude: s.main_lat,
      longitude: s.main_lng,
      address: s.city || '',
      rating: s.avg_rating || 0,
      total_reviews: s.review_count || 0,
    })),
    [schools]
  );

  // ── Age groups ──────────────────────────────────────────────────────────────
  const ageGroups = [
    { label: 'Todos', sublabel: 'Todas las edades', icon: '🏅', value: undefined },
    { label: 'Primera infancia', sublabel: '0-5 años', icon: '👶', value: 3 },
    { label: 'Niños', sublabel: '6-11 años', icon: '🧒', value: 8 },
    { label: 'Adolescentes', sublabel: '12-17 años', icon: '🧑', value: 14 },
    { label: 'Jóvenes', sublabel: '18-26 años', icon: '👱', value: 22 },
    { label: 'Adultos', sublabel: '27+ años', icon: '🧔', value: 35 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">

      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      <div className="bg-background/80 backdrop-blur-md border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant={showMap ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowMap(!showMap)}
              className="h-8"
            >
              <MapIcon className="h-3.5 w-3.5 mr-1.5" />
              {showMap ? 'Ocultar mapa' : 'Ver mapa'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-emerald-600" />
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }} />
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-300/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 py-10 md:py-14 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-5">
            <div className="flex items-center justify-center gap-2">
              <Compass className="h-6 w-6 text-white/70 animate-pulse" />
              <Badge variant="secondary" className="bg-white/15 text-white border-white/20 hover:bg-white/25 text-xs backdrop-blur-sm">
                {pagination ? `${pagination.total} escuelas` : 'Explora'}
              </Badge>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Encuentra tu Escuela
              <span className="block bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
                Deportiva Ideal
              </span>
            </h1>

            <p className="text-white/70 text-sm md:text-base max-w-lg mx-auto">
              Busca por deporte, ciudad, precio o ubicación. Compara programas e inscríbete al instante.
            </p>

            {/* ── Search bar ─────────────────────────────────────────────── */}
            <div className="relative max-w-2xl mx-auto">
              <div className="absolute inset-0 bg-white/10 rounded-2xl blur-xl" />
              <div className="relative flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
                  <Input
                    placeholder="Busca fútbol, natación, cheerleading..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') updateFilter('query', localSearch);
                    }}
                    className="pl-11 pr-4 h-12 text-sm bg-white rounded-xl border-0 shadow-2xl focus:ring-4 focus:ring-white/30"
                  />
                </div>
                <Button
                  onClick={() => updateFilter('query', localSearch)}
                  className="h-12 px-6 rounded-xl shadow-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                >
                  Buscar
                </Button>
              </div>
            </div>

            {/* Quick sport pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {quickSports.map((sport) => (
                <Badge
                  key={sport}
                  variant="outline"
                  className={`border-white/25 text-white hover:bg-white/20 cursor-pointer text-xs transition-all ${
                    filters.sport === sport ? 'bg-white/25 border-white/50' : ''
                  }`}
                  onClick={() => updateFilter('sport', filters.sport === sport ? undefined : sport)}
                >
                  {sport}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Map (toggle) ──────────────────────────────────────────────────── */}
      {showMap && (
        <div className="container mx-auto px-4 py-6 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Mapa</h2>
              <Badge variant="secondary" className="text-xs">{schools.length} visibles</Badge>
            </div>
            <Button
              variant={nearMe ? 'default' : 'outline'}
              size="sm"
              onClick={handleNearMe}
              className="h-8"
            >
              <Navigation className="h-3.5 w-3.5 mr-1.5" />
              {nearMe ? 'Ubicación activa' : 'Cerca de mí'}
            </Button>
          </div>
          <SchoolMap
            schools={mapSchools}
            userLocation={userLocation}
            selectedSchoolId={selectedSchoolId}
            onSchoolSelect={setSelectedSchoolId}
          />
        </div>
      )}

      {/* ── Age group selector ─────────────────────────────────────────── */}
      <div className="bg-muted/30 py-8 border-y">
        <div className="container mx-auto px-4">
          <h2 className="text-lg font-bold text-center mb-5 flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Explora por edad
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {ageGroups.map((g) => (
              <button
                key={g.label}
                onClick={() => updateFilter('age', filters.age === g.value ? undefined : g.value)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl bg-background hover:bg-accent transition-all group border ${
                  filters.age === g.value
                    ? 'ring-2 ring-primary border-primary/50 bg-primary/5'
                    : 'border-transparent'
                }`}
              >
                <div className="text-3xl md:text-4xl group-hover:scale-110 transition-transform">{g.icon}</div>
                <div className="text-center">
                  <p className="font-semibold text-xs">{g.label}</p>
                  <p className="text-[10px] text-muted-foreground">{g.sublabel}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* Filters bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-9"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Filtros
          </Button>

          {!showMap && (
            <Button
              variant={nearMe ? 'default' : 'outline'}
              size="sm"
              onClick={handleNearMe}
              className="h-9"
            >
              <Navigation className="h-3.5 w-3.5 mr-1.5" />
              Cerca de mí
            </Button>
          )}

          <Select
            value={filters.order_by || 'rating'}
            onValueChange={(v) => updateFilter('order_by', v)}
          >
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">⭐ Mejor valoradas</SelectItem>
              <SelectItem value="price">💰 Menor precio</SelectItem>
              <SelectItem value="name">🔤 Nombre</SelectItem>
              {nearMe && <SelectItem value="distance">📍 Más cerca</SelectItem>}
            </SelectContent>
          </Select>

          {/* Active filter badges */}
          {hasActiveFilters && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {filters.query && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  "{filters.query}"
                  <X className="h-3 w-3 cursor-pointer" onClick={() => { updateFilter('query', undefined); setLocalSearch(''); }} />
                </Badge>
              )}
              {filters.sport && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {filters.sport}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('sport', undefined)} />
                </Badge>
              )}
              {filters.city && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {filters.city}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('city', undefined)} />
                </Badge>
              )}
              {filters.age && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  Edad: {filters.age}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('age', undefined)} />
                </Badge>
              )}
              {filters.verified && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  Verificadas
                  <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('verified', undefined)} />
                </Badge>
              )}
              {nearMe && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  📍 Cerca de mí
                  <X className="h-3 w-3 cursor-pointer" onClick={handleNearMe} />
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => { clearFilters(); setLocalSearch(''); setNearMe(false); setUserLocation(null); }}
              >
                Limpiar todo
              </Button>
            </div>
          )}
        </div>

        {/* Expandable filters panel */}
        {showFilters && (
          <Card className="shadow-lg border-primary/10 animate-in slide-in-from-top-2 duration-200">
            <CardContent className="p-5">
              <div className="grid gap-4 md:grid-cols-4">
                {/* City */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Ciudad</label>
                  <Input
                    placeholder="Ej: Bogotá"
                    value={filters.city || ''}
                    onChange={(e) => updateFilter('city', e.target.value || undefined)}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Sport */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Deporte</label>
                  <Input
                    placeholder="Ej: Fútbol"
                    value={filters.sport || ''}
                    onChange={(e) => updateFilter('sport', e.target.value || undefined)}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Precio máximo: ${(filters.price_max || 500000).toLocaleString('es-CO')}
                  </label>
                  <Slider
                    min={0}
                    max={500000}
                    step={10000}
                    value={[filters.price_max || 500000]}
                    onValueChange={([v]) => updateFilter('price_max', v < 500000 ? v : undefined)}
                  />
                </div>

                {/* Rating */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Rating mínimo</label>
                  <Select
                    value={filters.rating_min ? String(filters.rating_min) : 'all'}
                    onValueChange={(v) => updateFilter('rating_min', v === 'all' ? undefined : Number(v))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Cualquiera</SelectItem>
                      <SelectItem value="3">⭐ 3.0+</SelectItem>
                      <SelectItem value="4">⭐ 4.0+</SelectItem>
                      <SelectItem value="4.5">⭐ 4.5+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Toggle: verified */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <Button
                  variant={filters.verified ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => updateFilter('verified', filters.verified ? undefined : true)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Solo verificadas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">
              {loading ? 'Buscando...' : `${pagination?.total ?? schools.length} Escuelas`}
            </h2>
          </div>
          <CompareSchools schools={mapSchools} />
        </div>

        {/* ── Grid ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SchoolCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <Card className="p-12 text-center">
            <div className="space-y-3">
              <div className="h-14 w-14 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="h-7 w-7 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg">Error de conexión</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">{error}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reintentar
              </Button>
            </div>
          </Card>
        ) : schools.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="space-y-3">
              <div className="h-14 w-14 mx-auto rounded-full bg-muted flex items-center justify-center">
                <Trophy className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">No se encontraron escuelas</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Intenta ajustar tus filtros o busca con otros términos
              </p>
              <Button
                variant="outline"
                onClick={() => { clearFilters(); setLocalSearch(''); }}
              >
                Limpiar filtros
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {schools.map((school) => (
                <SchoolCard
                  key={school.id}
                  school={school}
                  onClick={() => navigate(`/schools/${school.id}`)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination && (
              <PaginationControls
                page={pagination.page}
                pages={pagination.pages}
                total={pagination.total}
                onPageChange={goToPage}
              />
            )}
          </>
        )}
      </div>

      {/* ── Footer CTA ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-secondary/5 py-10 border-t">
        <div className="container mx-auto px-4 text-center space-y-4">
          <h3 className="text-xl font-bold">¿Tienes una escuela deportiva?</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Registra tu academia en SportMaps y conecta con miles de familias buscando deportes para sus hijos.
          </p>
          <Button onClick={() => navigate('/register')} size="lg" className="shadow-lg">
            Registrar mi escuela
            <Sparkles className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
