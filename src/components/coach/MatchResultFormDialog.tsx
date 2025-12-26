import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trophy } from 'lucide-react';

const resultSchema = z.object({
  match_date: z.string().min(1, 'Fecha es requerida'),
  opponent: z.string().min(2, 'Nombre del oponente es requerido'),
  home_score: z.string().min(1, 'Marcador local es requerido'),
  away_score: z.string().min(1, 'Marcador visitante es requerido'),
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
    home_score: number;
    away_score: number;
    is_home: boolean;
    match_type: string;
    notes?: string;
  }) => void;
  teamId: string;
  isLoading?: boolean;
}

const matchTypes = [
  'Liga',
  'Copa',
  'Amistoso',
  'Torneo',
  'Clasificatorio',
  'Final',
];

export function MatchResultFormDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  teamId,
  isLoading 
}: MatchResultFormDialogProps) {
  const form = useForm<ResultFormData>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
      match_date: new Date().toISOString().split('T')[0],
      opponent: '',
      home_score: '0',
      away_score: '0',
      is_home: 'true',
      match_type: '',
      notes: '',
    },
  });

  const handleSubmit = (data: ResultFormData) => {
    onSubmit({
      team_id: teamId,
      match_date: data.match_date,
      opponent: data.opponent,
      home_score: parseInt(data.home_score),
      away_score: parseInt(data.away_score),
      is_home: data.is_home === 'true',
      match_type: data.match_type,
      notes: data.notes || undefined,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Registrar Resultado
          </DialogTitle>
          <DialogDescription>
            Registra el resultado de un partido
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="match_date">Fecha del Partido *</Label>
              <Input
                id="match_date"
                type="date"
                {...form.register('match_date')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="match_type">Tipo de Partido *</Label>
              <Select onValueChange={(value) => form.setValue('match_type', value)}>
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
              defaultValue="true"
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
              <Label htmlFor="home_score">Goles Local *</Label>
              <Input
                id="home_score"
                type="number"
                min="0"
                {...form.register('home_score')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="away_score">Goles Visitante *</Label>
              <Input
                id="away_score"
                type="number"
                min="0"
                {...form.register('away_score')}
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
              {isLoading ? 'Guardando...' : 'Registrar Resultado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
