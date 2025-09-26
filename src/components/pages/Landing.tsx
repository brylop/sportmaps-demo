import { Button } from "@/components/ui/button";
import { MapPin, Zap, Users, TrendingUp } from "lucide-react";

interface LandingProps {
  onNavigate: (page: string) => void;
}

const Landing = ({ onNavigate }: LandingProps) => {
  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
            El Ecosistema Deportivo de Colombia,{" "}
            <span className="bg-gradient-hero bg-clip-text text-transparent">
              en un solo lugar
            </span>
          </h1>
          <p className="text-lg md:text-xl mb-8 text-muted-foreground max-w-3xl mx-auto">
            Conectamos atletas, padres, entrenadores y escuelas para potenciar el talento 
            y facilitar el acceso al deporte profesional en toda Colombia.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center mb-16">
            <Button 
              variant="hero" 
              size="xl"
              onClick={() => onNavigate("explore")}
            >
              <Zap className="w-5 h-5" />
              Explorar Ahora
            </Button>
            <Button 
              variant="elevation" 
              size="xl"
              onClick={() => onNavigate("ecosystem")}
            >
              <MapPin className="w-5 h-5" />
              Ver Ecosistema
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">50K+</div>
              <div className="text-muted-foreground">Escuelas Verificadas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">15K+</div>
              <div className="text-muted-foreground">Atletas Activos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">2.5M+</div>
              <div className="text-muted-foreground">Clases Programadas</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-20 bg-gradient-elevation">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Todo lo que necesitas en una plataforma
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Desde reservar clases hasta gestionar equipos, SportMaps integra 
              todas las herramientas que necesitas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card p-6 rounded-xl border hover:shadow-card transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Para Escuelas</h3>
              <p className="text-muted-foreground mb-4">
                Gestiona entrenadores, horarios, pagos y comunicación con padres.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onNavigate("register")}
              >
                Crear cuenta
              </Button>
            </div>

            <div className="bg-card p-6 rounded-xl border hover:shadow-card transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Para Padres</h3>
              <p className="text-muted-foreground mb-4">
                Encuentra las mejores clases, reserva y sigue el progreso de tus hijos.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onNavigate("explore")}
              >
                Buscar clases
              </Button>
            </div>

            <div className="bg-card p-6 rounded-xl border hover:shadow-card transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Para Atletas</h3>
              <p className="text-muted-foreground mb-4">
                Accede a tienda especializada, nutrición y seguimiento de rendimiento.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onNavigate("register")}
              >
                Ver panel
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
            ¿Listo para formar parte del ecosistema?
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Únete a miles de deportistas, padres y escuelas que ya están transformando 
            el deporte en Colombia.
          </p>
          <Button 
            variant="elevation" 
            size="xl" 
            className="bg-background text-foreground hover:bg-background/90"
            onClick={() => onNavigate("register")}
          >
            Comenzar Ahora
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Landing;