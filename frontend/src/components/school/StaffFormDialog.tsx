import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, Pencil } from 'lucide-react';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const staffSchema = z.object({
  full_name: z.string().min(2, 'Nombre es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  specialty: z.string().min(1, 'Especialidad es requerida'),
});

type StaffFormData = z.infer<typeof staffSchema>;

interface StaffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { full_name: string; email: string; phone?: string; specialty?: string }) => void;
  isLoading?: boolean;
  initialData?: { full_name: string; email: string; phone?: string; specialty?: string } | null;
}

import { SPORTS_LIST } from '@/lib/constants/sportsCatalog';

const specialties = SPORTS_LIST;

export function StaffFormDialog({ open, onOpenChange, onSubmit, isLoading, initialData }: StaffFormDialogProps) {
  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      full_name: initialData?.full_name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      specialty: initialData?.specialty || '',
    },
  });

  // Update form when initialData changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        full_name: initialData?.full_name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        specialty: initialData?.specialty || '',
      });
    }
  }, [open, initialData, form]);

  const handleSubmit = (data: StaffFormData) => {
    onSubmit({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone || undefined,
      specialty: data.specialty || undefined,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {initialData ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {initialData ? 'Editar Entrenador' : 'Agregar Entrenador'}
          </DialogTitle>
          <DialogDescription>
            {initialData ? 'Actualiza la información del miembro del staff' : 'Registra un nuevo miembro del staff técnico'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre Completo *</Label>
            <Input
              id="full_name"
              placeholder="Ej: Juan Carlos Pérez"
              {...form.register('full_name')}
            />
            {form.formState.errors.full_name && (
              <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico *</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@ejemplo.com"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              placeholder="+57 300 123 4567"
              {...form.register('phone')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialty">Especialidad *</Label>
            <Select 
              onValueChange={(value) => form.setValue('specialty', value)}
              defaultValue={form.getValues('specialty')}
              value={form.watch('specialty')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona especialidad" />
              </SelectTrigger>
              <SelectContent>
                {specialties.map((spec) => (
                  <SelectItem key={spec} value={spec}>
                    {spec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.specialty && (
              <p className="text-sm text-destructive">{form.formState.errors.specialty.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : (initialData ? 'Guardar Cambios' : 'Agregar Entrenador')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
