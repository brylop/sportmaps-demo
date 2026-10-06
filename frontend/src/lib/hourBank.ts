/**
 * Formato único del banco de horas ("2h", "1h 30min", "45 min", "-30 min").
 * Mismo formato que format_hour_bank_minutes() (SQL) y formatHourBankMinutes()
 * del BFF — las tres salidas (pantalla, notificación del cron, notificación
 * del BFF) deben verse igual.
 */
export function formatHourBankMinutes(mins: number): string {
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = mins < 0 ? '-' : '';
  if (h === 0) return `${sign}${m} min`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}min`;
}
