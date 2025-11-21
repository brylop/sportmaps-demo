import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
          description="Crea tu primera instalación (cancha, piscina, gimnasio, etc.) para gestionar sus reservas y horarios. Podrás configurar la disponibilidad y ver quién está usando cada espacio."
          actionLabel="+ Agregar Instalación"
          onAction={() => setDialogOpen(true)}
        />

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
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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
            </div>
          </Card>
        ))}
      </div>

      {/* Calendar View */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Calendario de Reservas - Hoy</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium w-24">Hora</th>
                  {facilities.map((facility) => (
                    <th key={facility.id} className="p-3 text-left font-medium border-l">
                      {facility.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((slot, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium text-sm text-muted-foreground">{slot.time}</td>
                    {facilities.map((facility) => (
                      <td key={facility.id} className="p-3 border-l">
                        <div className="text-muted-foreground text-xs bg-secondary/50 p-1 rounded text-center">
                          (Libre)
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

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