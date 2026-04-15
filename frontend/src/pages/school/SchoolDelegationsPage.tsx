import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Map,
  Calendar,
  Users,
  Trophy,
  DollarSign,
  ExternalLink,
  Eye,
  Ticket,
  MapPin,
} from 'lucide-react';

interface Delegation {
  id: string;
  event_id: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  team_count: number;
  athlete_count: number;
  event: {
    id: string;
    title: string;
    sport: string;
    event_date: string;
    city: string;
    slug: string;
    status: string;
    image_url?: string;
  } | null;
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  draft: { variant: 'outline', label: 'Borrador' },
  pending_payment: { variant: 'outline', label: 'Pendiente Pago' },
  approved: { variant: 'default', label: 'Aprobada' },
  rejected: { variant: 'destructive', label: 'Rechazada' },
  cancelled: { variant: 'secondary', label: 'Cancelada' },
};

export default function SchoolDelegationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDelegations();
  }, []);

  const loadDelegations = async () => {
    setLoading(true);
    try {
      const data = await bffClient.get<Delegation[]>('/api/v1/school/delegations');
      setDelegations(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const totalTeams = delegations.reduce((s, d) => s + d.team_count, 0);
  const totalAthletes = delegations.reduce((s, d) => s + d.athlete_count, 0);
  const totalPaid = delegations.reduce((s, d) => s + Number(d.paid_amount || 0), 0);
  const pendingCount = delegations.filter(d => d.status === 'draft' || d.status === 'pending_payment').length;

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Mis Delegaciones</h1>
            <p className="text-muted-foreground">Inscripciones de tu academia a eventos deportivos</p>
          </div>
        </div>
        <Button onClick={() => navigate('/events')} className="gap-2">
          <Ticket className="h-4 w-4" />
          Explorar Eventos
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Map className="h-4 w-4" />
              Eventos
            </div>
            <p className="text-2xl font-bold">{delegations.length}</p>
            {pendingCount > 0 && (
              <p className="text-xs text-yellow-600">{pendingCount} pendiente(s)</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Trophy className="h-4 w-4" />
              Equipos
            </div>
            <p className="text-2xl font-bold">{totalTeams}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              Atletas
            </div>
            <p className="text-2xl font-bold">{totalAthletes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Total Pagado
            </div>
            <p className="text-2xl font-bold text-green-600">{formatPrice(totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Delegations List */}
      {delegations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Map className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No tienes delegaciones aún</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Explora eventos deportivos disponibles e inscribe a tu academia con sus equipos y atletas.
            </p>
            <Button onClick={() => navigate('/events')} size="lg" className="gap-2">
              <Ticket className="h-5 w-5" />
              Explorar Eventos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {delegations.map((del) => {
            const cfg = STATUS_CONFIG[del.status] || STATUS_CONFIG.draft;
            const ev = del.event;
            const balance = Number(del.total_amount || 0) - Number(del.paid_amount || 0);
            return (
              <Card
                key={del.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/school/delegations/${del.id}`)}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Event image */}
                    {ev?.image_url && (
                      <div className="md:w-48 h-32 md:h-auto overflow-hidden rounded-t-lg md:rounded-l-lg md:rounded-tr-none">
                        <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{ev?.title || 'Evento'}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {ev?.event_date ? formatDate(ev.event_date) : '—'}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {ev?.city || '—'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Ticket className="h-3.5 w-3.5" />
                              {ev?.sport || '—'}
                            </span>
                          </div>
                        </div>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Equipos:</span>{' '}
                          <span className="font-medium">{del.team_count}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Atletas:</span>{' '}
                          <span className="font-medium">{del.athlete_count}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>{' '}
                          <span className="font-medium">{formatPrice(del.total_amount)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pagado:</span>{' '}
                          <span className="font-medium text-green-600">{formatPrice(del.paid_amount)}</span>
                        </div>
                        {balance > 0 && (
                          <div>
                            <span className="text-muted-foreground">Saldo:</span>{' '}
                            <span className="font-medium text-yellow-600">{formatPrice(balance)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <Button variant="default" size="sm" className="gap-1"
                          onClick={(e) => { e.stopPropagation(); navigate(`/school/delegations/${del.id}`); }}>
                          <Eye className="h-3.5 w-3.5" />
                          Ver Detalle
                        </Button>
                        {ev?.slug && (
                          <Button variant="outline" size="sm" className="gap-1"
                            onClick={(e) => { e.stopPropagation(); window.open(`/event/${ev.slug}`, '_blank'); }}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver Evento
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
