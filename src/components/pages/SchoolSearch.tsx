import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MapPin, 
  Star, 
  Users, 
  Calendar,
  Search,
  Award,
  Clock,
  ArrowLeft,
  Building2,
  Trophy,
  Target,
  Zap,
  Heart,
  TrendingUp
} from "lucide-react";
import Logo from "@/components/Logo";

interface SchoolSearchProps {
  onNavigate: (page: string) => void;
}

const SchoolSearch = ({ onNavigate }: SchoolSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todas");
  const [ageFilter, setAgeFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");

  const schools = [
    {
      id: 1,
      name: "Academia Deportiva Elite",
      location: "Bogotá - Sede Norte",
      image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&auto=format&fit=crop",
      rating: 4.9,
      reviews: 245,
      students: 340,
      sports: ["Fútbol", "Baloncesto", "Natación", "Atletismo"],
      description: "Centro deportivo de alto rendimiento con instalaciones de primera clase y entrenadores certificados",
      programs: ["Escuelas Deportivas", "Alto Rendimiento", "Torneos"],
      ageGroups: ["Niños (4-12)", "Jóvenes (13-17)", "Adultos"],
      schedule: "Lun-Sáb 6:00 AM - 9:00 PM",
      price: "Desde $150.000/mes",
      certified: true,
      features: ["Piscina Olímpica", "Canchas Profesionales", "Gimnasio Completo", "Nutricionista"],
      category: "Multi-deporte"
    },
    {
      id: 2,
      name: "Club Deportivo Juventud",
      location: "Medellín - Poblado",
      image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&auto=format&fit=crop",
      rating: 4.7,
      reviews: 189,
      students: 280,
      sports: ["Fútbol", "Voleibol", "Tenis"],
      description: "Formación integral de jóvenes atletas con valores deportivos y disciplina",
      programs: ["Escuelas Deportivas", "Prácticas Libres", "Torneos Intercolegiales"],
      ageGroups: ["Niños (6-12)", "Jóvenes (13-17)"],
      schedule: "Lun-Vie 3:00 PM - 8:00 PM, Sáb 8:00 AM - 2:00 PM",
      price: "Desde $120.000/mes",
      certified: true,
      features: ["3 Canchas de Fútbol", "2 Canchas de Tenis", "Vestuarios", "Cafetería"],
      category: "Fútbol"
    },
    {
      id: 3,
      name: "Centro Acuático Neptuno",
      location: "Cali - Sur",
      image: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&auto=format&fit=crop",
      rating: 4.8,
      reviews: 156,
      students: 220,
      sports: ["Natación", "Polo Acuático", "Clavados", "Aquagym"],
      description: "Especialistas en deportes acuáticos con piscina olímpica climatizada",
      programs: ["Escuelas Deportivas", "Terapéutico", "Alto Rendimiento", "Matronatación"],
      ageGroups: ["Bebés (6m-3años)", "Niños (4-12)", "Adultos", "Adultos Mayores", "Embarazadas"],
      schedule: "Todos los días 6:00 AM - 10:00 PM",
      price: "Desde $180.000/mes",
      certified: true,
      features: ["Piscina Olímpica 50m", "Piscina Infantil", "Sauna", "Hidromasaje"],
      category: "Natación"
    },
    {
      id: 4,
      name: "Academia de Artes Marciales Bushido",
      location: "Bucaramanga - Centro",
      image: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=400&auto=format&fit=crop",
      rating: 4.9,
      reviews: 203,
      students: 195,
      sports: ["Karate", "Taekwondo", "Judo", "Kickboxing"],
      description: "Formación en disciplina, respeto y técnicas de artes marciales tradicionales",
      programs: ["Escuelas Deportivas", "Defensa Personal", "Competencia"],
      ageGroups: ["Niños (5-12)", "Jóvenes (13-17)", "Adultos"],
      schedule: "Lun-Vie 4:00 PM - 9:00 PM",
      price: "Desde $130.000/mes",
      certified: true,
      features: ["Tatami Profesional", "Equipamiento Completo", "Entrenadores Cinturón Negro"],
      category: "Artes Marciales"
    },
    {
      id: 5,
      name: "Escuela de Tenis Pro",
      location: "Cartagena - Manga",
      image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&auto=format&fit=crop",
      rating: 4.6,
      reviews: 134,
      students: 150,
      sports: ["Tenis", "Pádel"],
      description: "Entrenamiento profesional con canchas de arcilla y césped sintético",
      programs: ["Escuelas Deportivas", "Clases Personalizadas", "Alto Rendimiento"],
      ageGroups: ["Niños (5-12)", "Jóvenes (13-17)", "Adultos"],
      schedule: "Lun-Dom 7:00 AM - 9:00 PM",
      price: "Desde $200.000/mes",
      certified: false,
      features: ["6 Canchas de Tenis", "2 Canchas de Pádel", "Pro Shop", "Iluminación LED"],
      category: "Tenis"
    },
    {
      id: 6,
      name: "Gimnasio Olímpico Atlas",
      location: "Barranquilla - Norte",
      image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&auto=format&fit=crop",
      rating: 4.8,
      reviews: 178,
      students: 310,
      sports: ["Gimnasia", "Atletismo", "Crossfit", "Halterofilia"],
      description: "Gimnasio completo con programas para todas las edades y niveles de condición física",
      programs: ["Clases Grupales", "Entrenamiento Personalizado", "Alto Rendimiento"],
      ageGroups: ["Jóvenes (15+)", "Adultos", "Adultos Mayores"],
      schedule: "Lun-Dom 5:00 AM - 11:00 PM",
      price: "Desde $140.000/mes",
      certified: true,
      features: ["Zona Cardio", "Área de Pesas", "Clases Grupales", "Nutricionista Deportivo"],
      category: "Gimnasio"
    }
  ];

  const categories = ["Todas", "Multi-deporte", "Fútbol", "Natación", "Tenis", "Artes Marciales", "Gimnasio"];
  
  const filteredSchools = schools.filter(school => {
    const matchesSearch = school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         school.sports.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         school.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "Todas" || school.category === activeCategory;
    const matchesAge = ageFilter === "all" || school.ageGroups.some(age => age.toLowerCase().includes(ageFilter.toLowerCase()));
    const matchesProgram = programFilter === "all" || school.programs.some(prog => prog.toLowerCase().includes(programFilter.toLowerCase()));
    return matchesSearch && matchesCategory && matchesAge && matchesProgram;
  });

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
              <button className="font-medium text-primary">
                Explorar
              </button>
              <button 
                className="font-medium hover:text-primary transition-colors"
                onClick={() => onNavigate("shop")}
              >
                Tienda
              </button>
              <button 
                className="font-medium hover:text-primary transition-colors"
                onClick={() => onNavigate("wellness")}
              >
                Bienestar
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
            <Building2 className="h-10 w-10 text-primary" />
            Escuelas y Academias Deportivas
          </h1>
          <p className="text-lg text-muted-foreground">
            Encuentra el programa deportivo perfecto para todas las edades
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{schools.length}+</p>
                <p className="text-sm text-muted-foreground">Escuelas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Users className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">5,000+</p>
                <p className="text-sm text-muted-foreground">Estudiantes</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Trophy className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">25+</p>
                <p className="text-sm text-muted-foreground">Deportes</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Star className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">4.8</p>
                <p className="text-sm text-muted-foreground">Rating</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, deporte o ubicación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 py-6 text-lg"
          />
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Filtrar por Edad</label>
                <Select value={ageFilter} onValueChange={setAgeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las edades" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background">
                    <SelectItem value="all">Todas las edades</SelectItem>
                    <SelectItem value="bebés">Bebés (0-3 años)</SelectItem>
                    <SelectItem value="niños">Niños (4-12 años)</SelectItem>
                    <SelectItem value="jóvenes">Jóvenes (13-17 años)</SelectItem>
                    <SelectItem value="adultos">Adultos (18-59 años)</SelectItem>
                    <SelectItem value="adultos mayores">Adultos Mayores (60+)</SelectItem>
                    <SelectItem value="embarazadas">Embarazadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Tipo de Programa</label>
                <Select value={programFilter} onValueChange={setProgramFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los programas" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background">
                    <SelectItem value="all">Todos los programas</SelectItem>
                    <SelectItem value="escuelas">Escuelas Deportivas</SelectItem>
                    <SelectItem value="prácticas">Prácticas Libres</SelectItem>
                    <SelectItem value="alto rendimiento">Alto Rendimiento</SelectItem>
                    <SelectItem value="torneos">Torneos</SelectItem>
                    <SelectItem value="personalizado">Entrenamiento Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-8">
          <TabsList className="flex-wrap h-auto gap-2 bg-muted/50 p-2">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="flex-1 min-w-[100px]">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-muted-foreground">
            Mostrando <span className="font-semibold text-foreground">{filteredSchools.length}</span> escuelas disponibles
          </p>
        </div>

        {/* Schools Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {filteredSchools.map((school) => (
            <Card key={school.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="relative">
                <div 
                  className="h-48 bg-cover bg-center"
                  style={{ backgroundImage: `url(${school.image})` }}
                />
                {school.certified && (
                  <Badge className="absolute top-3 right-3 bg-green-500/90 text-white">
                    <Award className="h-3 w-3 mr-1" />
                    Certificada
                  </Badge>
                )}
              </div>
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-2xl font-bold mb-2">{school.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    {school.location}
                  </div>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-semibold">{school.rating}</span>
                      <span className="text-sm text-muted-foreground">({school.reviews})</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      <span>{school.students} estudiantes</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{school.description}</p>
                  
                  {/* Sports Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {school.sports.map((sport, index) => (
                      <Badge key={index} variant="secondary" className="bg-primary/10 text-primary">
                        {sport}
                      </Badge>
                    ))}
                  </div>

                  {/* Programs */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Programas:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {school.programs.map((prog, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {prog}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Age Groups */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Edades:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {school.ageGroups.map((age, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {age}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <span>{school.schedule}</span>
                  </div>

                  {/* Features */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {school.features.slice(0, 4).map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Zap className="h-3 w-3 text-primary" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Desde</p>
                    <p className="font-bold text-lg text-primary">{school.price}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Calendar className="h-4 w-4 mr-2" />
                      Agendar
                    </Button>
                    <Button size="sm">
                      Ver Detalles
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-12 text-center">
            <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-3xl font-bold mb-3">¿Diriges una escuela o academia?</h3>
            <p className="text-muted-foreground mb-6 text-lg max-w-2xl mx-auto">
              Únete a SportMaps y conecta con miles de estudiantes buscando programas deportivos de calidad
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" onClick={() => onNavigate("register")}>
                Registrar mi Escuela
              </Button>
              <Button size="lg" variant="outline">
                <TrendingUp className="h-5 w-5 mr-2" />
                Ver Beneficios
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SchoolSearch;
