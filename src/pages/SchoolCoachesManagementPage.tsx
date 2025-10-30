import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Users, Upload, Mail, Phone, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const coachSchema = z.object({
  full_name: z.string().min(2, 'Nombre completo es requerido').max(100),
  specialty: z.string().min(2, 'Especialidad es requerida'),
  email: z.string().email('Email inválido').max(255),
  phone: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').max(20),
  certifications: z.string().max(500).optional(),
});

type CoachFormData = z.infer<typeof coachSchema>;

export default function SchoolCoachesManagementPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [coaches, setCoaches] = useState<any[]>([]);

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

  const onSubmit = (data: CoachFormData) => {
    setCoaches([...coaches, { ...data, id: Date.now() }]);
    toast({
      title: '✅ Entrenador agregado',
      description: `${data.full_name} ha sido registrado exitosamente`,
    });
    setDialogOpen(false);
    form.reset();
  };

  const sportsList = [
    'Fútbol', 'Baloncesto', 'Voleibol', 'Tenis', 'Natación',
    'Atletismo', 'Gimnasia', 'Artes Marciales', 'Padel', 'CrossFit'
  ];

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
                      <SelectValue placeholder="Selecciona la especialidad" />
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

                <div className="space-y-2">
                  <Label htmlFor="photo">Foto de Perfil</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Sube una foto del entrenador
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
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
