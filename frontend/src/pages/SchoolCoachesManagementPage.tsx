<<<<<<< HEAD
import { useState, useEffect } from 'react';
=======
import { useState } from 'react';
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
<<<<<<< HEAD
import { Users, Upload, Mail, Briefcase, Trash2, Search, Plus } from 'lucide-react';
=======
import { Users, Upload, Mail, Phone, Briefcase } from 'lucide-react';
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
<<<<<<< HEAD
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
=======
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3

const coachSchema = z.object({
  full_name: z.string().min(2, 'Nombre completo es requerido').max(100),
  specialty: z.string().min(2, 'Especialidad es requerida'),
  email: z.string().email('Email inválido').max(255),
  phone: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').max(20),
  certifications: z.string().max(500).optional(),
});

type CoachFormData = z.infer<typeof coachSchema>;

<<<<<<< HEAD
interface Coach extends CoachFormData {
  id: string;
  avatar_url?: string | null;
  status: 'active' | 'pending';
  teams_count: number;
}

export default function SchoolCoachesManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
=======
export default function SchoolCoachesManagementPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [coaches, setCoaches] = useState<any[]>([]);
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3

  const form = useForm<CoachFormData>({
    resolver: zodResolver(coachSchema),
    defaultValues: {
      full_name: '',
      specialty: '',
      email: '',
      phone: '',
      certifications: '',
    },
  });

<<<<<<< HEAD
  useEffect(() => {
    if (user) {
      fetchCoaches();
    }
  }, [user]);

  const fetchCoaches = async () => {
    try {
      setLoading(true);
      // Simulamos obtener los entrenadores asociados a la escuela
      // En producción esto sería un join con una tabla intermedia 'school_coaches'
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'coach')
        .limit(6);

      if (error) throw error;

      const mappedCoaches: Coach[] = (data || []).map((profile: any) => ({
        id: profile.id,
        full_name: profile.full_name || 'Entrenador',
        email: 'coach@demo.com',
        phone: profile.phone || '',
        avatar_url: profile.avatar_url,
        specialty: 'Fútbol', // Dato simulado si no existe en profile
        certifications: '',
        status: 'active',
        teams_count: Math.floor(Math.random() * 3) + 1
      }));

      setCoaches(mappedCoaches);
    } catch (error) {
      console.error('Error fetching coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CoachFormData) => {
    try {
      // Aquí iría la llamada a la Edge Function para enviar la invitación real
      // await supabase.functions.invoke('invite-coach', { body: data });
      
      // Simulación de éxito
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newCoach: Coach = {
        ...data,
        id: `temp-${Date.now()}`,
        status: 'pending',
        teams_count: 0,
        avatar_url: null
      };

      setCoaches([...coaches, newCoach]);
      
      toast({
        title: 'Invitación enviada',
        description: `Se ha enviado un correo a ${data.email} para unirse al equipo.`,
      });
      
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar la invitación. Intenta nuevamente.',
        variant: 'destructive'
      });
    }
=======
  const onSubmit = (data: CoachFormData) => {
    setCoaches([...coaches, { ...data, id: Date.now() }]);
    toast({
      title: '✅ Entrenador agregado',
      description: `${data.full_name} ha sido registrado exitosamente`,
    });
    setDialogOpen(false);
    form.reset();
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
  };

  const sportsList = [
    'Fútbol', 'Baloncesto', 'Voleibol', 'Tenis', 'Natación',
    'Atletismo', 'Gimnasia', 'Artes Marciales', 'Padel', 'CrossFit'
  ];

<<<<<<< HEAD
  const filteredCoaches = coaches.filter(c => 
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner fullScreen text="Cargando equipo técnico..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Entrenadores</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona el equipo de entrenadores de tu academia
          </p>
        </div>
        
        {coaches.length > 0 && (
           <Button onClick={() => setDialogOpen(true)}>
             <Plus className="w-4 h-4 mr-2" />
             Invitar Entrenador
           </Button>
        )}
      </div>

      {coaches.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay entrenadores en tu equipo"
          description="Invita al primer entrenador. Registra a tu equipo técnico para asignarles clases, programas y gestionar sus horarios."
          actionLabel="+ Agregar Entrenador"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o especialidad..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCoaches.map((coach) => (
              <Card key={coach.id} className="p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={coach.avatar_url || undefined} />
                      <AvatarFallback>{coach.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold leading-none">{coach.full_name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{coach.specialty}</p>
                    </div>
                  </div>
                  <Badge variant={coach.status === 'active' ? 'default' : 'secondary'}>
                    {coach.status === 'active' ? 'Activo' : 'Pendiente'}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{coach.email}</span>
                  </div>
                  {coach.phone && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{coach.phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-auto flex items-center justify-between border-t">
                  <span className="text-xs text-muted-foreground">
                    {coach.teams_count} equipos asignados
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invitar Nuevo Entrenador</DialogTitle>
            <DialogDescription>
              Envía una invitación para que un entrenador se una a tu academia.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Información Personal
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
=======
  if (coaches.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Entrenadores</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona el equipo de entrenadores de tu academia
            </p>
          </div>
        </div>

        <EmptyState
          icon={Users}
          title="No hay entrenadores en tu equipo"
          description="Invita al primer entrenador. Registra a tu equipo técnico para asignarles clases, programas y gestionar sus horarios. Podrás controlar sus asignaciones y ver su desempeño."
          actionLabel="+ Agregar Entrenador"
          onAction={() => setDialogOpen(true)}
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Entrenador</DialogTitle>
              <DialogDescription>
                Registra la información del entrenador y sus credenciales.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Información Personal
                </h3>

>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nombre Completo *</Label>
                  <Input
                    id="full_name"
                    placeholder="Ej: Carlos Hernández"
                    {...form.register('full_name')}
                  />
                  {form.formState.errors.full_name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.full_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialty">Especialidad *</Label>
                  <Select onValueChange={(value) => form.setValue('specialty', value)}>
                    <SelectTrigger>
<<<<<<< HEAD
                      <SelectValue placeholder="Selecciona especialidad" />
=======
                      <SelectValue placeholder="Selecciona la especialidad" />
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                    </SelectTrigger>
                    <SelectContent>
                      {sportsList.map((sport) => (
                        <SelectItem key={sport} value={sport}>
                          {sport}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.specialty && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.specialty.message}
                    </p>
                  )}
                </div>
<<<<<<< HEAD
              </div>

              <div className="space-y-2">
                  <Label htmlFor="photo">Foto de Perfil (Opcional)</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                    <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                      Click para subir imagen
=======

                <div className="space-y-2">
                  <Label htmlFor="photo">Foto de Perfil</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Sube una foto del entrenador
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
<<<<<<< HEAD
                      className="hidden"
                      id="photo-upload"
                    />
                    <Label htmlFor="photo-upload" className="absolute inset-0 cursor-pointer" />
                  </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Contacto y Credenciales
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
=======
                      className="max-w-xs mx-auto"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Información de Contacto
                </h3>

>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="entrenador@ejemplo.com"
                    {...form.register('email')}
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+57 300 123 4567"
                    {...form.register('phone')}
                  />
                  {form.formState.errors.phone && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>
              </div>

<<<<<<< HEAD
              <div className="space-y-2">
                <Label htmlFor="certifications">Certificaciones (Opcional)</Label>
                <Input
                  id="certifications"
                  placeholder="Ej: Licencia UEFA B, Título Universitario..."
                  {...form.register('certifications')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Enviando...' : 'Enviar Invitación'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
=======
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Certificaciones
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="certifications">Certificaciones y Títulos</Label>
                  <Input
                    id="certifications"
                    placeholder="Ej: Licenciado en Educación Física, Certificado UEFA B"
                    {...form.register('certifications')}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Agregar Entrenador
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Entrenadores</h1>
          <p className="text-muted-foreground mt-1">
            {coaches.length} entrenador{coaches.length !== 1 ? 'es' : ''} registrado{coaches.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Users className="w-4 h-4 mr-2" />
          Agregar Entrenador
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {coaches.map((coach) => (
          <Card key={coach.id} className="p-6">
            <h3 className="font-semibold">{coach.full_name}</h3>
            <p className="text-sm text-muted-foreground">{coach.specialty}</p>
            <p className="text-sm text-muted-foreground mt-2">{coach.email}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
