/**
 * CreateChildModal — Registro de Menor de Edad
 *
 * Escrituras en BD:
 *   1. INSERT children         → child_id
 *   2. INSERT enrollments      → child_id + team_id (si aplica, independiente)
 *   3. INSERT enrollments      → child_id + offering_plan_id + offering_id (si aplica, independiente)
 *   4. INSERT payments         → pago proporcional del primer mes
 *   5. INSERT invitations      → para el acudiente
 *
 * Equipo y Plan son INDEPENDIENTES — nunca se cruzan entre sí.
 */

import { useState, useEffect, useCallback } from 'react';
import { todayColombia } from '@/lib/dateUtils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Baby, Users, ClipboardList, CalendarDays, Info, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEntitlements } from '@/hooks/useEntitlements';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { calcFirstPayment, applyDiscount, formatCOP } from '@/lib/prorationUtils';
import { Search, CheckCircle2, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PhoneInput } from '@/components/ui/phone-input';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
  id: string;
  name: string;
  sport: string;
  price_monthly: number | null;
}

/** Fila aplanada de offering_plans JOIN offerings */
interface PlanOption {
  plan_id: string;          // offering_plans.id
  offering_id: string;      // offerings.id
  offering_name: string;    // offerings.name  (ej: "PLAN COMBATE")
  plan_name: string;        // offering_plans.name (ej: "FULL")
  price: number;            // offering_plans.price
  duration_days: number;
  registration_fee: number | null; // offering_plans.registration_fee (D17) — null = sin inscripción
}

interface Branch { id: string; name: string; }

interface CreateChildModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
}

interface BillingSettings {
  payment_cutoff_day: number;
  billing_cycle_type: 'prorated' | 'fixed_calendar' | 'rolling_30';
}

interface ProrationCardProps {
  startDate: string;
  monthlyFee: number;
  billing: BillingSettings;
  discountPct: number;
  onDiscountChange: (pct: number) => void;
  registrationFee?: number;
}

// ─── Proration Card ───────────────────────────────────────────────────────────

function ProrationCard({ startDate, monthlyFee, billing, discountPct, onDiscountChange, registrationFee = 0 }: ProrationCardProps) {
  const [discountEnabled, setDiscountEnabled] = useState(false);

  if (!startDate || !monthlyFee) return null;

  const calc = calcFirstPayment(
    startDate,
    monthlyFee,
    billing.billing_cycle_type,
    billing.payment_cutoff_day
  );

  const finalAmount = applyDiscount(calc.amount, discountEnabled ? discountPct : 0);
  const dueDateObj  = new Date(calc.dueDate + 'T12:00:00');
  const dueDateStr  = dueDateObj.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  const handleDiscountToggle = (checked: boolean) => {
    setDiscountEnabled(checked);
    onDiscountChange(checked ? discountPct : 0);
  };

  const handleDiscountPctChange = (val: string) => {
    const n = Math.min(100, Math.max(0, Number(val)));
    onDiscountChange(discountEnabled ? n : 0);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3 text-sm">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <CalendarDays className="h-4 w-4 text-primary" />
        Primer cobro
      </div>

      {/* ── Inscripción (D17-D19) — cobro único aparte de la mensualidad, ─────
          una fila de payments distinta (payment_type='one_time', sin período).
          No se suma a calc.amount: se muestra por separado a propósito. ── */}
      {registrationFee > 0 && (
        <div className="flex justify-between rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 px-2.5 py-1.5 text-sm">
          <span className="text-orange-700 dark:text-orange-400">Inscripción (pago único)</span>
          <span className="font-bold text-orange-700 dark:text-orange-400">{formatCOP(registrationFee)}</span>
        </div>
      )}

      {/* ── Prorated ── */}
      {billing.billing_cycle_type === 'prorated' && (
        <div className="space-y-1 text-muted-foreground">
          {calc.isFullMonth ? (
            <p>Inscripción el 1° del mes — mes completo.</p>
          ) : (
            <>
              <div className="flex justify-between">
                <span>Días restantes:</span>
                <span className="font-medium text-foreground">{calc.remainingDays} de {calc.totalDaysInMonth}</span>
              </div>
              <div className="flex justify-between">
                <span>Monto proporcional:</span>
                <span className="font-bold text-foreground">{formatCOP(calc.amount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-xs">
            <span>Vence:</span><span>{dueDateStr}</span>
          </div>
        </div>
      )}

      {/* ── Fixed calendar ── */}
      {billing.billing_cycle_type === 'fixed_calendar' && (
        <div className="space-y-1 text-muted-foreground">
          <div className="flex justify-between">
            <span>Monto:</span>
            <span className="font-bold text-foreground">{formatCOP(calc.amount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Vence el día {billing.payment_cutoff_day} del próximo mes:</span>
            <span>{dueDateStr}</span>
          </div>
        </div>
      )}

      {/* ── Rolling 30 ── */}
      {billing.billing_cycle_type === 'rolling_30' && (
        <div className="space-y-1 text-muted-foreground">
          <div className="flex justify-between">
            <span>Monto:</span>
            <span className="font-bold text-foreground">{formatCOP(calc.amount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Ciclo de 30 días — vence:</span>
            <span>{dueDateStr}</span>
          </div>
        </div>
      )}

      {/* ── Descuento primer mes ── */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="discount-toggle"
            checked={discountEnabled}
            onChange={e => handleDiscountToggle(e.target.checked)}
            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
          />
          <label htmlFor="discount-toggle" className="text-xs font-medium text-foreground cursor-pointer">
            Aplicar descuento solo este mes
          </label>
        </div>

        {discountEnabled && (
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-[160px]">
              <NumberStepper
                value={discountPct || ""}
                onChange={(val) => handleDiscountPctChange(String(val))}
                min={0}
                max={100}
                unit="%"
                className="h-9"
              />
            </div>
            {discountPct > 0 && (
              <div className="text-right flex-1">
                <p className="text-xs text-muted-foreground line-through">{formatCOP(calc.amount)}</p>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatCOP(finalAmount)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mensualidades siguientes ── */}
      <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-2">
        <span>Mensualidades siguientes:</span>
        <span className="font-medium">{formatCOP(monthlyFee)} / mes</span>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon, title, children,
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
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

export function CreateChildModal({ open, onClose, onSuccess, schoolId }: CreateChildModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showMedical, setShowMedical] = useState(false);

  // Lookup data
  const [teams, setTeams]       = useState<Team[]>([]);
  const [plans, setPlans]       = useState<PlanOption[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [billing, setBilling] = useState<BillingSettings>({
    payment_cutoff_day: 10,
    billing_cycle_type: 'prorated',
  });

  // ── Sección 1: Datos del menor ────────────────────────────────────────────
  const [docType, setDocType]     = useState('TI');
  const [docNumber, setDocNumber] = useState('');
  const [fullName, setFullName]   = useState('');
  const [dob, setDob]             = useState('');
  const [gender, setGender]       = useState('');
  const [grade, setGrade]         = useState('');
  const [medicalHasAllergies, setMedicalHasAllergies] = useState<'false' | 'true'>('false');
  const [medicalNotes, setMedicalNotes] = useState('');

  // ── Sección 2: Acudiente ──────────────────────────────────────────────────
  const [parentName, setParentName]   = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('+57');

  const [checkingParentEmail, setCheckingParentEmail] = useState(false);
  const [parentEmailExists, setParentEmailExists] = useState<boolean | null>(null);
  const [sendInviteEmail, setSendInviteEmail]       = useState(true);
  const [sendInviteWhatsapp, setSendInviteWhatsapp] = useState(true);

  // ── Sección 3: Inscripción ────────────────────────────────────────────────
  const [branchId, setBranchId]   = useState('none');
  const [teamId, setTeamId]       = useState('none');
  const [selectedPlanId, setSelectedPlanId]       = useState('none');
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [selectedPlanPrice, setSelectedPlanPrice] = useState(0);
  const [selectedPlanRegistrationFee, setSelectedPlanRegistrationFee] = useState(0);
  const [startDate, setStartDate]   = useState(() => todayColombia());
  // `hasBilling` y no el tipo de escuela: la pregunta es si esta escuela
  // factura por SportMaps, no si ademas alquila espacios. Falla ABIERTO
  // (true mientras carga), asi que el caso normal no cambia.
  const { hasBilling } = useEntitlements();

  const [monthlyFee, setMonthlyFee] = useState('');
  const [discountPct, setDiscountPct] = useState(0);

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !schoolId) return;

    Promise.all([
      supabase.from('teams').select('id, name, sport, price_monthly').eq('school_id', schoolId).eq('status', 'active').order('name'),
      supabase.from('offering_plans').select('id, name, price, duration_days, registration_fee, offering_id, offerings(id, name)').eq('school_id', schoolId).eq('is_active', true).order('sort_order'),
      supabase.from('school_branches').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('school_settings').select('payment_cutoff_day, billing_cycle_type').eq('school_id', schoolId).maybeSingle(),
    ]).then(([teamsRes, plansRes, branchesRes, settingsRes]) => {
      setTeams((teamsRes.data as Team[]) ?? []);
      const flatPlans: PlanOption[] = ((plansRes.data as any[]) ?? []).map(row => ({
        plan_id:       row.id,
        offering_id:   row.offerings?.id ?? row.offering_id,
        offering_name: row.offerings?.name ?? '',
        plan_name:     row.name,
        price:         Number(row.price),
        duration_days: row.duration_days,
        registration_fee: row.registration_fee != null ? Number(row.registration_fee) : null,
      }));
      setPlans(flatPlans);
      setBranches((branchesRes.data as Branch[]) ?? []);
      if (settingsRes.data) {
        setBilling(settingsRes.data as BillingSettings);
      }
    });
  }, [open, schoolId]);

  // Auto-fill mensualidad desde equipo seleccionado (solo si no hay plan)
  useEffect(() => {
    if (teamId && teamId !== 'none' && selectedPlanId === 'none') {
      const t = teams.find(t => t.id === teamId);
      if (t?.price_monthly) setMonthlyFee(String(t.price_monthly));
    }
  }, [teamId, teams, selectedPlanId]);

  // Cuando se selecciona plan, guardar offering_id y precio
  const handlePlanSelect = (planId: string) => {
    setSelectedPlanId(planId);
    if (!planId || planId === 'none') {
      setSelectedOfferingId('');
      setSelectedPlanPrice(0);
      setSelectedPlanRegistrationFee(0);
      return;
    }
    const p = plans.find(p => p.plan_id === planId);
    if (p) {
      setSelectedOfferingId(p.offering_id);
      setSelectedPlanPrice(p.price);
      setSelectedPlanRegistrationFee(p.registration_fee ?? 0);
      setMonthlyFee(String(p.price));
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = () => {
    setDocType('TI'); setDocNumber(''); setFullName(''); setDob('');
    setGender(''); setGrade('');
    setMedicalHasAllergies('false'); setMedicalNotes('');
    setParentName(''); setParentEmail(''); setParentPhone('+57');
    setBranchId('none'); setTeamId('none');
    setSelectedPlanId('none'); setSelectedOfferingId(''); setSelectedPlanPrice(0); setSelectedPlanRegistrationFee(0);
    setStartDate(todayColombia()); setMonthlyFee('');
    setDiscountPct(0);
    setCheckingParentEmail(false);
    setParentEmailExists(null);
    setSendInviteEmail(true);
    setSendInviteWhatsapp(true);
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Búsqueda silenciosa en acudiente ──────────────────────────────────────────
  const checkParentEmailExists = useCallback(async (emailVal: string) => {
    const emailClean = emailVal.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) {
      setParentEmailExists(null);
      return;
    }

    setCheckingParentEmail(true);
    try {
      const data = await bffClient.get(`/api/v1/trainer/search-profile?q=${encodeURIComponent(emailClean)}`, {
        'x-school-id': schoolId
      });

      setParentEmailExists(!!data);
    } catch {
      setParentEmailExists(false);
    } finally {
      setCheckingParentEmail(false);
    }
  }, [schoolId]);

  const handleParentEmailChange = (val: string) => {
    setParentEmail(val);
    setParentEmailExists(null);
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(val.trim())) {
      checkParentEmailExists(val);
    }
  };

  const handleParentEmailBlur = () => {
    checkParentEmailExists(parentEmail);
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!fullName.trim())  return 'El nombre completo es obligatorio.';
    if (!dob)              return 'La fecha de nacimiento es obligatoria.';
    if (!parentName.trim() || parentName.trim().length < 2)
      return 'El nombre del acudiente es obligatorio (mín. 2 caracteres).';
    if (!parentEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))
      return 'El email del acudiente no es válido.';
    if (!/^\d{10,}$/.test(parentPhone.replace(/\D/g, '')))
      return 'El teléfono del acudiente debe tener mínimo 10 dígitos.';
    if (!startDate) return 'La fecha de inscripción es obligatoria.';
    if (!branchId || branchId === 'none') return 'La sede es obligatoria.';
    const fee = Number(monthlyFee);
    if (monthlyFee && (isNaN(fee) || fee < 10000))
      return 'La mensualidad debe ser ≥ $10.000 COP.';
    return null;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast({ title: 'Datos incompletos', description: err, variant: 'destructive' }); return; }

    const medicalInfo = JSON.stringify({
      has_allergies: medicalHasAllergies === 'true',
      notes: medicalNotes.trim(),
    });

    setSubmitting(true);

    try {
      // Verificar duplicado localmente
      if (docNumber.trim()) {
        const { data: existingChild } = await supabase
          .from('children')
          .select('id, full_name')
          .eq('school_id', schoolId)
          .eq('doc_number', docNumber.trim())
          .maybeSingle();

        if (existingChild) {
          toast({
            title: 'Menor ya registrado',
            description: `Ya existe un menor con documento ${docNumber} en esta escuela: "${existingChild.full_name}".`,
            variant: 'destructive',
          });
          setSubmitting(false);
          return;
        }
      }

      const enrollmentData = {
        branch_id:        (branchId && branchId !== 'none') ? branchId : null,
        team_id:          (teamId && teamId !== 'none') ? teamId : null,
        offering_plan_id: (selectedPlanId && selectedPlanId !== 'none') ? selectedPlanId : null,
        offering_id:      selectedOfferingId || null,
        start_date:       startDate,
        monthly_fee:      monthlyFee ? Number(monthlyFee) : null,
        discount_pct:     discountPct > 0 ? discountPct : undefined,
      };

      const result = await bffClient.post('/api/v1/students/create-one', {
        type: 'child',
        ...enrollmentData,
        doc_type:   docType,
        doc_number: docNumber.trim() || null,
        full_name:    fullName.trim(),
        date_of_birth: dob || null,
        gender:       gender || null,
        grade:        grade  || null,
        medical_info: medicalInfo,
        parent_name:  parentName.trim(),
        parent_email: parentEmail.trim().toLowerCase(),
        parent_phone: parentPhone.replace(/\D/g, ''),
        send_invite:  sendInviteEmail,
      }, { 'x-school-id': schoolId }) as any;

      toast({ title: '✅ Registro exitoso', description: `${fullName} fue procesado correctamente.` });

      if (sendInviteWhatsapp && result?.registration_link && parentPhone) {
        const phoneClean = parentPhone.replace(/\D/g, '');
        const msg = `¡Hola ${parentName}! ${fullName} ha sido inscrito. Activa tu cuenta aquí: ${result.registration_link}`;
        toast({
          title: 'Invitar acudiente por WhatsApp',
          description: (
            <Button
              className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white text-xs"
              onClick={() => window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`, '_blank')}
            >
              📱 Abrir WhatsApp
            </Button>
          ) as any,
        });
      }
      reset();
      onSuccess();
    } catch (e: any) {
      toast({
        title: 'Error al registrar',
        description: e.message || 'Error inesperado',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-blue-500" />
            Registrar Menor de Edad
          </DialogTitle>
          <DialogDescription>
            Registra a un menor de edad y asócialo a un acudiente. El acudiente recibirá una invitación para activar su cuenta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          
          {/* ── Sección 1: Datos del menor ── */}
          <Section icon={<Baby className="h-4 w-4" />} title="Información del Menor">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo de Doc. *</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TI">TI</SelectItem>
                    <SelectItem value="CC">CC</SelectItem>
                    <SelectItem value="CE">CE</SelectItem>
                    <SelectItem value="PP">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Número de Documento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input placeholder="1234567890" value={docNumber} onChange={e => setDocNumber(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Nombre Completo *</Label>
              <Input placeholder="Ana María Gómez López" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <Label className="mb-2">Fecha de Nacimiento *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !dob && "text-muted-foreground"
                      )}
                    >
                      {dob ? (
                        format(new Date(dob + 'T12:00:00'), "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dob ? new Date(dob + 'T12:00:00') : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          setDob(`${year}-${month}-${day}`);
                        }
                      }}
                      captionLayout="dropdown-buttons"
                      fromYear={1920}
                      toYear={new Date().getFullYear()}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Género</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Femenino</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Grado Escolar</Label>
              <Input placeholder="Ej: 6A, 7B, Primaria" value={grade} onChange={e => setGrade(e.target.value)} />
            </div>

            <button type="button" onClick={() => setShowMedical(v => !v)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              {showMedical ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Información médica {showMedical ? '' : '(opcional)'}
            </button>

            {showMedical && (
              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <div>
                  <Label>¿Tiene alergias?</Label>
                  <Select value={medicalHasAllergies} onValueChange={v => setMedicalHasAllergies(v as 'true' | 'false')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">No</SelectItem>
                      <SelectItem value="true">Sí</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notas adicionales</Label>
                  <Textarea placeholder="Condiciones, medicamentos, restricciones físicas..." value={medicalNotes} onChange={e => setMedicalNotes(e.target.value)} rows={3} />
                </div>
              </div>
            )}
          </Section>

          <Separator />

          {/* ── Sección 2: Acudiente ── */}
          <Section icon={<Users className="h-4 w-4" />} title="Datos del Acudiente">
            <div className="space-y-3 rounded-lg border border-dashed p-4 bg-muted/20">
              <div>
                <Label>Nombre del Acudiente *</Label>
                <Input placeholder="María López" value={parentName} onChange={e => setParentName(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Correo Electrónico *</Label>
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="madre@email.com"
                      value={parentEmail}
                      onChange={e => handleParentEmailChange(e.target.value)}
                      onBlur={handleParentEmailBlur}
                      className="pr-10"
                    />
                    {checkingParentEmail && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {parentEmailExists === true && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 inline shrink-0" />
                      Acudiente ya registrado. Se vinculará el menor a su cuenta existente.
                    </p>
                  )}
                  {parentEmailExists === false && parentEmail.trim() && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                      <Info className="h-3.5 w-3.5 inline shrink-0" />
                      El acudiente no está registrado. Se le enviará invitación.
                    </p>
                  )}
                </div>
                <div>
                  <Label>Teléfono *</Label>
                  <PhoneInput value={parentPhone} onChange={setParentPhone} />
                </div>
              </div>

              {/* Canales de Invitación */}
              {parentEmailExists === false && parentEmail.trim() && (
                <div className="space-y-2 rounded-lg border border-amber-100 bg-amber-50/50 p-3 mt-4">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    Canales de Invitación:
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        id="sendInviteEmailChild"
                        checked={sendInviteEmail}
                        onChange={e => setSendInviteEmail(e.target.checked)}
                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      />
                      <label htmlFor="sendInviteEmailChild" className="text-muted-foreground text-xs cursor-pointer">
                        Enviar invitación por Correo Electrónico a <strong>{parentEmail}</strong>
                      </label>
                    </div>
                    {parentPhone && parentPhone !== '+57' && (
                      <div className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          id="sendInviteWhatsappChild"
                          checked={sendInviteWhatsapp}
                          onChange={e => setSendInviteWhatsapp(e.target.checked)}
                          className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                        />
                        <label htmlFor="sendInviteWhatsappChild" className="text-muted-foreground text-xs cursor-pointer">
                          Generar link para invitar al acudiente por WhatsApp al finalizar
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Separator />

          {/* ── Sección 3: Inscripción ── */}
          <Section icon={<ClipboardList className="h-4 w-4" />} title="Inscripción">
            {branches.length > 0 && (
              <div>
                <Label>Sede *</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona una sede *" /></SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Equipo</Label>
                <p className="text-[11px] text-muted-foreground mb-1">Opcional — independiente del plan</p>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger><SelectValue placeholder="Sin equipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin equipo</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.sport ? <span className="ml-1 text-xs text-muted-foreground">— {t.sport}</span> : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Cuando la escuela no cobra por SportMaps, Plan y Mensualidad
                  no aplican: un plan es un producto FACTURABLE. El estado de la
                  membresia se registra aparte, en «Membresias». */}
              {hasBilling && (
              <div>
                <Label>Plan</Label>
                <p className="text-[11px] text-muted-foreground mb-1">Opcional — independiente del equipo</p>
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
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <Label className="mb-2">Fecha de Inscripción *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      {startDate ? (
                        format(new Date(startDate + 'T12:00:00'), "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate ? new Date(startDate + 'T12:00:00') : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          setStartDate(`${year}-${month}-${day}`);
                        }
                      }}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {hasBilling ? (
              <div>
                <Label>Mensualidad (COP) *</Label>
                <Input type="number" placeholder="150000" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} min={10000} step={1000} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {selectedPlanId !== 'none' ? 'Cargado desde el plan' : teamId !== 'none' ? 'Cargado desde el equipo' : 'Ingresa manualmente'}
                </p>
              </div>
              ) : (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Esta escuela no cobra mensualidades por SportMaps, asi que no se pide monto.
                El estado de la membresia se registra en <b>Membresias</b>, y ahi aparece este
                atleta en cuanto quede creado.
              </div>
              )}
            </div>

            {hasBilling && <ProrationCard
              startDate={startDate}
              monthlyFee={Number(monthlyFee) || 0}
              billing={billing}
              discountPct={discountPct}
              onDiscountChange={setDiscountPct}
              registrationFee={selectedPlanRegistrationFee}
            />}
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || checkingParentEmail}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
            ) : (
              <><Baby className="h-4 w-4 mr-2" />Registrar Menor</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
