<<<<<<< HEAD
=======
import { useState } from 'react';
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
<<<<<<< HEAD
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
=======
import { UserPlus, Mail, Trash2, Users } from 'lucide-react';
import { useSchoolStaff } from '@/hooks/useSchoolData';
import { StaffFormDialog } from '@/components/school/StaffFormDialog';
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

export default function StaffPage() {
  const { staff, isLoading, createStaff, deleteStaff, isCreating } = useSchoolStaff();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      deleteStaff(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Cargando personal..." />;
  }

  if (staff.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Entrenadores</h1>
            <p className="text-muted-foreground">Gestión de personal y asignaciones</p>
          </div>
        </div>

        <EmptyState
          icon={Users}
          title="Tu academia necesita entrenadores"
          description="Agrega a los entrenadores y staff técnico de tu academia para gestionar sus asignaciones y programas."
          actionLabel="+ Agregar Entrenador"
          onAction={() => setDialogOpen(true)}
        />

        <StaffFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={createStaff}
          isLoading={isCreating}
        />
      </div>
    );
  }
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Entrenadores</h1>
<<<<<<< HEAD
          <p className="text-muted-foreground">Gestión de personal y asignaciones</p>
        </div>
        <Button>
=======
          <p className="text-muted-foreground">
            {staff.length} entrenador{staff.length !== 1 ? 'es' : ''} registrado{staff.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
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
<<<<<<< HEAD
                <TableHead>Programas Asignados</TableHead>
=======
                <TableHead>Especialidad</TableHead>
                <TableHead>Certificaciones</TableHead>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
<<<<<<< HEAD
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
=======
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.full_name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{member.specialty || 'Sin asignar'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {member.certifications?.slice(0, 2).map((cert, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{cert}</Badge>
                      ))}
                      {member.certifications && member.certifications.length > 2 && (
                        <Badge variant="outline" className="text-xs">+{member.certifications.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-primary">{member.status === 'active' ? 'Activo' : 'Inactivo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setDeleteId(member.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
<<<<<<< HEAD
=======

      <StaffFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={createStaff}
        isLoading={isCreating}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entrenador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El entrenador será removido del sistema.
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
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
    </div>
  );
}
