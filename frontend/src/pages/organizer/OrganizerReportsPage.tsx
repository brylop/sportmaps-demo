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
  BarChart3,
  Calendar,
  Users,
  DollarSign,
  Download,
  TrendingUp,
  Ticket,
} from 'lucide-react';

interface EventReport {
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

export default function OrganizerReportsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<EventReport[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await bffClient.get<{ summary: any; events: EventReport[] }>('/api/v1/organizer/finances');
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

  const exportCSV = () => {
    if (events.length === 0) return;

    const headers = ['Evento', 'Fecha', 'Ciudad', 'Deporte', 'Estado', 'Delegaciones', 'Esperado', 'Recaudado', 'Pendiente'];
    const rows = events.map(e => [
      `"${e.title}"`,
      e.event_date,
      e.city,
      e.sport,
      e.status,
      e.delegation_count,
      e.total_expected,
      e.total_paid,
      e.total_expected - e.total_paid,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-eventos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: 'El archivo se descargó exitosamente' });
  };

  // Computed metrics
  const totalDelegations = events.reduce((s, e) => s + e.delegation_count, 0);
  const activeEvents = events.filter(e => e.status === 'published').length;
  const completedEvents = events.filter(e => e.status === 'completed' || e.status === 'closed').length;
  const avgRevenuePerEvent = events.length > 0
    ? (summary?.total_paid || 0) / events.length
    : 0;

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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/organizer/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Reportes</h1>
            <p className="text-muted-foreground">Analytics y métricas de tus eventos</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2" disabled={events.length === 0}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Ticket className="h-4 w-4" />
              Total Eventos
            </div>
            <p className="text-2xl font-bold">{events.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeEvents} activos, {completedEvents} finalizados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              Total Delegaciones
            </div>
            <p className="text-2xl font-bold">{totalDelegations}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Promedio {events.length > 0 ? (totalDelegations / events.length).toFixed(1) : 0} por evento
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              Ingresos Totales
            </div>
            <p className="text-2xl font-bold text-green-600">{formatPrice(summary?.total_paid || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              de {formatPrice(summary?.total_expected || 0)} esperados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              Promedio por Evento
            </div>
            <p className="text-2xl font-bold">{formatPrice(avgRevenuePerEvent)}</p>
            <p className="text-xs text-muted-foreground mt-1">en recaudación</p>
          </CardContent>
        </Card>
      </div>

      {/* Events Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Detalle por Evento
          </CardTitle>
          <CardDescription>
            Métricas individuales de cada evento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aún no tienes eventos con datos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Deporte</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Delegaciones</TableHead>
                    <TableHead className="text-right">Recaudado</TableHead>
                    <TableHead className="text-right">% Cobrado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => {
                    const pctCollected = event.total_expected > 0
                      ? Math.round((event.total_paid / event.total_expected) * 100)
                      : 0;
                    return (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => navigate(`/organizer/event/${event.id}`)}
                      >
                        <TableCell>
                          <p className="font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{event.city}</p>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(event.event_date)}</TableCell>
                        <TableCell className="text-sm">{event.sport}</TableCell>
                        <TableCell>
                          <Badge variant={event.status === 'published' ? 'default' : 'secondary'}>
                            {event.status === 'draft' ? 'Borrador' :
                             event.status === 'published' ? 'Publicado' :
                             event.status === 'closed' ? 'Cerrado' :
                             event.status === 'completed' ? 'Completado' : event.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{event.delegation_count}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatPrice(event.total_paid)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${Math.min(pctCollected, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm">{pctCollected}%</span>
                          </div>
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
