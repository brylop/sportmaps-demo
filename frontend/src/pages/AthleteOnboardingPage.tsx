import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dumbbell,
  Calendar,
  Building2,
  User,
  ArrowRight,
  Sparkles,
  Trophy,
  Loader2
} from 'lucide-react';

export default function AthleteOnboardingPage() {
  const { profile, user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [completeLoading, setCompleteLoading] = useState(false);

  // ... (quickActions definition)

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    setCompleteLoading(true);
    try {
      await updateProfile({ onboarding_completed: true });
      // Small delay to ensure state propagates
      setTimeout(() => navigate('/dashboard'), 500);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setCompleteLoading(false);
    }
  };

  {/* Status Card */ }
  <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
    <CardContent className="pt-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Comienza tu Viaje Deportivo</h3>
          <p className="text-muted-foreground">
            Aún no te has inscrito a ningún programa. Explora las opciones disponibles
            y encuentra el programa perfecto para ti.
          </p>
          <Button
            className="mt-3"
            onClick={() => navigate('/explore')}
          >
            <Dumbbell className="w-4 h-4 mr-2" />
            Explorar Programas
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>

  {/* Quick Actions Grid */ }
  <div className="space-y-4">
    <h2 className="text-2xl font-bold">Acciones Rápidas</h2>
    <div className="grid gap-6 md:grid-cols-3">
      {quickActions.map((action) => {
        const Icon = action.icon;

        return (
          <Card
            key={action.id}
            className="relative overflow-hidden hover:shadow-lg transition-all duration-300"
          >
            {/* Gradient top bar */}
            <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${action.gradient}`} />

            <CardHeader>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-lg">{action.title}</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {action.description}
              </p>

              <Button
                className="w-full group"
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

  {/* Profile Completion */ }
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        Completa tu Perfil
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground mb-4">
        Añade tu foto de perfil y actualiza tu información de contacto para una mejor experiencia.
      </p>
      <Button
        variant="outline"
        onClick={() => navigate('/profile')}
      >
        <User className="w-4 h-4 mr-2" />
        Editar Mi Perfil
      </Button>
    </CardContent>
  </Card>

  {/* Help Card */ }
  <Card className="bg-muted/50 border-dashed">
    <CardContent className="pt-6">
      <div className="text-center space-y-2">
        <h3 className="font-semibold">¿Necesitas ayuda?</h3>
        <p className="text-sm text-muted-foreground">
          Si tienes preguntas sobre cómo inscribirte a programas o reservar instalaciones,
          estamos aquí para ayudarte.
        </p>
      </div>
    </CardContent>
  </Card>
      </div >
    </div >
  );
}
