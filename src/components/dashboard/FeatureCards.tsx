import { Card, CardContent } from '@/components/ui/card';
import { Search, Trophy, Target, Users, BookOpen, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: Search,
    title: 'Búsqueda Avanzada',
    description: 'Encuentra escuelas por ubicación, disciplina, nivel y presupuesto con filtros inteligentes',
    href: '/explore',
    color: 'text-blue-500'
  },
  {
    icon: Trophy,
    title: 'Comparación Detallada',
    description: 'Compara programas, horarios, precios y metodologías de diferentes academias',
    href: '/explore',
    color: 'text-green-500'
  },
  {
    icon: Target,
    title: 'Seguimiento de Progreso',
    description: 'Monitorea tu evolución con métricas personalizadas y recomendaciones de IA',
    href: '/stats',
    color: 'text-red-500'
  },
  {
    icon: Users,
    title: 'Comunidad Deportiva',
    description: 'Conecta con otros deportistas, comparte experiencias y forma equipos',
    href: '/teams',
    color: 'text-cyan-500'
  },
  {
    icon: BookOpen,
    title: 'Recomendaciones Personalizadas',
    description: 'Recibe sugerencias basadas en tu perfil, objetivos y preferencias',
    href: '/explore',
    color: 'text-orange-500'
  },
  {
    icon: Star,
    title: 'Sistema de Reseñas',
    description: 'Lee opiniones verificadas de otros estudiantes y familias',
    href: '/explore',
    color: 'text-yellow-500'
  }
];

export function FeatureCards() {
  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold">¿Qué puedes hacer?</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.title} to={feature.href}>
              <Card className="h-full hover:shadow-card transition-all duration-300 hover:scale-105 cursor-pointer bg-card/50 backdrop-blur border-border/50">
                <CardContent className="p-6 space-y-3">
                  <div className={`w-12 h-12 rounded-lg bg-background flex items-center justify-center ${feature.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h4 className="font-semibold text-lg">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
