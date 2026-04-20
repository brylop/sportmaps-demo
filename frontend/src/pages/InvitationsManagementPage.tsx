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
  Users, CreditCard, ChevronDown, Ban, Gift, Building2,
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
  monthly_fee: number | null;
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
    parentPhone: '+57',
    childName: '',
    teamId: '',          // → p_team_id  (equipo/grupo)
    offeringPlanId: '',  // → p_offering_plan_id (plan de sesiones)
    monthlyFee: defaultMonthlyFee,
    role: 'parent' as 'parent' | 'coach' | 'athlete' | 'referral' | 'school_admin' | 'reporter',
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

  // ── Cargar atletas (children) del equipo seleccionado ───────────────────────
  const { data: teamChildren = [] } = useQuery<Array<{ id: string; full_name: string; doc_number: string | null }>>({
    queryKey: ['team-children', formData.teamId, schoolId],
    queryFn: async () => {
      if (!schoolId || !formData.teamId) return [];
      const { data, error } = await (supabase.from('children') as any)
        .select('id, full_name, doc_number')
        .eq('school_id', schoolId)
        .eq('team_id', formData.teamId)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!formData.teamId,
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

  // Al abrir el dialog, preseleccionar la sede activa
  useEffect(() => {
    if (activeBranchId) (formData as any).selectedBranchId = activeBranchId;
  }, [activeBranchId, dialogOpen]);

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
        .select(`
          id,
          email,
          role_to_assign,
          status,
          created_at,
          expires_at,
          child_name,
          monthly_fee,
          parent_phone,
          team_id,
          offering_plan_id,
          school_branches(name)
        `)
        .eq('school_id', schoolId);
      if (activeBranchId) query = query.eq('branch_id', activeBranchId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const mapped = (data || []).map((inv: any) => ({
        id: inv.id,
        invited_email: inv.email,
        child_name: inv.child_name || '',
        parent_phone: inv.parent_phone || '',
        monthly_fee: inv.monthly_fee != null ? Number(inv.monthly_fee) : null,
        status: inv.status,
        created_at: inv.created_at,
        expires_at: inv.expires_at || null,
        role_to_assign: inv.role_to_assign,
        team_id: inv.team_id || null,
        offering_plan_id: inv.offering_plan_id || null,
        branch_name: inv.school_branches?.name || 'Sede Principal',
      })) as Invitation[];

      // ── Enrich: fill missing team/plan/fee from payments ──────────────
      const incomplete = mapped.filter(
        inv => ['parent', 'athlete'].includes(inv.role_to_assign || '') &&
               (!inv.team_id || !inv.offering_plan_id || inv.monthly_fee == null)
      );
      if (incomplete.length > 0) {
        const emails = [...new Set(incomplete.map(i => i.invited_email))];
        // Resolve profile IDs from emails
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('email', emails);
        const emailToProfileId = new Map((profiles || []).map((p: any) => [p.email, p.id]));

        const profileIds = [...emailToProfileId.values()].filter(Boolean);
        if (profileIds.length > 0) {
          // Get the most recent payment per parent for this school
          const { data: payments } = await (supabase.from('payments') as any)
            .select('parent_id, team_id, offering_plan_id, amount')
            .eq('school_id', schoolId)
            .in('parent_id', profileIds)
            .order('created_at', { ascending: false });

          if (payments && payments.length > 0) {
            // Build a map: parentId → first (most recent) payment with data
            const parentPaymentMap = new Map<string, any>();
            for (const pay of payments) {
              if (!parentPaymentMap.has(pay.parent_id) && (pay.team_id || pay.offering_plan_id)) {
                parentPaymentMap.set(pay.parent_id, pay);
              }
            }

            const updates: { id: string; team_id?: string; offering_plan_id?: string; monthly_fee?: number }[] = [];

            for (const inv of incomplete) {
              const profileId = emailToProfileId.get(inv.invited_email);
              const pay = profileId ? parentPaymentMap.get(profileId) : null;
              if (!pay) continue;

              const patch: typeof updates[0] = { id: inv.id };
              let changed = false;

              if (!inv.team_id && pay.team_id) {
                inv.team_id = pay.team_id;
                patch.team_id = pay.team_id;
                changed = true;
              }
              if (!inv.offering_plan_id && pay.offering_plan_id) {
                inv.offering_plan_id = pay.offering_plan_id;
                patch.offering_plan_id = pay.offering_plan_id;
                changed = true;
              }
              if (inv.monthly_fee == null && pay.amount) {
                inv.monthly_fee = Number(pay.amount);
                patch.monthly_fee = Number(pay.amount);
                changed = true;
              }

              if (changed) updates.push(patch);
            }

            // Persist patches to DB so they're filled permanently
            for (const upd of updates) {
              const { id, ...fields } = upd;
              await (supabase.from('invitations') as any)
                .update(fields)
                .eq('id', id);
            }
          }
        }
      }

      return mapped;
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

  // ── Filtrado y ordenamiento ──────────────────────────────────────────────────
  const filteredInvitations = invitations
    .filter(inv => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      const s = searchTerm.toLowerCase();
      if (!s) return true;
      return (
        inv.invited_email.toLowerCase().includes(s) ||
        inv.child_name.toLowerCase().includes(s) ||
        (teams.find(t => t.id === inv.team_id)?.name || '').toLowerCase().includes(s) ||
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

    const params = new URLSearchParams({ school: schoolId || '', invite: inviteId, role });
    if (email) params.append('email', email);
    if (child) params.append('child', child);
    if (team) params.append('program', team);
    
    return `${window.location.origin}/register?${params.toString()}`;
  };

  const sendWhatsApp = (invitation: Partial<Invitation>) => {
    const link = generateRegistrationLink(invitation);
    const role = invitation.role_to_assign || formData.role;
    const phone = (invitation.parent_phone || formData.parentPhone).replace(/\D/g, '');

    const messages: Record<string, string> = {
      parent: `¡Hola! Te invitamos a inscribir a ${invitation.child_name || formData.childName} en ${schoolName}. Completa el registro aquí: ${link}`,
      coach: `¡Hola! Te invitamos a unirte como entrenador en ${schoolName}. Completa tu registro aquí: ${link}`,
      athlete: `¡Hola! Te invitamos a unirte como atleta en ${schoolName}. Completa tu registro aquí: ${link}`,
      school_admin: `¡Hola! Te invitamos a administrar una sede en ${schoolName}. Completa tu registro aquí: ${link}`,
      reporter: `¡Hola! Te invitamos a acceder como súper usuario en ${schoolName}. Completa tu registro aquí: ${link}`,
      guest: `¡Hola! Te invitamos a conocer ${schoolName}. Completa tu registro aquí: ${link}`,
    };

    const message = messages[role] ?? `¡Hola! Te invitamos a unirte a ${schoolName}. Completa tu registro aquí: ${link}`;

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
        p_team_id: ['parent', 'athlete', 'coach'].includes(data.role) ? (data.teamId || null) : null,
        p_monthly_fee: ['parent', 'athlete'].includes(data.role) ? fee : null,
        p_parent_phone: data.parentPhone || null,
        p_branch_id: (formData as any).selectedBranchId || activeBranchId || null,
        p_offering_plan_id: data.offeringPlanId || null,
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
      const phone = formData.parentPhone.replace(/\D/g, '');
      const role = formData.role;

      setFormData({ parentEmail: '', parentPhone: '+57', childName: '', teamId: '', offeringPlanId: '', monthlyFee: defaultMonthlyFee, role: 'parent' });
      (formData as any).selectedBranchId = activeBranchId || '';

      toast({
        title: '✅ Invitación creada',
        description: `Invitación registrada para ${email || phone}.`,
      });

      if (result.registration_link) {
        navigator.clipboard.writeText(result.registration_link);
        toast({ title: '📋 Link copiado automáticamente', description: 'Compártelo por WhatsApp o email.' });

        // Si hay teléfono, abrir WhatsApp automáticamente con el link real
        if (phone.length >= 7) {
          const messages: Record<string, string> = {
            parent: `¡Hola! Te invitamos a inscribir a ${formData.childName} en ${schoolName}. Regístrate aquí: ${result.registration_link}`,
            coach: `¡Hola! Te invitamos como entrenador en ${schoolName}: ${result.registration_link}`,
            athlete: `¡Hola! Te invitamos como atleta en ${schoolName}: ${result.registration_link}`,
            school_admin: `¡Hola! Te invitamos a administrar una sede en ${schoolName}: ${result.registration_link}`,
            reporter: `¡Hola! Te invitamos como súper usuario en ${schoolName}: ${result.registration_link}`,
          };
          const msg = messages[role] ?? `¡Hola! Únete a ${schoolName}: ${result.registration_link}`;

          // Pequeño delay para que el toast se vea antes de abrir WA
          setTimeout(() => {
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
          }, 600);
        }
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message
        : (typeof error === 'object' && error !== null && 'message' in error)
          ? String((error as any).message) : String(error);
      toast({ title: '❌ Error', description: `No se pudo enviar la invitación: ${message}`, variant: 'destructive' });
    },
  });

  // ── Mutación cancelar invitación ──────────────────────────────────────────────
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await (supabase.from('invitations') as any)
        .update({ status: 'cancelled' })
        .eq('id', invitationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({ title: 'Invitación cancelada', description: 'La invitación fue cancelada correctamente.' });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: '❌ Error', description: `No se pudo cancelar: ${message}`, variant: 'destructive' });
    },
  });

  const createReferralMutation = useMutation({
    mutationFn: async ({ email, message }: { email: string; message?: string }) => {
      const { data, error } = await (supabase.rpc as any)('create_school_referral', {
        p_referred_email: email,
        p_message: message || null,
      });
      if (error) throw error;
      return data as { id: string; code: string; referrer: string; link_path: string };
    },
    onSuccess: (result) => {
      const fullLink = `${window.location.host}${result.link_path}`;
      navigator.clipboard.writeText(fullLink);
      setDialogOpen(false);
      setFormData(prev => ({ ...prev, role: 'parent', parentEmail: '', parentPhone: '' }));
      toast({ title: '🏫 Referido creado', description: 'Link copiado al portapapeles. Compártelo con la academia.' });
      queryClient.invalidateQueries({ queryKey: ['school-referrals', schoolId] });
    },
    onError: (err: any) => {
      toast({ title: '❌ Error', description: err.message || 'No se pudo crear el referido.', variant: 'destructive' });
    },
  });

  const sendReferralWhatsApp = (code: string, phone?: string) => {
    const link = `${window.location.origin}/register?role=school&ref=${code}`;
    const msg = `¡Hola! Te invito a unirte a SportMaps, la plataforma para gestionar tu escuela deportiva. Regístrate aquí: ${link}`;
    const p = (phone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${p ? p : ''}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const getReferralStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case 'registered': return <Badge className="bg-blue-500"><Check className="w-3 h-3 mr-1" />Registrada</Badge>;
      case 'active': return <Badge className="bg-teal-500"><Check className="w-3 h-3 mr-1" />Activa</Badge>;
      case 'rewarded': return <Badge className="bg-green-500"><Gift className="w-3 h-3 mr-1" />Recompensado</Badge>;
      case 'expired': return <Badge variant="outline" className="text-orange-500 border-orange-300"><Clock className="w-3 h-3 mr-1" />Expirado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const hasValidContact = () => {
    const hasEmail = formData.parentEmail.trim() !== '';
    const hasPhone = formData.parentPhone.replace(/\D/g, '').length >= 7;
    return hasEmail || hasPhone;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasValidContact()) {
      toast({
        title: 'Dato requerido',
        description: 'Ingresa al menos un email o número de WhatsApp.',
        variant: 'destructive',
      });
      return;
    }
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
                      {['parent', 'athlete'].includes(inv.role_to_assign || '')
                        ? (inv.monthly_fee != null ? formatCurrency(Number(inv.monthly_fee)) : '—')
                        : '—'}
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
                        {inv.status === 'pending' && (
                          <Button
                            variant="ghost" size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Cancelar invitación"
                            disabled={cancelInvitationMutation.isPending}
                            onClick={() => {
                              if (confirm(`¿Cancelar la invitación para ${inv.invited_email}?`)) {
                                cancelInvitationMutation.mutate(inv.id);
                              }
                            }}
                          >
                            <Ban className="w-4 h-4" />
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

      {/* ── Dialog nueva invitación (Unificado) ────────────────────────────── */}
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
                        : formData.role === 'referral'
                          ? 'Comparte un link de registro para que otra academia se una a SportMaps.'
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
                  { id: 'referral', label: '🏫 Referencia' },
                ].map(role => (
                  <Button key={role.id} type="button"
                    variant={formData.role === role.id ? 'default' : 'outline'}
                    className={`text-xs h-9 px-2 transition-all ${formData.role === role.id ? 'ring-2 ring-primary/30 shadow-sm' : 'hover:bg-accent'}`}
                    onClick={() => setFormData({
                      ...formData,
                      role: role.id as typeof formData.role,
                      ...(role.id !== 'parent' ? { childName: '' } : {}),
                      ...(['school_admin', 'reporter', 'referral'].includes(role.id)
                        ? { teamId: '', offeringPlanId: '', monthlyFee: defaultMonthlyFee }
                        : {}),
                    })}>
                    {role.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* ── MODO REFERIDO: form simplificado ── */}
            {formData.role === 'referral' ? (
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-3 text-sm text-blue-700 dark:text-blue-400">
                  Se generará un link único con código de referido. La academia invitada lo usará al registrarse.
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="referralEmail" className="text-sm font-medium">Email del director / dueño *</Label>
                  <Input
                    id="referralEmail" type="email" placeholder="director@otraescuela.com"
                    value={formData.parentEmail} className="h-10"
                    onChange={e => setFormData({ ...formData, parentEmail: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Teléfono (opcional)</Label>
                  <Input
                    placeholder="3001234567" className="h-10"
                    value={formData.parentPhone}
                    onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                  />
                </div>

                {formData.parentEmail && (
                  <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2 border border-dashed border-primary/20">
                    <LinkIcon className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-xs font-medium">Link que se generará:</p>
                      <p className="text-[10px] text-muted-foreground break-all leading-tight italic">
                        {`${window.location.host}/register?role=school&ref=SM••••••`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* ── MODO NORMAL: campos existentes ── */}
                <div className="space-y-1.5">
                  <Label htmlFor="parentEmail" className="text-sm font-medium">
                    Email
                    <span className="text-muted-foreground font-normal ml-1">(o WhatsApp)</span>
                  </Label>
                  <Input
                    id="parentEmail" type="email" placeholder="ejemplo@correo.com"
                    value={formData.parentEmail} className="h-10"
                    onChange={e => setFormData({ ...formData, parentEmail: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Requerido para enviar el link por email. Puedes usar solo WhatsApp si prefieres.
                  </p>
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
                                childName: contact.childName || prev.childName,
                                teamId: contact.teamId || prev.teamId,
                                parentPhone: contact.phone || prev.parentPhone,
                                monthlyFee: t?.monthly_fee || prev.monthlyFee,
                              }));
                            }}>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-medium group-hover:text-primary transition-colors">{contact.email}</span>
                              {contact.name && <span className="text-[9px] text-muted-foreground">{contact.name}</span>}
                            </div>
                            <Check className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="parentPhone" className="text-sm font-medium">Teléfono / WhatsApp</Label>
                  <Input
                    id="parentPhone" type="tel" placeholder="300..."
                    value={formData.parentPhone} className="h-10"
                    onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                  />
                </div>

                {formData.role === 'parent' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="childName" className="text-sm font-medium">Nombre del hijo/a *</Label>

                    {/* Si el equipo tiene atletas registrados, mostrar dropdown para elegir */}
                    {formData.teamId && teamChildren.length > 0 && (
                      <Select
                        value={
                          teamChildren.find(c => c.full_name === formData.childName)?.id || 'manual'
                        }
                        onValueChange={val => {
                          if (val === 'manual') {
                            setFormData(prev => ({ ...prev, childName: '' }));
                          } else {
                            const picked = teamChildren.find(c => c.id === val);
                            if (picked) setFormData(prev => ({ ...prev, childName: picked.full_name }));
                          }
                        }}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={`Elegir del equipo (${teamChildren.length} atletas)`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">— Escribir nombre nuevo —</SelectItem>
                          {teamChildren.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.full_name}{c.doc_number ? ` · ${c.doc_number}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Input
                      id="childName" placeholder="Nombre completo"
                      value={formData.childName} required className="h-10"
                      onChange={e => setFormData({ ...formData, childName: e.target.value })}
                    />

                    {formData.teamId && teamChildren.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Este equipo aún no tiene atletas registrados — escribe el nombre manualmente.
                      </p>
                    )}
                  </div>
                )}

                {branches.length > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Sede de la invitación</Label>
                    <Select
                      value={(formData as any).selectedBranchId || activeBranchId || ''}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, selectedBranchId: val } as any))}
                    >
                      <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar sede" /></SelectTrigger>
                      <SelectContent>
                        {branches.map((b: any) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {['parent', 'athlete', 'coach'].includes(formData.role) && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Equipo / Grupo</Label>
                    <Select value={formData.teamId || 'none'} onValueChange={handleTeamChange}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar equipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin equipo (manual)</SelectItem>
                        {teams.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {['parent', 'athlete'].includes(formData.role) && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Plan de sesiones</Label>
                    <Select value={formData.offeringPlanId || 'none'} onValueChange={handlePlanChange}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar plan" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin plan</SelectItem>
                        {offeringPlans.map(op => (
                          <SelectItem key={op.id} value={op.id} className="text-xs">
                            {op.name} ({formatCurrency(op.price)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {['parent', 'athlete'].includes(formData.role) && (
                  <div className="space-y-1.5 p-3 rounded-lg bg-primary/5 border border-primary/10 transition-all">
                    <Label className="text-sm font-semibold flex items-center justify-between">
                      Mensualidad / Cobro inicial
                      <Badge variant="secondary" className="font-normal text-[10px]">COP</Badge>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number" value={formData.monthlyFee || ''}
                        className="pl-7 h-10 font-bold text-primary"
                        onChange={e => setFormData({ ...formData, monthlyFee: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                )}

                <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2 border border-dashed">
                  <LinkIcon className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium">Vista previa del link:</p>
                    <p className="text-[10px] text-muted-foreground break-all leading-tight italic">
                      {generateRegistrationLink({})}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Acciones */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>

              {formData.role === 'referral' ? (
                <Button
                  type="button"
                  disabled={!formData.parentEmail || createReferralMutation.isPending}
                  onClick={() => createReferralMutation.mutate({
                    email: formData.parentEmail,
                    message: undefined,
                  })}
                  className="px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  {createReferralMutation.isPending ? 'Creando...' : 'Crear & Copiar Link'}
                </Button>
              ) : (
                <Button type="submit" disabled={sendInvitationMutation.isPending || !hasValidContact()} className="px-6">
                  <Send className="w-4 h-4 mr-2" />
                  {sendInvitationMutation.isPending ? 'Creando...' : 'Crear & Copiar Link'}
                </Button>
              )}

              {formData.parentPhone.replace(/\D/g, '').length >= 7 && formData.role !== 'referral' && (
                <Button type="submit"
                  variant="outline"
                  disabled={sendInvitationMutation.isPending || !hasValidContact()}
                  className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {sendInvitationMutation.isPending ? 'Creando...' : 'Crear & Enviar WA'}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}