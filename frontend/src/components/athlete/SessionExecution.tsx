import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { postSessionExerciseResults } from '@/lib/athlete/queries';
import { bffClient } from '@/lib/api/bffClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Loader2, CheckCircle2, Dumbbell, ChevronDown, ChevronUp,
  Wind, Heart, Zap, Timer, Coffee, FileText,
} from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Block {
  name: string;
  type?: string;
  sets?: number;
  reps?: string;
  weight?: string;
  weight_unit?: string;
  duration_minutes?: number;
  rest_seconds?: number;
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
  reps_completed: number | '';
  weight_kg:      number | '';
  rpe:            number | '';
}

// ── Config de tipos de bloque ────────────────────────────────────────────────
// recordFields define qué columnas se muestran al atleta para registrar:
//   'reps'   → stepper de repeticiones
//   'weight' → stepper de peso
//   'rpe'    → stepper de RPE
// Si recordFields está vacío, se muestra solo el panel informativo de tiempo.
const BLOCK_CONFIG: Record<string, {
  icon: any; color: string; barColor: string; label: string;
  recordFields: Array<'reps' | 'weight' | 'rpe'>;
}> = {
  warmup:      { icon: Wind,    color: 'text-orange-500', barColor: 'bg-orange-500',  label: 'Calentamiento', recordFields: []                        },
  strength:    { icon: Dumbbell,color: 'text-red-500',    barColor: 'bg-red-500',     label: 'Fuerza',        recordFields: ['reps', 'weight', 'rpe'] },
  cardio:      { icon: Heart,   color: 'text-blue-500',   barColor: 'bg-blue-500',    label: 'Cardio',        recordFields: []                        },
  hiit:        { icon: Zap,     color: 'text-purple-500', barColor: 'bg-purple-500',  label: 'HIIT',          recordFields: ['rpe']           },
  flexibility: { icon: Timer,   color: 'text-green-500',  barColor: 'bg-green-500',   label: 'Flexibilidad',  recordFields: []                        },
  cooldown:    { icon: Coffee,  color: 'text-indigo-500', barColor: 'bg-indigo-500',  label: 'Vuelta calma',  recordFields: []                        },
};
const DEFAULT_CFG = { icon: Dumbbell, color: 'text-primary', barColor: 'bg-primary', label: 'Ejercicio', recordFields: ['reps', 'weight', 'rpe'] as Array<'reps'|'weight'|'rpe'> };

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeEmptySets(count: number): SetResult[] {
  return Array.from({ length: count }, () => ({
    reps_completed: '' as const,
    weight_kg:      '' as const,
    rpe:            '' as const,
  }));
}

function normalizeBlocks(raw: any): Block[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.blocks && Array.isArray(raw.blocks)) return raw.blocks;
  return [];
}

function weightDisplay(block: Block): string {
  if (!block.weight || block.weight === '0') return '';
  const isNum = /^\d+(\.\d+)?$/.test(String(block.weight).trim());
  return isNum ? `${block.weight} ${block.weight_unit ?? 'kg'}` : block.weight;
}

// ── Componente ───────────────────────────────────────────────────────────────
export function SessionExecution({ session, onClose, onCompleted }: SessionExecutionProps) {
  const { toast } = useToast();
  const blocks = normalizeBlocks(session.blocks);

  // Pre-poblar con los valores por defecto del bloque
  const [setResults, setSetResults] = useState<Record<number, SetResult[]>>(
    () => Object.fromEntries(
      blocks.map((b, i) => {
        // Reps: usar el valor del bloque si es numérico
        const defaultReps = b.reps && /^\d+$/.test(String(b.reps).trim())
          ? parseInt(b.reps, 10) as number
          : '' as const;
        // Peso: usar el valor del bloque si es número puro
        const rawWeight   = String(b.weight ?? '').trim();
        const defaultWeight = /^\d+(\.\d+)?$/.test(rawWeight)
          ? parseFloat(rawWeight) as number
          : '' as const;
        const count = b.sets ?? 3;
        return [
          i,
          Array.from({ length: count }, () => ({
            reps_completed: defaultReps,
            weight_kg:      defaultWeight,
            rpe:            '' as const,
          })),
        ];
      })
    )
  );

  const [expandedBlock, setExpandedBlock] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted]   = useState(false);

  const updateSet = (blockIdx: number, setIdx: number, field: keyof SetResult, value: number | '') => {
    setSetResults(prev => {
      const blockSets = [...(prev[blockIdx] ?? [])];
      blockSets[setIdx] = { ...blockSets[setIdx], [field]: value };
      return { ...prev, [blockIdx]: blockSets };
    });
  };

  const handleComplete = async () => {
    try {
      setSubmitting(true);

      const resultsArray = blocks.flatMap((block, blockIdx) => {
        const sets = setResults[blockIdx] ?? [];
        return sets
          .map((s, setIdx) => ({
            exercise_key:   `block_${blockIdx}`,
            exercise_name:  block.name ?? `Ejercicio ${blockIdx + 1}`,
            set_number:     setIdx + 1,
            reps_completed: typeof s.reps_completed === 'number' ? s.reps_completed : null,
            weight_kg:      typeof s.weight_kg      === 'number' ? s.weight_kg      : null,
            rpe:            typeof s.rpe            === 'number' ? s.rpe            : null,
            notes:          null,
          }))
          .filter(r => r.reps_completed !== null || r.weight_kg !== null);
      });

      if (resultsArray.length > 0) {
        await postSessionExerciseResults(session.id, resultsArray);
      }

      await bffClient.post(`/api/v1/athlete/training/session/${session.id}/complete`, {
        results: {
          blocks_results: blocks.map((block, blockIdx) => {
            const sets      = setResults[blockIdx] ?? [];
            const blockType = block.type ?? 'strength';

            // Peso: último set con peso registrado (solo strength)
            const lastSetWithWeight = [...sets].reverse()
              .find(s => typeof s.weight_kg === 'number');

            // RPE: promedio de sets con RPE (strength y hiit)
            const setsWithRpe = sets.filter(s => typeof s.rpe === 'number');
            const avgRpe = setsWithRpe.length > 0
              ? Math.round(
                  setsWithRpe.reduce((sum, s) => sum + (s.rpe as number), 0) / setsWithRpe.length
                )
              : null;

            return {
              block_index:      blockIdx,
              block_type:       blockType,
              actual_weight:    lastSetWithWeight?.weight_kg ?? null,
              actual_rpe:       avgRpe,
              // cardio/hiit/flexibility/warmup: duración del bloque definida por el trainer
              duration_minutes: block.duration_minutes ?? null,
            };
          }),
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
      <DialogContent className="max-w-xl max-h-[88vh] flex flex-col p-0 overflow-hidden border-border/50 shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-5 border-b bg-primary/5 shrink-0">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Dumbbell className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-black tracking-tight leading-tight">
                {session.name}
              </DialogTitle>
              {session.trainer_profiles && (
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  💪 Sesión de <span className="font-bold text-foreground">{session.trainer_profiles.display_name}</span>
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
                  {blocks.length} ejercicios
                </Badge>
              </div>
            </div>
          </div>

          {/* Notas personalizadas */}
          {session.custom_notes && (
            <div className="mt-4 p-3 bg-muted/30 rounded-xl border border-border/40 flex gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                "{session.custom_notes}"
              </p>
            </div>
          )}
        </DialogHeader>

        {/* ── Cuerpo con scroll ───────────────────────────────────────── */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-3">
            {blocks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Dumbbell className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Esta sesión no tiene ejercicios definidos.</p>
              </div>
            ) : (
              blocks.map((block, blockIdx) => {
                const isOpen = expandedBlock === blockIdx;
                const sets   = setResults[blockIdx] ?? [];
                const cfg    = BLOCK_CONFIG[block.type ?? ''] ?? DEFAULT_CFG;
                const Icon   = cfg.icon;
                const wt     = weightDisplay(block);
                const rf     = cfg.recordFields;          // campos grabables
                const hasTracking = rf.length > 0;        // si false → panel de tiempo
                const usesDuration = !hasTracking;

                return (
                  <div key={blockIdx} className="rounded-2xl border border-border/40 overflow-hidden shadow-sm group hover:border-primary/30 transition-colors bg-card/60">
                    {/* Barra de color por tipo */}
                    <div className={`h-1 ${cfg.barColor} opacity-70`} />

                    {/* Header acordeón */}
                    <button
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors text-left"
                      onClick={() => setExpandedBlock(isOpen ? -1 : blockIdx)}
                    >
                      <div className="flex items-center gap-4">
                        {/* Número */}
                        <div className="h-9 w-9 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center font-black text-base text-muted-foreground group-hover:bg-primary/5 transition-colors shrink-0">
                          {blockIdx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-base leading-tight">{block.name ?? `Ejercicio ${blockIdx + 1}`}</p>
                          <div className={`flex items-center gap-1 mt-0.5 ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">{cfg.label}</span>
                          </div>
                        </div>
                      </div>

                      {/* Métricas resumen */}
                      <div className="flex items-center gap-4 mr-2">
                        {rf.includes('reps') && block.sets && (
                          <div className="hidden sm:flex flex-col items-center">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Sets</span>
                            <span className="font-black text-base leading-none">{block.sets}</span>
                          </div>
                        )}
                        {rf.includes('reps') && block.reps && (
                          <div className="hidden sm:flex flex-col items-center">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Reps</span>
                            <span className="font-black text-base leading-none">{block.reps}</span>
                          </div>
                        )}
                        {usesDuration && block.duration_minutes && (
                          <div className="hidden sm:flex flex-col items-center">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Dur.</span>
                            <span className="font-black text-base leading-none">{block.duration_minutes}<span className="text-xs font-normal"> min</span></span>
                          </div>
                        )}
                        {rf.includes('weight') && wt && (
                          <div className="hidden sm:flex flex-col items-center">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Peso</span>
                            <span className="font-black text-base leading-none">{wt}</span>
                          </div>
                        )}
                        {isOpen
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </div>
                    </button>

                    {/* Detalle expandido */}
                    {isOpen && (
                      <div className="px-5 pb-5 space-y-4 bg-accent/10 border-t border-border/30">
                        {/* Notas del bloque */}
                        {block.notes && (
                          <p className="text-xs text-muted-foreground italic pt-3 px-1">
                            📝 {block.notes}
                          </p>
                        )}

                        {/* Tabla registro o panel informativo */}
                        {hasTracking ? (
                          <div className="space-y-3 pt-2">
                            {/* Headers dinámicos según recordFields */}
                            <div className={`grid gap-3 px-1`} style={{ gridTemplateColumns: `repeat(${rf.length}, 1fr)` }}>
                              {rf.includes('reps')   && <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest text-center">Reps</span>}
                              {rf.includes('weight') && <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest text-center">Peso (kg)</span>}
                              {rf.includes('rpe')    && <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest text-center">RPE 1–10</span>}
                            </div>
                            {sets.map((s, setIdx) => (
                              <div key={setIdx} className="flex items-center gap-3">
                                <span className="text-sm font-black text-primary w-6 shrink-0 text-center">{setIdx + 1}</span>
                                <div className="flex-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${rf.length}, 1fr)`, gap: '0.75rem' }}>
                                  {rf.includes('reps') && (
                                    <NumberStepper
                                      value={s.reps_completed}
                                      onChange={val => updateSet(blockIdx, setIdx, 'reps_completed', val)}
                                      min={0} max={999} step={1}
                                    />
                                  )}
                                  {rf.includes('weight') && (
                                    <NumberStepper
                                      value={s.weight_kg}
                                      onChange={val => updateSet(blockIdx, setIdx, 'weight_kg', val)}
                                      min={0} max={500} step={1}
                                    />
                                  )}
                                  {rf.includes('rpe') && (
                                    <NumberStepper
                                      value={s.rpe}
                                      onChange={val => updateSet(blockIdx, setIdx, 'rpe', val)}
                                      min={1} max={10} step={1}
                                    />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          /* Bloque de tiempo — solo info, sin registro por sets */
                          <div className="pt-3 p-4 bg-muted/20 rounded-xl border border-border/30 text-center">
                            <p className="text-xs text-muted-foreground font-medium">
                              {block.duration_minutes
                                ? `Duración: ${block.duration_minutes} min`
                                : 'Realiza la actividad según las instrucciones'}
                            </p>
                            {block.rest_seconds && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                Descanso: {block.rest_seconds} s
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/10 flex items-center justify-between shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={submitting} className="font-bold text-muted-foreground">
            Cancelar
          </Button>
          <Button
            onClick={handleComplete}
            disabled={submitting || completed}
            className="gap-2 min-w-[160px] h-11 font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
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
