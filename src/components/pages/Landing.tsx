import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Zap, 
  Users, 
  TrendingUp, 
  Trophy,
  Heart,
  ShoppingBag,
  Dumbbell,
  School,
  Target,
  Calendar,
  Star,
  Activity,
  Baby,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import heroImage from "@/assets/hero-sportsmaps.jpg";

interface LandingProps {
  onNavigate: (page: string) => void;
}

const Landing = ({ onNavigate }: LandingProps) => {
  const services = [
    {
      icon: School,
      title: "Escuelas Deportivas",
      description: "Programas para todas las edades desde bebés hasta adultos mayores",
      features: ["Fútbol", "Natación", "Tenis", "Baloncesto", "Artes Marciales", "+20 disciplinas"],
      color: "primary",
      action: () => onNavigate("schoolsearch")
    },
    {
      icon: ShoppingBag,
      title: "Tienda Deportiva",
      description: "Equipamiento profesional de marcas reconocidas",
      features: ["Calzado", "Ropa", "Tecnología", "Suplementos", "Accesorios"],
      color: "secondary",
      action: () => onNavigate("shop")
    },
    {
      icon: Heart,
      title: "Bienestar y Salud",
      description: "Servicios especializados para tu recuperación y rendimiento",
      features: ["Fisioterapia", "Nutrición", "Psicología", "Recuperación", "Masajes"],
      color: "accent",
      action: () => onNavigate("wellness")
    }
  ];

  const programs = [
    {
      icon: GraduationCap,
      title: "Escuelas Deportivas",
      description: "Formación integral para todas las edades con entrenadores certificados",
      age: "Desde 6 meses"
    },
    {
      icon: Dumbbell,
      title: "Prácticas Libres",
      description: "Acceso a instalaciones deportivas de primer nivel",
      age: "Todas las edades"
    },
    {
      icon: Trophy,
      title: "Alto Rendimiento",
      description: "Programas competitivos para atletas avanzados",
      age: "Juvenil y Adultos"
    },
    {
      icon: Target,
      title: "Torneos",
      description: "Competencias intercolegiales y empresariales",
      age: "Todas las categorías"
    }
  ];

  const ageGroups = [
    { icon: Baby, label: "Bebés", range: "6m - 3 años", programs: "Matronatación, Motricidad" },
    { icon: Users, label: "Niños", range: "4 - 12 años", programs: "14 escuelas deportivas" },
    { icon: GraduationCap, label: "Jóvenes", range: "13 - 17 años", programs: "Alto rendimiento" },
    { icon: Activity, label: "Adultos", range: "18 - 59 años", programs: "Gimnasio, Clases grupales" },
    { icon: Heart, label: "Adultos Mayores", range: "60+ años", programs: "Actividad física adaptada" },
    { icon: Sparkles, label: "Embarazadas", range: "Prenatal", programs: "Yoga, Natación" }
  ];

  const stats = [
    { number: "150+", label: "Escuelas Certificadas" },
    { number: "5,000+", label: "Atletas Activos" },
    { number: "25+", label: "Disciplinas Deportivas" },
    { number: "4.8", label: "Rating Promedio" }
  ];

  const benefits = [
    "Instalaciones de última generación",
    "Entrenadores certificados",
    "Programas para todas las edades",
    "Atención personalizada",
    "Asesoría nutricional incluida",
    "Seguimiento de rendimiento"
  ];

  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="SportsMaps - Ecosistema Deportivo de Colombia"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
        </div>
        
        {/* Content */}
        <div className="container relative z-10 text-center px-4 py-20">
          <div className="max-w-5xl mx-auto">
            <Badge className="mb-6 bg-primary/10 text-primary hover:bg-primary/20 text-base px-4 py-2">
              El Ecosistema Deportivo de Colombia
            </Badge>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-foreground">
              Conectamos el{" "}
              <span className="bg-gradient-hero bg-clip-text text-transparent">
                deporte colombiano
              </span>
              {" "}en una sola plataforma
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              Escuelas deportivas, tienda especializada y servicios de bienestar. 
              Todo lo que necesitas para potenciar tu talento deportivo.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button 
                variant="hero" 
                size="xl" 
                className="min-w-[220px]"
                onClick={() => onNavigate("schoolsearch")}
              >
                <School className="w-5 h-5 mr-2" />
                Explorar Escuelas
              </Button>
              <Button 
                variant="elevation" 
                size="xl" 
                className="min-w-[220px]"
                onClick={() => onNavigate("register")}
              >
                <Zap className="w-5 h-5 mr-2" />
                Comenzar Gratis
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 bg-gradient-to-r from-primary/10 to-primary/5 border-y">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.number}</div>
                <div className="text-sm md:text-base text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Services */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20">
              Nuestros Servicios
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Todo lo que necesitas para tu{" "}
              <span className="bg-gradient-hero bg-clip-text text-transparent">
                desarrollo deportivo
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Desde escuelas deportivas hasta equipamiento profesional y servicios de bienestar
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Card 
                  key={index} 
                  className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer border-2 hover:border-primary/50"
                  onClick={service.action}
                >
                  <CardContent className="p-8">
                    <div className={`w-16 h-16 rounded-2xl bg-${service.color}/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-8 h-8 text-${service.color}`} />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{service.title}</h3>
                    <p className="text-muted-foreground mb-6">{service.description}</p>
                    <div className="space-y-2 mb-6">
                      {service.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
                      Explorar
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section className="py-20 bg-gradient-elevation">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-secondary/10 text-secondary hover:bg-secondary/20">
              Programas Deportivos
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Encuentra el programa perfecto para ti
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Desde iniciación hasta alto rendimiento, tenemos opciones para cada nivel
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {programs.map((program, index) => {
              const Icon = program.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-all hover:-translate-y-1">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{program.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{program.description}</p>
                    <Badge variant="outline" className="text-xs">
                      {program.age}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Age Groups Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-accent/10 text-accent hover:bg-accent/20">
              Para Todas las Edades
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Actividades deportivas para cada etapa de la vida
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Programas especializados desde bebés hasta adultos mayores
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ageGroups.map((group, index) => {
              const Icon = group.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-all hover:border-primary/50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-1">{group.label}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{group.range}</p>
                        <p className="text-sm font-medium text-primary">{group.programs}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20">
                ¿Por qué SportMaps?
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                La plataforma más completa para el deporte en Colombia
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Conectamos atletas, escuelas, tiendas y profesionales de la salud en un solo ecosistema deportivo.
              </p>
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={() => onNavigate("schoolsearch")}>
                  <School className="w-5 h-5 mr-2" />
                  Explorar Escuelas
                </Button>
                <Button size="lg" variant="outline" onClick={() => onNavigate("register")}>
                  Registrarme Gratis
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-6">
                  <Trophy className="w-10 h-10 text-primary mb-3" />
                  <h4 className="font-bold text-2xl mb-1">150+</h4>
                  <p className="text-sm text-muted-foreground">Escuelas Certificadas</p>
                </Card>
                <Card className="p-6 mt-8">
                  <Star className="w-10 h-10 text-yellow-500 mb-3" />
                  <h4 className="font-bold text-2xl mb-1">4.8/5</h4>
                  <p className="text-sm text-muted-foreground">Satisfacción</p>
                </Card>
                <Card className="p-6">
                  <Users className="w-10 h-10 text-secondary mb-3" />
                  <h4 className="font-bold text-2xl mb-1">5,000+</h4>
                  <p className="text-sm text-muted-foreground">Atletas Activos</p>
                </Card>
                <Card className="p-6 mt-8">
                  <Activity className="w-10 h-10 text-accent mb-3" />
                  <h4 className="font-bold text-2xl mb-1">25+</h4>
                  <p className="text-sm text-muted-foreground">Disciplinas</p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-hero">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="bg-background/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20">
            <Sparkles className="w-16 h-16 text-white mx-auto mb-6" />
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              ¿Listo para comenzar tu viaje deportivo?
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Únete a miles de deportistas, padres y escuelas que ya están transformando 
              el deporte en Colombia con SportMaps.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="elevation" 
                size="xl" 
                className="bg-white text-foreground hover:bg-white/90"
                onClick={() => onNavigate("register")}
              >
                <Calendar className="w-5 h-5 mr-2" />
                Comenzar Ahora
              </Button>
              <Button 
                variant="outline" 
                size="xl" 
                className="border-white text-white hover:bg-white/10"
                onClick={() => onNavigate("explore")}
              >
                <MapPin className="w-5 h-5 mr-2" />
                Ver Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Info */}
      <section className="py-12 bg-muted/30 border-t">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <h4 className="font-bold mb-2">Soporte 24/7</h4>
              <p className="text-sm text-muted-foreground">Estamos aquí para ayudarte en cualquier momento</p>
            </div>
            <div>
              <h4 className="font-bold mb-2">Pagos Seguros</h4>
              <p className="text-sm text-muted-foreground">Todas las transacciones son 100% seguras</p>
            </div>
            <div>
              <h4 className="font-bold mb-2">Garantía de Calidad</h4>
              <p className="text-sm text-muted-foreground">Escuelas y proveedores verificados</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
