import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { useAthletePerformanceEvolution } from '@/hooks/usePerformanceData';

const CATEGORY_COLOR: Record<string, string> = {
  physical:   'text-red-500 bg-red-500/10 border-red-500/20',
  technical:  'text-blue-500 bg-blue-500/10 border-blue-500/20',
  tactical:   'text-purple-500 bg-purple-500/10 border-purple-500/20',
  attendance: 'text-green-600 bg-green-500/10 border-green-500/20',
  other:      'text-muted-foreground bg-muted/40 border-border',
};

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
          <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Todavía no hay métricas de rendimiento registradas.</p>
        </CardContent>
      </Card>
    );
  }

  const activeMetric = selectedMetric || metrics[0].metric_key;
  const series = evolution[activeMetric] ?? [];
  const chartData = series.map((e) => ({
    fecha: new Date(e.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
    valor: e.value,
  }));
  const activeMetricInfo = metrics.find((m) => m.metric_key === activeMetric);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {metrics.map((m) => {
            const colorClass = CATEGORY_COLOR[m.category] ?? CATEGORY_COLOR.other;
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
      </CardContent>
    </Card>
  );
}
