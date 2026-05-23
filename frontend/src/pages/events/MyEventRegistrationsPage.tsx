import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Ticket,
  Eye,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  Trophy,
} from 'lucide-react';

interface MyRegistration {
  id: string;
  event_id: string;
  participant_name: string;
  participant_role: string;
  participant_age?: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payment_status: string;
  package_choice?: string;
  category_id?: string;
  child_id?: string;
  created_at: string;
  events: {
    id: string;
    title: string;
    sport: string;
    event_date: string;
    city: string;
    slug: string;
    status: string;
    image_url?: string;
    start_time?: string;
  };
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any }> = {
  pending: { variant: 'outline', label: 'Pendiente', icon: Clock },
  approved: { variant: 'default', label: 'Aprobada', icon: CheckCircle2 },
  rejected: { variant: 'destructive', label: 'Rechazada', icon: XCircle },
  cancelled: { variant: 'secondary', label: 'Cancelada', icon: XCircle },
};

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pago pendiente', color: 'text-yellow-600' },
  verified: { label: 'Pago verificado', color: 'text-green-600' },
  rejected: { label: 'Pago rechazado', color: 'text-red-600' },
  not_required: { label: 'Sin pago requerido', color: 'text-muted-foreground' },
};

const PKG_LABELS: Record<string, string> = {
  pkg_solo: 'Solo Competencia',
  pkg_3: '2 Noches Hotel',
  pkg_2: '3 Noches Hotel',
  pkg_1: '4 Noches Hotel',
};

export default function MyEventRegistrationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<MyRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    setLoading(true);
    try {
      const data = await bffClient.get<MyRegistration[] | null>('/api/v1/events/my-registrations/list');
      setRegistrations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  const pendingCount = registrations.filter(r => r.status === 'pending').length;
  const approvedCount = registrations.filter(r => r.status === 'approved').length;

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Mis Inscripciones a Eventos</h1>
            <p className="text-muted-foreground">Historial de inscripciones individuales</p>
          </div>
        </div>
        <Button onClick={() => navigate('/events')} className="gap-2">
          <Ticket className="h-4 w-4" />
          Explorar Eventos
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{registrations.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Aprobadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Registrations List */}
      {registrations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No tienes inscripciones aun</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Explora eventos deportivos y registrate individualmente.
            </p>
            <Button onClick={() => navigate('/events')} size="lg" className="gap-2">
              <Ticket className="h-5 w-5" />
              Explorar Eventos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => {
            const ev = reg.events;
            const cfg = STATUS_CONFIG[reg.status] || STATUS_CONFIG.pending;
            const payCfg = PAYMENT_STATUS[reg.payment_status] || PAYMENT_STATUS.not_required;
            const StatusIcon = cfg.icon;
            return (
              <Card key={reg.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {ev?.image_url && (
                      <div className="md:w-44 h-28 md:h-auto overflow-hidden rounded-t-lg md:rounded-l-lg md:rounded-tr-none">
                        <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-3 mb-2">
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
                              {ev?.sport}
                            </span>
                          </div>
                        </div>
                        <Badge variant={cfg.variant} className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm mt-3">
                        <div>
                          <span className="text-muted-foreground">Participante:</span>{' '}
                          <span className="font-medium">{reg.participant_name}</span>
                          {reg.child_id && <Badge variant="outline" className="ml-1 text-xs">Hijo/a</Badge>}
                        </div>
                        {reg.package_choice && (
                          <div>
                            <span className="text-muted-foreground">Paquete:</span>{' '}
                            <span className="font-medium">{PKG_LABELS[reg.package_choice] || reg.package_choice}</span>
                          </div>
                        )}
                        <div className={payCfg.color}>
                          {payCfg.label}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        {ev?.slug && (
                          <Button variant="outline" size="sm" className="gap-1"
                            onClick={() => window.open(`/event/${ev.slug}`, '_blank')}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver Evento
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          Inscrito el {formatDate(reg.created_at)}
                        </span>
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
