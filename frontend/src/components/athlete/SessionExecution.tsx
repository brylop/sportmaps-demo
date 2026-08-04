import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { postSessionExerciseResults } from '@/lib/athlete/queries';
import { bffClient, BFF_URL } from '@/lib/api/bffClient';
import { useSessionProgress, BlockSetResult } from '../../hooks/useSessionProgress';
import { useRestTimer } from '../../hooks/useRestTimer';
import { RestTimerInline } from './RestTimerInline';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Loader2, CheckCircle2, Dumbbell, ChevronDown, ChevronUp,
  Wind, Heart, Zap, Timer, Coffee, FileText, Flame, BookOpen,
  Camera, Activity, RotateCcw, Save, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { BiomechCaptureModal } from '@/components/biomech/BiomechCaptureModal';
import { useBodyMetrics } from '@/hooks/useAthleteData';
import { calculateExerciseCalories } from '@/lib/trainer/calorieUtils';
import { useEntitlements } from '@/hooks/useEntitlements';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Block {
  name:              string;
  type?:             string;
  sets?:             number;
  reps?:             string;
  weight?:           string;
  weight_unit?:      string;
  duration_minutes?: number;
  rest_seconds?:     number;
  notes?:            string;
  wger_id?:          number | null;
  free_db_id?:       string | null;
  wger_images?:      string[];
  wger_description?: string | null;
  muscle_names?:     string[];
  equipment_name?:   string | null;
  is_compound?:      boolean;
  level?:            string | null;
  mechanic?:         string | null;
  analyzer_required?: boolean;
  analyzer_code?:    'hack_squat' | 'incline_press' | 'row';
  set_type?:  'normal' | 'drop_set' | 'piramidal_asc' | 'piramidal_desc' | null;
  set_config?: Array<{
    reps?:         string | null;
    weight?:       string | null;
    rest_seconds?: number | null;
    is_drop_set?:  boolean;
    drops?:        Array<{ reps?: string | null; weight?: string | null }> | null;
  }> | null;
}

interface SessionExecutionProps {
  session: {
    id:               string;
    name:             string;
    school_id?:       string;
    blocks:           Block[] | { blocks?: Block[] } | any;
    custom_notes?:    string | null;
    trainer_profiles?: { display_name: string } | null;
    execution_progress?: any;   // progreso parcial del servidor
  };
  onClose:     () => void;
  onCompleted: () => void;
}

// ── Config de tipos de bloque ─────────────────────────────────────────────────
const BLOCK_CONFIG: Record<string, {
  icon: any; color: string; barColor: string; label: string;
  recordFields: Array<'reps' | 'weight' | 'rpe'>;
}> = {
  warmup:      { icon: Wind,    color: 'text-orange-500', barColor: 'bg-orange-500',  label: 'Calentamiento', recordFields: []                        },
  strength:    { icon: Dumbbell,color: 'text-red-500',    barColor: 'bg-red-500',     label: 'Fuerza',        recordFields: ['reps', 'weight', 'rpe'] },
  cardio:      { icon: Heart,   color: 'text-blue-500',   barColor: 'bg-blue-500',    label: 'Cardio',        recordFields: []                        },
  hiit:        { icon: Zap,     color: 'text-purple-500', barColor: 'bg-purple-500',  label: 'HIIT',          recordFields: ['rpe']                   },
  flexibility: { icon: Timer,   color: 'text-green-500',  barColor: 'bg-green-500',   label: 'Flexibilidad',  recordFields: []                        },
  cooldown:    { icon: Coffee,  color: 'text-indigo-500', barColor: 'bg-indigo-500',  label: 'Vuelta calma',  recordFields: []                        },
};
const DEFAULT_CFG = {
  icon: Dumbbell, color: 'text-primary', barColor: 'bg-primary',
  label: 'Ejercicio', recordFields: ['reps', 'weight', 'rpe'] as Array<'reps'|'weight'|'rpe'>,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeInitialSets(blocks: Block[]): Record<number, BlockSetResult[]> {
  return Object.fromEntries(
    blocks.map((b, i) => {
      const count = b.sets ?? 3;
      return [
        i,
        Array.from({ length: count }, (_, setIdx) => {
          const configRow = b.set_config?.[setIdx];
          const repsStr   = configRow?.reps   ?? b.reps;
          const weightStr = configRow?.weight ?? b.weight;
          const defaultReps: number | '' =
            repsStr && /^\d+$/.test(String(repsStr).trim())
              ? parseInt(String(repsStr), 10) : '';
          const rawWeight = String(weightStr ?? '').trim();
          const defaultWeight: number | '' =
            /^\d+(\.\d+)?$/.test(rawWeight) ? parseFloat(rawWeight) : '';
          if (configRow?.is_drop_set && configRow?.drops?.length) {
            return {
              reps_completed: '' as const, weight_kg: '' as const, rpe: '' as const,
              completed: false,
              drops_results: configRow.drops.map(d => ({
                reps_completed: d.reps && /^\d+$/.test(String(d.reps)) ? parseInt(String(d.reps), 10) : '' as const,
                weight_kg: d.weight && /^\d+(\.\d+)?$/.test(String(d.weight ?? '')) ? parseFloat(String(d.weight)) : '' as const,
              })),
            };
          }
          return { reps_completed: defaultReps, weight_kg: defaultWeight, rpe: '' as const, completed: false };
        }),
      ];
    })
  );
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

function fmtAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)  return 'hace unos segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

// ── Componente ────────────────────────────────────────────────────────────────
export function SessionExecution({ session, onClose, onCompleted }: SessionExecutionProps) {
  const ent    = useEntitlements();
  const { toast } = useToast();
  const blocks = normalizeBlocks(session.blocks);

  const { data: bodyMetricsData } = useBodyMetrics(1);
  const athleteWeightKg = (bodyMetricsData?.[0] as any)?.weight_kg ?? 70;
  const isEstimatedWeight = !bodyMetricsData?.[0]?.weight_kg;

  const initialSetResults = makeInitialSets(blocks);

  // ── Progreso parcial ──────────────────────────────────────────────────────
  const {
    setResults, completedBlocks, isSaving, lastSavedAt, isRestored,
    updateSet, updateDropResult, checkpointBlock, saveToServer, clearLocalProgress,
  } = useSessionProgress({
    sessionId:        session.id,
    initialProgress:  session.execution_progress ?? null,
    initialSetResults,
  });

  // ── Estado UI ─────────────────────────────────────────────────────────────
  const [expandedBlock,   setExpandedBlock]   = useState<number>(0);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<number, boolean>>({});
  const [submitting,      setSubmitting]       = useState(false);
  const [completed,       setCompleted]        = useState(false);
  const [biomechBlock,    setBiomechBlock]     = useState<{ blockIdx: number; block: Block } | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<Record<number, number>>({});
  const [showSavedBadge,  setShowSavedBadge]  = useState(false);

  // Mostrar badge "Guardado" brevemente tras checkpoint
  useEffect(() => {
    if (!isSaving && lastSavedAt) {
      setShowSavedBadge(true);
      const t = setTimeout(() => setShowSavedBadge(false), 2500);
      return () => clearTimeout(t);
    }
  }, [lastSavedAt, isSaving]);

  // ── Timer de descanso y Estado de Descanso por Serie ──────────────────────
  const [activeTimerBlock, setActiveTimerBlock] = useState<number | null>(null);
  const [restingSet, _setRestingSet] = useState<{ blockIdx: number; setIdx: number } | null>(null);
  const restingSetRef = useRef<{ blockIdx: number; setIdx: number } | null>(null);

  const setRestingSet = useCallback((val: { blockIdx: number; setIdx: number } | null) => {
    restingSetRef.current = val;
    _setRestingSet(val);
  }, []);

  // ── Checkpoint al cambiar de bloque ──────────────────────────────────────
  const handleExpandBlock = useCallback(async (blockIdx: number) => {
    const prev = expandedBlock;
    setExpandedBlock(blockIdx);

    // Si se estaba viendo un bloque con tracking, guardarlo
    if (prev >= 0 && prev !== blockIdx) {
      const cfg = BLOCK_CONFIG[blocks[prev]?.type ?? ''] ?? DEFAULT_CFG;
      if (cfg.recordFields.length > 0) {
        await checkpointBlock(prev);
      }
    }
  }, [expandedBlock, blocks, checkpointBlock]);

  const handlePrevBlock = useCallback(() => {
    if (expandedBlock > 0) {
      handleExpandBlock(expandedBlock - 1);
    }
  }, [expandedBlock, handleExpandBlock]);

  const handleNextBlock = useCallback(() => {
    if (expandedBlock < blocks.length - 1) {
      handleExpandBlock(expandedBlock + 1);
    }
  }, [expandedBlock, blocks.length, handleExpandBlock]);

  const restTimer = useRestTimer({
    onFinished: async () => {
      const activeRest = restingSetRef.current;
      if (activeRest) {
        // Marcar la serie como completada al finalizar el descanso
        updateSet(activeRest.blockIdx, activeRest.setIdx, 'completed', true);
        
        // Guardar progreso en el servidor
        await checkpointBlock(activeRest.blockIdx);

        // Limpiar el estado de descanso
        setRestingSet(null);
      } else {
        // Al terminar el descanso autónomo, expandir el siguiente bloque
        if (activeTimerBlock !== null && activeTimerBlock < blocks.length - 1) {
          handleExpandBlock(activeTimerBlock + 1);
        }
      }
      setActiveTimerBlock(null);
    },
  });

  const startRestForBlock = useCallback((blockIdx: number) => {
    const restSecs = blocks[blockIdx]?.rest_seconds ?? 90; // default 90s
    setActiveTimerBlock(blockIdx);
    restTimer.start(restSecs);
  }, [blocks, restTimer]);

  // ── Marcar bloque como completo manualmente ───────────────────────────────
  const handleMarkBlockDone = useCallback(async (blockIdx: number) => {
    await checkpointBlock(blockIdx);
    // Iniciar timer de descanso si el bloque tiene rest_seconds o usamos default
    const cfg = BLOCK_CONFIG[blocks[blockIdx]?.type ?? ''] ?? DEFAULT_CFG;
    if (cfg.recordFields.length > 0) {
      startRestForBlock(blockIdx);
    }
    // Expandir siguiente bloque
    if (blockIdx < blocks.length - 1) {
      handleExpandBlock(blockIdx + 1);
    }
  }, [blocks, checkpointBlock, startRestForBlock, handleExpandBlock]);

  // ── Estado de series (Completar serie individual e iniciar descanso) ────────
  const isSetDone = useCallback((blockIdx: number, setIdx: number) => {
    const set = setResults[blockIdx]?.[setIdx];
    return !!set?.completed;
  }, [setResults]);

  const handleSetDone = useCallback(async (blockIdx: number, setIdx: number) => {
    const isDone = isSetDone(blockIdx, setIdx);
    
    if (isDone) {
      // Si ya estaba completado, desmarcarlo y resetear timer si corresponde
      updateSet(blockIdx, setIdx, 'completed', false);
      if (restingSetRef.current?.blockIdx === blockIdx && restingSetRef.current?.setIdx === setIdx) {
        restTimer.skip();
        setRestingSet(null);
        setActiveTimerBlock(null);
      }
      await checkpointBlock(blockIdx);
    } else {
      // Iniciar el temporizador para esta serie
      const restSecs = blocks[blockIdx]?.rest_seconds ?? 90;
      setRestingSet({ blockIdx, setIdx });
      setActiveTimerBlock(blockIdx);
      restTimer.start(restSecs);
    }
  }, [blocks, isSetDone, updateSet, checkpointBlock, restTimer, setRestingSet]);

  // ── Completar sesión ──────────────────────────────────────────────────────
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

      const actualCalories = blocks.reduce((total, block, blockIdx) => {
        const sets = setResults[blockIdx] ?? [];
        return total + calculateExerciseCalories({
          type:             block.type ?? 'strength',
          sets:             block.sets ?? sets.length,
          reps:             block.reps ?? 0,
          duration_minutes: block.duration_minutes ?? 0,
          difficulty:       'intermedio',
          weight_kg:        athleteWeightKg,
        });
      }, 0);

      await bffClient.post(`/api/v1/athlete/training/session/${session.id}/complete`, {
        results: {
          blocks_results: blocks.map((block, blockIdx) => {
            const sets      = setResults[blockIdx] ?? [];
            const blockType = block.type ?? 'strength';
            const lastSetWithWeight = [...sets].reverse().find(s => typeof s.weight_kg === 'number');
            const setsWithRpe = sets.filter(s => typeof s.rpe === 'number');
            const avgRpe = setsWithRpe.length > 0
              ? Math.round(setsWithRpe.reduce((sum, s) => sum + (s.rpe as number), 0) / setsWithRpe.length)
              : null;
            return {
              block_index:      blockIdx,
              block_type:       blockType,
              actual_weight:    lastSetWithWeight?.weight_kg ?? null,
              actual_rpe:       avgRpe,
              duration_minutes: block.duration_minutes ?? null,
              completed:        completedBlocks.includes(blockIdx),
            };
          }),
          actual_calories: actualCalories,
        },
      });

      clearLocalProgress();
      setCompleted(true);
      toast({ title: '¡Sesión completada! 💪', description: 'Tu progreso ha sido guardado.' });
      setTimeout(onCompleted, 1500);
    } catch (err: any) {
      toast({ title: 'Error al guardar', description: err?.message ?? 'Intenta de nuevo.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="w-[98vw] max-w-6xl h-[92vh] lg:h-[85vh] flex flex-col p-0 overflow-hidden border-border/50 shadow-2xl bg-background transition-all duration-300 rounded-3xl">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b bg-primary/5 shrink-0">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Dumbbell className="h-5.5 w-5.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-black tracking-tight leading-tight">
                  {session.name}
                </DialogTitle>
                {session.trainer_profiles && (
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                    💪 Sesión de <span className="font-bold text-foreground">{session.trainer_profiles.display_name}</span>
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
                    {blocks.length} ejercicios
                  </Badge>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-orange-500/20 text-orange-500 bg-orange-500/5 flex items-center gap-1">
                    <Flame className="h-2.5 w-2.5" />
                    {blocks.reduce((total, block, blockIdx) => {
                      const sets = setResults[blockIdx] ?? [];
                      return total + calculateExerciseCalories({
                        type: block.type ?? 'strength', sets: block.sets ?? sets.length,
                        reps: block.reps ?? 0, duration_minutes: block.duration_minutes ?? 0,
                        difficulty: 'intermedio', weight_kg: athleteWeightKg,
                      });
                    }, 0)} kcal
                    {isEstimatedWeight && <span className="text-[7px] opacity-60 ml-0.5">est.</span>}
                  </Badge>
                  {/* Badge progreso */}
                  {completedBlocks.length > 0 && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-green-500/20 text-green-600 bg-green-500/5">
                      {completedBlocks.length}/{blocks.length} completados
                    </Badge>
                  )}
                  {/* Guardado */}
                  {isSaving && (
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" /> Guardando...
                    </span>
                  )}
                  {showSavedBadge && !isSaving && (
                    <span className="flex items-center gap-1 text-[9px] text-green-600 animate-in fade-in">
                      <Save className="h-2.5 w-2.5" /> Guardado
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Banner de sesión recuperada */}
            {isRestored && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <RotateCcw className="h-3 w-3 text-amber-600 shrink-0" />
                <p className="text-[10px] text-amber-700 font-medium">
                  Sesión en progreso — retomando donde la dejaste
                  {lastSavedAt && <span className="opacity-70"> · guardado {fmtAgo(lastSavedAt)}</span>}
                </p>
              </div>
            )}

            {/* Notas personalizadas */}
            {session.custom_notes && (
              <div className="mt-2 p-2 bg-muted/30 rounded-xl border border-border/40 flex gap-2">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground italic leading-tight">"{session.custom_notes}"</p>
              </div>
            )}
          </DialogHeader>

          {/* ── Cuerpo con Diseño Modular Split-Screen / Step-by-Step ────── */}
          <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
            
            {/* Barra lateral de Ejercicios - Solo visible en LG+ (Desktop) */}
            <div className="hidden lg:flex flex-col w-80 border-r border-border/40 bg-muted/5 shrink-0 overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div className="p-4 space-y-2">
                  {blocks.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Sin ejercicios</p>
                  ) : (
                    blocks.map((b, idx) => {
                      const isActive = expandedBlock === idx;
                      const isBlockDone = completedBlocks.includes(idx);
                      const bCfg = BLOCK_CONFIG[b.type ?? ''] ?? DEFAULT_CFG;
                      const BIcon = bCfg.icon;
                      
                      const completedSetsCount = setResults[idx]?.filter((s, sIdx) => isSetDone(idx, sIdx)).length ?? 0;
                      const totalSetsCount = b.sets ?? 3;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleExpandBlock(idx)}
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left border transition-all duration-200 ${
                            isActive
                              ? 'bg-primary/10 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/20'
                              : isBlockDone
                              ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/30'
                              : 'bg-card border-border/30 hover:border-primary/20 hover:bg-accent/5'
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
                            isBlockDone
                              ? 'bg-green-500/20 text-green-600 border border-green-500/30'
                              : isActive
                              ? 'bg-primary/20 text-primary border border-primary/30'
                              : 'bg-muted border border-border/30 text-muted-foreground'
                          }`}>
                            {isBlockDone ? <CheckCircle2 className="h-4.5 w-4.5" /> : idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs leading-tight truncate text-foreground">
                              {b.name ?? `Ejercicio ${idx + 1}`}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-0.5 ${bCfg.color}`}>
                                <BIcon className="h-2 w-2" /> {bCfg.label}
                              </span>
                              {bCfg.recordFields.length > 0 && (
                                <span className="text-[9px] text-muted-foreground font-medium">
                                  {completedSetsCount}/{totalSetsCount} series
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Panel Principal - Detalle del Ejercicio Activo */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card">
              
              {/* Ribbon Superior Horizontal para Celulares y Tablets - Oculto en LG+ */}
              <div className="lg:hidden shrink-0 border-b border-border/30 bg-muted/10 py-2.5 px-4 overflow-x-auto flex items-center gap-2 scrollbar-none">
                {blocks.map((b, idx) => {
                  const isActive = expandedBlock === idx;
                  const isBlockDone = completedBlocks.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleExpandBlock(idx)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        isActive
                          ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20'
                          : isBlockDone
                          ? 'bg-green-500/10 border-green-500/30 text-green-600'
                          : 'bg-card border-border/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className={`h-4 w-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                        isActive
                          ? 'bg-primary-foreground text-primary font-black'
                          : isBlockDone
                          ? 'bg-green-500 text-white font-black'
                          : 'bg-muted border border-border/20 text-muted-foreground font-bold'
                      }`}>
                        {isBlockDone ? '✓' : idx + 1}
                      </span>
                      <span className="max-w-[90px] truncate">{b.name ?? `Ej. ${idx + 1}`}</span>
                    </button>
                  );
                })}
              </div>

              {/* Contenedor dinámico del ejercicio */}
              {expandedBlock >= 0 && expandedBlock < blocks.length ? (() => {
                const block = blocks[expandedBlock];
                const isDone = completedBlocks.includes(expandedBlock);
                const sets = setResults[expandedBlock] ?? [];
                const cfg = BLOCK_CONFIG[block.type ?? ''] ?? DEFAULT_CFG;
                const Icon = cfg.icon;
                const wt = weightDisplay(block);
                const rf = cfg.recordFields;
                const hasTracking = rf.length > 0;
                const usesDuration = !hasTracking;
                const isTimerHere = activeTimerBlock === expandedBlock && restTimer.isActive;

                return (
                  <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    
                    {/* Banner de Info del Ejercicio */}
                    <div className="px-6 py-4 border-b border-border/20 bg-muted/5 flex items-center justify-between shrink-0">
                      <div>
                        <h3 className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
                          <span className="text-primary font-black">#{expandedBlock + 1}</span>
                          {block.name ?? `Ejercicio ${expandedBlock + 1}`}
                        </h3>
                        <div className={`flex items-center gap-1 mt-0.5 ${cfg.color}`}>
                          <Icon className="h-3 w-3" />
                          <span className="text-[9px] font-black uppercase tracking-widest">{cfg.label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {rf.includes('reps') && block.sets && (
                          <div className="flex flex-col items-center bg-muted/40 px-2 py-0.5 rounded-xl border border-border/30">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-widest">Sets</span>
                            <span className="font-black text-xs leading-none mt-0.5">{block.sets}</span>
                          </div>
                        )}
                        {rf.includes('reps') && block.reps && (
                          <div className="flex flex-col items-center bg-muted/40 px-2 py-0.5 rounded-xl border border-border/30">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-widest">Reps</span>
                            <span className="font-black text-xs leading-none mt-0.5">{block.reps}</span>
                          </div>
                        )}
                        {block.weight && block.weight !== '0' && (
                          <div className="flex flex-col items-center bg-muted/40 px-2 py-0.5 rounded-xl border border-border/30">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-widest">Peso Ref</span>
                            <span className="font-black text-xs leading-none mt-0.5">{wt}</span>
                          </div>
                        )}
                        {usesDuration && block.duration_minutes && (
                          <div className="flex flex-col items-center bg-muted/40 px-2 py-0.5 rounded-xl border border-border/30">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-widest">Duración</span>
                            <span className="font-black text-xs leading-none mt-0.5">{block.duration_minutes}m</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contenido en Scroll del Ejercicio */}
                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                          
                          {/* Columna Izquierda: Instrucciones y Media */}
                          <div className="md:col-span-5 space-y-4">
                            
                            {/* Multimedia de Wger */}
                            {(block.wger_images?.length || block.wger_description) ? (
                              <div className="space-y-3 animate-in fade-in duration-300">
                                {(block.wger_images?.length ?? 0) > 0 && (
                                  <div className="space-y-1.5">
                                    <div className="relative rounded-2xl overflow-hidden bg-muted/30 border border-border/30 flex items-center justify-center p-2">
                                      <img
                                        src={(() => {
                                          const rawUrl = block.wger_images![activeImageIndex[expandedBlock] ?? 0];
                                          return rawUrl?.startsWith('/') ? `${BFF_URL}${rawUrl}` : rawUrl;
                                        })()}
                                        alt={`Ejecución — ${block.name}`}
                                        className="w-full h-40 object-contain rounded-xl"
                                        onError={e => { (e.target as HTMLImageElement).closest('div')!.style.display = 'none'; }}
                                      />
                                      {block.wger_images!.length > 1 && (
                                        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                                          {block.wger_images!.map((_, imgIdx) => (
                                            <button key={imgIdx} type="button"
                                              className={`rounded-full transition-all ${(activeImageIndex[expandedBlock] ?? 0) === imgIdx ? 'w-4 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-white/50'}`}
                                              onClick={() => setActiveImageIndex(prev => ({ ...prev, [expandedBlock]: imgIdx }))}
                                            />
                                          ))}
                                        </div>
                                      )}
                                      <span className="absolute top-2 right-2 text-[8px] bg-black/60 text-white/80 px-1.5 py-0.5 rounded font-bold">CC-BY-SA</span>
                                    </div>
                                    {block.wger_images!.length > 1 && (
                                      <button type="button"
                                        className="w-full text-center text-[10px] text-muted-foreground hover:text-primary font-bold transition-colors"
                                        onClick={() => setActiveImageIndex(prev => ({ ...prev, [expandedBlock]: ((prev[expandedBlock] ?? 0) + 1) % block.wger_images!.length }))}
                                      >
                                        {(activeImageIndex[expandedBlock] ?? 0) + 1}/{block.wger_images!.length} · Siguiente foto ❯
                                      </button>
                                    )}
                                  </div>
                                )}

                                {(block.muscle_names?.length || block.equipment_name || block.level) && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {block.muscle_names?.slice(0, 3).map(m => (
                                      <span key={m} className="text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">{m}</span>
                                    ))}
                                    {block.equipment_name && (
                                      <span className="text-[9px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">{block.equipment_name}</span>
                                    )}
                                    {block.level && (
                                      <span className="text-[9px] bg-green-500/10 text-green-600 border border-green-500/20 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">{block.level}</span>
                                    )}
                                  </div>
                                )}

                                {block.wger_description && (
                                  <div className="p-3.5 bg-muted/20 rounded-2xl border border-border/30 space-y-2">
                                    <button
                                      type="button"
                                      className="w-full flex items-center justify-between hover:text-primary transition-colors text-left"
                                      onClick={() => setExpandedDescriptions(prev => ({ ...prev, [expandedBlock]: !prev[expandedBlock] }))}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <BookOpen className="h-4 w-4 text-primary shrink-0" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Instrucciones de Ejecución</span>
                                      </div>
                                      <span className="text-xs text-primary font-bold">
                                        {expandedDescriptions[expandedBlock] ? 'Ocultar' : 'Ver instrucciones'}
                                      </span>
                                    </button>
                                    {expandedDescriptions[expandedBlock] && (
                                      <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line pt-1 border-t border-border/10 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {block.wger_description}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-border/30 bg-muted/5 text-center min-h-[220px] animate-in fade-in duration-300">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                                  <Dumbbell className="h-6 w-6 text-primary animate-pulse" />
                                </div>
                                <p className="text-sm font-black text-foreground">Instrucciones listas</p>
                                <p className="text-xs text-muted-foreground mt-2 max-w-[240px] leading-relaxed">
                                  Realiza las series indicadas manteniendo una técnica controlada y segura en cada repetición.
                                </p>
                              </div>
                            )}

                            {block.notes && (
                              <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl">
                                <p className="text-xs text-muted-foreground italic leading-relaxed">📝 <strong className="text-foreground font-black uppercase tracking-wider text-[9px] not-italic mr-1">Nota:</strong>"{block.notes}"</p>
                              </div>
                            )}
                          </div>

                          {/* Columna Derecha: Registro de Series */}
                          <div className="md:col-span-7 space-y-4">
                            
                            {/* Captura biomecánica */}
                            {ent.addons?.biomech && block.analyzer_required && block.analyzer_code && (
                              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 flex items-center justify-between gap-3 shadow-sm">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <Activity className="h-5 w-5 text-primary animate-pulse" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-primary uppercase tracking-widest">Captura Biomecánica con IA</p>
                                    <p className="text-[10px] text-muted-foreground truncate font-medium">SportMaps Body · {block.analyzer_code.replace(/_/g, ' ')}</p>
                                  </div>
                                </div>
                                <Button size="sm" variant="outline"
                                  className="shrink-0 gap-1.5 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 shadow-sm"
                                  onClick={() => setBiomechBlock({ blockIdx: expandedBlock, block })}
                                >
                                  <Camera className="h-3.5 w-3.5" /> Capturar
                                </Button>
                              </div>
                            )}

                            {/* Timer Inline display */}
                            {isTimerHere && (
                              <div className="animate-in slide-in-from-top duration-300">
                                <RestTimerInline
                                  remaining={restTimer.remaining}
                                  total={restTimer.total}
                                  progress={restTimer.progress}
                                  isPaused={restTimer.isPaused}
                                  onPause={restTimer.pause}
                                  onResume={restTimer.resume}
                                  onSkip={restTimer.skip}
                                  onAdjust={restTimer.adjust}
                                />
                              </div>
                            )}

                            {hasTracking ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 px-1">
                                  {/* Espacio para el número de set */}
                                  <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest w-6 text-center shrink-0">Set</span>
                                  {/* Grid de campos */}
                                  <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${rf.length}, 1fr)` }}>
                                    {rf.includes('reps')   && <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest text-center">Reps</span>}
                                    {rf.includes('weight') && <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest text-center">Peso (kg)</span>}
                                    {rf.includes('rpe')    && <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest text-center">RPE (1-10)</span>}
                                  </div>
                                  {/* Espacio para el botón de completar/temporizador */}
                                  <span className="w-9 shrink-0 text-center text-[10px] uppercase font-black text-muted-foreground tracking-widest">OK</span>
                                </div>
                                <div className="space-y-2">
                                  {sets.map((s, setIdx) => {
                                    const configRow = block.set_config?.[setIdx];
                                    const isDropSet = configRow?.is_drop_set && (s.drops_results?.length ?? 0) > 0;

                                    if (isDropSet) {
                                      const isDropResting = restingSet?.blockIdx === expandedBlock && restingSet?.setIdx === setIdx;
                                      const isDropDone = isSetDone(expandedBlock, setIdx);
                                      return (
                                        <div key={setIdx} className="space-y-2 p-3 rounded-2xl border border-border/20 bg-muted/10 animate-in fade-in duration-250">
                                          <div className="flex items-center justify-between gap-2 border-b border-border/10 pb-1.5">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-black text-primary w-6 text-center">{setIdx + 1}</span>
                                              <span className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">Drop Set</span>
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              type="button"
                                              className={`h-7 w-7 border shrink-0 rounded-lg transition-colors ${
                                                isDropDone
                                                  ? 'border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20'
                                                  : isDropResting
                                                  ? 'border-orange-500/30 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 animate-pulse'
                                                  : 'border-border/60 hover:bg-primary/10 hover:text-primary'
                                              }`}
                                              onClick={() => handleSetDone(expandedBlock, setIdx)}
                                              title="Completar drop set e iniciar descanso"
                                            >
                                              {isDropDone ? (
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                              ) : isDropResting ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                              ) : (
                                                <Timer className="h-3.5 w-3.5" />
                                              )}
                                            </Button>
                                          </div>
                                          {(s.drops_results ?? []).map((drop, dropIdx) => (
                                            <div key={dropIdx} className="flex items-center gap-3 pl-6">
                                              <span className="text-[10px] text-primary/60 font-black shrink-0">↳ {dropIdx + 1}</span>
                                              <div className="flex-1 grid grid-cols-2 gap-3">
                                                {rf.includes('reps') && (
                                                  <NumberStepper value={drop.reps_completed}
                                                    onChange={val => updateDropResult(expandedBlock, setIdx, dropIdx, 'reps_completed', val)}
                                                    min={0} max={999} step={1} />
                                                )}
                                                {rf.includes('weight') && (
                                                  <NumberStepper value={drop.weight_kg}
                                                    onChange={val => updateDropResult(expandedBlock, setIdx, dropIdx, 'weight_kg', val)}
                                                    min={0} max={500} step={1} />
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                          {rf.includes('rpe') && (
                                            <div className="flex items-center gap-3 pl-6 mt-1 border-t border-border/5 pt-1.5">
                                              <span className="text-[10px] text-muted-foreground font-black shrink-0">RPE</span>
                                              <NumberStepper value={s.rpe}
                                                onChange={val => updateSet(expandedBlock, setIdx, 'rpe', val)}
                                                min={1} max={10} step={1} />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }

                                    const isNormalResting = restingSet?.blockIdx === expandedBlock && restingSet?.setIdx === setIdx;
                                    const isNormalDone = isSetDone(expandedBlock, setIdx);
                                    return (
                                      <div key={setIdx} className="flex items-center gap-3 animate-in fade-in duration-200">
                                        <span className="text-sm font-black text-primary w-6 shrink-0 text-center">{setIdx + 1}</span>
                                        <div className="flex-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${rf.length}, 1fr)`, gap: '0.75rem' }}>
                                          {rf.includes('reps') && (
                                            <NumberStepper value={s.reps_completed}
                                              onChange={val => updateSet(expandedBlock, setIdx, 'reps_completed', val)}
                                              min={0} max={999} step={1} />
                                          )}
                                          {rf.includes('weight') && (
                                            <NumberStepper value={s.weight_kg}
                                              onChange={val => updateSet(expandedBlock, setIdx, 'weight_kg', val)}
                                              min={0} max={500} step={1} />
                                          )}
                                          {rf.includes('rpe') && (
                                            <NumberStepper value={s.rpe}
                                              onChange={val => updateSet(expandedBlock, setIdx, 'rpe', val)}
                                              min={1} max={10} step={1} />
                                          )}
                                        </div>

                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          type="button"
                                          className={`h-9 w-9 border shrink-0 rounded-xl transition-colors ${
                                            isNormalDone
                                              ? 'border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20'
                                              : isNormalResting
                                              ? 'border-orange-500/30 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 animate-pulse'
                                              : 'border-border/60 hover:bg-primary/10 hover:text-primary'
                                          }`}
                                          onClick={() => handleSetDone(expandedBlock, setIdx)}
                                          title="Completar serie e iniciar descanso"
                                        >
                                          {isNormalDone ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                          ) : isNormalResting ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Timer className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>

                                {!isDone && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-4 gap-2 border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-700 font-black h-11 shrink-0 rounded-xl transition-all shadow-sm"
                                    onClick={() => handleMarkBlockDone(expandedBlock)}
                                    disabled={isSaving}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    ✓ Listo con este ejercicio
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="p-6 bg-muted/20 rounded-2xl border border-border/30 text-center space-y-4 shadow-sm animate-in fade-in duration-200">
                                <div className="space-y-1">
                                  <p className="text-sm text-foreground font-black uppercase tracking-wider">
                                    {block.duration_minutes
                                      ? `⏱ Duración de Objetivo: ${block.duration_minutes} min`
                                      : 'Realiza la actividad según las instrucciones'}
                                  </p>
                                  {block.rest_seconds && (
                                    <p className="text-xs text-muted-foreground font-medium">Descanso configurado: {block.rest_seconds} segundos</p>
                                  )}
                                </div>
                                {!isDone && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-700 font-black w-full h-11 rounded-xl shadow-sm animate-pulse"
                                    onClick={() => handleMarkBlockDone(expandedBlock)}
                                    disabled={isSaving}
                                  >
                                    <CheckCircle2 className="h-4 w-4" /> Listo con este ejercicio
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>

                  </div>
                );
              })() : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground text-center">
                  <Dumbbell className="h-12 w-12 opacity-20 mb-3 animate-bounce" />
                  <p className="font-bold">Selecciona un ejercicio para comenzar tu entrenamiento.</p>
                </div>
              )}
            </div>

          </div>

          {/* ── Footer con Botones de Navegación Step-by-Step ───────────────── */}
          <DialogFooter className="px-6 py-4 border-t bg-muted/10 flex items-center justify-between shrink-0 gap-3">
            <div>
              <Button variant="ghost" onClick={onClose} disabled={submitting} className="font-bold text-muted-foreground hover:bg-muted rounded-xl">
                Cancelar
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="gap-1 font-bold h-9 rounded-xl border-border/60 hover:bg-muted"
                onClick={handlePrevBlock}
                disabled={expandedBlock <= 0}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="gap-1 font-bold h-9 rounded-xl border-border/60 hover:bg-muted"
                onClick={handleNextBlock}
                disabled={expandedBlock >= blocks.length - 1}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div>
              <Button
                onClick={handleComplete}
                disabled={submitting || completed}
                className="gap-2 min-w-[160px] h-10 font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-xl"
              >
                {completed   ? <><CheckCircle2 className="h-4 w-4" /> ¡Completada!</> :
                 submitting  ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> :
                 '✅ Completar sesión'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal biomecánica */}
      {ent.addons?.biomech && biomechBlock && (
        <BiomechCaptureModal
          open={!!biomechBlock}
          onClose={() => setBiomechBlock(null)}
          onComplete={() => {}}
          analyzerCode={biomechBlock.block.analyzer_code!}
          sessionPlanId={session.id}
          schoolId={session.school_id ?? ''}
          blockIndex={biomechBlock.blockIdx}
        />
      )}
    </>
  );
}
