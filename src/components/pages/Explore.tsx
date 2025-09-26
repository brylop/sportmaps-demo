import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Star, Calendar } from "lucide-react";
import Logo from "@/components/Logo";

interface ExploreProps {
  onNavigate: (page: string) => void;
}

const Explore = ({ onNavigate }: ExploreProps) => {
  const [filters, setFilters] = useState({
    sport: "all",
    location: "",
    age: "all",
    price: "all"
  });

  const searchResults = [
    {
      id: 1,
      title: "Academia de Fútbol Juvenil",
      instructor: "Carlos Valderrama",
      rating: 4.8,
      reviews: 124,
      description: "Clases para niños y jóvenes de 6 a 17 años. Entrenamientos técnicos y tácticos con metodología europea.",
      price: 45000,
      image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2000&auto=format&fit=crop",
      tags: ["Fútbol", "Sub-12", "Bogotá"],
      location: "Bogotá"
    },
    {
      id: 2,
      title: "Escuela de Baloncesto Elite",
      instructor: "Juan Pablo Ángel",
      rating: 4.9,
      reviews: 98,
      description: "Programa de desarrollo de habilidades para jóvenes talentos. Entrenamientos intensivos y seguimiento personalizado.",
      price: 55000,
      image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=2000&auto=format&fit=crop",
      tags: ["Baloncesto", "Sub-15", "Medellín"],
      location: "Medellín"
    },
    {
      id: 3,
      title: "Yoga y Mindfulness Deportivo",
      instructor: "Ana María García",
      rating: 4.7,
      reviews: 156,
      description: "Sesiones de yoga especializadas para atletas. Mejora tu flexibilidad, concentración y recuperación.",
      price: 35000,
      image: "https://images.unsplash.com/photo-1506629905607-d7d39e2ee9bb?q=80&w=2000&auto=format&fit=crop",
      tags: ["Yoga", "Mindfulness", "Cali"],
      location: "Cali"
    }
  ];

  return (
    <div className="min-h-screen bg-background-dark text-text-dark-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-sm border-b border-secondary">
        <div className="container mx-auto px-4">
          <div className="flex h-20 items-center justify-between">
            <button 
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              onClick={() => onNavigate("landing")}
            >
              <Logo size="md" />
              <h1 className="text-xl font-bold">SportMaps</h1>
            </button>
            <div className="flex items-center gap-3">
              <Button 
                variant="hero" 
                size="sm"
                onClick={() => onNavigate("register")}
              >
                Registrarse
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => onNavigate("login")}
              >
                Iniciar sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10">
        <div className="grid lg:grid-cols-4 gap-10">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <h2 className="text-xl font-bold mb-6">Filtros</h2>
            <div className="space-y-6">
              <div>
                <Label className="text-sm text-text-dark-secondary mb-2 block">Deporte</Label>
                <Select value={filters.sport} onValueChange={(value) => setFilters(prev => ({ ...prev, sport: value }))}>
                  <SelectTrigger className="w-full bg-secondary border-none text-text-dark-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="football">Fútbol</SelectItem>
                    <SelectItem value="basketball">Baloncesto</SelectItem>
                    <SelectItem value="yoga">Yoga</SelectItem>
                    <SelectItem value="athletics">Atletismo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-text-dark-secondary mb-2 block">Ubicación</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dark-secondary" />
                  <Input
                    placeholder="Bogotá, Colombia"
                    value={filters.location}
                    onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                    className="pl-10 bg-secondary border-none text-text-dark-primary"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm text-text-dark-secondary mb-2 block">Edad</Label>
                <Select value={filters.age} onValueChange={(value) => setFilters(prev => ({ ...prev, age: value }))}>
                  <SelectTrigger className="w-full bg-secondary border-none text-text-dark-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="4-7">4-7 años</SelectItem>
                    <SelectItem value="8-12">8-12 años</SelectItem>
                    <SelectItem value="13-17">13-17 años</SelectItem>
                    <SelectItem value="adults">Adultos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-text-dark-secondary mb-2 block">Precio</Label>
                <Select value={filters.price} onValueChange={(value) => setFilters(prev => ({ ...prev, price: value }))}>
                  <SelectTrigger className="w-full bg-secondary border-none text-text-dark-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="0-30">Hasta $30.000</SelectItem>
                    <SelectItem value="30-60">$30.000 - $60.000</SelectItem>
                    <SelectItem value="60-100">$60.000 - $100.000</SelectItem>
                    <SelectItem value="100+">Más de $100.000</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="hero" size="lg" className="w-full">
                Aplicar Filtros
              </Button>
            </div>
          </aside>

          {/* Results */}
          <section className="lg:col-span-3">
            <h2 className="text-2xl font-bold mb-6">Resultados para "Clases de Deporte"</h2>
            <div className="space-y-6">
              {searchResults.map((result) => (
                <Card key={result.id} className="bg-secondary border-none hover:shadow-performance transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div 
                        className="w-full md:w-1/3 h-48 bg-cover bg-center rounded-t-lg md:rounded-l-lg md:rounded-t-none"
                        style={{ backgroundImage: `url(${result.image})` }}
                      />
                      <div className="flex-1 p-6 flex flex-col justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-text-dark-primary mb-1">{result.title}</h3>
                          <p className="text-sm text-text-dark-secondary mb-2">
                            con <span className="text-text-dark-primary font-medium">{result.instructor}</span>
                          </p>
                          <div className="flex items-center gap-2 mb-3">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-text-dark-primary">
                              {result.rating} ({result.reviews} reseñas)
                            </span>
                          </div>
                          <p className="text-sm text-text-dark-secondary mb-4 leading-relaxed">
                            {result.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {result.tags.map((tag, index) => (
                              <Badge 
                                key={index} 
                                className="bg-primary/20 text-primary border-none"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-lg font-bold text-text-dark-primary">
                              ${result.price.toLocaleString()}
                              <span className="text-sm font-normal text-text-dark-secondary">/sesión</span>
                            </p>
                          </div>
                          <Button variant="hero" size="lg">
                            <Calendar className="w-4 h-4 mr-2" />
                            Ver disponibilidad
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Explore;