import { useState, useEffect } from 'react';
import { todayColombia } from '@/lib/dateUtils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardList, Plus, Trash2, Star, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const sessionSchema = z.object({
  session_date: z.string().min(1, 'Fecha es requerida'),
  objectives: z.string().min(3, 'Objetivos son requeridos'),
  warmup: z.string().optional(),
  materials: z.string().optional(),
  notes: z.string().optional(),
  game_principles: z.string().optional(),
});

type SessionFormData = z.infer<typeof sessionSchema>;

interface Drill {
  name: string;
  focus: string;
  duration: string;
}

/** Bloque de sesión de fútbol (Excel "Sesión Diaria", Club Carmel). Editable
 *  por el coach: no son partes fijas, solo se sugieren como punto de partida. */
interface SessionBlock {
  name: string;
  minutes: string;
  activity: string;
  objective: string;
  description: string;
}

const FOOTBALL_BLOCK_TEMPLATE: SessionBlock[] = [
  { name: 'Calentamiento', minutes: '', activity: '', objective: '', description: '' },
  { name: 'Parte 1 — Introductorio', minutes: '', activity: '', objective: '', description: '' },
  { name: 'Parte 2 — Situacional', minutes: '', activity: '', objective: '', description: '' },
  { name: 'Parte 3 — Evaluativo', minutes: '', activity: '', objective: '', description: '' },
  { name: 'Vuelta a la calma', minutes: '', activity: '', objective: '', description: '' },
];

type ObjectivesMet = 'si' | 'parcial' | 'no';

interface Evaluation {
  objectives_met?: ObjectivesMet;
  team_rating?: number;
  highlights?: string;
  improvements?: string;
}

interface SessionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    team_id: string;
    session_date: string;
    objectives: string;
    warmup?: string;
    drills?: Drill[];
    materials?: string;
    notes?: string;
    game_principles?: string;
    session_blocks?: SessionBlock[];
    evaluation?: Evaluation;
  }) => void;
  teamId: string;
  /** Solo fútbol ve bloques editables, principios de juego y evaluación
   *  post-sesión (Excel "Sesión Diaria Fútbol C.C.C", Club Carmel). */
  isFootball?: boolean;
  isLoading?: boolean;
  session?: any;
}

export function SessionFormDialog({
  open,
  onOpenChange,
  onSubmit,
  teamId,
  isFootball,
  isLoading,
  session = null
}: SessionFormDialogProps) {
  const [drills, setDrills] = useState<Drill[]>([{ name: '', focus: '', duration: '' }]);
  const [blocks, setBlocks] = useState<SessionBlock[]>(FOOTBALL_BLOCK_TEMPLATE);
  const [evaluation, setEvaluation] = useState<Evaluation>({});

  const form = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      session_date: todayColombia(),
      objectives: '',
      warmup: '',
      materials: '',
      notes: '',
      game_principles: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (session) {
      form.reset({
        session_date: session.session_date,
        objectives: session.objectives,
        warmup: session.warmup || '',
        materials: session.materials || '',
        notes: session.notes || '',
        game_principles: session.game_principles || '',
      });
      setDrills(session.drills && session.drills.length > 0 ? session.drills : [{ name: '', focus: '', duration: '' }]);
      setBlocks(session.session_blocks && session.session_blocks.length > 0 ? session.session_blocks : FOOTBALL_BLOCK_TEMPLATE);
      setEvaluation(session.evaluation || {});
    } else {
      form.reset({
        session_date: todayColombia(),
        objectives: '',
        warmup: '',
        materials: '',
        notes: '',
        game_principles: '',
      });
      setDrills([{ name: '', focus: '', duration: '' }]);
      setBlocks(FOOTBALL_BLOCK_TEMPLATE);
      setEvaluation({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session]);

  const addDrill = () => setDrills([...drills, { name: '', focus: '', duration: '' }]);
  const removeDrill = (index: number) => setDrills(drills.filter((_, i) => i !== index));
  const updateDrill = (index: number, field: keyof Drill, value: string) => {
    const updated = [...drills];
    updated[index][field] = value;
    setDrills(updated);
  };

  const addBlock = () => setBlocks([...blocks, { name: '', minutes: '', activity: '', objective: '', description: '' }]);
  const removeBlock = (index: number) => setBlocks(blocks.filter((_, i) => i !== index));
  const updateBlock = (index: number, field: keyof SessionBlock, value: string) => {
    const updated = [...blocks];
    updated[index][field] = value;
    setBlocks(updated);
  };

  const resetLocalState = () => {
    setDrills([{ name: '', focus: '', duration: '' }]);
    setBlocks(FOOTBALL_BLOCK_TEMPLATE);
    setEvaluation({});
  };

  const handleSubmit = (data: SessionFormData) => {
    const validDrills = drills.filter(d => d.name.trim() !== '');
    const validBlocks = blocks.filter(b => b.name.trim() !== '');
    const hasEvaluation = Object.values(evaluation).some(v => v !== undefined && v !== '');

    onSubmit({
      team_id: teamId,
      session_date: data.session_date,
      objectives: data.objectives,
      warmup: data.warmup || undefined,
      materials: data.materials || undefined,
      notes: data.notes || undefined,
      ...(isFootball
        ? {
            game_principles: data.game_principles || undefined,
            session_blocks: validBlocks.length > 0 ? validBlocks : undefined,
            evaluation: hasEvaluation ? evaluation : undefined,
          }
        : {
            drills: validDrills.length > 0 ? validDrills : undefined,
          }),
    });
    form.reset();
    resetLocalState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{session ? 'Editar Sesión de Entrenamiento' : 'Crear Sesión de Entrenamiento'}</DialogTitle>
              <DialogDescription>
                {session ? 'Actualiza los detalles de la sesión de entrenamiento.' : 'Crea una sesión de entrenamiento para tu equipo.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha del Entrenamiento *</Label>
              <Controller
                control={form.control}
                name="session_date"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full justify-start text-left font-normal bg-background border-input ${
                          !field.value ? 'text-muted-foreground' : ''
                        }`}
                      >
                        <Calendar className="mr-2 h-4 w-4 opacity-75" />
                        {field.value ? (
                          format(new Date(field.value + 'T12:00:00'), 'PPP', { locale: es })
                        ) : (
                          <span>Selecciona una fecha</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-border/60 shadow-xl" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                        onSelect={(date) => date && field.onChange(format(date, 'yyyy-MM-dd'))}
                        locale={es}
                        captionLayout="dropdown-buttons"
                        fromYear={new Date().getFullYear() - 3}
                        toYear={new Date().getFullYear() + 1}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {form.formState.errors.session_date && (
                <p className="text-sm text-destructive">{form.formState.errors.session_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="materials">Materiales Necesarios</Label>
              <Input
                id="materials"
                placeholder="Ej: Conos, balones, petos"
                {...form.register('materials')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="objectives">Objetivo General de la Sesión *</Label>
            <Textarea
              id="objectives"
              placeholder="¿Qué quieres lograr en esta sesión?"
              {...form.register('objectives')}
              rows={2}
            />
            {form.formState.errors.objectives && (
              <p className="text-sm text-destructive">{form.formState.errors.objectives.message}</p>
            )}
          </div>

          {isFootball && (
            <div className="space-y-2">
              <Label htmlFor="game_principles">Principios de Juego a Trabajar</Label>
              <Textarea
                id="game_principles"
                placeholder="Ej: presión tras pérdida, amplitud en ataque..."
                {...form.register('game_principles')}
                rows={2}
              />
            </div>
          )}

          {!isFootball && (
            <div className="space-y-2">
              <Label htmlFor="warmup">Calentamiento</Label>
              <Textarea
                id="warmup"
                placeholder="Describe el calentamiento inicial..."
                {...form.register('warmup')}
                rows={2}
              />
            </div>
          )}

          {isFootball ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Bloques de la Sesión</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBlock}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Bloque
                </Button>
              </div>

              <div className="space-y-3">
                {blocks.map((block, index) => (
                  <div key={index} className="p-3 border rounded-lg space-y-3 bg-muted/50 dark:bg-muted/30">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        placeholder="Nombre del bloque (ej: Calentamiento)"
                        value={block.name}
                        onChange={(e) => updateBlock(index, 'name', e.target.value)}
                        className="font-medium"
                      />
                      <Input
                        placeholder="Min"
                        value={block.minutes}
                        onChange={(e) => updateBlock(index, 'minutes', e.target.value)}
                        className="w-20 shrink-0"
                      />
                      {blocks.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBlock(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="Actividad / ejercicio"
                      value={block.activity}
                      onChange={(e) => updateBlock(index, 'activity', e.target.value)}
                    />
                    <Input
                      placeholder="Objetivo específico"
                      value={block.objective}
                      onChange={(e) => updateBlock(index, 'objective', e.target.value)}
                    />
                    <Textarea
                      placeholder="Organización / descripción"
                      value={block.description}
                      onChange={(e) => updateBlock(index, 'description', e.target.value)}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Ejercicios</Label>
                <Button type="button" variant="outline" size="sm" onClick={addDrill}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Ejercicio
                </Button>
              </div>

              <div className="space-y-3">
                {drills.map((drill, index) => (
                  <div key={index} className="p-3 border rounded-lg space-y-3 bg-muted/50 dark:bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Ejercicio {index + 1}</span>
                      {drills.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDrill(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input
                        placeholder="Nombre del ejercicio"
                        value={drill.name}
                        onChange={(e) => updateDrill(index, 'name', e.target.value)}
                      />
                      <Input
                        placeholder="Enfoque (ej: Técnica)"
                        value={drill.focus}
                        onChange={(e) => updateDrill(index, 'focus', e.target.value)}
                      />
                      <Input
                        placeholder="Duración (ej: 15 min)"
                        value={drill.duration}
                        onChange={(e) => updateDrill(index, 'duration', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              placeholder="Observaciones, recordatorios..."
              {...form.register('notes')}
              rows={2}
            />
          </div>

          {isFootball && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30 dark:bg-muted/10">
              <div>
                <Label className="text-base">Evaluación de la Sesión</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Opcional — completala cuando puedas, incluso después del entrenamiento.
                </p>
              </div>

              <div className="space-y-2">
                <Label>¿Se cumplieron los objetivos?</Label>
                <Select
                  value={evaluation.objectives_met}
                  onValueChange={(v) => setEvaluation({ ...evaluation, objectives_met: v as ObjectivesMet })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una opción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Sí</SelectItem>
                    <SelectItem value="parcial">Parcialmente</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Desempeño del equipo</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setEvaluation({ ...evaluation, team_rating: n })}
                      className="p-0.5"
                      aria-label={`${n} estrellas`}
                    >
                      <Star
                        className={`h-5 w-5 transition-colors ${
                          (evaluation.team_rating || 0) >= n
                            ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
                            : 'text-muted-foreground/40'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="highlights">Aspectos destacados</Label>
                <Textarea
                  id="highlights"
                  value={evaluation.highlights || ''}
                  onChange={(e) => setEvaluation({ ...evaluation, highlights: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="improvements">Aspectos a mejorar</Label>
                <Textarea
                  id="improvements"
                  value={evaluation.improvements || ''}
                  onChange={(e) => setEvaluation({ ...evaluation, improvements: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : (session ? 'Actualizar Sesión' : 'Crear Sesión')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
