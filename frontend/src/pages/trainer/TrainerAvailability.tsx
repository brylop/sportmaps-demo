import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvailabilityManager } from '@/components/school/AvailabilityManager';
import CoachAttendancePage from '@/pages/CoachAttendancePage';
import { useTrainerContext } from '@/hooks/useTrainerContext';
import { useCoachStaffId } from '@/hooks/useCoachStaffId';
import { Loader2 } from 'lucide-react';

export default function TrainerAvailability() {
  const { trainerSchoolId } = useTrainerContext();
  const { staffId, isLoading } = useCoachStaffId();

  if (!trainerSchoolId || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Disponibilidad</h1>
        <p className="text-muted-foreground text-sm">
          Gestiona tus sesiones del día y configura tus horarios disponibles.
        </p>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="sessions">Mis Sesiones</TabsTrigger>
          <TabsTrigger value="config">Configurar Horarios</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4">
          <CoachAttendancePage showPlanSessions={false} />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          {staffId ? (
            <AvailabilityManager
              coachId={staffId}
              schoolId={trainerSchoolId}
            />
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
              No se encontró tu perfil de entrenador. Contacta soporte.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
