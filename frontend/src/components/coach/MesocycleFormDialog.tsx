import { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar, CalendarRange } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/** Encabezado + objetivo del mesociclo (Excel "MESOCICLO C.C.C.", Club Carmel).
 *  `evaluation_mode` es la decisión D12: el coach elige, por mesociclo, si la
 *  rúbrica final se llena por equipo o por atleta — no es un ajuste global. */
const mesocycleSchema = z.object({
  starts_on: z.string().min(1, 'Fecha de inicio requerida'),
  ends_on: z.string().min(1, 'Fecha de fin requerida'),
  n_sessions_planned: z.string().optional(),
  session_duration_minutes: z.string().optional(),
  general_objective: z.string().optional(),
  game_model: z.string().optional(),
  evaluation_mode: z.enum(['team', 'individual']),
});

export type MesocycleFormData = z.infer<typeof mesocycleSchema>;

export interface MesocycleFormSubmit {
  team_id: string;
  starts_on: string;
  ends_on: string;
  n_sessions_planned?: number;
  session_duration_minutes?: number;
  general_objective?: string;
  game_model?: string;
  evaluation_mode: 'team' | 'individual';
}

interface MesocycleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: MesocycleFormSubmit) => void;
  teamId: string;
  isLoading?: boolean;
  mesocycle?: any;
}

export function MesocycleFormDialog({
  open,
  onOpenChange,
  onSubmit,
  teamId,
  isLoading,
  mesocycle = null,
}: MesocycleFormDialogProps) {
  const form = useForm<MesocycleFormData>({
    resolver: zodResolver(mesocycleSchema),
    defaultValues: {
      starts_on: '',
      ends_on: '',
      n_sessions_planned: '',
      session_duration_minutes: '',
      general_objective: '',
      game_model: '',
      evaluation_mode: 'team',
    },
  });

  useEffect(() => {
    if (open) {
      if (mesocycle) {
        form.reset({
          starts_on: mesocycle.starts_on ?? '',
          ends_on: mesocycle.ends_on ?? '',
          n_sessions_planned: mesocycle.n_sessions_planned != null ? String(mesocycle.n_sessions_planned) : '',
          session_duration_minutes: mesocycle.session_duration_minutes != null ? String(mesocycle.session_duration_minutes) : '',
          general_objective: mesocycle.general_objective ?? '',
          game_model: mesocycle.game_model ?? '',
          evaluation_mode: mesocycle.evaluation_mode ?? 'team',
        });
      } else {
        form.reset({
          starts_on: '',
          ends_on: '',
          n_sessions_planned: '',
          session_duration_minutes: '',
          general_objective: '',
          game_model: '',
          evaluation_mode: 'team',
        });
      }
    }
  }, [open, mesocycle, form]);

  const handleSubmit = (data: MesocycleFormData) => {
    onSubmit({
      team_id: teamId,
      starts_on: data.starts_on,
      ends_on: data.ends_on,
      n_sessions_planned: data.n_sessions_planned ? Number(data.n_sessions_planned) : undefined,
      session_duration_minutes: data.session_duration_minutes ? Number(data.session_duration_minutes) : undefined,
      general_objective: data.general_objective || undefined,
      game_model: data.game_model || undefined,
      evaluation_mode: data.evaluation_mode,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary" />
            {mesocycle ? 'Editar Mesociclo' : 'Crear Mesociclo'}
          </DialogTitle>
          <DialogDescription>
            Planificación mensual del equipo — período, objetivo y modelo de juego.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Inicio</Label>
              <Controller
                control={form.control}
                name="starts_on"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full justify-start text-left font-normal bg-background border-input ${!field.value ? 'text-muted-foreground' : ''}`}
                      >
                        <Calendar className="mr-2 h-4 w-4 opacity-75 shrink-0" />
                        {field.value ? format(new Date(field.value + 'T12:00:00'), 'PPP', { locale: es }) : <span>Selecciona fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-border/60 shadow-xl" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                        onSelect={(date) => date && field.onChange(format(date, 'yyyy-MM-dd'))}
                        locale={es}
                        captionLayout="dropdown-buttons"
                        fromYear={new Date().getFullYear() - 1}
                        toYear={new Date().getFullYear() + 1}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {form.formState.errors.starts_on && (
                <p className="text-xs text-destructive">{form.formState.errors.starts_on.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Fin</Label>
              <Controller
                control={form.control}
                name="ends_on"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full justify-start text-left font-normal bg-background border-input ${!field.value ? 'text-muted-foreground' : ''}`}
                      >
                        <Calendar className="mr-2 h-4 w-4 opacity-75 shrink-0" />
                        {field.value ? format(new Date(field.value + 'T12:00:00'), 'PPP', { locale: es }) : <span>Selecciona fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-border/60 shadow-xl" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                        onSelect={(date) => date && field.onChange(format(date, 'yyyy-MM-dd'))}
                        locale={es}
                        captionLayout="dropdown-buttons"
                        fromYear={new Date().getFullYear() - 1}
                        toYear={new Date().getFullYear() + 1}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {form.formState.errors.ends_on && (
                <p className="text-xs text-destructive">{form.formState.errors.ends_on.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="n_sessions_planned">N.º de sesiones</Label>
              <Input id="n_sessions_planned" type="number" min={0} placeholder="8" {...form.register('n_sessions_planned')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session_duration_minutes">Duración sesión (min)</Label>
              <Input id="session_duration_minutes" type="number" min={0} placeholder="90" {...form.register('session_duration_minutes')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="general_objective">Objetivo general del mesociclo</Label>
            <Textarea id="general_objective" rows={2} {...form.register('general_objective')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="game_model">Modelo / Principios de juego</Label>
            <Textarea id="game_model" rows={2} {...form.register('game_model')} />
          </div>

          <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
            <Label>Rúbrica de evaluación final</Label>
            <p className="text-xs text-muted-foreground">
              Cómo se va a calificar el desarrollo del equipo a lo largo del mesociclo.
            </p>
            <RadioGroup
              value={form.watch('evaluation_mode')}
              onValueChange={(v) => form.setValue('evaluation_mode', v as 'team' | 'individual')}
              className="flex gap-4 pt-1"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="team" id="mode-team" />
                <Label htmlFor="mode-team" className="font-normal cursor-pointer">Por equipo</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="individual" id="mode-individual" />
                <Label htmlFor="mode-individual" className="font-normal cursor-pointer">Por atleta</Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : mesocycle ? 'Guardar cambios' : 'Crear Mesociclo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
