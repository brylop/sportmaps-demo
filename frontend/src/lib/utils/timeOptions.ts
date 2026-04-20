/**
 * Genera opciones de tiempo con granularidad configurable (15, 30 o 60 min).
 * Retorna value en 'HH:MM' (24h) y label en 'h:mm am/pm' (12h).
 */
export function generateTimeOptions(
  stepMinutes: 15 | 30 | 60 = 30,
  startHour = 0,
  endHour = 23
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];

  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      if (h === 24) break; 

      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const value = `${hh}:${mm}`;

      const period = h < 12 ? 'am' : 'pm';
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      const label = `${displayHour}:${mm} ${period}`;

      options.push({ value, label });
    }
  }
  return options;
}

export const DURATION_OPTIONS = [
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 hora' },
  { value: 90,  label: '1 h 30 min' },
  { value: 120, label: '2 horas' },
  { value: 150, label: '2 h 30 min' },
  { value: 180, label: '3 horas' },
] as const;

export type DurationMinutes = typeof DURATION_OPTIONS[number]['value'];

/**
 * Suma `minutes` a un string "HH:MM" y devuelve el nuevo "HH:MM".
 * Retorna null si el resultado pasa de las 23:59.
 */
export function addMinutes(time: string, minutes: number): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  if (total > 23 * 60 + 59) return null;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Valida que end_time > start_time */
export function isValidTimeRange(start: string, end: string): boolean {
  if (!start || !end) return false;
  return start < end;
}

/**
 * Divide la ventana [windowStart, windowEnd] en bloques de `durationMinutes`.
 * Devuelve pares { start_time, end_time } para cada bloque completo.
 * Si el bloque final no cabe justamente, no se incluye (no overflow).
 */
export function generateSlots(
  windowStart: string,
  windowEnd: string,
  durationMinutes: number
): { start_time: string; end_time: string }[] {
  if (!windowStart || !windowEnd || durationMinutes <= 0) return [];
  if (windowStart >= windowEnd) return [];

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const fromMinutes = (mins: number) => {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m}`;
  };

  const slots: { start_time: string; end_time: string }[] = [];
  let cursor = toMinutes(windowStart);
  const endMins = toMinutes(windowEnd);

  while (cursor + durationMinutes <= endMins) {
    slots.push({
      start_time: fromMinutes(cursor),
      end_time: fromMinutes(cursor + durationMinutes),
    });
    cursor += durationMinutes;
  }

  return slots;
}
