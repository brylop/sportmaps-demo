import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
  
  const [school, setSchool] = useState<School | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [showReserveModal, setShowReserveModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSchoolData();
    }
  }, [id]);

  const fetchSchoolData = async () => {
    try {
      setLoading(true);

      // Fetch school details
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', id)
        .single();

      if (schoolError) throw schoolError;
      setSchool(schoolData);

      // Fetch programs
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('*')
        .eq('school_id', id)
        .eq('active', true)
        .order('name');

      if (programsError) throw programsError;
      
      // If no programs, add demo programs
      if (!programsData || programsData.length === 0) {
        setPrograms(getDemoPrograms(schoolData.name, schoolData.sports?.[0] || 'Fútbol'));
      } else {
        setPrograms(programsData);
      }
    } catch (error: any) {
      console.error('Error fetching school data:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información de la escuela',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (programId: string) => {
    if (!user) {
      // Usuario no autenticado - mostrar modal de auth
      setSelectedProgramId(programId);
      setAuthModalOpen(true);
      return;
    }

    try {
      setEnrolling(true);

      const { error } = await supabase.from('enrollments').insert({
        user_id: user.id,
        program_id: programId,
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
      });

      if (error) throw error;

      toast({
        title: '¡Inscripción exitosa!',
        description: 'Te has inscrito correctamente al programa',
      });

      // Refresh programs to update participant count
      fetchSchoolData();
    } catch (error: any) {
      console.error('Error enrolling:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo completar la inscripción',
        variant: 'destructive',
      });
    } finally {
      setEnrolling(false);
    }
  };

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

  const getDemoPrograms = (schoolName: string, sport: string): Program[] => {
    return [
      {
        id: 'demo-1',
        name: `${sport} Inicial`,
        description: 'Programa diseñado para principiantes. Aprende las técnicas básicas y fundamentos del deporte en un ambiente divertido y seguro.',
        sport: sport,
        schedule: 'Lunes y Miércoles 4:00 PM - 5:30 PM',
        price_monthly: 45000,
        age_min: 6,
        age_max: 10,
        max_participants: 20,
        current_participants: 12,
        active: true
      },
      {
        id: 'demo-2',
        name: `${sport} Intermedio`,
        description: 'Nivel intermedio para estudiantes con experiencia previa. Desarrolla habilidades técnicas avanzadas y trabajo en equipo.',
        sport: sport,
        schedule: 'Martes y Jueves 5:00 PM - 6:30 PM',
        price_monthly: 55000,
        age_min: 11,
        age_max: 15,
        max_participants: 18,
        current_participants: 15,
        active: true
      },
      {
        id: 'demo-3',
        name: `${sport} Competitivo`,
        description: 'Programa de alto rendimiento para atletas que buscan competir a nivel profesional. Entrenamientos intensivos y preparación para torneos.',
        sport: sport,
        schedule: 'Lunes a Viernes 6:00 PM - 8:00 PM',
        price_monthly: 75000,
        age_min: 14,
        age_max: 18,
        max_participants: 15,
        current_participants: 14,
        active: true
      }
    ];
  };

  const getDemoReviews = () => {
    return [
      {
        id: 'review-1',
        author: 'María González',
        rating: 5,
        date: 'Hace 2 semanas',
        comment: 'Excelente academia! Los entrenadores son muy profesionales y dedicados. Mi hijo ha mejorado muchísimo desde que empezó.'
      },
      {
        id: 'review-2',
        author: 'Carlos Martínez',
        rating: 5,
        date: 'Hace 1 mes',
        comment: 'Las instalaciones son de primera calidad y el ambiente es muy amigable. Totalmente recomendado para niños y adolescentes.'
      },
      {
        id: 'review-3',
        author: 'Ana López',
        rating: 4,
        date: 'Hace 2 meses',
        comment: 'Muy buena experiencia en general. Los horarios son flexibles y el equipo es muy atento. Solo mejoraría la comunicación con los padres.'
      }
    ];
  };

  const handleReserveNow = () => {
    if (!user) {
      setShowReserveModal(true);
    } else {
      toast({
        title: 'Información',
        description: 'Por favor selecciona un programa para inscribirte',
      });
    }
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
    <div className="min-h-screen bg-background">
      {/* Auth Modal for Programs */}
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen}
        programId={selectedProgramId || undefined}
      />

      {/* Auth Modal for Reserve Now Button */}
      <AuthModal 
        open={showReserveModal} 
        onOpenChange={setShowReserveModal}
      />

      {/* Cover Image */}
      <div
        className="h-64 md:h-80 bg-gradient-to-br from-primary/20 to-secondary/20 bg-cover bg-center relative"
        style={
          school.cover_image_url
            ? { backgroundImage: `url(${school.cover_image_url})` }
            : undefined
        }
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

      <div className="container mx-auto px-4 -mt-16 relative z-10 pb-8">
        {/* Header Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Logo */}
              <Avatar className="h-24 w-24 border-4 border-background">
                <AvatarImage src={school.logo_url || undefined} />
                <AvatarFallback className="text-2xl">
                  {school.name.charAt(0)}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="text-3xl font-bold">{school.name}</h1>
                      {school.verified && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Verificada
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{school.city}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{school.rating.toFixed(1)}</span>
                        <span>({school.total_reviews} reseñas)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="icon">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {school.description && (
                  <p className="text-muted-foreground mb-4">{school.description}</p>
                )}

                {/* Sports */}
                {school.sports && school.sports.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {school.sports.map((sport) => (
                      <Badge key={sport} variant="secondary">
                        {sport}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Column - Details */}
          <div className="md:col-span-2 space-y-6">
            <Tabs defaultValue="programs" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="programs">Programas</TabsTrigger>
                <TabsTrigger value="about">Acerca de</TabsTrigger>
                <TabsTrigger value="reviews">Reseñas</TabsTrigger>
              </TabsList>

              {/* Programs Tab */}
              <TabsContent value="programs" className="space-y-4">
                {programs.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">
                      No hay programas disponibles
                    </h3>
                    <p className="text-muted-foreground">
                      Esta escuela aún no ha publicado programas
                    </p>
                  </Card>
                ) : (
                  programs.map((program) => (
                    <Card key={program.id} className="overflow-hidden">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="mb-2">{program.name}</CardTitle>
                            <Badge variant="secondary">{program.sport}</Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">
                              ${program.price_monthly.toLocaleString()}
                            </p>
                            <p className="text-sm text-muted-foreground">por mes</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {program.description && (
                          <p className="text-muted-foreground">{program.description}</p>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{getAgeRange(program)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                            <span>{getAvailability(program)}</span>
                          </div>
                          {program.schedule && (
                            <div className="flex items-center gap-2 col-span-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{program.schedule}</span>
                            </div>
                          )}
                        </div>

                        <Button
                          className="w-full"
                          onClick={() => handleEnroll(program.id)}
                          disabled={
                            enrolling ||
                            (program.max_participants !== null &&
                              program.current_participants >= program.max_participants)
                          }
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          {program.max_participants !== null &&
                          program.current_participants >= program.max_participants
                            ? 'Programa Lleno'
                            : 'Inscribirme'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* About Tab */}
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

              {/* Reviews Tab */}
              <TabsContent value="reviews" className="space-y-4">
                {getDemoReviews().map((review) => (
                  <Card key={review.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{review.author}</p>
                          <p className="text-sm text-muted-foreground">{review.date}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-muted-foreground">{review.comment}</p>
                    </CardContent>
                  </Card>
                ))}
                
                <Card className="bg-muted/50">
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">
                      ¿Ya conoces esta academia? Inicia sesión para dejar tu reseña
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Contact Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información de Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Dirección</p>
                    <p className="text-sm text-muted-foreground">{school.address}</p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Teléfono</p>
                    <a
                      href={`tel:${school.phone}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {school.phone}
                    </a>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <a
                      href={`mailto:${school.email}`}
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {school.email}
                    </a>
                  </div>
                </div>

                {school.website && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-3">
                      <Globe className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Sitio Web</p>
                        <a
                          href={school.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline break-all"
                        >
                          {school.website}
                        </a>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <Button 
                  className="w-full" 
                  onClick={handleReserveNow}
                  size="lg"
                >
                  <Calendar className="h-5 w-5 mr-2" />
                  Reservar Ahora
                </Button>
                
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Selecciona un programa y completa tu reserva
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
