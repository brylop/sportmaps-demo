import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function ChildAttendancePage() {
  const { childId } = useParams<{ childId: string }>();

  const { data: child, isLoading: loadingChild } = useQuery({
    queryKey: ['child', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('id', childId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: attendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('child_id', childId)
        .order('class_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loadingChild || loadingAttendance) {
    return <LoadingSpinner fullScreen text="Cargando asistencias..." />;
  }

  if (!child) {
    return <ErrorState message="Hijo no encontrado" />;
  }

  const getStatusBadge = (status: string) => {
    const configs = {
      present: { icon: CheckCircle, variant: 'default' as const, label: 'Presente', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
      absent: { icon: XCircle, variant: 'destructive' as const, label: 'Ausente', className: '' },
      late: { icon: AlertCircle, variant: 'secondary' as const, label: 'Retardo', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
      justified: { icon: CheckCircle, variant: 'secondary' as const, label: 'Justificado', className: '' },
    };

    const config = configs[status as keyof typeof configs] || configs.absent;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const stats = {
    total: attendance?.length || 0,
    present: attendance?.filter((a) => a.status === 'present').length || 0,
    absent: attendance?.filter((a) => a.status === 'absent').length || 0,
    late: attendance?.filter((a) => a.status === 'late').length || 0,
  };

  const attendanceRate = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Asistencias de {child.full_name}</h1>
        <p className="text-muted-foreground mt-1">
          Historial de asistencia a clases y entrenamientos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasa de Asistencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{attendanceRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Clases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Presentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.present}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ausencias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{stats.absent}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de Asistencias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!attendance || attendance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay registros de asistencia disponibles
            </div>
          ) : (
            <div className="space-y-3">
              {attendance.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
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
                        Justificación: {record.justification_reason}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(record.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
