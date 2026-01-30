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
        .single();
      if (error) throw error;
      return data;
    },
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
        .order('class_date', { ascending: false });
      if (error) throw error;
      return data;
    },
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

  if (loadingChild || loadingAttendance) {
    return <LoadingSpinner fullScreen text="Cargando asistencias..." />;
  }

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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Presentes</p>
                <p className="text-2xl font-bold font-poppins">{stats.present}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Ausencias</p>
                <p className="text-2xl font-bold font-poppins">{stats.absent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tardanzas</p>
                <p className="text-2xl font-bold font-poppins">{stats.late}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-poppins">
            <Calendar className="h-5 w-5 text-primary" />
            Historial de Asistencias
          </CardTitle>
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
                      <p className="text-sm text-muted-foreground">
                        Justificación: {record.justification_reason}
                      </p>
                    )}
                  </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
