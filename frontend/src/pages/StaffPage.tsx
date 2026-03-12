import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Mail, Trash2, Users, UserMinus, UserCheck, Clock } from 'lucide-react';
import { useSchoolStaff } from '@/hooks/useSchoolData';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { StaffFormDialog } from '@/components/school/StaffFormDialog';
import { AvailabilityModal } from '@/components/school/AvailabilityModal';
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
  const { staff, isLoading, createStaff, updateStaff, deleteStaff, isCreating } = useSchoolStaff();
  const { schoolId } = useSchoolContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<any>(null);

  const filteredStaff = staff.filter(member =>
    activeTab === 'active' ? member.status === 'active' : member.status !== 'active'
  );

  const handleToggleStatus = (member: any) => {
    updateStaff({
      id: member.id,
      full_name: member.full_name,
      email: member.email,
      phone: member.phone,
      specialty: member.specialty,
      status: member.status === 'active' ? 'inactive' : 'active'
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteStaff(deleteId);
      setDeleteId(null);
    }
  };

  const handleOpenAvailability = (member: any) => {
    setSelectedCoach(member);
    setAvailabilityOpen(true);
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Entrenadores</h1>
          <p className="text-muted-foreground">
            {staff.length} entrenador{staff.length !== 1 ? 'es' : ''} registrado{staff.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Contratar Entrenador
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">Activos</TabsTrigger>
          <TabsTrigger value="inactive">Inactivos</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{activeTab === 'active' ? 'Personal Activo' : 'Personal Inactivo'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay entrenadores en esta categoría.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.full_name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{member.specialty || 'Sin asignar'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-primary">{member.status === 'active' ? 'Activo' : 'Inactivo'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Gestionar disponibilidad"
                          onClick={() => handleOpenAvailability(member)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(member)}
                          title={member.status === 'active' ? "Inactivar" : "Reactivar"}
                        >
                          {member.status === 'active' ? (
                            <UserMinus className="h-4 w-4 text-orange-500" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(member.id)}
                          title="Eliminar permanentemente"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <StaffFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={createStaff}
        isLoading={isCreating}
      />

      {selectedCoach && (
        <AvailabilityModal
          open={availabilityOpen}
          onOpenChange={setAvailabilityOpen}
          coachId={selectedCoach.id}
          coachName={selectedCoach.full_name}
          schoolId={schoolId || ''}
        />
      )}

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
    </div>
  );
}
