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
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 overflow-x-hidden">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
            <img 
              src="/sportmaps-logo.png" 
              alt="SportMaps" 
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex-shrink-0"
            />
            <div className="overflow-hidden">
              <h1 className="text-base md:text-xl font-bold truncate">SportMaps Demo</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">Demo Interactivo</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-xs md:text-sm"
            onClick={() => window.location.href = 'https://sportmaps.co'}
          >
            ← Volver
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-3 md:px-4 py-6 md:py-12 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-8 md:mb-12 space-y-3 md:space-y-4">
          <Badge className="mb-2" variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            3 minutos de tour guiado
          </Badge>
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold px-2">
            Bienvenido al Demo Interactivo de <span className="text-primary">SportMaps</span>
          </h1>
          <p className="text-base md:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
            Descubre cómo SportMaps revoluciona la gestión de academias deportivas y conecta miles de familias con programas deportivos.
          </p>
        </div>

        {/* Three Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-base md:text-lg">1. Gestión Integral</CardTitle>
              <CardDescription className="text-sm">
                Dashboard con ingresos, estudiantes activos, cobros automáticos y reportes en tiempo real
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-base md:text-lg">2. Marketplace Potente</CardTitle>
              <CardDescription className="text-sm">
                Tu academia visible para 15.000+ padres buscando escuelas cada mes. Sin pagar publicidad.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-base md:text-lg">3. Monetización Automática</CardTitle>
              <CardDescription className="text-sm">
                Cobros recurrentes, app para padres, tienda de uniformes. Todo incluido desde $79k/mes.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Main CTAs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* School Demo - PRIMARY */}
          <Card className="border-2 border-primary shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 rounded-full bg-primary mx-auto flex items-center justify-center mb-3">
                <School className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-xl md:text-2xl">🏫 Demo para Escuelas</CardTitle>
              <CardDescription className="text-sm md:text-base">
                Ver cómo gestionas tu academia y atraes alumnos automáticamente
              </CardDescription>
              <Badge className="mt-2" variant="default">Recomendado - 80% lo eligen</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Dashboard con $17.8M COP en ingresos mensuales</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>87 estudiantes activos con cobros automáticos</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Ver tu perfil en el marketplace</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
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
              <CardTitle className="text-xl md:text-2xl">👨‍👩‍👧 Demo para Padres</CardTitle>
              <CardDescription className="text-sm md:text-base">
                Ver cómo padres encuentran y reservan en tu escuela
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                  <span>Buscar entre 150+ escuelas certificadas</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                  <span>Filtros por deporte, edad, ubicación y precio</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                  <span>Ver reseñas y reservar clase de prueba</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
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
        <Card className="border mb-8 md:mb-12">
          <CardContent className="flex flex-col md:flex-row items-center justify-between p-4 md:p-6 gap-4">
            <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Play className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base md:text-lg truncate">¿Prefieres ver un video primero?</h3>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Tour guiado de 60 segundos explicando todo</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleVideoDemo} className="w-full md:w-auto">
              Ver Video Demo
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="mt-8 md:mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-center">
          <div>
            <div className="text-2xl md:text-3xl font-bold text-primary">150+</div>
            <div className="text-xs md:text-sm text-muted-foreground">Academias Registradas</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-primary">15K+</div>
            <div className="text-xs md:text-sm text-muted-foreground">Padres Buscando</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-primary">$180M</div>
            <div className="text-xs md:text-sm text-muted-foreground">COP en Matrículas</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-primary">98%</div>
            <div className="text-xs md:text-sm text-muted-foreground">Tasa de Cobro</div>
          </div>
        </div>
      </div>
    </div>
  );
}