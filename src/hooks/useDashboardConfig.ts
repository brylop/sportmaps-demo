import { useMemo } from 'react';
import { DashboardConfig, UserRole } from '@/types/dashboard';
import { DashboardStatsData } from './useDashboardStats';
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

    switch (role) {
      case 'athlete':
        return {
          role: 'athlete',
          title: 'Mi Dashboard',
          description: 'Resumen de tu actividad deportiva',
          stats: [
            {
              title: 'Programas Activos',
              value: stats.activeEnrollments, // ¡Dato Real!
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
            { label: 'Ver Calendario', icon: Calendar, href: '/calendar' },
            { label: 'Mis Inscripciones', icon: Trophy, href: '/my-enrollments' }, // Actualizado a la nueva página
            { label: 'Explorar Programas', icon: Users, href: '/explore' }
          ]
        };

      // ... (El resto de roles se mantienen igual por ahora, pero ya preparados para recibir stats)
      
      case 'school':
        return {
          role: 'school',
          title: 'Panel de Escuela',
          description: 'Gestión completa de tu centro deportivo',
          stats: [
            {
              title: 'Estudiantes Activos',
              value: stats.totalStudents || 0,
              description: 'Total matriculados',
              icon: Users
            },
            {
              title: 'Programas',
              value: stats.activePrograms || 0,
              description: 'Programas ofertados',
              icon: Activity
            },
            {
              title: 'Entrenadores',
              value: 0,
              description: 'Equipo técnico',
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
            { label: 'Gestionar Estudiantes', icon: Users, href: '/students', variant: 'default' },
            { label: 'Ver Programas', icon: Activity, href: '/programs-management', variant: 'outline' },
            { label: 'Agregar Entrenador', icon: Users, href: '/school-coaches', variant: 'outline' }
          ]
        };

      // ... Mantener los demás casos (parent, coach, etc) igual, 
      // solo asegúrate de cerrar el switch y retornar el default.
      
      default:
        return {
          role: 'athlete',
          title: 'Dashboard',
          description: 'Bienvenido a SportMaps',
          stats: []
        };
    }
  }, [role, statsData]); // Importante: recalculate cuando cambien los datos
}