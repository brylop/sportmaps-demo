import { useMemo } from 'react';
import { DashboardConfig, UserRole } from '@/types/dashboard';
<<<<<<< HEAD
import { DashboardStatsData } from './useDashboardStats';
=======
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
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
<<<<<<< HEAD
export function useDashboardConfig(role: UserRole, statsData?: DashboardStatsData): DashboardConfig {
  return useMemo(() => {
    // Valores por defecto si no hay datos cargados aún
    const stats = statsData || {
      activeEnrollments: 0,
      upcomingEvents: 0,
      completedActivities: 0,
      attendanceRate: 0,
      activePrograms: 0,
      totalStudents: 0,
      totalRevenue: 0
    };

=======
export function useDashboardConfig(role: UserRole): DashboardConfig {
  return useMemo(() => {
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    switch (role) {
      case 'athlete':
        return {
          role: 'athlete',
          title: 'Mi Dashboard',
          description: 'Resumen de tu actividad deportiva',
          stats: [
            {
<<<<<<< HEAD
              title: 'Programas Activos',
              value: stats.activeEnrollments, // ¡Dato Real!
              description: stats.activeEnrollments === 0 ? 'Sin inscripciones activas' : 'En curso actualmente',
=======
              title: 'Equipos Activos',
              value: 0,
              description: 'Aún no estás en ningún equipo',
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              icon: Trophy
            },
            {
              title: 'Próximos Eventos',
<<<<<<< HEAD
              value: stats.upcomingEvents,
=======
              value: 0,
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              description: 'Esta semana',
              icon: Calendar
            },
            {
<<<<<<< HEAD
              title: 'Actividades Completadas',
              value: stats.completedActivities,
              description: 'Total histórico',
=======
              title: 'Partidos Jugados',
              value: 0,
              description: 'Este mes',
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              icon: Target
            },
            {
              title: 'Asistencia',
<<<<<<< HEAD
              value: `${stats.attendanceRate}%`,
              description: 'Promedio general',
=======
              value: '0%',
              description: 'Sin registros aún',
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              icon: BarChart3
            }
          ],
          activities: [],
          quickActions: [
            { label: 'Ver Calendario', icon: Calendar, href: '/calendar' },
<<<<<<< HEAD
            { label: 'Mis Inscripciones', icon: Trophy, href: '/my-enrollments' }, // Actualizado a la nueva página
=======
            { label: 'Mis Estadísticas', icon: BarChart3, href: '/stats' },
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            { label: 'Explorar Programas', icon: Users, href: '/explore' }
          ]
        };

<<<<<<< HEAD
      // ... (El resto de roles se mantienen igual por ahora, pero ya preparados para recibir stats)
      
=======
      case 'parent':
        return {
          role: 'parent',
          title: 'Panel de Padre/Madre',
          description: 'Sigue el progreso de tus hijos',
          stats: [
            {
              title: 'Hijos Registrados',
              value: 0,
              description: 'Aún no has agregado hijos',
              icon: Users
            },
            {
              title: 'Próximas Actividades',
              value: 0,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Asistencia Global',
              value: '0%',
              description: 'Sin registros aún',
              icon: BarChart3
            },
            {
              title: 'Notificaciones',
              value: 0,
              description: 'Sin leer',
              icon: Bell
            }
          ],
          activities: [],
          quickActions: [
            { label: 'Agregar Hijo', icon: Users, href: '/children', variant: 'orange' },
            { label: 'Ver Programas', icon: Activity, href: '/explore', variant: 'outline' }
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
              value: 0,
              description: 'Aún no tienes equipos asignados',
              icon: Users
            },
            {
              title: 'Jugadores Totales',
              value: 0,
              description: 'En todos los equipos',
              icon: Users
            },
            {
              title: 'Próximos Eventos',
              value: 0,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Asistencia Promedio',
              value: '0%',
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

>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      case 'school':
        return {
          role: 'school',
          title: 'Panel de Escuela',
          description: 'Gestión completa de tu centro deportivo',
          stats: [
            {
              title: 'Estudiantes Activos',
<<<<<<< HEAD
              value: stats.totalStudents || 0,
              description: 'Total matriculados',
=======
              value: 0,
              description: 'Aún no tienes estudiantes',
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              icon: Users
            },
            {
              title: 'Programas',
<<<<<<< HEAD
              value: stats.activePrograms || 0,
              description: 'Programas ofertados',
=======
              value: 0,
              description: 'Crea tu primer programa',
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              icon: Activity
            },
            {
              title: 'Entrenadores',
              value: 0,
<<<<<<< HEAD
              description: 'Equipo técnico',
=======
              description: 'Agrega tu equipo',
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              icon: Users
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
<<<<<<< HEAD
            { label: 'Gestionar Estudiantes', icon: Users, href: '/students', variant: 'default' },
            { label: 'Ver Programas', icon: Activity, href: '/programs-management', variant: 'outline' },
            { label: 'Agregar Entrenador', icon: Users, href: '/school-coaches', variant: 'outline' }
          ]
        };

      // ... Mantener los demás casos (parent, coach, etc) igual, 
      // solo asegúrate de cerrar el switch y retornar el default.
      
=======
            { label: 'Ver Cobros Automáticos', icon: TrendingUp, href: '/payments-automation', variant: 'default' },
            { label: 'Tu Perfil Público', icon: Building, href: '/explore', variant: 'outline' },
            { label: 'Gestionar Programas', icon: Activity, href: '/programs', variant: 'outline' },
            { label: 'Ver Estudiantes', icon: Users, href: '/students', variant: 'outline' }
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
              value: 0,
              description: 'Aún no tienes atletas asignados',
              icon: Users
            },
            {
              title: 'Consultas Programadas',
              value: 0,
              description: 'Esta semana',
              icon: Calendar
            },
            {
              title: 'Evaluaciones Pendientes',
              value: 0,
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
              value: 0,
              description: 'Crea tu primer producto',
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
              value: 0,
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

>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      default:
        return {
          role: 'athlete',
          title: 'Dashboard',
          description: 'Bienvenido a SportMaps',
          stats: []
        };
    }
<<<<<<< HEAD
  }, [role, statsData]); // Importante: recalculate cuando cambien los datos
}
=======
  }, [role]);
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
