/**
 * Gráfico de tendencia con el semáforo de fondo.
 *
 * Las franjas salen de los `thresholds` que el BFF ya devuelve por métrica, así
 * que el valor deja de leerse en el vacío. Interpolación `linear`: con 3–6
 * mediciones discretas, `monotone` dibuja una curva que sugiere valores
 * intermedios que nunca se midieron.
 */
import {
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip as RechartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import {
  BAND_STYLE,
  bandRanges,
  buildChartPoints,
  fmt,
  fmtWithUnit,
  yDomain,
  type SeriesPoint,
} from '@/lib/school/performanceDisplay';
import { computeMetricBand, type MetricThreshold } from '@/lib/school/performanceQueries';

interface MetricTrendChartProps {
  series: SeriesPoint[];
  displayName: string;
  unit?: string | null;
  thresholds?: MetricThreshold[];
}

function ChartTooltip({ active, payload, unit }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const band = p.band as keyof typeof BAND_STYLE | null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 shadow-lg text-xs max-w-[220px]">
      <div className="font-mono font-bold text-sm tabular-nums">{fmtWithUnit(p.value, unit)}</div>
      <div className="text-muted-foreground mt-0.5">
        {new Date(p.date).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </div>
      {band && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 font-semibold">
          <span className={`h-1.5 w-1.5 rounded-full ${BAND_STYLE[band].dot}`} aria-hidden="true" />
          {BAND_STYLE[band].label}
        </div>
      )}
      {p.notes && <p className="mt-1.5 italic text-muted-foreground">«{p.notes}»</p>}
    </div>
  );
}

export function MetricTrendChart({ series, displayName, unit, thresholds }: MetricTrendChartProps) {
  if (series.length < 2) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground text-center">
        <BarChart3 className="h-8 w-8 mb-2 opacity-20" aria-hidden="true" />
        <p className="text-sm">Se necesitan al menos 2 registros para ver la tendencia.</p>
      </div>
    );
  }

  const points = buildChartPoints(series, (v) => computeMetricBand(v, thresholds));
  const [minY, maxY] = yDomain(points.map((p) => p.value), thresholds);
  const ranges = bandRanges(thresholds, minY, maxY);

  const summary = `${displayName}: ${points
    .map((p) => `${p.label} ${fmtWithUnit(p.value, unit)}`)
    .join(', ')}.`;

  return (
    <div className="h-[250px] w-full" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ left: -14, right: 12, top: 14, bottom: 0 }}>
          {ranges.map((r) => (
            <ReferenceArea
              key={r.band}
              y1={r.from}
              y2={r.to}
              fill={BAND_STYLE[r.band].fill}
              stroke="none"
              ifOverflow="hidden"
              label={{
                value: `${BAND_STYLE[r.band].label.toUpperCase()} ${r.caption}`,
                position: 'insideTopRight',
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '0.06em',
                fill: BAND_STYLE[r.band].hex,
                opacity: 0.85,
              }}
            />
          ))}

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, opacity: 0.55 }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            domain={[minY, maxY]}
            tick={{ fontSize: 10, opacity: 0.55 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt(v)}
            width={46}
          />
          <RechartTooltip
            content={<ChartTooltip unit={unit} />}
            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
          />

          <Line
            type="linear"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={(props: any) => {
              const { cx, cy, payload, index } = props;
              const band = payload.band as keyof typeof BAND_STYLE | null;
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={4.5}
                  fill={band ? BAND_STYLE[band].hex : 'hsl(var(--primary))'}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 6.5, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
