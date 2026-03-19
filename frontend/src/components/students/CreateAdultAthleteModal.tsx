/**
 * CreateAdultAthleteModal — Inscripción de Atleta Adulto
 *
 * Flujo único:
 *   1. Buscar por email o documento en profiles (profiles.email / profiles.document_number)
 *   2a. Si EXISTE → mostrar card, permitir asignar equipo y/o plan → INSERT enrollment (user_id)
 *       + INSERT school_members si no es miembro aún
 *   2b. Si NO EXISTE → crear invitación (no se puede crear profiles sin auth)
 *       El atleta completa su registro vía el link de invitación
 *
 * Enrollment para adultos usa user_id (profiles.id), nunca child_id.
 * Equipo y Plan son INDEPENDIENTES — nunca se cruzan entre sí.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  UserCheck, Search, ClipboardList, Loader2, CheckCircle2, AlertCircle,
  Info, CalendarDays, Send, UserPlus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { calcProration, formatCOP } from '@/lib/prorationUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
  id: string;
  name: string;
  sport: string;
  price_monthly: number | null;
}

interface PlanOption {
  plan_id: string;
  offering_id: string;
  offering_name: string;
  plan_name: string;
  price: number;
  duration_days: number;
}

interface Branch { id: string; name: string; }

interface FoundProfile {
  id: string;             // profiles.id = user_id
  full_name: string;
  email: string;
  document_number: string | null;
}

interface CreateAdultAthleteModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
}

// ─── Proration Card ───────────────────────────────────────────────────────────

function ProrationCard({ startDate, monthlyFee }: { startDate: string; monthlyFee: number }) {
  if (!startDate || !monthlyFee) return null;
  const date = new Date(startDate + 'T12:00:00');
  const { proratedFee, remainingDays, daysInMonth, isFullMonth, dueDate } =
    calcProration(date, monthlyFee);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 space-y-2 text-sm">
      <div className="flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-200">
        <CalendarDays className="h-4 w-4" />
        Cálculo del primer cobro
      </div>
      {isFullMonth ? (
        <p className="text-blue-700 dark:text-blue-300">Inscripción el 1° del mes — se cobra el mes completo.</p>
      ) : (
        <div className="space-y-1 text-blue-700 dark:text-blue-300">
          <div className="flex justify-between">
            <span>Días restantes del mes:</span>
            <span className="font-medium">{remainingDays} de {daysInMonth}</span>
          </div>
          <div className="flex justify-between">
            <span>Primer cobro proporcional:</span>
            <span className="font-bold text-blue-900 dark:text-blue-100">{formatCOP(proratedFee)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Vence:</span>
            <span>{dueDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      )}
      <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 border-t border-blue-200 dark:border-blue-700 pt-2 mt-2">
        <span>Mensualidades siguientes:</span>
        <span className="font-medium">{formatCOP(monthlyFee)} / mes</span>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function CreateAdultAthleteModal({ open, onClose, onSuccess, schoolId }: CreateAdultAthleteModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Lookup data
  const [teams, setTeams]       = useState<Team[]>([]);
  const [plans, setPlans]       = useState<PlanOption[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching]     = useState(false);
  const [searchDone, setSearchDone]   = useState(false);
  const [foundProfile, setFoundProfile] = useState<FoundProfile | null>(null);
  const [notFoundEmail, setNotFoundEmail] = useState(''); // para invitación

  // Formulario para atleta sin cuenta
  const [showUnregisteredForm, setShowUnregisteredForm] = useState(false);
  const [uDocType, setUDocType]       = useState('CC');
  const [uDocNumber, setUDocNumber]   = useState('');
  const [uFullName, setUFullName]     = useState('');
  const [uPhone, setUPhone]           = useState('');
  const [uDob, setUDob]               = useState('');
  const [uGender, setUGender]         = useState('');
  const [sendInvite, setSendInvite]   = useState(true);

  // Inscripción (solo si hay perfil encontrado)
  const [branchId, setBranchId]               = useState('none');
  const [teamId, setTeamId]                   = useState('none');
  const [selectedPlanId, setSelectedPlanId]   = useState('none');
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [selectedPlanPrice, setSelectedPlanPrice] = useState(0);
  const [startDate, setStartDate]             = useState(() => new Date().toISOString().split('T')[0]);
  const [monthlyFee, setMonthlyFee]           = useState('');

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !schoolId) return;

    Promise.all([
      supabase.from('teams').select('id, name, sport, price_monthly').eq('school_id', schoolId).eq('status', 'active').order('name'),
      supabase.from('offering_plans').select('id, name, price, duration_days, offering_id, offerings(id, name)').eq('school_id', schoolId).eq('is_active', true).order('sort_order'),
      supabase.from('school_branches').select('id, name').eq('school_id', schoolId).order('name'),
    ]).then(([teamsRes, plansRes, branchesRes]) => {
      setTeams((teamsRes.data as Team[]) ?? []);
      const flatPlans: PlanOption[] = ((plansRes.data as any[]) ?? []).map(row => ({
        plan_id:       row.id,
        offering_id:   row.offerings?.id ?? row.offering_id,
        offering_name: row.offerings?.name ?? '',
        plan_name:     row.name,
        price:         Number(row.price),
        duration_days: row.duration_days,
      }));
      setPlans(flatPlans);
      setBranches((branchesRes.data as Branch[]) ?? []);
    });
  }, [open, schoolId]);

  // Auto-fill mensualidad
  useEffect(() => {
    if (selectedPlanId && selectedPlanId !== 'none') {
      const p = plans.find(p => p.plan_id === selectedPlanId);
      if (p) setMonthlyFee(String(p.price));
    } else if (teamId && teamId !== 'none') {
      const t = teams.find(t => t.id === teamId);
      if (t?.price_monthly) setMonthlyFee(String(t.price_monthly));
    } else {
      setMonthlyFee(''); // Clear if no plan or team is selected
    }
  }, [selectedPlanId, teamId, plans, teams]);

  const handlePlanSelect = (planId: string) => {
    setSelectedPlanId(planId);
    if (!planId || planId === 'none') {
      setSelectedOfferingId('');
      setSelectedPlanPrice(0);
      return;
    }
    const p = plans.find(p => p.plan_id === planId);
    if (p) {
      setSelectedOfferingId(p.offering_id);
      setSelectedPlanPrice(p.price);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = () => {
    setSearchQuery(''); setSearchDone(false); setFoundProfile(null);
    setNotFoundEmail(''); setSearching(false);
    setBranchId('none'); setTeamId('none');
    setSelectedPlanId('none'); setSelectedOfferingId('');
    setSelectedPlanPrice(0);
    setStartDate(new Date().toISOString().split('T')[0]);
    setMonthlyFee('');

    setShowUnregisteredForm(false);
    setUDocType('CC'); setUDocNumber(''); setUFullName('');
    setUPhone(''); setUDob(''); setUGender(''); setSendInvite(true);
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Búsqueda en profiles ───────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setFoundProfile(null);
    setNotFoundEmail('');

    try {
      const isEmail = q.includes('@');

      const { data } = isEmail
        ? await supabase
            .from('profiles')
            .select('id, full_name, email, document_number')
            .eq('email', q.toLowerCase())
            .maybeSingle()
        : await supabase
            .from('profiles')
            .select('id, full_name, email, document_number')
            .eq('document_number', q)
            .maybeSingle();

      if (data) {
        setFoundProfile(data as FoundProfile);
      } else {
        // No existe — guardar email para poder enviar invitación
        if (isEmail) setNotFoundEmail(q.toLowerCase());
      }
    } catch {
      toast({ title: 'Error al buscar', description: 'Intenta de nuevo.', variant: 'destructive' });
    } finally {
      setSearching(false);
      setSearchDone(true);
    }
  }, [searchQuery, toast]);

  // ── Enviar solo invitación (atleta no existe aún) ──────────────────────────
  const handleSendInvitation = async () => {
    if (!notFoundEmail) return;
    try {
      setSubmitting(true);
      await bffClient.post('/api/v1/students/create-one', {
        type: 'adult_invite',
        email: notFoundEmail,
      }, { 'x-school-id': schoolId });

      toast({
        title: 'Invitación enviada',
        description: `Se envió un link de registro a ${notFoundEmail}. Una vez se registre, puedes inscribirlo.`,
      });
      reset();
      onClose();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Inscribir atleta existente ─────────────────────────────────────────────
  const handleEnroll = async () => {
    // Si es atleta sin cuenta — guardar en unregistered_athletes
    if (showUnregisteredForm) {
      if (!uFullName.trim()) {
        toast({ title: 'Nombre requerido', variant: 'destructive' }); return;
      }
      setSubmitting(true);
      try {
        await bffClient.post('/api/v1/students/create-one', {
          type: 'unregistered_adult',
          doc_type:         uDocType,
          doc_number:       uDocNumber.trim() || null,
          full_name:        uFullName.trim(),
          email:            notFoundEmail || null,
          phone:            uPhone.replace(/\s/g, '') || null,
          date_of_birth:    uDob || null,
          gender:           uGender || null,
          branch_id:        (branchId && branchId !== 'none') ? branchId : null,
          team_id:          (teamId && teamId !== 'none') ? teamId : null,
          offering_plan_id: (selectedPlanId && selectedPlanId !== 'none') ? selectedPlanId : null,
          offering_id:      selectedOfferingId || null,
          start_date:       startDate,
          monthly_fee:      monthlyFee ? Number(monthlyFee) : null,
          send_invite:      sendInvite,
        }, { 'x-school-id': schoolId });

        toast({ title: '¡Atleta registrado!', description: `${uFullName} fue guardado correctamente.` });
        reset();
        onSuccess();
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      } finally {
        setSubmitting(false);
      }
      return; // Salir — no continuar con el flujo de adulto existente
    }

    if (!foundProfile) return;
    if (!startDate) {
      toast({ title: 'Falta fecha de inscripción', variant: 'destructive' }); return;
    }
    const fee = Number(monthlyFee);
    if (monthlyFee && (isNaN(fee) || fee < 10000)) {
      toast({ title: 'Mensualidad inválida', description: 'Debe ser ≥ $10.000 COP', variant: 'destructive' }); return;
    }

    try {
      setSubmitting(true);
      await bffClient.post('/api/v1/students/create-one', {
        type: 'adult_existing',
        user_id:          foundProfile.id,     // profiles.id → enrollments.user_id
        branch_id:        (branchId && branchId !== 'none') ? branchId : null,
        team_id:          (teamId && teamId !== 'none') ? teamId : null,   // independiente
        offering_plan_id: (selectedPlanId && selectedPlanId !== 'none') ? selectedPlanId : null,   // independiente
        offering_id:      selectedOfferingId || null,
        start_date:  startDate,
        monthly_fee: monthlyFee ? fee : null,
      }, { 'x-school-id': schoolId });

      toast({
        title: '¡Atleta inscrito!',
        description: `${foundProfile.full_name} fue inscrito correctamente.`,
      });
      reset();
      onSuccess();
    } catch (e: any) {
      toast({ title: 'Error al inscribir', description: e.message || 'Error inesperado', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-500" />
            Inscribir Atleta Adulto
          </DialogTitle>
          <DialogDescription>
            Busca al atleta por email o documento. Si no existe, se le enviará una invitación para que se registre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* ── Búsqueda ── */}
          <Section icon={<Search className="h-4 w-4" />} title="Buscar Atleta">
            <div className="flex gap-2">
              <Input
                placeholder="Email o número de documento..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setSearchDone(false);
                  setFoundProfile(null);
                  setNotFoundEmail('');
                }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleSearch}
                disabled={!searchQuery.trim() || searching}
              >
                {searching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Encontrado */}
            {searchDone && foundProfile && (
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900 dark:text-green-100">{foundProfile.full_name}</p>
                  <p className="text-sm text-green-700 dark:text-green-300">{foundProfile.email}</p>
                  {foundProfile.document_number && (
                    <p className="text-xs text-green-600 dark:text-green-400">Doc: {foundProfile.document_number}</p>
                  )}
                  <Badge variant="outline" className="mt-1 text-xs">Cuenta activa en plataforma</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFoundProfile(null); setSearchDone(false); setSearchQuery(''); }}
                  className="text-xs text-muted-foreground"
                >
                  Buscar otro
                </Button>
              </div>
            )}

            {/* No encontrado */}
            {searchDone && !foundProfile && !showUnregisteredForm && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      No se encontró ningún atleta
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Puedes registrarlo manualmente. Podrá activar su cuenta después con la invitación.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setShowUnregisteredForm(true);
                    // Pre-llenar email y doc si se buscó por esos campos
                    if (searchQuery.includes('@')) setNotFoundEmail(searchQuery.trim().toLowerCase());
                    else setUDocNumber(searchQuery.trim());
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Registrar sin cuenta
                </Button>
              </div>
            )}

            {/* Formulario de atleta sin cuenta */}
            {searchDone && !foundProfile && showUnregisteredForm && (
              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Datos del atleta</p>
                  <Button variant="ghost" size="sm" onClick={() => setShowUnregisteredForm(false)}
                    className="text-xs text-muted-foreground">
                    ← Volver
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Tipo Doc.</Label>
                    <Select value={uDocType} onValueChange={setUDocType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CC">CC</SelectItem>
                        <SelectItem value="CE">CE</SelectItem>
                        <SelectItem value="PP">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Número de Documento *</Label>
                    <Input value={uDocNumber} onChange={e => setUDocNumber(e.target.value)} placeholder="1020304050" />
                  </div>
                </div>

                <div>
                  <Label>Nombre Completo *</Label>
                  <Input value={uFullName} onChange={e => setUFullName(e.target.value)} placeholder="Carlos Martínez" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Teléfono</Label>
                    <Input value={uPhone} onChange={e => setUPhone(e.target.value)} placeholder="3001234567" />
                  </div>
                  <div>
                    <Label>Fecha de Nacimiento</Label>
                    <Input type="date" value={uDob} onChange={e => setUDob(e.target.value)}
                      max={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>

                <div>
                  <Label>Género</Label>
                  <Select value={uGender} onValueChange={setUGender}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Femenino</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {notFoundEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <input type="checkbox" id="sendInvite" checked={sendInvite}
                      onChange={e => setSendInvite(e.target.checked)} className="rounded" />
                    <label htmlFor="sendInvite" className="text-muted-foreground">
                      Enviar invitación a <strong>{notFoundEmail}</strong> para que active su cuenta
                    </label>
                  </div>
                )}

                <Separator />

                {/* Sede */}
                {branches.length > 0 && (
                  <div>
                    <Label>Sede</Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger><SelectValue placeholder="Sin sede específica" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin sede específica</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Equipo y Plan — INDEPENDIENTES */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Equipo</Label>
                    <p className="text-xs text-muted-foreground mb-1">Independiente del plan</p>
                    <Select value={teamId} onValueChange={setTeamId}>
                      <SelectTrigger><SelectValue placeholder="Sin equipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin equipo</SelectItem>
                        {teams.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}{t.sport ? ` — ${t.sport}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Plan</Label>
                    <p className="text-xs text-muted-foreground mb-1">Independiente del equipo</p>
                    <Select value={selectedPlanId} onValueChange={handlePlanSelect}>
                      <SelectTrigger><SelectValue placeholder="Sin plan" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin plan</SelectItem>
                        {plans.map(p => (
                          <SelectItem key={p.plan_id} value={p.plan_id}>
                            {p.offering_name} — {p.plan_name} ({formatCOP(p.price)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Fecha y mensualidad */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Fecha de Inscripción *</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Mensualidad (COP)</Label>
                    <Input
                      type="number"
                      placeholder="150000"
                      value={monthlyFee}
                      onChange={e => setMonthlyFee(e.target.value)}
                      min={10000}
                      step={1000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedPlanId !== 'none'
                        ? 'Cargado desde el plan'
                        : teamId !== 'none'
                        ? 'Cargado desde el equipo'
                        : 'Ingresa manualmente'}
                    </p>
                  </div>
                </div>

                {/* Card de proration */}
                <ProrationCard startDate={startDate} monthlyFee={Number(monthlyFee) || 0} />
              </div>
            )}
          </Section>

          {/* ── Inscripción — solo si se encontró el perfil ── */}
          {foundProfile && (
            <>
              <Separator />
              <Section icon={<ClipboardList className="h-4 w-4" />} title="Inscripción">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Equipo y Plan son independientes entre sí. Puedes asignar uno, ambos o ninguno.
                  </AlertDescription>
                </Alert>

                {/* Sede */}
                {branches.length > 0 && (
                  <div>
                    <Label>Sede</Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar sede (opcional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin sede específica</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Equipo y Plan — INDEPENDIENTES */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Equipo</Label>
                    <p className="text-xs text-muted-foreground mb-1">Independiente del plan</p>
                    <Select value={teamId} onValueChange={setTeamId}>
                      <SelectTrigger><SelectValue placeholder="Sin equipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin equipo</SelectItem>
                        {teams.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}{t.sport ? ` — ${t.sport}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Plan</Label>
                    <p className="text-xs text-muted-foreground mb-1">Independiente del equipo</p>
                    <Select value={selectedPlanId} onValueChange={handlePlanSelect}>
                      <SelectTrigger><SelectValue placeholder="Sin plan" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin plan</SelectItem>
                        {plans.map(p => (
                          <SelectItem key={p.plan_id} value={p.plan_id}>
                            {p.offering_name} — {p.plan_name} ({formatCOP(p.price)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Fecha y mensualidad */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Fecha de Inscripción *</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Mensualidad (COP)</Label>
                    <Input
                      type="number"
                      placeholder="150000"
                      value={monthlyFee}
                      onChange={e => setMonthlyFee(e.target.value)}
                      min={10000}
                      step={1000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedPlanId
                        ? 'Cargado desde el plan'
                        : teamId
                        ? 'Cargado desde el equipo'
                        : 'Ingresa manualmente'}
                    </p>
                  </div>
                </div>

                <ProrationCard startDate={startDate} monthlyFee={Number(monthlyFee) || 0} />
              </Section>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          {(foundProfile || showUnregisteredForm) && (
            <Button onClick={handleEnroll} disabled={submitting}>
              {submitting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                : showUnregisteredForm
                  ? <><UserPlus className="h-4 w-4 mr-2" />Registrar Atleta</>
                  : <><ClipboardList className="h-4 w-4 mr-2" />Inscribir Atleta</>
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
