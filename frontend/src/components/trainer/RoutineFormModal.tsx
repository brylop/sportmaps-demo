import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateExerciseCalories } from '@/lib/trainer/calorieUtils';
import { Switch } from '@/components/ui/switch';
import { BlockBuilder, ExerciseBlock } from './BlockBuilder';
import { Loader2, ChevronRight, ChevronLeft, Save, Dumbbell, Info, Flame, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useEntitlements } from '@/hooks/useEntitlements';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

interface RoutineFormModalProps {
  open: boolean;
  onClose: () => void;
  routine?: any;
  onSave: (data: any) => Promise<void>;
  isLoading?: boolean;
}

const CATEGORIES = ['Fuerza', 'Cardio', 'Funcional', 'HIIT', 'Flexibilidad', 'Yoga', 'Otro'];
const DIFFICULTIES = ['Principiante', 'Intermedio', 'Avanzado', 'Elite'];

const BIOMECH_ANALYZERS = [
  { code: 'hack_squat',    label: 'Sentadilla Hack'  },
  { code: 'incline_press', label: 'Press Inclinado'  },
  { code: 'row',           label: 'Remo'             },
] as const;

// Mapeo local para detección inmediata sin latencia
// Se sincroniza con exercise_analyzer_mappings en la DB
const KNOWN_WGER_IDS: Record<number, string> = {
  1414: 'hack_squat',
  // Agregar más a medida que se descubran en producción
};

const NAME_PATTERNS: Array<{ pattern: string; code: string }> = [
  // hack_squat
  { pattern: 'hack squat',         code: 'hack_squat'    },
  { pattern: 'hack squats',        code: 'hack_squat'    },
  { pattern: 'sentadilla hack',    code: 'hack_squat'    },
  // incline_press
  { pattern: 'incline press',      code: 'incline_press' },
  { pattern: 'incline bench',      code: 'incline_press' },
  { pattern: 'press inclinado',    code: 'incline_press' },
  // row
  { pattern: 'bent over row',      code: 'row'           },
  { pattern: 'barbell row',        code: 'row'           },
  { pattern: 'dumbbell row',       code: 'row'           },
  { pattern: 'cable row',          code: 'row'           },
  { pattern: 'seated row',         code: 'row'           },
  { pattern: 'remo con',           code: 'row'           },
  { pattern: 'remo en',            code: 'row'           },
];

function detectAnalyzerCode(block: any): string | null {
  // 1. Por wger_id exacto
  if (block.wger_id && KNOWN_WGER_IDS[block.wger_id]) {
    return KNOWN_WGER_IDS[block.wger_id];
  }
  // 2. Por nombre (wger_name_en o name) en lowercase
  const haystack = [
    block.wger_name_en ?? '',
    block.name ?? '',
  ].join(' ').toLowerCase();

  for (const { pattern, code } of NAME_PATTERNS) {
    if (haystack.includes(pattern)) return code;
  }
  return null;
}

export function RoutineFormModal({ open, onClose, routine, onSave, isLoading }: RoutineFormModalProps) {
  const ent = useEntitlements();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({
    name: '',
    category: 'Fuerza',
    difficulty: 'Intermedio',
    description: '',
    warmup: '',
    blocks: [],
    cooldown: '',
    estimated_minutes: 60,
    estimated_calories: 0,
    tags: [],
    is_template: true,
  });

  const [tagInput, setTagInput] = useState('');
  const { markDirty, markClean } = useUnsavedChanges('routine-form-modal');

  useEffect(() => {
    if (routine) {
      // Normalizar category/difficulty: la BD guarda lowercase ('fuerza','hiit')
      // pero el <Select> usa valores con capitalización exacta ('Fuerza','HIIT').
      // Buscamos case-insensitive para garantizar coincidencia.
      const matchedCategory   = CATEGORIES.find(
        c => c.toLowerCase() === (routine.category  || '').toLowerCase()
      ) ?? 'Fuerza';
      const matchedDifficulty = DIFFICULTIES.find(
        d => d.toLowerCase() === (routine.difficulty || '').toLowerCase()
      ) ?? 'Intermedio';

      // Calcular calorías de bloques si no las tienen guardadas
      const initialBlocks = (routine.blocks || []).map((b: any) => ({
        ...b,
        calories: b.calories || calculateExerciseCalories({
          type: b.type,
          sets: b.sets || 0,
          reps: b.reps || 0,
          duration_minutes: b.duration_minutes || 0,
          difficulty: matchedDifficulty,
        }),
      }));

      const initialTotalCals =
        routine.estimated_calories ||
        initialBlocks.reduce((sum: number, b: any) => sum + (b.calories || 0), 0);

      setFormData({
        ...routine,
        // Campos normalizados — deben ir DESPUÉS del spread para sobrescribir
        name:               routine.name               ?? '',
        description:        routine.description        ?? '',
        warmup:             routine.warmup             ?? '',
        cooldown:           routine.cooldown           ?? '',
        estimated_minutes:  routine.estimated_minutes  ?? 60,
        is_template:        routine.is_template        ?? true,
        category:           matchedCategory,
        difficulty:         matchedDifficulty,
        blocks:             initialBlocks,
        estimated_calories: initialTotalCals,
        tags:               routine.tags               ?? [],
      });
    } else {
      setFormData({
        name: '',
        category: 'Fuerza',
        difficulty: 'Intermedio',
        description: '',
        warmup: '',
        blocks: [],
        cooldown: '',
        estimated_minutes: 60,
        estimated_calories: 0,
        tags: [],
        is_template: true,
      });
    }
    setStep(1);
    if (open) {
      markDirty();
    } else {
      markClean();
    }
  }, [routine, open]);


  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    if (!formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t: string) => t !== tag) });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    await onSave(formData);
    markClean();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) markClean(); onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-primary/20 shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {routine ? 'Editar Rutina' : 'Nueva Rutina'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === 1 ? 'Paso 1: Información General' : 'Paso 2: Diseño de Ejercicios'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6">
            {step === 1 ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider">Nombre de la Rutina *</Label>
                    <Input 
                      id="name" 
                      placeholder="Ej: Full Body Hipertrofia" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider">Categoría</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(val) => setFormData({ ...formData, category: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="minutes" className="text-xs font-bold uppercase tracking-wider">Tiempo Estimado (min)</Label>
                    <NumberStepper 
                      value={formData.estimated_minutes}
                      onChange={(val) => setFormData({ ...formData, estimated_minutes: val === '' ? 0 : val })}
                      min={1}
                      max={480}
                      step={5}
                      unit="min"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider">Dificultad</Label>
                    <Select 
                      value={formData.difficulty} 
                      onValueChange={(val) => setFormData({ ...formData, difficulty: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona dificultad" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc" className="text-xs font-bold uppercase tracking-wider">Descripción / Objetivo</Label>
                  <Textarea 
                    id="desc" 
                    placeholder="Describe el propósito de esta rutina..." 
                    className="min-h-[100px] resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-3 p-4 bg-muted/20 rounded-xl border border-border/40">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-bold uppercase tracking-wider">Etiquetas / Tags</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[220px] bg-popover text-popover-foreground border shadow-md p-3">
                          <p className="text-[11px] leading-relaxed">
                            Usa etiquetas para categorizar tus rutinas. Te permitirán filtrar y encontrar entrenamientos específicos rápidamente (ej: #Explosividad, #Recuperación, #FuerzaMáxima).
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Presiona Enter para agregar" 
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                      className="bg-background"
                    />
                    <Button type="button" variant="secondary" onClick={handleAddTag}>Agregar</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.tags.map((tag: string) => (
                      <Badge key={tag} className="gap-1 bg-background text-foreground hover:bg-background border">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-destructive">×</button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Guardar como plantilla</Label>
                    <p className="text-xs text-muted-foreground">Estará disponible en tu biblioteca para usar con otros clientes.</p>
                  </div>
                  <Switch 
                    checked={formData.is_template} 
                    onCheckedChange={(val) => setFormData({ ...formData, is_template: val })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-full h-6 w-6 p-0 flex items-center justify-center font-bold">1</Badge>
                    <Label className="text-sm font-bold uppercase tracking-wider">Calentamiento Opcional</Label>
                  </div>
                  <Textarea 
                    placeholder="Instrucciones para la movilidad articular y entrada en calor..." 
                    className="min-h-[80px] resize-none"
                    value={formData.warmup}
                    onChange={(e) => setFormData({ ...formData, warmup: e.target.value })}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-full h-6 w-6 p-0 flex items-center justify-center font-bold">2</Badge>
                    <Label className="text-sm font-bold uppercase tracking-wider text-primary">Bloques de Ejercicios</Label>
                  </div>
                  <BlockBuilder 
                    blocks={formData.blocks} 
                    difficulty={formData.difficulty}
                    onChange={(blocks) => {
                      const totalCals = blocks.reduce((sum: number, b: any) => sum + (b.calories || 0), 0);

                      // Auto-detectar analyzer para bloques nuevos (sin analyzer_required todavía)
                      const enrichedBlocks = blocks.map((b: any) => {
                        // Si ya tiene configuración biomecánica, no sobreescribir
                        if (b.analyzer_required !== undefined) return b;

                        // Si no tiene el addon habilitado, no auto-detectar
                        if (!ent.addons?.biomech) {
                          return {
                            ...b,
                            analyzer_required: false,
                          };
                        }

                        const detected = detectAnalyzerCode(b);
                        if (!detected) return b;

                        // Auto-activar con el analyzer detectado
                        return {
                          ...b,
                          analyzer_required: true,
                          analyzer_code:     detected,
                        };
                      });

                      setFormData({
                        ...formData,
                        blocks:             enrichedBlocks,
                        estimated_calories: totalCals > 0 ? totalCals : formData.estimated_calories,
                      });
                    }}
                  />
                </div>

                {/* ── Configuración Biomecánica por Bloque ──────────────────────── */}
                {ent.addons?.biomech && formData.blocks.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className="rounded-full h-6 w-6 p-0 flex items-center justify-center font-bold text-primary border-primary/40"
                      >
                        <Activity className="h-3 w-3" />
                      </Badge>
                      <Label className="text-sm font-bold uppercase tracking-wider text-primary">
                        Captura Biomecánica
                      </Label>
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary/70 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                        SportMaps Body
                      </span>
                    </div>

                    <div className="space-y-2">
                      {formData.blocks.map((block: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border transition-colors ${
                            block.analyzer_required
                              ? 'bg-primary/5 border-primary/20'
                              : 'bg-muted/20 border-border/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            {/* Nombre del bloque */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="h-6 w-6 rounded-md bg-muted/50 border border-border/40 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-black text-muted-foreground">{idx + 1}</span>
                              </div>
                              <p className="text-sm font-bold truncate">
                                {block.name || `Ejercicio ${idx + 1}`}
                              </p>
                            </div>

                            {/* Toggle */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-muted-foreground font-medium hidden sm:block">
                                {block.analyzer_required ? 'Captura activa' : 'Sin captura'}
                              </span>
                              <Switch
                                checked={!!block.analyzer_required}
                                onCheckedChange={(val) => {
                                  const updatedBlocks = formData.blocks.map((b: any, i: number) =>
                                    i === idx
                                      ? {
                                          ...b,
                                          analyzer_required: val,
                                          // Limpiar analyzer_code si se desactiva
                                          analyzer_code: val ? (b.analyzer_code ?? 'hack_squat') : undefined,
                                        }
                                      : b
                                  );
                                  setFormData({ ...formData, blocks: updatedBlocks });
                                }}
                              />
                            </div>
                          </div>

                          {/* Selector de analyzer — solo si el toggle está activo */}
                          {block.analyzer_required && (
                            <div className="mt-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0 whitespace-nowrap">
                                Tipo de análisis
                              </Label>
                              <Select
                                value={block.analyzer_code ?? 'hack_squat'}
                                onValueChange={(val) => {
                                  const updatedBlocks = formData.blocks.map((b: any, i: number) =>
                                    i === idx ? { ...b, analyzer_code: val } : b
                                  );
                                  setFormData({ ...formData, blocks: updatedBlocks });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-background border-primary/20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {BIOMECH_ANALYZERS.map(a => (
                                    <SelectItem key={a.code} value={a.code} className="text-xs">
                                      {a.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
                      Los bloques con captura activa mostrarán un botón de cámara al atleta durante la ejecución.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-full h-6 w-6 p-0 flex items-center justify-center font-bold">3</Badge>
                    <Label className="text-sm font-bold uppercase tracking-wider">Vuelta a la Calma Opcional</Label>
                  </div>
                  <Textarea 
                    placeholder="Estiramientos, meditación o soltura final..." 
                    className="min-h-[80px] resize-none"
                    value={formData.cooldown}
                    onChange={(e) => setFormData({ ...formData, cooldown: e.target.value })}
                  />
                </div>

                <div className="p-6 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-2xl border border-orange-500/20 space-y-4 shadow-sm">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="p-3 bg-orange-500/20 rounded-xl">
                         <Flame className="h-6 w-6 text-orange-600 animate-pulse" />
                       </div>
                       <div>
                         <h4 className="text-sm font-black uppercase tracking-widest text-orange-700">Resumen de Quema Calórica</h4>
                         <p className="text-[10px] font-bold text-orange-600/70">Calculado en base a los bloques superiores</p>
                       </div>
                     </div>
                   </div>

                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-orange-800 ml-1">Total Estimado de la Rutina</Label>
                     <NumberStepper 
                       value={formData.estimated_calories}
                       onChange={(val) => setFormData({ ...formData, estimated_calories: val === '' ? 0 : val })}
                       min={0}
                       max={5000}
                       step={10}
                       unit="KCAL"
                       className="bg-white/50 border-orange-500/20 focus-within:border-orange-500/50"
                     />
                   </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/20 shrink-0">
          <div className="flex justify-between w-full">
            <Button variant="ghost" onClick={() => { markClean(); onClose(); }} disabled={isLoading} className="font-bold">Cancelar</Button>
            
            <div className="flex gap-2">
              {step === 1 ? (
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!formData.name.trim()}
                  className="gap-2"
                >
                  Continuar al Diseño
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    Volver a Info
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={isLoading || formData.blocks.length === 0}
                    className="gap-2 bg-primary hover:bg-primary/90"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {routine ? 'Guardar Cambios' : 'Crear Rutina Total'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
