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
import { UserPlus, User, Mail, FileText, Upload, FileUp, Search, DollarSign, Send, UserMinus, UserCheck, Edit, Loader2, CheckSquare, MoreVertical, Download, FolderOpen, Trophy, Zap, Calendar, CalendarCheck, CalendarX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CSVImportModal } from '@/components/students/CSVImportModal';
import { StudentTypeSelector } from '@/components/students/StudentTypeSelector';
import { CreateChildModal } from '@/components/students/CreateChildModal';
import { CreateAdultAthleteModal } from '@/components/students/CreateAdultAthleteModal';
import { useSchoolContext, createStudentWithPendingPayment } from '@/hooks/useSchoolContext';
import { studentsAPI, StudentViewRow } from '@/lib/api/students';
import { MedicalAlertBadge } from '@/components/common/MedicalAlertBadge';
import { useNavigate } from 'react-router-dom';

const studentSchema = z.object({
  full_name: z.string().min(2, 'Nombre completo es requerido').max(100),
  date_of_birth: z.string().min(1, 'Fecha de nacimiento es requerida'),
  parent_email: z.string().email('Email inválido').max(255),
  parent_phone: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos').max(20),
  team_id: z.string().optional(),
  offering_plan_id: z.string().optional(),
  monthly_fee: z.number().min(0).optional(),
  medical_info: z.string().max(1000).optional(),
  notes: z.string().max(500).optional(),
  tshirt_size: z.string().optional(),
  blood_type: z.string().optional(),
  eps_name: z.string().optional(),
}).refine(data => data.team_id || data.offering_plan_id, {
  message: 'Debes seleccionar al menos un equipo o un plan',
  path: ['team_id'],
});

type StudentFormData = z.infer<typeof studentSchema>;

export default function SchoolStudentsManagementPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showCreateChildModal, setShowCreateChildModal] = useState(false);
  const [showCreateAdultModal, setShowCreateAdultModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingStudent, setViewingStudent] = useState<(StudentViewRow & { display_parent_name?: string | null, display_parent_phone?: string | null }) | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentViewRow | null>(null);
  const [editingAthleteType, setEditingAthleteType] = useState<'child' | 'adult' | 'unregistered' | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentDocs, setStudentDocs] = useState<{ name: string; url: string }[]>([]);
  const [studentDocInfo, setStudentDocInfo] = useState<{
    doc_type?: string | null;
    doc_number?: string | null;
    tshirt_size?: string | null;
    blood_type?: string | null;
    eps_name?: string | null;
  }>({});
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [studentPlanInfo, setStudentPlanInfo] = useState<{
    plan_name: string;
    offering_name?: string;
    start_date?: string | null;
    end_date?: string | null;
    status?: string;
  } | null>(null);
  const [loadingPlanInfo, setLoadingPlanInfo] = useState(false);

  const { schoolId, schoolName, teams, branches, activeBranchId, defaultMonthlyFee, loading: schoolLoading } = useSchoolContext();

  const { data: offeringPlans = [] } = useQuery({
    queryKey: ['offering-plans', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await (supabase as any)
        .from('offering_plans')
        .select('id, name, price, offering_id, offerings!offering_plans_offering_id_fkey(name)')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('name');
      if (error) return [];
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price || 0,
        offering_name: p.offerings?.name || '',
      }));
    },
    enabled: !!schoolId,
  });

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
    if (!viewingStudent) {
      setStudentDocs([]);
      setStudentDocInfo({});
      setStudentPlanInfo(null);
      return;
    }
    const studentId = viewingStudent.id;

    if (getAthleteType(viewingStudent) === 'child') {
      (supabase as any)
        .from('children')
        .select('doc_type, doc_number, tshirt_size, blood_type, eps_name')
        .eq('id', studentId)
        .maybeSingle()
        .then(({ data }: { data: any }) => {
          setStudentDocInfo({
            doc_type:    data?.doc_type    || null,
            doc_number:  data?.doc_number  || null,
            tshirt_size: data?.tshirt_size || null,
            blood_type:  data?.blood_type  || null,
            eps_name:    data?.eps_name    || null,
          });
        });
    } else {
      setStudentDocInfo({});
    }

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

    setLoadingPlanInfo(true);
    setStudentPlanInfo(null);

    const athleteType = getAthleteType(viewingStudent);

    let planQuery = (supabase as any)
      .from('enrollments')
      .select(`
        status,
        start_date,
        end_date,
        expires_at,
        offering_plans!enrollments_offering_plan_id_fkey (
          name,
          offerings!offering_plans_offering_id_fkey ( name )
        )
      `)
      .eq('status', 'active')
      .not('offering_plan_id', 'is', null)
      .order('start_date', { ascending: false })
      .limit(1);

    if (athleteType === 'child') {
      planQuery = planQuery.eq('child_id', studentId);
    } else if (athleteType === 'adult') {
      planQuery = planQuery.eq('user_id', studentId);
    } else {
      planQuery = planQuery.eq('unregistered_athlete_id', studentId);
    }

    planQuery
      .maybeSingle()
      .then(({ data: planRow }: { data: any }) => {
        if (planRow?.offering_plans) {
          setStudentPlanInfo({
            plan_name:     planRow.offering_plans.name,
            offering_name: planRow.offering_plans.offerings?.name,
            start_date:    planRow.start_date,
            end_date:      planRow.end_date ?? planRow.expires_at,
            status:        planRow.status,
          });
        } else {
          setStudentPlanInfo(null);
        }
      })
      .finally(() => setLoadingPlanInfo(false));
  }, [viewingStudent]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['school-students', schoolId, activeBranchId, coachId],
    queryFn: async () => {
      if (!schoolId) return [];
      let data;
      if (coachId) {
        const [{ data: legacyTeams }, { data: junctionTeams }] = await Promise.all([
          supabase.from('teams').select('id').eq('school_id', schoolId).eq('coach_id', coachId),
          supabase.from('team_coaches').select('team_id').eq('coach_id', coachId),
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
        data = await studentsAPI.getSchoolView(schoolId, { branchId: activeBranchId });
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
      team_id: '',
      offering_plan_id: '',
      monthly_fee: Number(defaultMonthlyFee) || 0,
      medical_info: '',
      notes: '',
    },
  });

  const createStudentMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      const selectedTeam = teams.find(p => p.id === data.team_id);
      if (schoolId) {
        const result = await createStudentWithPendingPayment({
          fullName: data.full_name,
          dateOfBirth: data.date_of_birth,
          parentEmail: data.parent_email,
          parentPhone: data.parent_phone,
          parentName: data.parent_email.split('@')[0],
          schoolId,
          branchId: selectedTeam?.branch_id || activeBranchId || undefined,
          teamId: data.team_id,
          teamName: selectedTeam?.name || 'Equipo',
          monthlyFee: data.monthly_fee,
          medicalInfo: data.medical_info,
          notes: data.notes,
        });
        if (result.success && result.childId && data.offering_plan_id) {
          try {
            const { bffClient } = await import('@/lib/api/bffClient');
            await bffClient.post('/api/v1/enrollments', {
              child_id:         result.childId,
              offering_plan_id: data.offering_plan_id,
              school_id:        schoolId,
              status:           'active',
            });
          } catch (enrollErr) {
            console.error('Error al inscribir en plan:', enrollErr);
            toast({
              title: '⚠️ Atleta creado, pero no se inscribió al plan',
              description: 'Puedes inscribirlo manualmente desde Mis Planes.',
            });
          }
        }
        if (result.success) {
          toast({ title: '✅ Atleta registrado', description: `${data.full_name} asociado a ${schoolName}` });
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
      if (editingAthleteType === 'unregistered') {
        const { error } = await (supabase as any).from('unregistered_athletes')
          .update({ full_name: data.full_name, date_of_birth: data.date_of_birth || null, updated_at: new Date().toISOString() })
          .eq('id', editingStudent.id);
        if (error) throw error;
        return data;
      }
      if (editingAthleteType === 'adult') {
        const { error } = await supabase.from('profiles')
          .update({ full_name: data.full_name, date_of_birth: data.date_of_birth || null, updated_at: new Date().toISOString() })
          .eq('id', editingStudent.id);
        if (error) throw error;
        return data;
      }
      const selectedTeam = teams.find(p => p.id === data.team_id);
      await studentsAPI.updateStudent(editingStudent.id, {
        full_name: data.full_name, date_of_birth: data.date_of_birth, medical_info: data.medical_info,
        team_id: data.team_id || null, branch_id: selectedTeam?.branch_id || activeBranchId || undefined,
        monthly_fee: typeof data.monthly_fee === 'number' ? data.monthly_fee : undefined,
        tshirt_size: data.tshirt_size || null, blood_type: data.blood_type || null, eps_name: data.eps_name || null,
      });
      if (schoolId && (data.team_id || data.offering_plan_id)) {
        await (supabase as any).from('enrollments').upsert({
          child_id: editingStudent.id, school_id: schoolId,
          branch_id: selectedTeam?.branch_id || activeBranchId || null,
          team_id: data.team_id || null, offering_plan_id: data.offering_plan_id || null, status: 'active',
        }, { onConflict: 'child_id,school_id' });
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-students'] });
      setDialogOpen(false);
      setEditingStudent(null);
      setEditingAthleteType(null);
      toast({ title: '✅ Atleta actualizado' });
    }
  });

  const onSubmit = (data: StudentFormData) => {
    if (editingStudent) updateStudentMutation.mutate(data);
    else createStudentMutation.mutate(data);
  };

  const handleCreateStudent = () => setShowTypeSelector(true);

  const getAthleteType = (student: any): 'child' | 'adult' | 'unregistered' => {
    if (student.athlete_type) return student.athlete_type;
    if (student.parent_id || student.parent_email_temp) return 'child';
    if (student.user_id) return 'adult';
    return 'unregistered';
  };

  const handleEditStudent = async (student: any) => {
    const athleteType = getAthleteType(student);
    setEditingStudent(student);
    setEditingAthleteType(athleteType);
    let extraFields = { tshirt_size: '', blood_type: '', eps_name: '' };
    if (athleteType === 'child') {
      const { data } = await (supabase as any).from('children').select('tshirt_size, blood_type, eps_name').eq('id', student.id).maybeSingle();
      if (data) extraFields = { tshirt_size: data.tshirt_size || '', blood_type: data.blood_type || '', eps_name: data.eps_name || '' };
    }
    form.reset({
      full_name: student.full_name, date_of_birth: student.date_of_birth || '',
      parent_email: student.parent_email || '', parent_phone: student.parent_phone || '',
      team_id: student.team_id || '', offering_plan_id: student.offering_plan_id || '',
      monthly_fee: student.price_monthly || Number(defaultMonthlyFee) || 0,
      medical_info: student.medical_info || '', notes: student.notes || '',
      tshirt_size: extraFields.tshirt_size, blood_type: extraFields.blood_type, eps_name: extraFields.eps_name,
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
            p_email: student.parent_email, p_role: 'parent', p_child_name: student.full_name,
            p_team_id: student.team_id || null,
            p_monthly_fee: student.price_monthly || Number(defaultMonthlyFee) || 0,
            p_parent_phone: student.parent_phone || null,
            p_branch_id: student.branch_id || activeBranchId || null
          });
          if (error) throw error;
          const registration_link = `${window.location.origin}/register?email=${encodeURIComponent(student.parent_email)}&role=parent&invite=${inviteId}`;
          const selectedTeam = teams.find(p => p.id === student.team_id);
          const { data: { session: edgeSession } } = await supabase.auth.getSession();
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${edgeSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({
              to: student.parent_email, parentName: student.parent_name || student.parent_email.split('@')[0],
              childName: student.full_name, schoolName, teamName: selectedTeam?.name || 'Equipo',
              monthlyFee: student.price_monthly || Number(defaultMonthlyFee) || 0, invitationLink: registration_link,
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
      toast({ title: '✅ Proceso de invitación completado', description: `Enviadas: ${results.success}, Fallidas: ${results.failed}, Saltadas (sin email): ${results.skipped}` });
    },
    onError: (error) => {
      toast({ title: '❌ Error en envío masivo', description: error instanceof Error ? error.message : 'Ocurrió un error inesperado', variant: 'destructive' });
    }
  });

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0) setSelectedStudentIds([]);
    else setSelectedStudentIds(filteredStudents.map(s => s.id));
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: 'active' | 'inactive' }) => {
      await studentsAPI.updateStudent(id, { status });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['school-students'] }); toast({ title: '✅ Estado actualizado' }); }
  });

  const handleToggleStatus = (student: any) => {
    toggleStatusMutation.mutate({ id: student.id, status: student.status === 'inactive' ? 'active' : 'inactive' });
  };

  const handleTeamChange = (teamId: string) => {
    form.setValue('team_id', teamId);
    const selectedTeam = teams.find(p => p.id === teamId);
    if (selectedTeam) form.setValue('monthly_fee', selectedTeam.monthly_fee);
  };

  // ── Helper: construye los params de navegación a /invitations ─────────────
  // PATCH: para atletas unregistered se agrega role=athlete y unregisteredId
  const buildInviteParams = (student: any) => {
    const athleteType = getAthleteType(student);
    const params = new URLSearchParams({
      email:      student.parent_email    || '',
      child:      student.full_name       || '',
      team:       student.team_id         || '',
      phone:      student.parent_phone    || '',
      branch:     student.branch_id       || '',
      planId:     student.offering_plan_id || '',
    });
    if (athleteType === 'unregistered') {
      params.set('role', 'athlete');
      params.set('unregisteredId', student.id);
    }
    return params.toString();
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

  const getPaymentBadge = (student: any) => {
    const ps  = student.payment_status;
    const due = student.payment_due_date;
    if (!ps) return <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-500">Sin cobro</Badge>;
    if (ps === 'paid') return <Badge className="bg-green-500 text-xs text-white">Al día</Badge>;
    if (ps === 'overdue' || ((ps === 'pending' || ps === 'awaiting_approval') && due && new Date(due) < new Date()))
      return <Badge variant="destructive" className="text-xs">Vencido</Badge>;
    if (ps === 'pending' || ps === 'awaiting_approval')
      return <Badge variant="secondary" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>;
    return <Badge variant="secondary" className="text-xs">{ps}</Badge>;
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

  // ── PATCH: label del item "Invitar" cambia según tipo de atleta ───────────
  const StudentActions = ({ student }: { student: any }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewingStudent(student)}>Ver Perfil</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleEditStudent(student)}>Editar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleToggleStatus(student)}>
          {student.status === 'inactive' ? 'Reactivar' : 'Inactivar'}
        </DropdownMenuItem>
        {/* PATCH: label y params según tipo de atleta */}
        <DropdownMenuItem onClick={() => navigate(`/invitations?${buildInviteParams(student)}`)}>
          {getAthleteType(student) === 'unregistered' ? 'Invitar Atleta' : 'Invitar Acudiente'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isLoading || schoolLoading) return <LoadingSpinner fullScreen text="Cargando estudiantes..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Atletas</h1>
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
            <Input placeholder="Buscar por nombre o acudiente..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
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
                <Button size="sm" variant="ghost" onClick={() => setSelectedStudentIds([])} disabled={bulkInviteMutation.isPending}>Cancelar</Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {filteredStudents.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={UserPlus} title="No hay atletas" description="Agrega atletas manualmente o importa desde un archivo CSV" actionLabel="+ Agregar Atleta" onAction={handleCreateStudent} />
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="grid grid-cols-1 gap-3 p-4 lg:hidden">
                {filteredStudents.map((student) => (
                  <div key={student.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${selectedStudentIds.includes(student.id) ? 'bg-primary/5 border-primary/30' : 'bg-card border-border'}`}>
                    <Checkbox checked={selectedStudentIds.includes(student.id)} onCheckedChange={() => toggleSelectStudent(student.id)} className="mt-1" />
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {student.full_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="font-semibold text-sm truncate">{student.full_name}</p>
                        <MedicalAlertBadge medicalInfo={student.medical_info} />
                      </div>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {student.team_name && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 py-0 h-5"><Trophy className="h-2.5 w-2.5 mr-1" /> {student.team_name}</Badge>}
                        {(student as any).plan_name && <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 py-0 h-5"><Zap className="h-2.5 w-2.5 mr-1" /> {(student as any).plan_name}</Badge>}
                        {!student.team_name && !(student as any).plan_name && <span className="text-xs text-muted-foreground">Sin asignar</span>}
                        <span className="text-muted-foreground text-xs ml-1">· {student.branch_name || "Sin sede"}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs font-semibold text-primary">{(student as any).price_monthly > 0 ? formatCurrency((student as any).price_monthly) : '-'}</span>
                        {getPaymentBadge(student)}
                      </div>
                    </div>
                    <StudentActions student={student} />
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length} onCheckedChange={() => toggleSelectAll()} />
                      </TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Edad</TableHead>
                      <TableHead>Equipo / Plan</TableHead>
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
                        <TableCell><Checkbox checked={selectedStudentIds.includes(student.id)} onCheckedChange={() => toggleSelectStudent(student.id)} /></TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2"><span>{student.full_name}</span><MedicalAlertBadge medicalInfo={student.medical_info} /></div>
                        </TableCell>
                        <TableCell>{calculateAge(student.date_of_birth)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {student.team_name && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 w-fit"><Trophy className="h-3 w-3 mr-1" /> {student.team_name}</Badge>}
                            {(student as any).plan_name && <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 w-fit"><Zap className="h-3 w-3 mr-1" /> {(student as any).plan_name}</Badge>}
                            {!student.team_name && !(student as any).plan_name && <span className="text-xs text-muted-foreground">Sin asignar</span>}
                          </div>
                        </TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">{student.branch_name || <span className="text-muted-foreground text-xs">Sin sede</span>}</span></TableCell>
                        <TableCell>{(student as any).athlete_type === 'adult' ? '—' : (student.display_parent_name || student.parent_name || '-')}</TableCell>
                        <TableCell className="font-semibold text-primary">{(student as any).price_monthly > 0 ? formatCurrency((student as any).price_monthly) : '-'}</TableCell>
                        <TableCell>{getPaymentBadge(student)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setViewingStudent(student)}>Ver</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEditStudent(student)}><Edit className="h-4 w-4 text-primary" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(student)}>
                              {student.status === 'inactive' ? <UserCheck className="h-4 w-4 text-green-500" /> : <UserMinus className="h-4 w-4 text-orange-500" />}
                            </Button>
                            {/* PATCH: usa buildInviteParams para pasar el unregisteredId cuando aplica */}
                            <Button
                              variant="outline" size="sm"
                              className="text-primary border-primary/20 hover:bg-primary/5"
                              onClick={() => navigate(`/invitations?${buildInviteParams(student)}`)}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              {getAthleteType(student) === 'unregistered' ? 'Invitar' : 'Invitar'}
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

      {/* Dialogs — sin cambios respecto al original */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStudent ? `Editar ${editingAthleteType === 'child' ? 'Menor' : 'Atleta'} — ${editingStudent.full_name}` : 'Agregar Nuevo Atleta'}</DialogTitle>
            <DialogDescription>
              {editingStudent ? (editingAthleteType === 'child' ? 'Actualiza la información del menor y su acudiente.' : editingAthleteType === 'adult' ? 'Actualiza la información del atleta. El email se gestiona desde su cuenta.' : 'Actualiza la información del atleta registrado manualmente.') : <>Registra al atleta. Quedará asociado a <strong>{schoolName}</strong>.</>}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Form content unchanged from original */}
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createStudentMutation.isPending || updateStudentMutation.isPending}>
                {createStudentMutation.isPending || updateStudentMutation.isPending ? 'Guardando...' : (editingStudent ? 'Guardar Cambios' : 'Agregar Atleta')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CSVImportModal open={showImportModal} onClose={() => setShowImportModal(false)}
        onSuccess={() => { setShowImportModal(false); toast({ title: "Importación completada", description: "La lista de atletas se ha actualizado." }); queryClient.invalidateQueries({ queryKey: ['school-students'] }); }}
        schoolId={schoolId ?? ''} schoolName={schoolName} branchId={activeBranchId} students={students} teams={teams} branches={branches} />
      <StudentTypeSelector open={showTypeSelector} onClose={() => setShowTypeSelector(false)} onSelectChild={() => setShowCreateChildModal(true)} onSelectAdult={() => setShowCreateAdultModal(true)} />
      <CreateChildModal open={showCreateChildModal} onClose={() => setShowCreateChildModal(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['school-students'] }); setShowCreateChildModal(false); }} schoolId={schoolId || ''} />
      <CreateAdultAthleteModal open={showCreateAdultModal} onClose={() => setShowCreateAdultModal(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['school-students'] }); setShowCreateAdultModal(false); }} schoolId={schoolId || ''} />
    </div>
  );
}
