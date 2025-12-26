import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2 } from 'lucide-react';

const facilitySchema = z.object({
  name: z.string().min(2, 'Nombre es requerido'),
  type: z.string().min(1, 'Tipo es requerido'),
  capacity: z.string().min(1, 'Capacidad es requerida'),
  description: z.string().optional(),
});

type FacilityFormData = z.infer<typeof facilitySchema>;

interface FacilityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; type: string; capacity: number; description?: string }) => void;
  isLoading?: boolean;
}

const facilityTypes = [
  'Cancha de Fútbol',
  'Cancha de Baloncesto',
  'Cancha de Tenis',
  'Cancha de Voleibol',
  'Piscina',
  'Gimnasio',
  'Pista de Atletismo',
  'Sala de Artes Marciales',
  'Cancha Sintética',
  'Otro',
];

export function FacilityFormDialog({ open, onOpenChange, onSubmit, isLoading }: FacilityFormDialogProps) {
  const form = useForm<FacilityFormData>({
    resolver: zodResolver(facilitySchema),
    defaultValues: {
      name: '',
      type: '',
      capacity: '',
      description: '',
    },
  });

  const handleSubmit = (data: FacilityFormData) => {
    onSubmit({
      name: data.name,
      type: data.type,
      capacity: parseInt(data.capacity),
      description: data.description || undefined,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Agregar Instalación
          </DialogTitle>
          <DialogDescription>
            Registra un nuevo espacio deportivo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Instalación *</Label>
            <Input
              id="name"
              placeholder="Ej: Cancha Principal, Gimnasio A"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Instalación *</Label>
            <Select onValueChange={(value) => form.setValue('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                {facilityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.type && (
              <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacidad *</Label>
            <Input
              id="capacity"
              type="number"
              placeholder="Número de personas"
              {...form.register('capacity')}
            />
            {form.formState.errors.capacity && (
              <p className="text-sm text-destructive">{form.formState.errors.capacity.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Número máximo de personas
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Descripción y reglas de uso..."
              {...form.register('description')}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Crear Instalación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
