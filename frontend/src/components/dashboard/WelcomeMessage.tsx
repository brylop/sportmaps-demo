import { Card, CardContent } from '@/components/ui/card';
import { UserRole } from '@/types/dashboard';
import { 
  Trophy, Users, GraduationCap, HeartPulse, 
  ShoppingBag, Shield, Dumbbell 
} from 'lucide-react';

interface WelcomeMessageProps {
  role: UserRole;
  userName?: string;
}

const welcomeConfig: Record<UserRole, {
  title: string;
  message: string;
  icon: React.ElementType;
  gradient: string;
}> = {
  athlete: {
    title: '¡Bienvenido, Atleta!',
    message: 'Entrena con propósito. Rastrea tu progreso y alcanza tus metas deportivas.',
    icon: Dumbbell,
    gradient: 'from-primary/20 to-accent/10',
  },
  parent: {
    title: '¡Hola, Padre de Familia!',
    message: 'Sigue de cerca el crecimiento deportivo de tus hijos y mantente al día con sus logros.',
    icon: Users,
    gradient: 'from-primary/20 to-primary/5',
  },
  coach: {
    title: '¡Bienvenido, Entrenador!',
    message: 'Gestiona tus equipos, planifica entrenamientos y lleva a tus atletas al siguiente nivel.',
    icon: Trophy,
    gradient: 'from-accent/20 to-primary/10',
  },
  school: {
    title: '¡Bienvenido, Administrador!',
    message: 'Administra tus programas y atletas certificados. Tu escuela deportiva en un solo lugar.',
    icon: GraduationCap,
    gradient: 'from-primary/20 to-accent/5',
  },
  wellness_professional: {
    title: '¡Bienvenido, Profesional!',
    message: 'Cuida la salud de los atletas. Gestiona evaluaciones y seguimientos médicos.',
    icon: HeartPulse,
    gradient: 'from-red-500/10 to-primary/10',
  },
  store_owner: {
    title: '¡Bienvenido, Comerciante!',
    message: 'Gestiona tu inventario y ventas en tiempo real. Tu tienda deportiva conectada.',
    icon: ShoppingBag,
    gradient: 'from-accent/20 to-accent/5',
  },
  admin: {
    title: '¡Bienvenido, Administrador!',
    message: 'Supervisa toda la plataforma SportMaps. Control total del ecosistema.',
    icon: Shield,
    gradient: 'from-primary/20 to-destructive/10',
  },
};

export function WelcomeMessage({ role, userName }: WelcomeMessageProps) {
  const config = welcomeConfig[role] || welcomeConfig.athlete;
  const Icon = config.icon;

  return (
    <Card className={`bg-gradient-to-br ${config.gradient} border-primary/20 mb-6`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold font-poppins text-foreground">
              {userName ? `${config.title.split(',')[0]}, ${userName}!` : config.title}
            </h2>
            <p className="text-muted-foreground mt-1 font-poppins">
              {config.message}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
