import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Users, 
  ClipboardList,
  User,
  CheckCircle2,
  Sparkles,
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
                      {module.description}
                    </p>
                    
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(module.route)}
                    >
                      Ver Módulo
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

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
