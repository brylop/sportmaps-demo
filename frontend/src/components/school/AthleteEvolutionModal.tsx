import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BarChart3, Calendar, FileText, TrendingUp } from 'lucide-react';
import { useSubjectPerformanceEvolution, useSchoolPerformanceMetrics } from '@/hooks/usePerformanceData';
import { MetricSummary } from '@/components/performance/MetricSummary';
import { MetricSparklineGrid } from '@/components/performance/MetricSparklineGrid';
import { MetricTrendChart } from '@/components/performance/MetricTrendChart';
import { computeMetricBand } from '@/lib/school/performanceQueries';
import {
  BAND_STYLE,
  categoryStyle,
  computeDelta,
  deltaTone,
  fmt,
} from '@/lib/school/performanceDisplay';

interface AthleteEvolutionModalProps {
  open: boolean;
  onClose: () => void;
  subjectType: 'profile' | 'child' | 'unregistered';
  subjectId: string;
  subjectName: string;
}

export function AthleteEvolutionModal({
  open,
  onClose,
  subjectType,
  subjectId,
  subjectName,
}: AthleteEvolutionModalProps) {
  const { data: metricsData } = useSchoolPerformanceMetrics();
  const { data: evolutionData, isLoading } = useSubjectPerformanceEvolution(subjectType, subjectId, 365);
  const [selectedMetric, setSelectedMetric] = useState<string>('');

  const metrics = metricsData?.metrics ?? [];
  const evolution = evolutionData?.evolution ?? {};

  // Solo las métricas que tienen datos de evolución registrados
  const availableMetrics = useMemo(
    () => metrics.filter((m) => evolution[m.metric_key]?.length),
    [metrics, evolution]
  );

  const activeMetric = selectedMetric || (availableMetrics[0]?.metric_key ?? '');
  const activeMetricInfo = metrics.find((m) => m.metric_key === activeMetric);

  // Ordenada por fecha: el resumen y el historial dependen de que el último
  // elemento sea realmente la medición más reciente.
  const series = useMemo(() => {
    const raw = evolution[activeMetric] ?? [];
    return [...raw].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [evolution, activeMetric]);

  const latestBand = series.length
    ? computeMetricBand(series[series.length - 1].value, activeMetricInfo?.thresholds)
    : null;

  const activeStyle = categoryStyle(activeMetricInfo?.category);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>Historial y Evolución</DialogTitle>
              <DialogDescription>Deportista: {subjectName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Cargando historial de rendimiento...
          </div>
        ) : availableMetrics.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-20" aria-hidden="true" />
            <p className="text-sm">No hay evaluaciones registradas para este deportista todavía.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Resumen antes del detalle */}
            <MetricSummary
              series={series}
              unit={activeMetricInfo?.unit}
              higherIsBetter={activeMetricInfo?.higher_is_better ?? true}
              band={latestBand}
            />

            {/* Gráfico de la métrica seleccionada, con el semáforo de fondo */}
            <div className="bg-accent/10 rounded-2xl p-5 border border-border/20">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2 w-2 rounded-sm ${activeStyle.swatch}`} aria-hidden="true" />
                <h3 className="text-sm font-bold">{activeMetricInfo?.display_name}</h3>
                <span className="text-[11px] text-muted-foreground">
                  {activeStyle.label}
                  {activeMetricInfo && !activeMetricInfo.higher_is_better && ' · menos es mejor'}
                </span>
              </div>
              <MetricTrendChart
                series={series}
                displayName={activeMetricInfo?.display_name ?? ''}
                unit={activeMetricInfo?.unit}
                thresholds={activeMetricInfo?.thresholds}
              />
            </div>

            {/* Todas las métricas con datos */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Todas las métricas
                <span className="font-semibold text-[11px] text-muted-foreground">
                  {availableMetrics.length} de {metrics.length} con mediciones
                </span>
              </h3>
              <MetricSparklineGrid
                metrics={availableMetrics}
                evolution={evolution}
                selected={activeMetric}
                onSelect={setSelectedMetric}
              />
            </div>

            {/* Listado de mediciones de la métrica seleccionada */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Historial de {activeMetricInfo?.display_name}
              </h3>
              <div className="border rounded-xl overflow-hidden divide-y">
                {series
                  .slice()
                  .reverse()
                  .map((entry, idx, reversed) => {
                    const band = computeMetricBand(entry.value, activeMetricInfo?.thresholds);
                    const older = reversed[idx + 1];
                    const delta = older
                      ? computeDelta(
                          entry.value,
                          older.value,
                          activeMetricInfo?.higher_is_better ?? true
                        )
                      : null;

                    return (
                      <div
                        key={`${entry.date}-${idx}`}
                        className="flex items-start justify-between gap-3 p-3 bg-card hover:bg-accent/10 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" aria-hidden="true" />
                              {new Date(entry.date).toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            {band && (
                              <span
                                className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${BAND_STYLE[band].chip}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${BAND_STYLE[band].dot}`}
                                  aria-hidden="true"
                                />
                                {BAND_STYLE[band].label}
                              </span>
                            )}
                          </div>
                          {entry.notes && (
                            <p className="text-xs text-muted-foreground italic">«{entry.notes}»</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-sm tabular-nums">
                            {fmt(entry.value)} {activeMetricInfo?.unit ?? ''}
                          </div>
                          {delta && (
                            <div
                              className={`font-mono text-[11px] font-bold tabular-nums ${deltaTone(
                                delta.improved
                              )}`}
                            >
                              {delta.improved === null ? 'sin cambio' : delta.label}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
