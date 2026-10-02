/**
 * Lógica pura de la pantalla de mesociclos (sin React ni Supabase): qué
 * mesociclo abrir, qué días tiene cada semana, dónde arranca el siguiente y
 * dónde cae cada sesión suelta. Vive aparte de MesocycleSection.tsx para
 * poder probarla en unidad.
 *
 * Todas las fechas son 'YYYY-MM-DD' (columnas `date`), comparables como texto.
 * Nada de `new Date('YYYY-MM-DD')`: es medianoche UTC y en Colombia cae el
 * día anterior (así se mostraba la semana del 3 al 10 como "2 oct – 9 oct").
 */

export interface DateRange { id: string; starts_on: string; ends_on: string }

/** Suma días a un 'YYYY-MM-DD' en calendario puro (UTC solo como aritmética). */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Todos los días de start a end, ambos incluidos. Tope de 31 por si llega
 *  un rango corrupto (una semana nunca pasa de 8 días). */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 31; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/**
 * El mesociclo que se abre por defecto: el que contiene HOY; si no hay, el
 * próximo que empieza (el coach suele planear el mes siguiente por
 * adelantado); si no, el último que terminó. Antes se abría siempre el de
 * `starts_on` más reciente, y no había forma de ver otro.
 */
export function pickDefaultMesocycle<T extends DateRange>(list: T[], today: string): T | null {
  if (list.length === 0) return null;
  const current = list.find((m) => m.starts_on <= today && today <= m.ends_on);
  if (current) return current;
  const upcoming = list.filter((m) => m.starts_on > today).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  if (upcoming.length > 0) return upcoming[0];
  return [...list].sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0];
}

/** Inicio sugerido del mesociclo nuevo: el día siguiente al último que termina
 *  (los microciclos de un equipo no se pueden solapar: EXCLUDE en la base). */
export function suggestNextStart(list: DateRange[], today: string): string {
  if (list.length === 0) return today;
  const lastEnd = list.reduce((acc, m) => (m.ends_on > acc ? m.ends_on : acc), list[0].ends_on);
  const next = addDaysISO(lastEnd, 1);
  return next > today ? next : today;
}

/** Fin sugerido: 4 semanas después del inicio (lo que generan las semanas). */
export const suggestEnd = (start: string) => addDaysISO(start, 27);

export interface LooseSession { id: string; session_date: string; microcycle_day_id?: string | null }

/**
 * Sesiones sin día del mesociclo (`microcycle_day_id` nulo) — creadas antes de
 * que existiera el mesociclo, o con el botón suelto. Con un mesociclo abierto
 * la lista plana se oculta, así que quedaban guardadas pero INVISIBLES.
 * Devuelve las que caen dentro de alguna semana (por fecha, para mostrarlas
 * en su día con "Enganchar") y las que quedan fuera (lista aparte).
 */
export function placeLooseSessions<S extends LooseSession>(
  sessions: S[],
  weeks: DateRange[],
): { byDate: Map<string, S[]>; outside: S[] } {
  const byDate = new Map<string, S[]>();
  const outside: S[] = [];
  for (const s of sessions) {
    if (s.microcycle_day_id) continue;
    const inWeek = weeks.some((w) => w.starts_on <= s.session_date && s.session_date <= w.ends_on);
    if (inWeek) byDate.set(s.session_date, [...(byDate.get(s.session_date) || []), s]);
    else outside.push(s);
  }
  return { byDate, outside };
}
