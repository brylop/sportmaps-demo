import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building,
  Users,
  UserPlus,
  GraduationCap,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Trophy,
  Sparkles,
  ArrowRight,
  SkipForward,
} from 'lucide-react';
import { SPORTS_LIST } from '@/lib/constants/sportsCatalog';
import { emailClient } from '@/lib/email-client';

interface OnboardingStatus {
  has_school: boolean;
  has_branches: boolean;
  has_teams: boolean;
  has_staff: boolean;
  has_students: boolean;
  payment_setup_completed: boolean;
  school_id: string | null;
}

interface WizardStep {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  required: boolean;
}

const STEPS: WizardStep[] = [
  { id: 'branch', title: 'Tu Sede', subtitle: 'Confirma la direccion de tu sede principal', icon: Building, required: true },
  { id: 'team', title: 'Primer Equipo', subtitle: 'Crea tu primer grupo o equipo deportivo', icon: Trophy, required: true },
  { id: 'coach', title: 'Entrenador', subtitle: 'Invita a tu primer entrenador', icon: UserPlus, required: false },
  { id: 'student', title: 'Primer Atleta', subtitle: 'Registra a tu primer deportista', icon: GraduationCap, required: false },
  { id: 'payments', title: 'Cobros', subtitle: 'Configura como recibir pagos', icon: CreditCard, required: false },
];

interface SchoolOnboardingWizardProps {
  status: OnboardingStatus;
  onComplete: () => void;
  onRefresh: () => void;
}

export function SchoolOnboardingWizard({ status, onComplete, onRefresh }: SchoolOnboardingWizardProps) {
  const { schoolId, schoolName } = useSchoolContext();
  const { user } = useAuth();
  const { toast } = useToast();

  // Determine initial step based on what's already done
  const getInitialStep = useCallback(() => {
    if (!status.has_branches) return 0;
    if (!status.has_teams) return 1;
    if (!status.has_staff) return 2;
    if (!status.has_students) return 3;
    if (!status.payment_setup_completed) return 4;
    return 0;
  }, [status]);

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

  // Coach form
  const [coachName, setCoachName] = useState('');
  const [coachEmail, setCoachEmail] = useState('');

  // Student form
  const [studentName, setStudentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // Payments form
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('ahorros');

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

  const completedSteps = [
    status.has_branches && branchAddress !== '', // Step 0: branch confirmed with address
    status.has_teams,
    status.has_staff,
    status.has_students,
    status.payment_setup_completed,
  ];

  // Re-check: if branch exists but no address, it's not truly "complete" for UX
  const isStepDone = (index: number) => {
    switch (index) {
      case 0: return status.has_branches;
      case 1: return status.has_teams;
      case 2: return status.has_staff;
      case 3: return status.has_students;
      case 4: return status.payment_setup_completed;
      default: return false;
    }
  };

  const completedCount = STEPS.filter((_, i) => isStepDone(i)).length;
  const progress = Math.round((completedCount / STEPS.length) * 100);
  const allRequiredDone = status.has_branches && status.has_teams;

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
    if (!bankName.trim() || !accountNumber.trim()) {
      toast({ title: 'Completa los datos bancarios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('school_settings')
        .upsert({
          school_id: schoolId,
          bank_name: bankName.trim(),
          bank_account_number: accountNumber.trim(),
          bank_account_type: accountType,
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
    switch (currentStep) {
      case 0:
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
                <Input
                  placeholder="Bogota"
                  value={branchCity}
                  onChange={(e) => setBranchCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefono</Label>
                <Input
                  placeholder="300 123 4567"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleSaveBranch} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmar Sede
            </Button>
          </div>
        );

      case 1:
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

      case 2:
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

      case 3:
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

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configura tus datos bancarios para recibir pagos de las familias.
            </p>
            <div className="space-y-2">
              <Label>Banco *</Label>
              <Input
                placeholder="Bancolombia, Davivienda, Nequi..."
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Numero de cuenta *</Label>
                <Input
                  placeholder="1234567890"
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

  return (
    <Card className="border-primary/20 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Configura tu academia</h2>
              <p className="text-sm text-muted-foreground">{schoolName || 'Tu Escuela'}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">{progress}%</span>
            <div className="w-24 h-2 bg-muted rounded-full mt-1">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 mt-4">
          {STEPS.map((step, index) => {
            const done = isStepDone(index);
            const active = index === currentStep;
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={`
                  flex-1 h-2 rounded-full transition-all duration-300
                  ${done ? 'bg-primary' : active ? 'bg-primary/50' : 'bg-muted'}
                `}
                title={step.title}
              />
            );
          })}
        </div>
      </div>

      <CardContent className="p-6">
        {/* Step header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2.5 rounded-xl ${isStepDone(currentStep) ? 'bg-primary/10' : 'bg-muted'}`}>
            {(() => {
              const Icon = STEPS[currentStep].icon;
              return <Icon className={`h-5 w-5 ${isStepDone(currentStep) ? 'text-primary' : 'text-muted-foreground'}`} />;
            })()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">
                Paso {currentStep + 1}: {STEPS[currentStep].title}
              </h3>
              {isStepDone(currentStep) && (
                <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs">
                  Completado
                </Badge>
              )}
              {!STEPS[currentStep].required && !isStepDone(currentStep) && (
                <Badge variant="outline" className="text-muted-foreground text-xs">
                  Opcional
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{STEPS[currentStep].subtitle}</p>
          </div>
        </div>

        {/* Step already completed message */}
        {isStepDone(currentStep) ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <p className="text-muted-foreground">Este paso ya esta completado. Puedes continuar al siguiente.</p>
            <Button onClick={goNext} disabled={currentStep >= STEPS.length - 1}>
              Siguiente <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        ) : (
          renderStepContent()
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>

          <div className="flex items-center gap-2">
            {!STEPS[currentStep].required && !isStepDone(currentStep) && (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                <SkipForward className="h-4 w-4 mr-1" /> Saltar
              </Button>
            )}

            {allRequiredDone && (
              <Button variant="outline" size="sm" onClick={handleFinish}>
                Terminar despues <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
