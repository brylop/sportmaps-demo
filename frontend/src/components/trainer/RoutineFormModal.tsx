import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { BlockBuilder, ExerciseBlock } from './BlockBuilder';
import { Loader2, ChevronRight, ChevronLeft, Save, Dumbbell, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RoutineFormModalProps {
  open: boolean;
  onClose: () => void;
  routine?: any;
  onSave: (data: any) => Promise<void>;
  isLoading?: boolean;
}

const CATEGORIES = ['Fuerza', 'Cardio', 'Funcional', 'HIIT', 'Flexibilidad', 'Yoga', 'Otro'];
const DIFFICULTIES = ['Principiante', 'Intermedio', 'Avanzado', 'Elite'];

export function RoutineFormModal({ open, onClose, routine, onSave, isLoading }: RoutineFormModalProps) {
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
    tags: [],
    is_template: true,
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (routine) {
      setFormData({
        ...routine,
        tags: routine.tags || [],
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
        tags: [],
        is_template: true,
      });
    }
    setStep(1);
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
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
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
                  <div className="space-y-2">
                    <Label htmlFor="minutes" className="text-xs font-bold uppercase tracking-wider">Tiempo Estimado (min)</Label>
                    <NumberStepper 
                      value={formData.estimated_minutes}
                      onChange={(val) => setFormData({ ...formData, estimated_minutes: val === '' ? 0 : val })}
                      min={1}
                      max={480}
                      step={5}
                    />
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
                    onChange={(blocks) => setFormData({ ...formData, blocks })}
                  />
                </div>

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
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/20 shrink-0">
          <div className="flex justify-between w-full">
            <Button variant="ghost" onClick={onClose} disabled={isLoading} className="font-bold">Cancelar</Button>
            
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
