import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { School, Users, Play, ArrowRight, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { getDemoUser } from '@/lib/demo-credentials';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function DemoWelcomePage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleDemoAccess = async (roleId: string) => {
    const demoUser = getDemoUser(roleId);
    if (!demoUser) return;

    setIsLoading(roleId);
    
    try {
      // Store that user is in demo mode
      sessionStorage.setItem('demo_mode', 'true');
      sessionStorage.setItem('demo_role', roleId);
      sessionStorage.setItem('demo_tour_pending', 'true');
      
      try {
        await signIn(demoUser.email, demoUser.password);
        navigate('/dashboard');
      } catch (signInError: any) {
        if (signInError.message.includes('Invalid') || signInError.message.includes('not found')) {
          await signUp(demoUser.email, demoUser.password, {
            full_name: demoUser.fullName,
            role: demoUser.role as any,
          });
          
          await signIn(demoUser.email, demoUser.password);
          navigate('/dashboard');
        } else {
          throw signInError;
        }
      }
    } catch (error: any) {
      console.error('Error accessing demo:', error);
      toast({
        title: "Error al acceder al demo",
        description: error.message || "Por favor intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleVideoDemo = () => {
    // TODO: Open video modal or redirect to video
    toast({
      title: "Video Demo",
      description: "El video demo estará disponible próximamente",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/sportmaps-logo.png" 
              alt="SportMaps" 
              className="w-10 h-10 rounded-lg"
            />
            <div>
              <h1 className="text-xl font-bold">SportMaps Demo</h1>
              <p className="text-xs text-muted-foreground">Demo Interactivo</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = 'https://sportmaps.co'}
          >
            ← Volver a SportMaps.co
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-12 space-y-4">
          <Badge className="mb-2" variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            3 minutos de tour guiado
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold">
            Bienvenido al Demo Interactivo de <span className="text-primary">SportMaps</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Descubre cómo SportMaps revoluciona la gestión de academias deportivas y conecta miles de familias con programas deportivos.
          </p>
        </div>

        {/* Three Steps */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">1. Gestión Integral</CardTitle>
              <CardDescription>
                Dashboard con ingresos, estudiantes activos, cobros automáticos y reportes en tiempo real
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">2. Marketplace Potente</CardTitle>
              <CardDescription>
                Tu academia visible para 15.000+ padres buscando escuelas cada mes. Sin pagar publicidad.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">3. Monetización Automática</CardTitle>
              <CardDescription>
                Cobros recurrentes, app para padres, tienda de uniformes. Todo incluido desde $79k/mes.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Main CTAs */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* School Demo - PRIMARY */}
          <Card className="border-2 border-primary shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 rounded-full bg-primary mx-auto flex items-center justify-center mb-3">
                <School className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">🏫 Demo para Escuelas</CardTitle>
              <CardDescription className="text-base">
                Ver cómo gestionas tu academia y atraes alumnos automáticamente
              </CardDescription>
              <Badge className="mt-2" variant="default">Recomendado - 80% lo eligen</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  <span>Dashboard con $17.8M COP en ingresos mensuales</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  <span>87 estudiantes activos con cobros automáticos</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  <span>Ver tu perfil en el marketplace</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  <span>App móvil para padres y sistema de pagos</span>
                </div>
              </div>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => handleDemoAccess('school')}
                disabled={isLoading === 'school'}
              >
                {isLoading === 'school' ? 'Cargando...' : (
                  <>
                    Ver Demo de Escuela
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Parent Demo - SECONDARY */}
          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 rounded-full bg-secondary mx-auto flex items-center justify-center mb-3">
                <Users className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">👨‍👩‍👧 Demo para Padres</CardTitle>
              <CardDescription className="text-base">
                Ver cómo padres encuentran y reservan en tu escuela
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5" />
                  <span>Buscar entre 150+ escuelas certificadas</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5" />
                  <span>Filtros por deporte, edad, ubicación y precio</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5" />
                  <span>Ver reseñas y reservar clase de prueba</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5" />
                  <span>Dashboard con progreso de tus hijos</span>
                </div>
              </div>
              <Button 
                className="w-full" 
                size="lg"
                variant="secondary"
                onClick={() => handleDemoAccess('parent')}
                disabled={isLoading === 'parent'}
              >
                {isLoading === 'parent' ? 'Cargando...' : (
                  <>
                    Ver Demo de Padre
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Video Demo Option */}
        <Card className="border">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Play className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">¿Prefieres ver un video primero?</h3>
                <p className="text-sm text-muted-foreground">Tour guiado de 60 segundos explicando todo</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleVideoDemo}>
              Ver Video Demo
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-primary">150+</div>
            <div className="text-sm text-muted-foreground">Academias Registradas</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">15K+</div>
            <div className="text-sm text-muted-foreground">Padres Buscando</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">$180M</div>
            <div className="text-sm text-muted-foreground">COP en Matrículas</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">98%</div>
            <div className="text-sm text-muted-foreground">Tasa de Cobro</div>
          </div>
        </div>
      </div>
    </div>
  );
}