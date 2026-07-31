import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, TrendingUp } from 'lucide-react';
import { useAthletePerformanceEvolution } from '@/hooks/usePerformanceData';
import { MetricSummary } from './MetricSummary';
import { MetricSparklineGrid } from './MetricSparklineGrid';
import { MetricTrendChart } from './MetricTrendChart';
import { computeMetricBand } from '@/lib/school/performanceQueries';
import { categoryStyle } from '@/lib/school/performanceDisplay';

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

  const metrics = data?.metrics ?? [];
  const evolution = data?.evolution ?? {};

  const activeMetric = selectedMetric || (metrics[0]?.metric_key ?? '');
  const activeMetricInfo = metrics.find((m) => m.metric_key === activeMetric);

  const series = useMemo(() => {
    const raw = evolution[activeMetric] ?? [];
    return [...raw].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [evolution, activeMetric]);

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
          {/* Qué mide y por qué importa. Es lo que convierte un número en
              información para alguien que no entrena voleibol. */}
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
      </CardContent>
    </Card>
  );
}
