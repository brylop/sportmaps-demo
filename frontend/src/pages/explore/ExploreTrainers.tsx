import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Star, DollarSign, Search, Dumbbell, Loader2, ChevronLeft } from 'lucide-react';

interface TrainerCard {
  id: string;
  user_id: string;
  display_name: string | null;
  tagline: string | null;
  avatar_url: string | null;
  primary_sport: string | null;
  city: string | null;
  modality: string;
  rate_per_session: number | null;
  rate_currency: string;
  rating: number;
  review_count: number;
  specialties: string[] | null;
  experience_years: number | null;
}

const MODALITY_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  ambas: 'Presencial y Virtual',
};

const MODALITY_COLORS: Record<string, string> = {
  presencial: 'bg-blue-500/10 text-blue-600 border-blue-200',
  virtual: 'bg-purple-500/10 text-purple-600 border-purple-200',
  ambas: 'bg-green-500/10 text-green-600 border-green-200',
};

export default function ExploreTrainers() {
  const [trainers, setTrainers] = useState<TrainerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [sportFilter, setSportFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');

  useEffect(() => {
    const fetchTrainers = async () => {
      setLoading(true);
      // Usamos (supabase as any) porque la tabla trainer_profiles puede no estar en los tipos generados localmente
      const { data, error } = await (supabase as any)
        .from('trainer_profiles')
        .select(`
          id, user_id, display_name, tagline, avatar_url,
          primary_sport, city, modality, rate_per_session,
          rate_currency, rating, review_count, specialties,
          experience_years
        `)
        .eq('is_published', true)
        .order('rating', { ascending: false });

      if (!error && data) setTrainers(data as TrainerCard[]);
      setLoading(false);
    };
    fetchTrainers();
  }, []);

  // Opciones dinámicas de filtros
  const cities = useMemo(() =>
    [...new Set(trainers.map(t => t.city).filter(Boolean))].sort() as string[],
    [trainers]
  );
  const sports = useMemo(() =>
    [...new Set(trainers.map(t => t.primary_sport).filter(Boolean))].sort() as string[],
    [trainers]
  );

  const filtered = useMemo(() => {
    return trainers.filter(t => {
      const matchSearch = !search ||
        t.display_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.primary_sport?.toLowerCase().includes(search.toLowerCase()) ||
        t.city?.toLowerCase().includes(search.toLowerCase()) ||
        t.specialties?.some(s => s.toLowerCase().includes(search.toLowerCase()));
      const matchCity = cityFilter === 'all' || t.city === cityFilter;
      const matchSport = sportFilter === 'all' || t.primary_sport === sportFilter;
      const matchModality = modalityFilter === 'all' || t.modality === modalityFilter;
      return matchSearch && matchCity && matchSport && matchModality;
    });
  }, [trainers, search, cityFilter, sportFilter, modalityFilter]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors font-medium">
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Entrenadores Personales</h1>
          </div>
          <p className="text-muted-foreground text-lg mb-8">
            Encuentra el entrenador ideal para tus objetivos deportivos.
          </p>

          {/* Search bar */}
          <div className="relative max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10 h-12 text-base rounded-xl border-border/60 bg-background/80 backdrop-blur"
              placeholder="Buscar por nombre, deporte, ciudad o especialidad..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Ciudad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ciudades</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Deporte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los deportes</SelectItem>
              {sports.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={modalityFilter} onValueChange={setModalityFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Modalidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cualquier modalidad</SelectItem>
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="virtual">Virtual</SelectItem>
              <SelectItem value="ambas">Ambas</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset */}
          {(search || cityFilter !== 'all' || sportFilter !== 'all' || modalityFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground font-medium"
              onClick={() => { setSearch(''); setCityFilter('all'); setSportFilter('all'); setModalityFilter('all'); }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Contador */}
        <p className="text-sm text-muted-foreground mb-6 font-medium">
          {loading ? 'Cargando...' : `${filtered.length} entrenador${filtered.length !== 1 ? 'es' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
        </p>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Dumbbell className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <p className="text-lg font-semibold">No se encontraron entrenadores</p>
            <p className="text-muted-foreground text-sm">Intenta con otros filtros o vuelve más tarde.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(trainer => (
              <Link key={trainer.id} to={`/entrenador/${trainer.user_id}`}>
                <Card className="h-full border-border/50 hover:border-primary/40 hover:shadow-lg transition-all duration-200 cursor-pointer group overflow-hidden">
                  <CardContent className="p-0">
                    {/* Card header con gradiente */}
                    <div className="relative h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                      {/* Avatar */}
                      <div className="absolute -bottom-6 left-5">
                        <div className="h-16 w-16 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center text-xl font-bold text-primary overflow-hidden shadow-md">
                          {trainer.avatar_url
                            ? <img src={trainer.avatar_url} alt={trainer.display_name ?? ''} className="h-full w-full object-cover" />
                            : (trainer.display_name ?? 'T').substring(0, 2).toUpperCase()
                          }
                        </div>
                      </div>
                      {/* Modality badge */}
                      <div className="absolute top-3 right-3">
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase ${MODALITY_COLORS[trainer.modality] ?? ''}`}>
                          {MODALITY_LABELS[trainer.modality] ?? trainer.modality}
                        </Badge>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="pt-9 px-5 pb-5 space-y-3">
                      <div>
                        <h3 className="font-bold text-base group-hover:text-primary transition-colors truncate">
                          {trainer.display_name ?? 'Entrenador Personal'}
                        </h3>
                        {trainer.tagline && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{trainer.tagline}</p>
                        )}
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap gap-2">
                        {trainer.primary_sport && (
                          <Badge variant="secondary" className="text-[10px] font-bold uppercase gap-1">
                            <Dumbbell className="h-3 w-3" />
                            {trainer.primary_sport}
                          </Badge>
                        )}
                        {trainer.city && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                            <MapPin className="h-3 w-3" />
                            {trainer.city}
                          </span>
                        )}
                        {trainer.experience_years && (
                          <span className="text-xs text-muted-foreground font-medium">
                            {trainer.experience_years} años exp.
                          </span>
                        )}
                      </div>

                      {/* Especialidades */}
                      {trainer.specialties && trainer.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {trainer.specialties.slice(0, 3).map(s => (
                            <Badge key={s} variant="outline" className="text-[10px] py-0 h-5 font-medium">{s}</Badge>
                          ))}
                          {trainer.specialties.length > 3 && (
                            <Badge variant="outline" className="text-[10px] py-0 h-5 font-medium">+{trainer.specialties.length - 3}</Badge>
                          )}
                        </div>
                      )}

                      {/* Footer: tarifa + rating */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        {trainer.rate_per_session ? (
                          <span className="flex items-center gap-1 font-bold text-primary text-sm">
                            <DollarSign className="h-3.5 w-3.5" />
                            {trainer.rate_per_session.toLocaleString('es-CO')}
                            <span className="font-normal text-muted-foreground text-xs">{trainer.rate_currency}/sesión</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic font-medium">Tarifa a consultar</span>
                        )}
                        {trainer.review_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                            <Star className="h-3.5 w-3.5 fill-amber-500" />
                            {trainer.rating.toFixed(1)}
                            <span className="text-muted-foreground font-normal">({trainer.review_count})</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
