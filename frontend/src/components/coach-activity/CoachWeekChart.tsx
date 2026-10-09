/**
 * Gráficas de "Seguimiento deportivo". Reglas del rediseño (spec §3): una
 * gráfica = una pregunta como título, barras simples, el número escrito en
 * cada barra, leyenda en palabras y una frase debajo que la resume.
 */
import {
  Bar, BarChart, LabelList, ResponsiveContainer, Tooltip as RechartTooltip, XAxis, YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { dayToLocalDate } from '@/lib/dateUtils';
import { SERIES_COLORS, type CoachActivity, type CoachWeekPoint } from './types';
import { shortName } from './format';

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm" style={{ background: SERIES_COLORS.planned }} />
        Sesiones planificadas
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm" style={{ background: SERIES_COLORS.lists }} />
        Listas de asistencia tomadas
      </span>
    </div>
  );
}

const numberLabel = (props: unknown) => {
  const { x, y, width, height, value } = props as { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string };
  return (
    <text
      x={Number(x) + Number(width) + 6}
      y={Number(y) + Number(height) / 2}
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
      fill="hsl(var(--foreground))"
    >
      {value}
    </text>
  );
};

/** "¿Quién trabajó esta semana?" — barras horizontales por entrenador. */
export function WhoWorkedChart({ coaches }: { coaches: CoachActivity[] }) {
  const data = coaches.map((c) => ({
    name: shortName(c.full_name),
    full: c.full_name,
    planned: c.sessions_planned_week,
    lists: c.attendance_sessions_week,
  }));
  const maxValue = Math.max(1, ...data.map((d) => Math.max(d.planned, d.lists)));
  const both = coaches.filter((c) => c.status === 'verde').length;
  const nothing = coaches.filter((c) => c.status === 'rojo').length;
  const summary = coaches.length === 0
    ? 'No hay entrenadores activos.'
    : `${both} de ${coaches.length} entrenador${coaches.length === 1 ? '' : 'es'} planificaron y tomaron lista`
      + (nothing > 0 ? `; ${nothing} sin ninguna actividad.` : '.');

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <h2 className="text-base font-bold">¿Quién trabajó esta semana?</h2>
      <Legend />
      {coaches.length > 0 && (
        <div
          className="w-full"
          style={{ height: data.length * 58 + 16 }}
          role="img"
          aria-label={data.map((d) => `${d.full}: ${d.planned} sesiones planificadas, ${d.lists} listas tomadas`).join('. ')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 28, top: 4, bottom: 4 }} barGap={2} barCategoryGap="22%">
              <XAxis type="number" hide domain={[0, maxValue]} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={92}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              />
              <RechartTooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                formatter={(v: number, key: string) => [v, key === 'planned' ? 'Sesiones planificadas' : 'Listas tomadas']}
                labelFormatter={(_l, p) => (p?.[0]?.payload as { full?: string } | undefined)?.full ?? ''}
              />
              <Bar dataKey="planned" fill={SERIES_COLORS.planned} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                <LabelList dataKey="planned" content={numberLabel} />
              </Bar>
              <Bar dataKey="lists" fill={SERIES_COLORS.lists} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                <LabelList dataKey="lists" content={numberLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-sm font-medium">{summary}</p>
    </div>
  );
}

/** "¿Cómo le fue las últimas 8 semanas?" — columnas por semana de UN entrenador. */
export function CoachWeeksChart({ weekly, name }: { weekly: CoachWeekPoint[]; name: string }) {
  const data = weekly.map((w) => ({
    label: format(dayToLocalDate(w.week), 'd MMM', { locale: es }),
    planned: w.planned,
    lists: w.lists,
  }));
  const maxValue = Math.max(1, ...data.map((d) => Math.max(d.planned, d.lists)));
  const active = weekly.filter((w) => w.planned > 0 || w.lists > 0).length;
  const summary = active === 0
    ? `${shortName(name)} no registró sesiones ni listas en las últimas ${weekly.length} semanas.`
    : `Trabajó ${active} de las últimas ${weekly.length} semanas.`;

  const topLabel = (props: unknown) => {
    const { x, y, width, value } = props as { x?: number | string; y?: number | string; width?: number | string; value?: number | string };
    if (!Number(value)) return null;
    return (
      <text x={Number(x) + Number(width) / 2} y={Number(y) - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill="hsl(var(--foreground))">
        {value}
      </text>
    );
  };

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <h3 className="text-sm font-bold">¿Cómo le fue las últimas {weekly.length} semanas?</h3>
      <Legend />
      <div className="h-[170px] w-full" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 0, top: 18, bottom: 0 }} barGap={1}>
            <XAxis dataKey="label" interval={0} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
            <YAxis hide domain={[0, maxValue]} allowDecimals={false} />
            <Bar dataKey="planned" fill={SERIES_COLORS.planned} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false}>
              <LabelList dataKey="planned" content={topLabel} />
            </Bar>
            <Bar dataKey="lists" fill={SERIES_COLORS.lists} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false}>
              <LabelList dataKey="lists" content={topLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm font-medium">{summary}</p>
    </div>
  );
}
