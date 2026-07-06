import { useState, useMemo } from 'react';
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
import { Loader2, Activity, AlertCircle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTeamPerformanceRoster, useCreatePerformanceEntries } from '@/hooks/usePerformanceData';
import type { MetricCategory } from '@/lib/school/performanceQueries';

interface TeamPerformanceEntryModalProps {
  open: boolean;
  onClose: () => void;
  teamId?: string;
  offeringPlanId?: string;
  teamName: string;
}

const CATEGORY_LABEL: Record<MetricCategory, string> = {
  physical: 'Físico',
  technical: 'Técnico',
  tactical: 'Táctico',
  attendance: 'Asistencia',
};

/** key = `${subject_id}:${metric_key}` */
type GridValues = Record<string, number | ''>;

export function TeamPerformanceEntryModal({
  open,
  onClose,
  teamId,
  offeringPlanId,
  teamName,
}: TeamPerformanceEntryModalProps) {
  const { toast } = useToast();
  const { data, isLoading } = useTeamPerformanceRoster({ team_id: teamId, offering_plan_id: offeringPlanId });
  const createEntries = useCreatePerformanceEntries();

  const [values, setValues] = useState<GridValues>({});
  const [recordedAt, setRecordedAt] = useState<string>(new Date().toISOString().split('T')[0]);

  const metrics = data?.metrics.filter((m) => m.is_active) ?? [];
  const subjects = data?.subjects ?? [];

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
    setRecordedAt(new Date().toISOString().split('T')[0]);
    onClose();
  };

  const handleSave = async () => {
    const entries = subjects.flatMap((s) =>
      metrics
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
      await createEntries.mutateAsync(entries);
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
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
        ) : metrics.length === 0 ? (
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
            <div className="flex items-center gap-3 py-3 shrink-0">
              <Label className="shrink-0">Fecha del registro</Label>
              <Input
                type="date"
                className="w-40"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
              />
              {filledCount > 0 && (
                <Badge variant="outline" className="gap-1.5 text-green-600 border-green-500/30 bg-green-500/5 ml-auto">
                  {athletesWithDataCount} de {subjects.length} atletas · {filledCount} registro(s) listos
                </Badge>
              )}
            </div>

            <div className="flex-1 overflow-auto rounded-lg border">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-muted/95 min-w-[180px] border-b">
                      Atleta
                    </th>
                    {metrics.map((m) => (
                      <th key={m.metric_key} className="text-center font-semibold px-2 py-2 min-w-[110px] border-b border-l">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                            {CATEGORY_LABEL[m.category as MetricCategory] ?? ''}
                          </span>
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
                        return (
                          <td key={m.metric_key} className="px-2 py-1.5 border-b border-l">
                            <div className="flex flex-col items-center gap-0.5">
                              <NumberStepper
                                value={values[key] ?? ''}
                                onChange={(val) => setCell(s.subject_id, m.metric_key, val)}
                                min={0}
                                max={m.data_type === 'rating' ? 10 : undefined}
                                step={1}
                              />
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
            disabled={createEntries.isPending || metrics.length === 0 || subjects.length === 0 || filledCount === 0}
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
