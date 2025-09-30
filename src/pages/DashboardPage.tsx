import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Calendar, 
  Trophy, 
  BarChart3, 
  Clock, 
  Target,
  TrendingUp,
  Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PlayerDashboard = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-3xl font-bold tracking-tight">Mi Dashboard</h2>
      <p className="text-muted-foreground">
        Resumen de tu actividad deportiva
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Equipos Activos</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">2</div>
          <p className="text-xs text-muted-foreground">
            +1 desde el mes pasado
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Próximos Eventos</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">3</div>
          <p className="text-xs text-muted-foreground">
            Esta semana
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Partidos Jugados</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">12</div>
          <p className="text-xs text-muted-foreground">
            Este mes
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Asistencia</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">85%</div>
          <p className="text-xs text-muted-foreground">
            +2% desde el mes pasado
          </p>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Próximos Entrenamientos y Partidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-3 rounded-lg border">
              <div className="bg-primary/10 p-2 rounded-full">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Entrenamiento - Fútbol Sub-17</p>
                <p className="text-xs text-muted-foreground">Hoy, 4:00 PM - Cancha Principal</p>
              </div>
              <Button variant="outline" size="sm">Ver Detalles</Button>
            </div>
            
            <div className="flex items-center space-x-4 p-3 rounded-lg border">
              <div className="bg-orange-100 p-2 rounded-full">
                <Trophy className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Partido vs. Academia Deportiva</p>
                <p className="text-xs text-muted-foreground">Sábado, 10:00 AM - Estadio Norte</p>
              </div>
              <Button variant="outline" size="sm">Ver Detalles</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Estadísticas Recientes</CardTitle>
          <CardDescription>
            Tu rendimiento en los últimos 30 días
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Goles</span>
              <span className="text-sm font-medium">8</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Asistencias</span>
              <span className="text-sm font-medium">5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Minutos Jugados</span>
              <span className="text-sm font-medium">780</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Entrenamientos</span>
              <span className="text-sm font-medium">16/18</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

const CoachDashboard = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-3xl font-bold tracking-tight">Panel de Entrenador</h2>
      <p className="text-muted-foreground">
        Gestiona tus equipos y jugadores
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Equipos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">3</div>
          <p className="text-xs text-muted-foreground">
            Equipos activos
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Jugadores Totales</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">45</div>
          <p className="text-xs text-muted-foreground">
            Across all teams
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Próximos Eventos</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">8</div>
          <p className="text-xs text-muted-foreground">
            Esta semana
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Asistencia Promedio</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">92%</div>
          <p className="text-xs text-muted-foreground">
            +5% desde el mes pasado
          </p>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full justify-start">
            <Link to="/events/create">
              <Calendar className="mr-2 h-4 w-4" />
              Crear Evento
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start">
            <Link to="/attendance">
              <Users className="mr-2 h-4 w-4" />
              Marcar Asistencia
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start">
            <Link to="/results">
              <Trophy className="mr-2 h-4 w-4" />
              Registrar Resultado
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificaciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Bell className="h-4 w-4 text-primary mt-1" />
              <div className="text-sm">
                <p className="font-medium">Nuevo jugador agregado</p>
                <p className="text-muted-foreground">Carlos Mendoza se unió al equipo Sub-17</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Bell className="h-4 w-4 text-orange-500 mt-1" />
              <div className="text-sm">
                <p className="font-medium">Recordatorio de partido</p>
                <p className="text-muted-foreground">Partido mañana vs Academia Norte</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

const ParentDashboard = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-3xl font-bold tracking-tight">Panel de Padre/Madre</h2>
      <p className="text-muted-foreground">
        Sigue el progreso de tus hijos
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Hijos Registrados</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">2</div>
          <p className="text-xs text-muted-foreground">
            Atletas activos
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Próximas Actividades</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">5</div>
          <p className="text-xs text-muted-foreground">
            Esta semana
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Asistencia Global</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">88%</div>
          <p className="text-xs text-muted-foreground">
            Promedio familiar
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Notificaciones</CardTitle>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">3</div>
          <p className="text-xs text-muted-foreground">
            Sin leer
          </p>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Resumen de Actividades</CardTitle>
        <CardDescription>
          Actividades de tus hijos esta semana
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Ana María Pérez</h4>
                <p className="text-sm text-muted-foreground">Fútbol Sub-15 • Entrenamiento</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Hoy 4:00 PM</p>
                <p className="text-xs text-muted-foreground">Cancha Norte</p>
              </div>
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Carlos Pérez</h4>
                <p className="text-sm text-muted-foreground">Basketball U-12 • Partido</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Sábado 10:00 AM</p>
                <p className="text-xs text-muted-foreground">Coliseo Central</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

const AdminDashboard = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-3xl font-bold tracking-tight">Panel de Administración</h2>
      <p className="text-muted-foreground">
        Gestiona la plataforma SportMaps
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1,234</div>
          <p className="text-xs text-muted-foreground">
            +12% desde el mes pasado
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Clubs Activos</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">45</div>
          <p className="text-xs text-muted-foreground">
            +3 este mes
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Eventos Programados</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">156</div>
          <p className="text-xs text-muted-foreground">
            Esta semana
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos Mensuales</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">$12,450</div>
          <p className="text-xs text-muted-foreground">
            +8% desde el mes pasado
          </p>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Gestión Rápida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full justify-start">
            <Link to="/admin/users">
              <Users className="mr-2 h-4 w-4" />
              Gestionar Usuarios
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start">
            <Link to="/admin/clubs">
              <Trophy className="mr-2 h-4 w-4" />
              Gestionar Clubs
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start">
            <Link to="/admin/system">
              <BarChart3 className="mr-2 h-4 w-4" />
              Reportes del Sistema
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm">
              <p className="font-medium">Nuevo club registrado</p>
              <p className="text-muted-foreground">Academia Deportiva Sur - hace 2 horas</p>
            </div>
            <div className="text-sm">
              <p className="font-medium">Usuario reportado</p>
              <p className="text-muted-foreground">Comportamiento inapropiado - hace 4 horas</p>
            </div>
            <div className="text-sm">
              <p className="font-medium">Pago procesado</p>
              <p className="text-muted-foreground">Suscripción Club Premium - hace 6 horas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default function DashboardPage() {
  const { profile } = useAuth();

  if (!profile) return null;

  const getDashboardComponent = () => {
    switch (profile.role) {
      case 'athlete':
        return <PlayerDashboard />;
      case 'coach':
        return <CoachDashboard />;
      case 'parent':
        return <ParentDashboard />;
      case 'admin':
        return <AdminDashboard />;
      case 'school':
      case 'wellness_professional':
      case 'store_owner':
        return <CoachDashboard />; // Temporalmente usan el mismo dashboard
      default:
        return <PlayerDashboard />;
    }
  };

  return (
    <div className="container mx-auto">
      {getDashboardComponent()}
    </div>
  );
}