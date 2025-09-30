import { useMemo } from 'react';
import { DashboardConfig, UserRole } from '@/types/dashboard';
import {
  Users,
  Calendar,
  Trophy,
  BarChart3,
  Clock,
  Target,
  TrendingUp,
  Bell,
  ShoppingBag,
  Heart,
  Building,
  Activity
} from 'lucide-react';

/**
 * Custom hook that returns dashboard configuration based on user role
 * Centralizes all role-specific data and layouts
 */
export function useDashboardConfig(role: UserRole): DashboardConfig {
  return useMemo(() => {
    switch (role) {
      case 'athlete':
        return {
          role: 'athlete',
          title: 'Mi Dashboard',
          description: 'Resumen de tu actividad deportiva',
          stats: [
            {
              title: 'Equipos Activos',
              value: 2,
              description: '+1 desde el mes pasado',
              icon: Trophy,
              trend: { value: '+50%', positive: true }
            },
            {
              title: 'Próximos Eventos',
              value: 3,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Partidos Jugados',
              value: 12,
              description: 'Este mes',
              icon: Target
            },
            {
              title: 'Asistencia',
              value: '85%',
              description: '+2% desde el mes pasado',
              icon: BarChart3,
              trend: { value: '+2%', positive: true }
            }
          ],
          activities: [
            {
              id: '1',
              title: 'Entrenamiento - Fútbol Sub-17',
              subtitle: 'Cancha Principal',
              time: 'Hoy, 4:00 PM',
              icon: Clock,
              variant: 'primary'
            },
            {
              id: '2',
              title: 'Partido vs. Academia Deportiva',
              subtitle: 'Estadio Norte',
              time: 'Sábado, 10:00 AM',
              icon: Trophy,
              variant: 'accent'
            }
          ],
          quickActions: [
            { label: 'Ver Calendario', icon: Calendar, href: '/calendar' },
            { label: 'Mis Estadísticas', icon: BarChart3, href: '/stats' },
            { label: 'Equipos', icon: Users, href: '/teams' }
          ]
        };

      case 'parent':
        return {
          role: 'parent',
          title: 'Panel de Padre/Madre',
          description: 'Sigue el progreso de tus hijos',
          stats: [
            {
              title: 'Hijos Registrados',
              value: 2,
              description: 'Atletas activos',
              icon: Users
            },
            {
              title: 'Próximas Actividades',
              value: 5,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Asistencia Global',
              value: '88%',
              description: 'Promedio familiar',
              icon: BarChart3,
              trend: { value: '+3%', positive: true }
            },
            {
              title: 'Notificaciones',
              value: 3,
              description: 'Sin leer',
              icon: Bell
            }
          ],
          activities: [
            {
              id: '1',
              title: 'Ana María Pérez',
              subtitle: 'Fútbol Sub-15 • Entrenamiento',
              time: 'Hoy 4:00 PM',
              location: 'Cancha Norte',
              icon: Users,
              variant: 'primary'
            },
            {
              id: '2',
              title: 'Carlos Pérez',
              subtitle: 'Basketball U-12 • Partido',
              time: 'Sábado 10:00 AM',
              location: 'Coliseo Central',
              icon: Trophy,
              variant: 'accent'
            }
          ]
        };

      case 'coach':
        return {
          role: 'coach',
          title: 'Panel de Entrenador',
          description: 'Gestiona tus equipos y jugadores',
          stats: [
            {
              title: 'Equipos',
              value: 3,
              description: 'Equipos activos',
              icon: Users
            },
            {
              title: 'Jugadores Totales',
              value: 45,
              description: 'En todos los equipos',
              icon: Users
            },
            {
              title: 'Próximos Eventos',
              value: 8,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Asistencia Promedio',
              value: '92%',
              description: '+5% desde el mes pasado',
              icon: TrendingUp,
              trend: { value: '+5%', positive: true }
            }
          ],
          quickActions: [
            { label: 'Crear Evento', icon: Calendar, href: '/events/create', variant: 'default' },
            { label: 'Marcar Asistencia', icon: Users, href: '/attendance', variant: 'outline' },
            { label: 'Registrar Resultado', icon: Trophy, href: '/results', variant: 'outline' }
          ],
          notifications: [
            {
              id: '1',
              title: 'Nuevo jugador agregado',
              message: 'Carlos Mendoza se unió al equipo Sub-17',
              timestamp: 'Hace 2 horas',
              type: 'info'
            },
            {
              id: '2',
              title: 'Recordatorio de partido',
              message: 'Partido mañana vs Academia Norte',
              timestamp: 'Hace 4 horas',
              type: 'warning'
            }
          ]
        };

      case 'school':
        return {
          role: 'school',
          title: 'Panel de Escuela',
          description: 'Gestión completa de tu centro deportivo',
          stats: [
            {
              title: 'Estudiantes Activos',
              value: 156,
              description: '+12 este mes',
              icon: Users,
              trend: { value: '+8%', positive: true }
            },
            {
              title: 'Programas',
              value: 8,
              description: 'Disciplinas deportivas',
              icon: Activity
            },
            {
              title: 'Entrenadores',
              value: 15,
              description: 'Equipo activo',
              icon: Users
            },
            {
              title: 'Ingresos Mensuales',
              value: '$45,200',
              description: '+15% vs mes anterior',
              icon: TrendingUp,
              trend: { value: '+15%', positive: true }
            }
          ],
          quickActions: [
            { label: 'Gestionar Estudiantes', icon: Users, href: '/students', variant: 'default' },
            { label: 'Ver Programas', icon: Activity, href: '/programs', variant: 'outline' },
            { label: 'Reportes', icon: BarChart3, href: '/reports', variant: 'outline' }
          ]
        };

      case 'wellness_professional':
        return {
          role: 'wellness_professional',
          title: 'Panel de Bienestar',
          description: 'Monitorea la salud de tus atletas',
          stats: [
            {
              title: 'Atletas Asignados',
              value: 34,
              description: 'Bajo tu cuidado',
              icon: Users
            },
            {
              title: 'Consultas Programadas',
              value: 7,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Evaluaciones Pendientes',
              value: 5,
              description: 'Por completar',
              icon: Activity
            },
            {
              title: 'Casos Activos',
              value: 12,
              description: 'En seguimiento',
              icon: Heart
            }
          ],
          quickActions: [
            { label: 'Nueva Evaluación', icon: Activity, href: '/evaluations/new', variant: 'default' },
            { label: 'Ver Agenda', icon: Calendar, href: '/schedule', variant: 'outline' },
            { label: 'Historial Médico', icon: Heart, href: '/medical-history', variant: 'outline' }
          ]
        };

      case 'store_owner':
        return {
          role: 'store_owner',
          title: 'Panel de Tienda',
          description: 'Gestiona tu inventario y ventas',
          stats: [
            {
              title: 'Productos Activos',
              value: 245,
              description: 'En catálogo',
              icon: ShoppingBag
            },
            {
              title: 'Ventas del Mes',
              value: '$12,340',
              description: '+22% vs mes anterior',
              icon: TrendingUp,
              trend: { value: '+22%', positive: true }
            },
            {
              title: 'Pedidos Pendientes',
              value: 18,
              description: 'Por procesar',
              icon: Clock
            },
            {
              title: 'Clientes',
              value: 892,
              description: 'Registrados',
              icon: Users
            }
          ],
          quickActions: [
            { label: 'Agregar Producto', icon: ShoppingBag, href: '/products/new', variant: 'default' },
            { label: 'Ver Pedidos', icon: Clock, href: '/orders', variant: 'outline' },
            { label: 'Inventario', icon: BarChart3, href: '/inventory', variant: 'outline' }
          ]
        };

      case 'admin':
        return {
          role: 'admin',
          title: 'Panel de Administración',
          description: 'Gestiona la plataforma SportMaps',
          stats: [
            {
              title: 'Usuarios Totales',
              value: '1,234',
              description: '+12% desde el mes pasado',
              icon: Users,
              trend: { value: '+12%', positive: true }
            },
            {
              title: 'Clubs Activos',
              value: 45,
              description: '+3 este mes',
              icon: Building
            },
            {
              title: 'Eventos Programados',
              value: 156,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Ingresos Mensuales',
              value: '$12,450',
              description: '+8% desde el mes pasado',
              icon: TrendingUp,
              trend: { value: '+8%', positive: true }
            }
          ],
          quickActions: [
            { label: 'Gestionar Usuarios', icon: Users, href: '/admin/users', variant: 'default' },
            { label: 'Gestionar Clubs', icon: Building, href: '/admin/clubs', variant: 'outline' },
            { label: 'Reportes del Sistema', icon: BarChart3, href: '/admin/system', variant: 'outline' }
          ]
        };

      default:
        return {
          role: 'athlete',
          title: 'Dashboard',
          description: 'Bienvenido a SportMaps',
          stats: []
        };
    }
  }, [role]);
}
