/**
 * Formatos y semáforo de los informes de asistencia por mes. Aparte del
 * componente para que el refresco en caliente de Vite no se rompa.
 */
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "2026-08" → "Ago 2026" (eje X). */
export function shortMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const n = MONTH_NAMES[m - 1] ?? '';
  return `${n.charAt(0).toUpperCase()}${n.slice(1, 3)} ${y}`;
}

/** "2026-08" → "agosto 2026" (para frases). */
export function proseMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1] ?? ''} ${y}`;
}

// Mismos tonos que el semáforo de rendimiento (BAND_STYLE) para que la app
// hable un solo idioma de colores.
export const TRAFFIC = {
  green: { hex: '#22c55e', label: 'Verde: 80 % o más — bien' },
  amber: { hex: '#f59e0b', label: 'Ámbar: 60 a 79 % — atención' },
  red: { hex: '#ef4444', label: 'Rojo: menos de 60 % — preocupa' },
} as const;

export function trafficHex(rate: number): string {
  if (rate >= 80) return TRAFFIC.green.hex;
  if (rate >= 60) return TRAFFIC.amber.hex;
  return TRAFFIC.red.hex;
}

export interface MonthPoint {
  month: string;
  /** null = ese mes no se pasó lista. No es 0 %: pintarlo como 0 mentiría. */
  rate: number | null;
  athletes: number;
}
