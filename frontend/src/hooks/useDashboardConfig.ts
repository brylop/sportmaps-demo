import { useMemo } from 'react';
import { DashboardConfig, UserRole } from '@/types/dashboard';
import { DashboardStats } from './useDashboardStats';
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
export function useDashboardConfig(role: UserRole, statsData?: DashboardStats): DashboardConfig {
  return useMemo(() => {
    // Default empty stats if not provided
    const stats = statsData || {
      children: 0,
      teams: 0,
      products: 0,
      orders: 0,
      appointments: 0,
      evaluations: 0,
      programs: 0,
      activePrograms: 0,
      notifications: 0,
      unreadNotifications: 0,
      payments: 0,
      pendingPayments: 0,
      totalStudents: 0,
      totalRevenue: 0,
      activeEnrollments: 0,
      upcomingEvents: 0,
      completedActivities: 0,
      attendanceRate: 0,
      activeTeams: 0
    };

    switch (role) {
      case 'athlete':
        return {
          role: 'athlete',
          title: 'Mi Dashboard',
          description: 'Resumen de tu actividad deportiva',
          stats: [
            {
              title: 'Programas Activos',
              value: stats.activeEnrollments,
              description: stats.activeEnrollments === 0 ? 'Sin inscripciones activas' : 'En curso actualmente',
              icon: Trophy
            },
            {
              title: 'Próximos Eventos',
              value: stats.upcomingEvents,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Actividades Completadas',
              value: stats.completedActivities,
              description: 'Total histórico',
              icon: Target
            },
            {
              title: 'Asistencia',
              value: `${stats.attendanceRate}%`,
              description: 'Promedio general',
              icon: BarChart3
            }
          ],
          activities: [],
          quickActions: [
            { label: 'Ver Calendario', icon: Calendar, href: '/calendar', variant: 'default' },
            { label: 'Mis Inscripciones', icon: Trophy, href: '/my-enrollments', variant: 'outline' },
            { label: 'Explorar Programas', icon: Users, href: '/explore', variant: 'outline' }
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
              value: stats.children,
              description: stats.children === 0 ? 'Aún no has agregado hijos' : 'Registrados',
              icon: Users
            },
            {
              title: 'Pagos Pendientes',
              value: stats.pendingPayments,
              description: stats.pendingPayments === 0 ? 'Al día' : 'Por pagar',
              icon: TrendingUp
            },
            {
              title: 'Suscripciones Activas',
              value: stats.activeEnrollments, // Using active enrollments as proxy for subscriptions/active kids programs
              description: 'En curso',
              icon: Activity
            },
            {
              title: 'Notificaciones',
              value: stats.unreadNotifications,
              description: 'Sin leer',
              icon: Bell
            }
          ],
          activities: [],
          quickActions: [
            { label: 'Agregar Hijo', icon: Users, href: '/children', variant: 'default' },
            { label: 'Ver Programas', icon: Activity, href: '/explore', variant: 'outline' },
            { label: 'Mis Pagos', icon: TrendingUp, href: '/payments', variant: 'outline' }
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
              value: stats.teams,
              description: stats.teams === 0 ? 'Aún no tienes equipos' : 'Asignados',
              icon: Users
            },
            {
              title: 'Jugadores Totales',
              value: stats.totalStudents || 0, // Assuming totalStudents maps to players for coach context if needed, or 0
              description: 'En todos los equipos',
              icon: Users
            },
            {
              title: 'Próximos Eventos',
              value: stats.upcomingEvents,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Asistencia Promedio',
              value: `${stats.attendanceRate}%`,
              description: 'Sin registros aún',
              icon: TrendingUp
            }
          ],
          activities: [],
          quickActions: [
            { label: 'Ver Calendario', icon: Calendar, href: '/calendar', variant: 'default' },
            { label: 'Marcar Asistencia', icon: Users, href: '/coach-attendance', variant: 'outline' },
            { label: 'Registrar Resultado', icon: Trophy, href: '/results', variant: 'outline' }
          ],
          notifications: []
        };

      case 'school':
        return {
          role: 'school',
          title: 'Panel de Escuela',
          description: 'Gestión completa de tu centro deportivo',
          stats: [
            {
              title: 'Estudiantes Activos',
              value: stats.totalStudents,
              description: stats.totalStudents === 0 ? 'Aún no tienes estudiantes' : 'Total matriculados',
              icon: Users
            },
            {
              title: 'Programas',
              value: stats.programs,
              description: stats.programs === 0 ? 'Crea tu primer programa' : `${stats.activePrograms} activos`,
              icon: Activity
            },
            {
              title: 'Entrenadores',
              value: stats.activeTeams, // Using activeTeams as proxy or 0 if not counted separate
              description: 'Equipo técnico',
              icon: Users
            },
            {
              title: 'Ingresos Mensuales',
              value: `$${stats.totalRevenue || 0}`,
              description: 'Este mes',
              icon: TrendingUp
            }
          ],
          activities: [],
          quickActions: [
            { label: 'Gestionar Estudiantes', icon: Users, href: '/students', variant: 'default' },
            { label: 'Ver Programas', icon: Activity, href: '/programs-management', variant: 'outline' },
            { label: 'Agregar Entrenador', icon: Users, href: '/school-coaches', variant: 'outline' }
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
              value: 0, // Helper needed for dedicated athlete assignation count
              description: 'Aún no tienes atletas asignados',
              icon: Users
            },
            {
              title: 'Consultas Programadas',
              value: stats.appointments,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Evaluaciones Pendientes',
              value: stats.evaluations,
              description: 'Por completar',
              icon: Activity
            },
            {
              title: 'Casos Activos',
              value: 0,
              description: 'En seguimiento',
              icon: Heart
            }
          ],
          activities: [],
          quickActions: [
            { label: 'Ver Agenda', icon: Calendar, href: '/schedule', variant: 'default' },
            { label: 'Mis Atletas', icon: Users, href: '/athletes', variant: 'outline' },
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
              value: stats.products,
              description: stats.products === 0 ? 'Crea tu primer producto' : 'En catálogo',
              icon: ShoppingBag
            },
            {
              title: 'Ventas del Mes',
              value: '$0',
              description: 'Este mes',
              icon: TrendingUp
            },
            {
              title: 'Pedidos Pendientes',
              value: stats.orders,
              description: 'Por procesar',
              icon: Clock
            },
            {
              title: 'Clientes',
              value: 0,
              description: 'Registrados',
              icon: Users
            }
          ],
          activities: [],
          quickActions: [
            { label: 'Ver Productos', icon: ShoppingBag, href: '/products', variant: 'default' },
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
              value: 0,
              description: 'Sin registros aún',
              icon: Users
            },
            {
              title: 'Clubs Activos',
              value: 0,
              description: 'Sin clubs registrados',
              icon: Building
            },
            {
              title: 'Eventos Programados',
              value: 0,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Ingresos Mensuales',
              value: '$0',
              description: 'Este mes',
              icon: TrendingUp
            }
          ],
          activities: [],
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
  }, [role, statsData]);
}
