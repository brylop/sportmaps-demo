import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, MoreHorizontal, Mail, Phone, FileDown, Users } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { useToast } from '@/hooks/use-toast';

interface Student {
  enrollment_id: string;
  student_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  program_name: string;
  status: string;
  start_date: string;
}

export default function SchoolStudentsManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchStudents();
    }
  }, [user]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // 1. Obtener la escuela del usuario actual
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (schoolError) throw schoolError;

      // 2. Obtener inscripciones para los programas de esta escuela
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          start_date,
          user:profiles!enrollments_user_id_fkey (
            id,
            full_name,
            avatar_url,
            phone,
            email:id (email)
          ),
          program:programs!inner (
            name,
            school_id
          )
        `)
        .eq('program.school_id', schoolData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Mapear datos para facilitar uso en tabla
      const formattedStudents: Student[] = (data || []).map((item: any) => ({
        enrollment_id: item.id,
        student_id: item.user?.id,
        full_name: item.user?.full_name || 'Usuario Desconocido',
        email: 'user@example.com',
        phone: item.user?.phone,
        avatar_url: item.user?.avatar_url,
        program_name: item.program?.name,
        status: item.status,
        start_date: item.start_date,
      }));

      setStudents(formattedStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los estudiantes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.program_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner fullScreen text="Cargando estudiantes..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Estudiantes</h2>
          <p className="text-muted-foreground">
            Administra las inscripciones y datos de tus alumnos
          </p>
        </div>
        <Button variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Listado General</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o programa..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <EmptyState
              icon={Users} // <--- AQUÍ ESTABA EL ERROR, AHORA ESTÁ CORREGIDO
              title="No se encontraron estudiantes"
              description={searchTerm ? "Intenta con otra búsqueda" : "Aún no tienes inscripciones activas"}
              actionLabel={searchTerm ? "Limpiar búsqueda" : undefined}
              onAction={() => setSearchTerm('')}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead>Fecha Inicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.enrollment_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={student.avatar_url || undefined} />
                          <AvatarFallback>{student.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{student.full_name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            {student.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {student.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{student.program_name}</TableCell>
                    <TableCell>
                      {new Date(student.start_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          student.status === 'active' ? 'default' : 'secondary'
                        }
                      >
                        {student.status === 'active' ? 'Activo' : student.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(student.email)}>
                            Copiar Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Ver Perfil Completo</DropdownMenuItem>
                          <DropdownMenuItem>Enviar Mensaje</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            Cancelar Inscripción
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}