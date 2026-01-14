import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEnrollments } from '@/hooks/useEnrollments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MapPin,
  Phone,
  Mail,
  Star,
  CheckCircle2,
  Globe,
  Users,
  Clock,
  Trophy,
  Heart,
  Share2,
  ArrowLeft,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AuthModal } from '@/components/explore/AuthModal';

interface School {
  id: string;
  name: string;
  description: string | null;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string | null;
  sports: string[] | null;
  amenities: string[] | null;
  rating: number;
  total_reviews: number;
  verified: boolean;
  logo_url: string | null;
  cover_image_url: string | null;
  owner_id: string;
}

interface Program {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  schedule: string | null;
  price_monthly: number;
  age_min: number | null;
  age_max: number | null;
  max_participants: number | null;
  current_participants: number;
  active: boolean;
}

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { createEnrollment } = useEnrollments();
  
  const [school, setSchool] = useState<School | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // Estados para el modal de confirmación
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [programToEnroll, setProgramToEnroll] = useState<Program | null>(null);
  const [pendingAction, setPendingAction] = useState<boolean>(false);
  
  // Ref para scroll
  const programsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchSchoolData();
    }
  }, [id]);

  // EFECTO CLAVE: Detectar login exitoso para retomar flujo
  useEffect(() => {
    if (user && pendingAction && programToEnroll) {
      // Si el usuario se logueó y tenía una acción pendiente
      setAuthModalOpen(false);
      setPendingAction(false);
      setConfirmModalOpen(true); // Abrir confirmación automáticamente
    }
  }, [user, pendingAction, programToEnroll]);

  const fetchSchoolData = async () => {
    try {
      setLoading(true);

      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', id)
        .single();

      if (schoolError) throw schoolError;
      setSchool(schoolData);

      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('*')
        .eq('school_id', id)
        .eq('active', true)
        .order('name');

      if (programsError) throw programsError;
      
      // Use fetched or demo programs
      if (!programsData || programsData.length === 0) {
         // Demo fallback if needed
         setPrograms([]); 
      } else {
        setPrograms(programsData);
      }
    } catch (error: any) {
      console.error('Error fetching school:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la escuela',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Iniciar flujo de inscripción
  const handleEnrollClick = (program: Program) => {
    setProgramToEnroll(program);
    
    if (!user) {
      // Si no hay usuario, marcamos acción pendiente y pedimos auth
      setPendingAction(true);
      setAuthModalOpen(true);
      return;
    }
    
    // Si hay usuario, vamos directo a confirmar
    setConfirmModalOpen(true);
  };

  const handleConfirmEnrollment = async () => {
    if (!programToEnroll || !user) return;

    try {
      setEnrolling(true);
      // Pasamos detalles para el calendario
      const result = await createEnrollment(programToEnroll.id, {
        name: programToEnroll.name,
        schedule: programToEnroll.schedule || 'Horario por confirmar'
      });

      if (result.success) {
        fetchSchoolData(); // Recargar cupos
        setConfirmModalOpen(false);
        setProgramToEnroll(null);
        // Redirigir al dashboard o calendario después de un momento
        setTimeout(() => navigate('/calendar'), 2000);
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleReserveNow = () => {
    if (programsRef.current) {
      programsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Helpers visuales
  const getAgeRange = (program: Program) => {
    if (!program.age_min && !program.age_max) return 'Todas las edades';
    if (!program.age_max) return `${program.age_min}+ años`;
    if (!program.age_min) return `Hasta ${program.age_max} años`;
    return `${program.age_min}-${program.age_max} años`;
  };

  const getAvailability = (program: Program) => {
    if (!program.max_participants) return 'Cupos ilimitados';
    const available = program.max_participants - program.current_participants;
    return available > 0 ? `${available} cupos disponibles` : 'Lleno';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Escuela no encontrada</h1>
        <Button onClick={() => navigate('/explore')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a explorar
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Auth Modal */}
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={(open) => {
          setAuthModalOpen(open);
          if (!open && !user) setPendingAction(false); // Cancelar flujo si cierra modal sin loguear
        }}
      />

      {/* Confirmation Modal */}
      <AlertDialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Inscripción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas inscribirte en <strong>{programToEnroll?.name}</strong>?
              <br /><br />
              Se enviará una confirmación a tu correo y se agendará en tu calendario.
              <div className="mt-2 p-3 bg-muted rounded text-sm">
                <strong>Horario:</strong> {programToEnroll?.schedule || 'Por definir'}<br/>
                <strong>Precio:</strong> ${programToEnroll?.price_monthly.toLocaleString()}/mes
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enrolling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault(); 
                handleConfirmEnrollment();
              }}
              disabled={enrolling}
              className="bg-primary text-primary-foreground"
            >
              {enrolling ? 'Procesando...' : 'Confirmar e Inscribirme'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header Image & Info */}
      <div
        className="h-64 md:h-80 bg-gradient-to-br from-primary/20 to-secondary/20 bg-cover bg-center relative"
        style={school.cover_image_url ? { backgroundImage: `url(${school.cover_image_url})` } : undefined}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="container mx-auto px-4 h-full flex items-end pb-8 relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/explore')}
            className="absolute top-4 left-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-16 relative z-10">
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-24 w-24 border-4 border-background">
                <AvatarImage src={school.logo_url || undefined} />
                <AvatarFallback className="text-2xl">{school.name.charAt(0)}</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="text-3xl font-bold">{school.name}</h1>
                      {school.verified && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Verificada
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" /> {school.city}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        <span className="font-semibold">{school.rating?.toFixed(1) || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon"><Share2 className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon"><Heart className="h-4 w-4" /></Button>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4">{school.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Tabs defaultValue="programs" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="programs">Programas</TabsTrigger>
                <TabsTrigger value="about">Info</TabsTrigger>
                <TabsTrigger value="reviews">Reseñas</TabsTrigger>
              </TabsList>

              <TabsContent value="programs" className="space-y-4" ref={programsRef}>
                {programs.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">No hay programas activos</h3>
                    <p className="text-muted-foreground">Vuelve más tarde para ver nuevas clases.</p>
                  </Card>
                ) : (
                  programs.map((program) => (
                    <Card key={program.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg mb-1">{program.name}</CardTitle>
                            <Badge variant="secondary">{program.sport}</Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">${program.price_monthly.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">/mes</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" /> {getAgeRange(program)}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Trophy className="h-4 w-4" /> {getAvailability(program)}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                            <Clock className="h-4 w-4" /> {program.schedule || 'Horario a convenir'}
                          </div>
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={() => handleEnrollClick(program)}
                          disabled={program.max_participants !== null && program.current_participants >= program.max_participants}
                        >
                          {program.max_participants !== null && program.current_participants >= program.max_participants 
                            ? 'Cupos Agotados' 
                            : 'Inscribirme Ahora'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="about">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h3 className="font-semibold mb-3">Acerca de nosotros</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {school.description || `En ${school.name}, nos dedicamos a formar atletas integrales a través de programas deportivos de alta calidad. Contamos con entrenadores certificados y experiencia comprobada en el desarrollo de jóvenes talentos. Nuestras instalaciones modernas y metodología de entrenamiento garantizan el mejor ambiente para el crecimiento deportivo y personal de nuestros estudiantes.`}
                      </p>
                    </div>

                    <Separator />

                    {school.amenities && school.amenities.length > 0 && (
                      <>
                        <div>
                          <h3 className="font-semibold mb-3">Instalaciones</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {school.amenities.map((amenity) => (
                              <div key={amenity} className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                <span className="text-sm">{amenity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Separator />
                      </>
                    )}

                    <div>
                      <h3 className="font-semibold mb-3">Ubicación</h3>
                      <p className="text-muted-foreground">{school.address}</p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-3">Horarios de atención</h3>
                      <p className="text-muted-foreground">Lunes a Viernes: 8:00 AM - 8:00 PM</p>
                      <p className="text-muted-foreground">Sábados: 9:00 AM - 2:00 PM</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews">
                <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                        Próximamente: Sistema de reseñas y calificaciones.
                    </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Contacto</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3"><MapPin className="w-5 h-5 text-muted-foreground" /><p className="text-sm">{school.address}</p></div>
                <div className="flex gap-3"><Phone className="w-5 h-5 text-muted-foreground" /><p className="text-sm">{school.phone}</p></div>
                <div className="flex gap-3"><Mail className="w-5 h-5 text-muted-foreground" /><p className="text-sm truncate">{school.email}</p></div>
                <Separator />
                <Button className="w-full" size="lg" onClick={handleReserveNow}>
                  <Calendar className="mr-2 h-4 w-4" /> Ver Horarios
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}