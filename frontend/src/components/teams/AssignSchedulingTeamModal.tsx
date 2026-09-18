import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users2 } from 'lucide-react';

interface AssignSchedulingTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string | null;
  studentName: string;
  schoolId: string;
  onSuccess?: () => void;
}

const NONE_VALUE = '__none__';

// Piloto "agendar por equipo" (Dreamers, Academia Superior Bogotá): esto NO
// cambia el cobro del atleta (sigue siendo por su offering_plan_id) — solo
// dice de qué equipo sale el horario que ve al momento de agendar.
export function AssignSchedulingTeamModal({
  open, onOpenChange, enrollmentId, studentName, schoolId, onSuccess,
}: AssignSchedulingTeamModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<string>(NONE_VALUE);

  const { data: currentEnrollment } = useQuery({
    queryKey: ['enrollment-scheduling-team', enrollmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('scheduling_team_id')
        .eq('id', enrollmentId as string)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!enrollmentId,
  });

  useEffect(() => {
    setSelectedTeamId(currentEnrollment?.scheduling_team_id ?? NONE_VALUE);
  }, [currentEnrollment, enrollmentId, open]);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams-for-scheduling-assignment', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, sport')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!schoolId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!enrollmentId) throw new Error('missing_enrollment_id');
      return bffClient.patch(`/api/v1/enrollments/${enrollmentId}`, {
        scheduling_team_id: selectedTeamId === NONE_VALUE ? null : selectedTeamId,
      });
    },
    onSuccess: () => {
      toast({ title: '✅ Equipo de agendamiento actualizado' });
      queryClient.invalidateQueries({ queryKey: ['school-students'] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.body?.error || error?.message || 'No se pudo actualizar.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users2 className="h-5 w-5 text-primary" />
            Equipo de agendamiento
          </DialogTitle>
          <DialogDescription className="text-xs">
            {studentName} sigue cobrando por su plan/tarifa — esto solo decide de qué equipo sale el horario que ve al agendar clases.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-sm font-medium">Equipo</Label>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar equipo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Ninguno (agendar por el plan, como hoy)</SelectItem>
              {teams.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}{t.sport ? ` · ${t.sport}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !enrollmentId} size="sm">
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
