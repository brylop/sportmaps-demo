import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
          description="Crea tu primera instalación (cancha, piscina, gimnasio, etc.) para gestionar sus reservas y horarios."
          actionLabel="+ Agregar Instalación"
          onAction={() => setDialogOpen(true)}
        />

        <FacilityFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={createFacility}
          isLoading={isCreating}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            </div>
          </Card>
        ))}
      </div>

      {/* Calendar View */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Calendario de Reservas - Hoy</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium">Hora</th>
                  {facilities.map((facility) => (
                    <th key={facility.id} className="p-3 text-left font-medium">
                      {facility.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((slot, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{slot.time}</td>
                    {facilities.map((facility) => (
                      <td key={facility.id} className="p-3">
                        <Badge variant="outline" className="text-xs">
                          Libre
                        </Badge>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

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
