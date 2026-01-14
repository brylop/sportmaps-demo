import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
<<<<<<< HEAD
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Building2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const facilitySchema = z.object({
  name: z.string().min(2, 'Nombre es requerido').max(100),
  type: z.string().min(1, 'Tipo es requerido'),
  capacity: z.string().min(1, 'Capacidad es requerida'),
  description: z.string().max(500).optional(),
});

type FacilityFormData = z.infer<typeof facilitySchema>;

export default function SchoolFacilitiesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Estado local para simular la base de datos
  const [facilities, setFacilities] = useState<any[]>([]);

  const form = useForm<FacilityFormData>({
    resolver: zodResolver(facilitySchema),
    defaultValues: {
      name: '',
      type: '',
      capacity: '',
      description: '',
    },
  });

  const onSubmit = (data: FacilityFormData) => {
    // Simulamos la creación con un ID temporal
    const newFacility = { ...data, id: Date.now().toString(), status: 'active' };
    setFacilities([...facilities, newFacility]);
    
    toast({
      title: '✅ Instalación creada',
      description: `${data.name} ha sido creada exitosamente`,
    });
    setDialogOpen(false);
    form.reset();
  };

  const facilityTypes = [
    'Cancha de Fútbol',
    'Cancha de Baloncesto',
    'Cancha de Tenis',
    'Cancha de Voleibol',
    'Piscina',
    'Gimnasio',
    'Pista de Atletismo',
    'Sala de Artes Marciales',
    'Otro'
  ];

  // Datos simulados para la vista de calendario
  const schedule = [
    { time: '2:00 PM', slots: {} },
    { time: '3:00 PM', slots: {} },
    { time: '4:00 PM', slots: {} },
    { time: '5:00 PM', slots: {} },
    { time: '6:00 PM', slots: {} },
  ];

  if (facilities.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
=======
import { Building2, MapPin, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSchoolFacilities } from '@/hooks/useSchoolData';
import { FacilityFormDialog } from '@/components/school/FacilityFormDialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function SchoolFacilitiesPage() {
  const { facilities, isLoading, createFacility, deleteFacility, isCreating } = useSchoolFacilities();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      deleteFacility(deleteId);
      setDeleteId(null);
    }
  };

  // Time slots for schedule view
  const schedule = [
    { time: '08:00 AM' },
    { time: '09:00 AM' },
    { time: '10:00 AM' },
    { time: '02:00 PM' },
    { time: '03:00 PM' },
    { time: '04:00 PM' },
    { time: '05:00 PM' },
    { time: '06:00 PM' },
  ];

  if (isLoading) {
    return <LoadingSpinner text="Cargando instalaciones..." />;
  }

  if (facilities.length === 0) {
    return (
      <div className="space-y-6">
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Instalaciones</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los espacios deportivos de tu academia
            </p>
          </div>
        </div>

        <EmptyState
          icon={Building2}
          title="Tu academia necesita espacios"
<<<<<<< HEAD
          description="Crea tu primera instalación (cancha, piscina, gimnasio, etc.) para gestionar sus reservas y horarios. Podrás configurar la disponibilidad y ver quién está usando cada espacio."
=======
          description="Crea tu primera instalación (cancha, piscina, gimnasio, etc.) para gestionar sus reservas y horarios."
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
          actionLabel="+ Agregar Instalación"
          onAction={() => setDialogOpen(true)}
        />

<<<<<<< HEAD
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Agregar Nueva Instalación</DialogTitle>
              <DialogDescription>
                Registra un nuevo espacio deportivo en tu academia.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Información de la Instalación
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Instalación *</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Cancha 1, Piscina Principal, Gimnasio A"
                    {...form.register('name')}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Instalación *</Label>
                  <Select onValueChange={(value) => form.setValue('type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilityTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.type && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacidad *</Label>
                  <Input
                    id="capacity"
                    type="number"
                    placeholder="Número de personas"
                    {...form.register('capacity')}
                  />
                  {form.formState.errors.capacity && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.capacity.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Número máximo de personas que pueden usar la instalación al mismo tiempo
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción y Reglas</Label>
                  <Textarea
                    id="description"
                    placeholder="Ej: Cancha de césped sintético con iluminación nocturna. Obligatorio uso de zapatos adecuados..."
                    {...form.register('description')}
                    rows={4}
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Próximo paso:</strong> Después de crear la instalación, podrás configurar sus horarios de disponibilidad y gestionar las reservas.
                </p>
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
                  Crear Instalación
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
=======
        <FacilityFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={createFacility}
          isLoading={isCreating}
        />
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <div className="space-y-6 animate-in fade-in duration-500">
=======
    <div className="space-y-6">
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instalaciones</h1>
          <p className="text-muted-foreground mt-1">
            {facilities.length} instalación{facilities.length !== 1 ? 'es' : ''} registrada{facilities.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Building2 className="w-4 h-4 mr-2" />
          Agregar Instalación
        </Button>
      </div>

      {/* Facilities Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {facilities.map((facility) => (
<<<<<<< HEAD
          <Card key={facility.id} className="p-6 hover:shadow-md transition-shadow">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <h3 className="font-semibold truncate">{facility.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{facility.type}</p>
              <p className="text-xs text-muted-foreground">Capacidad: {facility.capacity} personas</p>
              <Button variant="outline" size="sm" className="w-full mt-2">
                Ver Reservas
              </Button>
=======
          <Card key={facility.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">{facility.name}</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setDeleteId(facility.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              
              <Badge variant="secondary">{facility.type}</Badge>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>Capacidad: {facility.capacity} personas</span>
              </div>

              {facility.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {facility.description}
                </p>
              )}

              <Badge 
                variant={facility.status === 'available' ? 'default' : 'secondary'}
                className={facility.status === 'available' ? 'bg-primary' : ''}
              >
                {facility.status === 'available' ? 'Disponible' : 'Ocupado'}
              </Badge>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            </div>
          </Card>
        ))}
      </div>

      {/* Calendar View */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Calendario de Reservas - Hoy</h2>
          <div className="overflow-x-auto">
<<<<<<< HEAD
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium w-24">Hora</th>
                  {facilities.map((facility) => (
                    <th key={facility.id} className="p-3 text-left font-medium border-l">
=======
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium">Hora</th>
                  {facilities.map((facility) => (
                    <th key={facility.id} className="p-3 text-left font-medium">
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                      {facility.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((slot, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
<<<<<<< HEAD
                    <td className="p-3 font-medium text-sm text-muted-foreground">{slot.time}</td>
                    {facilities.map((facility) => (
                      <td key={facility.id} className="p-3 border-l">
                        <div className="text-muted-foreground text-xs bg-secondary/50 p-1 rounded text-center">
                          (Libre)
                        </div>
=======
                    <td className="p-3 font-medium">{slot.time}</td>
                    {facilities.map((facility) => (
                      <td key={facility.id} className="p-3">
                        <Badge variant="outline" className="text-xs">
                          Libre
                        </Badge>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

<<<<<<< HEAD
      {/* Dialog reused for adding more */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Agregar Nueva Instalación</DialogTitle>
              <DialogDescription>
                Registra un nuevo espacio deportivo en tu academia.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Instalación *</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Cancha 1, Piscina Principal"
                    {...form.register('name')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Tipo *</Label>
                  <Select onValueChange={(value) => form.setValue('type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilityTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacidad *</Label>
                  <Input
                    id="capacity"
                    type="number"
                    {...form.register('capacity')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    {...form.register('description')}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Crear Instalación</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    </div>
  );
}
=======
      <FacilityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={createFacility}
        isLoading={isCreating}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar instalación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La instalación será removida del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
