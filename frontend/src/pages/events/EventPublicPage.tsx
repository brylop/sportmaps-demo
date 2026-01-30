import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEvents, useEventRegistrations } from '@/hooks/useEvents';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  DollarSign,
  Phone,
  Mail,
  ArrowLeft,
  Share2,
  CheckCircle2,
  Loader2,
  Trophy,
  AlertCircle
} from 'lucide-react';
import type { Event } from '@/types/events';
import { EVENT_TYPE_OPTIONS } from '@/types/events';

export default function EventPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getEventBySlug, logTelemetry, loading: eventLoading } = useEvents();
  const { createRegistration, loading: registrationLoading } = useEventRegistrations();

  const [event, setEvent] = useState<Event | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    participant_name: '',
    participant_email: '',
    participant_phone: '',
    participant_role: 'athlete' as const,
    participant_age: '',
    notes: ''
  });

  useEffect(() => {
    if (slug) loadEvent();
  }, [slug]);

  const loadEvent = async () => {
    const data = await getEventBySlug(slug!);
    setEvent(data);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: event?.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Enlace copiado' });
    }
    if (event) await logTelemetry('link_shared', event.id, { method: 'share' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    const success = await createRegistration(event.id, {
      ...formData,
      participant_age: formData.participant_age ? parseInt(formData.participant_age) : undefined
    });

    if (success) {
      setSubmitted(true);
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

  const getEventTypeLabel = (type: string) => {
    return EVENT_TYPE_OPTIONS.find(t => t.value === type)?.label || type;
  };

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
        <div className="container max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Evento no encontrado</h2>
            <p className="text-muted-foreground mb-4">
              Este evento no existe o ya no está disponible
            </p>
            <Button onClick={() => navigate('/events')} className="gap-2">
              <MapPin className="h-4 w-4" />
              Explorar eventos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOpen = event.status === 'active' && event.registrations_open;
  const availableSpots = event.capacity - (event.approved_count || 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Image */}
      <div className="relative h-48 md:h-64 bg-gradient-to-br from-orange-500 to-amber-500">
        {event.image_url && (
          <img src={event.image_url} alt={event.title} className="absolute inset-0 w-full h-full object-cover opacity-50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-4 left-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </div>
        <div className="absolute top-4 right-4">
          <Button variant="secondary" size="sm" onClick={handleShare} className="gap-2">
            <Share2 className="h-4 w-4" />
            Compartir
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-3xl mx-auto px-4 -mt-16 relative z-10 pb-12">
        <Card className="mb-6">
          <CardContent className="pt-6">
            {/* Title & Badges */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="secondary">{event.sport}</Badge>
                  <Badge variant="outline">{getEventTypeLabel(event.event_type)}</Badge>
                  {!isOpen && <Badge variant="destructive">Inscripciones cerradas</Badge>}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold">{event.title}</h1>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">{formatPrice(event.price)}</p>
                {event.price > 0 && <p className="text-sm text-muted-foreground">por persona</p>}
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">{formatDate(event.event_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">
                    {event.start_time.slice(0, 5)}
                    {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">{event.city}</p>
                  <p className="text-xs text-muted-foreground truncate">{event.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">
                    {availableSpots > 0 ? `${availableSpots} cupos` : 'Agotado'}
                  </p>
                  <p className="text-xs text-muted-foreground">de {event.capacity}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="py-4">
                <h3 className="font-semibold mb-2">Descripción</h3>
                <p className="text-muted-foreground whitespace-pre-line">{event.description}</p>
              </div>
            )}

            {/* Notes */}
            {event.notes && (
              <div className="py-4 border-t">
                <h3 className="font-semibold mb-2">Información adicional</h3>
                <p className="text-muted-foreground whitespace-pre-line">{event.notes}</p>
              </div>
            )}

            {/* Contact */}
            {(event.contact_phone || event.contact_email) && (
              <div className="py-4 border-t">
                <h3 className="font-semibold mb-2">Contacto</h3>
                <div className="flex flex-wrap gap-4">
                  {event.contact_phone && (
                    <a href={`tel:${event.contact_phone}`} className="flex items-center gap-2 text-sm hover:underline">
                      <Phone className="h-4 w-4" />
                      {event.contact_phone}
                    </a>
                  )}
                  {event.contact_email && (
                    <a href={`mailto:${event.contact_email}`} className="flex items-center gap-2 text-sm hover:underline">
                      <Mail className="h-4 w-4" />
                      {event.contact_email}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="pt-6">
              {isOpen && availableSpots > 0 ? (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="w-full gap-2">
                      <Trophy className="h-5 w-5" />
                      Inscribirme ahora
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    {submitted ? (
                      <div className="text-center py-6">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <DialogTitle className="text-2xl mb-2">¡Inscripción enviada!</DialogTitle>
                        <DialogDescription className="text-base">
                          El organizador revisará tu solicitud y te contactará pronto.
                        </DialogDescription>
                        <Button className="mt-6" onClick={() => setDialogOpen(false)}>
                          Cerrar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <DialogHeader>
                          <DialogTitle>Inscripción a {event.title}</DialogTitle>
                          <DialogDescription>
                            Completa tus datos para inscribirte
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <Label htmlFor="name">Nombre completo *</Label>
                            <Input
                              id="name"
                              value={formData.participant_name}
                              onChange={(e) => setFormData({ ...formData, participant_name: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone">Teléfono (WhatsApp) *</Label>
                            <Input
                              id="phone"
                              type="tel"
                              value={formData.participant_phone}
                              onChange={(e) => setFormData({ ...formData, participant_phone: e.target.value })}
                              placeholder="+57 300 123 4567"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.participant_email}
                              onChange={(e) => setFormData({ ...formData, participant_email: e.target.value })}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="role">Soy...</Label>
                              <Select
                                value={formData.participant_role}
                                onValueChange={(v) => setFormData({ ...formData, participant_role: v as any })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="athlete">Atleta</SelectItem>
                                  <SelectItem value="parent">Padre/Madre</SelectItem>
                                  <SelectItem value="coach">Entrenador</SelectItem>
                                  <SelectItem value="other">Otro</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="age">Edad</Label>
                              <Input
                                id="age"
                                type="number"
                                min="1"
                                max="99"
                                value={formData.participant_age}
                                onChange={(e) => setFormData({ ...formData, participant_age: e.target.value })}
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="notes">Notas adicionales</Label>
                            <Textarea
                              id="notes"
                              value={formData.notes}
                              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                              placeholder="Información adicional..."
                              rows={2}
                            />
                          </div>
                          {event.price > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg text-sm">
                              <p className="font-medium text-amber-800 dark:text-amber-200">
                                💰 Precio: {formatPrice(event.price)}
                              </p>
                              <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                                El organizador te contactará con los datos de pago
                              </p>
                            </div>
                          )}
                          <Button type="submit" className="w-full" disabled={registrationLoading}>
                            {registrationLoading ? (
                              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</>
                            ) : (
                              'Enviar inscripción'
                            )}
                          </Button>
                        </form>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
              ) : (
                <Button size="lg" className="w-full" disabled>
                  {availableSpots <= 0 ? 'Cupos agotados' : 'Inscripciones cerradas'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
