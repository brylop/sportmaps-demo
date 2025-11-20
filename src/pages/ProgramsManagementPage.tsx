import { useState, FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Users, Calendar, MapPin, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Program {
  id: string;
  name: string;
  sport: string;
  coach: string;
  capacity: {
    current: number;
    max: number;
  };
  schedule: string;
  facility: string;
  price: number;
}

const INITIAL_PROGRAMS: Program[] = [
  {
    id: '1',
    name: 'Fútbol Sub-12',
    sport: 'Fútbol',
    coach: 'Luis F. Rodríguez',
    capacity: { current: 20, max: 20 },
    schedule: 'Ma/Ju 4:00 PM - 6:00 PM',
    facility: 'Cancha 1',
    price: 150000,
  },
  {
    id: '2',
    name: 'Tenis Infantil',
    sport: 'Tenis',
    coach: 'Diana Silva',
    capacity: { current: 8, max: 12 },
    schedule: 'Lu/Mi 3:00 PM - 4:30 PM',
    facility: 'Cancha Tenis 1',
    price: 180000,
  },
  {
    id: '3',
    name: 'Fútbol Sub-10',
    sport: 'Fútbol',
    coach: 'Luis F. Rodríguez',
    capacity: { current: 18, max: 20 },
    schedule: 'Ma/Ju 3:00 PM - 4:30 PM',
    facility: 'Cancha 2',
    price: 150000,
  },
  {
    id: '4',
    name: 'Voleibol Juvenil',
    sport: 'Voleibol',
    coach: 'Sin asignar',
    capacity: { current: 8, max: 20 },
    schedule: 'Lu/Mi/Vi 5:00 PM - 6:30 PM',
    facility: 'Cancha Cubierta',
    price: 140000,
  },
];

export default function ProgramsManagementPage() {
  const [programs, setPrograms] = useState<Program[]>(INITIAL_PROGRAMS);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    sport: '',
    coach: '',
    schedule: '',
    facility: '',
    maxCapacity: 20,
    price: 150000,
  });

  const openCreateForm = () => {
    setEditingProgram(null);
    setFormData({
      name: '',
      sport: '',
      coach: '',
      schedule: '',
      facility: '',
      maxCapacity: 20,
      price: 150000,
    });
    setIsFormOpen(true);
  };

  const openEditForm = (program: Program) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      sport: program.sport,
      coach: program.coach,
      schedule: program.schedule,
      facility: program.facility,
      maxCapacity: program.capacity.max,
      price: program.price,
    });
    setIsFormOpen(true);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const updatedProgram: Program = {
      id: editingProgram ? editingProgram.id : Date.now().toString(),
      name: formData.name,
      sport: formData.sport,
      coach: formData.coach || 'Sin asignar',
      capacity: {
        current: editingProgram ? editingProgram.capacity.current : 0,
        max: Number(formData.maxCapacity) || 0,
      },
      schedule: formData.schedule,
      facility: formData.facility,
      price: Number(formData.price) || 0,
    };

    setPrograms((prev) => {
      const exists = prev.some((p) => p.id === updatedProgram.id);
      if (exists) {
        return prev.map((p) => (p.id === updatedProgram.id ? updatedProgram : p));
      }
      return [...prev, updatedProgram];
    });

    toast({
      title: editingProgram ? 'Programa actualizado' : 'Programa creado',
      description: editingProgram
        ? 'Los datos del programa se han actualizado correctamente.'
        : 'El nuevo programa se ha agregado al catálogo.',
    });

    setIsFormOpen(false);
    setEditingProgram(null);
  };

  const getCapacityBadge = (current: number, max: number) => {
    const percentage = (current / max) * 100;

    if (percentage === 100) {
      return <Badge className="bg-destructive text-destructive-foreground">Lleno</Badge>;
    }

    if (percentage >= 80) {
      return <Badge className="bg-warning text-warning-foreground">Casi lleno</Badge>;
    }

    return <Badge className="bg-success text-success-foreground">Disponible</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Programas</h1>
          <p className="text-muted-foreground">Catálogo de productos y servicios</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          {editingProgram ? 'Editar Programa' : 'Crear Nuevo Programa'}
        </Button>
      </div>

      {isFormOpen && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{editingProgram ? 'Editar programa' : 'Nuevo programa'}</CardTitle>
            <CardDescription>
              Completa la información básica del programa deportivo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="name">Nombre del programa</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Fútbol Sub-12"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sport">Deporte</Label>
                <Input
                  id="sport"
                  value={formData.sport}
                  onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                  placeholder="Ej. Fútbol, Tenis"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="coach">Coach responsable</Label>
                <Input
                  id="coach"
                  value={formData.coach}
                  onChange={(e) => setFormData({ ...formData, coach: e.target.value })}
                  placeholder="Nombre del entrenador"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="facility">Instalación</Label>
                <Input
                  id="facility"
                  value={formData.facility}
                  onChange={(e) => setFormData({ ...formData, facility: e.target.value })}
                  placeholder="Ej. Cancha 1, Piscina Olímpica"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="schedule">Horario</Label>
                <Input
                  id="schedule"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  placeholder="Ej. Lu/Mi 4:00 PM - 6:00 PM"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="maxCapacity">Cupos máximos</Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  min={1}
                  value={formData.maxCapacity}
                  onChange={(e) =>
                    setFormData({ ...formData, maxCapacity: Number(e.target.value) || 0 })
                  }
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="price">Precio mensual</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step={1000}
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: Number(e.target.value) || 0 })
                  }
                  required
                />
              </div>

              <div className="flex items-end gap-2 md:col-span-2">
                <Button type="submit" className="flex-1">
                  {editingProgram ? 'Guardar cambios' : 'Crear programa'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingProgram(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {programs.map((program) => (
          <Card key={program.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{program.name}</CardTitle>
                  <CardDescription>{program.sport}</CardDescription>
                </div>
                {getCapacityBadge(program.capacity.current, program.capacity.max)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-sm text-muted-foreground">
                <Users className="mr-2 h-4 w-4" />
                <span className="font-medium">Coach:</span>
                <span className="ml-2">{program.coach}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Users className="mr-2 h-4 w-4" />
                <span className="font-medium">Cupos:</span>
                <span className="ml-2">
                  {program.capacity.current}/{program.capacity.max}
                </span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                <span className="font-medium">Horario:</span>
                <span className="ml-2">{program.schedule}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4" />
                <span className="font-medium">Instalación:</span>
                <span className="ml-2">{program.facility}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <DollarSign className="mr-2 h-4 w-4" />
                <span className="font-medium">Precio:</span>
                <span className="ml-2">
                  ${program.price.toLocaleString()} / Mes
                </span>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditForm(program)}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  disabled
                >
                  Ver Alumnos
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

