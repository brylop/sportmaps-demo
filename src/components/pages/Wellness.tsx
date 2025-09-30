import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search,
  Heart,
  Star,
  Calendar,
  ArrowLeft,
  Stethoscope,
  Apple,
  Brain,
  Activity,
  Clock,
  MapPin,
  Award
} from "lucide-react";
import Logo from "@/components/Logo";

interface WellnessProps {
  onNavigate: (page: string) => void;
}

const Wellness = ({ onNavigate }: WellnessProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const services = [
    {
      id: 1,
      name: "Centro de Fisioterapia Deportiva",
      specialist: "Dr. Carlos Ramírez",
      speciality: "Fisioterapia",
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&auto=format&fit=crop",
      rating: 4.9,
      reviews: 234,
      price: "Desde $80.000",
      location: "Bogotá",
      description: "Rehabilitación deportiva, lesiones musculares y articulares",
      verified: true,
      category: "fisioterapia"
    },
    {
      id: 2,
      name: "Nutrición Deportiva Elite",
      specialist: "Dra. María González",
      speciality: "Nutrición",
      image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&auto=format&fit=crop",
      rating: 4.8,
      reviews: 189,
      price: "Desde $100.000",
      location: "Medellín",
      description: "Planes nutricionales personalizados para atletas",
      verified: true,
      category: "nutricion"
    },
    {
      id: 3,
      name: "Psicología Deportiva Performance",
      specialist: "Dr. Andrés López",
      speciality: "Psicología",
      image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&auto=format&fit=crop",
      rating: 4.9,
      reviews: 156,
      price: "Desde $120.000",
      location: "Cali",
      description: "Coaching mental, manejo de presión y concentración",
      verified: true,
      category: "psicologia"
    },
    {
      id: 4,
      name: "Recuperación Muscular Spa",
      specialist: "Equipo Wellness",
      speciality: "Recuperación",
      image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&auto=format&fit=crop",
      rating: 4.7,
      reviews: 298,
      price: "Desde $60.000",
      location: "Bogotá",
      description: "Masajes deportivos, crioterapia y sauna",
      verified: true,
      category: "recuperacion"
    },
    {
      id: 5,
      name: "Clínica de Medicina Deportiva",
      specialist: "Dr. Juan Pérez",
      speciality: "Medicina Deportiva",
      image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&auto=format&fit=crop",
      rating: 4.9,
      reviews: 345,
      price: "Desde $150.000",
      location: "Barranquilla",
      description: "Evaluación médica, diagnóstico y tratamiento de lesiones",
      verified: true,
      category: "medicina"
    },
    {
      id: 6,
      name: "Yoga y Mindfulness para Atletas",
      specialist: "Ana María Díaz",
      speciality: "Yoga/Mindfulness",
      image: "https://images.unsplash.com/photo-1506629905607-d7d39e2ee9bb?w=400&auto=format&fit=crop",
      rating: 4.8,
      reviews: 178,
      price: "Desde $50.000",
      location: "Cali",
      description: "Flexibilidad, concentración y recuperación mental",
      verified: false,
      category: "bienestar"
    }
  ];

  const filteredServices = activeTab === "all" 
    ? services 
    : services.filter(s => s.category === activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onNavigate("dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <button 
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                onClick={() => onNavigate("landing")}
              >
                <Logo size="md" />
                <h1 className="text-xl font-bold">SportMaps</h1>
              </button>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <button 
                className="font-medium hover:text-primary transition-colors"
                onClick={() => onNavigate("dashboard")}
              >
                Inicio
              </button>
              <button 
                className="font-medium hover:text-primary transition-colors"
                onClick={() => onNavigate("schoolsearch")}
              >
                Explorar
              </button>
              <button 
                className="font-medium hover:text-primary transition-colors"
                onClick={() => onNavigate("shop")}
              >
                Tienda
              </button>
              <button className="font-medium text-primary">
                Bienestar
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
            <Heart className="h-10 w-10 text-primary" />
            Centro de Bienestar Deportivo
          </h1>
          <p className="text-lg text-muted-foreground">
            Servicios de salud, nutrición y recuperación para deportistas
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Stethoscope className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">45+</p>
              <p className="text-sm text-muted-foreground">Especialistas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Activity className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">1,200+</p>
              <p className="text-sm text-muted-foreground">Pacientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Star className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">4.8</p>
              <p className="text-sm text-muted-foreground">Calificación</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Award className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">98%</p>
              <p className="text-sm text-muted-foreground">Satisfacción</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar especialistas, servicios o tratamientos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Todos
            </TabsTrigger>
            <TabsTrigger value="fisioterapia" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Fisioterapia
            </TabsTrigger>
            <TabsTrigger value="nutricion" className="flex items-center gap-2">
              <Apple className="h-4 w-4" />
              Nutrición
            </TabsTrigger>
            <TabsTrigger value="psicologia" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Psicología
            </TabsTrigger>
            <TabsTrigger value="recuperacion" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Recuperación
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {filteredServices.map((service) => (
            <Card key={service.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="relative">
                <div 
                  className="h-48 bg-cover bg-center"
                  style={{ backgroundImage: `url(${service.image})` }}
                />
                {service.verified && (
                  <Badge className="absolute top-3 right-3 bg-green-500/90 text-white">
                    <Award className="h-3 w-3 mr-1" />
                    Verificado
                  </Badge>
                )}
              </div>
              <CardContent className="p-6">
                <div className="mb-4">
                  <Badge variant="secondary" className="mb-2 bg-primary/10 text-primary">
                    {service.speciality}
                  </Badge>
                  <h3 className="text-xl font-bold mb-1">{service.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    con {service.specialist}
                  </p>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-semibold">{service.rating}</span>
                      <span className="text-sm text-muted-foreground">({service.reviews})</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {service.location}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{service.description}</p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Consulta</p>
                    <p className="font-bold text-lg text-primary">{service.price}</p>
                  </div>
                  <Button>
                    <Calendar className="h-4 w-4 mr-2" />
                    Agendar Cita
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-8 text-center">
            <Stethoscope className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">¿Eres profesional de la salud deportiva?</h3>
            <p className="text-muted-foreground mb-6">
              Únete a SportMaps y conecta con atletas que necesitan tus servicios
            </p>
            <Button size="lg" onClick={() => onNavigate("register")}>
              Registrar mis Servicios
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Wellness;
