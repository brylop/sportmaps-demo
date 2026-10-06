// Modo "Individual" del registro de resultados (F-F): puntaje de UN atleta en
// una competencia (p. ej. All-Around de gimnasia), con nivel de competencia.
// Lo carga staff → cuenta para la elegibilidad de ascenso; el aviso al
// owner/admin y la vista "Ascensos" solo existen con la progresión activa.
import { useMemo, useState } from 'react';
import { todayColombia } from '@/lib/dateUtils';
import { DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCreateIndividualResult, useProgressionAthletes } from '@/hooks/useLevelProgression';
import { COMPETITION_LEVELS, COMPETITION_LEVEL_LABEL, type CompetitionLevel } from '@/lib/school/levelProgression';

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

export function IndividualResultForm({ onDone, onCancel }: Props) {
  const { toast } = useToast();
  const { data: athletes = [], isLoading } = useProgressionAthletes(true);
  const createResult = useCreateIndividualResult();

  const [athleteKey, setAthleteKey] = useState('');
  const [search, setSearch] = useState('');
  const [competitionDate, setCompetitionDate] = useState(todayColombia());
  const [points, setPoints] = useState('');
  const [level, setLevel] = useState<CompetitionLevel | ''>('');
  const [resultType, setResultType] = useState<'preparatorio' | 'competencia_oficial'>('competencia_oficial');
  const [competitionName, setCompetitionName] = useState('');
  const [notes, setNotes] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? athletes.filter((a) => a.full_name.toLowerCase().includes(q)) : athletes;
  }, [athletes, search]);

  const selected = athletes.find((a) => `${a.subject_type}:${a.subject_id}` === athleteKey);
  const pointsNum = Number(points);
  const canSave = !!selected && points !== '' && Number.isFinite(pointsNum) && pointsNum >= 0 && !!competitionDate;

  const submit = async () => {
    if (!selected) return;
    try {
      const res = await createResult.mutateAsync({
        subject_type: selected.subject_type,
        subject_id: selected.subject_id,
        competition_date: competitionDate,
        points: pointsNum,
        competition_level: level || null,
        result_type: resultType,
        competition_name: competitionName || undefined,
        notes: notes || undefined,
      });
      toast({
        title: '✅ Puntaje guardado',
        description: res?.promotion_notices > 0
          ? `${selected.full_name} quedó elegible para un ascenso. Lo ves en “Ascensos”.`
          : undefined,
      });
      onDone();
    } catch (err: any) {
      toast({
        title: 'Error al guardar',
        description: err?.body?.error ?? err?.message ?? 'Intenta de nuevo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Atleta</Label>
          <Input placeholder="Buscar por nombre…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
          <Select value={athleteKey} onValueChange={setAthleteKey}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={isLoading ? 'Cargando…' : 'Selecciona el atleta'} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {filtered.slice(0, 200).map((a) => (
                <SelectItem key={`${a.subject_type}:${a.subject_id}`} value={`${a.subject_type}:${a.subject_id}`}>
                  {a.full_name}{a.plan_name ? ` · ${a.plan_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Puntaje</Label>
            <Input type="number" min={0} step="0.001" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Ej. 35.4" />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={competitionDate} onChange={(e) => setCompetitionDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Nivel de la competencia</Label>
          <Select value={level || 'none'} onValueChange={(v) => setLevel(v === 'none' ? '' : (v as CompetitionLevel))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin especificar</SelectItem>
              {COMPETITION_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{COMPETITION_LEVEL_LABEL[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <RadioGroup value={resultType} onValueChange={(v) => setResultType(v as any)} className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="preparatorio" id="ind-prep" />
              <Label htmlFor="ind-prep" className="font-normal">Preparatorio</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="competencia_oficial" id="ind-comp" />
              <Label htmlFor="ind-comp" className="font-normal">Competencia oficial</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label>Nombre de la competencia (opcional)</Label>
          <Input value={competitionName} onChange={(e) => setCompetitionName(e.target.value)} placeholder="Ej. Copa Nacional FEDECOLGIM 2026" />
        </div>

        <div className="space-y-1.5">
          <Label>Notas (opcional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>

      <DialogFooter className="pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={createResult.isPending}>Cancelar</Button>
        <Button onClick={submit} disabled={!canSave || createResult.isPending}>
          {createResult.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Guardar
        </Button>
      </DialogFooter>
    </>
  );
}
