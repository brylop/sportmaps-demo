import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, MapPin, Clock, ArrowLeft, Share2, AlertCircle, Sparkles, Check, Download, Info } from 'lucide-react';

export default function EventPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { getEventBySlug, logTelemetry, loading } = useEvents();

  const [event, setEvent] = useState<any>(null);

  useEffect(() => {
    if (slug) loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleEnrollClick = () => {
    if (!user) {
      toast({ title: 'Inicia Sesión', description: 'Necesitas una cuenta para inscribirte.', variant: 'destructive' });
      navigate('/login');
      return;
    }

    const role = profile?.role;

    // Schools always go to delegation enrollment
    if (role === 'school' || role === 'admin' || role === 'school_admin') {
      navigate(`/school/enroll/${event.id}`);
      return;
    }

    // Athletes, parents, coaches → individual registration
    if (role === 'athlete' || role === 'parent' || role === 'coach') {
      navigate(`/event/${event.id}/register`);
      return;
    }

    toast({ title: 'No disponible', description: 'Tu rol no permite inscripciones a eventos.', variant: 'destructive' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="container max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4">
        <Card className="max-w-md text-center shadow-xl">
          <CardContent className="pt-6">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Evento no encontrado</h2>
            <p className="text-muted-foreground mb-4">Este evento no existe, es privado o ya no está disponible.</p>
            <Button onClick={() => navigate('/events')} variant="outline" className="gap-2">
              <MapPin className="h-4 w-4" /> Explorar eventos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPublished = event.status === 'active' || event.status === 'published';
  const isOpen = isPublished && event.registrations_open !== false
    && (!event.registration_deadline || new Date(event.registration_deadline) >= new Date());

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Hero Banner */}
      <div className="relative h-[40vh] md:h-[50vh] bg-slate-900 overflow-hidden">
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} className="absolute inset-0 w-full h-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-purple-800/80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
        
        <div className="absolute top-4 left-4 z-20">
          <Button variant="secondary" size="sm" onClick={() => navigate('/events')} className="gap-2 backdrop-blur-md bg-white/20 text-white border-white/30 hover:bg-white/40">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        </div>
        <div className="absolute top-4 right-4 z-20">
          <Button variant="secondary" size="sm" onClick={handleShare} className="gap-2 backdrop-blur-md bg-white/20 text-white border-white/30 hover:bg-white/40">
            <Share2 className="h-4 w-4" /> Compartir
          </Button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-20 container max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge className="bg-primary/90 text-white hover:bg-primary border-none">{event.sport}</Badge>
            {isOpen ? (
              <Badge className="bg-green-500/90 text-white border-none flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Inscripciones Abiertas
              </Badge>
            ) : (
              <Badge variant="destructive">Cerrado o en Borrador</Badge>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-2 tracking-tight drop-shadow-md">
            {event.title}
          </h1>
          <p className="text-lg text-slate-200 flex items-center gap-2 max-w-2xl opacity-90 drop-shadow">
            <MapPin className="h-5 w-5" /> {event.address ? `${event.address}, ` : ''}{event.city}
          </p>
        </div>
      </div>

      <div className="container max-w-5xl mx-auto px-4 -mt-6 relative z-30">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full justify-start bg-white border shadow-sm p-1">
                <TabsTrigger value="info" className="flex-1">Información</TabsTrigger>
                <TabsTrigger value="categories" className="flex-1">Categorías y Precios</TabsTrigger>
                <TabsTrigger value="rules" className="flex-1">Reglas y Fechas</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <Card className="shadow-md border-0">
                  <CardHeader>
                    <CardTitle className="text-xl">Sobre el Evento</CardTitle>
                  </CardHeader>
                  <CardContent className="prose prose-slate max-w-none">
                    {event.description ? (
                      <p className="whitespace-pre-line text-slate-700">{event.description}</p>
                    ) : (
                      <p className="text-muted-foreground italic">El organizador aún no ha proporcionado detalles adicionales.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="categories" className="mt-4 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <Card className="shadow-md border-0">
                  <CardHeader>
                    <CardTitle className="text-xl">Categorías Disponibles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {event.categories && event.categories.length > 0 ? (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead>División / Nivel</TableHead>
                              <TableHead>Categoría</TableHead>
                              <TableHead>Rama</TableHead>
                              <TableHead>Edades</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {event.categories.map((c: any) => (
                              <TableRow key={c.id}>
                                <TableCell className="font-medium">{c.division} {c.level && c.level !== 'N/A' ? `L${c.level}` : ''}</TableCell>
                                <TableCell>{c.category}</TableCell>
                                <TableCell>{c.rama}</TableCell>
                                <TableCell>{c.age_min ?? '—'} a {c.age_max ?? '—'} años</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Categorías no definidas.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-md border-0">
                  <CardHeader>
                    <CardTitle className="text-xl">Fases de Precio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {event.phases && event.phases.length > 0 ? (
                      <div className="space-y-4">
                        {event.phases.map((p: any) => (
                          <div key={p.id} className="p-4 border rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                            <div>
                              <h4 className="font-bold text-lg">{p.phase_name}</h4>
                              <p className="text-sm text-slate-600">Válida hasta: {formatDate(p.valid_until)}</p>
                              <Badge variant="outline" className="mt-2 text-xs">Kit {p.kit_type}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-right">
                              <div><span className="text-slate-500 block">Solo Competencia</span><span className="font-semibold">${p.price_solo?.toLocaleString()}</span></div>
                              {p.price_pkg3 > 0 && <div><span className="text-slate-500 block">2 Noches</span><span className="font-semibold">${p.price_pkg3?.toLocaleString()}</span></div>}
                              {p.price_pkg2 > 0 && <div><span className="text-slate-500 block">3 Noches</span><span className="font-semibold">${p.price_pkg2?.toLocaleString()}</span></div>}
                              {p.price_pkg1 > 0 && <div><span className="text-slate-500 block">4 Noches</span><span className="font-semibold">${p.price_pkg1?.toLocaleString()}</span></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Paquetes no definidos.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rules" className="mt-4 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <Card className="shadow-md border-0">
                  <CardHeader>
                    <CardTitle className="text-xl">Reglas y Beneficios</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-3">
                      <li className="flex gap-3 items-start"><Check className="h-5 w-5 text-green-500 shrink-0" /><span><strong>Crossover:</strong> {event.crossover_allowed ? 'Permitido' : 'No permitido'}</span></li>
                      {event.free_package_every > 0 && <li className="flex gap-3 items-start"><Check className="h-5 w-5 text-green-500 shrink-0" /><span><strong>Promo Entrenadores:</strong> 1 inscripción/paquete gratis por cada {event.free_package_every} atletas.</span></li>}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sticky Sidebar / CTA */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <Card className="shadow-xl border-primary/20 bg-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Calendar className="h-32 w-32" />
                </div>
                <CardContent className="p-6 relative z-10 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-700">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold">{formatDate(event.event_date)}</p>
                        {(event.start_time || event.end_time) && (
                          <p className="text-sm text-slate-500">{event.start_time} {event.end_time && `- ${event.end_time}`}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-700">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold">{event.city}</p>
                        {event.address && <p className="text-sm text-slate-500">{event.address}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Cierre de inscripciones:</p>
                    <p className="font-medium text-red-600">{event.registration_deadline ? formatDate(event.registration_deadline) : 'No definido'}</p>
                  </div>

                  {isOpen ? (
                    <div className="space-y-3">
                      <Button onClick={handleEnrollClick} size="lg" className="w-full font-bold shadow-md shadow-primary/20 text-md h-12">
                        {profile?.role === 'school' || profile?.role === 'admin' || profile?.role === 'school_admin'
                          ? 'Inscribir Delegacion'
                          : 'Inscribirme al Evento'}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                        <Info className="h-3 w-3" /> Atletas, padres y escuelas pueden inscribirse
                      </p>
                    </div>
                  ) : (
                    <Button disabled size="lg" className="w-full">
                      Inscripciones Cerradas
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Documentación (Optional) */}
              <Card className="shadow-md border-0 bg-slate-50">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><Download className="h-4 w-4" /> Documentos Importantes</h4>
                  <Button variant="link" className="px-0 text-slate-600 h-auto py-1 w-full justify-start">Ver Manual y Reglamento PDF</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
