import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Star,
  TrendingUp,
  Clock,
  Heart,
  Sparkles,
  Loader2,
  ArrowLeft
} from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserProfileProps {
  onNavigate: (page: string) => void;
}

interface Recommendation {
  title: string;
  type: string;
  reason: string;
  benefits: string[];
}

const UserProfile = ({ onNavigate }: UserProfileProps) => {
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Demo user profile data
  const userProfile = {
    name: "Sofía Martínez",
    email: "sofia.martinez@demo.com",
    phone: "+57 300 123 4567",
    location: "Bogotá, Colombia",
    avatar: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop",
    memberSince: "Enero 2024",
    points: 1250,
    level: "Gold Member",
    completedActivities: 45,
    rating: 4.8
  };

  const bookedClasses = [
    {
      id: 1,
      name: "Clase de Fútbol Sub-12",
      date: "Mañana",
      time: "9:00 - 10:30 AM",
      instructor: "Carlos Valderrama",
      location: "Academia Juvenil",
      image: "https://images.unsplash.com/photo-1552667466-07770ae110d0?w=400&auto=format&fit=crop",
      status: "confirmed"
    },
    {
      id: 2,
      name: "Natación Técnica",
      date: "Miércoles",
      time: "4:00 - 5:00 PM",
      instructor: "María López",
      location: "Centro Acuático",
      image: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&auto=format&fit=crop",
      status: "confirmed"
    },
    {
      id: 3,
      name: "Yoga Deportivo",
      date: "Viernes",
      time: "6:00 - 7:00 PM",
      instructor: "Ana García",
      location: "Wellness Center",
      image: "https://images.unsplash.com/photo-1506629905607-d7d39e2ee9bb?w=400&auto=format&fit=crop",
      status: "pending"
    }
  ];

  const generateRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-recommendations', {
        body: { userProfile }
      });

      if (error) {
        if (error.message.includes('429')) {
          toast({
            title: "Límite excedido",
            description: "Por favor, intenta de nuevo en unos momentos.",
            variant: "destructive",
          });
        } else if (error.message.includes('402')) {
          toast({
            title: "Créditos agotados",
            description: "Contacta con soporte para agregar más créditos.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      if (data?.recommendations) {
        setRecommendations(data.recommendations);
        toast({
          title: "¡Recomendaciones generadas!",
          description: "Hemos personalizado estas sugerencias para ti.",
        });
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
      toast({
        title: "Error",
        description: "No se pudieron generar las recomendaciones. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoadingRecommendations(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onNavigate("dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <button 
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                onClick={() => onNavigate("landing")}
              >
                <Logo size="md" />
                <h1 className="text-xl font-bold">SportMaps</h1>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Profile Header */}
        <Card className="mb-8 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary to-primary/60" />
          <CardContent className="relative pt-0">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
              <Avatar className="w-32 h-32 border-4 border-background -mt-16">
                <AvatarImage src={userProfile.avatar} />
                <AvatarFallback>SM</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3 md:pb-2">
                <div>
                  <h2 className="text-3xl font-bold">{userProfile.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge className="bg-yellow-500/20 text-yellow-700">
                      {userProfile.level}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      • Miembro desde {userProfile.memberSince}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{userProfile.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{userProfile.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{userProfile.location}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 md:pb-2">
                <div className="text-center p-3 rounded-lg bg-muted">
                  <Star className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                  <p className="text-xl font-bold">{userProfile.points}</p>
                  <p className="text-xs text-muted-foreground">Puntos</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <Award className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-xl font-bold">{userProfile.completedActivities}</p>
                  <p className="text-xs text-muted-foreground">Actividades</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <TrendingUp className="h-5 w-5 text-green-500 mx-auto mb-1" />
                  <p className="text-xl font-bold">{userProfile.rating}</p>
                  <p className="text-xs text-muted-foreground">Rating</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="classes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="classes" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Clases Reservadas
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Estadísticas
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Recomendaciones IA
            </TabsTrigger>
          </TabsList>

          {/* Clases Reservadas */}
          <TabsContent value="classes">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookedClasses.map((classItem) => (
                <Card key={classItem.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div 
                    className="h-40 bg-cover bg-center"
                    style={{ backgroundImage: `url(${classItem.image})` }}
                  />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg">{classItem.name}</h3>
                      <Badge className={classItem.status === "confirmed" ? "bg-green-500/20 text-green-700" : "bg-yellow-500/20 text-yellow-700"}>
                        {classItem.status === "confirmed" ? "Confirmada" : "Pendiente"}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {classItem.date}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {classItem.time}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        {classItem.instructor}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {classItem.location}
                      </div>
                    </div>
                    <Button className="w-full mt-4" variant="outline">
                      Ver Detalles
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Estadísticas */}
          <TabsContent value="stats">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Progreso Mensual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-2xl font-bold">12</p>
                      <p className="text-sm text-muted-foreground">Horas Entrenamiento</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <Award className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">8</p>
                      <p className="text-sm text-muted-foreground">Clases Completadas</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <Heart className="h-8 w-8 text-red-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">95%</p>
                      <p className="text-sm text-muted-foreground">Asistencia</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <Star className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-2xl font-bold">+320</p>
                      <p className="text-sm text-muted-foreground">Puntos Ganados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Logros Recientes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10">
                    <Award className="h-8 w-8 text-yellow-500" />
                    <div>
                      <p className="font-semibold">Racha de 7 días</p>
                      <p className="text-sm text-muted-foreground">Asistencia perfecta</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10">
                    <Star className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-semibold">Nivel Gold alcanzado</p>
                      <p className="text-sm text-muted-foreground">1000+ puntos acumulados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
                    <TrendingUp className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="font-semibold">Mejora del 25%</p>
                      <p className="text-sm text-muted-foreground">En rendimiento este mes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Recomendaciones IA */}
          <TabsContent value="recommendations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Recomendaciones Personalizadas con IA
                </CardTitle>
                <p className="text-muted-foreground">
                  Descubre nuevas escuelas, deportes y servicios de bienestar perfectos para ti
                </p>
              </CardHeader>
              <CardContent>
                {recommendations.length === 0 ? (
                  <div className="text-center py-12">
                    <Sparkles className="h-16 w-16 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Genera tus recomendaciones personalizadas</h3>
                    <p className="text-muted-foreground mb-6">
                      Usa IA para obtener sugerencias basadas en tu perfil y actividad
                    </p>
                    <Button 
                      onClick={generateRecommendations}
                      disabled={loadingRecommendations}
                      size="lg"
                    >
                      {loadingRecommendations ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generar Recomendaciones
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button 
                        onClick={generateRecommendations}
                        disabled={loadingRecommendations}
                        variant="outline"
                        size="sm"
                      >
                        {loadingRecommendations ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Regenerando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Regenerar
                          </>
                        )}
                      </Button>
                    </div>
                    {recommendations.map((rec, index) => (
                      <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <Badge className="mb-2 bg-primary/10 text-primary">
                                {rec.type}
                              </Badge>
                              <h3 className="text-xl font-bold mb-2">{rec.title}</h3>
                              <p className="text-muted-foreground mb-4">{rec.reason}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">Beneficios:</p>
                            <ul className="space-y-1">
                              {rec.benefits.map((benefit, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <Star className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                  {benefit}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <Button className="w-full mt-4">
                            Ver Más Detalles
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default UserProfile;
