import {
  Home,
  Calendar,
  Users,
  Trophy,
  BarChart3,
  Settings,
  Bell,
  ShoppingBag,
  Heart,
  Building,
  Activity,
  Target,
  BookOpen,
  MapPin,
  MessageSquare,
  FileText,
  DollarSign
} from 'lucide-react';
import { UserRole } from '@/types/dashboard';

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Returns navigation structure based on user role
 */
export function getNavigationByRole(role: UserRole): NavGroup[] {
  const baseNav: NavGroup = {
    title: 'Principal',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      { title: 'Notificaciones', href: '/notifications', icon: Bell, badge: '3' },
      { title: 'Configuración', href: '/settings', icon: Settings }
    ]
  };

  const roleSpecificNav: Record<UserRole, NavGroup[]> = {
    athlete: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Mi Calendario', href: '/calendar', icon: Calendar },
          { title: 'Mis Equipos', href: '/teams', icon: Users }
        ]
      },
      {
        title: 'Rendimiento',
        items: [
          { title: 'Estadísticas', href: '/stats', icon: BarChart3 },
          { title: 'Objetivos', href: '/goals', icon: Target },
          { title: 'Entrenamientos', href: '/training', icon: Activity }
        ]
      },
      {
        title: 'Comunidad',
        items: [
          { title: 'Explorar Escuelas', href: '/explore', icon: MapPin },
          { title: 'Mis Inscripciones', href: '/enrollments', icon: Trophy },
          { title: 'Tienda Deportiva', href: '/shop', icon: ShoppingBag },
          { title: 'Bienestar', href: '/wellness', icon: Heart }
        ]
      }
    ],

    parent: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Mis Hijos', href: '/children', icon: Users },
          { title: 'Calendario Familiar', href: '/calendar', icon: Calendar }
        ]
      },
      {
        title: 'Seguimiento',
        items: [
          { title: 'Progreso Académico', href: '/academic-progress', icon: BookOpen },
          { title: 'Asistencias', href: '/parent-attendance', icon: BarChart3 },
          { title: 'Pagos', href: '/my-payments', icon: DollarSign }
        ]
      },
      {
        title: 'Comunidad',
        items: [
          { title: 'Mensajes', href: '/messages', icon: MessageSquare },
          { title: 'Explorar Escuelas', href: '/explore', icon: MapPin },
          { title: 'Configuración', href: '/settings', icon: Settings }
        ]
      }
    ],

    coach: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Mis Equipos', href: '/teams', icon: Users },
          { title: 'Calendario', href: '/calendar', icon: Calendar }
        ]
      },
      {
        title: 'Gestión',
        items: [
          { title: 'Asistencias', href: '/coach-attendance', icon: BarChart3 },
          { title: 'Resultados', href: '/results', icon: Trophy },
          { title: 'Planes de Entrenamiento', href: '/training-plans', icon: Activity },
          { title: 'Reportes', href: '/coach-reports', icon: FileText }
        ]
      },
      {
        title: 'Comunicación',
        items: [
          { title: 'Mensajes', href: '/messages', icon: MessageSquare },
          { title: 'Anuncios', href: '/announcements', icon: Bell }
        ]
      }
    ],

    school: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Estudiantes', href: '/students', icon: Users },
          { title: 'Entrenadores', href: '/staff', icon: Users }
        ]
      },
      {
        title: 'Gestión Académica',
        items: [
          { title: 'Programas', href: '/programs-management', icon: Activity },
          { title: 'Calendario', href: '/calendar', icon: Calendar },
          { title: 'Asistencias', href: '/attendance-supervision', icon: BarChart3 },
          { title: 'Resultados', href: '/results-overview', icon: Trophy }
        ]
      },
      {
        title: 'Administración',
        items: [
          { title: 'Finanzas', href: '/finances', icon: DollarSign },
          { title: 'Reportes', href: '/school-reports', icon: FileText },
          { title: 'Instalaciones', href: '/facilities', icon: Building }
        ]
      }
    ],

    wellness_professional: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Mis Atletas', href: '/athletes', icon: Users },
          { title: 'Agenda', href: '/schedule', icon: Calendar }
        ]
      },
      {
        title: 'Evaluaciones',
        items: [
          { title: 'Nueva Evaluación', href: '/evaluations/new', icon: Activity },
          { title: 'Historial Médico', href: '/medical-history', icon: Heart },
          { title: 'Seguimientos', href: '/follow-ups', icon: Target }
        ]
      },
      {
        title: 'Recursos',
        items: [
          { title: 'Planes Nutricionales', href: '/nutrition', icon: BookOpen },
          { title: 'Reportes', href: '/wellness-reports', icon: FileText }
        ]
      }
    ],

    store_owner: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Productos', href: '/products', icon: ShoppingBag },
          { title: 'Pedidos', href: '/orders', icon: FileText }
        ]
      },
      {
        title: 'Inventario',
        items: [
          { title: 'Stock', href: '/inventory', icon: BarChart3 },
          { title: 'Proveedores', href: '/suppliers', icon: Building },
          { title: 'Categorías', href: '/categories', icon: Activity }
        ]
      },
      {
        title: 'Ventas',
        items: [
          { title: 'Clientes', href: '/customers', icon: Users },
          { title: 'Reportes', href: '/store-reports', icon: FileText },
          { title: 'Promociones', href: '/promotions', icon: Trophy }
        ]
      }
    ],

    admin: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Usuarios', href: '/admin/users', icon: Users },
          { title: 'Clubs', href: '/admin/clubs', icon: Building }
        ]
      },
      {
        title: 'Sistema',
        items: [
          { title: 'Analítica', href: '/admin/analytics', icon: BarChart3 },
          { title: 'Reportes', href: '/admin/reports', icon: FileText },
          { title: 'Configuración', href: '/admin/config', icon: Settings },
          { title: 'Logs', href: '/admin/logs', icon: Bell }
        ]
      }
    ]
  };

  return roleSpecificNav[role] || [baseNav];
}
