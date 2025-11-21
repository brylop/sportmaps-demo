import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AttendanceRecord {
  id: string;
  child_id: string;
  class_date: string;
  status: 'attended' | 'absent' | 'justified';
  justification_reason?: string | null;
  justified_by?: string | null;
  children?: { full_name: string };
}

interface Child {
  id: string;
  full_name: string;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [justifyDialogOpen, setJustifyDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
  const [justificationReason, setJustificationReason] = useState('');

  // 1. Obtener lista de hijos
  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['children', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('children')
        .select('id, full_name')
        .eq('parent_id', user.id);
      
      if (error) throw error;
      return data as Child[];
    },
    enabled: !!user?.id,
  });

  // 2. Obtener asistencia del hijo seleccionado
  const { data: attendance, isLoading: attendanceLoading, error: attendanceError, refetch } = useQuery({
    queryKey: ['attendance', selectedChildId],
    queryFn: async () => {
      if (!selectedChildId) return [];
      
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          children ( full_name )
        `)
        .eq('child_id', selectedChildId)
        .order('class_date', { ascending: false });

      if (error) throw error;
      
      // FIX: Casteamos a 'any' primero para evitar el error de inferencia de TypeScript
      // cuando la relación no está explícitamente definida en los tipos generados.
      return (data as any) as AttendanceRecord[];
    },
    enabled: !!selectedChildId,
  });

  // 3. Mutación para justificar inasistencia
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
        description: 'La justificación ha sido registrada correctamente.',
      });
      setJustifyDialogOpen(false);
      setJustificationReason('');
      setSelectedAttendance(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo registrar la justificación.',
        variant: 'destructive',
      });
    },
  });

  // Helpers para UI
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'attended': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'justified': return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'absent': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'attended': return 'Asistió';
      case 'justified': return 'Justificada';
      case 'absent': return 'Faltó';
      default: return status;
    }
  };

  const stats = attendance ? {
    total: attendance.length,
    attended: attendance.filter((a) => a.status === 'attended').length,
    justified: attendance.filter((a) => a.status === 'justified').length,
    absent: attendance.filter((a) => a.status === 'absent').length,
  } : null;

  if (childrenLoading) {
    return <LoadingSpinner fullScreen text="Cargando hijos..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Asistencias</h1>
          <p className="text-muted-foreground mt-1">
            Controla la asistencia de tus hijos a sus actividades deportivas
          </p>
        </div>
        
        <div className="w-full md:w-64">
          <Select value={selectedChildId} onValueChange={setSelectedChildId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar hijo" />
            </SelectTrigger>
            <SelectContent>
              {children?.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedChildId ? (
        <EmptyState
          icon={User}
          title="Selecciona un hijo"
          description="Elige uno de tus hijos registrados para ver su historial de asistencias."
        />
      ) : attendanceError ? (
        <ErrorState
          title="Error al cargar"
          message="No pudimos cargar el historial de asistencias."
          onRetry={refetch}
        />
      ) : attendanceLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner text="Cargando asistencias..." />
        </div>
      ) : !attendance || attendance.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No hay registros"
          description="Aún no hay registros de asistencia para este hijo."
        />
      ) : (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Clases Totales</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">{stats.attended}</p>
                  <p className="text-sm text-muted-foreground">Asistencias</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-blue-600">{stats.justified}</p>
                  <p className="text-sm text-muted-foreground">Justificadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-red-600">{stats.absent}</p>
                  <p className="text-sm text-muted-foreground">Faltas</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Attendance List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Historial Detallado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {attendance.map((record) => (
                  <div
                    key={record.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">{getStatusIcon(record.status)}</div>
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
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            "{record.justification_reason}"
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <Badge
                        variant={
                          record.status === 'attended' ? 'default' : 
                          record.status === 'justified' ? 'secondary' : 
                          'destructive'
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

      {/* Justify Dialog */}
      <Dialog open={justifyDialogOpen} onOpenChange={setJustifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificar Ausencia</DialogTitle>
            <DialogDescription>
              Indica el motivo de la ausencia para notificar a la academia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <div className="p-2 bg-muted rounded-md text-sm">
                {selectedAttendance && new Date(selectedAttendance.class_date).toLocaleDateString('es-CO', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea
                id="reason"
                value={justificationReason}
                onChange={(e) => setJustificationReason(e.target.value)}
                placeholder="Ej: Cita médica, Enfermedad, Calamidad doméstica..."
                rows={3}
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
              disabled={!justificationReason.trim() || justifyMutation.isPending}
            >
              {justifyMutation.isPending ? 'Guardando...' : 'Enviar Justificación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}