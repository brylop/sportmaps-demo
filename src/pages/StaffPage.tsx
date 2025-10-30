import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Mail } from 'lucide-react';

export default function StaffPage() {
  const coaches = [
    {
      id: '1',
      name: 'Luis F. Rodríguez',
      email: 'luis.fdo@ads.com',
      phone: '+57 300 111 2222',
      programs: ['Fútbol Sub-12', 'Fútbol Sub-10'],
      status: 'active',
    },
    {
      id: '2',
      name: 'Diana Silva',
      email: 'diana.silva@ads.com',
      phone: '+57 310 222 3333',
      programs: ['Tenis Infantil'],
      status: 'active',
    },
    {
      id: '3',
      name: 'Vacante',
      email: '-',
      phone: '-',
      programs: ['Voleibol Juvenil'],
      status: 'vacant',
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Entrenadores</h1>
          <p className="text-muted-foreground">Gestión de personal y asignaciones</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Contratar Entrenador
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Activo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Programas Asignados</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map((coach) => (
                <TableRow key={coach.id}>
                  <TableCell className="font-medium">{coach.name}</TableCell>
                  <TableCell>{coach.email}</TableCell>
                  <TableCell>{coach.phone}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {coach.programs.map((program, idx) => (
                        <Badge key={idx} variant="secondary">{program}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {coach.status === 'active' ? (
                      <Badge className="bg-green-500">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Vacante</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {coach.status === 'active' ? (
                      <Button variant="ghost" size="sm">Ver Perfil</Button>
                    ) : (
                      <Button variant="outline" size="sm">
                        <Mail className="mr-2 h-4 w-4" />
                        Contratar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
