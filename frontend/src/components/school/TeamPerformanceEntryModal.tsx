import { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Activity, AlertCircle, Users, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTeamPerformanceRoster, useCreatePerformanceEntries } from '@/hooks/usePerformanceData';
import { computeMetricBand, type SportMetricDefinition } from '@/lib/school/performanceQueries';
import { BAND_STYLE } from '@/lib/school/performanceDisplay';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TeamPerformanceEntryModalProps {
  open: boolean;
  onClose: () => void;
  teamId?: string;
  offeringPlanId?: string;
  teamName: string;
  teamImageUrl?: string;
}

/** key = `${subject_id}:${metric_key}` */
type GridValues = Record<string, number | ''>;

const SUBCATEGORY_ORDER = [
  'tecnica_gmb_gma',
  'tecnica_saque',
  'tecnica_remate_bloqueo',
  'fisico',
  'tactica',
  'general',
];

const SUBCATEGORY_LABEL: Record<string, string> = {
  tecnica_gmb_gma: 'Recepción (GMB/GMA)',
  tecnica_saque: 'Saque',
  tecnica_remate_bloqueo: 'Remate y Bloqueo',
  fisico: 'Físico',
  tactica: 'Táctica',
  general: 'General',
};


function groupBySubcategory(metrics: SportMetricDefinition[]) {
  const groups = new Map<string, SportMetricDefinition[]>();
  for (const m of metrics) {
    const key = m.subcategory ?? 'general';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  // Ordena según SUBCATEGORY_ORDER; lo que no esté en la lista va al final
  return new Map(
    [...groups.entries()].sort((a, b) => {
      const ia = SUBCATEGORY_ORDER.indexOf(a[0]);
      const ib = SUBCATEGORY_ORDER.indexOf(b[0]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
  );
}

export function TeamPerformanceEntryModal({
  open,
  onClose,
  teamId,
  offeringPlanId,
  teamName,
  teamImageUrl,
}: TeamPerformanceEntryModalProps) {
  const { toast } = useToast();
  const { data, isLoading } = useTeamPerformanceRoster({ team_id: teamId, offering_plan_id: offeringPlanId });
  const createEntries = useCreatePerformanceEntries();

  const [values, setValues] = useState<GridValues>({});
  const [recordedAt, setRecordedAt] = useState<string>(todayColombia());
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);

  const allMetrics = data?.metrics.filter((m) => m.is_active) ?? [];
  const subjects = data?.subjects ?? [];
  const grouped = useMemo(() => groupBySubcategory(allMetrics), [allMetrics]);
  const subcategoryKeys = useMemo(() => [...grouped.keys()], [grouped]);
  const currentSubcategory = activeSubcategory ?? subcategoryKeys[0] ?? 'general';
  const metrics = grouped.get(currentSubcategory) ?? [];

  const cellKey = (subjectId: string, metricKey: string) => `${subjectId}:${metricKey}`;

  const setCell = (subjectId: string, metricKey: string, val: number | '') => {
    setValues((prev) => ({ ...prev, [cellKey(subjectId, metricKey)]: val }));
  };

  const filledCount = useMemo(
    () => Object.values(values).filter((v) => v !== '' && v !== undefined).length,
    [values]
  );

  const athletesWithDataCount = useMemo(() => {
    const set = new Set<string>();
    for (const key of Object.keys(values)) {
      if (values[key] !== '' && values[key] !== undefined) {
        set.add(key.split(':')[0]);
      }
    }
    return set.size;
  }, [values]);

  const handleClose = () => {
    setValues({});
    setRecordedAt(todayColombia());
    setActiveSubcategory(null);
    onClose();
  };

  const handleSave = async () => {
    // Guarda TODAS las métricas con valor, de todas las pestañas, no solo la activa
    const entries = subjects.flatMap((s) =>
      allMetrics
        .filter((m) => {
          const v = values[cellKey(s.subject_id, m.metric_key)];
          return v !== '' && v !== undefined;
        })
        .map((m) => ({
          subject_type: s.subject_type,
          subject_id: s.subject_id,
          metric_key: m.metric_key,
          value: Number(values[cellKey(s.subject_id, m.metric_key)]),
          recorded_at: recordedAt,
        }))
    );

    if (entries.length === 0) {
      toast({ title: 'Registra al menos una métrica para al menos un atleta', variant: 'destructive' });
      return;
    }

    try {
      await createEntries.mutateAsync({ entries, teamId });
      toast({
        title: '✅ Rendimiento del equipo registrado',
        description: `${entries.length} registro(s) para ${athletesWithDataCount} atleta(s).`,
      });
      handleClose();
    } catch (err: any) {
      toast({ title: 'Error al guardar', description: err?.message ?? 'Intenta de nuevo.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {teamImageUrl ? (
              <img src={teamImageUrl} alt={teamName} className="h-10 w-10 rounded-full object-cover border bg-background shadow-sm shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Activity className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <DialogTitle>Evaluar Rendimiento</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5">
                <Users className="h-3 w-3" /> {teamName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Cargando roster y métricas...</span>
          </div>
        ) : !data?.sport_category_id ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-muted-foreground max-w-xs">
              {data?.message ?? 'Esta escuela aún no tiene un deporte asignado.'}
            </p>
          </div>
        ) : allMetrics.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-muted-foreground">No hay métricas activas para este deporte todavía.</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Este equipo/plan no tiene atletas inscritos todavía.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 shrink-0">
              <Label className="shrink-0">Fecha del registro</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-44 justify-start text-left font-normal bg-background border-input">
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
              {filledCount > 0 && (
                <Badge variant="outline" className="gap-1.5 text-green-600 border-green-500/30 bg-green-500/5 sm:ml-auto">
                  {athletesWithDataCount} de {subjects.length} atletas · {filledCount} registro(s) listos (todas las pestañas)
                </Badge>
              )}
            </div>

            <Tabs value={currentSubcategory} onValueChange={setActiveSubcategory} className="shrink-0">
              <TabsList className="flex-wrap h-auto">
                {subcategoryKeys.map((key) => (
                  <TabsTrigger key={key} value={key} className="text-xs">
                    {SUBCATEGORY_LABEL[key] ?? key} ({grouped.get(key)?.length ?? 0})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex-1 overflow-auto rounded-lg border mt-3">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-muted/95 min-w-[180px] border-b">
                      Atleta
                    </th>
                    {metrics.map((m) => (
                      <th key={m.metric_key} className="text-center font-semibold px-2 py-2 min-w-[110px] border-b border-l">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{m.display_name}</span>
                          {m.unit && <span className="text-[10px] font-normal text-muted-foreground">({m.unit})</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s, i) => (
                    <tr key={s.subject_id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      <td className="px-3 py-2 font-medium sticky left-0 bg-inherit border-b">
                        {s.full_name}
                      </td>
                      {metrics.map((m) => {
                        const key = cellKey(s.subject_id, m.metric_key);
                        const latest = data.latest_values[key];
                        const currentVal = values[key];
                        const liveBand = computeMetricBand(currentVal, m.thresholds);
                        const band = liveBand ?? latest?.band ?? null;
                        return (
                          <td key={m.metric_key} className="px-2 py-1.5 border-b border-l">
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1">
                                {band && (
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${BAND_STYLE[band].dot}`}
                                    title={BAND_STYLE[band].label}
                                    aria-label={BAND_STYLE[band].label}
                                  />
                                )}
                                <NumberStepper
                                  value={currentVal ?? ''}
                                  onChange={(val) => setCell(s.subject_id, m.metric_key, val)}
                                  min={m.min_value ?? 0}
                                  max={m.max_value ?? undefined}
                                  step={1}
                                />
                              </div>
                              {latest && (
                                <span className="text-[9px] text-muted-foreground">
                                  último: {latest.value}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <DialogFooter className="pt-4 border-t shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={createEntries.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={createEntries.isPending || allMetrics.length === 0 || subjects.length === 0 || filledCount === 0}
          >
            {createEntries.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              `Guardar Registro${filledCount > 0 ? ` (${filledCount})` : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
