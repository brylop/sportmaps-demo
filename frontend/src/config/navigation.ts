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
  DollarSign,
  Plus,
  Map,
  Ticket,
  Car,
  Send,
  GraduationCap,
  Dumbbell,
  User,
  ClipboardList
} from 'lucide-react';
import { UserRole } from '@/types/dashboard';
import { SHOW_EXPLORE } from '@/lib/feature-flags';

export interface NavItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
  submenu?: NavItem[];
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
          { title: 'Mi Calendario', href: '/calendar', icon: Calendar }
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
      ...(SHOW_EXPLORE ? [{
        title: 'Explorar',
        items: [
          { title: 'Explorar', href: '/explorar', icon: MapPin },
        ]
      }] : []),
      {
        title: 'Mi Actividad',
        items: [
          { title: 'Mis Inscripciones', href: '/enrollments', icon: Trophy },
          { title: 'Mis Eventos', href: '/my-event-registrations', icon: Calendar },
          { title: 'Mis Pagos', href: '/athlete-payments', icon: DollarSign },
          { title: 'Tienda Deportiva', href: '/shop', icon: ShoppingBag },
          { title: 'Bienestar', href: '/wellness', icon: Heart },
          { title: 'Configuración', href: '/settings', icon: Settings }
        ]
      },
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
      ...(SHOW_EXPLORE ? [{
        title: 'Explorar',
        items: [
          { title: 'Explorar', href: '/explorar', icon: MapPin },
        ]
      }] : []),
      {
        title: 'Seguimiento',
        items: [
          { title: 'Progreso Deportivo', href: '/academic-progress', icon: BookOpen },
          { title: 'Asistencias', href: '/parent-attendance', icon: BarChart3 },
          { title: 'Pagos', href: '/my-payments', icon: DollarSign }
        ]
      },
      {
        title: 'Mi Actividad',
        items: [
          { title: 'Mensajes', href: '/messages', icon: MessageSquare },
          { title: 'Mis Inscripciones', href: '/enrollments', icon: Trophy },
          { title: 'Mis Eventos', href: '/my-event-registrations', icon: Calendar },
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
          { title: 'Mis Planes', href: '/coach-plans', icon: FileText },
          { title: 'Mis Estudiantes', href: '/students', icon: Users },
          { title: 'Calendario', href: '/calendar', icon: Calendar }
        ]
      },
      {
        title: 'Gestión',
        items: [
          {
            title: 'Asistencias',
            icon: BarChart3,
            submenu: [
              { title: 'Supervisión', href: '/coach-attendance', icon: BarChart3 },
              { title: 'Encuestas', href: '/dashboard/polls', icon: ClipboardList },
            ],
          },
          { title: 'Resultados', href: '/results', icon: Trophy },
          { title: 'Planes de Entrenamiento', href: '/training-plans', icon: Activity },
          { title: 'Reportes', href: '/coach-reports', icon: FileText }
        ]
      },
      {
        title: 'Comunicación',
        items: [
          { title: 'Mensajes', href: '/messages', icon: MessageSquare },
          { title: 'Anuncios', href: '/announcements', icon: Bell },
          { title: 'Configuración', href: '/settings', icon: Settings }
        ]
      }
    ],

    school: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Invitaciones', href: '/invitations', icon: Send },
          { title: 'Estudiantes', href: '/students', icon: Users },
          { title: 'Entrenadores', href: '/staff', icon: Users }
        ]
      },
      {
        title: 'Gestión Deportiva',
        items: [
          {
            title: 'Equipos y Planes',
            icon: Users,
            submenu: [
              { title: 'Mis Equipos', href: '/teams', icon: Users },
              { title: 'Mis Planes', href: '/offerings', icon: FileText }
            ]
          },
          { title: 'Calendario', href: '/calendar', icon: Calendar },
          {
            title: 'Asistencias',
            icon: BarChart3,
            submenu: [
              { title: 'Supervisión', href: '/attendance-supervision', icon: BarChart3 },
              { title: 'Encuestas', href: '/dashboard/polls', icon: ClipboardList },
            ],
          },
          { title: 'Resultados', href: '/results-overview', icon: Trophy }
        ]
      },
      // Explorar se oculta en rol school: solo visible para athlete y parent.
      // {
      //   title: 'Tienda',
      //   items: [
      //     { title: 'Productos de la Escuela', href: '/products', icon: ShoppingBag },
      //     { title: 'Pedidos', href: '/orders', icon: ShoppingBag }
      //   ]
      // },
      {
        title: 'Administración',
        items: [
          { title: 'Pagos', href: '/payments-automation', icon: DollarSign },
          { title: 'Recordatorios', href: '/payment-reminders', icon: Bell },
          { title: 'Plantillas', href: '/message-templates', icon: MessageSquare },
          { title: 'Finanzas', href: '/finances', icon: DollarSign },
          { title: 'Reportes', href: '/school-reports', icon: FileText },
          { title: 'Sedes', href: '/branches', icon: MapPin },
          { title: 'Instalaciones', href: '/facilities', icon: Building },
        ]
      },
      {
        title: 'Perfil',
        items: [
          { title: 'Mi Perfil Público', href: '/school/public-profile', icon: User },
          { title: 'Configuración', href: '/settings', icon: Settings },
        ]
      }
    ],

    wellness_professional: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard Vendedor', href: '/vendor/dashboard', icon: Home },
          { title: 'Mis Atletas', href: '/athletes', icon: Users },
          { title: 'Agenda', href: '/schedule', icon: Calendar }
        ]
      },
      {
        title: 'Marketplace',
        items: [
          { title: 'Mis Servicios', href: '/vendor/services', icon: Activity },
          { title: 'Citas Reservadas', href: '/vendor/appointments', icon: Calendar },
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
          { title: 'Reportes', href: '/wellness-reports', icon: FileText },
          { title: 'Configuración', href: '/settings', icon: Settings }
        ]
      }
    ],

    store_owner: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard Vendedor', href: '/vendor/dashboard', icon: Home },
          { title: 'Mis Productos', href: '/vendor/products', icon: ShoppingBag },
          { title: 'Pedidos', href: '/orders', icon: FileText },
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
          { title: 'Promociones', href: '/promotions', icon: Trophy },
          { title: 'Configuración', href: '/settings', icon: Settings }
        ]
      }
    ],

    admin: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Invitaciones', href: '/invitations', icon: Send },
          { title: 'Estudiantes', href: '/students', icon: Users },
          { title: 'Entrenadores', href: '/staff', icon: Users }
        ]
      },
      {
        title: 'Gestión Deportiva',
        items: [
          {
            title: 'Equipos y Planes',
            icon: Users,
            submenu: [
              { title: 'Mis Equipos', href: '/teams', icon: Users },
              { title: 'Mis Planes', href: '/offerings', icon: FileText }
            ]
          },
          { title: 'Calendario', href: '/calendar', icon: Calendar },
          {
            title: 'Asistencias',
            icon: BarChart3,
            submenu: [
              { title: 'Supervisión', href: '/attendance-supervision', icon: BarChart3 },
              { title: 'Encuestas', href: '/dashboard/polls', icon: ClipboardList },
            ],
          },
          { title: 'Resultados', href: '/results-overview', icon: Trophy }
        ]
      },
      {
        title: 'Administración',
        items: [
          { title: 'Pagos', href: '/payments-automation', icon: DollarSign },
          { title: 'Recordatorios', href: '/payment-reminders', icon: Bell },
          { title: 'Plantillas', href: '/message-templates', icon: MessageSquare },
          { title: 'Finanzas', href: '/finances', icon: DollarSign },
          { title: 'Reportes', href: '/school-reports', icon: FileText },
          { title: 'Sedes', href: '/branches', icon: MapPin },
          { title: 'Instalaciones', href: '/facilities', icon: Building },
          { title: 'Configuración', href: '/settings', icon: Settings }
        ]
      }
    ],

    super_admin: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Invitaciones', href: '/invitations', icon: Send },
          { title: 'Estudiantes', href: '/students', icon: Users },
          { title: 'Entrenadores', href: '/staff', icon: Users }
        ]
      },
      {
        title: 'Gestión Deportiva',
        items: [
          {
            title: 'Equipos y Planes',
            icon: Users,
            submenu: [
              { title: 'Mis Equipos', href: '/teams', icon: Users },
              { title: 'Mis Planes', href: '/offerings', icon: FileText }
            ]
          },
          { title: 'Calendario', href: '/calendar', icon: Calendar },
          {
            title: 'Asistencias',
            icon: BarChart3,
            submenu: [
              { title: 'Supervisión', href: '/attendance-supervision', icon: BarChart3 },
              { title: 'Encuestas', href: '/dashboard/polls', icon: ClipboardList },
            ],
          },
          { title: 'Resultados', href: '/results-overview', icon: Trophy }
        ]
      },
      {
        title: 'Administración',
        items: [
          { title: 'Pagos', href: '/payments-automation', icon: DollarSign },
          { title: 'Recordatorios', href: '/payment-reminders', icon: Bell },
          { title: 'Plantillas', href: '/message-templates', icon: MessageSquare },
          { title: 'Finanzas', href: '/finances', icon: DollarSign },
          { title: 'Reportes', href: '/school-reports', icon: FileText },
          { title: 'Sedes', href: '/branches', icon: MapPin },
          { title: 'Instalaciones', href: '/facilities', icon: Building },
          { title: 'Configuración', href: '/settings', icon: Settings }
        ]
      }
    ],

    school_admin: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Invitaciones', href: '/invitations', icon: Send },
          { title: 'Estudiantes', href: '/students', icon: Users },
          { title: 'Entrenadores', href: '/staff', icon: Users }
        ]
      },
      {
        title: 'Gestión Deportiva',
        items: [
          {
            title: 'Equipos y Planes',
            icon: Users,
            submenu: [
              { title: 'Mis Equipos', href: '/teams', icon: Users },
              { title: 'Mis Planes', href: '/offerings', icon: FileText }
            ]
          },
          { title: 'Calendario', href: '/calendar', icon: Calendar },
          {
            title: 'Asistencias',
            icon: BarChart3,
            submenu: [
              { title: 'Supervisión', href: '/attendance-supervision', icon: BarChart3 },
              { title: 'Encuestas', href: '/dashboard/polls', icon: ClipboardList },
            ],
          },
          { title: 'Resultados', href: '/results-overview', icon: Trophy }
        ]
      },
      {
        title: 'Administración',
        items: [
          { title: 'Pagos', href: '/payments-automation', icon: DollarSign },
          { title: 'Recordatorios', href: '/payment-reminders', icon: Bell },
          { title: 'Plantillas', href: '/message-templates', icon: MessageSquare },
          { title: 'Finanzas', href: '/finances', icon: DollarSign },
          { title: 'Reportes', href: '/school-reports', icon: FileText },
          { title: 'Sedes', href: '/branches', icon: MapPin },
          { title: 'Instalaciones', href: '/facilities', icon: Building },
          { title: 'Configuración', href: '/settings', icon: Settings }
        ]
      }
    ],

    organizer: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/organizer/dashboard', icon: Home },
          { title: 'Crear Evento', href: '/organizer/create-event', icon: Plus },
        ]
      },
      {
        title: 'Gestión',
        items: [
          { title: 'Mis Eventos', href: '/organizer/events', icon: Ticket },
          { title: 'Calendario', href: '/organizer/calendar', icon: Calendar },
          { title: 'Finanzas', href: '/organizer/finances', icon: DollarSign },
          { title: 'Reportes', href: '/organizer/reports', icon: BarChart3 },
        ]
      },
      {
        title: 'Cuenta',
        items: [
          { title: 'Perfil', href: '/organizer/profile', icon: Users },
          { title: 'Configuración', href: '/organizer/settings', icon: Settings }
        ]
      }
    ],

    reporter: [
      {
        title: 'Reportes',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: '📊 Panel de Reportes', href: '/reporter-dashboard', icon: BarChart3 },
          { title: 'Calendario', href: '/calendar', icon: Calendar },
        ]
      },
      {
        title: 'Cuenta',
        items: [
          { title: 'Notificaciones', href: '/notifications', icon: Bell },
          { title: 'Configuración', href: '/settings', icon: Settings }
        ]
      }
    ],

    personal_trainer: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/trainer/dashboard', icon: Home },
          { title: 'Mis Clientes', href: '/trainer/clients', icon: Users },
          { title: 'Disponibilidad', href: '/trainer/availability', icon: Calendar },
        ]
      },
      {
        title: 'Negocio',
        items: [
          { title: 'Mis Planes', href: '/trainer/plans', icon: FileText },
          { title: 'Mis Rutinas', href: '/trainer/routines', icon: Dumbbell },
          { title: 'Pagos', href: '/trainer/payments', icon: DollarSign },
        ]
      },
      {
        title: 'Mi Actividad',
        items: [
          { title: 'Mis Inscripciones', href: '/enrollments', icon: Trophy },
        ]
      },
      {
        title: 'Perfil',
        items: [
          { title: 'Mi Perfil Público', href: '/trainer/profile', icon: User },
          { title: 'Configuración', href: '/settings', icon: Settings },
        ]
      }
    ],
  };

  return roleSpecificNav[role] || [baseNav];
}
