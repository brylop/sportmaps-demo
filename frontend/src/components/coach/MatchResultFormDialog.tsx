import { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { todayColombia } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trophy, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { NumberStepper } from '../ui/number-stepper';

const resultSchema = z.object({
  match_date: z.string().min(1, 'Fecha es requerida'),
  opponent: z.string().min(2, 'Nombre del oponente es requerido'),
  // Vacíos = partido sin marcador todavía (programado, aún sin jugar) --
  // mismo criterio que "Programar Partido" en FootballDashboardModal, que ya
  // guarda null cuando se deja en blanco. Antes eran obligatorios acá, y
  // editar un partido programado (sin marcador) desde Panorama de fútbol
  // mostraba literalmente el texto "null" en el stepper.
  home_score: z.string().optional(),
  away_score: z.string().optional(),
  is_home: z.string(),
  match_type: z.string().min(1, 'Tipo de partido es requerido'),
  notes: z.string().optional(),
});

type ResultFormData = z.infer<typeof resultSchema>;

interface MatchResultFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    team_id: string;
    match_date: string;
    opponent: string;
    home_score: number | null;
    away_score: number | null;
    is_home: boolean;
    match_type: string;
    notes?: string;
  }) => void;
  teamId: string;
  isLoading?: boolean;
  /** Presente = editar ese resultado ya guardado; ausente/null = registrar uno nuevo. */
  match?: {
    match_date: string;
    opponent: string;
    home_score: number | null;
    away_score: number | null;
    is_home: boolean;
    match_type: string;
    notes?: string | null;
  } | null;
}

const matchTypes = [
  'Liga',
  'Copa',
  'Amistoso',
  'Torneo',
  'Clasificatorio',
  'Final',
];

const emptyDefaults: ResultFormData = {
  match_date: todayColombia(),
  opponent: '',
  home_score: '',
  away_score: '',
  is_home: 'true',
  match_type: '',
  notes: '',
};

export function MatchResultFormDialog({
  open,
  onOpenChange,
  onSubmit,
  teamId,
  isLoading,
  match = null,
}: MatchResultFormDialogProps) {
  const form = useForm<ResultFormData>({
    resolver: zodResolver(resultSchema),
    defaultValues: emptyDefaults,
  });

  // Mismo patrón que SessionFormDialog: re-hidrata al abrir, según si hay un
  // resultado existente (editar) o no (registrar uno nuevo) -- sin esto el
  // formulario quedaría con los valores de la última vez que se abrió.
  useEffect(() => {
    if (!open) return;
    form.reset(
      match
        ? {
            match_date: match.match_date,
            opponent: match.opponent,
            home_score: match.home_score == null ? '' : String(match.home_score),
            away_score: match.away_score == null ? '' : String(match.away_score),
            is_home: String(match.is_home),
            match_type: match.match_type,
            notes: match.notes || '',
          }
        : emptyDefaults,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, match]);

  const handleSubmit = (data: ResultFormData) => {
    onSubmit({
      team_id: teamId,
      match_date: data.match_date,
      opponent: data.opponent,
      home_score: data.home_score ? parseInt(data.home_score) : null,
      away_score: data.away_score ? parseInt(data.away_score) : null,
      is_home: data.is_home === 'true',
      match_type: data.match_type,
      notes: data.notes || undefined,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{match ? 'Editar Resultado' : 'Registrar Resultado'}</DialogTitle>
              <DialogDescription>
                {match ? 'Corrige el resultado de este partido.' : 'Registra el resultado del partido.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="match_date">Fecha del Partido *</Label>
              <Controller
                control={form.control}
                name="match_date"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full min-w-0 justify-start text-left font-normal bg-background border-input ${
                          !field.value ? 'text-muted-foreground' : ''
                        }`}
                      >
                        <Calendar className="mr-2 h-4 w-4 opacity-75 shrink-0" />
                        {/* Formato corto ('PPP' completo -- "6 de septiembre de 2026" --
                            se salía del botón al compartir la fila con "Tipo de Partido").
                            truncate + min-w-0 en el span: el botón es un flex row, sin
                            min-w-0 en el hijo el texto empuja el ancho en vez de cortarse. */}
                        <span className="truncate min-w-0">
                          {field.value ? (
                            format(new Date(field.value + 'T12:00:00'), 'd MMM yyyy', { locale: es })
                          ) : (
                            'Selecciona una fecha'
                          )}
                        </span>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="match_type">Tipo de Partido *</Label>
              <Select value={form.watch('match_type')} onValueChange={(value) => form.setValue('match_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {matchTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="opponent">Nombre del Oponente *</Label>
            <Input
              id="opponent"
              placeholder="Ej: Tigres FC"
              {...form.register('opponent')}
            />
            {form.formState.errors.opponent && (
              <p className="text-sm text-destructive">{form.formState.errors.opponent.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Condición</Label>
            <RadioGroup
              value={form.watch('is_home')}
              onValueChange={(value) => form.setValue('is_home', value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="home" />
                <Label htmlFor="home" className="font-normal">Local</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="away" />
                <Label htmlFor="away" className="font-normal">Visitante</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="home_score">Goles Local</Label>
              <NumberStepper
                value={form.watch('home_score') === '' ? '' : parseInt(form.watch('home_score'))}
                onChange={(val) => form.setValue('home_score', String(val))}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="away_score">Goles Visitante</Label>
              <NumberStepper
                value={form.watch('away_score') === '' ? '' : parseInt(form.watch('away_score'))}
                onChange={(val) => form.setValue('away_score', String(val))}
                min={0}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas del Partido</Label>
            <Textarea
              id="notes"
              placeholder="Observaciones, destacados..."
              {...form.register('notes')}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : match ? 'Guardar Cambios' : 'Registrar Resultado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
