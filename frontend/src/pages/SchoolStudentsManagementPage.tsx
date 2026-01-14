<<<<<<< HEAD
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
=======
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { UserPlus, User, Mail, FileText, Upload, FileUp, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CSVImportModal } from '@/components/students/CSVImportModal';

const studentSchema = z.object({
  full_name: z.string().min(2, 'Nombre completo es requerido').max(100),
  date_of_birth: z.string().min(1, 'Fecha de nacimiento es requerida'),
  parent_email: z.string().email('Email inválido').max(255),
  parent_phone: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').max(20),
  medical_info: z.string().max(1000).optional(),
  notes: z.string().max(500).optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3

export default function SchoolStudentsManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
<<<<<<< HEAD
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
      // Usamos maybeSingle() para evitar el error 406 si no hay escuela aún
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .eq('owner_id', user?.id)
        .maybeSingle(); 

      if (schoolError) throw schoolError;

      if (!schoolData) {
        // Si no tiene escuela, no tiene estudiantes
        setStudents([]);
        return; 
      }

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
            phone
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
        email: 'usuario@email.com', // El email no siempre está en profile por seguridad, placeholder o join con auth
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
=======
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Local students state for demo + imported
  const [localStudents, setLocalStudents] = useState([
    { id: '1', full_name: 'Mateo Pérez', date_of_birth: '2013-05-15', parent_name: 'María González', phone: '+57 300 123 4567', paymentStatus: 'paid' },
    { id: '2', full_name: 'Sofía Pérez', date_of_birth: '2015-08-22', parent_name: 'María González', phone: '+57 300 123 4567', paymentStatus: 'paid' },
    { id: '3', full_name: 'Juan Vargas', date_of_birth: '2013-03-10', parent_name: 'Carlos Vargas', phone: '+57 310 234 5678', paymentStatus: 'overdue' },
    { id: '4', full_name: 'Camila Torres', date_of_birth: '2012-11-28', parent_name: 'Elena Torres', phone: '+57 320 345 6789', paymentStatus: 'pending' },
  ]);

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      full_name: '',
      date_of_birth: '',
      parent_email: '',
      parent_phone: '',
      medical_info: '',
      notes: '',
    },
  });

  // Fetch students from school (for future DB integration)
  const { isLoading } = useQuery({
    queryKey: ['school-students', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .limit(0);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const createStudentMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      // Add to local state
      const newStudent = {
        id: `new-${Date.now()}`,
        full_name: data.full_name,
        date_of_birth: data.date_of_birth,
        parent_name: data.parent_email.split('@')[0],
        phone: data.parent_phone,
        paymentStatus: 'pending',
      };
      setLocalStudents(prev => [...prev, newStudent]);
      
      toast({
        title: '✅ Estudiante agregado',
        description: `${data.full_name} ha sido registrado exitosamente`,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-students'] });
      setDialogOpen(false);
      form.reset();
    },
  });

  const onSubmit = (data: StudentFormData) => {
    createStudentMutation.mutate(data);
  };

  const handleCSVImport = (importedStudents: { name: string; parent: string; phone: string; monthlyFee: string }[]) => {
    const newStudents = importedStudents.map((s, index) => ({
      id: `imported-${Date.now()}-${index}`,
      full_name: s.name,
      date_of_birth: '2012-01-01',
      parent_name: s.parent,
      phone: s.phone,
      paymentStatus: 'pending' as const,
    }));

    setLocalStudents(prev => [...prev, ...newStudents]);
  };

  const filteredStudents = localStudents.filter(student =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.parent_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">🟢 Al día</Badge>;
      case 'overdue':
        return <Badge variant="destructive">🔴 Vencido</Badge>;
      case 'pending':
        return <Badge variant="secondary">🟡 Pendiente</Badge>;
      default:
        return null;
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando estudiantes..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Estudiantes</h1>
          <p className="text-muted-foreground mt-1">
            {filteredStudents.length} estudiante{filteredStudents.length !== 1 ? 's' : ''} registrado{filteredStudents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Agregar Estudiante
          </Button>
        </div>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
      </div>

      <Card>
        <CardHeader>
<<<<<<< HEAD
          <div className="flex items-center justify-between">
            <CardTitle>Listado General</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o programa..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
=======
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por nombre o acudiente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <EmptyState
<<<<<<< HEAD
              icon={Users}
              title="No se encontraron estudiantes"
              description={searchTerm ? "Intenta con otra búsqueda" : "Aún no tienes inscripciones activas"}
              actionLabel={searchTerm ? "Limpiar búsqueda" : undefined}
              onAction={() => setSearchTerm('')}
=======
              icon={UserPlus}
              title="No hay estudiantes"
              description="Agrega estudiantes manualmente o importa desde un archivo CSV"
              actionLabel="+ Agregar Estudiante"
              onAction={() => setDialogOpen(true)}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
<<<<<<< HEAD
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead>Fecha Inicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
=======
                  <TableHead>Nombre</TableHead>
                  <TableHead>Edad</TableHead>
                  <TableHead>Acudiente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Estado Pago</TableHead>
                  <TableHead>Acciones</TableHead>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
<<<<<<< HEAD
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
=======
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.full_name}</TableCell>
                    <TableCell>{calculateAge(student.date_of_birth)} años</TableCell>
                    <TableCell>{student.parent_name}</TableCell>
                    <TableCell>{student.phone}</TableCell>
                    <TableCell>{getPaymentBadge(student.paymentStatus)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Ver Perfil</Button>
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
<<<<<<< HEAD
    </div>
  );
}
=======

      {/* Dialog for adding student */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Estudiante</DialogTitle>
            <DialogDescription>
              Registra la información básica del estudiante y sus datos de contacto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                Información del Estudiante
              </h3>
              
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nombre Completo *</Label>
                  <Input
                    id="full_name"
                    placeholder="Ej: María Rodríguez Pérez"
                    {...form.register('full_name')}
                  />
                  {form.formState.errors.full_name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.full_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Fecha de Nacimiento *</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    {...form.register('date_of_birth')}
                  />
                  {form.formState.errors.date_of_birth && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.date_of_birth.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Foto de Perfil</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Sube una foto del estudiante
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="max-w-xs mx-auto"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Contacto del Padre/Tutor
              </h3>
              
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parent_email">Email del Padre/Tutor *</Label>
                  <Input
                    id="parent_email"
                    type="email"
                    placeholder="padre@ejemplo.com"
                    {...form.register('parent_email')}
                  />
                  {form.formState.errors.parent_email && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.parent_email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent_phone">Teléfono de Contacto *</Label>
                  <Input
                    id="parent_phone"
                    type="tel"
                    placeholder="+57 300 123 4567"
                    {...form.register('parent_phone')}
                  />
                  {form.formState.errors.parent_phone && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.parent_phone.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Información Adicional
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="medical_info">Información Médica (Alergias, Condiciones)</Label>
                <Textarea
                  id="medical_info"
                  placeholder="Ej: Alérgico a los frutos secos, asma leve..."
                  {...form.register('medical_info')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas Generales</Label>
                <Textarea
                  id="notes"
                  placeholder="Cualquier información relevante sobre el estudiante..."
                  {...form.register('notes')}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createStudentMutation.isPending}
              >
                {createStudentMutation.isPending ? 'Guardando...' : 'Agregar Estudiante'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <CSVImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleCSVImport}
      />
    </div>
  );
}
>>>>>>> 695a09708dac622318dbbb51a95d9e666a9ac0c3
