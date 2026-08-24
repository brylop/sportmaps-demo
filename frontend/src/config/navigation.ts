import {
  Home,
  Calendar,
  Landmark,
  PieChart,
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
  ClipboardList,
  IdCard,
  FileCheck2,
  QrCode,
  Truck,
  ShieldCheck,
  CreditCard,
  MonitorSpeaker,
  History,
  TrendingUp
} from 'lucide-react';
import { UserRole } from '@/types/dashboard';
import { SHOW_EXPLORE } from '@/lib/feature-flags';
import type { AddonKey } from '@/config/saas-plans';

export interface NavItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
  submenu?: NavItem[];
  /** Si la escuela no tiene este addon, el ítem (o el grupo entero, si queda vacío) se oculta. */
  addon?: AddonKey;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * "Mi Tienda" — grupo de navegación adicional que se renderiza al final
 * del sidebar SOLO para usuarios con vendor_profile activo (cualquier rol).
 * No depende del rol principal. Lo monta AppSidebar.
 */
export function getVendorNavGroup(opts: {
  canSellProducts: boolean;
  canSellServices: boolean;
  verificationStatus: 'pending' | 'verified' | 'rejected' | null;
}): NavGroup {
  const items: NavItem[] = [
    { title: 'Panel Tienda', href: '/vendor/dashboard', icon: ShoppingBag },
  ];

  if (opts.canSellProducts) {
    items.push({ title: 'Productos',  href: '/vendor/products',  icon: ShoppingBag });
    items.push({ title: 'Inventario', href: '/inventory',        icon: ClipboardList });
  }
  if (opts.canSellServices) {
    items.push({ title: 'Servicios',  href: '/vendor/services',  icon: Activity });
    items.push({ title: 'Agenda',     href: '/vendor/appointments', icon: Calendar });
  }
  items.push({ title: 'Pedidos',         href: '/orders',           icon: FileText });
  items.push({ title: 'Inbox',           href: '/vendor/inbox',     icon: MessageSquare });
  items.push({ title: 'Liquidaciones',   href: '/vendor/payouts',   icon: DollarSign });
  items.push({ title: 'Envíos',          href: '/vendor/shipping',  icon: Truck });
  items.push({ title: 'Promociones',     href: '/vendor/promotions', icon: Plus });
  items.push({
    title: 'Verificación',
    href:  '/vendor/onboarding',
    icon:  FileCheck2,
    badge: opts.verificationStatus === 'pending' ? 'pendiente'
         : opts.verificationStatus === 'rejected' ? 'revisar'
         : undefined,
  });

  return { title: 'Mi Tienda', items };
}

// ── "Gestión Deportiva" (school / school_admin) ─────────────────────────
// Única fuente para las dos: comparten exactamente las mismas rutas, y las
// dos versiones ya habían divergido (a school_admin le faltaba "Métricas y
// Rendimiento" aunque routePermissions.ts sí lo autoriza). "Entrenamiento"
// agrupa Métricas+Rutinas igual que ya hacían "Equipos y Planes" y
// "Asistencias". "Mis Torneos" NO se agrupa con "Resultados": es su propio
// módulo (`MOD-7` en el roadmap — inscripción + bracket + motor de puntaje,
// con rutas propias /school/tournaments, /new, /:id), no un simple listado.
const GESTION_DEPORTIVA_ESCUELA: NavItem[] = [
  {
    title: 'Equipos y Planes',
    icon: Users,
    submenu: [
      { title: 'Mis Equipos', href: '/teams', icon: Users },
      { title: 'Deportes y Categorías', href: '/school-sports', icon: Trophy },
      { title: 'Membresías', href: '/memberships', icon: IdCard },
      { title: 'Mis Planes', href: '/offerings', icon: FileText }
    ]
  },
  { title: 'Calendario', href: '/calendar', icon: Calendar },
  {
    title: 'Entrenamiento',
    icon: Activity,
    submenu: [
      { title: 'Métricas y Rendimiento', href: '/training-plans', icon: Activity },
      { title: 'Gestión de Rutinas', href: '/school/routines', icon: Dumbbell },
    ]
  },
  { title: 'Informe Mensual', href: '/informe-mensual', icon: FileText },
  {
    title: 'Asistencias',
    icon: BarChart3,
    submenu: [
      { title: 'Supervisión', href: '/attendance-supervision', icon: BarChart3 },
      { title: 'Histórico', href: '/attendance-history', icon: History },
      { title: 'Encuestas', href: '/dashboard/polls', icon: ClipboardList },
    ],
  },
  { title: 'Resultados', href: '/results-overview', icon: Trophy },
  { title: 'Mis Torneos', href: '/school/tournaments', icon: Trophy, addon: 'tournaments' },
  { title: 'Dotación', href: '/school/equipment', icon: Dumbbell },
];

/**
 * Filtra por addon (UX-3): un ítem con `addon` desaparece si la escuela no lo
 * tiene. Si un ítem tenía `submenu` y todos sus hijos quedaron filtrados, el
 * ítem completo se oculta en vez de mostrar un padre sin hijos.
 */
function filterByAddon(items: NavItem[], hasAddon: (key: AddonKey) => boolean): NavItem[] {
  return items
    .filter(item => !item.addon || hasAddon(item.addon))
    .map(item => item.submenu ? { ...item, submenu: filterByAddon(item.submenu, hasAddon) } : item)
    .filter(item => !item.submenu || item.submenu.length > 0);
}

/**
 * Returns navigation structure based on user role. `hasAddon` es opcional
 * (default: todo visible) para no romper si algún caller no lo pasa —
 * `AppSidebar.tsx` sí lo pasa siempre, con el `hasAddon` de `useEntitlements()`.
 */
export function getNavigationByRole(
  role: UserRole,
  hasAddon: (key: AddonKey) => boolean = () => true,
): NavGroup[] {
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
          { title: 'Mis Pagos', href: '/athlete-payments', icon: DollarSign },
          ...(SHOW_EXPLORE ? [{ title: 'Explorar', href: '/explorar', icon: MapPin }] : []),
        ]
      },
      {
        title: 'Mi Rendimiento',
        items: [
          { title: 'Estadísticas', href: '/stats', icon: BarChart3 },
          { title: 'Objetivos', href: '/goals', icon: Target },
          { title: 'Entrenamientos', href: '/training', icon: Activity }
        ]
      },
      {
        title: 'Actividad Deportiva',
        items: [
          { title: 'Mis Inscripciones', href: '/enrollments', icon: Trophy },
          { title: 'Mis Eventos', href: '/my-event-registrations', icon: Calendar },
        ]
      },
      {
        title: 'Bienestar',
        items: [
          { title: 'Explorar Bienestar', href: '/wellness', icon: Heart },
          { title: 'Mis Citas', href: '/wellness/appointments', icon: Calendar },
        ]
      },
      {
        title: 'Tienda',
        items: [
          { title: 'Catálogo', href: '/shop', icon: ShoppingBag },
        ]
      },
      {
        title: 'Documentos',
        items: [
          { title: 'Mis Carnets', href: '/my-cards', icon: IdCard },
        ]
      },
      {
        title: 'Cuenta',
        items: [
          // Sin 'Facturación': /mi-plan es el plan SaaS que la ESCUELA le paga a
          // SportMaps. Un atleta no lo administra y no debe ver ni el tier ni el
          // conteo de alumnos activos de la escuela.
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
          { title: 'Pagos', href: '/my-payments', icon: DollarSign },
          { title: 'Tienda', href: '/mi-tienda', icon: ShoppingBag }
        ]
      },
      {
        title: 'Mi Actividad',
        items: [
          { title: 'Mensajes', href: '/messages', icon: MessageSquare },
          { title: 'Mis Inscripciones', href: '/enrollments', icon: Trophy },
          { title: 'Mis Eventos', href: '/my-event-registrations', icon: Calendar },
          { title: 'Mis Citas', href: '/wellness/appointments', icon: Heart },
          { title: 'Carnets de mis hijos', href: '/my-cards', icon: IdCard },
          { title: 'Mis Constancias', href: '/my-certificates', icon: FileCheck2 },
          // Sin 'Facturación': /mi-plan es el plan SaaS de la escuela, no del padre.
          // Sus propios cobros están en 'Pagos' (/my-payments).
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
          { title: 'Mi Dotación', href: '/coach/dotacion', icon: Dumbbell },
          { title: 'Mis Deportistas', href: '/students', icon: Users },
          { title: 'Calendario', href: '/calendar', icon: Calendar }
        ]
      },
      {
        title: 'Gestión',
        items: [
          {
            title: 'Entrenamiento',
            icon: Activity,
            submenu: [
              { title: 'Métricas y Rendimiento', href: '/training-plans', icon: Activity },
              { title: 'Gestión de Rutinas', href: '/school/routines', icon: Dumbbell },
            ]
          },
          {
            title: 'Asistencias',
            icon: BarChart3,
            submenu: [
              { title: 'Supervisión', href: '/coach-attendance', icon: BarChart3 },
              { title: 'Encuestas', href: '/dashboard/polls', icon: ClipboardList },
            ],
          },
          { title: 'Resultados', href: '/results', icon: Trophy },
          { title: 'Reportes', href: '/coach-reports', icon: FileText },
          { title: 'Informe Mensual', href: '/informe-mensual', icon: FileText }
        ]
      },
      {
        title: 'Comunicación',
        items: [
          { title: 'Mensajes', href: '/messages', icon: MessageSquare },
          { title: 'Anuncios', href: '/announcements', icon: Bell },
          // Sin 'Facturación': el coach está asociado a la escuela, no contrata su
          // plan. El entrenador independiente sí ve el suyo — ese es el rol
          // 'personal_trainer', que tiene su propio menú.
          { title: 'Configuración', href: '/settings', icon: Settings }
        ]
      }
    ],

    school: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Deportistas', href: '/students', icon: Users },
          { title: 'Entrenadores', href: '/staff', icon: Users },
          { title: 'Invitaciones', href: '/invitations', icon: Send },
        ]
      },
      {
        title: 'Gestión Deportiva',
        items: GESTION_DEPORTIVA_ESCUELA
      },
      {
        // Solo operación de dinero: cobrar, recibir en sede, y contabilidad.
        // Los destinos de "mirar reportes" se separaron al grupo "Reportes".
        title: 'Finanzas',
        items: [
          { title: 'Pagos', href: '/payments-automation', icon: DollarSign },
          { title: 'Modo Recepción', href: '/recepcion', icon: MonitorSpeaker },
          {
            title: 'Contabilidad',
            icon: BookOpen,
            // Gateado en el GRUPO, no en cada hijo: si la escuela no tiene el
            // addon 'accounting', el submenu entero desaparece de una vez.
            addon: 'accounting',
            submenu: [
              { title: 'Contabilidad', href: '/accounting', icon: BookOpen },
              { title: 'Proveedores', href: '/accounting/suppliers', icon: Truck },
              { title: 'Nómina', href: '/accounting/payroll', icon: Landmark },
              { title: 'Estado de resultados', href: '/accounting/reports', icon: TrendingUp },
              { title: 'Presupuesto', href: '/accounting/budget', icon: PieChart },
            ],
          },
        ]
      },
      {
        // Antes vivían dentro de "Finanzas" junto a Pagos/Contabilidad — se
        // separan porque son destinos de "ver reportes", no de operar dinero.
        title: 'Reportes',
        items: [
          { title: 'Finanzas', href: '/finances', icon: DollarSign },
          { title: 'Reportes', href: '/school-reports', icon: FileText },
          // Antes "Cartera por Estado" en un lado y "📊 Panel de Reportes" en
          // el rol reporter — mismo destino, dos nombres (y un emoji hardcodeado).
          { title: 'Panel de Reportes', href: '/reporter-dashboard', icon: BarChart3 },
        ]
      },
      {
        title: 'Documentos e Identidad',
        items: [
          {
            title: 'Carnets',
            icon: IdCard,
            submenu: [
              { title: 'Carnets Digitales', href: '/cards', icon: IdCard },
              { title: 'Plantillas de Carnets', href: '/cards/templates/certificates', icon: FileText },
            ],
          },
          { title: 'Constancias', href: '/certificates', icon: FileCheck2 },
          { title: 'QR de Inscripción', href: '/qr-signup', icon: QrCode },
          // Movidos acá desde "Finanzas": son comunicación con la familia, no
          // operación de dinero.
          { title: 'Recordatorios', href: '/payment-reminders', icon: Bell },
          { title: 'Plantillas de Mensajes', href: '/message-templates', icon: MessageSquare },
        ]
      },
      {
        title: 'Sedes e Instalaciones',
        items: [
          { title: 'Sedes', href: '/branches', icon: MapPin },
          { title: 'Instalaciones', href: '/facilities', icon: Building },
          { title: 'Control de Acceso', href: '/school/access-control', icon: ShieldCheck, addon: 'access_control' },
        ]
      },
      {
        title: 'Cuenta',
        items: [
          { title: 'Mi Perfil Público', href: '/school/public-profile', icon: User },
          { title: 'Facturación', href: '/mi-plan', icon: CreditCard },
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
        ]
      },
      {
        title: 'Perfil',
        items: [
          { title: 'Mi Perfil Público', href: '/vendor/public-profile', icon: User },
          { title: 'Facturación', href: '/mi-plan', icon: CreditCard },
          { title: 'Configuración', href: '/settings', icon: Settings },
        ]
      }
    ],

    store_owner: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard Vendedor', href: '/vendor/dashboard', icon: Home },
          { title: 'Mis Productos', href: '/vendor/products', icon: ShoppingBag },
          { title: 'Pedidos', href: '/orders', icon: ShoppingBag },
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
        ]
      },
      {
        title: 'Perfil',
        items: [
          { title: 'Mi Perfil Público', href: '/vendor/public-profile', icon: User },
          { title: 'Facturación', href: '/mi-plan', icon: CreditCard },
          { title: 'Configuración', href: '/settings', icon: Settings },
        ]
      }
    ],

    admin: [
      {
        title: 'Plataforma',
        items: [
          { title: 'Dashboard',           href: '/admin',                icon: Home },
          { title: 'Logs y actividad',    href: '/admin/activity-logs',  icon: BarChart3 },
          { title: 'Analítica',           href: '/admin/analytics',      icon: BarChart3 }
        ]
      },
      {
        title: 'Gestión Global',
        items: [
          { title: 'Escuelas',  href: '/admin/schools', icon: Building },
          { title: 'Suscripciones', href: '/admin/subscriptions', icon: DollarSign },
          { title: 'Usuarios',  href: '/admin/users',   icon: Users },
          { title: 'Reportes',  href: '/admin/reports', icon: FileText }
        ]
      },
      {
        title: 'Sistema',
        items: [
          { title: 'Configuración',     href: '/admin/config',  icon: Settings },
          { title: 'Notificaciones',    href: '/notifications', icon: Bell },
          { title: 'Mensajes',          href: '/messages',      icon: MessageSquare },
          { title: 'Facturación',       href: '/mi-plan',       icon: CreditCard }
        ]
      }
    ],

    super_admin: [
      {
        title: 'Plataforma',
        items: [
          { title: 'Dashboard', href: '/admin', icon: Home },
          { title: 'Logs y actividad', href: '/admin/activity-logs', icon: BarChart3 },
          { title: 'Analítica', href: '/admin/analytics', icon: BarChart3 }
        ]
      },
      {
        title: 'Gestión Global',
        items: [
          { title: 'Escuelas', href: '/admin/schools', icon: Building },
          { title: 'Suscripciones', href: '/admin/subscriptions', icon: DollarSign },
          { title: 'Usuarios', href: '/admin/users', icon: Users },
          { title: 'Reportes', href: '/admin/reports', icon: FileText }
        ]
      },
      {
        title: 'Moderación',
        items: [
          { title: 'Marketplace',     href: '/admin/marketplace/moderation', icon: ShieldCheck },
          { title: 'Pagos a vendors', href: '/admin/payouts',                icon: DollarSign }
        ]
      },
      {
        title: 'Sistema',
        items: [
          { title: 'Configuración', href: '/admin/config', icon: Settings },
          { title: 'Parámetros de Nómina', href: '/admin/payroll-config', icon: Landmark },
          { title: 'Notificaciones', href: '/notifications', icon: Bell }
        ]
      }
    ],

    school_admin: [
      {
        title: 'Principal',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Deportistas', href: '/students', icon: Users },
          { title: 'Entrenadores', href: '/staff', icon: Users },
          { title: 'Invitaciones', href: '/invitations', icon: Send },
        ]
      },
      {
        title: 'Gestión Deportiva',
        items: GESTION_DEPORTIVA_ESCUELA
      },
      {
        // Solo operación de dinero: cobrar, recibir en sede, y contabilidad.
        // Los destinos de "mirar reportes" se separaron al grupo "Reportes".
        title: 'Finanzas',
        items: [
          { title: 'Pagos', href: '/payments-automation', icon: DollarSign },
          { title: 'Modo Recepción', href: '/recepcion', icon: MonitorSpeaker },
          {
            title: 'Contabilidad',
            icon: BookOpen,
            // Gateado en el GRUPO, no en cada hijo: si la escuela no tiene el
            // addon 'accounting', el submenu entero desaparece de una vez.
            addon: 'accounting',
            submenu: [
              { title: 'Contabilidad', href: '/accounting', icon: BookOpen },
              { title: 'Proveedores', href: '/accounting/suppliers', icon: Truck },
              { title: 'Nómina', href: '/accounting/payroll', icon: Landmark },
              { title: 'Estado de resultados', href: '/accounting/reports', icon: TrendingUp },
              { title: 'Presupuesto', href: '/accounting/budget', icon: PieChart },
            ],
          },
        ]
      },
      {
        // Antes vivían dentro de "Finanzas" junto a Pagos/Contabilidad — se
        // separan porque son destinos de "ver reportes", no de operar dinero.
        title: 'Reportes',
        items: [
          { title: 'Finanzas', href: '/finances', icon: DollarSign },
          { title: 'Reportes', href: '/school-reports', icon: FileText },
          // Antes "Cartera por Estado" en un lado y "📊 Panel de Reportes" en
          // el rol reporter — mismo destino, dos nombres (y un emoji hardcodeado).
          { title: 'Panel de Reportes', href: '/reporter-dashboard', icon: BarChart3 },
        ]
      },
      {
        title: 'Documentos e Identidad',
        items: [
          {
            title: 'Carnets',
            icon: IdCard,
            submenu: [
              { title: 'Carnets Digitales', href: '/cards', icon: IdCard },
              { title: 'Plantillas de Carnets', href: '/cards/templates/certificates', icon: FileText },
            ],
          },
          { title: 'Constancias', href: '/certificates', icon: FileCheck2 },
          { title: 'QR de Inscripción', href: '/qr-signup', icon: QrCode },
          // Movidos acá desde "Finanzas": son comunicación con la familia, no
          // operación de dinero.
          { title: 'Recordatorios', href: '/payment-reminders', icon: Bell },
          { title: 'Plantillas de Mensajes', href: '/message-templates', icon: MessageSquare },
        ]
      },
      {
        title: 'Sedes e Instalaciones',
        items: [
          { title: 'Sedes', href: '/branches', icon: MapPin },
          { title: 'Instalaciones', href: '/facilities', icon: Building },
          { title: 'Control de Acceso', href: '/school/access-control', icon: ShieldCheck, addon: 'access_control' },
        ]
      },
      {
        title: 'Cuenta',
        items: [
          { title: 'Facturación', href: '/mi-plan', icon: CreditCard },
          { title: 'Configuración', href: '/settings', icon: Settings },
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
          { title: 'Facturación', href: '/mi-plan', icon: CreditCard },
          { title: 'Configuración', href: '/organizer/settings', icon: Settings }
        ]
      }
    ],

    reporter: [
      {
        title: 'Reportes',
        items: [
          { title: 'Dashboard', href: '/dashboard', icon: Home },
          { title: 'Panel de Reportes', href: '/reporter-dashboard', icon: BarChart3 },
          { title: 'Calendario', href: '/calendar', icon: Calendar },
        ]
      },
      {
        title: 'Cuenta',
        items: [
          { title: 'Notificaciones', href: '/notifications', icon: Bell },
          { title: 'Facturación', href: '/mi-plan', icon: CreditCard },
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
          { title: 'Facturación', href: '/mi-plan', icon: CreditCard },
          { title: 'Configuración', href: '/settings', icon: Settings },
        ]
      }
    ],
  };

  const groups = roleSpecificNav[role] || [baseNav];
  return groups
    .map(group => ({ ...group, items: filterByAddon(group.items, hasAddon) }))
    .filter(group => group.items.length > 0);
}
