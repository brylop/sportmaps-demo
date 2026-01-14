<<<<<<< HEAD
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
=======
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ArrowLeft, Calendar, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

export default function ChildAttendancePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDemoUser = user?.email?.endsWith('@demo.sportmaps.com');

  // Fetch child info
  const { data: child, isLoading: loadingChild } = useQuery({
    queryKey: ['child', id],
    queryFn: async () => {
      if (id?.startsWith('demo-')) {
        return {
          id,
          full_name: id === 'demo-1' ? 'Mateo Pérez' : 'Sofía Pérez',
          sport: id === 'demo-1' ? 'Fútbol' : 'Tenis',
          team_name: id === 'demo-1' ? 'Fútbol Sub-12' : 'Tenis Infantil',
        };
      }
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('id', id)
        .eq('parent_id', user?.id)
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
        .single();
      if (error) throw error;
      return data;
    },
<<<<<<< HEAD
  });

  const { data: attendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('child_id', childId)
=======
    enabled: !!id && !!user?.id,
  });

  // Fetch attendance records
  const { data: attendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance', id],
    queryFn: async () => {
      if (id?.startsWith('demo-') || isDemoUser) {
        // Return demo attendance
        const today = new Date();
        return [
          { id: '1', class_date: new Date(today.setDate(today.getDate() - 1)).toISOString().split('T')[0], status: 'present' },
          { id: '2', class_date: new Date(today.setDate(today.getDate() - 2)).toISOString().split('T')[0], status: 'present' },
          { id: '3', class_date: new Date(today.setDate(today.getDate() - 2)).toISOString().split('T')[0], status: 'absent', justification_reason: 'Cita médica' },
          { id: '4', class_date: new Date(today.setDate(today.getDate() - 2)).toISOString().split('T')[0], status: 'present' },
          { id: '5', class_date: new Date(today.setDate(today.getDate() - 2)).toISOString().split('T')[0], status: 'late' },
          { id: '6', class_date: new Date(today.setDate(today.getDate() - 2)).toISOString().split('T')[0], status: 'present' },
          { id: '7', class_date: new Date(today.setDate(today.getDate() - 2)).toISOString().split('T')[0], status: 'present' },
          { id: '8', class_date: new Date(today.setDate(today.getDate() - 2)).toISOString().split('T')[0], status: 'absent' },
          { id: '9', class_date: new Date(today.setDate(today.getDate() - 2)).toISOString().split('T')[0], status: 'present' },
          { id: '10', class_date: new Date(today.setDate(today.getDate() - 2)).toISOString().split('T')[0], status: 'present' },
        ];
      }
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('child_id', id)
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
        .order('class_date', { ascending: false });
      if (error) throw error;
      return data;
    },
<<<<<<< HEAD
  });

=======
    enabled: !!id,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'absent':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'late':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-500">Presente</Badge>;
      case 'absent':
        return <Badge variant="destructive">Ausente</Badge>;
      case 'late':
        return <Badge className="bg-yellow-500">Tardanza</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const stats = {
    total: attendance?.length || 0,
    present: attendance?.filter(a => a.status === 'present').length || 0,
    absent: attendance?.filter(a => a.status === 'absent').length || 0,
    late: attendance?.filter(a => a.status === 'late').length || 0,
  };

  const attendanceRate = stats.total > 0 
    ? Math.round((stats.present / stats.total) * 100) 
    : 0;

>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
  if (loadingChild || loadingAttendance) {
    return <LoadingSpinner fullScreen text="Cargando asistencias..." />;
  }

<<<<<<< HEAD
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
=======
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/children')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-poppins">Asistencias de {child?.full_name}</h1>
          <p className="text-muted-foreground mt-1">
            {child?.sport} - {child?.team_name}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Tasa de Asistencia</p>
              <p className="text-4xl font-bold font-poppins text-primary">{attendanceRate}%</p>
            </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
          </CardContent>
        </Card>

        <Card>
<<<<<<< HEAD
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Clases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
=======
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Presentes</p>
                <p className="text-2xl font-bold font-poppins">{stats.present}</p>
              </div>
            </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
          </CardContent>
        </Card>

        <Card>
<<<<<<< HEAD
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Presentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.present}</div>
=======
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Ausencias</p>
                <p className="text-2xl font-bold font-poppins">{stats.absent}</p>
              </div>
            </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
          </CardContent>
        </Card>

        <Card>
<<<<<<< HEAD
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ausencias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{stats.absent}</div>
=======
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tardanzas</p>
                <p className="text-2xl font-bold font-poppins">{stats.late}</p>
              </div>
            </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
          </CardContent>
        </Card>
      </div>

<<<<<<< HEAD
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
=======
      {/* Attendance List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-poppins">
            <Calendar className="h-5 w-5 text-primary" />
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            Historial de Asistencias
          </CardTitle>
        </CardHeader>
        <CardContent>
<<<<<<< HEAD
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
=======
          <div className="space-y-3">
            {attendance?.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(record.status)}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
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
<<<<<<< HEAD
                      <p className="text-sm text-muted-foreground mt-1">
=======
                      <p className="text-sm text-muted-foreground">
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                        Justificación: {record.justification_reason}
                      </p>
                    )}
                  </div>
<<<<<<< HEAD
                  {getStatusBadge(record.status)}
                </div>
              ))}
            </div>
          )}
=======
                </div>
                {getStatusBadge(record.status)}
              </div>
            ))}

            {(!attendance || attendance.length === 0) && (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay registros de asistencia</p>
              </div>
            )}
          </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
        </CardContent>
      </Card>
    </div>
  );
}
