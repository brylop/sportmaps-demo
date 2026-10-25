/**
 * Textos y reglas de pantalla de «Inscripciones y planes», «Eventos y torneos»
 * e «Inscribir a un torneo» (rediseño V2 del acudiente, 2026-10-24).
 *
 * Solo arma frases: nunca decide qué se cobra ni quién puede inscribirse.
 * Español de Colombia, de «tú». Palabras de V2Palabras: deportista, equipo,
 * plan, inscripción. Nunca el estado técnico («pending») en pantalla.
 */

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Primer nombre para frases cortas («Sofía tiene…»). */
export function primerNombre(nombre: string | null | undefined): string {
  return (nombre ?? '').trim().split(/\s+/)[0] ?? '';
}

export interface ResumenInscripciones {
  /** Primer nombre del deportista si quien mira es el acudiente; null = el propio deportista. */
  nombre: string | null;
  equipos: number;
  planes: number;
  /** Clases agendadas de hoy en adelante (lo ya pasado no cuenta). */
  clases: number;
  /** Reservas de instalación de hoy en adelante. */
  reservas: number;
}

/**
 * La frase de arriba: qué tiene activo y cuánto hay agendado.
 * «Sofía tiene 1 plan activo y 1 clase agendada.» / «No tienes equipos ni planes activos.»
 */
export function fraseResumen({ nombre, equipos, planes, clases, reservas }: ResumenInscripciones): string {
  const sujeto = nombre ? `${nombre} tiene` : 'Tienes';
  const partes: string[] = [];
  if (equipos > 0) partes.push(plural(equipos, 'equipo', 'equipos'));
  if (planes > 0) partes.push(plural(planes, 'plan', 'planes'));

  if (partes.length === 0) {
    return nombre ? `${nombre} no tiene equipos ni planes activos.` : 'No tienes equipos ni planes activos.';
  }
  const activo = equipos + planes === 1 ? 'activo' : 'activos';
  let frase = `${sujeto} ${partes.join(' y ')} ${activo}`;

  const agenda: string[] = [];
  if (clases > 0) agenda.push(plural(clases, 'clase agendada', 'clases agendadas'));
  if (reservas > 0) agenda.push(plural(reservas, 'reserva', 'reservas'));
  if (agenda.length > 0) frase += `, con ${agenda.join(' y ')}`;
  return `${frase}.`;
}

/** Saldo del plan en palabras: «Clases ilimitadas» / «3 clases disponibles» / «Sin clases disponibles». */
export function saldoDeClases(maxSesiones: number | null | undefined, usadas: number | null | undefined): string {
  if (maxSesiones === null || maxSesiones === undefined) return 'Clases ilimitadas';
  const quedan = Math.max(0, maxSesiones - (usadas ?? 0));
  if (quedan === 0) return 'Sin clases disponibles';
  return plural(quedan, 'clase disponible', 'clases disponibles');
}

/** «Vence hoy» / «Vence mañana» / «Vence en 12 días» / null si no tiene vencimiento. */
export function venceEn(expiresAt: string | null | undefined, ahora: number = Date.now()): string | null {
  if (!expiresAt) return null;
  const dias = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - ahora) / 86_400_000));
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
}

// ── Inscripciones a eventos y torneos ────────────────────────────────────────

export type TonoEstado = 'ok' | 'espera' | 'mal' | 'neutro';

/** Estado de una inscripción a evento/torneo en palabras de la familia. */
export function estadoInscripcionEvento(status: string | null | undefined): { label: string; tono: TonoEstado } {
  switch (status) {
    case 'approved':
    case 'confirmed':
      return { label: 'Inscripción aprobada', tono: 'ok' };
    case 'rejected':
      return { label: 'Rechazada', tono: 'mal' };
    case 'cancelled':
      return { label: 'Cancelada', tono: 'neutro' };
    case 'pending':
    default:
      return { label: 'Por aprobar', tono: 'espera' };
  }
}

/** Estado del pago de una inscripción a evento, o null si no hay nada que decir. */
export function estadoPagoEvento(paymentStatus: string | null | undefined): { label: string; tono: TonoEstado } | null {
  switch (paymentStatus) {
    case 'pending':
      return { label: 'Pago pendiente', tono: 'espera' };
    case 'verified':
    case 'paid':
    case 'approved':
      return { label: 'Pago verificado', tono: 'ok' };
    case 'rejected':
      return { label: 'Pago rechazado', tono: 'mal' };
    case 'not_required':
      return { label: 'Sin pago', tono: 'neutro' };
    default:
      return null;
  }
}

/** Frase de arriba de «Eventos y torneos». */
export function fraseEventos(regs: Array<{ status: string }>): string {
  if (regs.length === 0) return 'Aún no tienes inscripciones a eventos ni torneos.';
  const porAprobar = regs.filter((r) => r.status === 'pending').length;
  const base = `Tienes ${plural(regs.length, 'inscripción', 'inscripciones')}`;
  if (porAprobar === 0) return `${base}.`;
  return `${base}; ${porAprobar === 1 ? '1 está' : `${porAprobar} están`} por aprobar.`;
}

/** Clases de color (claro y oscuro) para cada tono de estado. */
export const CLASE_TONO: Record<TonoEstado, string> = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  espera: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  mal: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  neutro: 'bg-muted text-muted-foreground',
};

/** Fecha corta legible de una fecha ISO (YYYY-MM-DD o timestamp): «sáb 21 nov 2026». */
export function fechaEvento(iso: string | null | undefined): string {
  if (!iso) return '';
  // Una fecha sola (sin hora) se lee como día local, no UTC (si no, en Bogotá sale el día anterior).
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
