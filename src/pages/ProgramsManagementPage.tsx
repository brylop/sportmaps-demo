import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Calendar, Edit2, Trash2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

interface Program {
  id: string;
  name: string;
  description: string;
  sport: string;
  price_monthly: number;
  schedule: string;
  active: boolean;
  max_participants: number | null;
  current_participants: number;
}

export default function ProgramsManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  // Form state basic
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sport: '',
    price_monthly: '',
    schedule: '',
    max_participants: ''
  });

  useEffect(() => {
    if (user) {
      fetchPrograms();
    }
  }, [user]);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      
      // 1. Get School ID
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (schoolError) throw schoolError;
      setSchoolId(schoolData.id);

      // 2. Get Programs
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('school_id', schoolData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProgram = async () => {
    if (!schoolId) return;

    try {
      const { error } = await supabase.from('programs').insert({
        school_id: schoolId,
        name: formData.name,
        description: formData.description,
        sport: formData.sport,
        price_monthly: Number(formData.price_monthly),
        schedule: formData.schedule,
        max_participants: formData.max_participants ? Number(formData.max_participants) : null,
        active: true
      });

      if (error) throw error;

      toast({ title: 'Programa creado exitosamente' });
      setIsCreateOpen(false);
      setFormData({ name: '', description: '', sport: '', price_monthly: '', schedule: '', max_participants: '' });
      fetchPrograms();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const toggleStatus = async (programId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('programs')
        .update({ active: !currentStatus })
        .eq('id', programId);

      if (error) throw error;
      
      // Optimistic update
      setPrograms(programs.map(p => 
        p.id === programId ? { ...p, active: !currentStatus } : p
      ));
    } catch (error) {
      toast({ title: 'Error al actualizar estado', variant: 'destructive' });
    }
  };

  if (loading) return <LoadingSpinner fullScreen text="Cargando programas..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mis Programas</h2>
          <p className="text-muted-foreground">
            Gestiona la oferta académica de tu escuela
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Programa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Programa</DialogTitle>
              <DialogDescription>
                Completa los detalles del programa para publicarlo en SportMaps.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Fútbol Base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sport">Deporte</Label>
                  <Input id="sport" value={formData.sport} onChange={e => setFormData({...formData, sport: e.target.value})} placeholder="Ej: Fútbol" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe el programa..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio Mensual</Label>
                  <Input id="price" type="number" value={formData.price_monthly} onChange={e => setFormData({...formData, price_monthly: e.target.value})} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max">Cupos Máx.</Label>
                  <Input id="max" type="number" value={formData.max_participants} onChange={e => setFormData({...formData, max_participants: e.target.value})} placeholder="Opcional" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule">Horario</Label>
                <Input id="schedule" value={formData.schedule} onChange={e => setFormData({...formData, schedule: e.target.value})} placeholder="Ej: Mar y Jue 4PM" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateProgram}>Crear Programa</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {programs.map((program) => (
          <Card key={program.id} className={`transition-opacity ${!program.active ? 'opacity-60' : ''}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <Badge variant="secondary">{program.sport}</Badge>
                <Switch 
                  checked={program.active}
                  onCheckedChange={() => toggleStatus(program.id, program.active)}
                />
              </div>
              <CardTitle className="mt-2">{program.name}</CardTitle>
              <CardDescription className="line-clamp-2 h-10">
                {program.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-muted-foreground">
                  <Users className="mr-2 h-4 w-4" />
                  <span>{program.current_participants} / {program.max_participants || '∞'}</span>
                </div>
                <div className="font-bold text-lg">
                  ${program.price_monthly.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                <span className="truncate">{program.schedule || 'Sin horario definido'}</span>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" className="w-full">
                <Edit2 className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}