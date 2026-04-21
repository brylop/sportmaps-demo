import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { postSessionExerciseResults } from '@/lib/athlete/queries';
import { bffClient } from '@/lib/api/bffClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';

interface Block {
  name: string;
  sets?: number;
  reps?: string;
  weight?: string;
  duration?: string;
  rest?: string;
  notes?: string;
}

interface SessionExecutionProps {
  session: {
    id: string;
    name: string;
    blocks: Block[] | { blocks?: Block[] } | any;
    custom_notes?: string | null;
    trainer_profiles?: { display_name: string } | null;
  };
  onClose: () => void;
  onCompleted: () => void;
}

interface SetResult {
  reps_completed: string;
  weight_kg: string;
  rpe: string;
  notes: string;
}

function makeEmptySets(count: number): SetResult[] {
  return Array.from({ length: count }, () => ({
    reps_completed: '',
    weight_kg: '',
    rpe: '',
    notes: '',
  }));
}

// Normalizar blocks — el JSONB puede venir en distintos formatos
function normalizeBlocks(raw: any): Block[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.blocks && Array.isArray(raw.blocks)) return raw.blocks;
  return [];
}

export function SessionExecution({ session, onClose, onCompleted }: SessionExecutionProps) {
  const { toast } = useToast();
  const blocks = normalizeBlocks(session.blocks);

  // Estado por bloque: { [blockIndex]: SetResult[] }
  const [setResults, setSetResults] = useState<Record<number, SetResult[]>>(
    () => Object.fromEntries(
      blocks.map((b, i) => [i, makeEmptySets(b.sets ?? 3)])
    )
  );

  const [expandedBlock, setExpandedBlock] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const updateSet = (blockIdx: number, setIdx: number, field: keyof SetResult, value: string) => {
    setSetResults(prev => {
      const blockSets = [...(prev[blockIdx] ?? [])];
      blockSets[setIdx] = { ...blockSets[setIdx], [field]: value };
      return { ...prev, [blockIdx]: blockSets };
    });
  };

  const handleComplete = async () => {
    try {
      setSubmitting(true);

      // Construir results para el BFF
      const resultsArray = blocks.flatMap((block, blockIdx) => {
        const sets = setResults[blockIdx] ?? [];
        return sets
          .map((s, setIdx) => ({
            exercise_key:    `block_${blockIdx}`,
            exercise_name:   block.name ?? `Ejercicio ${blockIdx + 1}`,
            set_number:      setIdx + 1,
            reps_completed:  s.reps_completed ? parseInt(s.reps_completed, 10) : null,
            weight_kg:       s.weight_kg ? parseFloat(s.weight_kg) : null,
            rpe:             s.rpe ? parseInt(s.rpe, 10) : null,
            notes:           s.notes || null,
          }))
          .filter(r => r.reps_completed !== null || r.weight_kg !== null); // solo sets con data
      });

      // 1. Guardar resultados set a set
      if (resultsArray.length > 0) {
        await postSessionExerciseResults(session.id, resultsArray);
      }

      // 2. Marcar sesión como completada (Ruta del Atleta corregida)
      await bffClient.post(`/api/v1/athlete/training/session/${session.id}/complete`, {
        results: {
          blocks_results: blocks.map((block, blockIdx) => {
            const sets = setResults[blockIdx] ?? [];
            const lastSetWithWeight = [...sets].reverse().find(s => s.weight_kg);
            return {
              block_index:   blockIdx,
              actual_weight: lastSetWithWeight?.weight_kg ?? null,
            };
          }),
          actual_duration_minutes: null, // podría agregarse un timer en v2
        },
      });

      setCompleted(true);
      toast({ title: '¡Sesión completada! 💪', description: 'Tu progreso ha sido guardado.' });
      setTimeout(onCompleted, 1500);
    } catch (err: any) {
      toast({
        title: 'Error al guardar',
        description: err?.message ?? 'Intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">{session.name}</DialogTitle>
              {session.trainer_profiles && (
                <p className="text-xs text-muted-foreground">
                  💪 {session.trainer_profiles.display_name}
                </p>
              )}
            </div>
          </div>
          {session.custom_notes && (
            <p className="text-sm text-muted-foreground italic mt-2 px-1">
              "{session.custom_notes}"
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {blocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Dumbbell className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Esta sesión no tiene ejercicios definidos.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map((block, blockIdx) => {
                const isOpen = expandedBlock === blockIdx;
                const sets = setResults[blockIdx] ?? [];

                return (
                  <div key={blockIdx} className="rounded-xl border overflow-hidden">
                    {/* Block header */}
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors text-left"
                      onClick={() => setExpandedBlock(isOpen ? -1 : blockIdx)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {blockIdx + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{block.name ?? `Ejercicio ${blockIdx + 1}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {block.sets ?? 3} series
                            {block.reps ? ` · ${block.reps} reps` : ''}
                            {block.weight ? ` · ${block.weight}` : ''}
                          </p>
                        </div>
                      </div>
                      {isOpen
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>

                    {/* Sets input */}
                    {isOpen && (
                      <div className="px-4 pb-4 space-y-3 bg-accent/20">
                        {block.notes && (
                          <p className="text-xs text-muted-foreground italic pt-2">
                            📝 {block.notes}
                          </p>
                        )}
                        {/* Column headers */}
                        <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground pt-1">
                          <span>Serie</span>
                          <span>Reps</span>
                          <span>Peso (kg)</span>
                          <span>RPE (1-10)</span>
                        </div>
                        {sets.map((s, setIdx) => (
                          <div key={setIdx} className="grid grid-cols-4 gap-2 items-center">
                            <span className="text-sm font-medium text-muted-foreground">
                              #{setIdx + 1}
                            </span>
                            <Input
                              type="number"
                              min="0"
                              placeholder={block.reps ?? '—'}
                              value={s.reps_completed}
                              onChange={e => updateSet(blockIdx, setIdx, 'reps_completed', e.target.value)}
                              className="h-8 text-sm"
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder={block.weight ?? '—'}
                              value={s.weight_kg}
                              onChange={e => updateSet(blockIdx, setIdx, 'weight_kg', e.target.value)}
                              className="h-8 text-sm"
                            />
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              placeholder="—"
                              value={s.rpe}
                              onChange={e => updateSet(blockIdx, setIdx, 'rpe', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleComplete}
            disabled={submitting || completed}
            className="gap-2 min-w-[140px]"
          >
            {completed ? (
              <><CheckCircle2 className="h-4 w-4" /> ¡Completada!</>
            ) : submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              '✅ Completar sesión'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
