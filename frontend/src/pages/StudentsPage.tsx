import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Mail, FileUp, Loader2, RefreshCw, Share2 } from 'lucide-react';
import { CSVImportModal } from '@/components/students/CSVImportModal';
import { StudentTypeSelector } from '@/components/students/StudentTypeSelector';
import { CreateChildModal } from '@/components/students/CreateChildModal';
import { CreateAdultAthleteModal } from '@/components/students/CreateAdultAthleteModal';
import { useToast } from '@/hooks/use-toast';
import { studentsAPI, Student } from '@/lib/api/students';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { getUserFriendlyError } from '@/lib/error-translator';

import { EnrollStudentModal } from '@/components/enrollment/EnrollStudentModal';
import { MedicalAlertBadge } from '@/components/common/MedicalAlertBadge';

export default function StudentsPage() {
  const { profile } = useAuth();
  const { schoolId, schoolName } = useSchoolContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showCreateChildModal, setShowCreateChildModal] = useState(false);
  const [showCreateAdultModal, setShowCreateAdultModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Load students on mount and when school changes
  useEffect(() => {
    if (schoolId) {
      loadStudents();
    }
  }, [schoolId, profile]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      if (!schoolId) {
        setLoading(false);
        return;
      }

      // Para coaches: filtrar por sus equipos (legacy coach_id + junction table)
      let coachId: string | undefined;
      if (profile?.role === 'coach' && profile?.email) {
        const { data: staffData } = await supabase
          .from('school_staff')
          .select('id')
          .eq('email', profile.email)
          .eq('school_id', schoolId)
          .maybeSingle();
        if (staffData) {
          coachId = staffData.id;
        }
      }

      let data;
      if (coachId) {
        // Filtrar por equipos del coach via school_staff
        const [{ data: legacyTeams }, { data: junctionTeams }] = await Promise.all([
          supabase
            .from('teams')
            .select('id')
            .eq('school_id', schoolId)
            .eq('coach_id', coachId),
          supabase
            .from('team_coaches')
            .select('team_id')
            .eq('coach_id', coachId),
        ]);

        const teamIds = [...new Set([
          ...(legacyTeams || []).map(t => t.id),
          ...(junctionTeams || []).map(t => t.team_id),
        ])];

        const { data: athletes } = await supabase
          .from('school_athletes' as any)
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .in('enrolled_team_id', teamIds.length ? teamIds : ['']);

        data = athletes ?? [];
      } else {
        data = await studentsAPI.getSchoolView(schoolId);
      }
      // Map to Student type if needed or adjust state type
      setStudents(data as any as Student[]);
    } catch (error: any) {
      console.error('Error loading students:', error);
      toast({
        title: 'Error al cargar estudiantes',
        description: getUserFriendlyError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
    toast({
      title: 'Lista actualizada',
      description: 'Los estudiantes se han actualizado correctamente',
    });
  };

  const filteredStudents = students.filter((student: any) =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.parent_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (student.parent_email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">🟢 Activo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">⚪ Inactivo</Badge>;
      case 'suspended':
        return <Badge variant="destructive">🔴 Suspendido</Badge>;
      default:
        return null;
    }
  };

  const handleCSVImportSuccess = async () => {
    // Reload students after successful import
    await loadStudents();
    setShowImportModal(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando estudiantes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Estudiantes</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Base de datos completa de alumnos ({students.length})
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 md:flex-initial"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTypeSelector(true)}
            className="flex-1 md:flex-initial"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo Atleta
          </Button>
          <Button
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="flex-1 md:flex-initial"
          >
            <FileUp className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 md:flex-initial gap-2"
            onClick={() => {
              const inviteLink = `${window.location.origin}/register?ref=${profile?.id || 'demo_school'}`;
              navigator.clipboard.writeText(inviteLink);
              toast({
                title: "Enlace copiado",
                description: "Comparte este enlace con los padres para que se registren.",
              });
            }}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Invitar
          </Button>
          <Button
            size="sm"
            onClick={() => setShowEnrollModal(true)}
            variant="secondary"
            className="flex-1 md:flex-initial"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Inscribir en Clase
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-sm md:text-base">Total</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold">{students.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-sm md:text-base">Activos</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold text-green-600">
              {students.filter(s => s.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-sm md:text-base">Inactivos</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold text-gray-600">
              {students.filter(s => s.status === 'inactive').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-sm md:text-base">Suspendidos</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold text-red-600">
              {students.filter(s => s.status === 'suspended').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, padre o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'No se encontraron estudiantes con esa búsqueda' : 'No hay estudiantes registrados aún'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowImportModal(true)}>
                  <FileUp className="h-4 w-4 mr-2" />
                  Importar Estudiantes
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Nombre</TableHead>
                    <TableHead className="whitespace-nowrap hidden md:table-cell">Equipo(s)</TableHead>
                    <TableHead className="whitespace-nowrap hidden md:table-cell">Email</TableHead>
                    <TableHead className="whitespace-nowrap hidden lg:table-cell">Grado</TableHead>
                    <TableHead className="whitespace-nowrap">Padre/Madre</TableHead>
                    <TableHead className="whitespace-nowrap hidden md:table-cell">Teléfono</TableHead>
                    <TableHead className="whitespace-nowrap">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{student.full_name}</span>
                          <MedicalAlertBadge medicalInfo={student.medical_info} />
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {(student as any).program_name || (student as any).team_name || '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {student.email ? (
                          <a href={`mailto:${student.email}`} className="text-primary hover:underline flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {student.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {student.grade || '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {student.parent_name || '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap">
                        {student.parent_phone || student.phone || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(student.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de selección de tipo */}
      <StudentTypeSelector
        open={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelectChild={() => {
          setShowTypeSelector(false);
          setShowCreateChildModal(true);
        }}
        onSelectAdult={() => {
          setShowTypeSelector(false);
          setShowCreateAdultModal(true);
        }}
      />

      {/* Registro de Menor */}
      <CreateChildModal
        open={showCreateChildModal}
        onClose={() => setShowCreateChildModal(false)}
        onSuccess={loadStudents}
        schoolId={schoolId || ''}
      />

      {/* Registro de Adulto */}
      <CreateAdultAthleteModal
        open={showCreateAdultModal}
        onClose={() => setShowCreateAdultModal(false)}
        onSuccess={loadStudents}
        schoolId={schoolId || ''}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleCSVImportSuccess}
        schoolId={schoolId || ''}
        schoolName={schoolName || 'Tu Escuela'}
      />

      {/* Enroll Student Modal */}
      <EnrollStudentModal
        open={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        onSuccess={loadStudents}
        schoolId={schoolId || ''}
      />
    </div>
  );
}
