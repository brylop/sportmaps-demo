import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  GraduationCap, 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  Apple, 
  Shield, 
  Zap,
  Target
} from "lucide-react";

interface EcosystemProps {
  onNavigate: (page: string) => void;
}

const Ecosystem = ({ onNavigate }: EcosystemProps) => {
  const mainModules = [
    {
      icon: GraduationCap,
      title: "Escuelas & Entrenadores",
      description: "Calendario, reservas, asistentes y liquidaciones.",
      actions: [
        { label: "Crear cuenta", action: () => onNavigate("register") },
        { label: "Buscar clases", action: () => onNavigate("explore") }
      ]
    },
    {
      icon: ShoppingCart,
      title: "Tienda",
      description: "Carrito, checkout y seguimiento de pedidos.",
      actions: [
        { label: "Abrir tienda", action: () => onNavigate("shop") }
      ]
    },
    {
      icon: TrendingUp,
      title: "Bienestar",
      description: "KPIs de rendimiento, hábitos y recomendaciones.",
      actions: [
        { label: "Ver panel", action: () => onNavigate("wellness") }
      ]
    }
  ];

  const complementaryModules = [
    {
      title: "Tienda",
      description: "Catálogo, variantes, promociones, pasarela de pagos y factura electrónica.",
      icon: ShoppingCart
    },
    {
      title: "Nutrición",
      description: "Planes, suscripciones mensuales y recomendación según disciplina y edad.",
      icon: Apple
    },
    {
      title: "Bienestar",
      description: "Integración con wearables (futuro), seguimiento de sueño y carga.",
      icon: Shield
    },
    {
      title: "Inversión",
      description: "Marketplace de becas y patrocinios para talento juvenil.",
      icon: Target
    },
    {
      title: "Únete",
      description: "Convocatorias para aliados, escuelas y marcas verificados.",
      icon: Users
    }
  ];

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Ecosistema Integrado
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Un solo login, datos compartidos y pagos integrados entre módulos. 
            La plataforma completa para el deporte colombiano.
          </p>
        </div>

        {/* Main Modules */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {mainModules.map((module, index) => {
            const Icon = module.icon;
            return (
              <Card key={index} className="hover:shadow-elevation transition-all duration-300 hover:-translate-y-2">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl">{module.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {module.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {module.actions.map((action, actionIndex) => (
                      <Button
                        key={actionIndex}
                        variant="outline"
                        size="sm"
                        onClick={action.action}
                        className="text-xs"
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Integration Benefits */}
        <div className="bg-gradient-elevation rounded-2xl p-8 mb-16">
          <div className="text-center mb-8">
            <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Integración Total
            </h2>
            <p className="text-muted-foreground">
              Todos los módulos comparten información y simplifican la experiencia
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Un Solo Perfil</h3>
              <p className="text-sm text-muted-foreground">
                Información compartida entre todas las funcionalidades
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Pagos Unificados</h3>
              <p className="text-sm text-muted-foreground">
                Un solo método de pago para clases, tienda y servicios
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Datos Inteligentes</h3>
              <p className="text-sm text-muted-foreground">
                Recomendaciones basadas en tu actividad completa
              </p>
            </div>
          </div>
        </div>

        {/* Complementary Modules */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">
            Módulos Complementarios
          </h2>
          <div className="grid lg:grid-cols-5 md:grid-cols-3 gap-4">
            {complementaryModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <Card key={index} className="hover:shadow-card transition-shadow">
                  <CardContent className="p-5">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold mb-2">{module.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {module.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-hero rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-primary-foreground mb-4">
            ¿Listo para ser parte del ecosistema?
          </h2>
          <p className="text-primary-foreground/90 mb-6 max-w-xl mx-auto">
            Únete a la plataforma que está transformando el deporte en Colombia. 
            Acceso completo a todos los módulos desde el primer día.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="elevation" 
              size="lg"
              className="bg-background text-foreground hover:bg-background/90"
              onClick={() => onNavigate("register")}
            >
              Comenzar Gratis
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
              onClick={() => onNavigate("explore")}
            >
              Explorar Primero
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ecosystem;