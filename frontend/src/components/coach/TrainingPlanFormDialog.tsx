import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';

const planSchema = z.object({
  plan_date: z.string().min(1, 'Fecha es requerida'),
  objectives: z.string().min(3, 'Objetivos son requeridos'),
  warmup: z.string().optional(),
  materials: z.string().optional(),
  notes: z.string().optional(),
});

type PlanFormData = z.infer<typeof planSchema>;

interface Drill {
  name: string;
  focus: string;
  duration: string;
}

interface TrainingPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    team_id: string;
    plan_date: string;
    objectives: string;
    warmup?: string;
    drills?: Drill[];
    materials?: string;
    notes?: string;
  }) => void;
  teamId: string;
  isLoading?: boolean;
}

export function TrainingPlanFormDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  teamId,
  isLoading 
}: TrainingPlanFormDialogProps) {
  const [drills, setDrills] = useState<Drill[]>([{ name: '', focus: '', duration: '' }]);

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      plan_date: new Date().toISOString().split('T')[0],
      objectives: '',
      warmup: '',
      materials: '',
      notes: '',
    },
  });

  const addDrill = () => {
    setDrills([...drills, { name: '', focus: '', duration: '' }]);
  };

  const removeDrill = (index: number) => {
    setDrills(drills.filter((_, i) => i !== index));
  };

  const updateDrill = (index: number, field: keyof Drill, value: string) => {
    const updated = [...drills];
    updated[index][field] = value;
    setDrills(updated);
  };

  const handleSubmit = (data: PlanFormData) => {
    const validDrills = drills.filter(d => d.name.trim() !== '');
    onSubmit({
      team_id: teamId,
      plan_date: data.plan_date,
      objectives: data.objectives,
      warmup: data.warmup || undefined,
      drills: validDrills.length > 0 ? validDrills : undefined,
      materials: data.materials || undefined,
      notes: data.notes || undefined,
    });
    form.reset();
    setDrills([{ name: '', focus: '', duration: '' }]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Crear Plan de Entrenamiento
          </DialogTitle>
          <DialogDescription>
            Planifica tu próxima sesión de entrenamiento
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan_date">Fecha del Entrenamiento *</Label>
              <Input
                id="plan_date"
                type="date"
                {...form.register('plan_date')}
              />
              {form.formState.errors.plan_date && (
                <p className="text-sm text-destructive">{form.formState.errors.plan_date.message}</p>
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
            <Label htmlFor="objectives">Objetivos de la Sesión *</Label>
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

          <div className="space-y-2">
            <Label htmlFor="warmup">Calentamiento</Label>
            <Textarea
              id="warmup"
              placeholder="Describe el calentamiento inicial..."
              {...form.register('warmup')}
              rows={2}
            />
          </div>

          {/* Drills Section */}
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
                <div key={index} className="p-3 border rounded-lg space-y-3 bg-accent/30">
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

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              placeholder="Observaciones, recordatorios..."
              {...form.register('notes')}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Crear Plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
