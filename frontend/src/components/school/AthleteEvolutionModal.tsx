import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart3, Calendar, FileText } from 'lucide-react';
import { useSubjectPerformanceEvolution, useSchoolPerformanceMetrics } from '@/hooks/usePerformanceData';
import { computeMetricBand, type MetricBand } from '@/lib/school/performanceQueries';

interface AthleteEvolutionModalProps {
  open: boolean;
  onClose: () => void;
  subjectType: 'profile' | 'child' | 'unregistered';
  subjectId: string;
  subjectName: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  physical:   'text-red-500 bg-red-500/10 border-red-500/20',
  technical:  'text-blue-500 bg-blue-500/10 border-blue-500/20',
  tactical:   'text-purple-500 bg-purple-500/10 border-purple-500/20',
  attendance: 'text-green-600 bg-green-500/10 border-green-500/20',
  other:      'text-muted-foreground bg-muted/40 border-border',
};

const BAND_DOT: Record<NonNullable<MetricBand>, string> = {
  green: 'bg-green-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

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
  const availableMetrics = metrics.filter((m) => evolution[m.metric_key] && evolution[m.metric_key].length > 0);

  const activeMetric = selectedMetric || (availableMetrics[0]?.metric_key ?? '');
  const series = evolution[activeMetric] ?? [];

  const chartData = series.map((e) => ({
    fecha: new Date(e.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
    valor: e.value,
  }));

  const activeMetricInfo = metrics.find((m) => m.metric_key === activeMetric);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
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
            <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No hay evaluaciones registradas para este deportista todavía.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {availableMetrics.map((m) => {
                const colorClass = CATEGORY_COLOR[m.category ?? ''] ?? CATEGORY_COLOR.other;
                const active = activeMetric === m.metric_key;
                return (
                  <button
                    key={m.metric_key}
                    onClick={() => setSelectedMetric(m.metric_key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      active ? colorClass : 'border-border text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    {m.display_name}
                  </button>
                );
              })}
            </div>

            <div className="bg-accent/10 rounded-2xl p-6 border border-border/20">
              {chartData.length >= 2 ? (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                      <XAxis dataKey="fecha" tick={{ fontSize: 10, opacity: 0.5 }} tickLine={false} axisLine={false} dy={10} />
                      <YAxis tick={{ fontSize: 10, opacity: 0.5 }} tickLine={false} axisLine={false} />
                      <RechartTooltip
                        contentStyle={{ fontSize: 12, borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                        formatter={(val: any) => [`${val} ${activeMetricInfo?.unit ?? ''}`, activeMetricInfo?.display_name]}
                      />
                      <Line
                        type="monotone"
                        dataKey="valor"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[180px] flex flex-col items-center justify-center text-muted-foreground text-center">
                  <BarChart3 className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">Se necesitan al menos 2 registros para ver la tendencia.</p>
                </div>
              )}
            </div>

            {/* Listado de mediciones recientes */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Historial de Mediciones
              </h3>
              <div className="border rounded-xl overflow-hidden divide-y">
                {series.slice().reverse().map((entry, idx) => {
                  const band = computeMetricBand(entry.value, activeMetricInfo?.thresholds);
                  return (
                    <div key={idx} className="flex items-start justify-between p-3 bg-card hover:bg-accent/10 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(entry.date).toLocaleDateString('es-CO', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          {band && (
                            <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-muted">
                              <span className={`h-1.5 w-1.5 rounded-full ${BAND_DOT[band]}`} />
                              Banda
                            </span>
                          )}
                        </div>
                        {entry.notes && (
                          <p className="text-xs text-muted-foreground italic">"{entry.notes}"</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm">
                          {entry.value} {activeMetricInfo?.unit ?? ''}
                        </span>
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
