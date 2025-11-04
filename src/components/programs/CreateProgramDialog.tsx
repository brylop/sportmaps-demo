import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface CreateProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
}

export function CreateProgramDialog({ open, onOpenChange, schoolId }: CreateProgramDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sport: '',
    schedule: '',
    age_min: '',
    age_max: '',
    price_monthly: '',
    max_participants: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error('Debes iniciar sesión para crear un programa');
      return;
    }

    if (!formData.name || !formData.sport || !formData.price_monthly) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('programs').insert({
        school_id: schoolId,
        name: formData.name,
        description: formData.description || null,
        sport: formData.sport,
        schedule: formData.schedule || null,
        age_min: formData.age_min ? parseInt(formData.age_min) : null,
        age_max: formData.age_max ? parseInt(formData.age_max) : null,
        price_monthly: parseFloat(formData.price_monthly),
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        current_participants: 0,
        active: true,
        is_demo: false,
      });

      if (error) throw error;

      // Invalidate queries to force refetch
      await queryClient.invalidateQueries({ queryKey: ['programs', schoolId] });
      
      toast.success('Programa creado exitosamente');
      setFormData({
        name: '',
        description: '',
        sport: '',
        schedule: '',
        age_min: '',
        age_max: '',
        price_monthly: '',
        max_participants: '',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating program:', error);
      toast.error('Error al crear el programa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Programa</DialogTitle>
          <DialogDescription>
            Completa la información del programa deportivo que deseas ofrecer
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Programa *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ej: Fútbol Sub-12"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sport">Deporte *</Label>
            <Input
              id="sport"
              name="sport"
              placeholder="Ej: Fútbol"
              value={formData.sport}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe el programa, objetivos, metodología..."
              rows={3}
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">Horario</Label>
            <Input
              id="schedule"
              name="schedule"
              placeholder="Ej: Ma/Ju 4:00 PM - 6:00 PM"
              value={formData.schedule}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age_min">Edad Mínima</Label>
              <Input
                id="age_min"
                name="age_min"
                type="number"
                placeholder="Ej: 8"
                value={formData.age_min}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="age_max">Edad Máxima</Label>
              <Input
                id="age_max"
                name="age_max"
                type="number"
                placeholder="Ej: 12"
                value={formData.age_max}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_monthly">Precio Mensual *</Label>
              <Input
                id="price_monthly"
                name="price_monthly"
                type="number"
                placeholder="150000"
                value={formData.price_monthly}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_participants">Cupos Máximos</Label>
              <Input
                id="max_participants"
                name="max_participants"
                type="number"
                placeholder="20"
                value={formData.max_participants}
                onChange={handleChange}
              />
            </div>
          </div>

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
              {isSubmitting ? 'Creando...' : 'Crear Programa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
