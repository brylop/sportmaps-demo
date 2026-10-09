import { useState, useEffect, useMemo } from 'react';
import { todayColombia } from '@/lib/dateUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Loader2, Activity, CheckCircle2, AlertCircle, Calendar, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useSchoolPerformanceMetrics,
  useCreatePerformanceEntries,
} from '@/hooks/usePerformanceData';
import {
  computeMetricBand,
  type MetricCategory,
  type SportMetricDefinition,
} from '@/lib/school/performanceQueries';
import { BAND_STYLE } from '@/lib/school/performanceDisplay';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { QuickMetricInput } from './QuickMetricInput';
import { metricLabels, readEvaluation, type EvaluationCatalog } from './evaluationMetrics';

interface PerformanceEntryModalProps {
  open: boolean;
  onClose: () => void;
  subjectType: 'profile' | 'child' | 'unregistered';
  subjectId: string;
  subjectName: string;
  onSuccess?: () => void;
}

const CATEGORY_CONFIG: Record<MetricCategory, { label: string; color: string }> = {
  physical:   { label: 'Físico',    color: 'text-red-500' },
  technical:  { label: 'Técnico',   color: 'text-blue-500' },
  tactical:   { label: 'Táctico',   color: 'text-purple-500' },
  attendance: { label: 'Asistencia', color: 'text-green-600' },
};

const SUBCATEGORY_LABEL: Record<string, string> = {
  tecnica_gmb_gma: 'Recepción (GMB/GMA)',
  tecnica_saque: 'Saque',
  tecnica_remate_bloqueo: 'Remate y Bloqueo',
  fisico: 'Físico',
  tactica: 'Táctica',
};

function groupBy(metrics: SportMetricDefinition[], keyOf: (m: SportMetricDefinition) => string) {
  const groups = new Map<string, SportMetricDefinition[]>();
  for (const m of metrics) {
    const key = keyOf(m);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  return groups;
}

export function PerformanceEntryModal({
  open,
  onClose,
  subjectType,
  subjectId,
  subjectName,
  onSuccess,
}: PerformanceEntryModalProps) {
  const { toast } = useToast();
  const { data: metricsData, isLoading: loadingMetrics, isError: metricsError } = useSchoolPerformanceMetrics();
  const createEntries = useCreatePerformanceEntries();

  const [values, setValues] = useState<Record<string, number | ''>>({});
  const [recordedAt, setRecordedAt] = useState<string>(todayColombia());
  const [notes, setNotes] = useState('');
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    if (open) {
      setValues({});
      setNotes('');
      setRecordedAt(todayColombia());
      setShowFull(false);
    }
  }, [open, subjectId]);

  // `evaluation` llega del BFF (F5); el tipo del hook todavía no lo declara.
  const evaluation = useMemo(
    () => readEvaluation(metricsData as (typeof metricsData & { evaluation?: EvaluationCatalog }) | undefined),
    [metricsData]
  );
  const quickMetrics = evaluation.quick;

  // "Evaluación completa": el resto capturable, en la forma del catálogo.
  const fullMetrics = useMemo(() => {
    const keys = new Set(evaluation.full_keys);
    return (metricsData?.metrics ?? []).filter((m) => m.is_active && keys.has(m.metric_key));
  }, [metricsData, evaluation]);
  const fullGrouped = useMemo(() => groupBy(fullMetrics, (m) => m.category ?? 'other'), [fullMetrics]);

  const capturable = useMemo(
    () => [...quickMetrics.map((m) => m.metric_key), ...fullMetrics.map((m) => m.metric_key)],
    [quickMetrics, fullMetrics]
  );
  const isFilled = (key: string) => values[key] !== '' && values[key] !== undefined;
  const filledCount = capturable.filter(isFilled).length;
  const fullFilledCount = fullMetrics.filter((m) => isFilled(m.metric_key)).length;

  const setValue = (key: string, val: number | '') => setValues((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    const entries = capturable.filter(isFilled).map((key) => ({
      subject_type:  subjectType,
      subject_id:    subjectId,
      metric_key:    key,
      value:         Number(values[key]),
      recorded_at:   recordedAt,
      notes:         notes.trim() || undefined,
    }));

    if (entries.length === 0) {
      toast({ title: 'Registra al menos una métrica', variant: 'destructive' });
      return;
    }

    try {
      await createEntries.mutateAsync({ entries });
      toast({
        title: '✅ Evaluación guardada',
        description: `${entries.length} métrica(s) guardada(s) para ${subjectName}.`,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Error al guardar',
        description: err?.message ?? 'Intenta de nuevo.',
        variant: 'destructive',
      });
    }
  };

  const nothingToCapture = quickMetrics.length === 0 && fullMetrics.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Evaluación rápida</DialogTitle>
              <DialogDescription>{subjectName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingMetrics ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Cargando métricas...</span>
          </div>
        ) : metricsError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground max-w-xs">
              No se pudo cargar el catálogo de métricas. Verifica tu conexión e intenta de nuevo.
            </p>
          </div>
        ) : !metricsData?.sport_category_id ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-muted-foreground max-w-xs">
              {metricsData?.message ?? 'Esta escuela aún no tiene un deporte asignado.'}
            </p>
          </div>
        ) : nothingToCapture ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              No hay métricas activas configuradas para este deporte todavía.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2 flex flex-col">
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-background border-input">
                    <Calendar className="mr-2 h-4 w-4 opacity-75" />
                    {recordedAt ? (
                      format(new Date(recordedAt + 'T12:00:00'), 'PPP', { locale: es })
                    ) : (
                      <span>Seleccionar fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl border-border/60 shadow-xl" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={recordedAt ? new Date(recordedAt + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setRecordedAt(format(date, 'yyyy-MM-dd'));
                      }
                    }}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {quickMetrics.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Toca un número: 1 = por mejorar · 5 = excelente. Deja en blanco lo que no evaluaste hoy.
                </p>
                {quickMetrics.map((m) => {
                  const { title, hint } = metricLabels(m);
                  return (
                    <div key={m.metric_key} className="space-y-2">
                      <div>
                        <p className="text-sm font-semibold leading-tight">
                          {title}
                          {m.unit && <span className="text-xs font-normal text-muted-foreground ml-1">({m.unit})</span>}
                        </p>
                        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                      </div>
                      <QuickMetricInput
                        metric={m}
                        value={values[m.metric_key]}
                        onChange={(val) => setValue(m.metric_key, val)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {fullMetrics.length > 0 && (
              <div className="space-y-3 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowFull((s) => !s)}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  aria-expanded={showFull}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${showFull ? 'rotate-180' : ''}`} />
                  Evaluación completa ({fullMetrics.length} métricas más)
                  {fullFilledCount > 0 && !showFull && (
                    <span className="text-xs text-muted-foreground">· {fullFilledCount} con valor</span>
                  )}
                </button>

                {showFull &&
                  [...fullGrouped.entries()].map(([category, categoryMetrics]) => {
                    const cfg = CATEGORY_CONFIG[category as MetricCategory] ?? { label: 'Otros', color: 'text-muted-foreground' };
                    const bySubcat = groupBy(categoryMetrics, (m) => m.subcategory ?? '_flat');
                    return (
                      <details key={category} className="group rounded-lg border px-3 py-2">
                        <summary className={`cursor-pointer text-[11px] font-black uppercase tracking-widest ${cfg.color}`}>
                          {cfg.label} ({categoryMetrics.length})
                        </summary>
                        <div className="space-y-3 pt-3">
                          {[...bySubcat.entries()].map(([subcat, metrics]) => (
                            <div key={subcat} className="space-y-2">
                              {subcat !== '_flat' && (
                                <p className="text-[10px] font-semibold text-muted-foreground pl-1">
                                  {SUBCATEGORY_LABEL[subcat] ?? subcat}
                                </p>
                              )}
                              {metrics.map((m) => {
                                const band = computeMetricBand(values[m.metric_key], m.thresholds);
                                return (
                                  <div key={m.metric_key} className="flex items-center justify-between gap-3">
                                    <Label className="text-sm font-medium flex-1 flex items-center gap-1.5">
                                      {band && (
                                        <span
                                          className={`h-1.5 w-1.5 rounded-full ${BAND_STYLE[band].dot}`}
                                          title={BAND_STYLE[band].label}
                                          aria-label={BAND_STYLE[band].label}
                                        />
                                      )}
                                      {m.display_name}
                                      {m.unit && <span className="text-xs text-muted-foreground ml-1">({m.unit})</span>}
                                    </Label>
                                    <div className="w-32 shrink-0">
                                      <NumberStepper
                                        value={values[m.metric_key] ?? ''}
                                        onChange={(val) => setValue(m.metric_key, val)}
                                        min={m.min_value ?? 0}
                                        max={m.max_value ?? undefined}
                                        step={1}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Observaciones sobre esta sesión..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {filledCount > 0 && (
              <Badge variant="outline" className="gap-1.5 text-green-600 border-green-500/30 bg-green-500/5">
                <CheckCircle2 className="h-3 w-3" />
                {filledCount} métrica{filledCount > 1 ? 's' : ''} lista{filledCount > 1 ? 's' : ''} para guardar
              </Badge>
            )}
          </div>
        )}

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={createEntries.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createEntries.isPending || nothingToCapture || filledCount === 0}
          >
            {createEntries.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
