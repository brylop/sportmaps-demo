import Hero from "@/components/Hero";
import Features from "@/components/Features";
import TechSpecs from "@/components/TechSpecs";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <Features />
      <TechSpecs />
      
      {/* Footer CTA */}
      <section className="py-20 bg-gradient-hero">
        <div className="container px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
            ¿Listo para Redefinir tu Entrenamiento?
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Únete a la comunidad de atletas que han descubierto el futuro de la exploración deportiva.
          </p>
          <Button variant="elevation" size="xl" className="bg-background text-foreground hover:bg-background/90">
            <ArrowUp className="w-5 h-5" />
            Comenzar Ahora
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
