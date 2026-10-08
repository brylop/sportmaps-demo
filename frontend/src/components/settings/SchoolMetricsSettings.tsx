/**
 * Ajustes → "Métricas de evaluación" (spec rediseno-seguimiento-deportivo.md F5, §5).
 *
 * La administración elige qué evalúan sus entrenadores en la "Evaluación
 * rápida". Se guarda en school_metric_definitions vía el BFF
 * (PUT /api/v1/school/performance/metric-settings, solo administración).
 * Sin elección, el modal usa la lista corta por defecto del deporte.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowDown, ArrowUp, ClipboardCheck, Loader2, RotateCcw, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bffClient } from '@/lib/api/bffClient';
import { QuickMetricInput } from '@/components/school/QuickMetricInput';
import { metricLabels, type EvaluationScale } from '@/components/school/evaluationMetrics';

interface CatalogItem {
  metric_key: string;
  display_name: string;
  parent_label: string | null;
  category: string | null;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  scale: EvaluationScale;
}

interface MetricSettingsResponse {
  sport_category_id: string | null;
  catalog: CatalogItem[];
  selected_keys: string[];
  default_keys: string[];
  source: 'school' | 'default';
  max: number;
  message?: string;
}

const SETTINGS_KEY = ['school-metric-settings'];

const CATEGORY_LABEL: Record<string, string> = {
  physical: 'Físico',
  technical: 'Técnico',
  tactical: 'Táctico',
  attendance: 'Asistencia',
};

const SCALE_LABEL: Record<EvaluationScale, string> = {
  scale_1_5: 'Botones 1 a 5',
  scale_1_10: 'Botones 1 a 10',
  yes_no: 'Sí / No',
  number: 'Número',
  text: 'Texto',
};

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

export function SchoolMetricsSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => bffClient.get<MetricSettingsResponse>('/api/v1/school/performance/metric-settings'),
  });

  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, number | ''>>({});

  useEffect(() => {
    if (data) setSelected(data.selected_keys);
  }, [data]);

  const byKey = useMemo(() => new Map((data?.catalog ?? []).map((m) => [m.metric_key, m])), [data]);
  const max = data?.max ?? 12;
  const dirty = !!data && !sameList(selected, data.selected_keys);

  const save = useMutation({
    mutationFn: (metric_keys: string[]) =>
      bffClient.put('/api/v1/school/performance/metric-settings', { metric_keys }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      // Los modales de captura leen la lista de aquí.
      queryClient.invalidateQueries({ queryKey: ['school-performance-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['team-performance-roster'] });
      toast({ title: 'Métricas guardadas', description: 'Tus entrenadores ya ven la nueva lista.' });
    },
    onError: (err: Error) => {
      toast({ title: 'No se pudo guardar', description: err?.message ?? 'Intenta de nuevo.', variant: 'destructive' });
    },
  });

  const toggle = (key: string, checked: boolean) => {
    setSelected((prev) => {
      if (checked) return prev.includes(key) || prev.length >= max ? prev : [...prev, key];
      return prev.filter((k) => k !== key);
    });
  };

  const move = (index: number, delta: -1 | 1) => {
    setSelected((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const unselected = (data?.catalog ?? []).filter((m) => !selected.includes(m.metric_key));
  const unselectedByCategory = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>();
    for (const m of unselected) {
      const k = m.category ?? 'other';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(m);
    }
    return groups;
  }, [unselected]);

  const countHint =
    selected.length === 0
      ? 'Sin métricas elegidas se usa la lista recomendada.'
      : selected.length < 3
        ? 'Pocas: con 3 o más el seguimiento dice más.'
        : selected.length > 6
          ? 'Muchas: con más de 6 los entrenadores tienden a no llenarlas.'
          : null;

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Métricas de evaluación</CardTitle>
            <CardDescription>Elige qué evalúan tus entrenadores. Recomendado: 3 a 6.</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Cargando métricas...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive py-6">
            <AlertCircle className="h-4 w-4" /> No se pudieron cargar las métricas. Intenta de nuevo.
          </div>
        ) : !data?.sport_category_id ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            {data?.message ?? 'Esta escuela aún no tiene un deporte asignado.'}
          </div>
        ) : (
          <>
            {data.source === 'default' && !dirty && (
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
                Hoy usas la lista recomendada para tu deporte. Cámbiala y guarda para tener la tuya.
              </p>
            )}

            {/* Elegidas, en orden */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Las que verá el entrenador <span className="text-muted-foreground font-normal">({selected.length} de {max})</span>
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(data.default_keys)}
                  disabled={sameList(selected, data.default_keys)}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Usar las recomendadas
                </Button>
              </div>
              {countHint && <p className="text-xs text-amber-600">{countHint}</p>}

              <ul className="space-y-2">
                {selected.map((key, i) => {
                  const m = byKey.get(key);
                  if (!m) return null;
                  const { title, hint } = metricLabels(m);
                  return (
                    <li key={key} className="rounded-xl border bg-background px-3 py-2.5 space-y-2">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked
                          onCheckedChange={(c) => toggle(key, c === true)}
                          aria-label={`Quitar ${title}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {CATEGORY_LABEL[m.category ?? ''] ?? 'Otros'} · {SCALE_LABEL[m.scale]}
                            {hint ? ` · ${hint}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => move(i, 1)}
                            disabled={i === selected.length - 1}
                            aria-label="Bajar"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {/* Vista previa: así lo verá el entrenador. No guarda nada. */}
                      <div className="pl-7">
                        <QuickMetricInput
                          metric={{
                            ...m,
                            options: null,
                            sort_order: i,
                            source_definition_id: null,
                            thresholds: [],
                          }}
                          size="sm"
                          value={preview[key]}
                          onChange={(v) => setPreview((p) => ({ ...p, [key]: v }))}
                        />
                      </div>
                    </li>
                  );
                })}
                {selected.length === 0 && (
                  <li className="text-sm text-muted-foreground rounded-xl border border-dashed px-3 py-4 text-center">
                    Ninguna elegida. Marca abajo las que quieras.
                  </li>
                )}
              </ul>
            </section>

            {/* Disponibles */}
            {unselected.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Más métricas de tu deporte</h3>
                {[...unselectedByCategory.entries()].map(([cat, items]) => (
                  <div key={cat} className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {CATEGORY_LABEL[cat] ?? 'Otros'}
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {items.map((m) => {
                        const { title } = metricLabels(m);
                        const full = selected.length >= max;
                        return (
                          <label
                            key={m.metric_key}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${full ? 'opacity-50' : 'cursor-pointer hover:bg-muted/40'}`}
                          >
                            <Checkbox
                              checked={false}
                              disabled={full}
                              onCheckedChange={(c) => toggle(m.metric_key, c === true)}
                            />
                            <span className="flex-1 min-w-0 truncate">{title}</span>
                            <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                              {SCALE_LABEL[m.scale]}
                            </Badge>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            <p className="text-[11px] text-muted-foreground">
              La asistencia, los focos del entrenamiento, la rúbrica del mesociclo y la evaluación post-entreno
              se registran en sus propias pantallas y no aparecen aquí.
            </p>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setSelected(data.selected_keys)} disabled={!dirty || save.isPending}>
                Descartar cambios
              </Button>
              <Button onClick={() => save.mutate(selected)} disabled={!dirty || save.isPending}>
                {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
