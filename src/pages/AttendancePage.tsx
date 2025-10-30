import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [justifyDialogOpen, setJustifyDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [justificationReason, setJustificationReason] = useState('');

  const { data: children } = useQuery({
    queryKey: ['children', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: attendance, isLoading, error, refetch } = useQuery({
    queryKey: ['attendance', selectedChildId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*, children(full_name)')
        .eq('child_id', selectedChildId)
        .order('class_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedChildId,
  });

  const justifyMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from('attendance')
        .update({
          status: 'justified',
          justification_reason: reason,
          justified_by: user?.id,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', selectedChildId] });
      toast({
        title: 'Ausencia justificada',
        description: 'La ausencia ha sido registrada correctamente',
      });
      setJustifyDialogOpen(false);
      setJustificationReason('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo justificar la ausencia',
        variant: 'destructive',
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'attended':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'justified':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'absent':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'attended':
        return 'Asistió';
      case 'justified':
        return 'Justificada';
      case 'absent':
        return 'Faltó';
      default:
        return status;
    }
  };

  const stats = attendance
    ? {
        total: attendance.length,
        attended: attendance.filter((a) => a.status === 'attended').length,
        justified: attendance.filter((a) => a.status === 'justified').length,
        absent: attendance.filter((a) => a.status === 'absent').length,
      }
    : null;

  if (isLoading && selectedChildId) {
    return <LoadingSpinner fullScreen text="Cargando asistencias..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Asistencias</h1>
        <p className="text-muted-foreground mt-1">
          Controla la asistencia de tus hijos a sus clases deportivas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Seleccionar Hijo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedChildId} onValueChange={setSelectedChildId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un hijo para ver sus asistencias" />
            </SelectTrigger>
            <SelectContent>
              {children?.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedChildId && stats && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Clases Totales</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">{stats.attended}</p>
                  <p className="text-sm text-muted-foreground">Asistencias</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">{stats.justified}</p>
                  <p className="text-sm text-muted-foreground">Justificadas</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500">{stats.absent}</p>
                  <p className="text-sm text-muted-foreground">Ausencias</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <CardTitle>Historial de Asistencias</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendance?.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(record.status)}
                      <div>
                        <p className="font-medium">
                          {new Date(record.class_date).toLocaleDateString('es-CO', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        {record.justification_reason && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Motivo: {record.justification_reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          record.status === 'attended'
                            ? 'default'
                            : record.status === 'justified'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {getStatusLabel(record.status)}
                      </Badge>
                      {record.status === 'absent' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAttendance(record);
                            setJustifyDialogOpen(true);
                          }}
                        >
                          Justificar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedChildId && children && children.length > 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Selecciona un hijo</h3>
            <p className="text-muted-foreground">
              Elige un hijo del menú superior para ver sus asistencias
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <ErrorState
          title="Error al cargar"
          message="No pudimos cargar las asistencias"
          onRetry={refetch}
        />
      )}

      <Dialog open={justifyDialogOpen} onOpenChange={setJustifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificar Ausencia</DialogTitle>
            <DialogDescription>
              Indica el motivo de la ausencia para notificar a la academia
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo</Label>
              <Textarea
                value={justificationReason}
                onChange={(e) => setJustificationReason(e.target.value)}
                placeholder="Ej: Cita médica, Viaje familiar, Enfermedad..."
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setJustifyDialogOpen(false);
                setJustificationReason('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedAttendance) {
                  justifyMutation.mutate({
                    id: selectedAttendance.id,
                    reason: justificationReason,
                  });
                }
              }}
              disabled={!justificationReason.trim()}
            >
              Justificar Ausencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
