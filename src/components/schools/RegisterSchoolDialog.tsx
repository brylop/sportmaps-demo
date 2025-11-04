import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const schoolSchema = z.object({
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(100),
  description: z.string().trim().max(500).optional(),
  address: z.string().trim().min(5, 'La dirección es requerida').max(200),
  city: z.string().trim().min(2, 'La ciudad es requerida').max(100),
  phone: z.string().trim().min(10, 'El teléfono debe tener al menos 10 dígitos').max(20),
  email: z.string().trim().email('Email inválido').max(255),
  website: z.string().trim().url('URL inválida').max(255).optional().or(z.literal('')),
});

interface RegisterSchoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterSchoolDialog({ open, onOpenChange }: RegisterSchoolDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    website: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast.error('Debes iniciar sesión');
      return;
    }

    // Validate
    const validation = schoolSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      toast.error(firstError.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('schools').insert({
        owner_id: user.id,
        name: formData.name,
        description: formData.description || null,
        address: formData.address,
        city: formData.city,
        phone: formData.phone,
        email: formData.email,
        website: formData.website || null,
        verified: false,
        is_demo: false,
        rating: 0,
        total_reviews: 0,
        sports: [],
        amenities: [],
      });

      if (error) throw error;

      toast.success('Escuela registrada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['user-school'] });
      onOpenChange(false);
      
      // Redirect to onboarding
      navigate('/school-onboarding');
    } catch (error) {
      console.error('Error registering school:', error);
      toast.error('Error al registrar la escuela');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Registra tu Escuela
          </DialogTitle>
          <DialogDescription>
            Completa la información básica de tu escuela deportiva para comenzar
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Escuela *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ej: Academia Deportiva Champions"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe brevemente tu escuela deportiva..."
              rows={3}
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad *</Label>
              <Input
                id="city"
                name="city"
                placeholder="Ej: Bogotá"
                value={formData.city}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+57 300 123 4567"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección *</Label>
            <Input
              id="address"
              name="address"
              placeholder="Ej: Calle 123 #45-67"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email de Contacto *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="contacto@escuela.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Sitio Web</Label>
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://tuescuela.com"
                value={formData.website}
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
              {isSubmitting ? 'Registrando...' : 'Registrar Escuela'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
