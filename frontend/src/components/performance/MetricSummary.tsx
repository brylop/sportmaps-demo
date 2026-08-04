/**
 * Resumen antes del detalle: valor actual, variación contra la medición previa,
 * variación acumulada y cuántas mediciones hay. Se lee sin tocar el gráfico.
 */
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import {
  BAND_STYLE,
  computeDelta,
  deltaTone,
  fmt,
  type MetricDelta,
  type SeriesPoint,
} from '@/lib/school/performanceDisplay';
import type { MetricBand } from '@/lib/school/performanceQueries';

interface MetricSummaryProps {
  series: SeriesPoint[];
  unit?: string | null;
  higherIsBetter: boolean;
  band: MetricBand;
}

function DeltaLine({ delta, suffix }: { delta: MetricDelta; suffix: string }) {
  const Icon = delta.improved === null ? ArrowRight : delta.improved ? ArrowUp : ArrowDown;
  return (
    <div className={`text-[11px] mt-1.5 flex items-center gap-1 ${deltaTone(delta.improved)}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>
        {delta.improved === null
          ? 'Sin cambio'
          : `${delta.improved ? 'Mejoró' : 'Retrocedió'}${
              delta.pct !== null ? ` ${fmt(Math.abs(delta.pct))}%` : ''
            }`}
      </span>
      <span className="text-muted-foreground">{suffix}</span>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export function MetricSummary({ series, unit, higherIsBetter, band }: MetricSummaryProps) {
  if (series.length === 0) return null;

  const last = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : null;
  const first = series[0];

  const stepDelta = prev ? computeDelta(last.value, prev.value, higherIsBetter) : null;
  // Con solo dos mediciones, "desde el inicio" es literalmente el mismo número
  // que "vs. medición previa": la tarjeta se omite en vez de repetirlo.
  const totalDelta =
    series.length >= 3 ? computeDelta(last.value, first.value, higherIsBetter) : null;

  const daysSince = Math.floor(
    (Date.now() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div
      className={`grid grid-cols-2 gap-2.5 ${
        totalDelta ? 'md:grid-cols-4' : 'md:grid-cols-3'
      }`}
    >
      <Tile label="Valor actual">
        <div className="font-mono font-bold text-2xl leading-none tabular-nums">
          {fmt(last.value)}
          {unit && <span className="text-xs font-medium text-muted-foreground ml-1">{unit}</span>}
        </div>
        {band ? (
          <div
            className={`mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${BAND_STYLE[band].chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${BAND_STYLE[band].dot}`} aria-hidden="true" />
            {BAND_STYLE[band].label}
          </div>
        ) : (
          <div className="text-[11px] mt-1.5 text-muted-foreground">Sin umbrales definidos</div>
        )}
      </Tile>

      <Tile label="Vs. medición previa">
        {stepDelta ? (
          <>
            <div
              className={`font-mono font-bold text-2xl leading-none tabular-nums ${deltaTone(
                stepDelta.improved
              )}`}
            >
              {stepDelta.label}
              {unit && <span className="text-xs font-medium text-muted-foreground ml-1">{unit}</span>}
            </div>
            <DeltaLine delta={stepDelta} suffix={`desde ${shortDate(prev!.date)}`} />
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Primera medición</div>
        )}
      </Tile>

      {totalDelta && (
        <Tile label="Desde el inicio">
          <div
            className={`font-mono font-bold text-2xl leading-none tabular-nums ${deltaTone(
              totalDelta.improved
            )}`}
          >
            {totalDelta.label}
            {unit && <span className="text-xs font-medium text-muted-foreground ml-1">{unit}</span>}
          </div>
          <DeltaLine delta={totalDelta} suffix={`desde ${shortDate(first.date)}`} />
        </Tile>
      )}

      <Tile label="Mediciones">
        <div className="font-mono font-bold text-2xl leading-none tabular-nums">{series.length}</div>
        <div className="text-[11px] mt-1.5 text-muted-foreground">
          {daysSince === 0 ? 'última hoy' : `última hace ${daysSince} d`}
        </div>
      </Tile>
    </div>
  );
}
