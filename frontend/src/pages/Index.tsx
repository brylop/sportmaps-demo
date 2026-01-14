import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Trophy, ArrowRight, Users, Building2, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Index() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/explore?search=${encodeURIComponent(searchTerm)}`);
    } else {
      navigate('/explore');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary/90 to-blue-900 text-white py-24 lg:py-32 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-4 py-1 mb-4">
              🏆 La plataforma #1 de deportes
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              Tu pasión deportiva <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300">
                comienza aquí
              </span>
            </h1>
            
            <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
              Encuentra las mejores escuelas, reserva canchas y únete a programas deportivos cerca de ti. Gestiona todo en un solo lugar.
            </p>

            {/* Main Search Form */}
            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
              <div className="relative group">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-xl group-hover:bg-white/30 transition-all duration-500" />
                <div className="relative flex items-center bg-white rounded-full shadow-2xl p-2 pr-2">
                  <Search className="w-6 h-6 text-muted-foreground ml-4 shrink-0" />
                  <Input 
                    className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-black placeholder:text-muted-foreground text-lg h-14"
                    placeholder="¿Qué deporte quieres practicar hoy?"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Button size="lg" className="rounded-full px-8 h-12 text-base font-semibold shadow-lg hover:scale-105 transition-transform">
                    Buscar
                  </Button>
                </div>
              </div>
            </form>

            {/* Quick tags */}
            <div className="flex flex-wrap justify-center gap-2 text-sm text-blue-100 pt-4">
              <span>Populares:</span>
              {['Fútbol', 'Natación', 'Tenis', 'Baloncesto'].map(sport => (
                <button 
                  key={sport}
                  onClick={() => navigate(`/explore?sport=${sport}`)}
                  className="hover:text-white hover:underline underline-offset-4 transition-colors"
                >
                  {sport}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="group hover:shadow-lg transition-all duration-300 border-none shadow-md bg-background/50 backdrop-blur-sm">
              <CardContent className="p-8 space-y-4 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300 text-blue-600">
                  <MapPin className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold">Encuentra Cerca</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Explora escuelas y centros deportivos en tu zona. Filtra por ubicación, precio y valoraciones reales.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-none shadow-md bg-background/50 backdrop-blur-sm">
              <CardContent className="p-8 space-y-4 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300 text-green-600">
                  <Calendar className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold">Reserva Fácil</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Inscríbete a clases o reserva canchas en segundos. Todo sincronizado con tu calendario personal.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-none shadow-md bg-background/50 backdrop-blur-sm">
              <CardContent className="p-8 space-y-4 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300 text-purple-600">
                  <Trophy className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold">Mejora tu Nivel</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Sigue tu progreso, recibe feedback de entrenadores y alcanza tus metas deportivas.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="bg-primary rounded-3xl p-8 md:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-white/10 to-transparent skew-x-12 transform origin-top-right" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-white space-y-4 max-w-xl">
                <h2 className="text-3xl md:text-4xl font-bold">¿Eres dueño de una escuela?</h2>
                <p className="text-blue-100 text-lg">
                  Únete a SportMaps para gestionar tus alumnos, pagos y reservas en un solo lugar. Digitaliza tu pasión.
                </p>
              </div>
              <Button 
                size="lg" 
                variant="secondary" 
                className="h-14 px-8 text-lg shadow-xl hover:scale-105 transition-transform"
                onClick={() => navigate('/register?role=school')}
              >
                Registrar mi Escuela
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}