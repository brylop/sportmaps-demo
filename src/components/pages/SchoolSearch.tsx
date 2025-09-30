import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MapPin, 
  Star, 
  Users, 
  Calendar,
  Search,
  Filter,
  GraduationCap,
  Award,
  Clock,
  ArrowLeft,
  Building2
} from "lucide-react";
import Logo from "@/components/Logo";

interface SchoolSearchProps {
  onNavigate: (page: string) => void;
}

const SchoolSearch = ({ onNavigate }: SchoolSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  const schools = [
    {
      id: 1,
      name: "Academia Deportiva Elite",
      location: "Bogotá, Colombia",
      image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&auto=format&fit=crop",
      rating: 4.9,
      reviews: 245,
      students: 340,
      sports: ["Fútbol", "Baloncesto", "Natación", "Atletismo"],
      description: "Centro deportivo de alto rendimiento con instalaciones de primera clase",
      programs: 18,
      price: "Desde $150.000/mes",
      certified: true
    },
    {
      id: 2,
      name: "Club Deportivo Juventud",
      location: "Medellín, Colombia",
      image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&auto=format&fit=crop",
      rating: 4.7,
      reviews: 189,
      students: 280,
      sports: ["Fútbol", "Voleibol", "Tenis"],
      description: "Formación integral de jóvenes atletas con valores deportivos",
      programs: 12,
      price: "Desde $120.000/mes",
      certified: true
    },
    {
      id: 3,
      name: "Centro Acuático Neptuno",
      location: "Cali, Colombia",
      image: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&auto=format&fit=crop",
      rating: 4.8,
      reviews: 156,
      students: 220,
      sports: ["Natación", "Polo Acuático", "Clavados"],
      description: "Especialistas en deportes acuáticos con piscina olímpica",
      programs: 8,
      price: "Desde $180.000/mes",
      certified: true
    },
    {
      id: 4,
      name: "Academia de Artes Marciales Bushido",
      location: "Bucaramanga, Colombia",
      image: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=400&auto=format&fit=crop",
      rating: 4.9,
      reviews: 203,
      students: 195,
      sports: ["Karate", "Taekwondo", "Judo", "Kickboxing"],
      description: "Formación en disciplina, respeto y técnicas de artes marciales",
      programs: 10,
      price: "Desde $130.000/mes",
      certified: true
    },
    {
      id: 5,
      name: "Escuela de Tenis Pro",
      location: "Cartagena, Colombia",
      image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&auto=format&fit=crop",
      rating: 4.6,
      reviews: 134,
      students: 150,
      sports: ["Tenis", "Pádel"],
      description: "Entrenamiento profesional con canchas de arcilla y césped",
      programs: 6,
      price: "Desde $200.000/mes",
      certified: false
    },
    {
      id: 6,
      name: "Gimnasio Olímpico Atlas",
      location: "Barranquilla, Colombia",
      image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&auto=format&fit=crop",
      rating: 4.8,
      reviews: 178,
      students: 310,
      sports: ["Gimnasia", "Atletismo", "Crossfit", "Halterofilia"],
      description: "Gimnasio completo con programas para todas las edades",
      programs: 15,
      price: "Desde $140.000/mes",
      certified: true
    }
  ];

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
            Buscar Escuelas y Academias
          </h1>
          <p className="text-lg text-muted-foreground">
            Encuentra la mejor escuela deportiva para ti o tus hijos
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, deporte o ubicación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={sportFilter} onValueChange={setSportFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Deporte" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background">
                    <SelectItem value="all">Todos los deportes</SelectItem>
                    <SelectItem value="futbol">Fútbol</SelectItem>
                    <SelectItem value="natacion">Natación</SelectItem>
                    <SelectItem value="baloncesto">Baloncesto</SelectItem>
                    <SelectItem value="tenis">Tenis</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ciudad" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background">
                    <SelectItem value="all">Todas las ciudades</SelectItem>
                    <SelectItem value="bogota">Bogotá</SelectItem>
                    <SelectItem value="medellin">Medellín</SelectItem>
                    <SelectItem value="cali">Cali</SelectItem>
                    <SelectItem value="barranquilla">Barranquilla</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-muted-foreground">
            Mostrando <span className="font-semibold text-foreground">{schools.length}</span> escuelas disponibles
          </p>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Más Filtros
          </Button>
        </div>

        {/* Schools Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {schools.map((school) => (
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <MapPin className="h-4 w-4" />
                    {school.location}
                  </div>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="font-semibold">{school.rating}</span>
                      <span className="text-sm text-muted-foreground">({school.reviews} reseñas)</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      <span>{school.students} estudiantes</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{school.description}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {school.sports.map((sport, index) => (
                      <Badge key={index} variant="secondary" className="bg-primary/10 text-primary">
                        {sport}
                      </Badge>
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
                      Agendar Visita
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

        {/* CTA */}
        <Card className="mt-12 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-8 text-center">
            <GraduationCap className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">¿Eres una escuela o academia?</h3>
            <p className="text-muted-foreground mb-6">
              Únete a SportMaps y conecta con miles de estudiantes
            </p>
            <Button size="lg" onClick={() => onNavigate("register")}>
              Registrar mi Escuela
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SchoolSearch;
