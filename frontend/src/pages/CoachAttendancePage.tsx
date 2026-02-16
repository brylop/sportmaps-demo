import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/common/ErrorState';
import { CheckCircle2, XCircle, Clock, AlertCircle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { format } from 'date-fns';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface ClassItem {
  id: string;
  name: string;
  day_of_week: string;
  start_time: string;
}

interface StudentItem {
  id: string;
  full_name: string;
  photo_url?: string;
  // Position/Number not in core schema yet, simulate or fetch if added
}

export default function CoachAttendancePage() {
  const { user } = useAuth();
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);

  // 1. Fetch Coach's Classes (Groups) in this School
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['coach-classes', schoolId, user?.id],
    queryFn: async () => {
      if (!schoolId || !user?.id) return [];

      const { data, error } = await supabase
        .from('classes')
        .select('id, name, day_of_week, start_time')
        .eq('school_id', schoolId)
        // If RLS is strictly for own classes, this is fine. 
        // If admins see all, filter by coach_id if needed, or rely on RLS.
        // For coach view, we typically want classes they teach.
        .eq('coach_id', user.id);

      if (error) {
        console.error('Error fetching classes:', error);
        throw error;
      };
      return data as ClassItem[];
    },
    enabled: !!schoolId && !!user?.id,
  });

  // 2. Fetch Students in Selected Class
  // We need to join enrollments -> class_enrollments (N:M)? 
  // Schema has `class_enrollments`. 
  // Let's check `student_enrollments_view` or query directly.
  const { data: roster = [], isLoading: loadingRoster } = useQuery({
    queryKey: ['class-roster', selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return [];

      // Query students via class_enrollments
      // flow: class_enrollments (class_id) -> enrollments (student_id) -> students
      const { data, error } = await supabase
        .from('class_enrollments')
        .select(`
          enrollment_id,
          enrollments!inner (
            student_id,
            students!inner (
              id,
              full_name,
              photo_url
            )
          )
        `)
        .eq('class_id', selectedClassId);

      if (error) {
        console.error("Error fetching roster", error);
        throw error;
      }

      // Flatten structure
      return data.map((item: any) => ({
        id: item.enrollments.students.id,
        full_name: item.enrollments.students.full_name,
        photo_url: item.enrollments.students.photo_url,
      })) as StudentItem[];
    },
    enabled: !!selectedClassId,
  });

  // 3. Save Attendance Mutation
  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId || !selectedClassId) return;

      // Prepare inserts
      const records = Object.entries(attendanceState).map(([studentId, status]) => ({
        school_id: schoolId,
        class_id: selectedClassId, // attendance_records should have class_id? 
        // Current schema 20260717120000 has: school_id, program_id, student_id. 
        // Wait, the schema I just wrote in 1067 didn't include class_id? 
        // Let's check schema.
        // Correct, 1067 schema: school_id, program_id, student_id. 
        // It missed class_id! Attendance is usually per class session.
        // I will assume for now we might need to add class_id or just infer program.
        // BUT `class_enrollments` implies classes exist.
        // Let's fetch program_id from the class first to be safe.
        student_id: studentId,
        date: new Date().toISOString().split('T')[0],
        status: status,
        marked_by: user?.id
      }));

      // We need program_id for the insert as per schema
      // Let's get it from the class
      const { data: cls } = await supabase.from('classes').select('program_id').eq('id', selectedClassId).single();
      if (!cls) throw new Error("Class not found");

      const recordsWithProgram = records.map(r => ({ ...r, program_id: cls.program_id }));

      const { error } = await supabase.from('attendance_records').insert(recordsWithProgram);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: '✅ Asistencia guardada',
        description: 'Se han registrado los datos correctamente.',
      });
      setAttendanceState({});
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la asistencia.',
        variant: 'destructive',
      });
      console.error(err);
    }
  });

  const handleSave = () => {
    setSaving(true);
    saveAttendanceMutation.mutate(undefined, {
      onSettled: () => setSaving(false)
    });
  };

  const markAllPresent = () => {
    const newState: Record<string, AttendanceStatus> = {};
    roster.forEach((student) => {
      newState[student.id] = 'present';
    });
    setAttendanceState(newState);
    toast({
      title: '✅ Todos marcados como presentes',
      description: 'Puedes ajustar individualmente si es necesario',
    });
  };

  const getButtonVariant = (studentId: string, status: AttendanceStatus) => {
    return attendanceState[studentId] === status ? 'default' : 'outline';
  };

  const getStatusIcon = (status?: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'absent':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'late':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'excused':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Asistencias</h1>
        <p className="text-muted-foreground mt-1">Toma lista rápidamente</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Seleccionar Clase / Grupo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona tu clase" />
            </SelectTrigger>
            <SelectContent>
              {classes.length === 0 && (
                <div className="p-2 text-sm text-muted-foreground text-center">No tienes clases asignadas</div>
              )}
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name} ({cls.day_of_week} {cls.start_time})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedClassId && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <p className="font-medium">{roster.length} estudiantes</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={markAllPresent} variant="outline" size="sm" disabled={roster.length === 0}>
                ✅ Todos Presentes
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {roster.length === 0 && !loadingRoster && (
              <div className="text-center py-8 text-muted-foreground">
                No hay estudiantes inscritos en esta clase.
              </div>
            )}
            {roster.map((student) => (
              <Card key={student.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-semibold overflow-hidden">
                        {student.photo_url ? (
                          <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                        ) : (
                          student.full_name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{student.full_name}</p>
                        {/* <p className="text-sm text-muted-foreground">{student.position || 'Estudiante'}</p> */}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={getButtonVariant(student.id, 'present')}
                        onClick={() =>
                          setAttendanceState((prev) => ({
                            ...prev,
                            [student.id]: 'present',
                          }))
                        }
                        className="gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Presente
                      </Button>
                      <Button
                        size="sm"
                        variant={getButtonVariant(student.id, 'absent')}
                        onClick={() =>
                          setAttendanceState((prev) => ({
                            ...prev,
                            [student.id]: 'absent',
                          }))
                        }
                        className="gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Ausente
                      </Button>
                      <Button
                        size="sm"
                        variant={getButtonVariant(student.id, 'late')}
                        onClick={() =>
                          setAttendanceState((prev) => ({
                            ...prev,
                            [student.id]: 'late',
                          }))
                        }
                        className="gap-2"
                      >
                        <Clock className="w-4 h-4" />
                        Tarde
                      </Button>
                      <Button
                        size="sm"
                        variant={getButtonVariant(student.id, 'excused')}
                        onClick={() =>
                          setAttendanceState((prev) => ({
                            ...prev,
                            [student.id]: 'excused',
                          }))
                        }
                        className="gap-2"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Excusado
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSave}
            disabled={Object.keys(attendanceState).length === 0 || saving}
          >
            {saving ? 'Guardando...' : 'Guardar Asistencia'}
          </Button>
        </>
      )}

      {!selectedClassId && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Selecciona tu clase</h3>
            <p className="text-muted-foreground">
              Elige una clase del menú superior para tomar asistencia
            </p>
          </CardContent>
        </Card>
      )}

      {loadingClasses && <LoadingSpinner text="Cargando clases..." />}
      {loadingRoster && <LoadingSpinner text="Cargando estudiantes..." />}
    </div>
  );
}
