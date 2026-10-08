/**
 * Gráficas de asistencia por mes para el histórico.
 *
 * Reglas del rediseño (docs/specs/rediseno-seguimiento-deportivo.md §3): una
 * gráfica = una pregunta escrita como título, barras simples, el número encima
 * de cada barra para no obligar a leer el eje, semáforo fijo con leyenda en
 * palabras y una frase debajo que la resume.
 */
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import {
  TRAFFIC, proseMonthLabel, shortMonthLabel, trafficHex, type MonthPoint,
} from './attendanceMonths';

interface BarDatum {
  label: string;
  month: string;
  value: number;
  empty: boolean;
  color: string;
}

function ChartTooltip({
  active, payload, suffix,
}: { active?: boolean; payload?: { payload: BarDatum }[]; suffix: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 shadow-lg text-xs">
      <div className="font-semibold capitalize">{proseMonthLabel(p.month)}</div>
      <div className="font-mono font-bold text-sm tabular-nums mt-0.5">
        {p.empty ? 'Sin lista ese mes' : `${p.value}${suffix}`}
      </div>
    </div>
  );
}

function MonthBars({
  data, suffix, maxValue, ariaLabel,
}: {
  data: BarDatum[]; suffix: string; maxValue: number; ariaLabel: string;
}) {
  // Con muchos meses las barras no caben en un celular: se da un ancho mínimo
  // por mes y el contenedor se desplaza, en vez de encimar las etiquetas.
  const minWidth = Math.max(data.length * 64, 280);
  return (
    <div className="w-full overflow-x-auto">
      <div className="h-[260px]" style={{ minWidth }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 4, right: 4, top: 26, bottom: 0 }}>
            <XAxis
              dataKey="label"
              interval={0}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              dy={6}
            />
            <YAxis hide domain={[0, maxValue]} />
            <RechartTooltip
              content={<ChartTooltip suffix={suffix} />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false}>
              {data.map(d => <Cell key={d.month} fill={d.color} />)}
              <LabelList
                dataKey="value"
                content={(props) => {
                  const { x, y, width, index } = props as { x?: number | string; y?: number | string; width?: number | string; index?: number };
                  const d = index === undefined ? undefined : data[index];
                  if (!d) return null;
                  return (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={Number(y) - 8}
                      textAnchor="middle"
                      fontSize={d.empty ? 10 : 13}
                      fontWeight={d.empty ? 500 : 800}
                      fill={d.empty ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))'}
                    >
                      {d.empty ? 'sin lista' : `${d.value}${suffix}`}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartCard({
  title, children, summary, legend,
}: {
  title: string; children: ReactNode; summary: string; legend?: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <h3 className="text-base font-bold">{title}</h3>
      {legend}
      {children}
      <p className="text-sm font-medium">{summary}</p>
    </div>
  );
}

/** "¿Qué porcentaje de asistencia hubo cada mes?" con semáforo. */
export function AttendanceRateByMonthChart({ points }: { points: MonthPoint[] }) {
  const data: BarDatum[] = points.map(p => ({
    label: shortMonthLabel(p.month),
    month: p.month,
    value: p.rate ?? 0,
    empty: p.rate === null,
    color: p.rate === null ? 'transparent' : trafficHex(p.rate),
  }));

  const conDatos = points.filter((p): p is MonthPoint & { rate: number } => p.rate !== null);
  let summary = 'No hubo listas en este periodo.';
  if (conDatos.length === 1) {
    summary = `Solo ${proseMonthLabel(conDatos[0].month)} tiene listas: ${conDatos[0].rate} % de asistencia.`;
  } else if (conDatos.length > 1) {
    // Ante un empate gana el mes más reciente: es el que la escuela tiene fresco.
    const best = conDatos.reduce((b, p) => (p.rate >= b.rate ? p : b));
    const worst = conDatos.reduce((w, p) => (p.rate <= w.rate ? p : w));
    summary = best.rate === worst.rate
      ? `Todos los meses tuvieron ${best.rate} % de asistencia.`
      : `${cap(proseMonthLabel(best.month))} fue el mejor mes: ${best.rate} %. `
        + `El más bajo fue ${proseMonthLabel(worst.month)}: ${worst.rate} %.`;
  }

  const legend = (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {Object.values(TRAFFIC).map(t => (
        <span key={t.hex} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.hex }} aria-hidden="true" />
          {t.label}
        </span>
      ))}
    </div>
  );

  return (
    <ChartCard title="¿Qué porcentaje de asistencia hubo cada mes?" summary={summary} legend={legend}>
      <MonthBars
        data={data}
        suffix=" %"
        maxValue={100}
        ariaLabel={`Asistencia por mes: ${conDatos.map(p => `${proseMonthLabel(p.month)} ${p.rate} %`).join(', ')}.`}
      />
    </ChartCard>
  );
}

/** "¿Cuántos deportistas vinieron cada mes?" — conteo simple, un solo color. */
export function AthletesByMonthChart({ points }: { points: MonthPoint[] }) {
  const data: BarDatum[] = points.map(p => ({
    label: shortMonthLabel(p.month),
    month: p.month,
    value: p.athletes,
    empty: p.rate === null,
    color: 'hsl(var(--primary))',
  }));
  const conDatos = points.filter(p => p.rate !== null);
  const max = Math.max(1, ...points.map(p => p.athletes));

  let summary = 'No hubo listas en este periodo.';
  if (conDatos.length === 1) {
    summary = `En ${proseMonthLabel(conDatos[0].month)} vinieron ${conDatos[0].athletes} deportistas.`;
  } else if (conDatos.length > 1) {
    const most = conDatos.reduce((b, p) => (p.athletes >= b.athletes ? p : b));
    const least = conDatos.reduce((w, p) => (p.athletes <= w.athletes ? p : w));
    summary = most.athletes === least.athletes
      ? `Todos los meses vinieron ${most.athletes} deportistas.`
      : `En ${proseMonthLabel(most.month)} vinieron más deportistas: ${most.athletes}. `
        + `El mes con menos fue ${proseMonthLabel(least.month)}: ${least.athletes}.`;
  }

  return (
    <ChartCard title="¿Cuántos deportistas vinieron cada mes?" summary={summary}>
      <MonthBars
        data={data}
        suffix=""
        // Aire arriba para que el número de la barra más alta no se corte.
        maxValue={Math.ceil(max * 1.1)}
        ariaLabel={`Deportistas por mes: ${conDatos.map(p => `${proseMonthLabel(p.month)} ${p.athletes}`).join(', ')}.`}
      />
      <p className="text-xs text-muted-foreground">
        Cuenta a cada deportista con al menos un registro de asistencia en el mes.
      </p>
    </ChartCard>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
