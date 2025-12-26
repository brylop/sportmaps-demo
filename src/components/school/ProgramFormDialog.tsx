import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Trophy, CheckCircle2 } from 'lucide-react';

interface ProgramFormData {
  name: string;
  sport: string;
  description?: string;
  schedule: string;
  price_monthly: number;
  age_min?: number;
  age_max?: number;
  max_participants?: number;
}

interface ProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  onSuccess?: () => void;
  program?: {
    id: string;
    name: string;
    sport: string;
    description?: string | null;
    schedule?: string | null;
    price_monthly: number;
    age_min?: number | null;
    age_max?: number | null;
    max_participants?: number | null;
  };
}

const sports = [
  'Fútbol',
  'Baloncesto',
  'Voleibol',
  'Tenis',
  'Natación',
  'Gimnasia',
  'Artes Marciales',
  'Atletismo',
  'Béisbol',
  'Otro',
];

export function ProgramFormDialog({
  open,
  onOpenChange,
  schoolId,
  onSuccess,
  program,
}: ProgramFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm<ProgramFormData>({
    defaultValues: {
      name: program?.name || '',
      sport: program?.sport || '',
      description: program?.description || '',
      schedule: program?.schedule || '',
      price_monthly: program?.price_monthly || 0,
      age_min: program?.age_min || undefined,
      age_max: program?.age_max || undefined,
      max_participants: program?.max_participants || undefined,
    },
  });

  const onSubmit = async (data: ProgramFormData) => {
    if (!user || !schoolId) return;

    setLoading(true);
    try {
      if (program?.id) {
        // Update existing program
        const { error } = await supabase
          .from('programs')
          .update({
            name: data.name,
            sport: data.sport,
            description: data.description || null,
            schedule: data.schedule,
            price_monthly: data.price_monthly,
            age_min: data.age_min || null,
            age_max: data.age_max || null,
            max_participants: data.max_participants || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', program.id);

        if (error) throw error;
      } else {
        // Create new program
        const { error } = await supabase.from('programs').insert({
          school_id: schoolId,
          name: data.name,
          sport: data.sport,
          description: data.description || null,
          schedule: data.schedule,
          price_monthly: data.price_monthly,
          age_min: data.age_min || null,
          age_max: data.age_max || null,
          max_participants: data.max_participants || null,
          current_participants: 0,
          active: true,
        });

        if (error) throw error;
      }

      setSuccess(true);
      toast({
        title: program?.id ? '¡Programa actualizado!' : '¡Programa creado!',
        description: program?.id
          ? 'El programa ha sido actualizado correctamente'
          : 'El nuevo programa ya está disponible para inscripciones',
      });

      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
        form.reset();
        onSuccess?.();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving program:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar el programa',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setSuccess(false);
    form.reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) resetDialog();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {success ? (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-poppins">
                {program?.id ? '¡Programa Actualizado!' : '¡Programa Creado!'}
              </h3>
              <p className="text-muted-foreground">
                {program?.id
                  ? 'Los cambios han sido guardados'
                  : 'Tu nuevo programa está listo para recibir inscripciones'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-poppins">
                <Trophy className="w-5 h-5 text-primary" />
                {program?.id ? 'Editar Programa' : 'Nuevo Programa'}
              </DialogTitle>
              <DialogDescription>
                {program?.id
                  ? 'Actualiza la información del programa'
                  : 'Crea un nuevo programa deportivo para tu escuela'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del programa</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Fútbol Sub-12" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sport"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deporte</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un deporte" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sports.map((sport) => (
                            <SelectItem key={sport} value={sport}>
                              {sport}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe el programa..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="schedule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horario</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Lunes y Miércoles 4:00 PM - 6:00 PM" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price_monthly"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio mensual (COP)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="150000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="age_min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Edad mínima</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="6" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="age_max"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Edad máxima</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="12" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="max_participants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cupos máximos (opcional)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="20" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1 font-poppins" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : program?.id ? (
                      'Actualizar Programa'
                    ) : (
                      'Crear Programa'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
