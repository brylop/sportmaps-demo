import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCircle, GraduationCap, School, Heart, Store, ArrowLeft } from 'lucide-react';

interface DemoProfile {
  role: 'athlete' | 'parent' | 'coach' | 'school' | 'wellness_professional' | 'store_owner';
  name: string;
  description: string;
  email: string;
  icon: React.ReactNode;
  color: string;
}

const demoProfiles: DemoProfile[] = [
  {
    role: 'parent',
    name: 'Padre/Madre',
    description: 'Gestión familiar',
    email: 'maria.garcia@demo.sportmaps.com',
    icon: <Users className="w-8 h-8" />,
    color: 'bg-blue-500',
  },
  {
    role: 'coach',
    name: 'Entrenador',
    description: 'Clases y agenda',
    email: 'luis.rodriguez@demo.sportmaps.com',
    icon: <GraduationCap className="w-8 h-8" />,
    color: 'bg-emerald-500',
  },
  {
    role: 'school',
    name: 'Escuela',
    description: 'Gestión completa',
    email: 'academia.elite@demo.sportmaps.com',
    icon: <School className="w-8 h-8" />,
    color: 'bg-purple-500',
  },
  {
    role: 'athlete',
    name: 'Deportista',
    description: 'Perfil atlético',
    email: 'carlos.martinez@demo.sportmaps.com',
    icon: <UserCircle className="w-8 h-8" />,
    color: 'bg-orange-500',
  },
  {
    role: 'wellness_professional',
    name: 'Profesional de Bienestar',
    description: 'Salud y rendimiento',
    email: 'sofia.rivera@demo.sportmaps.com',
    icon: <Heart className="w-8 h-8" />,
    color: 'bg-pink-500',
  },
  {
    role: 'store_owner',
    name: 'Tienda/Vendedor',
    description: 'Productos deportivos',
    email: 'info.equipatemas@demo.sportmaps.com',
    icon: <Store className="w-8 h-8" />,
    color: 'bg-cyan-500',
  },
];

export default function DemoProfilesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link to="/login" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al login
          </Link>
        </div>

        <Card className="border-2">
          <CardContent className="p-6 md:p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Explorar Perfiles Demo</h1>
              <p className="text-muted-foreground">
                Selecciona un rol para ver su perfil y funcionalidades
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Contraseña para todas las cuentas: <code className="px-2 py-1 bg-muted rounded">SportMapsDemo2025!</code>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {demoProfiles.map((profile) => (
                <Card key={profile.role} className="hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="p-6 text-center">
                    <div className={`w-16 h-16 ${profile.color} rounded-full flex items-center justify-center mx-auto mb-4 text-white group-hover:scale-110 transition-transform`}>
                      {profile.icon}
                    </div>
                    <h3 className="font-bold text-lg mb-1">{profile.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{profile.description}</p>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground break-all">{profile.email}</p>
                      <Link to={`/login?demo=${profile.role}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          Probar Perfil
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">💡 Instrucciones de Uso</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Haz clic en "Probar Perfil" para auto-completar el formulario de login</li>
                <li>• Cada rol tiene diferentes permisos y funcionalidades</li>
                <li>• Puedes cambiar entre perfiles cerrando sesión y seleccionando otro</li>
                <li>• Todas las cuentas usan la misma contraseña para facilitar las pruebas</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
