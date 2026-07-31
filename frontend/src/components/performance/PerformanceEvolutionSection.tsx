import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, ChevronDown, TrendingUp } from 'lucide-react';
import { useAthletePerformanceEvolution } from '@/hooks/usePerformanceData';
import { MetricHighlights } from './MetricHighlights';
import { MetricSummary } from './MetricSummary';
import { MetricSparklineGrid } from './MetricSparklineGrid';
import { MetricTrendChart } from './MetricTrendChart';
import { computeMetricBand } from '@/lib/school/performanceQueries';
import {
  categoryStyle,
  pickHighlights,
  pickToWorkOn,
  type DisplayMetric,
} from '@/lib/school/performanceDisplay';

interface PerformanceEvolutionSectionProps {
  /** Si se omite, muestra la evolución del propio usuario autenticado (atleta adulto). */
  childId?: string;
  title?: string;
  description?: string;
}

export function PerformanceEvolutionSection({
  childId,
  title = 'Rendimiento Deportivo',
  description = 'Evolución de métricas específicas de tu deporte',
}: PerformanceEvolutionSectionProps) {
  const { data, isLoading } = useAthletePerformanceEvolution(childId, 365);
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [detailOpen, setDetailOpen] = useState(false);

  const metrics = data?.metrics ?? [];
  const evolution = data?.evolution ?? {};

  const resolveBand = (value: number, metric: DisplayMetric) =>
    computeMetricBand(value, metric.thresholds);

  const improved = useMemo(
    () => pickHighlights(metrics, evolution, resolveBand),
    [metrics, evolution]
  );
  const toWorkOn = useMemo(
    () => pickToWorkOn(metrics, evolution, resolveBand),
    [metrics, evolution]
  );

  const activeMetric = selectedMetric || (metrics[0]?.metric_key ?? '');
  const activeMetricInfo = metrics.find((m) => m.metric_key === activeMetric);

  const series = useMemo(() => {
    const raw = evolution[activeMetric] ?? [];
    return [...raw].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [evolution, activeMetric]);

  /** Elegir una métrica abre el detalle: si no, el clic no haría nada visible. */
  const selectAndOpen = (metricKey: string) => {
    setSelectedMetric(metricKey);
    setDetailOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          Cargando métricas de rendimiento...
        </CardContent>
      </Card>
    );
  }

  if (metrics.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-20" aria-hidden="true" />
          <p className="text-sm">Todavía no hay métricas de rendimiento registradas.</p>
        </CardContent>
      </Card>
    );
  }

  const latestBand = series.length
    ? computeMetricBand(series[series.length - 1].value, activeMetricInfo?.thresholds)
    : null;

  const activeStyle = categoryStyle(activeMetricInfo?.category);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <MetricHighlights improved={improved} toWorkOn={toWorkOn} onSelect={selectAndOpen} />

        {improved.length === 0 && toWorkOn.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todavía no hay suficientes mediciones para mostrar avances. Se necesitan al menos dos
            evaluaciones de una misma métrica.
          </p>
        )}

        {/* El catálogo completo, un clic más abajo */}
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setDetailOpen((o) => !o)}
            aria-expanded={detailOpen}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground
                       hover:text-foreground transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${detailOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            {detailOpen ? 'Ocultar el detalle' : `Ver todo el detalle (${metrics.length} métricas)`}
          </button>

          {detailOpen && (
            <div className="space-y-5 mt-4">
              <MetricSummary
                series={series}
                unit={activeMetricInfo?.unit}
                higherIsBetter={activeMetricInfo?.higher_is_better ?? true}
                band={latestBand}
              />

              <div className="bg-accent/10 rounded-2xl p-5 border border-border/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`h-2 w-2 rounded-sm ${activeStyle.swatch}`} aria-hidden="true" />
                  <h3 className="text-sm font-bold">{activeMetricInfo?.display_name}</h3>
                  <span className="text-[11px] text-muted-foreground">
                    {activeStyle.label}
                    {activeMetricInfo && !activeMetricInfo.higher_is_better && ' · menos es mejor'}
                  </span>
                </div>
                {activeMetricInfo?.parent_hint && (
                  <p className="text-xs text-muted-foreground mb-3 max-w-[65ch]">
                    {activeMetricInfo.parent_hint}
                  </p>
                )}
                <MetricTrendChart
                  series={series}
                  displayName={activeMetricInfo?.display_name ?? ''}
                  unit={activeMetricInfo?.unit}
                  thresholds={activeMetricInfo?.thresholds}
                />
              </div>

              <MetricSparklineGrid
                metrics={metrics}
                evolution={evolution}
                selected={activeMetric}
                onSelect={setSelectedMetric}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
