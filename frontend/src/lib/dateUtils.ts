/**
 * Retorna la fecha actual en zona horaria Colombia (UTC-5)
 * en formato YYYY-MM-DD, compatible con columnas `date` de PostgreSQL.
 *
 * USAR SIEMPRE en lugar de:
 *   ❌ new Date().toISOString().split('T')[0]  → fecha UTC, puede ser mañana en Colombia
 *   ❌ new Date().toLocaleDateString()         → depende del browser/OS del usuario
 *
 * Auditoría 2026-08-03: había 53 lugares que seguían usando el primer anti-patrón, pese
 * a esta advertencia. Caso real de esa noche — un acudiente reportó el pago a las 20:35
 * hora Colombia y el cobro quedó con `payment_date = 2026-08-04`. Ya están todos acá.
 */
export function todayColombia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
  }).format(new Date());
}

/**
 * Formatea para mostrar una fecha que puede venir de una columna `date`
 * (YYYY-MM-DD) o de un `timestamptz` (ISO con hora).
 *
 * El problema que resuelve: `new Date('2026-08-04')` se parsea como MEDIANOCHE
 * UTC, que en Colombia (UTC-5) son las 7 p.m. del 3 → `toLocaleDateString`
 * imprimía "03 de ago". En Transacciones de Finanzas eso corría TODA la columna
 * Fecha un día hacia atrás: un pago del 4 de agosto se leía como del 3.
 * Un `date` no tiene hora ni zona: se muestra tal cual viene.
 */
/**
 * Convierte un 'YYYY-MM-DD' (o un ISO con hora) en un `Date` **seguro para
 * mostrar**: se ancla al MEDIODÍA local, no a medianoche.
 *
 * Es el arreglo mínimo para las pantallas que ya tenían su propio formato con
 * `toLocaleDateString(...)`: `new Date('2026-08-04')` da medianoche UTC y en
 * Colombia se imprime el 3; anclado al mediodía, ningún huso del planeta lo
 * corre de día. Si además da igual el formato, usar `formatDayCO`.
 */
export function dayToLocalDate(value: string): Date {
  const [y, m, d] = value.split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function formatDayCO(value?: string | null): string {
  if (!value) return '—';
  const [datePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '—';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${String(d).padStart(2, '0')} de ${MESES[m - 1]} de ${y}`;
}

/**
 * Días transcurridos desde una fecha YYYY-MM-DD hasta hoy Colombia.
 * Positivo = fecha en el pasado, Negativo = fecha en el futuro.
 */
export function daysDiffFromToday(dateStr: string): number {
  const today = todayColombia();
  const todayMs  = new Date(today   + 'T00:00:00').getTime();
  const targetMs = new Date(dateStr + 'T00:00:00').getTime();
  return Math.floor((todayMs - targetMs) / (1000 * 60 * 60 * 24));
}
