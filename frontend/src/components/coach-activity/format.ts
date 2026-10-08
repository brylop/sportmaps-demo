/** Textos y resúmenes de "Seguimiento deportivo" (sin componentes: fast refresh). */
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CoachActivity } from './types';

/** Primer nombre + inicial del apellido: cabe en el eje de un celular. */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || full;
  return `${parts[0]} ${parts[1][0]}.`;
}

export function lastActivityText(iso: string | null): string {
  if (!iso) return 'Sin actividad en las últimas 8 semanas';
  return `Última actividad ${formatDistanceToNow(new Date(iso), { locale: es, addSuffix: true })}`;
}

/** Adherencia del mesociclo para la tarjeta: el peor de sus equipos. */
export function mesocycleSummary(c: CoachActivity): { value: string; hint: string } {
  const withPct = c.mesocycles.filter((m) => m.adherence_pct !== null);
  if (c.mesocycles.length === 0) return { value: '—', hint: 'Sin mesociclo vigente' };
  if (withPct.length === 0) return { value: '—', hint: 'Mesociclo recién empezado' };
  const worst = withPct.reduce((a, b) => ((a.adherence_pct ?? 0) <= (b.adherence_pct ?? 0) ? a : b));
  return {
    value: `${worst.adherence_pct}%`,
    hint: `${worst.done_to_date} de ${worst.planned_to_date} sesiones con lista${withPct.length > 1 ? ` · ${worst.team_name}` : ''}`,
  };
}
