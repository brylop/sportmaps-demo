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
  DollarSign,
  TrendingUp,
  Clock,
  Calendar,
  ExternalLink,
} from 'lucide-react';

interface FinanceEvent {
  id: string;
  title: string;
  event_date: string;
  status: string;
  city: string;
  sport: string;
  total_expected: number;
  total_paid: number;
  pending_delegations: number;
  delegation_count: number;
}

interface FinanceSummary {
  total_expected: number;
  total_paid: number;
  total_pending: number;
  total_events: number;
}

export default function OrganizerFinancesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [events, setEvents] = useState<FinanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinances();
  }, []);

  const loadFinances = async () => {
    setLoading(true);
    try {
      const data = await bffClient.get<{ summary: FinanceSummary; events: FinanceEvent[] }>('/api/v1/organizer/finances');
      setSummary(data.summary);
      setEvents(data.events);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizer/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Finanzas</h1>
          <p className="text-muted-foreground">Resumen de ingresos de tus eventos</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <DollarSign className="h-4 w-4" />
              Ingresos Esperados
            </div>
            <p className="text-2xl font-bold">{formatPrice(summary?.total_expected || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Total Recaudado
            </div>
            <p className="text-2xl font-bold text-green-600">{formatPrice(summary?.total_paid || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              Pendiente por Cobrar
            </div>
            <p className="text-2xl font-bold text-yellow-600">{formatPrice(summary?.total_pending || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <Calendar className="h-4 w-4" />
              Eventos con Delegaciones
            </div>
            <p className="text-2xl font-bold">{events.filter(e => e.delegation_count > 0).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Events Financial Table */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose por Evento</CardTitle>
          <CardDescription>Ingresos y pagos pendientes por cada evento</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay datos financieros disponibles</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Delegaciones</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Recaudado</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => {
                    const pending = event.total_expected - event.total_paid;
                    return (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{event.sport} &bull; {event.city}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(event.event_date)}</TableCell>
                        <TableCell>
                          <Badge variant={event.status === 'published' ? 'default' : 'secondary'}>
                            {event.status === 'draft' ? 'Borrador' :
                             event.status === 'published' ? 'Publicado' :
                             event.status === 'closed' ? 'Cerrado' :
                             event.status === 'completed' ? 'Completado' : event.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {event.delegation_count}
                          {event.pending_delegations > 0 && (
                            <span className="text-yellow-600 text-xs ml-1">({event.pending_delegations} pend.)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatPrice(event.total_expected)}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">{formatPrice(event.total_paid)}</TableCell>
                        <TableCell className="text-right font-medium text-yellow-600">
                          {pending > 0 ? formatPrice(pending) : '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/organizer/event/${event.id}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
