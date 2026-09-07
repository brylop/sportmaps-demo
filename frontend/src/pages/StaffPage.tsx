import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { branchesAPI } from '@/lib/api/branches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Pencil, Trash2, Users, UserMinus, UserCheck, Clock, RefreshCw } from 'lucide-react';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';
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
  const { staff, isLoading, isFetching, refetch, createStaffAsync, updateStaff, updateStaffAsync, deleteStaff, isSaving } = useSchoolStaff();
  const { schoolId } = useSchoolContext();

  // Sedes para asignar al contratar. Si la escuela no tiene sedes, el modal
  // oculta el campo y la tabla no muestra la columna.
  const { data: branches = [] } = useQuery({
    queryKey: ['school-branches', schoolId],
    queryFn: () => branchesAPI.getBranches(schoolId!),
    enabled: !!schoolId,
  });
  const branchName = (id: string | null | undefined) =>
    branches.find((b) => b.id === id)?.name;
  const hasBranches = branches.length > 0;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('active');
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<any>(null);
  const [editingStaff, setEditingStaff] = useState<any>(null);

  const filteredStaff = staff.filter(member =>
    activeTab === null ? true
    : activeTab === 'active' ? member.status === 'active'
    : member.status !== 'active'
  );

  const staffCounts = {
    active: staff.filter(m => m.status === 'active').length,
    inactive: staff.filter(m => m.status !== 'active').length,
  };

  const handleToggleStatus = (member: any) => {
    updateStaff({
      id: member.id,
      full_name: member.full_name,
      email: member.email,
      phone: member.phone,
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

  const handleOpenEdit = (member: any) => {
    setEditingStaff(member);
    setDialogOpen(true);
  };

  // Devuelve la promesa para que el modal solo se cierre si el guardado funcionó.
  const handleFormSubmit = (data: any) =>
    editingStaff
      ? updateStaffAsync({ id: editingStaff.id, ...data })
      : createStaffAsync(data);

  if (isLoading) {
    return <LoadingSpinner text="Cargando personal..." />;
  }

  if (staff.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Entrenadores</h1>
            <p className="text-muted-foreground">Gestión de personal y asignaciones</p>
          </div>
        </div>

        <EmptyState
          icon={Users}
          title="Tu academia necesita entrenadores"
          description="Agrega a los entrenadores y staff técnico de tu academia para gestionar sus asignaciones y programas."
          actionLabel="+ Contratar Entrenador"
          onAction={() => setDialogOpen(true)}
        />

        <StaffFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleFormSubmit}
          isLoading={isSaving}
          branches={branches}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Entrenadores</h1>
          <p className="text-muted-foreground">
            {staff.length} entrenador{staff.length !== 1 ? 'es' : ''} registrado{staff.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => { setEditingStaff(null); setDialogOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" />
            Contratar Entrenador
          </Button>
        </div>
      </div>

      {/* Las pestañas Activos/Inactivos pasaron a tarjetas, para que el conteo
          de cada estado se vea sin tener que cambiar de pestaña. */}
      <StatFilterBar
        columns={3}
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { key: null, label: 'Todos', value: staff.length, tone: 'neutral' },
          { key: 'active', label: 'Activos', value: staffCounts.active, tone: 'emerald' },
          { key: 'inactive', label: 'Inactivos', value: staffCounts.inactive, tone: 'rose' },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === 'active' ? 'Personal Activo' : activeTab === 'inactive' ? 'Personal Inactivo' : 'Todo el Personal'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Especialidad</TableHead>
                {hasBranches && <TableHead>Sede</TableHead>}
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasBranches ? 7 : 6} className="text-center py-8 text-muted-foreground">
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
                      <div className="flex flex-wrap items-center gap-1">
                        {member.sports?.length ? (
                          member.sports.map((sport: string) => (
                            <Badge key={sport} variant="secondary">{sport}</Badge>
                          ))
                        ) : (
                          <Badge variant="secondary">{member.specialty || 'Sin asignar'}</Badge>
                        )}
                        {member.taught_levels?.length > 0 && (
                          <Badge variant="outline" className="font-normal">
                            Nivel {member.taught_levels.slice().sort().join(', ')}
                          </Badge>
                        )}
                        {/* Las certificaciones se pueden capturar al contratar; sin esto
                            quedarían escritas y nunca visibles. */}
                        {member.certifications?.slice(0, 2).map((cert) => (
                          <Badge key={cert} variant="outline" className="font-normal">{cert}</Badge>
                        ))}
                        {(member.certifications?.length || 0) > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{(member.certifications?.length || 0) - 2}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {hasBranches && (
                      <TableCell className="text-muted-foreground">
                        {branchName(member.branch_id) || 'Sin sede'}
                      </TableCell>
                    )}
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
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleOpenEdit(member)}
                          title="Editar información"
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        >
                          <Pencil className="h-4 w-4" />
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
          <TableRefreshBar
            className="-mx-6 -mb-6 mt-2 rounded-b-lg"
            onRefresh={refetch}
            loading={isFetching}
            summary={
              filteredStaff.length === staff.length
                ? `${staff.length} persona(s)`
                : `${filteredStaff.length} de ${staff.length} persona(s)`
            }
          />
        </CardContent>
      </Card>

      <StaffFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleFormSubmit}
        isLoading={isSaving}
        initialData={editingStaff}
        branches={branches}
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
