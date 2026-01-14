import { Button } from "@/components/ui/button";
import { MapPin, Zap, Users } from "lucide-react";
import heroImage from "@/assets/hero-sportsmaps.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img 
          src={heroImage} 
          alt="SportsMaps - Atleta corriendo en montaña con tecnología GPS"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      </div>
      
      {/* Content */}
      <div className="container relative z-10 text-center px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-hero bg-clip-text text-transparent">
            SportsMaps
          </h1>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-semibold text-foreground mb-4">
            El Ecosistema de la Exploración Deportiva
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Trasciende la simple cartografía. Descubre, planifica y redefine tu territorio de entrenamiento 
            con la precisión del <span className="text-primary font-semibold">GPS de élite</span> y el poder 
            de la <span className="text-secondary font-semibold">inteligencia colectiva</span>.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button variant="hero" size="xl" className="min-w-[200px]">
              <Zap className="w-5 h-5" />
              Iniciar Actividad
            </Button>
            <Button variant="orange" size="xl" className="min-w-[200px]">
              <MapPin className="w-5 h-5" />
              Explorar Rutas
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">50K+</div>
              <div className="text-muted-foreground">Rutas Verificadas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold bg-gradient-orange bg-clip-text text-transparent mb-2">120K+</div>
              <div className="text-muted-foreground">Atletas Activos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">300+</div>
              <div className="text-muted-foreground">Escuelas Deportivas</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;