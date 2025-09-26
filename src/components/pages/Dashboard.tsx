import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Logo from "@/components/Logo";
import { 
  Calendar, 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Trophy,
  Clock,
  MapPin,
  Star
} from "lucide-react";

interface DashboardProps {
  onNavigate: (page: string) => void;
}

const Dashboard = ({ onNavigate }: DashboardProps) => {
  const upcomingActivities = [
    {
      id: 1,
      title: "Clase de Fútbol Sub-12",
      time: "Mañana 9:00–10:30",
      image: "https://images.unsplash.com/photo-1552667466-07770ae110d0?q=80&w=1200&auto=format&fit=crop",
      tags: ["Fútbol", "Sub-12"]
    },
    {
      id: 2,
      title: "Entrenamiento de Baloncesto",
      time: "Miércoles 4:00–5:30",
      image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1200&auto=format&fit=crop",
      tags: ["Baloncesto", "Sub-15"]
    }
  ];

  const recommendations = [
    { icon: Users, title: "Fútbol Avanzado", color: "text-primary" },
    { icon: Trophy, title: "Yoga", color: "text-primary" },
    { icon: TrendingUp, title: "Atletismo", color: "text-primary" },
    { icon: ShoppingBag, title: "Equipamiento", color: "text-primary" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <button 
                className="flex items-center gap-3 text-xl font-bold hover:opacity-80 transition-opacity"
                onClick={() => onNavigate("landing")}
              >
                <Logo size="md" />
                <span>SportMaps</span>
              </button>
              
              <nav className="hidden md:flex items-center gap-6">
                <button className="font-medium text-primary">Inicio</button>
                <button 
                  className="font-medium hover:text-primary transition-colors"
                  onClick={() => onNavigate("explore")}
                >
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
            
            <div 
              className="w-10 h-10 rounded-full bg-cover bg-center cursor-pointer ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop')" }}
              onClick={() => onNavigate("profile")}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-3xl font-bold mb-8 text-foreground">¡Hola, Sofia! 👋</h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-card transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-primary" />
                <p className="text-sm text-muted-foreground">Próxima actividad</p>
              </div>
              <p className="font-semibold text-foreground">Clase de Fútbol Sub-12</p>
              <p className="text-sm text-primary">Mañana 9:00–10:30</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-card transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-primary" />
                <p className="text-sm text-muted-foreground">Eventos esta semana</p>
              </div>
              <p className="font-semibold text-foreground">3 actividades</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-card transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Star className="w-5 h-5 text-primary" />
                <p className="text-sm text-muted-foreground">Puntos SportMaps</p>
              </div>
              <p className="font-semibold text-foreground">1,250</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Upcoming Activities */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {upcomingActivities.map((activity) => (
            <Card key={activity.id} className="overflow-hidden hover:shadow-card transition-shadow">
              <div 
                className="h-44 bg-cover bg-center"
                style={{ backgroundImage: `url(${activity.image})` }}
              />
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-1">{activity.title}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-primary" />
                  <p className="text-sm text-primary">{activity.time}</p>
                </div>
                <div className="flex gap-2">
                  {activity.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="bg-primary/10 text-primary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Recommendations */}
        <Card className="hover:shadow-card transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Recomendaciones para ti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {recommendations.map((rec, index) => {
                const Icon = rec.icon;
                return (
                  <div key={index} className="text-center group cursor-pointer">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                      <Icon className={`w-8 h-8 ${rec.color}`} />
                    </div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {rec.title}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Button 
            variant="hero" 
            onClick={() => onNavigate("explore")}
          >
            <MapPin className="w-4 h-4 mr-2" />
            Explorar más clases
          </Button>
          <Button 
            variant="outline"
            onClick={() => onNavigate("shop")}
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            Ir a la tienda
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;