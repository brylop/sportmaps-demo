// Utilidades del lado familia / escuela del módulo clínico (pantallas /salud,
// invitación y disponibilidad). Lo clínico sigue saliendo de ./api.ts.
import { supabase } from '@/integrations/supabase/client';
import { todayColombia } from '@/lib/dateUtils';

/** Hijos de la cuenta que inició sesión (para "¿Para quién es?"). */
export async function listMyChildren(parentId: string): Promise<{ id: string; full_name: string }[]> {
  const { data, error } = await supabase
    .from('children')
    .select('id, full_name')
    .eq('parent_id', parentId)
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as { id: string; full_name: string }[];
}

/** Suma (o resta) días a un 'YYYY-MM-DD' sin pasar por husos horarios. */
export function addDaysISO(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

/** Días entre dos 'YYYY-MM-DD' (b − a). */
export function daysBetweenISO(a: string, b: string): number {
  const [ya, ma, da] = a.split('T')[0].split('-').map(Number);
  const [yb, mb, db] = b.split('T')[0].split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

/** Los últimos `n` días (hoy Colombia incluido), del más viejo al más nuevo. */
export function lastNDaysColombia(n: number): string[] {
  const today = todayColombia();
  return Array.from({ length: n }, (_, i) => addDaysISO(today, i - (n - 1)));
}

/** Adherencia: días hechos vs. esperados en la ventana (frecuencia semanal × semanas). */
export function adherencePct(doneCount: number, frequencyPerWeek: number, days = 14): number {
  const expected = Math.max(1, Math.round((frequencyPerWeek * days) / 7));
  return Math.min(100, Math.round((doneCount / expected) * 100));
}

/** Teléfono → enlace de WhatsApp (asume Colombia si viene sin indicativo). */
export function whatsappLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  const full = digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
  return `https://wa.me/${full}`;
}
