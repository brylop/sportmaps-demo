import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  UserPlus,
  Search,
  X as XIcon,
  Clock,
  Check,
  Copy,
  Share2,
  MessageCircle,
  Send,
  Filter,
  RefreshCcw,
  DollarSign,
  Link as LinkIcon,
  Mail
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchoolContext } from '@/hooks/useSchoolContext';

interface Invitation {
  id: string;
  invited_email: string;
  child_name: string;
  program_name: string;
  monthly_fee: number;
  status: string;
  created_at: string;
  expires_at?: string;
  parent_phone?: string;
  registration_link?: string;
  role_to_assign?: string;
  program_id?: string;
  branch_name?: string;
}

export default function InvitationsManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { schoolId, schoolName, programs, defaultMonthlyFee, currentUserRole, activeBranchId } = useSchoolContext();
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';

  const [formData, setFormData] = useState({
    parentEmail: '',
    parentPhone: '',
    childName: '',
    programId: '',
    monthlyFee: defaultMonthlyFee,
    role: 'parent' as 'parent' | 'coach' | 'athlete' | 'guest' | 'school_admin' | 'reporter',
  });

  // Branch selector state kept for compatibility (unused in MVP)
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const [suggestedContacts, setSuggestedContacts] = useState<{ name: string, email: string, phone?: string, childName?: string, programId?: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Handle URL params
  useEffect(() => {
    const email = searchParams.get('email');
    const child = searchParams.get('child');
    const program = searchParams.get('program');
    const phone = searchParams.get('phone');

    if (email || child || program || phone) {
      setFormData(prev => ({
        ...prev,
        parentEmail: email || prev.parentEmail,
        childName: child || prev.childName,
        programId: program || prev.programId,
        parentPhone: phone || prev.parentPhone,
      }));
      setDialogOpen(true);
    }
  }, [searchParams]);

  // Al abrir el dialog, preseleccionar la sede activa
  useEffect(() => {
    if (activeBranchId) setSelectedBranchId(activeBranchId);
  }, [activeBranchId, dialogOpen]);


  // Pre-load contacts based on role
  useEffect(() => {
    if (!schoolId) return;
    const fetchSuggestions = async () => {
      let contacts: {
        name: string,
        email: string,
        phone?: string,
        childName?: string,
        programId?: string
      }[] = [];

      if (formData.role === 'parent') {
        const { data } = await supabase
          .from('students' as any)
          .select('full_name, parent_name, parent_phone, program_id, profiles!parent_id(email)')
          .eq('school_id', schoolId);

        if (data) {
          contacts = (data as any[]).map((d) => ({
            name: d.parent_name || '',
            email: d.profiles?.email || '',
            phone: d.parent_phone || '',
            childName: d.full_name || '',
            programId: d.program_id || ''
          }));
        }
      } else if (['coach', 'staff', 'athlete', 'viewer', 'owner', 'admin'].includes(formData.role)) {
        // Only query roles that exist in the school_members role constraint
        const { data } = await supabase
          .from('school_members')
          .select('role, profiles(full_name, email, phone)')
          .eq('school_id', schoolId)
          .eq('role', formData.role);

        if (data) {
          contacts = (data as any[]).map((d) => ({
            name: d.profiles?.full_name || '',
            email: d.profiles?.email || '',
            phone: d.profiles?.phone || ''
          }));
        }
      }
      // For school_admin and reporter: no pre-existing suggestions (new role)
      // Deduplicate and filter empty
      const unique = Array.from(new Set(contacts.map(c => c.email))).map(email => contacts.find(c => c.email === email)!);
      setSuggestedContacts(unique.filter(c => c.email));
    };
    fetchSuggestions();
  }, [schoolId, formData.role]);

  // Fetch real invitations
  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ['invitations', schoolId, activeBranchId],
    queryFn: async () => {
      if (!schoolId) return [];
      let query = (supabase.from('invitations') as any)
        .select(`
          *,
          school_branches(name)
        `)
        .eq('school_id', schoolId);

      if (activeBranchId) {
        query = query.eq('branch_id', activeBranchId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Map DB fields to Invitation interface
      return (data || []).map((inv: any) => ({ // inv here is from DB result
        id: inv.id,
        invited_email: inv.email,
        parent_phone: inv.parent_phone || '',
        child_name: inv.child_name || (inv.role_to_assign !== 'parent' ? '—' : ''),
        program_name: programs.find(p => p.id === inv.program_id)?.name || (inv.role_to_assign === 'parent' ? 'Programa General' : '—'),
        monthly_fee: inv.monthly_fee || 0,
        status: inv.status,
        created_at: inv.created_at,
        expires_at: inv.expires_at || null,
        role_to_assign: inv.role_to_assign,
        branch_name: inv.school_branches?.name || 'Sede Principal'
      })) as Invitation[];
    },
    enabled: !!schoolId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await (supabase.from('school_branches') as any)
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });


  // Client-side filtering and sorting
  const filteredInvitations = invitations
    .filter(inv => {
      // 1. Status Filter
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;

      // 2. Search Filter
      const search = searchTerm.toLowerCase();
      if (!search) return true;

      return (
        inv.invited_email.toLowerCase().includes(search) ||
        inv.child_name.toLowerCase().includes(search) ||
        inv.program_name.toLowerCase().includes(search) ||
        (inv.parent_phone && inv.parent_phone.includes(search))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'name') return (a.child_name || a.invited_email).localeCompare(b.child_name || b.invited_email);
      return 0;
    });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const generateRegistrationLink = (invitation: Partial<Invitation>) => {
    const role = invitation.role_to_assign || formData.role;
    const email = invitation.invited_email || formData.parentEmail;
    const inviteId = invitation.id || '';
    const child = invitation.child_name || formData.childName;
    const program = invitation.program_id || formData.programId;

    const params = new URLSearchParams({
      school: schoolId || '',
      email: email || '',
      invite: inviteId,
      role: role
    });

    if (role === 'parent') {
      if (child) params.append('child', child);
      if (program) params.append('program', program);
    }

    return `${window.location.origin}/register?${params.toString()}`;
  };

  const sendWhatsApp = (invitation: Partial<Invitation>) => {
    const link = generateRegistrationLink(invitation);
    const role = invitation.role_to_assign || formData.role;
    const phone = invitation.parent_phone || formData.parentPhone;
    const cleanPhone = phone.replace(/\D/g, '');

    const messages: Record<string, string> = {
      parent: `¡Hola! Te invitamos a inscribir a ${invitation.child_name || formData.childName} en ${schoolName}. Completa el registro aquí: ${link}`,
      coach: `¡Hola! Te invitamos a unirte como entrenador en ${schoolName}. Completa tu registro aquí: ${link}`,
      athlete: `¡Hola! Te invitamos a unirte como atleta en ${schoolName}. Completa tu registro aquí: ${link}`,
      school_admin: `¡Hola! Te invitamos a administrar una sede en ${schoolName}. Completa tu registro aquí: ${link}`,
      reporter: `¡Hola! Te invitamos a acceder como súper usuario en ${schoolName}. Completa tu registro aquí: ${link}`,
      guest: `¡Hola! Te invitamos a conocer ${schoolName}. Completa tu registro aquí: ${link}`,
    };

    const message = messages[role] ?? `¡Hola! Te invitamos a unirte a ${schoolName}. Completa tu registro aquí: ${link}`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const resendEmail = async (invitation: Invitation) => {
    const link = generateRegistrationLink(invitation);
    try {
      const { data: { session: edgeSession } } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${edgeSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({
            type: 'parent_invitation',
            to: invitation.invited_email,
            data: {
              schoolName,
              childName: invitation.child_name || '',
              registrationUrl: link,
            }
          })
        }
      );
      toast({ title: '📧 Correo reenviado', description: `Email enviado a ${invitation.invited_email}` });
    } catch {
      toast({ title: 'Error al reenviar', description: 'No se pudo enviar el correo.', variant: 'destructive' });
    }
  };

  const copyLinkToClipboard = (invitation: Invitation) => {
    const link = generateRegistrationLink(invitation);
    navigator.clipboard.writeText(link);
    toast({
      title: '📋 Link copiado',
      description: 'Link de registro copiado al portapapeles. Compártelo por WhatsApp o email.',
    });
  };

  const sendInvitationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const selectedProgram = programs.find(p => p.id === data.programId);
      const programName = selectedProgram?.name || 'Programa';
      const fee = data.monthlyFee || selectedProgram?.monthly_fee || defaultMonthlyFee;

      // 1. Create in DB via RPC (generic)
      const { data: inviteId, error } = await (supabase.rpc as any)('create_invitation', {
        p_email: data.parentEmail,
        p_role: data.role,
        p_child_name: data.role === 'parent' ? data.childName : null,
        // Program: applies to parent and athlete
        p_program_id: ['parent', 'athlete'].includes(data.role) ? (data.programId || null) : null,
        p_monthly_fee: data.role === 'parent' ? fee : null,
        p_parent_phone: data.parentPhone || null,
        // Branch: usar la sede seleccionada o la activa por defecto
        p_branch_id: selectedBranchId || activeBranchId || null
      });

      if (error) throw error;

      // 2. Try to send email via edge function (non-blocking)
      const registration_link = `${window.location.origin}/register?email=${encodeURIComponent(data.parentEmail)}&role=${data.role}&invite=${inviteId}`;

      const { data: { session: sendSession } } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sendSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({
            type: 'parent_invitation',
            to: data.parentEmail,
            data: {
              schoolName,
              childName: data.childName || '',
              registrationUrl: registration_link,
            }
          })
        }
      ).catch(err => {
        console.warn('Email send failed (RPC succeeded):', err);
      });

      return { id: inviteId, registration_link };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.refetchQueries({ queryKey: ['invitations', schoolId, activeBranchId] });
      setDialogOpen(false);
      const email = formData.parentEmail;
      setFormData({
        parentEmail: '',
        parentPhone: '',
        childName: '',
        programId: '',
        monthlyFee: defaultMonthlyFee,
        role: 'parent'
      });
      setSelectedBranchId(activeBranchId || '');

      toast({
        title: '✅ Invitación creada',
        description: `Invitación registrada para ${email}.`,
      });

      // Auto-copy registration link
      if (result.registration_link) {
        navigator.clipboard.writeText(result.registration_link);
        toast({
          title: '📋 Link copiado automáticamente',
          description: 'Compártelo por WhatsApp o email para que el padre se registre.',
        });
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message
        : (typeof error === 'object' && error !== null && 'message' in error) ? String((error as any).message)
          : String(error);
      toast({
        title: '❌ Error',
        description: `No se pudo enviar la invitación: ${message}`,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendInvitationMutation.mutate(formData);
  };

  const handleProgramChange = (programId: string) => {
    const selectedProgram = programs.find(p => p.id === programId);
    setFormData({
      ...formData,
      programId,
      monthlyFee: selectedProgram?.monthly_fee || defaultMonthlyFee,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" />Aceptada</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XIcon className="w-3 h-3 mr-1" />Rechazada</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-orange-500 border-orange-300"><Clock className="w-3 h-3 mr-1" />Expirada</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-gray-400 border-gray-300"><XIcon className="w-3 h-3 mr-1" />Cancelada</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-400">{status}</Badge>;
    }
  };

  const stats = {
    total: invitations.length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    pending: invitations.filter(i => i.status === 'pending').length,
    rejected: invitations.filter(i => i.status === 'rejected').length,
    expired: invitations.filter(i => i.status === 'expired').length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, teléfono o programa..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchTerm('')}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-32">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="oldest">Más antiguos</SelectItem>
              <SelectItem value="name">Por nombre</SelectItem>
            </SelectContent>
          </Select>

          {(searchTerm || statusFilter !== 'all') && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="flex-1 md:flex-none"
            >
              Limpiar Filtros
            </Button>
          )}
          <Button onClick={() => setDialogOpen(true)} className="flex-1 md:flex-none">
            <UserPlus className="w-4 h-4 mr-2" />
            Nueva Invitación
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card
          className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/20 ${statusFilter === 'all' ? 'ring-2 ring-primary ring-offset-2' : 'opacity-80 hover:opacity-100'}`}
          onClick={() => setStatusFilter('all')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invitaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:ring-2 hover:ring-green-500/20 ${statusFilter === 'accepted' ? 'ring-2 ring-green-500 ring-offset-2' : 'opacity-80 hover:opacity-100'}`}
          onClick={() => setStatusFilter('accepted')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aceptadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.accepted}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:ring-2 hover:ring-yellow-500/20 ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500 ring-offset-2' : 'opacity-80 hover:opacity-100'}`}
          onClick={() => setStatusFilter('pending')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:ring-2 hover:ring-red-500/20 ${statusFilter === 'rejected' ? 'ring-2 ring-red-500 ring-offset-2' : 'opacity-80 hover:opacity-100'}`}
          onClick={() => setStatusFilter('rejected')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rechazadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:ring-2 hover:ring-orange-500/20 ${statusFilter === 'expired' ? 'ring-2 ring-orange-500 ring-offset-2' : 'opacity-80 hover:opacity-100'
            }`}
          onClick={() => setStatusFilter('expired')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invitations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invitaciones Enviadas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email / Rol</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Estudiante / Programa</TableHead>
                <TableHead>Mensualidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">{invitation.invited_email}</span>
                      </div>
                      <Badge variant="secondary" className="w-fit text-[10px] capitalize font-normal">
                        {invitation.role_to_assign === 'parent' ? 'Padre' :
                          invitation.role_to_assign === 'coach' ? 'Entrenador' :
                            invitation.role_to_assign === 'athlete' ? 'Atleta' :
                              invitation.role_to_assign === 'school_admin' ? 'Admin Sede' :
                                invitation.role_to_assign === 'reporter' ? 'Súper Usuario' : 'Invitado'}
                      </Badge>
                      {invitation.parent_phone && (
                        <div className="flex items-center gap-2 mt-1">
                          <MessageCircle className="w-3 h-3 text-green-500" />
                          <span className="text-xs text-muted-foreground">{invitation.parent_phone}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="font-medium">{invitation.branch_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-xs">
                        {invitation.child_name || '—'}
                      </span>
                      {invitation.program_name !== '—' && (
                        <Badge variant="outline" className="w-fit text-[10px] font-normal">{invitation.program_name}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {invitation.role_to_assign === 'parent' ? formatCurrency(invitation.monthly_fee) : '—'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(invitation.status)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(invitation.created_at), 'PPP', { locale: es })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLinkToClipboard(invitation)}
                        title="Copiar link"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => sendWhatsApp(invitation)}
                        title="Enviar por WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                      {invitation.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resendEmail(invitation)}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Create Invitation Dialog ──────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-primary/5 to-transparent">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Nueva Invitación
              </DialogTitle>
              <DialogDescription className="text-sm">
                {formData.role === 'parent'
                  ? 'Invita a un padre para inscribir a su hijo. Se generará un link de registro.'
                  : formData.role === 'coach'
                    ? 'Invita un entrenador a unirse a tu academia.'
                    : formData.role === 'school_admin'
                      ? 'Invita un administrador que gestionará su propia sede.'
                      : formData.role === 'reporter'
                        ? 'Invita un súper usuario con acceso de solo lectura a reportes.'
                        : 'Genera un link de registro personalizado.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
            {/* Role selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de invitación</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'parent', label: '👨‍👩‍👧 Padre/Madre' },
                  { id: 'coach', label: '🏋️ Entrenador' },
                  { id: 'athlete', label: '⚽ Atleta' },
                  { id: 'school_admin', label: '🔑 Administrador' },
                  { id: 'reporter', label: '📊 Súper Usuario' },
                  { id: 'guest', label: '👤 Invitado' },
                ].map((role) => (
                  <Button
                    key={role.id}
                    type="button"
                    variant={formData.role === role.id ? 'default' : 'outline'}
                    className={`text-xs h-9 px-2 transition-all ${formData.role === role.id
                      ? 'ring-2 ring-primary/30 shadow-sm'
                      : 'hover:bg-accent'
                      }`}
                    onClick={() => setFormData({
                      ...formData,
                      role: role.id as typeof formData.role,
                      ...(role.id !== 'parent' ? {
                        childName: '',
                        programId: '',
                        monthlyFee: defaultMonthlyFee
                      } : {})
                    })}
                  >
                    {role.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Info block for school_admin */}
            {formData.role === 'school_admin' && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
                <strong>Nota:</strong> El administrador invitado creará y gestionará su propia sede al registrarse. Verá solo los datos de su sede.
              </div>
            )}

            {/* Info block for reporter role */}
            {formData.role === 'reporter' && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-blue-700 dark:text-blue-400">
                <strong>Súper Usuario:</strong> Acceso de solo lectura a reportes y analíticas. No puede hacer cambios ni ver información financiera sensible.
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="parentEmail" className="text-sm font-medium">
                Email *
              </Label>
              <Input
                id="parentEmail"
                type="email"
                placeholder="ejemplo@correo.com"
                value={formData.parentEmail}
                onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                required
                className="h-10"
              />

              {/* Contact Suggestions */}
              {suggestedContacts.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Sugeridos:
                  </p>
                  <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                    {suggestedContacts.slice(0, 3).map(contact => (
                      <div
                        key={contact.email}
                        className="flex items-center justify-between p-2 rounded-md border border-dashed border-muted hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors group"
                        onClick={() => {
                          const newFormData = {
                            ...formData,
                            parentEmail: contact.email,
                            parentPhone: contact.phone || formData.parentPhone,
                          };
                          if (formData.role === 'parent') {
                            newFormData.childName = contact.childName || formData.childName;
                            newFormData.programId = contact.programId || formData.programId;
                            const prog = programs.find(p => p.id === contact.programId);
                            if (prog) newFormData.monthlyFee = prog.monthly_fee;
                          }
                          setFormData(newFormData);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold group-hover:text-primary">{contact.name || 'Sin nombre'}</span>
                          <span className="text-[10px] text-muted-foreground">{contact.email}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] h-5 group-hover:bg-primary group-hover:text-white transition-colors">
                          Usar
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp / Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="parentPhone" className="text-sm font-medium">WhatsApp / Teléfono</Label>
              <Input
                id="parentPhone"
                placeholder="Ej: 3001234567"
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                className="h-10"
              />
            </div>

            {/* Branch selector — only for coach */}
            {formData.role === 'coach' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Sede *</Label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Seleccionar sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}


            {/* Program selector — for parent and athlete */}
            {['parent', 'athlete'].includes(formData.role) && (
              <div className="space-y-1.5">
                <Label htmlFor="programId" className="text-sm font-medium">
                  Programa {formData.role === 'parent' ? '*' : '(opcional)'}
                </Label>
                <Select value={formData.programId} onValueChange={handleProgramChange}>
                  <SelectTrigger className="h-10">
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
              </div>
            )}

            {/* Child name — only for parent role */}
            {formData.role === 'parent' && (
              <div className="space-y-1.5">
                <Label htmlFor="childName" className="text-sm font-medium">Nombre del Hijo/a *</Label>
                <Input
                  id="childName"
                  placeholder="Ej: María Rodríguez"
                  value={formData.childName}
                  onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                  required
                  className="h-10"
                />
              </div>
            )}

            {/* Preview link */}
            {formData.parentEmail && (
              <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
                <LinkIcon className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                <div className="overflow-hidden">
                  <p className="text-xs font-medium">Link de registro:</p>
                  <p className="text-[10px] text-muted-foreground break-all leading-tight italic">
                    {generateRegistrationLink({})}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                className="px-4"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="px-6 shadow-sm"
                disabled={sendInvitationMutation.isPending}
              >
                <Send className="w-4 h-4 mr-2" />
                {sendInvitationMutation.isPending ? 'Creando...' : 'Crear & Copiar Link'}
              </Button>
              {formData.parentPhone && (
                <Button
                  type="button"
                  variant="outline"
                  className="px-4 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30"
                  onClick={() => sendWhatsApp({})}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
