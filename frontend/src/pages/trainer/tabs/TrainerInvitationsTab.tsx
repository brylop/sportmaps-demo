/**
 * TrainerInvitationsTab
 *
 * Tab de invitaciones para el perfil del Entrenador Personal (PT).
 * Solo maneja roles: athlete | parent.
 * Sin sedes, sin referidos, sin roles administrativos.
 *
 * Soporta:
 *  - offering_plan_id  → autocompleta monthly_fee desde offering_plans.price
 *  - team_id           → grupo del PT (independiente del plan)
 *  - discount_pct      → descuento primer mes (se guarda el monto ya descontado en invitations.monthly_fee)
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTrainerContext } from '@/hooks/useTrainerContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  UserPlus, Clock, Check, Copy, MessageCircle,
  Send, Mail, Ban, X as XIcon, Search, Link as LinkIcon,
  Users, CreditCard,
} from 'lucide-react';
import { invitationEmailPayload } from '@/lib/email/invitationEmail';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Invitation {
  id: string;
  invited_email: string;
  child_name: string;
  monthly_fee: number | null;
  status: string;
  created_at: string;
  parent_phone?: string;
  role_to_assign?: 'athlete' | 'parent';
  team_id?: string;
  offering_plan_id?: string;
}

interface PlanOption {
  plan_id: string;
  offering_id: string;
  offering_name: string;
  plan_name: string;
  price: number;
  duration_days: number;
}

interface FormState {
  email: string;
  phone: string;
  childName: string;
  teamId: string;
  offeringPlanId: string;
  selectedOfferingId: string;
  monthlyFee: number;
  discountPct: number;
  role: 'athlete' | 'parent';
}

const ROLE_OPTIONS = [
  { id: 'athlete' as const, label: '⚽ Atleta',      desc: 'El atleta se une directamente a tu estudio.' },
  { id: 'parent'  as const, label: '👨👩👧 Padre/Madre', desc: 'El padre inscribe a su hijo.' },
];

const INITIAL_FORM: FormState = {
  email: '', phone: '+57', childName: '',
  teamId: '', offeringPlanId: '', selectedOfferingId: '',
  monthlyFee: 0, discountPct: 0,
  role: 'athlete',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

// ─── Componente ───────────────────────────────────────────────────────────────

export function TrainerInvitationsTab() {
  const { trainerSchoolId, trainerProfile } = useTrainerContext();
  const { toast } = useToast();
  const qc = useQueryClient();

  const studioName = trainerProfile?.display_name || 'Mi Estudio';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm]  = useState('');
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const setF = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const resetForm = () => setForm(INITIAL_FORM);

  // ── Grupos del PT ─────────────────────────────────────────────────────────
  const { data: teams = [] } = useQuery<{ id: string; name: string; monthly_fee: number }[]>({
    queryKey: ['trainer-teams', trainerSchoolId],
    queryFn: async () => {
      if (!trainerSchoolId) return [];
      const { data, error } = await (supabase.from('teams') as any)
        .select('id, name, monthly_fee')
        .eq('school_id', trainerSchoolId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!trainerSchoolId,
  });

  // ── Planes del PT ─────────────────────────────────────────────────────────
  const { data: offeringPlans = [] } = useQuery<PlanOption[]>({
    queryKey: ['trainer-offering-plans', trainerSchoolId],
    queryFn: async () => {
      if (!trainerSchoolId) return [];
      const { data, error } = await (supabase as any)
        .from('offering_plans')
        .select('id, name, price, duration_days, offering_id, offerings(id, name)')
        .eq('school_id', trainerSchoolId)
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data || []).map((row: any) => ({
        plan_id:       row.id,
        offering_id:   row.offerings?.id ?? row.offering_id,
        offering_name: row.offerings?.name ?? '',
        plan_name:     row.name,
        price:         Number(row.price),
        duration_days: row.duration_days,
      }));
    },
    enabled: !!trainerSchoolId,
  });

  // ── Autocompleta monthlyFee cuando cambia plan o equipo ───────────────────
  useEffect(() => {
    if (form.offeringPlanId) {
      const p = offeringPlans.find(p => p.plan_id === form.offeringPlanId);
      if (p) setF('monthlyFee', p.price);
    } else if (form.teamId) {
      const t = teams.find(t => t.id === form.teamId);
      if (t?.monthly_fee) setF('monthlyFee', t.monthly_fee);
    }
    // Reset descuento cuando cambia el plan/equipo
    setF('discountPct', 0);
  }, [form.offeringPlanId, form.teamId]);

  // ── Invitaciones ──────────────────────────────────────────────────────────
  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ['trainer-invitations', trainerSchoolId],
    queryFn: async () => {
      if (!trainerSchoolId) return [];
      const { data, error } = await (supabase.from('invitations') as any)
        .select('id, email, role_to_assign, status, created_at, child_name, monthly_fee, parent_phone, team_id, offering_plan_id')
        .eq('school_id', trainerSchoolId)
        .in('role_to_assign', ['athlete', 'parent'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((inv: any) => ({
        id:              inv.id,
        invited_email:   inv.email,
        child_name:      inv.child_name || '',
        parent_phone:    inv.parent_phone || '',
        monthly_fee:     inv.monthly_fee != null ? Number(inv.monthly_fee) : null,
        status:          inv.status,
        created_at:      inv.created_at,
        role_to_assign:  inv.role_to_assign,
        team_id:         inv.team_id || null,
        offering_plan_id: inv.offering_plan_id || null,
      }));
    },
    enabled: !!trainerSchoolId,
  });

  // ── Handlers de selección ────────────────────────────────────────────────
  const handlePlanSelect = (planId: string) => {
    const id = planId === 'none' ? '' : planId;
    const p  = offeringPlans.find(p => p.plan_id === id);
    setForm(prev => ({
      ...prev,
      offeringPlanId:     id,
      selectedOfferingId: p?.offering_id || '',
      monthlyFee:         p?.price ?? prev.monthlyFee,
      discountPct:        0,
    }));
  };

  const handleTeamSelect = (teamId: string) => {
    const id = teamId === 'none' ? '' : teamId;
    const t  = teams.find(t => t.id === id);
    setForm(prev => ({
      ...prev,
      teamId:      id,
      monthlyFee:  t?.monthly_fee ?? prev.monthlyFee,
      discountPct: 0,
    }));
  };

  // ── Helpers de link y WhatsApp ────────────────────────────────────────────
  const buildLink = (inv: Partial<Invitation> = {}) => {
    const params = new URLSearchParams({
      school: trainerSchoolId || '',
      invite: inv.id || '',
      role:   inv.role_to_assign || form.role,
    });
    const email = inv.invited_email || form.email;
    const child = inv.child_name   || form.childName;
    const team  = inv.team_id      || form.teamId;
    if (email) params.append('email',   email);
    if (child) params.append('child',   child);
    if (team)  params.append('program', team);
    return `${window.location.origin}/register?${params.toString()}`;
  };

  const openWhatsApp = (inv: Partial<Invitation> = {}) => {
    const link  = buildLink(inv);
    const role  = inv.role_to_assign || form.role;
    
    const rawPhone = (inv as Invitation).parent_phone || form.phone || '';
    const phone = rawPhone.replace(/\D/g, '');

    if (phone.length < 8) {
      toast({
        title: 'Sin número de WhatsApp',
        description: 'Esta invitación no tiene teléfono registrado. Copia el link y compártelo manualmente.',
        variant: 'destructive',
      });
      return;
    }

    const child = (inv as Invitation).child_name || form.childName;
    const msgs: Record<string, string> = {
      athlete: `¡Hola! Te invito a entrenar conmigo en ${studioName}. Completa tu registro aquí: ${link}`,
      parent:  `¡Hola! Te invito a inscribir a ${child} en ${studioName}. Completa el registro aquí: ${link}`,
    };
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msgs[role] ?? link)}`, '_blank');
  };

  const copyLink = (inv: Invitation) => {
    navigator.clipboard.writeText(buildLink(inv));
    toast({ title: '📋 Link copiado', description: 'Compártelo por WhatsApp o email.' });
  };

  const hasContact = () =>
    form.email.trim() !== '' || form.phone.replace(/\D/g, '').length >= 7;

  // ── Monto efectivo con descuento aplicado ────────────────────────────────
  const effectiveAmount = form.discountPct > 0
    ? Math.round(form.monthlyFee * (1 - form.discountPct / 100))
    : form.monthlyFee;

  // ── Mutación crear ────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data: inviteId, error } = await (supabase.rpc as any)('create_invitation', {
        p_email:                   form.email || null,
        p_role:                    form.role,
        p_child_name:              form.role === 'parent' ? form.childName : null,
        p_team_id:                 form.teamId || null,
        // Guardar el monto ya descontado para que accept_invitation_pro use el correcto
        p_monthly_fee:             form.monthlyFee > 0 ? effectiveAmount : null,
        p_parent_phone:            form.phone.replace(/\D/g, '').length >= 8 ? form.phone : null,
        p_branch_id:               null,
        p_offering_plan_id:        form.offeringPlanId || null,
        p_unregistered_athlete_id: null,
      });
      if (error) throw error;

      const link = `${window.location.origin}/register?email=${encodeURIComponent(form.email)}&role=${form.role}&invite=${inviteId}`;

      // Email si aplica
      if (form.email) {
        const { data: { session: s } } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${s?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          // Este tab invita atletas adultos y acudientes: con la plantilla de
          // acudiente fija, al atleta le hablaban de "tu hijo(a)".
          body: JSON.stringify(invitationEmailPayload({
            role: form.role,
            to: form.email,
            name: form.childName,
            registrationUrl: link,
            schoolName: studioName,
          })),
        }).catch(() => {});
      }

      return {
        id:    inviteId as string,
        link,
        role:  form.role,
        phone: form.phone,
        child: form.childName,
      };
    },
    onSuccess: ({ link, role, phone, child }) => {
      qc.invalidateQueries({ queryKey: ['trainer-invitations'] });
      navigator.clipboard.writeText(link);
      setDialogOpen(false);
      resetForm();
      toast({ title: '✅ Invitación creada', description: 'Link copiado al portapapeles.' });

      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 8) {
        const msgs: Record<string, string> = {
          athlete: `¡Hola! Te invito a entrenar conmigo en ${studioName}. Regístrate aquí: ${link}`,
          parent:  `¡Hola! Te invito a inscribir a ${child} en ${studioName}. Completa el registro aquí: ${link}`,
        };
        setTimeout(() => {
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgs[role] ?? link)}`, '_blank');
        }, 600);
      }
    },
    onError: (err: any) => {
      toast({ title: '❌ Error', description: err.message || 'No se pudo crear la invitación.', variant: 'destructive' });
    },
  });

  // ── Mutación cancelar ─────────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('invitations') as any)
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainer-invitations'] });
      toast({ title: 'Invitación cancelada.' });
    },
  });

  // ── Badge status ──────────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':  return <Badge className="bg-green-500 gap-1"><Check  className="w-3 h-3" />Aceptada</Badge>;
      case 'pending':   return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pendiente</Badge>;
      case 'rejected':  return <Badge variant="destructive" className="gap-1"><XIcon className="w-3 h-3" />Rechazada</Badge>;
      case 'expired':   return <Badge variant="outline" className="text-orange-500 border-orange-300">Expirada</Badge>;
      case 'cancelled': return <Badge variant="outline" className="text-gray-400">Cancelada</Badge>;
      default:          return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ── Etiqueta de asignación para la tabla ─────────────────────────────────
  const getAssignment = (inv: Invitation) => {
    const teamName = teams.find(t => t.id === inv.team_id)?.name ?? null;
    const plan     = offeringPlans.find(p => p.plan_id === inv.offering_plan_id);
    const planName = plan ? `${plan.offering_name} — ${plan.plan_name}` : null;
    return { teamName, planName };
  };

  const filtered = invitations.filter(inv => {
    const s = searchTerm.toLowerCase();
    if (!s) return true;
    return (
      inv.invited_email.toLowerCase().includes(s) ||
      inv.child_name.toLowerCase().includes(s)    ||
      (inv.parent_phone || '').includes(s)
    );
  });

  const stats = {
    accepted: invitations.filter(i => i.status === 'accepted').length,
    pending:  invitations.filter(i => i.status === 'pending').length,
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 mt-4">
      <Card className="border-border/50">
        {/* Header */}
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Mis Invitaciones</CardTitle>
            <CardDescription>Invita atletas y padres a tu estudio.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2 text-[11px] shrink-0">
              <span className="bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">
                {stats.accepted} aceptadas
              </span>
              <span className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full font-bold">
                {stats.pending} pendientes
              </span>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2 shrink-0">
              <UserPlus className="h-4 w-4" /> Nueva
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Búsqueda */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, nombre, teléfono..."
              className="pl-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Tabla */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border/40 rounded-xl">
              <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {invitations.length === 0
                  ? 'Aún no has enviado invitaciones. ¡Invita a tu primer atleta!'
                  : 'Sin resultados para esa búsqueda.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email / Rol</TableHead>
                  <TableHead>Hijo / Grupo / Plan</TableHead>
                  <TableHead>Mensualidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(inv => {
                  const { teamName, planName } = getAssignment(inv);
                  return (
                    <TableRow key={inv.id}>
                      {/* Email / Rol */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-sm">{inv.invited_email}</span>
                          </div>
                          <Badge variant="secondary" className="w-fit text-[10px] font-normal">
                            {inv.role_to_assign === 'parent' ? 'Padre/Madre' : 'Atleta'}
                          </Badge>
                          {inv.parent_phone && (
                            <div className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3 text-green-500" />
                              <span className="text-xs text-muted-foreground">{inv.parent_phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Hijo / Grupo / Plan */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {inv.child_name && (
                            <span className="font-medium text-xs">{inv.child_name}</span>
                          )}
                          {teamName && (
                            <Badge variant="outline" className="w-fit text-[10px] font-normal flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" />{teamName}
                            </Badge>
                          )}
                          {planName && (
                            <Badge variant="outline" className="w-fit text-[10px] font-normal flex items-center gap-1 border-purple-200 text-purple-700 dark:border-purple-700 dark:text-purple-400">
                              <CreditCard className="w-2.5 h-2.5" />{planName}
                            </Badge>
                          )}
                          {!inv.child_name && !teamName && !planName && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Mensualidad */}
                      <TableCell className="font-semibold text-primary">
                        {inv.monthly_fee != null ? formatCOP(inv.monthly_fee) : '—'}
                      </TableCell>

                      {/* Estado */}
                      <TableCell>{getStatusBadge(inv.status)}</TableCell>

                      {/* Fecha */}
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(inv.created_at), 'dd MMM yyyy', { locale: es })}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => copyLink(inv)} title="Copiar link">
                            <Copy className="w-4 h-4" />
                          </Button>
                          {(() => {
                            const hasPhone = (inv.parent_phone || '').replace(/\D/g, '').length >= 8;
                            return (
                              <Button
                                variant="ghost" size="sm"
                                className={hasPhone
                                  ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                  : "text-muted-foreground/40 cursor-not-allowed"}
                                onClick={() => openWhatsApp(inv)}
                                title={hasPhone ? "Enviar por WhatsApp" : "Sin número registrado"}
                                disabled={!hasPhone}
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                            );
                          })()}
                          {inv.status === 'pending' && (
                            <Button
                              variant="ghost" size="sm"
                              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Cancelar invitación"
                              disabled={cancelMutation.isPending}
                              onClick={() => {
                                if (confirm(`¿Cancelar la invitación para ${inv.invited_email}?`)) {
                                  cancelMutation.mutate(inv.id);
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
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog nueva invitación ───────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-primary/5 to-transparent">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> Nueva Invitación
              </DialogTitle>
              <DialogDescription>
                {form.role === 'parent'
                  ? 'El padre recibirá un link para inscribir a su hijo en tu estudio.'
                  : 'El atleta recibirá un link para unirse directamente a tu estudio.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 pt-4 space-y-4 max-h-[70vh] overflow-y-auto">

            {/* Selector de rol */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo de invitación
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map(r => (
                  <button
                    key={r.id} type="button"
                    onClick={() => setForm(prev => ({ ...INITIAL_FORM, role: r.id, phone: prev.phone }))}
                    className={[
                      'flex flex-col items-center gap-1 rounded-xl border-2 py-3 px-2 text-sm transition-all',
                      form.role === r.id
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/40 bg-background/50 hover:border-border/80',
                    ].join(' ')}
                  >
                    <span className="font-bold">{r.label}</span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Email <span className="text-muted-foreground font-normal text-xs">(o solo WhatsApp)</span>
              </Label>
              <Input
                type="email" placeholder="ejemplo@correo.com"
                value={form.email} className="h-10"
                onChange={e => setF('email', e.target.value)}
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">WhatsApp</Label>
              <PhoneInput value={form.phone} onChange={v => setF('phone', v)} />
            </div>

            {/* Nombre del hijo — solo parent */}
            {form.role === 'parent' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Nombre del hijo/a *</Label>
                <Input
                  placeholder="Nombre completo"
                  value={form.childName} className="h-10"
                  onChange={e => setF('childName', e.target.value)}
                />
              </div>
            )}

            {/* Grupo — si el PT tiene equipos */}
            {teams.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Grupo <span className="text-muted-foreground font-normal text-xs">(opcional, independiente del plan)</span>
                </Label>
                <Select value={form.teamId || 'none'} onValueChange={handleTeamSelect}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Sin grupo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin grupo</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Plan — si el PT tiene offering_plans */}
            {offeringPlans.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Plan <span className="text-muted-foreground font-normal text-xs">(opcional, independiente del grupo)</span>
                </Label>
                <Select value={form.offeringPlanId || 'none'} onValueChange={handlePlanSelect}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Sin plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin plan</SelectItem>
                    {offeringPlans.map(p => (
                      <SelectItem key={p.plan_id} value={p.plan_id} className="text-xs">
                        {p.offering_name} — {p.plan_name} ({formatCOP(p.price)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Mensualidad + Descuento */}
            <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Label className="text-sm font-semibold flex items-center justify-between">
                Mensualidad
                <Badge variant="secondary" className="font-normal text-[10px]">COP</Badge>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number" value={form.monthlyFee || ''}
                  className="pl-7 h-10 font-bold text-primary"
                  placeholder="0"
                  onChange={e => setF('monthlyFee', Number(e.target.value))}
                />
              </div>
              {form.offeringPlanId && (
                <p className="text-[10px] text-muted-foreground">Cargado desde el plan — editable</p>
              )}

              {/* Descuento primer mes */}
              {form.monthlyFee > 0 && (
                <div className="border-t border-border/40 pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="trainer-inv-discount"
                      checked={form.discountPct > 0}
                      onChange={e => setF('discountPct', e.target.checked ? 10 : 0)}
                      className="rounded h-4 w-4 text-primary"
                    />
                    <label htmlFor="trainer-inv-discount" className="text-xs font-medium cursor-pointer">
                      Descuento este mes
                    </label>
                  </div>
                  {form.discountPct > 0 && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min={1} max={100}
                        value={form.discountPct}
                        onChange={e => setF('discountPct', Math.min(100, Math.max(0, Number(e.target.value))))}
                        className="w-20 h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <div className="flex-1 text-right">
                        <span className="text-xs line-through text-muted-foreground mr-1">{formatCOP(form.monthlyFee)}</span>
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">
                          {formatCOP(effectiveAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Link preview */}
            <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2 border border-dashed">
              <LinkIcon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <div className="overflow-hidden">
                <p className="text-xs font-medium">Vista previa del link:</p>
                <p className="text-[10px] text-muted-foreground break-all italic leading-tight">
                  {buildLink()}
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="ghost" onClick={() => { setDialogOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button
                disabled={sendMutation.isPending || !hasContact()}
                onClick={() => sendMutation.mutate()}
                className="px-5 gap-2"
              >
                <Send className="w-4 h-4" />
                {sendMutation.isPending ? 'Creando...' : 'Crear & Copiar Link'}
              </Button>
              {form.phone.replace(/\D/g, '').length >= 7 && (
                <Button
                  variant="outline"
                  disabled={sendMutation.isPending || !hasContact()}
                  onClick={() => sendMutation.mutate()}
                  className="gap-2 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30"
                >
                  <MessageCircle className="w-4 h-4" />
                  WA
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
