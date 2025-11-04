import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { toast } from 'sonner';

const childSchema = z.object({
  full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  date_of_birth: z.string().min(1, 'La fecha de nacimiento es requerida'),
  sport: z.string().optional(),
  team_name: z.string().optional(),
});

type ChildFormValues = z.infer<typeof childSchema>;

interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddChildDialog({ open, onOpenChange, onSuccess }: AddChildDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ChildFormValues>({
    resolver: zodResolver(childSchema),
    defaultValues: {
      full_name: '',
      date_of_birth: '',
      sport: '',
      team_name: '',
    },
  });

  const onSubmit = async (values: ChildFormValues) => {
    if (!user?.id) {
      toast.error('Debes iniciar sesión para añadir un hijo');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('children').insert({
        parent_id: user.id,
        full_name: values.full_name,
        date_of_birth: values.date_of_birth,
        sport: values.sport || null,
        team_name: values.team_name || null,
        is_demo: false, // Explicitly set to false for non-demo users
      });

      if (error) throw error;

      // Invalidate and refetch children queries
      await queryClient.invalidateQueries({ queryKey: ['children', user.id] });
      
      toast.success('Hijo añadido exitosamente');
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding child:', error);
      toast.error('Error al añadir el hijo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Añadir Hijo</DialogTitle>
          <DialogDescription>
            Completa la información de tu hijo para gestionar sus actividades deportivas
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Juan Pérez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date_of_birth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Nacimiento *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                  <FormControl>
                    <Input placeholder="Ej: Fútbol" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="team_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Fútbol Sub-12" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Añadir Hijo'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
