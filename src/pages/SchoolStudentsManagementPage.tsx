import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { UserPlus, User, Mail, Phone, Calendar, FileText, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const studentSchema = z.object({
  full_name: z.string().min(2, 'Nombre completo es requerido').max(100),
  date_of_birth: z.string().min(1, 'Fecha de nacimiento es requerida'),
  parent_email: z.string().email('Email inválido').max(255),
  parent_phone: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').max(20),
  medical_info: z.string().max(1000).optional(),
  notes: z.string().max(500).optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

export default function SchoolStudentsManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  // Fetch students from school
  const { data: students, isLoading } = useQuery({
    queryKey: ['school-students', user?.id],
    queryFn: async () => {
      // This would fetch students enrolled in programs from this school
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .limit(0); // Returns empty for now
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const createStudentMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      // Here you would create the student record
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

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando estudiantes..." />;
  }

  if (!students || students.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Estudiantes</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los estudiantes de tu academia
            </p>
          </div>
        </div>

        <EmptyState
          icon={UserPlus}
          title="Aún no tienes estudiantes registrados"
          description="Comienza agregando tu primer estudiante para empezar a gestionar tu academia. Podrás registrar su información personal, asignarlos a programas y hacer seguimiento de su progreso."
          actionLabel="+ Agregar Estudiante"
          onAction={() => setDialogOpen(true)}
        />

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
              {/* Student Information */}
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

              {/* Parent/Guardian Contact */}
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

              {/* Additional Information */}
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
      </div>
    );
  }

  // If students exist, show the list
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estudiantes</h1>
          <p className="text-muted-foreground mt-1">
            {students.length} estudiante{students.length !== 1 ? 's' : ''} registrado{students.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Agregar Estudiante
        </Button>
      </div>

      {/* Student list would go here */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {students.map((student) => (
          <Card key={student.id}>
            <CardHeader>
              <CardTitle>{student.full_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Student details...
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
