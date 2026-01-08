import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Mail, FileUp, Loader2, RefreshCw } from 'lucide-react';
import { CSVImportModal } from '@/components/students/CSVImportModal';
import { useToast } from '@/hooks/use-toast';
import { studentsAPI, Student } from '@/lib/api/students';

import { EnrollStudentModal } from '@/components/enrollment/EnrollStudentModal';

export default function StudentsPage() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Load students on mount
  useEffect(() => {
    loadStudents();
  }, [profile]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await studentsAPI.getStudents({
        school_id: profile?.id || 'demo-school',
        limit: 500
      });
      setStudents(data);
    } catch (error: any) {
      console.error('Error loading students:', error);
      toast({
        title: 'Error al cargar estudiantes',
        description: error.message || 'Por favor intenta de nuevo',
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

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.parent_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (student.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
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
            className="flex-1 md:flex-initial"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo Alumno
          </Button>
          <Button 
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="flex-1 md:flex-initial"
          >
            <FileUp className="h-4 w-4 mr-2" />
            Importar CSV
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
                        {student.full_name}
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

      {/* CSV Import Modal */}
      <CSVImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleCSVImportSuccess}
        schoolId={profile?.id || 'demo-school'}
      />
    </div>
  );
}
