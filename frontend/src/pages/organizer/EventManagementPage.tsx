import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEvents, useEventRegistrations } from '@/hooks/useEvents';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Users,
  DollarSign,
  Eye,
  Copy,
  Check,
  X,
  ExternalLink,
  Phone,
  Mail,
  AlertCircle
} from 'lucide-react';
import type { Event, EventRegistration } from '@/types/events';

export default function EventManagementPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getEventWithStats, updateEvent, closeRegistrations, logTelemetry } = useEvents();
  const { getRegistrations, approveRegistration, rejectRegistration } = useEventRegistrations(id);

  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<EventRegistration | null>(null);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [eventData, registrationsData] = await Promise.all([
      getEventWithStats(id!),
      getRegistrations()
    ]);
    setEvent(eventData);
    setRegistrations(registrationsData);
    setLoading(false);
  };

  const handleCopyLink = async () => {
    if (!event) return;
    const url = `${window.location.origin}/event/${event.slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    await logTelemetry('link_shared', event.id, { method: 'copy' });
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Enlace copiado', description: 'Comparte el enlace con tus participantes' });
  };

  const handleToggleRegistrations = async () => {
    if (!event) return;
    const newValue = !event.registrations_open;
    const success = await updateEvent(event.id, { registrations_open: newValue });
    if (success) {
      setEvent({ ...event, registrations_open: newValue });
    }
  };

  const handleApprove = async (registration: EventRegistration) => {
    const success = await approveRegistration(registration.id);
    if (success) {
      setRegistrations(prev => 
        prev.map(r => r.id === registration.id ? { ...r, status: 'approved' } : r)
      );
      loadData(); // Refresh stats
    }
  };

  const handleReject = async () => {
    if (!selectedRegistration) return;
    const success = await rejectRegistration(selectedRegistration.id, 'Rechazado por el organizador');
    if (success) {
      setRegistrations(prev => 
        prev.map(r => r.id === selectedRegistration.id ? { ...r, status: 'rejected' } : r)
      );
      setRejectDialogOpen(false);
      setSelectedRegistration(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Gratis';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getStatusBadge = (status: EventRegistration['status']) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'outline', label: 'Pendiente' },
      approved: { variant: 'default', label: 'Aprobado' },
      rejected: { variant: 'destructive', label: 'Rechazado' },
      cancelled: { variant: 'secondary', label: 'Cancelado' }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Evento no encontrado</h2>
        <Button onClick={() => navigate('/organizer/home')}>Volver al dashboard</Button>
      </div>
    );
  }

  const pendingCount = registrations.filter(r => r.status === 'pending').length;
  const approvedCount = registrations.filter(r => r.status === 'approved').length;

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizer/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="text-muted-foreground">{event.sport} • {event.city}</p>
        </div>
        <Button variant="outline" onClick={() => window.open(`/event/${event.slug}`, '_blank')} className="gap-2">
          <Eye className="h-4 w-4" />
          Ver público
        </Button>
      </div>

      {/* Event Info Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{formatDate(event.event_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{event.start_time.slice(0, 5)}{event.end_time ? ` - ${event.end_time.slice(0, 5)}` : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm truncate">{event.address || event.city}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{formatPrice(event.price)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{approvedCount}</p>
                <p className="text-xs text-muted-foreground">Aprobados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{event.capacity - approvedCount}</p>
                <p className="text-xs text-muted-foreground">Cupos disponibles</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">Inscripciones:</span>
                <Switch
                  checked={event.registrations_open}
                  onCheckedChange={handleToggleRegistrations}
                />
                <span className="text-sm font-medium">
                  {event.registrations_open ? 'Abiertas' : 'Cerradas'}
                </span>
              </div>
              <Button onClick={handleCopyLink} variant="outline" size="sm" className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar enlace'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registrations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Inscripciones ({registrations.length})
          </CardTitle>
          <CardDescription>
            Gestiona las inscripciones de tu evento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Aún no hay inscripciones</h3>
              <p className="text-muted-foreground mb-4">
                Comparte el enlace de tu evento para recibir inscripciones
              </p>
              <Button onClick={handleCopyLink} className="gap-2">
                <Copy className="h-4 w-4" />
                Copiar enlace del evento
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((registration) => (
                    <TableRow key={registration.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{registration.participant_name}</p>
                          {registration.participant_age && (
                            <p className="text-xs text-muted-foreground">{registration.participant_age} años</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <a href={`tel:${registration.participant_phone}`} className="flex items-center gap-1 text-sm hover:underline">
                            <Phone className="h-3 w-3" />
                            {registration.participant_phone}
                          </a>
                          {registration.participant_email && (
                            <a href={`mailto:${registration.participant_email}`} className="flex items-center gap-1 text-sm hover:underline">
                              <Mail className="h-3 w-3" />
                              {registration.participant_email}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {registration.participant_role === 'athlete' ? 'Atleta' :
                         registration.participant_role === 'parent' ? 'Padre' :
                         registration.participant_role === 'coach' ? 'Entrenador' : 'Otro'}
                      </TableCell>
                      <TableCell>{getStatusBadge(registration.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(registration.created_at).toLocaleDateString('es-CO')}
                      </TableCell>
                      <TableCell className="text-right">
                        {registration.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-green-600 hover:text-green-700"
                              onClick={() => handleApprove(registration)}
                            >
                              <Check className="h-4 w-4" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-red-600 hover:text-red-700"
                              onClick={() => {
                                setSelectedRegistration(registration);
                                setRejectDialogOpen(true);
                              }}
                            >
                              <X className="h-4 w-4" />
                              Rechazar
                            </Button>
                          </div>
                        )}
                        {registration.payment_proof_url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(registration.payment_proof_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Rechazar inscripción?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de rechazar la inscripción de {selectedRegistration?.participant_name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
