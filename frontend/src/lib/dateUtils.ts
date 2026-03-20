/**
 * Retorna la fecha actual en zona horaria Colombia (UTC-5)
 * en formato YYYY-MM-DD, compatible con columnas `date` de PostgreSQL.
 *
 * USAR SIEMPRE en lugar de:
 *   ❌ new Date().toISOString().split('T')[0]  → fecha UTC, puede ser mañana en Colombia
 *   ❌ new Date().toLocaleDateString()         → depende del browser/OS del usuario
 */
export function todayColombia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
  }).format(new Date());
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
