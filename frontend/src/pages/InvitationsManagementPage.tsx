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
  UserPlus, Search, X as XIcon, Clock, Check,
  Copy, MessageCircle, Send, Link as LinkIcon, Mail,
  Users, CreditCard, ChevronDown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchoolContext } from '@/hooks/useSchoolContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Invitation {
  id: string;
  invited_email: string;
  child_name: string;
  team_name: string;
  monthly_fee: number;
  status: string;
  created_at: string;
  expires_at?: string;
  parent_phone?: string;
  role_to_assign?: string;
  team_id?: string;
  offering_plan_id?: string;
  branch_name?: string;
}

interface OfferingPlan {
  id: string;
  name: string;
  price: number;
  max_sessions: number | null;
  duration_days: number;
  offering_name: string;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function InvitationsManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { schoolId, schoolName, teams, defaultMonthlyFee, currentUserRole, activeBranchId } = useSchoolContext();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    parentEmail: '',
    parentPhone: '',
    childName: '',
    teamId: '',          // → p_team_id  (equipo/grupo)
    offeringPlanId: '',  // → p_offering_plan_id (plan de sesiones)
    monthlyFee: defaultMonthlyFee,
    role: 'parent' as 'parent' | 'coach' | 'athlete' | 'guest' | 'school_admin' | 'reporter',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [suggestedContacts, setSuggestedContacts] = useState<
    { name: string; email: string; phone?: string; childName?: string; teamId?: string }[]
  >([]);

  // ── Cargar offering plans de la escuela ─────────────────────────────────────
  const { data: offeringPlans = [] } = useQuery<OfferingPlan[]>({
    queryKey: ['offering-plans', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('offering_plans')
        .select('id, name, price, max_sessions, duration_days, offerings(name)')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('price');
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        max_sessions: p.max_sessions,
        duration_days: p.duration_days,
        offering_name: p.offerings?.name ?? '',
      }));
    },
    enabled: !!schoolId,
  });

  // ── Leer URL params al abrir ─────────────────────────────────────────────────
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
        teamId: program || prev.teamId,
        parentPhone: phone || prev.parentPhone,
      }));
      setDialogOpen(true);
    }
  }, [searchParams]);

  // ── Sugerencias de contactos ─────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;
    const fetchSuggestions = async () => {
      let contacts: typeof suggestedContacts = [];
      if (formData.role === 'parent') {
        const { data } = await supabase
          .from('children' as any)
          .select('full_name, parent_email_temp, parent_phone_temp, team_id')
          .eq('school_id', schoolId)
          .not('parent_email_temp', 'is', null);
        if (data) {
          contacts = (data as any[]).map(d => ({
            name: '',
            email: d.parent_email_temp || '',
            phone: d.parent_phone_temp || '',
            childName: d.full_name || '',
            teamId: d.team_id || '',
          }));
        }
      } else if (['coach', 'athlete'].includes(formData.role)) {
        const { data } = await supabase
          .from('school_members')
          .select('role, profiles(full_name, email, phone)')
          .eq('school_id', schoolId)
          .eq('role', formData.role);
        if (data) {
          contacts = (data as any[]).map(d => ({
            name: d.profiles?.full_name || '',
            email: d.profiles?.email || '',
            phone: d.profiles?.phone || '',
          }));
        }
      }
      const unique = Array.from(new Set(contacts.map(c => c.email)))
        .map(email => contacts.find(c => c.email === email)!)
        .filter(c => c.email);
      setSuggestedContacts(unique);
    };
    fetchSuggestions();
  }, [schoolId, formData.role]);

  // ── Query invitaciones ───────────────────────────────────────────────────────
  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ['invitations', schoolId, activeBranchId],
    queryFn: async () => {
      if (!schoolId) return [];
      let query = (supabase.from('invitations') as any)
        .select('*, school_branches(name)')
        .eq('school_id', schoolId);
      if (activeBranchId) query = query.eq('branch_id', activeBranchId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      
      return (data || []).map((inv: any) => ({
        id: inv.id,
        invited_email: inv.email,
        child_name: inv.child_name || '',
        team_name: teams.find(t => t.id === inv.team_id)?.name || 'N/A',
        parent_phone: '',
        status: inv.status,
        created_at: inv.created_at,
        expires_at: inv.expires_at || null,
        role_to_assign: inv.role_to_assign,
        team_id: inv.team_id,
        offering_plan_id: inv.offering_plan_id,
        branch_name: inv.school_branches?.name || 'Sede Principal',
      })) as Invitation[];
    },
    enabled: !!schoolId,
  });

  // ── Filtrado y ordenamiento ──────────────────────────────────────────────────
  const filteredInvitations = invitations
    .filter(inv => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      const s = searchTerm.toLowerCase();
      if (!s) return true;
      return (
        inv.invited_email.toLowerCase().includes(s) ||
        inv.child_name.toLowerCase().includes(s) ||
        inv.team_name.toLowerCase().includes(s) ||
        (inv.parent_phone && inv.parent_phone.includes(s))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'name') return (a.child_name || a.invited_email).localeCompare(b.child_name || b.invited_email);
      return 0;
    });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const generateRegistrationLink = (invitation: Partial<Invitation>) => {
    const role = invitation.role_to_assign || formData.role;
    const email = invitation.invited_email || formData.parentEmail;
    const inviteId = invitation.id || '';
    const child = invitation.child_name || formData.childName;
    const team = invitation.team_id || formData.teamId;

    const params = new URLSearchParams({ school: schoolId || '', email: email || '', invite: inviteId, role });
    if (role === 'parent') {
      if (child) params.append('child', child);
      if (team) params.append('program', team);
    }
    return `${window.location.origin}/register?${params.toString()}`;
  };

  const sendWhatsApp = (invitation: Partial<Invitation>) => {
    const link = generateRegistrationLink(invitation);
    const childName = invitation.child_name || formData.childName;
    const message = `¡Hola! Te invitamos a inscribir a ${childName} en ${schoolName}. Completa el registro aquí: ${link}`;
    const phone = (invitation.parent_phone || formData.parentPhone).replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const resendEmail = async (invitation: Invitation) => {
    const link = generateRegistrationLink(invitation);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          type: 'parent_invitation',
          to: invitation.invited_email,
          data: { schoolName, childName: invitation.child_name || '', registrationUrl: link },
        }),
      });
      toast({ title: '📧 Correo reenviado', description: `Email enviado a ${invitation.invited_email}` });
    } catch {
      toast({ title: 'Error al reenviar', description: 'No se pudo enviar el correo.', variant: 'destructive' });
    }
  };

  const copyLinkToClipboard = (invitation: Invitation) => {
    navigator.clipboard.writeText(generateRegistrationLink(invitation));
    toast({ title: '📋 Link copiado', description: 'Compártelo por WhatsApp o email.' });
  };

  // ── Mutación crear invitación ────────────────────────────────────────────────
  const sendInvitationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const selectedTeam = teams.find(p => p.id === data.teamId);
      const fee = data.monthlyFee || selectedTeam?.monthly_fee || defaultMonthlyFee;

      const { data: inviteId, error } = await (supabase.rpc as any)('create_invitation', {
        p_email: data.parentEmail,
        p_role: data.role,
        p_child_name: data.role === 'parent' ? data.childName : null,
        p_team_id: ['parent', 'coach', 'athlete'].includes(data.role) ? (data.teamId || null) : null,
        p_monthly_fee: data.role === 'parent' ? fee : null,
        p_parent_phone: data.parentPhone || null,
        p_branch_id: activeBranchId || null,
        p_offering_plan_id: data.offeringPlanId || null,  // ← NUEVO
      });
      if (error) throw error;

      const registration_link = `${window.location.origin}/register?email=${encodeURIComponent(data.parentEmail)}&role=${data.role}&invite=${inviteId}`;
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          type: 'parent_invitation',
          to: data.parentEmail,
          data: { schoolName, childName: data.childName || '', registrationUrl: registration_link },
        }),
      }).catch(err => console.warn('Email send failed:', err));

      return { id: inviteId, registration_link };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.refetchQueries({ queryKey: ['invitations', schoolId, activeBranchId] });
      setDialogOpen(false);
      const email = formData.parentEmail;
      setFormData({ parentEmail: '', parentPhone: '', childName: '', teamId: '', offeringPlanId: '', monthlyFee: defaultMonthlyFee, role: 'parent' });
      toast({ title: '✅ Invitación creada', description: `Invitación registrada para ${email}.` });
      if (result.registration_link) {
        navigator.clipboard.writeText(result.registration_link);
        toast({ title: '📋 Link copiado automáticamente', description: 'Compártelo por WhatsApp o email.' });
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message
        : (typeof error === 'object' && error !== null && 'message' in error)
          ? String((error as any).message) : String(error);
      toast({ title: '❌ Error', description: `No se pudo enviar la invitación: ${message}`, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendInvitationMutation.mutate(formData);
  };

  // ── Cuando el equipo cambia, autocompletar mensualidad desde price_monthly ───
  const handleTeamChange = (val: string) => {
    const teamId = val === 'none' ? '' : val;
    const t = teams.find(p => p.id === teamId);
    setFormData(prev => ({ ...prev, teamId, monthlyFee: t?.monthly_fee || prev.monthlyFee }));
  };

  // ── Cuando el plan cambia, autocompletar mensualidad desde price ─────────────
  const handlePlanChange = (val: string) => {
    const planId = val === 'none' ? '' : val;
    const p = offeringPlans.find(op => op.id === planId);
    setFormData(prev => ({ ...prev, offeringPlanId: planId, monthlyFee: p?.price || prev.monthlyFee }));
  };

  // ── Badges ───────────────────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" />Aceptada</Badge>;
      case 'pending': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case 'rejected': return <Badge variant="destructive"><XIcon className="w-3 h-3 mr-1" />Rechazada</Badge>;
      case 'expired': return <Badge variant="outline" className="text-orange-500 border-orange-300"><Clock className="w-3 h-3 mr-1" />Expirada</Badge>;
      case 'cancelled': return <Badge variant="outline" className="text-gray-400 border-gray-300"><XIcon className="w-3 h-3 mr-1" />Cancelada</Badge>;
      default: return <Badge variant="outline" className="text-gray-400">{status}</Badge>;
    }
  };

  const stats = {
    total: invitations.length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    pending: invitations.filter(i => i.status === 'pending').length,
    rejected: invitations.filter(i => i.status === 'rejected').length,
    expired: invitations.filter(i => i.status === 'expired').length,
  };

  // ── Etiqueta de asignación para la tabla ─────────────────────────────────────
  const getAssignmentLabel = (inv: Invitation) => {
    const teamName = teams.find(p => p.id === inv.team_id)?.name;
    const planName = offeringPlans.find(op => op.id === inv.offering_plan_id)
      ? `${offeringPlans.find(op => op.id === inv.offering_plan_id)!.name} — ${offeringPlans.find(op => op.id === inv.offering_plan_id)!.offering_name}`
      : null;
    if (teamName && planName) return { team: teamName, plan: planName };
    if (teamName) return { team: teamName, plan: null };
    if (planName) return { team: null, plan: planName };
    return { team: null, plan: null };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto p-6 space-y-6">

      {/* ── Barra superior ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, teléfono..."
            className="pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button variant="ghost" size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchTerm('')}>
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Más recientes</SelectItem>
              <SelectItem value="oldest">Más antiguos</SelectItem>
              <SelectItem value="name">Por nombre</SelectItem>
            </SelectContent>
          </Select>
          {(searchTerm || statusFilter !== 'all') && (
            <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
              Limpiar filtros
            </Button>
          )}
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Nueva Invitación
          </Button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { label: 'Total', value: stats.total, filter: 'all', color: 'primary' },
          { label: 'Aceptadas', value: stats.accepted, filter: 'accepted', color: 'green-500' },
          { label: 'Pendientes', value: stats.pending, filter: 'pending', color: 'yellow-500' },
          { label: 'Rechazadas', value: stats.rejected, filter: 'rejected', color: 'red-500' },
          { label: 'Expiradas', value: stats.expired, filter: 'expired', color: 'orange-500' },
        ].map(s => (
          <Card key={s.filter}
            className={`cursor-pointer transition-all hover:ring-2 hover:ring-${s.color}/20 ${statusFilter === s.filter ? `ring-2 ring-${s.color} ring-offset-2` : 'opacity-80 hover:opacity-100'}`}
            onClick={() => setStatusFilter(s.filter)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${s.color !== 'primary' ? `text-${s.color}` : ''}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Invitaciones enviadas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email / Rol</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Hijo / Equipo / Plan</TableHead>
                <TableHead>Mensualidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvitations.map(inv => {
                const assignment = getAssignmentLabel(inv);
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{inv.invited_email}</span>
                        </div>
                        <Badge variant="secondary" className="w-fit text-[10px] capitalize font-normal">
                          {inv.role_to_assign === 'parent' ? 'Padre' :
                            inv.role_to_assign === 'coach' ? 'Entrenador' :
                              inv.role_to_assign === 'athlete' ? 'Atleta' :
                                inv.role_to_assign === 'school_admin' ? 'Admin Sede' :
                                  inv.role_to_assign === 'reporter' ? 'Súper Usuario' : 'Invitado'}
                        </Badge>
                        {inv.parent_phone && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <MessageCircle className="w-3 h-3 text-green-500" />
                            <span className="text-xs text-muted-foreground">{inv.parent_phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-medium">{inv.branch_name}</TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {inv.child_name && inv.child_name !== '—' && (
                          <span className="font-medium text-xs">{inv.child_name}</span>
                        )}
                        {assignment.team && (
                          <Badge variant="outline" className="w-fit text-[10px] font-normal flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />{assignment.team}
                          </Badge>
                        )}
                        {assignment.plan && (
                          <Badge variant="outline" className="w-fit text-[10px] font-normal flex items-center gap-1 border-purple-200 text-purple-700">
                            <CreditCard className="w-2.5 h-2.5" />{assignment.plan}
                          </Badge>
                        )}
                        {!assignment.team && !assignment.plan && inv.role_to_assign === 'parent' && (
                          <span className="text-xs text-muted-foreground">Sin asignar</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="font-semibold text-primary">
                      {inv.role_to_assign === 'parent' ? formatCurrency(inv.monthly_fee) : '—'}
                    </TableCell>

                    <TableCell>{getStatusBadge(inv.status)}</TableCell>

                    <TableCell className="text-xs">
                      {format(new Date(inv.created_at), 'PPP', { locale: es })}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => copyLinkToClipboard(inv)} title="Copiar link">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => sendWhatsApp(inv)} title="Enviar por WhatsApp">
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        {inv.status === 'pending' && (
                          <Button variant="ghost" size="sm" onClick={() => resendEmail(inv)} title="Reenviar email">
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredInvitations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                    No hay invitaciones{statusFilter !== 'all' ? ` con estado "${statusFilter}"` : ''}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Dialog nueva invitación ────────────────────────────────────────── */}
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
                  ? 'Invita a un padre para inscribir a su hijo en un equipo o plan.'
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

          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5 max-h-[70vh] overflow-y-auto">

            {/* Selector de rol */}
            <div className="space-y-2 pt-4">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo de invitación
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'parent', label: '👨‍👩‍👧 Padre/Madre' },
                  { id: 'coach', label: '🏋️ Entrenador' },
                  { id: 'athlete', label: '⚽ Atleta' },
                  { id: 'school_admin', label: '🔑 Administrador' },
                  { id: 'reporter', label: '📊 Súper Usuario' },
                  { id: 'guest', label: '👤 Invitado' },
                ].map(role => (
                  <Button key={role.id} type="button"
                    variant={formData.role === role.id ? 'default' : 'outline'}
                    className={`text-xs h-9 px-2 transition-all ${formData.role === role.id ? 'ring-2 ring-primary/30 shadow-sm' : 'hover:bg-accent'}`}
                    onClick={() => setFormData({
                      ...formData,
                      role: role.id as typeof formData.role,
                      ...(role.id !== 'parent' ? { childName: '', teamId: '', offeringPlanId: '', monthlyFee: defaultMonthlyFee } : {}),
                    })}>
                    {role.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Info blocks */}
            {formData.role === 'school_admin' && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
                <strong>Nota:</strong> El administrador invitado creará y gestionará su propia sede al registrarse.
              </div>
            )}
            {formData.role === 'reporter' && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-blue-700 dark:text-blue-400">
                <strong>Súper Usuario:</strong> Acceso de solo lectura a reportes y analíticas.
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="parentEmail" className="text-sm font-medium">Email *</Label>
              <Input
                id="parentEmail" type="email" placeholder="ejemplo@correo.com"
                value={formData.parentEmail} required className="h-10"
                onChange={e => setFormData({ ...formData, parentEmail: e.target.value })}
              />
              {/* Sugerencias */}
              {suggestedContacts.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Sugeridos:
                  </p>
                  <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                    {suggestedContacts.slice(0, 3).map(contact => (
                      <div key={contact.email}
                        className="flex items-center justify-between p-2 rounded-md border border-dashed border-muted hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors group"
                        onClick={() => {
                          const t = teams.find(p => p.id === contact.teamId);
                          setFormData(prev => ({
                            ...prev,
                            parentEmail: contact.email,
                            parentPhone: contact.phone || prev.parentPhone,
                            childName: contact.childName || prev.childName,
                            teamId: contact.teamId || prev.teamId,
                            monthlyFee: t?.monthly_fee || prev.monthlyFee,
                          }));
                        }}>
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

            {/* Teléfono */}
            <div className="space-y-1.5">
              <Label htmlFor="parentPhone" className="text-sm font-medium">WhatsApp / Teléfono</Label>
              <Input
                id="parentPhone" placeholder="Ej: 3001234567" className="h-10"
                value={formData.parentPhone}
                onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
              />
            </div>

            {/* Nombre del hijo — solo para padre */}
            {formData.role === 'parent' && (
              <div className="space-y-1.5">
                <Label htmlFor="childName" className="text-sm font-medium">Nombre del hijo/a *</Label>
                <Input
                  id="childName" placeholder="Ej: María Rodríguez" required className="h-10"
                  value={formData.childName}
                  onChange={e => setFormData({ ...formData, childName: e.target.value })}
                />
              </div>
            )}

            {/* ── SECCIÓN ASIGNACIÓN (padre, coach, atleta) ────────────────── */}
            {['parent', 'coach', 'athlete'].includes(formData.role) && (
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Asignación
                </Label>

                {/* Equipo / grupo */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <Label htmlFor="teamId" className="text-sm font-medium">
                      Equipo / grupo
                      {formData.role !== 'parent' && <span className="text-muted-foreground font-normal ml-1">(opcional)</span>}
                    </Label>
                  </div>
                  <Select value={formData.teamId || 'none'} onValueChange={handleTeamChange}>
                    <SelectTrigger className="h-10" id="teamId">
                      <SelectValue placeholder="Seleccionar equipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sin equipo —</SelectItem>
                      {teams.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.monthly_fee ? ` — ${formatCurrency(p.monthly_fee)}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Plan de sesiones — solo para padre */}
                {formData.role === 'parent' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                      <Label htmlFor="offeringPlanId" className="text-sm font-medium">
                        Plan de sesiones
                        <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
                      </Label>
                    </div>
                    <Select value={formData.offeringPlanId || 'none'} onValueChange={handlePlanChange}>
                      <SelectTrigger className="h-10" id="offeringPlanId">
                        <SelectValue placeholder="Seleccionar plan..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sin plan —</SelectItem>
                        {offeringPlans.map(op => (
                          <SelectItem key={op.id} value={op.id}>
                            {op.name} — {op.offering_name}
                            {op.max_sessions ? ` (${op.max_sessions} ses.)` : ' (ilimitado)'}
                            {` — ${formatCurrency(op.price)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Si asignas un plan, se activa automáticamente al aceptar la invitación.
                    </p>
                  </div>
                )}

                {/* Mensualidad manual — solo si no hay equipo ni plan seleccionado */}
                {formData.role === 'parent' && !formData.teamId && !formData.offeringPlanId && (
                  <div className="space-y-1.5">
                    <Label htmlFor="monthlyFee" className="text-sm font-medium">Cuota mensual</Label>
                    <Input
                      id="monthlyFee" type="number" className="h-10"
                      value={formData.monthlyFee || ''}
                      onChange={e => setFormData({ ...formData, monthlyFee: Number(e.target.value) })}
                      placeholder="150000"
                    />
                  </div>
                )}

                {/* Resumen de lo que se asignará */}
                {(formData.teamId || formData.offeringPlanId) && (
                  <div className="rounded-md border border-dashed p-2.5 space-y-1 bg-muted/30">
                    <p className="text-[11px] font-medium text-muted-foreground">Al aceptar la invitación se asignará:</p>
                    {formData.teamId && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Users className="w-3 h-3 text-teal-600" />
                        <span className="text-teal-700 font-medium">
                          Equipo: {teams.find(p => p.id === formData.teamId)?.name}
                        </span>
                      </div>
                    )}
                    {formData.offeringPlanId && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <CreditCard className="w-3 h-3 text-purple-600" />
                        <span className="text-purple-700 font-medium">
                          Plan: {offeringPlans.find(op => op.id === formData.offeringPlanId)?.name}
                          {' — '}{offeringPlans.find(op => op.id === formData.offeringPlanId)?.offering_name}
                        </span>
                      </div>
                    )}
                  </div>
                )}
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

            {/* Acciones */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={sendInvitationMutation.isPending} className="px-6">
                <Send className="w-4 h-4 mr-2" />
                {sendInvitationMutation.isPending ? 'Creando...' : 'Crear & Copiar Link'}
              </Button>
              {formData.parentPhone && (
                <Button type="button" variant="outline"
                  className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30"
                  onClick={() => sendWhatsApp({})}>
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