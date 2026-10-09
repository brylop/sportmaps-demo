/**
 * Resuelve y normaliza el link de una notificación para asegurar que lleve
 * al destino correcto según el rol del usuario y las rutas válidas de la aplicación.
 */

export function resolveNotificationLink(
  link?: string | null,
  role?: string | null,
  category?: string | null,
  type?: string | null
): string | null {
  const raw = (link || '').trim();

  // 1. Si viene un link explícito, normalizamos rutas desactualizadas o desalineadas con el rol
  if (raw) {
    // Caso pagos según rol: un padre no tiene acceso a /athlete-payments (ruta protegida solo para atletas)
    if (raw === '/athlete-payments' && role === 'parent') {
      return '/my-payments';
    }
    // Si un atleta recibe /my-payments, dirigirlo a su panel de pagos de atleta si aplica
    if (raw === '/my-payments' && role === 'athlete') {
      return '/athlete-payments';
    }

    // Caso asistencias (rutas que no existían en App.tsx)
    if (raw === '/my-attendance' || raw === '/attendance') {
      if (role === 'coach') return '/coach-attendance';
      if (role === 'parent') return '/parent-attendance';
      return '/parent-attendance';
    }
    if (raw === '/school/attendance') {
      return '/attendance-supervision';
    }

    // Caso certificados y carnets escolares
    if (raw === '/admin/certificates') {
      return '/certificates';
    }
    if (raw === '/admin/cards') {
      return '/cards';
    }

    // Caso solicitudes de upgrade de plan
    if (raw.startsWith('/admin/upgrade-requests')) {
      return '/admin/upgrade-requests';
    }

    // Caso agenda de profesionales de salud
    if (raw === '/wellness/schedule') {
      return '/schedule';
    }

    return raw;
  }

  // 2. Fallbacks inteligentes si la notificación llegó sin link (link = null o vacío)
  const cat = (category || '').toLowerCase();
  const typ = (type || '').toLowerCase();

  // Pagos y cobros
  if (cat === 'payment' || cat === 'installment' || typ.includes('payment') || typ.includes('charge')) {
    if (role === 'school' || role === 'admin' || role === 'school_admin' || role === 'owner') {
      return '/payments-automation';
    }
    if (role === 'athlete') {
      return '/athlete-payments';
    }
    return '/my-payments';
  }

  // Glosas y revisiones de comprobantes
  if (cat === 'glosa' || typ.includes('glosa')) {
    if (role === 'school' || role === 'admin' || role === 'school_admin' || role === 'owner') {
      return '/payments-automation';
    }
    return '/my-payments';
  }

  // Asistencias y ausencias
  if (cat === 'attendance' || typ.includes('attendance') || typ.includes('absent')) {
    if (role === 'coach') return '/coach-attendance';
    if (role === 'school' || role === 'admin' || role === 'school_admin') return '/attendance-supervision';
    return '/parent-attendance';
  }

  // Calendario y eventos
  if (cat === 'calendar' || typ.includes('calendar') || typ.includes('event')) {
    return '/calendar';
  }

  // Inscripciones / Matrículas
  if (cat === 'enrollment' || typ.includes('enrollment') || typ.includes('signup') || typ.includes('prospecto')) {
    if (role === 'school' || role === 'admin' || role === 'school_admin' || role === 'owner') {
      return '/students';
    }
    return '/enrollments';
  }

  // Informes y reportes
  if (cat === 'report' || typ.includes('report')) {
    if (role === 'school' || role === 'admin' || role === 'school_admin' || role === 'owner') {
      return '/reports';
    }
    if (role === 'parent') {
      return '/children';
    }
    return '/stats';
  }

  // Dotación
  if (cat === 'dotacion' || typ.includes('equipment')) {
    if (role === 'coach') return '/coach/dotacion';
    return '/school/dotacion';
  }

  // Salud y citas de bienestar
  if (cat === 'salud' || typ.includes('wellness') || typ.includes('appointment')) {
    if (role === 'wellness_professional' || role === 'personal_trainer') {
      return '/schedule';
    }
    return '/wellness/appointments';
  }

  // Soporte
  if (cat === 'support' || typ.includes('support') || typ.includes('ticket')) {
    if (role === 'super_admin' || role === 'admin') {
      return '/admin/support';
    }
    return '/settings';
  }

  return null;
}
