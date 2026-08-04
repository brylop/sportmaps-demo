import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, Plus, Trash2, Trophy, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCreateCompetitionResult } from '@/hooks/useCompetitionResults';
import type { MatchFormat, ResultType, SetScore } from '@/lib/school/competitionResultsQueries';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CompetitionResultFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
}

export function CompetitionResultFormDialog({ open, onOpenChange, teamId }: CompetitionResultFormDialogProps) {
  const { toast } = useToast();
  const createResult = useCreateCompetitionResult();

  const [opponent, setOpponent] = useState('');
  const [competitionDate, setCompetitionDate] = useState(new Date().toISOString().split('T')[0]);
  const [resultType, setResultType] = useState<ResultType>('preparatorio');
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('bo3');
  const [competitionName, setCompetitionName] = useState('');
  const [notes, setNotes] = useState('');
  const [playedYet, setPlayedYet] = useState(false); // false = queda "programado", sin sets
  const [sets, setSets] = useState<SetScore[]>([{ set_number: 1, team_score: 0, opponent_score: 0 }]);

  const [pendingWarning, setPendingWarning] = useState<string[] | null>(null);

  const reset = () => {
    setOpponent('');
    setCompetitionDate(new Date().toISOString().split('T')[0]);
    setResultType('preparatorio');
    setMatchFormat('bo3');
    setCompetitionName('');
    setNotes('');
    setPlayedYet(false);
    setSets([{ set_number: 1, team_score: 0, opponent_score: 0 }]);
    setPendingWarning(null);
  };

  const addSet = () => setSets((prev) => [...prev, { set_number: prev.length + 1, team_score: 0, opponent_score: 0 }]);
  const removeSet = (idx: number) => setSets((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, set_number: i + 1 })));
  const updateSet = (idx: number, field: 'team_score' | 'opponent_score', value: number) =>
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

  const submit = async (force = false) => {
    try {
      await createResult.mutateAsync({
        team_id: teamId,
        opponent,
        competition_date: competitionDate,
        result_type: resultType,
        match_format: matchFormat,
        competition_name: competitionName || undefined,
        sets: playedYet ? sets : undefined,
        notes: notes || undefined,
        force,
      });
      toast({ title: '✅ Resultado guardado' });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      // El BFF responde 422 con requires_confirmation cuando el marcador es atípico
      // (solo aplica en bo3/bo5; en 'libre' cualquier error de este tipo es un dato corrupto real)
      if (err?.status === 422 && err?.data?.requires_confirmation) {
        setPendingWarning(err.data.details ?? ['Marcador fuera de lo estándar.']);
        return;
      }
      toast({
        title: 'Error al guardar',
        description: err?.data?.error ?? err?.message ?? 'Revisa los marcadores e intenta de nuevo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Registrar Partido</DialogTitle>
              <DialogDescription>Preparatorio o competencia oficial</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rival</Label>
              <Input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Nombre del rival" />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label className="mb-1">Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-background border-input">
                    <Calendar className="mr-2 h-4 w-4 opacity-75" />
                    {competitionDate ? (
                      format(new Date(competitionDate + 'T12:00:00'), 'PPP', { locale: es })
                    ) : (
                      <span>Seleccionar fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl border-border/60 shadow-xl" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={competitionDate ? new Date(competitionDate + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setCompetitionDate(format(date, 'yyyy-MM-dd'));
                      }
                    }}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <RadioGroup value={resultType} onValueChange={(v) => setResultType(v as ResultType)} className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="preparatorio" id="rt-prep" />
                <Label htmlFor="rt-prep" className="font-normal">Preparatorio</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="competencia_oficial" id="rt-comp" />
                <Label htmlFor="rt-comp" className="font-normal">Competencia oficial</Label>
              </div>
            </RadioGroup>
          </div>

          {resultType === 'competencia_oficial' && (
            <div className="space-y-1.5">
              <Label>Nombre de la competencia</Label>
              <Input value={competitionName} onChange={(e) => setCompetitionName(e.target.value)} placeholder="Ej. Liga Distrital 2026" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Formato del marcador</Label>
            <RadioGroup value={matchFormat} onValueChange={(v) => setMatchFormat(v as MatchFormat)} className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="bo3" id="mf-bo3" />
                <Label htmlFor="mf-bo3" className="font-normal">Al mejor de 3</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="bo5" id="mf-bo5" />
                <Label htmlFor="mf-bo5" className="font-normal">Al mejor de 5</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="libre" id="mf-libre" />
                <Label htmlFor="mf-libre" className="font-normal">Libre (sin validar)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="played-yet"
              checked={playedYet}
              onChange={(e) => setPlayedYet(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="played-yet" className="font-normal">Ya se jugó — quiero cargar el marcador ahora</Label>
          </div>

          {playedYet && (
            <div className="space-y-2">
              <Label>Marcador por set</Label>
              {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 shrink-0">Set {s.set_number}</span>
                  <Input
                    type="number" min={0} className="w-20"
                    value={s.team_score}
                    onChange={(e) => updateSet(i, 'team_score', Number(e.target.value))}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number" min={0} className="w-20"
                    value={s.opponent_score}
                    onChange={(e) => updateSet(i, 'opponent_score', Number(e.target.value))}
                  />
                  {sets.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => removeSet(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSet} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Agregar set
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {pendingWarning && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-600 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4" /> Marcador fuera de lo estándar
              </div>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                {pendingWarning.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
              <p className="text-xs">¿Confirmas que así se jugó realmente?</p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createResult.isPending}>
            Cancelar
          </Button>
          {pendingWarning ? (
            <Button variant="default" className="bg-amber-600 hover:bg-amber-700" onClick={() => submit(true)} disabled={createResult.isPending}>
              {createResult.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar y guardar así
            </Button>
          ) : (
            <Button onClick={() => submit(false)} disabled={createResult.isPending || !opponent}>
              {createResult.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
