import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Dumbbell,
  Calendar,
  Building2,
  User,
  ArrowRight,
  Sparkles,
  Trophy,
  Activity,
  CheckCircle
} from 'lucide-react';
import { useEnrollments } from '@/hooks/useEnrollments';

export default function AthleteOnboardingPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  // Conectamos con los datos reales de inscripciones
  const { activeEnrollments, loading } = useEnrollments();

  // Cálculo dinámico del completado del perfil
  const calculateProfileCompletion = () => {
    if (!profile) return 0;
    const fields = [
      profile.full_name,
      profile.phone,
      profile.avatar_url,
      profile.bio
    ];
    const filledFields = fields.filter(Boolean).length;
    return (filledFields / fields.length) * 100;
  };

  const completionPercentage = calculateProfileCompletion();

  const quickActions = [
    {
      id: 'programs',
      title: 'Explorar Programas',
      description: 'Descubre clases y programas deportivos para ti',
      icon: Dumbbell,
      gradient: 'from-blue-500 to-cyan-500',
      route: '/explore',
      buttonText: 'Ver Programas',
    },
    {
      id: 'facilities',
      title: 'Reservar Espacios',
      description: 'Reserva canchas y espacios disponibles',
      icon: Building2,
      gradient: 'from-purple-500 to-pink-500',
      // Nota: Asegúrate de tener una ruta pública/atleta para instalaciones, 
      // o redirige a /explore con filtro de instalaciones
      route: '/explore', 
      buttonText: 'Hacer Reserva',
    },
    {
      id: 'calendar',
      title: 'Mi Agenda',
      description: 'Consulta tus próximos entrenamientos',
      icon: Calendar,
      gradient: 'from-green-500 to-emerald-500',
      route: '/calendar',
      buttonText: 'Ver Calendario',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background p-6 animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="text-center space-y-4 pt-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 mb-4 shadow-lg hover:scale-105 transition-transform">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            ¡Hola, {profile?.full_name?.split(' ')[0] || 'Atleta'}!
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Tu panel de control deportivo personal. ¿Qué quieres lograr hoy?
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Status Card - Dinámico */}
          <Card className="md:col-span-2 border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-24 h-24" />
            </div>
            <CardContent className="pt-6 relative z-10">
              {loading ? (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ) : activeEnrollments.length > 0 ? (
                // Estado: Con inscripciones
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <h3 className="font-bold text-xl">Estás en movimiento 🚀</h3>
                    <p className="text-muted-foreground">
                      Tienes <strong>{activeEnrollments.length} programa{activeEnrollments.length !== 1 ? 's' : ''} activo{activeEnrollments.length !== 1 ? 's' : ''}</strong>. 
                      Revisa tu calendario para ver tus próximas sesiones.
                    </p>
                    <Button onClick={() => navigate('/enrollments')} className="gap-2">
                      Ver Mis Inscripciones
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                // Estado: Nuevo usuario
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <h3 className="font-bold text-xl">Comienza tu Viaje</h3>
                    <p className="text-muted-foreground">
                      Aún no tienes inscripciones activas. Explora las mejores escuelas y encuentra tu deporte ideal.
                    </p>
                    <Button onClick={() => navigate('/explore')} className="gap-2">
                      <Dumbbell className="w-4 h-4" />
                      Explorar Oferta
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Completion Card - Dinámico */}
          <Card className="border-dashed border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Tu Perfil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Completado</span>
                  <span className="font-bold">{completionPercentage.toFixed(0)}%</span>
                </div>
                <Progress value={completionPercentage} className="h-2" />
                
                {completionPercentage < 100 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Completa tu información (foto, teléfono) para una mejor experiencia.
                    </p>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/profile')}>
                      Completar Ahora
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    ¡Perfil al día!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Acceso Rápido
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card 
                  key={action.id}
                  className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-t-4"
                  style={{ borderTopColor: 'transparent' }}
                >
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${action.gradient}`} />
                  
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <CardTitle className="mt-4 text-lg">{action.title}</CardTitle>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground min-h-[40px]">
                      {action.description}
                    </p>
                    
                    <Button 
                      variant="secondary"
                      className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      onClick={() => navigate(action.route)}
                    >
                      {action.buttonText}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Footer Tip */}
        <div className="bg-muted/30 border border-dashed rounded-xl p-6 text-center max-w-2xl mx-auto">
          <h3 className="font-semibold mb-1">¿Necesitas ayuda?</h3>
          <p className="text-sm text-muted-foreground">
            Si tienes dudas sobre cómo inscribirte o gestionar tu cuenta, estamos aquí para ayudarte.
          </p>
        </div>
      </div>
    </div>
  );
}