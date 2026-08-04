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
  Pencil, RefreshCw,
} from 'lucide-react';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneInput } from '@/components/ui/phone-input';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { dbErrorMessage } from '@/lib/errors/dbErrorMessage';
import { invitationEmailPayload } from '@/lib/email/invitationEmail';

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
    unregisteredAthleteId: '',  // ← PATCH: ID del unregistered_athlete del bulk upload
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // ── Asignar equipo/plan/mensualidad a invitacion existente ──────────────────
  const [editingInv, setEditingInv] = useState<Invitation | null>(null);
  const [editForm, setEditForm] = useState<{ teamId: string; offeringPlanId: string; monthlyFee: number }>(
    { teamId: '', offeringPlanId: '', monthlyFee: 0 }
  );

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
    const email          = searchParams.get('email');
    const child          = searchParams.get('child');
    const program        = searchParams.get('program');
    const phone          = searchParams.get('phone');
    const unregisteredId = searchParams.get('unregisteredId');
    const roleParam      = searchParams.get('role');
    const branchParam    = searchParams.get('branch');
    const planIdParam    = searchParams.get('planId');

    if (email || child || program || phone || unregisteredId) {
      setFormData(prev => ({
        ...prev,
        parentEmail:           email          || prev.parentEmail,
        childName:             child          || prev.childName,
        teamId:                program        || prev.teamId,
        parentPhone:           phone          || prev.parentPhone,
        unregisteredAthleteId: unregisteredId || prev.unregisteredAthleteId,
        role:                  (roleParam as typeof prev.role) || prev.role,
        offeringPlanId:        planIdParam    || prev.offeringPlanId,
      }));

      // Pre-seleccionar sede si viene en el param
      if (branchParam) {
        (setFormData as any)(prev => ({ ...prev, selectedBranchId: branchParam }));
      }

      setDialogOpen(true);
    }
  }, [searchParams]);

  // ── Ajustar precio real (con descuento) si hay plan y atleta ───────────────
  useEffect(() => {
    const planIdParam = searchParams.get('planId');
    const unregisteredId = searchParams.get('unregisteredId');

    if (unregisteredId && planIdParam) {
      // Buscar el pago real del atleta para este plan
      supabase
        .from('payments')
        .select('amount, concept')
        .eq('unregistered_athlete_id', unregisteredId)
        .eq('offering_plan_id', planIdParam)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: payment }) => {
          if (payment?.amount) {
            setFormData(prev => ({
              ...prev,
              monthlyFee: payment.amount,
            }));
          } else {
            const plan = offeringPlans.find(p => p.id === planIdParam);
            if (plan) {
              setFormData(prev => ({ ...prev, monthlyFee: plan.price }));
            }
          }
        });
    } else if (planIdParam) {
      const plan = offeringPlans.find(p => p.id === planIdParam);
      if (plan) {
        setFormData(prev => ({ ...prev, monthlyFee: plan.price }));
      }
    }
  }, [searchParams, offeringPlans]);

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
  const { data: invitations = [], isLoading, isFetching, refetch } = useQuery<Invitation[]>({
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

    if (phone.length < 8) {
      toast({ 
        title: 'Sin número', 
        description: 'No hay teléfono registrado para esta invitación.', 
        variant: 'destructive' 
      });
      return;
    }

    const messages: Record<string, string> = {
      parent: `¡Hola! Te invitamos a inscribir a ${invitation.child_name || formData.childName} en ${schoolName}. Crea tu cuenta como acudiente y completa el registro del menor aquí: ${link}`,
      coach: `¡Hola! Te invitamos a unirte como entrenador en ${schoolName}. Completa tu registro aquí: ${link}`,
      athlete: `¡Hola! Te invitamos a unirte como atleta a ${schoolName}. Este registro es para ti (atleta mayor de edad), no para un acudiente: ${link}`,
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
        body: JSON.stringify(invitationEmailPayload({
          role: invitation.role_to_assign,
          to: invitation.invited_email,
          name: invitation.child_name,
          registrationUrl: link,
          schoolName,
        })),
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
        // child_name guarda el nombre de la persona invitada, no solo del menor:
        // es el campo que las plantillas de correo leen al reenviar. Se guarda para
        // los roles que tienen campo de nombre en el form. (Para atleta es seguro:
        // accept_invitation_pro empareja unregistered_athletes por invitation_id y
        // por email, nunca por child_name.)
        p_child_name: ['parent', 'coach', 'athlete'].includes(data.role) ? (data.childName || null) : null,
        p_team_id: ['parent', 'athlete', 'coach'].includes(data.role) ? (data.teamId || null) : null,
        p_monthly_fee: ['parent', 'athlete'].includes(data.role) ? fee : null,
        p_parent_phone: data.parentPhone.replace(/\D/g, '').length >= 8 ? data.parentPhone : null,
        p_branch_id: (formData as any).selectedBranchId || activeBranchId || null,
        p_offering_plan_id: data.offeringPlanId || null,
        p_unregistered_athlete_id: data.unregisteredAthleteId || null,  // ← PATCH
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
        body: JSON.stringify(
          invitationEmailPayload({
            role: data.role,
            to: data.parentEmail,
            name: data.childName,
            registrationUrl: registration_link,
            schoolName,
          })
        ),
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

      setFormData({ parentEmail: '', parentPhone: '+57', childName: '', teamId: '', offeringPlanId: '', monthlyFee: defaultMonthlyFee, role: 'parent', unregisteredAthleteId: '' });
      (formData as any).selectedBranchId = activeBranchId || '';

      toast({
        title: '✅ Invitación creada',
        description: `Invitación registrada para ${email || phone}.`,
      });

      if (result.registration_link) {
        navigator.clipboard.writeText(result.registration_link);
        toast({ title: '📋 Link copiado automáticamente', description: 'Compártelo por WhatsApp o email.' });

        // Si hay teléfono, abrir WhatsApp automáticamente con el link real
        if (phone.length >= 8) {
          const messages: Record<string, string> = {
            parent: `¡Hola! Te invitamos a inscribir a ${formData.childName} en ${schoolName}. Regístrate como su acudiente aquí: ${result.registration_link}`,
            coach: `¡Hola! Te invitamos como entrenador en ${schoolName}: ${result.registration_link}`,
            athlete: `¡Hola! Te invitamos como atleta (mayor de edad) a ${schoolName}. Regístrate tú mismo aquí: ${result.registration_link}`,
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
      toast({
        title: '❌ No se pudo crear la invitación',
        description: dbErrorMessage(error, 'No se pudo crear la invitación. Intenta de nuevo.'),
        variant: 'destructive',
      });
    },
  });

  // ── Mutación asignar equipo/plan/mensualidad a invitación existente ─────────
  const updateInvitationMutation = useMutation({
    mutationFn: async () => {
      if (!editingInv) throw new Error('No invitation selected');
      if (!editForm.teamId && !editForm.offeringPlanId) {
        throw new Error('Selecciona un equipo o un plan de sesiones.');
      }
      if (!editForm.monthlyFee || editForm.monthlyFee <= 0) {
        throw new Error('La mensualidad debe ser mayor a $0.');
      }
      const { error } = await (supabase.from('invitations') as any)
        .update({
          team_id: editForm.teamId || null,
          offering_plan_id: editForm.offeringPlanId || null,
          monthly_fee: editForm.monthlyFee,
        })
        .eq('id', editingInv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.refetchQueries({ queryKey: ['invitations', schoolId, activeBranchId] });
      setEditingInv(null);
      toast({ title: '✅ Asignación guardada', description: 'Equipo, plan y mensualidad actualizados.' });
    },
    onError: (error: unknown) => {
      toast({
        title: '❌ No se pudo guardar',
        description: dbErrorMessage(error, 'No se pudo guardar la asignación.'),
        variant: 'destructive',
      });
    },
  });

  const openEditDialog = (inv: Invitation) => {
    setEditingInv(inv);
    const team = teams.find(t => t.id === inv.team_id);
    const plan = offeringPlans.find(op => op.id === inv.offering_plan_id);
    setEditForm({
      teamId: inv.team_id || '',
      offeringPlanId: inv.offering_plan_id || '',
      monthlyFee: inv.monthly_fee ?? plan?.price ?? team?.monthly_fee ?? defaultMonthlyFee ?? 0,
    });
  };

  const handleEditTeamChange = (val: string) => {
    const teamId = val === 'none' ? '' : val;
    const t = teams.find(p => p.id === teamId);
    setEditForm(prev => ({
      ...prev,
      teamId,
      monthlyFee: t?.monthly_fee || prev.monthlyFee,
    }));
  };

  const handleEditPlanChange = (val: string) => {
    const planId = val === 'none' ? '' : val;
    const p = offeringPlans.find(op => op.id === planId);
    setEditForm(prev => ({
      ...prev,
      offeringPlanId: planId,
      monthlyFee: p?.price || prev.monthlyFee,
    }));
  };

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
      toast({
        title: '❌ No se pudo cancelar',
        description: dbErrorMessage(error, 'No se pudo cancelar la invitación.'),
        variant: 'destructive',
      });
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
    if (['parent', 'athlete'].includes(formData.role) && !formData.teamId && !formData.offeringPlanId) {
      toast({
        title: 'Falta equipo o plan',
        description: 'Selecciona un equipo o un plan de sesiones para poder calcular la mensualidad.',
        variant: 'destructive',
      });
      return;
    }
    if (['parent', 'athlete'].includes(formData.role) && (!formData.monthlyFee || formData.monthlyFee <= 0)) {
      toast({
        title: 'Mensualidad requerida',
        description: 'La mensualidad debe ser mayor a $0 antes de enviar la invitación.',
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

  // ── Envío masivo de invitaciones ─────────────────────────────────────────────
  // El envío uno por uno choca con el rate limit de Resend y no deja rastro de
  // quién recibió qué. El BFF agrupa en lotes de 100 y registra cada destinatario
  // en email_sends, para poder reintentar SOLO los que fallaron.
  const { data: sendStatus, refetch: refetchSendStatus } = useQuery({
    queryKey: ['invitations-send-status', schoolId],
    queryFn: async () => {
      const { bffClient } = await import('@/lib/api/bffClient');
      return bffClient.get<{ pendientes: number; enviadas: number; fallidas: number; sin_intentar: number }>(
        '/api/v1/invitations/send-status'
      );
    },
    enabled: !!schoolId,
  });

  const bulkSendMutation = useMutation({
    mutationFn: async (filter: 'unsent' | 'pending') => {
      const { bffClient } = await import('@/lib/api/bffClient');
      return bffClient.post<{ message: string; total: number; sent: number; failed: number; aborted: boolean }>(
        '/api/v1/invitations/bulk-send',
        { filter }
      );
    },
    onSuccess: (result) => {
      refetchSendStatus();
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: result.aborted ? '⚠️ Envío detenido' : '📧 Envío completado',
        description: result.aborted
          ? `${result.message} Enviados: ${result.sent}.`
          : `Enviados: ${result.sent} · Fallidos: ${result.failed} de ${result.total}.`,
        variant: result.aborted || result.failed > 0 ? 'destructive' : undefined,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error en el envío masivo',
        description: error?.message || 'No se pudo completar el envío',
        variant: 'destructive',
      });
    },
  });

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

      {/* ── Envío masivo ──────────────────────────────────────────────────── */}
      {!!sendStatus && sendStatus.pendientes > 0 && (
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card p-4 rounded-lg border shadow-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="font-medium">
              {sendStatus.pendientes} invitación{sendStatus.pendientes === 1 ? '' : 'es'} pendiente{sendStatus.pendientes === 1 ? '' : 's'}
            </span>
            <span className="text-muted-foreground">Correo enviado: <strong>{sendStatus.enviadas}</strong></span>
            {sendStatus.fallidas > 0 && (
              <span className="text-destructive">Fallidos: <strong>{sendStatus.fallidas}</strong></span>
            )}
            {sendStatus.sin_intentar > 0 && (
              <span className="text-muted-foreground">Sin intentar: <strong>{sendStatus.sin_intentar}</strong></span>
            )}
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              disabled={bulkSendMutation.isPending || (sendStatus.fallidas + sendStatus.sin_intentar) === 0}
              onClick={() => bulkSendMutation.mutate('unsent')}
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar a los que faltan ({sendStatus.fallidas + sendStatus.sin_intentar})
            </Button>
            <Button
              variant="ghost"
              disabled={bulkSendMutation.isPending}
              onClick={() => bulkSendMutation.mutate('pending')}
              title="Reenvía a TODAS las pendientes, incluso a las que ya recibieron el correo"
            >
              Reenviar a todas
            </Button>
          </div>
        </div>
      )}

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
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Nueva Invitación
          </Button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      {/* Antes las clases de color se armaban interpolando (`ring-${color}`) y
          Tailwind no las generaba: las tarjetas nunca se veían resaltadas. */}
      <StatFilterBar
        columns={5}
        value={statusFilter === 'all' ? null : statusFilter}
        onChange={(v) => setStatusFilter(v ?? 'all')}
        items={[
          { key: null, label: 'Total', value: stats.total, tone: 'neutral' },
          { key: 'accepted', label: 'Aceptadas', value: stats.accepted, tone: 'emerald' },
          { key: 'pending', label: 'Pendientes', value: stats.pending, tone: 'yellow' },
          { key: 'rejected', label: 'Rechazadas', value: stats.rejected, tone: 'rose' },
          { key: 'expired', label: 'Expiradas', value: stats.expired, tone: 'orange' },
        ]}
      />

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
                <TableHead>Atleta / Equipo / Plan</TableHead>
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
                          {inv.role_to_assign === 'parent' ? 'Acudiente' :
                            inv.role_to_assign === 'coach' ? 'Entrenador' :
                              inv.role_to_assign === 'athlete' ? 'Atleta 18+' :
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
                        {['parent', 'athlete'].includes(inv.role_to_assign || '') && (
                          <Button
                            variant="ghost" size="sm"
                            className={inv.monthly_fee == null ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50' : ''}
                            onClick={() => openEditDialog(inv)}
                            title={inv.monthly_fee == null ? 'Asignar equipo/plan/mensualidad' : 'Editar equipo/plan/mensualidad'}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
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
          <TableRefreshBar
            className="-mx-6 -mb-6 mt-2 rounded-b-lg"
            onRefresh={refetch}
            loading={isFetching}
            summary={
              filteredInvitations.length === invitations.length
                ? `${invitations.length} invitación(es)`
                : `${filteredInvitations.length} de ${invitations.length} invitación(es)`
            }
          />
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
                  ? 'Invita al acudiente de un atleta menor de edad: él crea la cuenta, inscribe al menor y paga.'
                  : formData.role === 'athlete'
                    ? 'Invita a un atleta mayor de edad: se registra él mismo, sin acudiente, y paga su propio plan.'
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
                  { id: 'parent', label: '👨‍👩‍👧 Acudiente' },
                  { id: 'coach', label: '🏋️ Entrenador' },
                  { id: 'athlete', label: '⚽ Atleta 18+' },
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
                  <Label className="text-sm font-medium">WhatsApp</Label>
                  <PhoneInput
                    value={formData.parentPhone}
                    onChange={(v) => setFormData({ ...formData, parentPhone: v })}
                  />
                </div>

                {formData.role === 'parent' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="childName" className="text-sm font-medium">Nombre del menor a inscribir *</Label>

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

                {/* Nombre para los roles que no son acudiente. Sin esto el correo
                    saludaba "Hola entrenador," en vez de usar su nombre; se guarda
                    en child_name, que es el campo que las plantillas leen. */}
                {['coach', 'athlete'].includes(formData.role) && (
                  <div className="space-y-1.5">
                    <Label htmlFor="inviteeName" className="text-sm font-medium">
                      {formData.role === 'coach' ? 'Nombre del entrenador' : 'Nombre del atleta'}{' '}
                      <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="inviteeName" placeholder="Nombre completo" className="h-10"
                      value={formData.childName}
                      onChange={e => setFormData({ ...formData, childName: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se usa para personalizar el correo de invitación.
                    </p>
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
                    <Label className="text-sm font-medium">
                      Equipo / Grupo
                      {['parent', 'athlete'].includes(formData.role) && (
                        <span className="text-muted-foreground font-normal ml-1">(equipo o plan requerido)</span>
                      )}
                    </Label>
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
                    <Label className="text-sm font-medium">
                      Plan de sesiones
                      <span className="text-muted-foreground font-normal ml-1">(equipo o plan requerido)</span>
                    </Label>
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
                      Mensualidad / Cobro inicial *
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

      {/* ── Dialog editar asignación de invitación ───────────────────────── */}
      <Dialog open={!!editingInv} onOpenChange={(open) => !open && setEditingInv(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-primary/5 to-transparent">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                Asignar equipo y mensualidad
              </DialogTitle>
              <DialogDescription className="text-sm">
                {editingInv?.invited_email}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Equipo / Grupo
                <span className="text-muted-foreground font-normal ml-1">(equipo o plan requerido)</span>
              </Label>
              <Select value={editForm.teamId || 'none'} onValueChange={handleEditTeamChange}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar equipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin equipo</SelectItem>
                  {teams.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Plan de sesiones
                <span className="text-muted-foreground font-normal ml-1">(equipo o plan requerido)</span>
              </Label>
              <Select value={editForm.offeringPlanId || 'none'} onValueChange={handleEditPlanChange}>
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

            <div className="space-y-1.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Label className="text-sm font-semibold flex items-center justify-between">
                Mensualidad *
                <Badge variant="secondary" className="font-normal text-[10px]">COP</Badge>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number" value={editForm.monthlyFee || ''}
                  className="pl-7 h-10 font-bold text-primary"
                  onChange={e => setEditForm(prev => ({ ...prev, monthlyFee: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button type="button" variant="ghost" onClick={() => setEditingInv(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={updateInvitationMutation.isPending}
                onClick={() => updateInvitationMutation.mutate()}
                className="px-6"
              >
                {updateInvitationMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}