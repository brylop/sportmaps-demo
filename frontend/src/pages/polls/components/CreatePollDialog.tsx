import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useCreatePoll } from '@/hooks/usePolls';
import { CreatePollPayload } from '@/lib/api/polls.api';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_SESSIONS = [
  { title: '6:00 am',    start_time: '06:00', end_time: '07:00', max_capacity: 20 },
  { title: '7:00 pm BOX', start_time: '19:00', end_time: '20:00', max_capacity: 20 },
  { title: '8:00 pm CROSS', start_time: '20:00', end_time: '21:00', max_capacity: 20 },
];

export function CreatePollDialog({ open, onClose }: Props) {
  const { mutate: createPoll, isPending } = useCreatePoll();

  const { register, control, handleSubmit, reset, formState: { errors } } =
    useForm<CreatePollPayload>({
      defaultValues: {
        title:      `Encuesta ${format(new Date(), 'EEEE d/M')}`,
        poll_date:  format(new Date(), 'yyyy-MM-dd'),
        sessions:   DEFAULT_SESSIONS,
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: 'sessions' });

  const onSubmit = (data: CreatePollPayload) => {
    createPoll(data, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo poll de asistencia</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              {...register('title', { required: true })}
              placeholder="Ej: Martes 24 marzo"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input
              type="date"
              {...register('poll_date', { required: true })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Clases del día</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ title: '', start_time: '', end_time: '', max_capacity: 20 })}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Agregar
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="border rounded-lg p-3 space-y-3 bg-secondary/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Clase {index + 1}
                    </span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      {...register(`sessions.${index}.title`, { required: true })}
                      placeholder="Ej: 6pm CROSS"
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Inicio</Label>
                      <Input
                        type="time"
                        {...register(`sessions.${index}.start_time`, { required: true })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fin</Label>
                      <Input
                        type="time"
                        {...register(`sessions.${index}.end_time`, { required: true })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cupo</Label>
                      <Input
                        type="number"
                        min={1}
                        {...register(`sessions.${index}.max_capacity`, { valueAsNumber: true })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creando...' : 'Crear poll'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
