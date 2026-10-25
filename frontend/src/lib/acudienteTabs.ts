/**
 * Pestañas V2 por rol y las pantallas que viven dentro de cada una. Lo usan la
 * barra inferior (qué pestaña se enciende) y el «Volver» de las pantallas
 * internas (a qué pestaña regresa si no hay historial).
 *
 * Acudiente: docs/specs/modulos-v2-definicion.md §4.
 * Entrenador y Deportista: docs/specs/entrenador-deportista-v2.md §5.
 */
import { ACUDIENTE_V2, DEPORTISTA_V2, ENTRENADOR_V2 } from '@/lib/feature-flags';

export interface PestanaAcudiente {
  href: string;
  label: string;
  /** Rutas internas que pertenecen a esta pestaña. */
  also: string[];
}

export const PESTANAS_ACUDIENTE: PestanaAcudiente[] = [
  { href: '/dashboard', label: 'Inicio', also: [] },
  { href: '/calendar', label: 'Calendario', also: ['/my-event-registrations', '/tournaments'] },
  { href: '/children', label: 'Hijos', also: ['/academic-progress', '/parent-attendance'] },
  { href: '/my-payments', label: 'Pagos', also: ['/estado-cuenta', '/payment-result'] },
  {
    href: '/mas', label: 'Más',
    also: ['/enrollments', '/my-cards', '/my-certificates', '/mi-tienda', '/mis-compras', '/salud', '/wellness', '/settings', '/profile', '/notifications', '/messages', '/explorar'],
  },
];

export const PESTANAS_ENTRENADOR: PestanaAcudiente[] = [
  { href: '/dashboard', label: 'Hoy', also: [] },
  { href: '/teams', label: 'Equipos', also: ['/students', '/results', '/coach/evaluar'] },
  { href: '/training-plans', label: 'Sesiones', also: [] },
  { href: '/coach-attendance', label: 'Asistencia', also: ['/school/attendance-sheets', '/attendance-history'] },
  {
    // Informe mensual, informes del entreno y rutinas se abren desde «Más»: el «Volver» lleva ahí.
    href: '/mas', label: 'Más',
    also: ['/coach-plans', '/coach/dotacion', '/disponibilidad-medica', '/calendar', '/messages', '/announcements', '/dashboard/polls', '/settings', '/profile', '/notifications', '/vendor', '/informe-mensual', '/coach-reports', '/school/routines', '/ayuda'],
  },
];

export const PESTANAS_DEPORTISTA: PestanaAcudiente[] = [
  { href: '/dashboard', label: 'Hoy', also: ['/post-entreno'] },
  { href: '/training', label: 'Entrenos', also: [] },
  { href: '/stats', label: 'Progreso', also: [] },
  { href: '/my-cards', label: 'Carnet', also: [] },
  {
    href: '/mas', label: 'Más',
    also: ['/athlete-payments', '/my-payments', '/estado-cuenta', '/payment-result', '/enrollments', '/my-event-registrations', '/tournaments', '/calendar', '/salud', '/wellness', '/mi-tienda', '/mis-compras', '/settings', '/profile', '/notifications', '/messages', '/goals', '/ayuda'],
  },
];

/** Pestañas V2 del rol, o null si ese rol no tiene V2 (o su interruptor está apagado). */
export function pestanasDeRol(role: string | null | undefined): PestanaAcudiente[] | null {
  if (role === 'parent' && ACUDIENTE_V2) return PESTANAS_ACUDIENTE;
  if (role === 'coach' && ENTRENADOR_V2) return PESTANAS_ENTRENADOR;
  if (role === 'athlete' && DEPORTISTA_V2) return PESTANAS_DEPORTISTA;
  return null;
}

/** La pestaña dueña de una ruta (o null si la ruta no es de ese rol). */
export function pestanaDe(pathname: string, pestanas: PestanaAcudiente[] = PESTANAS_ACUDIENTE): PestanaAcudiente | null {
  return pestanas.find((p) =>
    pathname === p.href || (p.href !== '/dashboard' && pathname.startsWith(p.href)) || p.also.some((r) => pathname.startsWith(r)),
  ) ?? null;
}

/** ¿Es la pantalla raíz de una pestaña? (ahí no hace falta «Volver»). */
export const esRaizDePestana = (pathname: string, pestanas: PestanaAcudiente[] = PESTANAS_ACUDIENTE) =>
  pestanas.some((p) => p.href === pathname);
