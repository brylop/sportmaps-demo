import { useState, useEffect } from 'react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { UserPlus, User, Mail, FileText, Upload, FileUp, Search, DollarSign, Send, UserMinus, UserCheck, Edit, Loader2, CheckSquare, MoreVertical, Download, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CSVImportModal } from '@/components/students/CSVImportModal';
import { useSchoolContext, createStudentWithPendingPayment } from '@/hooks/useSchoolContext';
import { studentsAPI, StudentViewRow } from '@/lib/api/students';
import { MedicalAlertBadge } from '@/components/common/MedicalAlertBadge';
import { useNavigate } from 'react-router-dom';

const studentSchema = z.object({
  full_name: z.string().min(2, 'Nombre completo es requerido').max(100),
  date_of_birth: z.string().min(1, 'Fecha de nacimiento es requerida'),
  parent_email: z.string().email('Email inválido').max(255),
  parent_phone: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').max(20),
  program_id: z.string().min(1, 'Selecciona un programa'),
  monthly_fee: z.number().min(10000, 'Mínimo $10.000 COP'),
  medical_info: z.string().max(1000).optional(),
  notes: z.string().max(500).optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

export default function SchoolStudentsManagementPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingStudent, setViewingStudent] = useState<(StudentViewRow & { display_parent_name?: string | null, display_parent_phone?: string | null }) | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentViewRow | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentDocs, setStudentDocs] = useState<{ name: string; url: string }[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const { schoolId, schoolName, programs, branches, activeBranchId, defaultMonthlyFee, loading: schoolLoading } = useSchoolContext();

  // Para coaches: obtener coachId para filtrar solo sus estudiantes
  const [coachId, setCoachId] = useState<string | undefined>(undefined);
  const [coachIdResolved, setCoachIdResolved] = useState(false);
  useEffect(() => {
    if (profile?.role === 'coach' && profile?.email && schoolId) {
      supabase
        .from('school_staff')
        .select('id')
        .eq('email', profile.email)
        .eq('school_id', schoolId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setCoachId(data.id);
          setCoachIdResolved(true);
        });
    } else {
      setCoachIdResolved(true);
    }
  }, [profile?.role, profile?.email, schoolId]);

  useEffect(() => {
    if (!viewingStudent) { setStudentDocs([]); return; }
    const studentId = viewingStudent.id;
    setLoadingDocs(true);
    supabase.storage
      .from('identity-documents')
      .list(`children/${studentId}/docs`, { limit: 20 })
      .then(async ({ data: files, error }) => {
        if (error || !files) { setStudentDocs([]); return; }
        const docs = await Promise.all(
          files.map(async (f) => {
            const { data } = await supabase.storage
              .from('identity-documents')
              .createSignedUrl(`children/${studentId}/docs/${f.name}`, 300);
            return { name: f.name, url: data?.signedUrl || '' };
          })
        );
        setStudentDocs(docs.filter(d => d.url));
      })
      .finally(() => setLoadingDocs(false));
  }, [viewingStudent]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['school-students', schoolId, activeBranchId, coachId],
    queryFn: async () => {
      if (!schoolId) return [];
      let data;
      if (coachId) {
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
        data = await studentsAPI.getSchoolView(schoolId, activeBranchId);
      }
      return data as StudentViewRow[];
    },
    enabled: !!schoolId && coachIdResolved,
  });

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
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
      if (schoolId) {
        const result = await createStudentWithPendingPayment({
          fullName: data.full_name,
          dateOfBirth: data.date_of_birth,
          parentEmail: data.parent_email,
          parentPhone: data.parent_phone,
          parentName: data.parent_email.split('@')[0],
          schoolId,
          branchId: selectedProgram?.branch_id || activeBranchId || undefined,
          programId: data.program_id,
          programName: selectedProgram?.name || 'Programa',
          monthlyFee: data.monthly_fee,
          medicalInfo: data.medical_info,
          notes: data.notes,
        });
        if (result.success) {
          toast({
            title: '✅ Atleta registrado',
            description: `${data.full_name} asociado a ${schoolName} con mensualidad de $${data.monthly_fee.toLocaleString('es-CO')} COP`,
          });
        }
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-students'] });
      setDialogOpen(false);
      form.reset();
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      if (!editingStudent) return data;
      const selectedProgram = programs.find(p => p.id === data.program_id);
      await studentsAPI.updateStudent(editingStudent.id, {
        full_name: data.full_name,
        date_of_birth: data.date_of_birth,
        medical_info: data.medical_info,
        program_id: data.program_id,
        branch_id: selectedProgram?.branch_id || activeBranchId || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-students'] });
      setDialogOpen(false);
      setEditingStudent(null);
      toast({ title: '✅ Atleta actualizado' });
    }
  });

  const onSubmit = (data: StudentFormData) => {
    if (editingStudent) {
      updateStudentMutation.mutate(data);
    } else {
      createStudentMutation.mutate(data);
    }
  };

  const handleCreateStudent = () => {
    setEditingStudent(null);
    form.reset({
      full_name: '',
      date_of_birth: '',
      parent_email: '',
      parent_phone: '',
      program_id: '',
      monthly_fee: Number(defaultMonthlyFee) || 0,
      medical_info: '',
      notes: '',
    });
    setDialogOpen(true);
  };

  const handleEditStudent = (student: any) => {
    setEditingStudent(student);
    form.reset({
      full_name: student.full_name,
      date_of_birth: student.date_of_birth || '',
      parent_email: student.parent_email || '',
      parent_phone: student.parent_phone || '',
      program_id: student.program_id || '',
      monthly_fee: student.price_monthly || Number(defaultMonthlyFee) || 0,
      medical_info: student.medical_info || '',
      notes: student.notes || '',
    });
    setDialogOpen(true);
  };

  const bulkInviteMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const selectedStudents = students.filter(s => studentIds.includes(s.id));
      const results = { success: 0, failed: 0, skipped: 0 };
      for (const student of selectedStudents) {
        if (!student.parent_email) { results.skipped++; continue; }
        try {
          const { data: inviteId, error } = await (supabase.rpc as any)('create_invitation', {
            p_email: student.parent_email,
            p_role: 'parent',
            p_child_name: student.full_name,
            p_program_id: student.program_id || null,
            p_monthly_fee: student.price_monthly || Number(defaultMonthlyFee) || 0,
            p_parent_phone: student.parent_phone || null,
            p_branch_id: student.branch_id || activeBranchId || null
          });
          if (error) throw error;
          const registration_link = `${window.location.origin}/register?email=${encodeURIComponent(student.parent_email)}&role=parent&invite=${inviteId}`;
          const selectedProgram = programs.find(p => p.id === student.program_id);
          const { data: { session: edgeSession } } = await supabase.auth.getSession();
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${edgeSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({
              to: student.parent_email,
              parentName: student.parent_name || student.parent_email.split('@')[0],
              childName: student.full_name,
              schoolName,
              programName: selectedProgram?.name || 'Equipo',
              monthlyFee: student.price_monthly || Number(defaultMonthlyFee) || 0,
              invitationLink: registration_link,
            })
          }).catch(e => console.error('Error sending bulk email:', e));
          results.success++;
        } catch (err) {
          console.error(`Error inviting ${student.full_name}:`, err);
          results.failed++;
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['school-students'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setSelectedStudentIds([]);
      toast({
        title: '✅ Proceso de invitación completado',
        description: `Enviadas: ${results.success}, Fallidas: ${results.failed}, Saltadas (sin email): ${results.skipped}`,
      });
    },
    onError: (error) => {
      toast({ title: '❌ Error en envío masivo', description: error instanceof Error ? error.message : 'Ocurrió un error inesperado', variant: 'destructive' });
    }
  });

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: 'active' | 'inactive' }) => {
      await studentsAPI.updateStudent(id, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-students'] });
      toast({ title: '✅ Estado actualizado' });
    }
  });

  const handleToggleStatus = (student: any) => {
    toggleStatusMutation.mutate({ id: student.id, status: student.status === 'inactive' ? 'active' : 'inactive' });
  };

  const handleProgramChange = (programId: string) => {
    form.setValue('program_id', programId);
    const selectedProgram = programs.find(p => p.id === programId);
    if (selectedProgram) form.setValue('monthly_fee', selectedProgram.monthly_fee);
  };

  const enhancedStudents = students.map(student => {
    const emergencyContact = student.emergency_contact || '';
    const hasEmergencyContactParts = emergencyContact.includes(' - ');
    const fallbackParentName = hasEmergencyContactParts ? emergencyContact.split(' - ')[0] : emergencyContact;
    const fallbackParentPhone = hasEmergencyContactParts ? emergencyContact.split(' - ')[1] : '';

    return {
      ...student,
      display_parent_name: student.parent_name || (fallbackParentName ? fallbackParentName.trim() : null),
      display_parent_phone: student.parent_phone || (fallbackParentPhone ? fallbackParentPhone.trim() : null),
    };
  });

  const filteredStudents = enhancedStudents.filter(student =>
    (activeTab === 'todos' || (activeTab === 'active' ? student.status !== 'inactive' : student.status === 'inactive')) &&
    (student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.display_parent_name && student.display_parent_name.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-500 text-xs">Al día</Badge>;
      case 'overdue': return <Badge variant="destructive" className="text-xs">Vencido</Badge>;
      case 'pending': return <Badge variant="secondary" className="text-xs">Pendiente</Badge>;
      default: return null;
    }
  };

  const calculateAge = (dateOfBirth?: string | null) => {
    if (!dateOfBirth) return '-';
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return '-';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return `${age} años`;
  };

  // ── Acciones de un estudiante como DropdownMenu (móvil) ───────────────────
  const StudentActions = ({ student }: { student: any }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewingStudent(student)}>
          Ver Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleEditStudent(student)}>
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleToggleStatus(student)}>
          {student.status === 'inactive' ? 'Reactivar' : 'Inactivar'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => {
          const params = new URLSearchParams({
            email: student.parent_email || '',
            child: student.full_name || '',
            program: student.program_id || '',
            phone: student.parent_phone || ''
          });
          navigate(`/invitations?${params.toString()}`);
        }}>
          Invitar Acudiente
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isLoading || schoolLoading) return <LoadingSpinner fullScreen text="Cargando estudiantes..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Atletas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {filteredStudents.length} atleta{filteredStudents.length !== 1 ? 's' : ''} en <strong>{schoolName}</strong>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Importar CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <Button size="sm" onClick={handleCreateStudent}>
            <UserPlus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Agregar Atleta</span>
            <span className="sm:hidden">Agregar</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">Activos</TabsTrigger>
          <TabsTrigger value="inactive">Inactivos</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por nombre o acudiente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {selectedStudentIds.length > 0 && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <CheckSquare className="h-4 w-4" />
                {selectedStudentIds.length} seleccionado{selectedStudentIds.length !== 1 ? 's' : ''}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="default" onClick={() => bulkInviteMutation.mutate(selectedStudentIds)} disabled={bulkInviteMutation.isPending}>
                  {bulkInviteMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                  Invitar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedStudentIds([])} disabled={bulkInviteMutation.isPending}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {filteredStudents.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={UserPlus}
                title="No hay atletas"
                description="Agrega atletas manualmente o importa desde un archivo CSV"
                actionLabel="+ Agregar Atleta"
                onAction={handleCreateStudent}
              />
            </div>
          ) : (
            <>
              {/* ── VISTA MOBILE: Cards (oculta en lg+) ────────────────────── */}
              <div className="grid grid-cols-1 gap-3 p-4 lg:hidden">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${selectedStudentIds.includes(student.id) ? 'bg-primary/5 border-primary/30' : 'bg-card border-border'
                      }`}
                  >
                    {/* Checkbox */}
                    <Checkbox
                      checked={selectedStudentIds.includes(student.id)}
                      onCheckedChange={() => toggleSelectStudent(student.id)}
                      className="mt-1"
                    />
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {student.full_name.substring(0, 2).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="font-semibold text-sm truncate">{student.full_name}</p>
                        <MedicalAlertBadge medicalInfo={student.medical_info} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {student.team_name || student.program_name || 'Sin equipo'} · {student.branch_name || 'Sede Principal'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs font-semibold text-primary">
                          {(student.monthly_fee || student.price_monthly) ? formatCurrency(student.monthly_fee || student.price_monthly!) : '-'}
                        </span>
                        {getPaymentBadge(student.enrollment_status === 'active' ? 'paid' : 'pending')}
                      </div>
                    </div>
                    {/* Dropdown acciones */}
                    <StudentActions student={student} />
                  </div>
                ))}
              </div>

              {/* ── VISTA DESKTOP: Tabla (oculta en móvil) ─────────────────── */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                          onCheckedChange={() => toggleSelectAll()}
                        />
                      </TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Edad</TableHead>
                      <TableHead>Equipo</TableHead>
                      <TableHead>Sede</TableHead>
                      <TableHead>Acudiente</TableHead>
                      <TableHead>Mensualidad</TableHead>
                      <TableHead>Estado Pago</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id} className={selectedStudentIds.includes(student.id) ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox checked={selectedStudentIds.includes(student.id)} onCheckedChange={() => toggleSelectStudent(student.id)} />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{student.full_name}</span>
                            <MedicalAlertBadge medicalInfo={student.medical_info} />
                          </div>
                        </TableCell>
                        <TableCell>{calculateAge(student.date_of_birth)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{student.team_name || student.program_name || 'Sin equipo'}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{student.branch_name || 'Sede Principal'}</span>
                        </TableCell>
                        <TableCell>{(student as any).athlete_type === 'adult' ? '\u2014' : (student.display_parent_name || student.parent_name || '-')}</TableCell>
                        <TableCell className="font-semibold text-primary">
                          {(student.monthly_fee || student.price_monthly) ? formatCurrency(student.monthly_fee || student.price_monthly!) : '-'}
                        </TableCell>
                        <TableCell>{getPaymentBadge(student.enrollment_status === 'active' ? 'paid' : 'pending')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setViewingStudent(student)}>Ver</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEditStudent(student)}>
                              <Edit className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(student)}>
                              {student.status === 'inactive'
                                ? <UserCheck className="h-4 w-4 text-green-500" />
                                : <UserMinus className="h-4 w-4 text-orange-500" />}
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              className="text-primary border-primary/20 hover:bg-primary/5"
                              onClick={() => {
                                const params = new URLSearchParams({
                                  email: student.parent_email || '',
                                  child: student.full_name || '',
                                  program: student.program_id || '',
                                  phone: student.parent_phone || ''
                                });
                                navigate(`/invitations?${params.toString()}`);
                              }}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Invitar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog agregar/editar — igual que antes, solo se agrega responsive al grid interno */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Editar Atleta' : 'Agregar Nuevo Atleta'}</DialogTitle>
            <DialogDescription>
              {editingStudent
                ? `Actualiza la información de ${editingStudent.full_name}.`
                : <>Registra al atleta. Quedará asociado a <strong>{schoolName}</strong>.</>}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" />Información del Atleta</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nombre Completo *</Label>
                  <Input id="full_name" placeholder="Ej: María Rodríguez Pérez" {...form.register('full_name')} />
                  {form.formState.errors.full_name && <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Fecha de Nacimiento del Atleta *</Label>
                  <Input id="date_of_birth" type="date" autoComplete="off" {...form.register('date_of_birth')} />
                  {form.formState.errors.date_of_birth && <p className="text-sm text-destructive">{form.formState.errors.date_of_birth.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="photo">Foto de Perfil</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">Sube una foto del atleta</p>
                    <Input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="max-w-xs mx-auto" />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4" />Equipo y Mensualidad</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="program_id">Equipo *</Label>
                  <Select value={form.watch('program_id')} onValueChange={handleProgramChange}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar equipo" /></SelectTrigger>
                    <SelectContent>
                      {programs.map(program => (
                        <SelectItem key={program.id} value={program.id}>{program.name} — {formatCurrency(program.monthly_fee)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.program_id && <p className="text-sm text-destructive">{form.formState.errors.program_id.message}</p>}
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
                      {...form.register('monthly_fee', { valueAsNumber: true })}
                    />
                  </div>
                  {form.formState.errors.monthly_fee && <p className="text-sm text-destructive">{form.formState.errors.monthly_fee.message}</p>}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Mail className="w-4 h-4" />Contacto del Padre/Tutor</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parent_email">Email del Padre/Tutor *</Label>
                  <Input id="parent_email" type="email" placeholder="padre@ejemplo.com" {...form.register('parent_email')} />
                  {form.formState.errors.parent_email && <p className="text-sm text-destructive">{form.formState.errors.parent_email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_phone">Teléfono de Contacto *</Label>
                  <Input id="parent_phone" type="tel" placeholder="+57 300 123 4567" {...form.register('parent_phone')} />
                  {form.formState.errors.parent_phone && <p className="text-sm text-destructive">{form.formState.errors.parent_phone.message}</p>}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />Información Adicional</h3>
              <div className="space-y-2">
                <Label htmlFor="medical_info">Información Médica</Label>
                <Textarea id="medical_info" placeholder="Ej: Alérgico a los frutos secos..." {...form.register('medical_info')} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas Generales</Label>
                <Textarea id="notes" placeholder="Cualquier información relevante..." {...form.register('notes')} rows={3} />
              </div>
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createStudentMutation.isPending || updateStudentMutation.isPending}>
                {createStudentMutation.isPending || updateStudentMutation.isPending ? 'Guardando...' : (editingStudent ? 'Guardar Cambios' : 'Agregar Atleta')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Ver Perfil */}
      <Dialog open={!!viewingStudent} onOpenChange={(open) => !open && setViewingStudent(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Perfil del Atleta</DialogTitle>
            <DialogDescription>Detalles académicos y de contacto</DialogDescription>
          </DialogHeader>
          {viewingStudent && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground uppercase shrink-0">
                  {viewingStudent.full_name.substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg truncate">{viewingStudent.full_name}</h3>
                    <MedicalAlertBadge medicalInfo={viewingStudent.medical_info} />
                  </div>
                  <p className="text-sm text-muted-foreground">{calculateAge(viewingStudent.date_of_birth)}</p>
                  {getPaymentBadge(viewingStudent.enrollment_status === 'active' ? 'paid' : 'pending')}
                </div>
              </div>
              <div className="grid gap-2">
                {[
                  { label: 'Escuela', value: schoolName },
                  { label: 'Equipo', value: (viewingStudent as any).team_name || viewingStudent.program_name || '-' },
                  { label: 'Mensualidad', value: ((viewingStudent as any).monthly_fee || viewingStudent.price_monthly) ? formatCurrency((viewingStudent as any).monthly_fee || viewingStudent.price_monthly!) : '-', bold: true },
                  { label: 'Acudiente', value: (viewingStudent as any).athlete_type === 'adult' ? '—' : ((viewingStudent as any).display_parent_name || viewingStudent.parent_name || '-') },
                  { label: 'Teléfono', value: (viewingStudent as any).display_parent_phone || viewingStudent.parent_phone || '-' },
                ].map(({ label, value, bold }) => (
                  <div key={label} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 gap-2">
                    <span className="text-sm font-medium shrink-0">{label}:</span>
                    <span className={`text-sm text-right truncate ${bold ? 'font-bold text-primary' : ''}`}>{value}</span>
                  </div>
                ))}
              </div>
              {/* Identity Documents */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  Documentos de Identidad
                </div>
                {loadingDocs ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Cargando documentos...
                  </div>
                ) : studentDocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2 rounded border border-dashed text-center">
                    No hay documentos subidos para este atleta.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {studentDocs.map((doc) => (
                      <a
                        key={doc.name}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 transition-colors text-xs group"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{doc.name}</span>
                        </span>
                        <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={() => setViewingStudent(null)}>Cerrar</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CSVImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          toast({ title: "Importación completada", description: "La lista de atletas se ha actualizado." });
          queryClient.invalidateQueries({ queryKey: ['school-students'] });
        }}
        schoolId={schoolId ?? ''}
        schoolName={schoolName}
        branchId={activeBranchId}
        students={students}
        programs={programs}
        branches={branches}
      />
    </div>
  );
}
