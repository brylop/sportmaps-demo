import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Loader2, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { classesAPI, ClassCreate } from '@/lib/api/classes';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface CreateClassModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
}

export function CreateClassModal({ open, onClose, onSuccess, schoolId }: CreateClassModalProps) {
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<ClassCreate>>({
    name: '',
    description: '',
    sport: '',
    level: 'beginner',
    capacity: 20,
    location: '',
    price: 0,
    coach_name: '',
    school_id: schoolId,
    status: 'active',
  });
  const [staff, setStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && schoolId) {
      fetchStaff();
    }
  }, [open, schoolId]);

  const fetchStaff = async () => {
    try {
      setLoadingStaff(true);
      const { data, error } = await supabase
        .from('school_staff')
        .select('id, full_name')
        .eq('school_id', schoolId)
        .eq('status', 'active');

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.sport) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa nombre y deporte',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreating(true);

      await classesAPI.createClass({
        ...formData,
        school_id: schoolId,
      } as ClassCreate);

      toast({
        title: '¡Clase creada!',
        description: 'La clase se creó correctamente',
      });

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error creating class:', error);
      toast({
        title: 'Error al crear clase',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating) {
      setFormData({
        name: '',
        description: '',
        sport: '',
        level: 'beginner',
        capacity: 20,
        location: '',
        price: 0,
        coach_name: '',
        school_id: schoolId,
        status: 'active',
      });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Crear Nueva Clase
          </DialogTitle>
          <DialogDescription>
            Completa los detalles de la nueva clase para tu academia.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Clase *</Label>
            <Input
              id="name"
              placeholder="Ej: Fútbol Sub-12"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* Sport & Level */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sport">Deporte *</Label>
              <Input
                id="sport"
                placeholder="Ej: Fútbol, Baloncesto"
                value={formData.sport}
                onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Nivel</Label>
              <Select
                value={formData.level}
                onValueChange={(value: any) => setFormData({ ...formData, level: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Principiante</SelectItem>
                  <SelectItem value="intermediate">Intermedio</SelectItem>
                  <SelectItem value="advanced">Avanzado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Describe la clase, objetivos, etc."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Coach & Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coach_id">Entrenador</Label>
              <Select
                value={formData.coach_id || ''}
                onValueChange={(value) => setFormData({ ...formData, coach_id: value })}
              >
                <SelectTrigger id="coach_id">
                  <SelectValue placeholder={loadingStaff ? "Cargando..." : "Seleccionar entrenador"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin entrenador</SelectItem>
                  {staff.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>
                      {coach.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                placeholder="Cancha, salón, etc."
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
          </div>

          {/* Capacity & Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacidad</Label>
              <div className="flex items-center border rounded-md h-10 bg-background overflow-hidden relative">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, capacity: Math.max(1, (formData.capacity || 1) - 1) })}
                  className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute left-0 z-10 flex items-center justify-center border-r"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <Input
                  id="capacity"
                  type="number"
                  className="border-0 text-center font-semibold focus-visible:ring-0 px-10 no-spinners"
                  min="1"
                  max="100"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 20 })}
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, capacity: (formData.capacity || 0) + 1 })}
                  className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute right-0 z-10 flex items-center justify-center border-l"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Precio Mensual ($)</Label>
              <div className="flex items-center border rounded-md h-10 w-full bg-background overflow-hidden relative">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, price: Math.max(0, (formData.price || 0) - 10000) })}
                  className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute left-0 z-10 flex items-center justify-center border-r bg-muted/20"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="absolute left-10 text-muted-foreground font-medium z-10 pointer-events-none">$</span>
                <Input
                  id="price"
                  type="text"
                  className="border-0 text-center font-semibold focus-visible:ring-0 pl-14 pr-10"
                  value={formData.price ? Number(formData.price).toLocaleString('es-CO') : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, price: val === '' ? 0 : parseFloat(val) });
                  }}
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, price: (formData.price || 0) + 10000 })}
                  className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute right-0 z-10 flex items-center justify-center border-l bg-muted/20"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select
              value={formData.status}
              onValueChange={(value: any) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Clase
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
