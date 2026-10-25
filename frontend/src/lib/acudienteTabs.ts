/**
 * Las cinco pestañas del acudiente V2 y las pantallas que viven dentro de cada
 * una. Lo usan la barra inferior (qué pestaña se enciende) y el «Volver» de las
 * pantallas internas (a qué pestaña regresa si no hay historial).
 */
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

/** La pestaña dueña de una ruta (o null si la ruta no es del acudiente). */
export function pestanaDe(pathname: string): PestanaAcudiente | null {
  return PESTANAS_ACUDIENTE.find((p) =>
    pathname === p.href || (p.href !== '/dashboard' && pathname.startsWith(p.href)) || p.also.some((r) => pathname.startsWith(r)),
  ) ?? null;
}

/** ¿Es la pantalla raíz de una pestaña? (ahí no hace falta «Volver»). */
export const esRaizDePestana = (pathname: string) => PESTANAS_ACUDIENTE.some((p) => p.href === pathname);
