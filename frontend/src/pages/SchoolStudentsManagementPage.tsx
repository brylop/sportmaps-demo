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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { UserPlus, User, Mail, FileText, Upload, FileUp, Search, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CSVImportModal } from '@/components/students/CSVImportModal';
import { useSchoolContext, createStudentWithPendingPayment } from '@/hooks/useSchoolContext';
import { studentsAPI, StudentViewRow } from '@/lib/api/students';

const studentSchema = z.object({
  full_name: z.string().min(2, 'Nombre completo es requerido').max(100),
  date_of_birth: z.string().min(1, 'Fecha de nacimiento es requerida'),
  parent_email: z.string().email('Email inválido').max(255),
  parent_phone: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').max(20),
  program_id: z.string().min(1, 'Selecciona un programa'),
  monthly_fee: z.coerce.number().min(10000, 'Mínimo $10.000 COP'),
  medical_info: z.string().max(1000).optional(),
  notes: z.string().max(500).optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

export default function SchoolStudentsManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingStudent, setViewingStudent] = useState<any | null>(null);

  // Resolve school context (school_id, programs, fees)
  const { schoolId, schoolName, programs, defaultMonthlyFee, loading: schoolLoading } = useSchoolContext();

  // Real data from Supabase View
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['school-students', schoolId],
    queryFn: () => schoolId ? studentsAPI.getSchoolView(schoolId) : Promise.resolve([]),
    enabled: !!schoolId,
  });

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema) as any,
    defaultValues: {
      full_name: '',
      date_of_birth: '',
      parent_email: '',
      parent_phone: '',
      program_id: '',
      monthly_fee: Number(defaultMonthlyFee) || 0,
      medical_info: '',
      notes: '',
    },
  });

  const createStudentMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      const selectedProgram = programs.find(p => p.id === data.program_id);

      // Try to persist in Supabase
      if (schoolId) {
        const result = await createStudentWithPendingPayment({
          fullName: data.full_name,
          dateOfBirth: data.date_of_birth,
          parentEmail: data.parent_email,
          parentPhone: data.parent_phone,
          parentName: data.parent_email.split('@')[0],
          schoolId,
          programId: data.program_id,
          programName: selectedProgram?.name || 'Programa',
          monthlyFee: data.monthly_fee,
          medicalInfo: data.medical_info,
          notes: data.notes,
        });

        if (result.success) {
          toast({
            title: '✅ Estudiante registrado',
            description: `${data.full_name} asociado a ${schoolName} con mensualidad de $${data.monthly_fee.toLocaleString('es-CO')} COP`,
          });
        }
      }

      // Local state update removed - relying on React Query invalidation
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

  // Update monthly_fee when program changes
  const handleProgramChange = (programId: string) => {
    form.setValue('program_id', programId);
    const selectedProgram = programs.find(p => p.id === programId);
    if (selectedProgram) {
      form.setValue('monthly_fee', selectedProgram.monthly_fee);
    }
  };



  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.parent_name && student.parent_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

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

  if (isLoading || schoolLoading) {
    return <LoadingSpinner fullScreen text="Cargando estudiantes..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Estudiantes</h1>
          <p className="text-muted-foreground mt-1">
            {filteredStudents.length} estudiante{filteredStudents.length !== 1 ? 's' : ''} registrado{filteredStudents.length !== 1 ? 's' : ''} en <strong>{schoolName}</strong>
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
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por nombre o acudiente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No hay estudiantes"
              description="Agrega estudiantes manualmente o importa desde un archivo CSV"
              actionLabel="+ Agregar Estudiante"
              onAction={() => setDialogOpen(true)}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Edad</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead>Acudiente</TableHead>
                  <TableHead>Mensualidad</TableHead>
                  <TableHead>Estado Pago</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.full_name}</TableCell>
                    <TableCell>{calculateAge(student.date_of_birth)} años</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{student.program_name || 'Sin programa'}</Badge>
                    </TableCell>
                    <TableCell>{student.parent_name || '-'}</TableCell>
                    <TableCell className="font-semibold text-primary">
                      {student.price_monthly ? formatCurrency(student.price_monthly) : '-'}
                    </TableCell>
                    <TableCell>{getPaymentBadge(student.enrollment_status === 'active' ? 'paid' : 'pending')}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingStudent(student)}
                      >
                        Ver Perfil
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog for adding student */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Estudiante</DialogTitle>
            <DialogDescription>
              Registra la información del estudiante. Quedará asociado a <strong>{schoolName}</strong>.
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

            {/* Program & Fee Section */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Programa y Mensualidad
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="program_id">Programa *</Label>
                  <Select
                    value={form.watch('program_id')}
                    onValueChange={handleProgramChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar programa" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map(program => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name} — {formatCurrency(program.monthly_fee)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.program_id && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.program_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly_fee">Mensualidad (COP) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="monthly_fee"
                      type="number"
                      className="pl-9"
                      placeholder="150000"
                      {...form.register('monthly_fee')}
                    />
                  </div>
                  {form.formState.errors.monthly_fee && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.monthly_fee.message}
                    </p>
                  )}
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

      {/* Student Details Dialog */}
      <Dialog open={!!viewingStudent} onOpenChange={(open) => !open && setViewingStudent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Perfil del Estudiante</DialogTitle>
            <DialogDescription>Detalles académicos y de contacto</DialogDescription>
          </DialogHeader>
          {viewingStudent && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground uppercase">
                  {viewingStudent.full_name.substring(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{viewingStudent.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{calculateAge(viewingStudent.date_of_birth)} años</p>
                  {getPaymentBadge(viewingStudent.enrollment_status === 'active' ? 'paid' : 'pending')}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <span className="text-sm font-medium">Escuela:</span>
                  <span className="text-sm">{schoolName}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <span className="text-sm font-medium">Programa:</span>
                  <span className="text-sm">{viewingStudent.program_name || '-'}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <span className="text-sm font-medium">Mensualidad:</span>
                  <span className="text-sm font-bold text-primary">
                    {viewingStudent.price_monthly ? formatCurrency(viewingStudent.price_monthly) : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <span className="text-sm font-medium">Acudiente:</span>
                  <span className="text-sm">{viewingStudent.parent_name || '-'}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <span className="text-sm font-medium">Teléfono:</span>
                  <span className="text-sm">{viewingStudent.parent_phone || '-'}</span>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setViewingStudent(null)}>Cerrar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <CSVImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          toast({ title: "Importación completada", description: "La lista de estudiantes se ha actualizado." });
          queryClient.invalidateQueries({ queryKey: ['school-students'] });
        }}
        schoolId={schoolId || 'demo-school'}
        schoolName={schoolName}
      />
    </div>
  );
}
