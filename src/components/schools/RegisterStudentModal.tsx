import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const studentSchema = z.object({
  full_name: z.string().trim().min(1, 'Nombre completo es requerido').max(100),
  date_of_birth: z.string().min(1, 'Fecha de nacimiento es requerida'),
  sport: z.string().optional(),
  team_name: z.string().trim().max(100).optional(),
  medical_info: z.string().trim().max(500).optional(),
});

interface RegisterStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
}

export function RegisterStudentModal({
  open,
  onOpenChange,
  schoolId,
}: RegisterStudentModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    sport: '',
    team_name: '',
    medical_info: '',
  });

  const registerStudentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validate data
      const validation = studentSchema.safeParse(data);
      if (!validation.success) {
        throw new Error(validation.error.issues[0].message);
      }

      // Register student in children table
      const { error } = await supabase.from('children').insert({
        parent_id: user?.id,
        school_id: schoolId,
        full_name: data.full_name,
        date_of_birth: data.date_of_birth,
        sport: data.sport || null,
        team_name: data.team_name || null,
        medical_info: data.medical_info || null,
        is_demo: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Estudiante registrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['student-invitations', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['user-children', user?.id] });
      
      // Reset form
      setFormData({
        full_name: '',
        date_of_birth: '',
        sport: '',
        team_name: '',
        medical_info: '',
      });
      
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error('Error registering student:', error);
      toast.error(error.message || 'Error al registrar el estudiante');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerStudentMutation.mutate(formData);
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Registrar Estudiante Externo
          </DialogTitle>
          <DialogDescription>
            Registra un estudiante que aún no está en el ecosistema SportMaps
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">
              Nombre Completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              placeholder="Nombre completo del estudiante"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">
              Fecha de Nacimiento <span className="text-destructive">*</span>
            </Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => handleChange('date_of_birth', e.target.value)}
              required
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sport">Deporte</Label>
            <Select
              value={formData.sport}
              onValueChange={(value) => handleChange('sport', value)}
            >
              <SelectTrigger id="sport">
                <SelectValue placeholder="Selecciona un deporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fútbol">Fútbol</SelectItem>
                <SelectItem value="Baloncesto">Baloncesto</SelectItem>
                <SelectItem value="Natación">Natación</SelectItem>
                <SelectItem value="Tenis">Tenis</SelectItem>
                <SelectItem value="Voleibol">Voleibol</SelectItem>
                <SelectItem value="Atletismo">Atletismo</SelectItem>
                <SelectItem value="Gimnasia">Gimnasia</SelectItem>
                <SelectItem value="Artes Marciales">Artes Marciales</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team_name">Equipo</Label>
            <Input
              id="team_name"
              value={formData.team_name}
              onChange={(e) => handleChange('team_name', e.target.value)}
              placeholder="Nombre del equipo (opcional)"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medical_info">Información Médica</Label>
            <Textarea
              id="medical_info"
              value={formData.medical_info}
              onChange={(e) => handleChange('medical_info', e.target.value)}
              placeholder="Alergias, condiciones médicas, medicamentos, etc. (opcional)"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Máximo 500 caracteres
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={registerStudentMutation.isPending}
              className="flex-1"
            >
              {registerStudentMutation.isPending ? 'Registrando...' : 'Registrar Estudiante'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
