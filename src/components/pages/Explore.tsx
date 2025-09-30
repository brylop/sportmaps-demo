import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  Users,
  Award,
  TrendingUp,
  Heart,
  Star,
  Clock,
  GraduationCap,
  ShoppingBag,
  Package,
  BarChart3,
  BookOpen,
  Dumbbell,
  Building2,
  UserCheck,
  ArrowLeft
} from "lucide-react";
import Logo from "@/components/Logo";

interface ExploreProps {
  onNavigate: (page: string) => void;
}

const Explore = ({ onNavigate }: ExploreProps) => {
  const [activeRole, setActiveRole] = useState<string>("padre");

  // Perfiles demo específicos para cada rol
  const profilesByRole = {
    padre: {
      name: "Carlos Andrés Martínez",
      email: "carlos.martinez@demo.com",
      phone: "+57 300 123 4567",
      location: "Bogotá, Colombia",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop",
      memberSince: "Enero 2024",
      points: 1250,
      level: "Gold Member",
      badge: "Padre Activo",
      stat1: { label: "Hijos Registrados", value: "2" },
      stat2: { label: "Actividades", value: "12" },
      description: "Padre de 2 niños deportistas"
    },
    entrenador: {
      name: "Juan Carlos Rodríguez",
      email: "jc.rodriguez@demo.com",
      phone: "+57 310 456 7890",
      location: "Medellín, Colombia",
      avatar: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&auto=format&fit=crop",
      memberSince: "Marzo 2023",
      points: 3850,
      level: "Pro Coach",
      badge: "Entrenador Verificado",
      stat1: { label: "Alumnos", value: "30" },
      stat2: { label: "Clases", value: "156" },
      description: "Entrenador profesional de fútbol"
    },
    escuela: {
      name: "Academia Deportiva Elite",
      email: "admin@elite-sports.com",
      phone: "+57 601 234 5678",
      location: "Cali, Colombia",
      avatar: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&auto=format&fit=crop",
      memberSince: "Mayo 2022",
      points: 8500,
      level: "Premium",
      badge: "Escuela Certificada",
      stat1: { label: "Estudiantes", value: "340" },
      stat2: { label: "Programas", value: "18" },
      description: "Centro deportivo de alto rendimiento"
    },
    proveedor: {
      name: "SportGear Colombia",
      email: "ventas@sportgear.com",
      phone: "+57 320 987 6543",
      location: "Barranquilla, Colombia",
      avatar: "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400&auto=format&fit=crop",
      memberSince: "Julio 2021",
      points: 12400,
      level: "Distribuidor Oficial",
      badge: "Proveedor Verificado",
      stat1: { label: "Productos", value: "342" },
      stat2: { label: "Ventas/mes", value: "8.5M" },
      description: "Proveedor de equipamiento deportivo"
    }
  };

  // Obtener perfil actual según el rol seleccionado
  const currentProfile = profilesByRole[activeRole as keyof typeof profilesByRole];

  // Contenido para Padres
  const renderPadreContent = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Mis Hijos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Mis Hijos
            </CardTitle>
            <CardDescription>Seguimiento de actividades deportivas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <Avatar>
                <AvatarImage src="https://images.unsplash.com/photo-1514315384763-ba401779410f?w=100" />
                <AvatarFallback>SA</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold">Sofía Martínez</h4>
                <p className="text-sm text-muted-foreground">12 años • Fútbol, Natación</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={75} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground">75%</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <Avatar>
                <AvatarImage src="https://images.unsplash.com/photo-1519340241574-2cec6aef0c01?w=100" />
                <AvatarFallback>DM</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold">Daniel Martínez</h4>
                <p className="text-sm text-muted-foreground">9 años • Baloncesto</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={60} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground">60%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Próximas Actividades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Próximas Actividades
            </CardTitle>
            <CardDescription>Esta semana</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold">Clase de Fútbol - Sofía</h4>
                <p className="text-sm text-muted-foreground">Mañana a las 9:00 AM</p>
                <Badge variant="secondary" className="mt-1 bg-primary/20 text-primary">
                  Academia Juvenil
                </Badge>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold">Natación - Sofía</h4>
                <p className="text-sm text-muted-foreground">Miércoles a las 4:00 PM</p>
                <Badge variant="secondary" className="mt-1">Club Acuático</Badge>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold">Baloncesto - Daniel</h4>
                <p className="text-sm text-muted-foreground">Viernes a las 3:30 PM</p>
                <Badge variant="secondary" className="mt-1">Centro Deportivo</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas de Rendimiento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Rendimiento Mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Award className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">12</p>
              <p className="text-sm text-muted-foreground">Clases Completadas</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Heart className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">92%</p>
              <p className="text-sm text-muted-foreground">Asistencia</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Star className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">4.8</p>
              <p className="text-sm text-muted-foreground">Calificación</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">+15%</p>
              <p className="text-sm text-muted-foreground">Mejora</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones Rápidas */}
      <div className="flex flex-wrap gap-3">
        <Button variant="default" size="lg">
          <Calendar className="h-4 w-4 mr-2" />
          Reservar Clase
        </Button>
        <Button variant="outline" size="lg">
          <Users className="h-4 w-4 mr-2" />
          Ver Progreso
        </Button>
        <Button variant="outline" size="lg">
          <ShoppingBag className="h-4 w-4 mr-2" />
          Comprar Equipo
        </Button>
      </div>
    </div>
  );

  // Contenido para Entrenadores
  const renderEntrenadorContent = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Mis Clases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Mis Clases Activas
            </CardTitle>
            <CardDescription>Gestión de grupos y horarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold">Fútbol Sub-12</h4>
                <Badge className="bg-green-500/20 text-green-700">Activa</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">Lunes y Miércoles • 9:00 - 10:30 AM</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  18 alumnos
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  8 semanas
                </span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold">Fútbol Avanzado</h4>
                <Badge variant="secondary">Programada</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">Martes y Jueves • 4:00 - 6:00 PM</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  12 alumnos
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  12 semanas
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alumnos Destacados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Alumnos Destacados
            </CardTitle>
            <CardDescription>Top performers del mes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar>
                <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100" />
                <AvatarFallback>JR</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold">Juan Rodríguez</h4>
                <p className="text-sm text-muted-foreground">Mejora del 25%</p>
              </div>
              <Star className="h-5 w-5 text-yellow-500 fill-current" />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar>
                <AvatarImage src="https://images.unsplash.com/photo-1514315384763-ba401779410f?w=100" />
                <AvatarFallback>MG</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold">María García</h4>
                <p className="text-sm text-muted-foreground">100% asistencia</p>
              </div>
              <Heart className="h-5 w-5 text-red-500 fill-current" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas del Entrenador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Estadísticas de Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">30</p>
              <p className="text-sm text-muted-foreground">Alumnos Totales</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <BookOpen className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">5</p>
              <p className="text-sm text-muted-foreground">Clases Activas</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Star className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">4.9</p>
              <p className="text-sm text-muted-foreground">Calificación</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Award className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">156</p>
              <p className="text-sm text-muted-foreground">Clases Impartidas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex flex-wrap gap-3">
        <Button variant="default" size="lg">
          <Calendar className="h-4 w-4 mr-2" />
          Programar Clase
        </Button>
        <Button variant="outline" size="lg">
          <Users className="h-4 w-4 mr-2" />
          Gestionar Alumnos
        </Button>
        <Button variant="outline" size="lg">
          <BarChart3 className="h-4 w-4 mr-2" />
          Ver Reportes
        </Button>
      </div>
    </div>
  );

  // Contenido para Escuelas
  const renderEscuelasContent = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Instalaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Instalaciones Activas
            </CardTitle>
            <CardDescription>Gestión de espacios deportivos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <h4 className="font-semibold mb-2">Cancha de Fútbol Principal</h4>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Capacidad: 100 personas</span>
                <Badge className="bg-green-500/20 text-green-700">Disponible</Badge>
              </div>
              <div className="mt-2">
                <Progress value={75} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">75% ocupación hoy</p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">Piscina Olímpica</h4>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>8 carriles • 50m</span>
                <Badge variant="secondary">En uso</Badge>
              </div>
              <div className="mt-2">
                <Progress value={90} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">90% ocupación hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Programas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              Programas Deportivos
            </CardTitle>
            <CardDescription>Actividades disponibles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <h4 className="font-semibold">Fútbol Juvenil</h4>
                <p className="text-sm text-muted-foreground">45 estudiantes</p>
              </div>
              <Badge>3 grupos</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <h4 className="font-semibold">Natación</h4>
                <p className="text-sm text-muted-foreground">38 estudiantes</p>
              </div>
              <Badge>2 grupos</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <h4 className="font-semibold">Baloncesto</h4>
                <p className="text-sm text-muted-foreground">30 estudiantes</p>
              </div>
              <Badge>2 grupos</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas de la Escuela */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Estadísticas del Centro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">340</p>
              <p className="text-sm text-muted-foreground">Estudiantes</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <UserCheck className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">25</p>
              <p className="text-sm text-muted-foreground">Entrenadores</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <BookOpen className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">18</p>
              <p className="text-sm text-muted-foreground">Programas</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Star className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">4.7</p>
              <p className="text-sm text-muted-foreground">Calificación</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex flex-wrap gap-3">
        <Button variant="default" size="lg">
          <Calendar className="h-4 w-4 mr-2" />
          Gestionar Horarios
        </Button>
        <Button variant="outline" size="lg">
          <Users className="h-4 w-4 mr-2" />
          Ver Inscripciones
        </Button>
        <Button variant="outline" size="lg">
          <Building2 className="h-4 w-4 mr-2" />
          Administrar Instalaciones
        </Button>
      </div>
    </div>
  );

  // Contenido para Proveedores
  const renderProveedorContent = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Productos Destacados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Productos Destacados
            </CardTitle>
            <CardDescription>Top ventas del mes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="w-16 h-16 rounded-lg bg-cover bg-center flex-shrink-0"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=100')" }}
              />
              <div className="flex-1">
                <h4 className="font-semibold">Balón Nike Pro</h4>
                <p className="text-sm text-muted-foreground">145 vendidos</p>
                <p className="text-primary font-bold">$85.000</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-16 h-16 rounded-lg bg-cover bg-center flex-shrink-0"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100')" }}
              />
              <div className="flex-1">
                <h4 className="font-semibold">Tenis Adidas Ultra</h4>
                <p className="text-sm text-muted-foreground">98 vendidos</p>
                <p className="text-primary font-bold">$320.000</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ventas Recientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Ventas Recientes
            </CardTitle>
            <CardDescription>Últimas 24 horas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <h4 className="font-semibold">Pedido #1247</h4>
                <p className="text-sm text-muted-foreground">Hace 2 horas</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">$450.000</p>
                <Badge className="bg-green-500/20 text-green-700">Completado</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <h4 className="font-semibold">Pedido #1246</h4>
                <p className="text-sm text-muted-foreground">Hace 5 horas</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">$280.000</p>
                <Badge variant="secondary">En proceso</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas de Ventas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Estadísticas de Ventas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <ShoppingBag className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">$8.5M</p>
              <p className="text-sm text-muted-foreground">Ventas del Mes</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Package className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">342</p>
              <p className="text-sm text-muted-foreground">Productos</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Users className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">1,250</p>
              <p className="text-sm text-muted-foreground">Clientes</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">+23%</p>
              <p className="text-sm text-muted-foreground">Crecimiento</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventario Bajo */}
      <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <Package className="h-5 w-5" />
            Alerta de Inventario
          </CardTitle>
          <CardDescription>Productos con bajo stock</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">Balones de Fútbol #5</span>
            <Badge variant="outline" className="border-orange-500 text-orange-700">
              8 unidades
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Guayos Talla 38</span>
            <Badge variant="outline" className="border-orange-500 text-orange-700">
              5 unidades
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex flex-wrap gap-3">
        <Button variant="default" size="lg">
          <Package className="h-4 w-4 mr-2" />
          Agregar Producto
        </Button>
        <Button variant="outline" size="lg">
          <ShoppingBag className="h-4 w-4 mr-2" />
          Ver Pedidos
        </Button>
        <Button variant="outline" size="lg">
          <BarChart3 className="h-4 w-4 mr-2" />
          Reportes
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onNavigate("landing")}
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
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onNavigate("register")}
              >
                Registrarse
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => onNavigate("login")}
              >
                Iniciar sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Selector de Rol Demo */}
        <Card className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold mb-2">Explorar Perfiles Demo</h2>
              <p className="text-muted-foreground">
                Selecciona un rol para ver su perfil y funcionalidades específicas
              </p>
            </div>
            <Tabs value={activeRole} onValueChange={setActiveRole} className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                <TabsTrigger value="padre" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Padre
                </TabsTrigger>
                <TabsTrigger value="entrenador" className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Entrenador
                </TabsTrigger>
                <TabsTrigger value="escuela" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Escuela
                </TabsTrigger>
                <TabsTrigger value="proveedor" className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Proveedor
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Perfil Demo Dinámico según Rol */}
        <Card className="mb-8 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary to-primary/60" />
          <CardContent className="relative pt-0">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
              <Avatar className="w-32 h-32 border-4 border-background -mt-16">
                <AvatarImage src={currentProfile.avatar} />
                <AvatarFallback>{currentProfile.name.substring(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3 md:pb-2">
                <div>
                  <h2 className="text-3xl font-bold">{currentProfile.name}</h2>
                  <p className="text-muted-foreground mb-2">{currentProfile.description}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-yellow-500/20 text-yellow-700">
                      {currentProfile.level}
                    </Badge>
                    <Badge variant="outline" className="border-primary text-primary">
                      {currentProfile.badge}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      • Miembro desde {currentProfile.memberSince}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{currentProfile.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{currentProfile.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{currentProfile.location}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 md:pb-2">
                <div className="text-center p-3 rounded-lg bg-muted">
                  <Star className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                  <p className="text-xl font-bold">{currentProfile.points}</p>
                  <p className="text-xs text-muted-foreground">Puntos</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <Award className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-xl font-bold">{currentProfile.stat1.value}</p>
                  <p className="text-xs text-muted-foreground">{currentProfile.stat1.label}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <TrendingUp className="h-5 w-5 text-green-500 mx-auto mb-1" />
                  <p className="text-xl font-bold">{currentProfile.stat2.value}</p>
                  <p className="text-xs text-muted-foreground">{currentProfile.stat2.label}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Funcionalidades Específicas del Rol */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeRole === "padre" && <Users className="h-5 w-5 text-primary" />}
              {activeRole === "entrenador" && <GraduationCap className="h-5 w-5 text-primary" />}
              {activeRole === "escuela" && <Building2 className="h-5 w-5 text-primary" />}
              {activeRole === "proveedor" && <ShoppingBag className="h-5 w-5 text-primary" />}
              Panel de {activeRole.charAt(0).toUpperCase() + activeRole.slice(1)}
            </CardTitle>
            <CardDescription>
              Funcionalidades y herramientas disponibles (Datos Demo)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeRole === "padre" && renderPadreContent()}
            {activeRole === "entrenador" && renderEntrenadorContent()}
            {activeRole === "escuela" && renderEscuelasContent()}
            {activeRole === "proveedor" && renderProveedorContent()}
          </CardContent>
        </Card>

        {/* CTA Final */}
        <Card className="mt-8 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-8 text-center">
            <h3 className="text-2xl font-bold mb-2">¿Listo para comenzar?</h3>
            <p className="text-muted-foreground mb-6">
              Únete a SportMaps y accede a todas las funcionalidades
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button size="lg" onClick={() => onNavigate("register")}>
                Crear Cuenta Gratis
              </Button>
              <Button variant="outline" size="lg" onClick={() => onNavigate("landing")}>
                Volver al Inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Explore;
