/**
 * «Guardar en biblioteca» (pizarra T3): guarda la jugada actual de la pizarra
 * como ejercicio de la escuela, con nombre, objetivo, duración, edad,
 * material y etiquetas. La jugada llega armada por props (`board`): quien lo
 * abre usa boardFromPitch() de lib/school/exerciseLibrary.ts, que se queda con
 * los PUESTOS y las posiciones, nunca con los atletas.
 *
 * Es un <Dialog> propio: abrirlo desde la pizarra (otro Dialog) con el mismo
 * cuidado de SessionFormDialog (diferido un tick y sin dos Dialogs peleando
 * por el foco).
 */
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { TacticalStaticSvg } from '@/components/school/TacticalStaticSvg';
import {
  EXERCISE_SPORT_LABEL,
  createExercise,
  exerciseThumbnail,
  type ExerciseBoard,
  type ExerciseSport,
  type TrainingExercise,
} from '@/lib/school/exerciseLibrary';

export interface SaveToLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: ExerciseBoard;
  defaultName?: string;
  defaultSport?: ExerciseSport;
  defaultObjective?: string;
  defaultMinutes?: number | null;
  onSaved?: (exercise: TrainingExercise) => void;
}

const MAX_NAME = 120;

function parseTags(raw: string): string[] {
  const out: string[] = [];
  for (const t of raw.split(',')) {
    const v = t.trim().toLowerCase().slice(0, 40);
    if (v && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 20);
}

export function SaveToLibraryDialog({
  open,
  onOpenChange,
  board,
  defaultName = '',
  defaultSport = 'futbol',
  defaultObjective = '',
  defaultMinutes = null,
  onSaved,
}: SaveToLibraryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [objective, setObjective] = useState(defaultObjective);
  const [minutes, setMinutes] = useState(defaultMinutes != null ? String(defaultMinutes) : '');
  const [ageGroup, setAgeGroup] = useState('');
  const [materials, setMaterials] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState<ExerciseSport>(defaultSport);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setObjective(defaultObjective);
    setMinutes(defaultMinutes != null ? String(defaultMinutes) : '');
    setAgeGroup('');
    setMaterials('');
    setTags('');
    setDescription('');
    setSport(defaultSport);
  }, [open, defaultName, defaultObjective, defaultMinutes, defaultSport]);

  const minutesNum = minutes.trim() === '' ? null : Number(minutes);
  const minutesInvalid = minutesNum !== null && (!Number.isInteger(minutesNum) || minutesNum < 1 || minutesNum > 240);
  const isEmptyBoard = board.players.length === 0 && board.arrows.length === 0 && board.frames.length === 0;

  const save = useMutation({
    mutationFn: () => createExercise({
      name: name.trim(),
      objective: objective.trim() || null,
      minutes: minutesNum,
      age_group: ageGroup.trim() || null,
      materials: materials.trim() || null,
      description: description.trim() || null,
      tags: parseTags(tags),
      sport,
      board,
    }),
    onSuccess: (ex) => {
      queryClient.invalidateQueries({ queryKey: ['training-exercises'] });
      toast({ title: 'Guardado en la biblioteca', description: `"${ex.name}" ya está en «De mi escuela».` });
      onSaved?.(ex);
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({ title: 'No se pudo guardar el ejercicio', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    },
  });

  const thumb = exerciseThumbnail(board);
  const canSave = name.trim().length > 0 && !minutesInvalid && !save.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BookmarkPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Guardar en biblioteca</DialogTitle>
              <DialogDescription>
                Se guarda la jugada con los puestos, sin los nombres de los jugadores, para usarla con cualquier equipo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (canSave) save.mutate(); }}
        >
          <div className="grid grid-cols-[96px_1fr] gap-3 items-start">
            <div className="rounded-lg overflow-hidden bg-emerald-800">
              <TacticalStaticSvg players={thumb.players} arrows={thumb.arrows} width={96} className="w-full h-auto" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-name">Nombre *</Label>
              <Input
                id="ex-name"
                value={name}
                maxLength={MAX_NAME}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Rondo 4v2 a dos toques"
                className="min-h-11"
                autoFocus
              />
              {isEmptyBoard && (
                <p className="text-xs text-muted-foreground">La cancha está vacía: se guarda solo la ficha del ejercicio.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ex-objective">Objetivo</Label>
            <Textarea
              id="ex-objective"
              value={objective}
              maxLength={1000}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="¿Qué se busca con el ejercicio?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ex-minutes">Duración (min)</Label>
              <Input
                id="ex-minutes"
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="15"
                className="min-h-11"
                aria-invalid={minutesInvalid}
              />
              {minutesInvalid && <p className="text-xs text-destructive">Entre 1 y 240 minutos.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-age">Edad o categoría</Label>
              <Input
                id="ex-age"
                value={ageGroup}
                maxLength={60}
                onChange={(e) => setAgeGroup(e.target.value)}
                placeholder="Ej: Sub-12"
                className="min-h-11"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Deporte</Label>
              <Select value={sport} onValueChange={(v) => setSport(v as ExerciseSport)}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(EXERCISE_SPORT_LABEL) as ExerciseSport[]).map((s) => (
                    <SelectItem key={s} value={s}>{EXERCISE_SPORT_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-materials">Material</Label>
              <Input
                id="ex-materials"
                value={materials}
                maxLength={500}
                onChange={(e) => setMaterials(e.target.value)}
                placeholder="Ej: 4 platillos, 2 petos"
                className="min-h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ex-tags">Etiquetas</Label>
            <Input
              id="ex-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Separadas por coma: rondo, posesión, pase"
              className="min-h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ex-description">Organización / descripción</Label>
            <Textarea
              id="ex-description"
              value={description}
              maxLength={4000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Espacio, reglas, variantes…"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={!canSave}>
              {save.isPending ? 'Guardando…' : 'Guardar en biblioteca'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
