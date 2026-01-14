import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Package,
  FolderOpen,
  CreditCard,
  ShoppingCart,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Store
} from 'lucide-react';

export default function StoreOwnerOnboardingPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const onboardingSteps = [
    {
      id: 'products',
      title: 'Crea tu primer Producto',
      description: 'Añade tu primer artículo al inventario con fotos, descripción y precio.',
      icon: Package,
      route: '/products',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'categories',
      title: 'Organiza tus Categorías',
      description: 'Define categorías como "Ropa", "Calzado", "Accesorios" para organizar tu tienda.',
      icon: FolderOpen,
      route: '/categories',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      id: 'payments',
      title: 'Configura tus Pagos',
      description: 'Conecta tu cuenta para recibir pagos de tus clientes de forma segura.',
      icon: CreditCard,
      route: '/settings',
      gradient: 'from-green-500 to-emerald-500',
    },
  ];

  const progress = (completedSteps.length / onboardingSteps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            ¡Bienvenido, {profile?.full_name}!
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Tu tienda está lista para configurarse. Empecemos a vender.
          </p>
        </div>

        {/* Progress Card */}
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progreso de Configuración</span>
                <span className="text-sm text-muted-foreground">
                  {completedSteps.length} de {onboardingSteps.length} completados
                </span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
            {progress === 100 && (
              <Badge variant="default" className="w-full justify-center py-2">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                ¡Configuración completada! Tu tienda está lista para vender
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Onboarding Steps Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {onboardingSteps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = completedSteps.includes(step.id);

            return (
              <Card 
                key={step.id}
                className="relative overflow-hidden hover:shadow-lg transition-all duration-300 border-2"
              >
                <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${step.gradient}`} />
                
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.gradient} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            Paso {index + 1}
                          </Badge>
                          {isCompleted && (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Completado
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-xl">{step.title}</CardTitle>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    {step.description}
                  </p>
                  
                  <Button 
                    className="w-full group"
                    variant={isCompleted ? "outline" : "default"}
                    onClick={() => navigate(step.route)}
                  >
                    {isCompleted ? 'Ver Detalles' : 'Comenzar'}
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Estado Actual de tu Tienda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <p className="text-3xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Productos</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Categorías</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Pedidos</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">$0</p>
                <p className="text-sm text-muted-foreground">Ventas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate('/products')}
            >
              <Package className="w-4 h-4 mr-2" />
              Agregar Producto
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate('/orders')}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Ver Pedidos
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate('/dashboard')}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Ir al Dashboard
            </Button>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">¿Necesitas ayuda?</h3>
              <p className="text-sm text-muted-foreground">
                Consulta nuestra guía para configurar tu tienda online y empezar a vender.
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="outline" size="sm">
                  Ver Guía
                </Button>
                <Button variant="outline" size="sm">
                  Contactar Soporte
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
