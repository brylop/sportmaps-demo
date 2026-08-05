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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Loader2, Activity, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
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


function groupByCategoryAndSubcategory(metrics: SportMetricDefinition[]) {
  const groups = new Map<string, SportMetricDefinition[]>();
  for (const m of metrics) {
    const key = m.category ?? 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  // Dentro de cada categoría, sub-agrupa por subcategory (o deja plano si no hay)
  return groups;
}

function groupBySubcategory(metrics: SportMetricDefinition[]) {
  const groups = new Map<string, SportMetricDefinition[]>();
  for (const m of metrics) {
    const key = m.subcategory ?? '_flat';
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
  const { data: metricsData, isLoading: loadingMetrics } = useSchoolPerformanceMetrics();
  const createEntries = useCreatePerformanceEntries();

  const [values, setValues] = useState<Record<string, number | ''>>({});
  const [recordedAt, setRecordedAt] = useState<string>(todayColombia());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setValues({});
      setNotes('');
      setRecordedAt(todayColombia());
    }
  }, [open, subjectId]);

  const activeMetrics = metricsData?.metrics.filter((m) => m.is_active) ?? [];
  const grouped = useMemo(() => groupByCategoryAndSubcategory(activeMetrics), [activeMetrics]);
  const filledCount = Object.values(values).filter((v) => v !== '' && v !== undefined).length;

  const handleSubmit = async () => {
    const entries = activeMetrics
      .filter((m) => values[m.metric_key] !== '' && values[m.metric_key] !== undefined)
      .map((m) => ({
        subject_type:  subjectType,
        subject_id:    subjectId,
        metric_key:    m.metric_key,
        value:         Number(values[m.metric_key]),
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
        title: '✅ Rendimiento registrado',
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Registrar Rendimiento</DialogTitle>
              <DialogDescription>{subjectName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingMetrics ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Cargando métricas...</span>
          </div>
        ) : !metricsData?.sport_category_id ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-muted-foreground max-w-xs">
              {metricsData?.message ?? 'Esta escuela aún no tiene un deporte asignado.'}
            </p>
          </div>
        ) : activeMetrics.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              No hay métricas activas configuradas para este deporte todavía.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2 flex flex-col">
              <Label>Fecha del registro</Label>
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

            {[...grouped.entries()].map(([category, categoryMetrics]) => {
              const cfg = CATEGORY_CONFIG[category as MetricCategory] ?? { label: 'Otros', color: 'text-muted-foreground' };
              const bySubcat = groupBySubcategory(categoryMetrics);
              return (
                <div key={category} className="space-y-3">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>
                    {cfg.label}
                  </p>
                  {[...bySubcat.entries()].map(([subcat, metrics]) => (
                    <div key={subcat} className="space-y-2">
                      {subcat !== '_flat' && (
                        <p className="text-[10px] font-semibold text-muted-foreground pl-1">
                          {SUBCATEGORY_LABEL[subcat] ?? subcat}
                        </p>
                      )}
                      <div className="space-y-3">
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
                                  onChange={(val) => setValues((prev) => ({ ...prev, [m.metric_key]: val }))}
                                  min={m.min_value ?? 0}
                                  max={m.max_value ?? undefined}
                                  step={1}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Observaciones sobre esta sesión o evaluación..."
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
            disabled={createEntries.isPending || activeMetrics.length === 0 || filledCount === 0}
          >
            {createEntries.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Registro'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
