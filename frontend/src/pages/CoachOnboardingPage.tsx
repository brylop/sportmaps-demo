import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
<<<<<<< HEAD
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
=======
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Users, 
  ClipboardList,
  User,
  CheckCircle2,
  Sparkles,
<<<<<<< HEAD
  Clock,
  Trophy,
  ArrowRight,
  Megaphone
} from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function CoachOnboardingPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  // 1. Consultar equipos asignados
  const { data: teams, isLoading } = useQuery({
    queryKey: ['coach-onboarding-teams', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, sport')
        .eq('coach_id', user.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // 2. Calcular completado del perfil
  const calculateProfileCompletion = () => {
    if (!profile) return 0;
    const fields = [
      profile.full_name,
      profile.phone,
      profile.avatar_url,
      profile.bio
    ];
    const filledFields = fields.filter(Boolean).length;
    return Math.round((filledFields / fields.length) * 100);
  };

  const completionPercentage = calculateProfileCompletion();
  const hasTeams = teams && teams.length > 0;

  const modules = [
    {
      id: 'attendance',
      title: 'Toma de Asistencia',
      description: 'Registra la asistencia de tus jugadores en entrenamientos y partidos.',
      icon: ClipboardList,
      gradient: 'from-blue-500 to-cyan-500',
      route: '/coach-attendance',
      buttonText: 'Tomar Lista'
    },
    {
      id: 'calendar',
      title: 'Calendario y Eventos',
      description: 'Gestiona tu agenda, programa entrenamientos y partidos.',
      icon: Calendar,
      gradient: 'from-purple-500 to-pink-500',
      route: '/calendar',
      buttonText: 'Ver Calendario'
    },
    {
      id: 'announcements',
      title: 'Anuncios y Mensajes',
      description: 'Envía comunicados importantes a padres y jugadores.',
      icon: Megaphone,
      gradient: 'from-orange-500 to-red-500',
      route: '/announcements',
      buttonText: 'Crear Anuncio'
    },
    {
      id: 'reports',
      title: 'Reportes y Resultados',
      description: 'Evalúa el rendimiento y registra los resultados de los partidos.',
      icon: Trophy,
      gradient: 'from-green-500 to-emerald-500',
      route: '/coach-reports', // O '/results' si prefieres separar
      buttonText: 'Ver Reportes'
    },
  ];

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando panel de entrenador..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background p-6 animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Welcome Header */}
        <div className="text-center space-y-4 pt-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 mb-4 shadow-lg hover:scale-105 transition-transform">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            ¡Hola, Profe {profile?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Bienvenido a tu centro de comando deportivo.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Status Card - Dinámico */}
          <Card className="md:col-span-2 border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-24 h-24" />
            </div>
            <CardContent className="pt-6 relative z-10">
              {hasTeams ? (
                // Estado: Activo con equipos
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xl">Equipo Activo</h3>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200">
                        En acción
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      Tienes asignado(s) <strong>{teams.length} equipo(s)</strong>: {teams.map(t => t.name).join(', ')}.
                      Es hora de planificar la semana.
                    </p>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => navigate('/coach-attendance')} className="gap-2">
                        <ClipboardList className="w-4 h-4" />
                        Tomar Asistencia
                      </Button>
                      <Button variant="outline" onClick={() => navigate('/announcements')}>
                        Nuevo Anuncio
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                // Estado: Esperando asignación
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <h3 className="font-bold text-xl">Esperando Asignaciones</h3>
                    <p className="text-muted-foreground">
                      Actualmente, la administración de la escuela no te ha asignado ningún equipo.
                      Cuando lo hagan, aparecerán aquí automáticamente.
                    </p>
                    <Button variant="outline" onClick={() => navigate('/profile')} className="mt-2">
                      <User className="w-4 h-4 mr-2" />
                      Revisar mi Perfil
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Completion Card */}
          <Card className="border-dashed border-2 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Tu Perfil Profesional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Completado</span>
                  <span className="font-bold">{completionPercentage}%</span>
                </div>
                <Progress value={completionPercentage} className="h-2" />
                
                {completionPercentage < 100 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Asegúrate de tener tu foto y biografía actualizados para que los padres te conozcan mejor.
                    </p>
                    <Button variant="ghost" size="sm" className="w-full text-primary" onClick={() => navigate('/profile')}>
                      Completar ahora <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    ¡Perfil excelente!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modules Overview */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Herramientas de Gestión
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Card 
                  key={module.id}
                  className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-t-4"
                  style={{ borderTopColor: 'transparent' }}
                >
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${module.gradient}`} />
                  
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300 mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground min-h-[60px]">
=======
  Clock
} from 'lucide-react';

export default function CoachOnboardingPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const modules = [
    {
      id: 'programs',
      title: 'Mis Programas / Mis Clases',
      description: 'Aún no te han asignado clases. Cuando seas el entrenador principal de un programa, lo verás aquí.',
      icon: ClipboardList,
      gradient: 'from-blue-500 to-cyan-500',
      route: '/coach-attendance',
    },
    {
      id: 'calendar',
      title: 'Mi Calendario',
      description: 'Tu horario está vacío. Tus clases asignadas y eventos aparecerán aquí automáticamente.',
      icon: Calendar,
      gradient: 'from-purple-500 to-pink-500',
      route: '/calendar',
    },
    {
      id: 'students',
      title: 'Mis Estudiantes',
      description: 'Actualmente no tienes estudiantes asignados. Los estudiantes que se inscriban en tus programas aparecerán aquí.',
      icon: Users,
      gradient: 'from-green-500 to-emerald-500',
      route: '/coach-reports',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            ¡Hola, {profile?.full_name}!
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Tu cuenta está activa y lista para comenzar.
          </p>
        </div>

        {/* Status Card */}
        <Card className="border-2 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Esperando Asignaciones</h3>
                <p className="text-muted-foreground">
                  Actualmente, el administrador no te ha asignado ningún programa o clase.
                  Cuando te asignen tu primer programa, aparecerá aquí y en tu calendario.
                </p>
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/profile')}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Completar mi Perfil
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modules Overview */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Tus Módulos</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {modules.map((module, index) => {
              const Icon = module.icon;

              return (
                <Card 
                  key={module.id}
                  className="relative overflow-hidden hover:shadow-lg transition-all duration-300"
                >
                  {/* Gradient top bar */}
                  <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${module.gradient}`} />
                  
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.gradient} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">{module.title}</CardTitle>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                      {module.description}
                    </p>
                    
                    <Button 
<<<<<<< HEAD
                      variant="secondary"
                      className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      onClick={() => navigate(module.route)}
                    >
                      {module.buttonText}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
=======
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(module.route)}
                    >
                      Ver Módulo
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

<<<<<<< HEAD
        {/* Help / Contact */}
        {!hasTeams && (
          <div className="bg-muted/30 border border-dashed rounded-xl p-6 text-center max-w-2xl mx-auto">
            <h3 className="font-semibold mb-1">¿No ves tus equipos?</h3>
            <p className="text-sm text-muted-foreground">
              Contacta al administrador de tu escuela deportiva para que te asigne a los grupos correspondientes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
=======
        {/* Info Card */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">¿Qué sigue?</h3>
              <p className="text-sm text-muted-foreground">
                Una vez que el administrador te asigne clases y programas, recibirás una notificación
                y podrás comenzar a gestionar tus estudiantes y tomar asistencia.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
