import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Calendar, MapPin, DollarSign } from 'lucide-react';

export default function ProgramsManagementPage() {
  const programs = [
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

  const getCapacityBadge = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage === 100) return <Badge className="bg-red-500">Lleno</Badge>;
    if (percentage >= 80) return <Badge className="bg-yellow-500">Casi lleno</Badge>;
    return <Badge className="bg-green-500">Disponible</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Programas</h1>
          <p className="text-muted-foreground">Catálogo de productos y servicios</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Crear Nuevo Programa
        </Button>
      </div>

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
                <span className="ml-2">{program.capacity.current}/{program.capacity.max}</span>
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
                <span className="ml-2">${program.price.toLocaleString()} / Mes</span>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm" className="flex-1">Editar</Button>
                <Button variant="ghost" size="sm" className="flex-1">Ver Alumnos</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
