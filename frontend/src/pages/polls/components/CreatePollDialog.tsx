import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreatePoll } from '@/hooks/usePolls';
import { CreatePollPayload } from '@/lib/api/polls.api';
import { format } from 'date-fns';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useOfferings } from '@/hooks/useOfferings';

interface Props {
  open: boolean;
  onClose: () => void;
}

// We add a temporary field `context_value` to the form, then we map it to team_id or offering_id on submit
interface FormValues extends Omit<CreatePollPayload, 'sessions'> {
  sessions: (CreatePollPayload['sessions'][0] & { context_value?: string })[];
}

const DEFAULT_SESSIONS = [
  { title: '6:00 am',    start_time: '06:00', end_time: '07:00', max_capacity: 20 },
  { title: '7:00 pm BOX', start_time: '19:00', end_time: '20:00', max_capacity: 20 },
  { title: '8:00 pm CROSS', start_time: '20:00', end_time: '21:00', max_capacity: 20 },
];

export function CreatePollDialog({ open, onClose }: Props) {
  const { mutate: createPoll, isPending } = useCreatePoll();
  const { teams } = useSchoolContext();
  const { offerings } = useOfferings();

  const { register, control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      title:      `Encuesta ${format(new Date(), 'EEEE d/M')}`,
      poll_date:  format(new Date(), 'yyyy-MM-dd'),
      sessions:   DEFAULT_SESSIONS,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'sessions' });

  const onSubmit = (data: FormValues) => {
    // Map context_value to either team_id or offering_id
    const payload: CreatePollPayload = {
      title: data.title,
      poll_date: data.poll_date,
      sessions: data.sessions.map((session) => {
        const mappedSession = { ...session };
        if (session.context_value) {
          if (session.context_value.startsWith('team:')) {
            mappedSession.team_id = session.context_value.split(':')[1];
            mappedSession.offering_id = undefined;
          } else if (session.context_value.startsWith('offering:')) {
            mappedSession.offering_id = session.context_value.split(':')[1];
            mappedSession.team_id = undefined;
          }
        }
        delete (mappedSession as any).context_value;
        return mappedSession;
      }),
    };

    createPoll(payload, {
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
          <DialogDescription className="sr-only">
            Configura una nueva encuesta de asistencia para las clases del día.
          </DialogDescription>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nombre</Label>
                      <Input
                        {...register(`sessions.${index}.title`, { required: true })}
                        placeholder="Ej: 6pm CROSS"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Programa o Equipo (Requerido)</Label>
                      <Controller
                        control={control}
                        name={`sessions.${index}.context_value`}
                        rules={{ required: 'Debes seleccionar un programa o equipo' }}
                        render={({ field: selectField, fieldState }) => (
                          <div>
                            <Select onValueChange={selectField.onChange} value={selectField.value || ''}>
                              <SelectTrigger className={`h-8 text-sm ${fieldState.error ? 'border-destructive' : ''}`}>
                                <SelectValue placeholder="Selecciona..." />
                              </SelectTrigger>
                              <SelectContent>
                                {offerings && offerings.length > 0 && (
                                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Programas</div>
                                )}
                                {offerings?.map(o => (
                                  <SelectItem key={o.id} value={`offering:${o.id}`}>
                                    {o.name}
                                  </SelectItem>
                                ))}
                                {teams && teams.length > 0 && (
                                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2 border-t pt-1">Equipos</div>
                                )}
                                {teams?.map(t => (
                                  <SelectItem key={t.id} value={`team:${t.id}`}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {fieldState.error && (
                              <span className="text-[10px] text-destructive mt-1 block">
                                Es obligatorio
                              </span>
                            )}
                          </div>
                        )}
                      />
                    </div>
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
