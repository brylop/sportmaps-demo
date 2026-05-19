import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OnboardingShell, type ShellStep } from '@/components/onboarding/OnboardingShell';
import { PhoneInput } from '@/components/ui/phone-input';
import { CityCombobox } from '@/components/common/CityCombobox';
import { BankCombobox } from '@/components/common/BankCombobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building,
  UserPlus,
  GraduationCap,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Trophy,
  ArrowRight,
  SkipForward,
  Tag,
  Layers,
} from 'lucide-react';
import { SPORTS_LIST } from '@/lib/constants/sportsCatalog';
import { emailClient } from '@/lib/email-client';

type BusinessModel = 'teams' | 'plans' | 'both';
type StepId = 'branch' | 'model' | 'team' | 'plan' | 'coach' | 'student' | 'payments';

interface OnboardingStatus {
  has_school: boolean;
  has_branches: boolean;
  has_teams: boolean;
  has_plans?: boolean;
  has_staff: boolean;
  has_students: boolean;
  payment_setup_completed: boolean;
  business_model?: BusinessModel | null;
  school_id: string | null;
}

interface WizardStep {
  id: StepId;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  required: boolean;
}

// Pasos disponibles. El wizard ensambla cuales se muestran segun business_model.
const STEP_DEFS: Record<StepId, WizardStep> = {
  branch:   { id: 'branch',   title: 'Tu Sede',           subtitle: 'Confirma la direccion de tu sede principal', icon: Building,      required: true  },
  model:    { id: 'model',    title: 'Modelo',            subtitle: '¿Como organizas tu academia?',               icon: Layers,        required: true  },
  team:     { id: 'team',     title: 'Primer Equipo',     subtitle: 'Crea tu primer grupo o equipo deportivo',    icon: Trophy,        required: true  },
  plan:     { id: 'plan',     title: 'Primer Plan',       subtitle: 'Crea tu primera mensualidad o paquete',      icon: Tag,           required: true  },
  coach:    { id: 'coach',    title: 'Entrenador',        subtitle: 'Invita a tu primer entrenador',              icon: UserPlus,      required: false },
  student:  { id: 'student',  title: 'Primer Atleta',     subtitle: 'Registra a tu primer deportista',            icon: GraduationCap, required: false },
  payments: { id: 'payments', title: 'Cobros',            subtitle: 'Configura como recibir pagos',               icon: CreditCard,    required: false },
};

const buildSteps = (model: BusinessModel | null): WizardStep[] => {
  // El paso "Modelo" aparece SIEMPRE (no se autoesconde cuando hay default
  // 'teams' del backfill). El admin puede volver a este paso desde las pills
  // para cambiar su organizacion.
  const steps: WizardStep[] = [STEP_DEFS.branch, STEP_DEFS.model];
  if (model === 'teams' || model === 'both') steps.push(STEP_DEFS.team);
  if (model === 'plans' || model === 'both') steps.push(STEP_DEFS.plan);
  steps.push(STEP_DEFS.coach, STEP_DEFS.student, STEP_DEFS.payments);
  return steps;
};

interface SchoolOnboardingWizardProps {
  status: OnboardingStatus;
  onComplete: () => void;
  onRefresh: () => void;
  /** Default 'card' para uso embebido en dashboard.
   *  Pasar 'full' cuando se usa como pagina standalone en /onboarding/school. */
  variant?: 'card' | 'full';
}

export function SchoolOnboardingWizard({ status, onComplete, onRefresh, variant = 'card' }: SchoolOnboardingWizardProps) {
  const { schoolId, schoolName } = useSchoolContext();
  const { user } = useAuth();
  const { toast } = useToast();

  const [businessModel, setBusinessModel] = useState<BusinessModel | null>(
    (status.business_model as BusinessModel | undefined) ?? null,
  );
  // Si el RPC trae has_teams o has_plans pero business_model viene null, asumimos
  // que la escuela ya estaba en marcha con el modelo viejo (equipos).
  useEffect(() => {
    if (businessModel) return;
    if (status.has_teams && status.has_plans) setBusinessModel('both');
    else if (status.has_plans)                setBusinessModel('plans');
    else if (status.has_teams)                setBusinessModel('teams');
  }, [businessModel, status.has_teams, status.has_plans]);

  const STEPS = buildSteps(businessModel);

  // `model` se considera "done" solo si la escuela ya creó al menos un team o
  // plan, no solo porque schools.business_model tenga valor (puede venir del
  // default 'teams' del backfill). Asi forzamos al admin a ver el step en su
  // primer onboarding y confirmar explicitamente como organiza su academia.
  const isStepDoneById = useCallback((id: StepId): boolean => {
    switch (id) {
      case 'branch':   return !!status.has_branches;
      case 'model':    return !!status.has_teams || !!status.has_plans;
      case 'team':     return !!status.has_teams;
      case 'plan':     return !!status.has_plans;
      case 'coach':    return !!status.has_staff;
      case 'student':  return !!status.has_students;
      case 'payments': return !!status.payment_setup_completed;
      default:         return false;
    }
  }, [status]);

  // Determine initial step based on what's already done
  const getInitialStep = useCallback(() => {
    for (let i = 0; i < STEPS.length; i++) {
      if (!isStepDoneById(STEPS[i].id)) return i;
    }
    return 0;
  }, [STEPS, isStepDoneById]);

  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const [saving, setSaving] = useState(false);

  // Branch form
  const [branchAddress, setBranchAddress] = useState('');
  const [branchCity, setBranchCity] = useState('');
  const [branchPhone, setBranchPhone] = useState('');

  // Team form
  const [teamName, setTeamName] = useState('');
  const [teamSport, setTeamSport] = useState('');
  const [teamPrice, setTeamPrice] = useState('150000');

  // Plan form (mensualidad / paquete)
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('120000');
  const [planBilling, setPlanBilling] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [planSessions, setPlanSessions] = useState<string>(''); // vacio = ilimitado

  // Coach form
  const [coachName, setCoachName] = useState('');
  const [coachEmail, setCoachEmail] = useState('');

  // Student form
  const [studentName, setStudentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // Payments form — mismo bloque unificado que trainer/vendor:
  // Nequi + Banco + Cuenta + WhatsApp. La escuela ademas conserva tipo de cuenta
  // porque es info que las pasarelas (Wompi/MP) exigen para depositar.
  const [nequi,         setNequi]         = useState('');
  const [bankCode,      setBankCode]      = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType,   setAccountType]   = useState('ahorros');
  const [whatsapp,      setWhatsapp]      = useState('');

  // Load existing branch data
  useEffect(() => {
    if (schoolId) {
      loadBranchData();
    }
  }, [schoolId]);

  const loadBranchData = async () => {
    if (!schoolId) return;
    const { data } = await supabase
      .from('school_branches')
      .select('address, city, phone')
      .eq('school_id', schoolId)
      .eq('is_main', true)
      .maybeSingle();

    if (data) {
      setBranchAddress(data.address || '');
      setBranchCity(data.city || '');
      setBranchPhone(data.phone || '');
    }
  };

  // Wrapper indice-based para compatibilidad con codigo de render que itera por index
  const isStepDone = (index: number) => {
    const step = STEPS[index];
    return step ? isStepDoneById(step.id) : false;
  };

  const completedCount = STEPS.filter((_, i) => isStepDone(i)).length;
  const progress = Math.round((completedCount / STEPS.length) * 100);
  // Solo se considera "todo listo para finalizar" si los pasos required estan hechos.
  const allRequiredDone = STEPS.filter(s => s.required).every(s => isStepDoneById(s.id));

  // ── Step Handlers ──

  const handleSaveBranch = async () => {
    if (!schoolId) return;
    if (!branchAddress.trim()) {
      toast({ title: 'Ingresa la direccion de tu sede', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Update existing main branch
      const { error } = await supabase
        .from('school_branches')
        .update({
          address: branchAddress.trim(),
          city: branchCity.trim() || null,
          phone: branchPhone.trim() || null,
        })
        .eq('school_id', schoolId)
        .eq('is_main', true);

      if (error) throw error;

      toast({ title: 'Sede actualizada' });
      onRefresh();
      goNext();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleChooseModel = async (model: BusinessModel) => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ business_model: model })
        .eq('id', schoolId);

      if (error) throw error;

      setBusinessModel(model);
      toast({ title: 'Modelo guardado' });
      onRefresh();
      // No avanzamos manualmente: el rerender reemplaza el step 'model' por
      // 'team' o 'plan' en el mismo indice, asi que el usuario queda en el
      // siguiente paso natural sin cambiar currentStep.
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Crea un subscription_plan tipo school_monthly atado al vendor_profile
   * del owner de la escuela. Si el owner no tiene vendor_profile aun
   * (school role ya no auto-crea), lo creamos silenciosamente con
   * capabilities en false. No abre Mi Tienda — el addon store sigue
   * siendo lo que decide eso.
   */
  const handleCreatePlan = async () => {
    if (!schoolId || !user) return;
    if (!planName.trim()) {
      toast({ title: 'Ingresa el nombre del plan', variant: 'destructive' });
      return;
    }
    if (!planPrice || Number(planPrice) <= 0) {
      toast({ title: 'Precio inválido', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Buscar o crear vendor_profile del owner (capabilities=false para
      // no activar tienda; solo es contenedor de los planes recurrentes).
      let { data: vp } = await supabase
        .from('vendor_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!vp) {
        const { data: created, error: rpcErr } = await supabase.rpc('enable_vendor_profile', {
          p_vendor_type:       'school',
          p_can_sell_products: false,
          p_can_sell_services: false,
          p_display_name:      schoolName || 'Academia',
        });
        if (rpcErr) throw rpcErr;
        vp = created;
      }

      const { error } = await supabase
        .from('subscription_plans')
        .insert({
          vendor_profile_id: vp!.id,
          name:              planName.trim(),
          plan_type:         'school_monthly',
          price:             Number(planPrice),
          billing_period:    planBilling,
          sessions_included: planSessions === '' ? null : Number(planSessions),
          is_active:         true,
        });

      if (error) throw error;

      toast({ title: 'Plan creado' });
      onRefresh();
      goNext();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!schoolId) return;
    if (!teamName.trim() || !teamSport) {
      toast({ title: 'Completa nombre y deporte del equipo', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Get main branch
      const { data: branch } = await supabase
        .from('school_branches')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_main', true)
        .maybeSingle();

      const { error } = await supabase
        .from('teams')
        .insert({
          school_id: schoolId,
          name: teamName.trim(),
          sport: teamSport,
          price_monthly: Number(teamPrice) || 150000,
          branch_id: branch?.id || null,
          status: 'active',
          current_students: 0,
        });

      if (error) throw error;

      toast({ title: 'Equipo creado' });
      onRefresh();
      goNext();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleInviteCoach = async () => {
    if (!schoolId) return;
    if (!coachName.trim() || !coachEmail.trim()) {
      toast({ title: 'Completa nombre y email del entrenador', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Create staff record
      const { error: staffError } = await supabase
        .from('school_staff')
        .insert({
          school_id: schoolId,
          full_name: coachName.trim(),
          email: coachEmail.trim().toLowerCase(),
          specialty: 'coach',
          status: 'active',
        });

      if (staffError) throw staffError;

      // Enviar email de invitacion al coach
      const registrationUrl = `${window.location.origin}/register?email=${encodeURIComponent(coachEmail.trim())}&role=coach`;
      try {
        await emailClient.send({
          type: 'coach_invitation',
          to: coachEmail.trim().toLowerCase(),
          data: {
            coachName: coachName.trim(),
            schoolName: schoolName || 'Tu Academia',
            registrationUrl,
          },
        });
      } catch (emailErr) {
        console.warn('Email de coach no enviado:', emailErr);
      }

      toast({ title: 'Entrenador agregado e invitacion enviada' });
      onRefresh();
      goNext();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStudent = async () => {
    if (!schoolId) return;
    if (!studentName.trim()) {
      toast({ title: 'Ingresa el nombre del atleta', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Get first team for auto-assign
      const { data: firstTeam } = await supabase
        .from('teams')
        .select('id, name, price_monthly')
        .eq('school_id', schoolId)
        .limit(1)
        .maybeSingle();

      const { error } = await supabase
        .from('children')
        .insert({
          full_name: studentName.trim(),
          school_id: schoolId,
          team_id: firstTeam?.id || null,
          parent_email_temp: parentEmail.trim() || null,
          parent_phone_temp: parentPhone.trim() || null,
        });

      if (error) throw error;

      // Enviar email de invitacion al padre si tiene email
      if (parentEmail.trim()) {
        const registrationUrl = `${window.location.origin}/register?email=${encodeURIComponent(parentEmail.trim())}&role=parent`;
        try {
          await emailClient.send({
            type: 'parent_invitation',
            to: parentEmail.trim().toLowerCase(),
            data: {
              schoolName: schoolName || 'Tu Academia',
              childName: studentName.trim(),
              registrationUrl,
            },
          });
        } catch (emailErr) {
          console.warn('Email de padre no enviado:', emailErr);
        }
      }

      toast({ title: parentEmail.trim() ? 'Atleta registrado e invitacion enviada al padre' : 'Atleta registrado' });
      onRefresh();
      goNext();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayments = async () => {
    if (!schoolId) return;
    if (!bankCode || !accountNumber.trim()) {
      toast({ title: 'Selecciona banco y número de cuenta', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('school_settings')
        .upsert({
          school_id:           schoolId,
          bank_name:           bankCode,
          bank_account_number: accountNumber.trim(),
          bank_account_type:   accountType,
          nequi_number:        nequi.trim() || null,
          whatsapp_number:     whatsapp.trim() || null,
        }, { onConflict: 'school_id' });

      if (error) throw error;

      toast({ title: 'Datos de cobro guardados' });
      onRefresh();
      handleFinish();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!schoolId) return;
    // Mark onboarding as completed
    await supabase
      .from('schools')
      .update({ onboarding_status: 'completed' })
      .eq('id', schoolId);

    onComplete();
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (!STEPS[currentStep].required) {
      goNext();
    }
  };

  // ── Render Step Content ──

  const renderStepContent = () => {
    const stepId = STEPS[currentStep]?.id;
    switch (stepId) {
      case 'branch':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Direccion *</Label>
              <Input
                placeholder="Calle 123 #45-67, Barrio Centro"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <CityCombobox value={branchCity} onChange={setBranchCity} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <PhoneInput value={branchPhone} onChange={setBranchPhone} placeholder="Número de celular" />
              </div>
            </div>
            <Button onClick={handleSaveBranch} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmar Sede
            </Button>
          </div>
        );

      case 'model': {
        const MODELS: Array<{ key: BusinessModel; title: string; subtitle: string; icon: React.ElementType }> = [
          { key: 'teams', title: 'Equipos / grupos',     subtitle: 'Fútbol sub-15, natación intermedia, etc.',           icon: Trophy },
          { key: 'plans', title: 'Planes / membresías',  subtitle: 'Mensualidad gym, paquete 10 clases, curso por mes.', icon: Tag },
          { key: 'both',  title: 'Ambos',                 subtitle: 'Tengo equipos competitivos y también planes libres.', icon: Layers },
        ];
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Elige cómo organizas a tus deportistas. Esto define los siguientes pasos del onboarding.
            </p>
            <div className="grid gap-3">
              {MODELS.map(m => {
                const Icon = m.icon;
                const active = businessModel === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={saving}
                    onClick={() => handleChooseModel(m.key)}
                    className={`flex items-start gap-3 text-left rounded-lg border p-4 transition-colors hover:bg-muted ${active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'}`}
                  >
                    <div className="p-2 rounded-md bg-primary/10 shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{m.subtitle}</p>
                    </div>
                    {active && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Podrás cambiarlo después en Configuraciones.
            </p>
          </div>
        );
      }

      case 'team':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del equipo *</Label>
              <Input
                placeholder="Ej: Futbol Sub-15, Natacion Iniciacion"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deporte *</Label>
                <Select value={teamSport} onValueChange={setTeamSport}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPORTS_LIST.map((sport) => (
                      <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Precio mensual (COP)</Label>
                <Input
                  type="number"
                  placeholder="150000"
                  value={teamPrice}
                  onChange={(e) => setTeamPrice(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleCreateTeam} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trophy className="h-4 w-4 mr-2" />}
              Crear Equipo
            </Button>
          </div>
        );

      case 'plan':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crea tu primera mensualidad o paquete. Lo usarás para inscribir a los atletas.
            </p>
            <div className="space-y-2">
              <Label>Nombre del plan *</Label>
              <Input
                placeholder="Ej: Mensualidad ilimitada, Paquete 10 clases"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Precio (COP) *</Label>
                <Input
                  type="number"
                  placeholder="120000"
                  value={planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cobro cada</Label>
                <Select value={planBilling} onValueChange={(v: any) => setPlanBilling(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mes</SelectItem>
                    <SelectItem value="quarterly">Trimestre</SelectItem>
                    <SelectItem value="yearly">Año</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sesiones</Label>
                <Input
                  type="number"
                  placeholder="Ilimitado"
                  value={planSessions}
                  onChange={(e) => setPlanSessions(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleCreatePlan} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Tag className="h-4 w-4 mr-2" />}
              Crear Plan
            </Button>
          </div>
        );

      case 'coach':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Agrega a tu entrenador principal. Recibira una invitacion para unirse.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre completo *</Label>
                <Input
                  placeholder="Carlos Rodriguez"
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="coach@email.com"
                  value={coachEmail}
                  onChange={(e) => setCoachEmail(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleInviteCoach} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Invitar Entrenador
            </Button>
          </div>
        );

      case 'student':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Registra a tu primer deportista. Si tiene padre/madre, recibirán una invitacion.
            </p>
            <div className="space-y-2">
              <Label>Nombre del atleta *</Label>
              <Input
                placeholder="Juan Perez"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email del padre (opcional)</Label>
                <Input
                  type="email"
                  placeholder="padre@email.com"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefono del padre (opcional)</Label>
                <Input
                  placeholder="300 123 4567"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleCreateStudent} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GraduationCap className="h-4 w-4 mr-2" />}
              Registrar Atleta
            </Button>
          </div>
        );

      case 'payments':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configura tus datos bancarios para recibir pagos de las familias.
            </p>

            <div className="space-y-2">
              <Label>Número Nequi</Label>
              <Input
                type="tel"
                maxLength={10}
                placeholder="Número de 10 dígitos"
                value={nequi}
                onChange={(e) => setNequi(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>

            <div className="space-y-2">
              <Label>Banco *</Label>
              <BankCombobox value={bankCode} onChange={setBankCode} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número de cuenta *</Label>
                <Input
                  placeholder="123-456789-00"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de cuenta</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ahorros">Ahorros</SelectItem>
                    <SelectItem value="corriente">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp de contacto</Label>
              <PhoneInput value={whatsapp} onChange={setWhatsapp} placeholder="Número de celular" />
            </div>

            <Button onClick={handleSavePayments} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Guardar y Finalizar
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const shellSteps: ShellStep[] = STEPS.map(s => ({
    id:          s.id,
    title:       s.title,
    description: s.subtitle,
    icon:        s.icon,
    done:        isStepDoneById(s.id),
  }));

  const currentStepDef = STEPS[currentStep];
  const isCurrentDone  = currentStepDef ? isStepDoneById(currentStepDef.id) : false;

  const stepBody = isCurrentDone ? (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <CheckCircle2 className="h-12 w-12 text-primary" />
      <p className="text-muted-foreground">Este paso ya está completado. Puedes continuar al siguiente.</p>
      <Button onClick={goNext} disabled={currentStep >= STEPS.length - 1}>
        Siguiente <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  ) : (
    renderStepContent()
  );

  const footer = (
    <>
      <Button variant="ghost" size="sm" onClick={goBack} disabled={currentStep === 0}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
      </Button>
      <div className="flex items-center gap-2">
        {currentStepDef && !currentStepDef.required && !isCurrentDone && (
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            <SkipForward className="h-4 w-4 mr-1" /> Saltar
          </Button>
        )}
        {allRequiredDone && (
          <Button variant="outline" size="sm" onClick={handleFinish}>
            Terminar después <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </>
  );

  return (
    <OnboardingShell
      title={schoolName ? `Configura ${schoolName}` : 'Configura tu academia'}
      eyebrow="Configuración inicial"
      steps={shellSteps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      footer={footer}
      variant={variant}
    >
      {stepBody}
    </OnboardingShell>
  );
}
