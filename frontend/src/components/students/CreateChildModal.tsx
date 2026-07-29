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

import { useState, useEffect } from 'react';
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
}

interface Branch { id: string; name: string; }

interface CreateChildModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
}

interface ExistingChild {
  id: string;
  full_name: string;
  doc_type: string;
  doc_number: string;
  date_of_birth: string | null;
  gender: string | null;
  grade: string | null;
  medical_info: any;
  parent_name_temp?: string;
  parent_email_temp?: string;
  parent_phone_temp?: string;
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
}

// ─── Proration Card ───────────────────────────────────────────────────────────

function ProrationCard({ startDate, monthlyFee, billing, discountPct, onDiscountChange }: ProrationCardProps) {
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

// ─── Main Modal ───────────────────────────────────────────────────────────────

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
  const [parentPhone, setParentPhone] = useState('');

  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [parentSearching, setParentSearching]     = useState(false);
  const [parentFound, setParentFound]             = useState<{id: string; full_name: string; email: string; phone: string} | null>(null);
  const [searchDone, setSearchDone]               = useState(false);
  const [showForm, setShowForm]                   = useState(false); // para cuando el padre no existe y hay que crearlo
  const [parentChildren, setParentChildren]       = useState<ExistingChild[]>([]);
  const [selectedChildId, setSelectedChildId]     = useState<string | null>(null);

  // ── Sección 3: Inscripción ────────────────────────────────────────────────
  const [branchId, setBranchId]   = useState('none');
  // Equipo (independiente)
  const [teamId, setTeamId]       = useState('none');
  // Plan (independiente — guarda offering_plan_id y offering_id por separado)
  const [selectedPlanId, setSelectedPlanId]       = useState('none');   // offering_plans.id
  const [selectedOfferingId, setSelectedOfferingId] = useState(''); // offerings.id
  const [selectedPlanPrice, setSelectedPlanPrice] = useState(0);
  // Fecha y mensualidad (para el pago proporcional)
  const [startDate, setStartDate]   = useState(() => new Date().toISOString().split('T')[0]);
  const [monthlyFee, setMonthlyFee] = useState('');
  const [discountPct, setDiscountPct] = useState(0);

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !schoolId) return;

    Promise.all([
      // Equipos
      supabase
        .from('teams')
        .select('id, name, sport, price_monthly')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('name'),

      // Planes: offering_plans JOIN offerings — precio en offering_plans.price
      supabase
        .from('offering_plans')
        .select('id, name, price, duration_days, offering_id, offerings(id, name)')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('sort_order'),

      // Sedes
      supabase
        .from('school_branches')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name'),

      // Configuración de pagos
      supabase
        .from('school_settings')
        .select('payment_cutoff_day, billing_cycle_type')
        .eq('school_id', schoolId)
        .maybeSingle(),
    ]).then(([teamsRes, plansRes, branchesRes, settingsRes]) => {
      setTeams((teamsRes.data as Team[]) ?? []);

      // Aplanar offering_plans con su offering padre
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
      return;
    }
    const p = plans.find(p => p.plan_id === planId);
    if (p) {
      setSelectedOfferingId(p.offering_id);
      setSelectedPlanPrice(p.price);
      // El plan tiene prioridad sobre el equipo para la mensualidad
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
    setSelectedPlanId('none'); setSelectedOfferingId(''); setSelectedPlanPrice(0);
    setStartDate(new Date().toISOString().split('T')[0]); setMonthlyFee('');
    setDiscountPct(0);
    setParentSearchQuery(''); setSearchDone(false); setParentFound(null);
    setParentChildren([]); setSelectedChildId(null);
  };

  const handleParentSearch = async () => {
    const q = parentSearchQuery.trim();
    if (!q) return;
    setParentSearching(true);
    setParentFound(null);
    setShowForm(false);
    setParentChildren([]);
    setSelectedChildId(null);
    
    try {
      const isEmail = q.includes('@');

      // Llamamos al nuevo endpoint del BFF que unifica búsqueda de padre e hijos
      const result = await bffClient.get(
        `/api/v1/trainer/search-parent-children?q=${encodeURIComponent(q)}`,
        { 'x-school-id': schoolId }
      ) as { profile: any; children: any[] };

      const profile  = result?.profile ?? null;
      const children = result?.children ?? [];

      setParentChildren(children);

      if (profile) {
        setParentFound(profile);
        setParentName(profile.full_name || '');
        setParentEmail(profile.email || '');
        setParentPhone(profile.phone || '');
        setShowForm(true);
        
        toast({ 
          title: children.length > 0 ? 'Acudiente e hijos encontrados' : 'Acudiente encontrado', 
          description: children.length > 0 
            ? `${profile.full_name} tiene ${children.length} hijo(s) en esta escuela.` 
            : `${profile.full_name} identificado.` 
        });
      } else if (children.length > 0) {
        // No hay perfil de usuario oficial, pero hay historial de hijos (ej: carga masiva)
        const first = children[0];
        setParentName(first.parent_name_temp || '');
        setParentEmail(first.parent_email_temp || (isEmail ? q.toLowerCase() : ''));
        setParentPhone(first.parent_phone_temp || (!isEmail ? q : ''));
        setShowForm(true);
        
        toast({ 
          title: 'Historial encontrado', 
          description: `Se identificaron ${children.length} hijo(s) vinculados a este contacto.` 
        });
      } else {
        toast({ 
          title: 'Sin coincidencias', 
          description: 'No hay perfil ni historial previo. Ingresa los datos manualmente.' 
        });
        setParentEmail(isEmail ? q.toLowerCase() : '');
        setParentPhone(!isEmail ? q : '');
        setShowForm(true);
      }
    } catch (err) {
      console.error('Error en búsqueda:', err);
      toast({ title: 'Error al buscar', variant: 'destructive' });
    } finally {
      setParentSearching(false);
      setSearchDone(true);
    }
  };

  const handleSelectExistingChild = (childId: string) => {
    if (childId === 'new') {
      setSelectedChildId(null);
      setDocNumber('');
      setFullName('');
      setDob('');
      setGender('');
      setGrade('');
      setMedicalHasAllergies('false');
      setMedicalNotes('');
      return;
    }
    
    const child = parentChildren.find(c => c.id === childId);
    if (child) {
      setSelectedChildId(child.id);
      setDocType(child.doc_type || 'TI');
      setDocNumber(child.doc_number || '');
      setFullName(child.full_name || '');
      setDob(child.date_of_birth || '');
      setGender(child.gender || '');
      setGrade(child.grade || '');
      
      const medInfo = typeof child.medical_info === 'string' 
        ? JSON.parse(child.medical_info) 
        : child.medical_info;
      
      setMedicalHasAllergies(medInfo?.has_allergies ? 'true' : 'false');
      setMedicalNotes(medInfo?.notes || '');
    }
  };

  const handleClose = () => { reset(); onClose(); };

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
      ...(medicalNotes ? { notes: medicalNotes } : {}),
    });

    try {
      setSubmitting(true);

      // Si no es un hijo existente y hay documento, verificar duplicado localmente
      if (!selectedChildId && docNumber.trim()) {
        const { data: existingChild } = await supabase
          .from('children')
          .select('id, full_name')
          .eq('school_id', schoolId)
          .eq('doc_number', docNumber.trim())
          .maybeSingle();

        if (existingChild) {
          toast({
            title: 'Menor ya registrado',
            description: `Ya existe un menor con documento ${docNumber} en esta escuela: "${existingChild.full_name}". Edítalo desde la lista de atletas.`,
            variant: 'destructive',
          });
          setSubmitting(false);
          return;
        }
      }

      // Payload base para inscripciones
      const enrollmentData = {
        branch_id:        (branchId && branchId !== 'none') ? branchId : null,
        team_id:          (teamId && teamId !== 'none') ? teamId : null,
        offering_plan_id: (selectedPlanId && selectedPlanId !== 'none') ? selectedPlanId : null,
        offering_id:      selectedOfferingId || null,
        start_date:       startDate,
        monthly_fee:      monthlyFee ? Number(monthlyFee) : null,
        discount_pct:     discountPct > 0 ? discountPct : undefined,
      };

      let result: any;

      if (selectedChildId) {
        // FLUJO: Inscripción de hijo existente
        result = await bffClient.post('/api/v1/students/create-one', {
          type: 'child_existing',
          child_id: selectedChildId,
          ...enrollmentData,
        }, { 'x-school-id': schoolId });
      } else {
        // FLUJO: Creación e inscripción de nuevo hijo
        result = await bffClient.post('/api/v1/students/create-one', {
          type: 'child',
          ...enrollmentData,
          // Identificación (documento opcional)
          doc_type:   docType,
          doc_number: docNumber.trim() || null,
          // Datos personales
          full_name:    fullName.trim(),
          date_of_birth: dob || null,
          gender:       gender || null,
          grade:        grade  || null,
          medical_info: medicalInfo,
          // Acudiente
          parent_name:  parentName.trim(),
          parent_email: parentEmail.trim().toLowerCase(),
          parent_phone: parentPhone.replace(/\D/g, ''),
        }, { 'x-school-id': schoolId });
      }

      toast({ title: '✅ Registro exitoso', description: `${fullName} fue procesado correctamente.` });

      if (result?.registration_link && parentPhone) {
        const phoneClean = parentPhone.replace(/\D/g, '');
        const msg = `¡Hola ${parentName}! ${fullName} ha sido inscrito. Activa tu cuenta aquí: ${result.registration_link}`;
        toast({
          title: 'Invitar acudiente por WhatsApp',
          description: (
            <button
              className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white text-xs py-2 px-3 rounded-md"
              onClick={() => window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`, '_blank')}
            >
              📱 Abrir WhatsApp
            </button>
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-blue-500" />
            Registrar Menor de Edad
          </DialogTitle>
          <DialogDescription>
            El acudiente recibirá una invitación por email para activar su cuenta y ver los pagos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          
          {/* ── Búsqueda de Acudiente ── */}
          <Section icon={<Search className="h-4 w-4" />} title="Buscar Acudiente">
            <div className="flex gap-2">
              <Input
                placeholder="Email o teléfono del acudiente..."
                value={parentSearchQuery}
                onChange={e => {
                  setParentSearchQuery(e.target.value);
                  setSearchDone(false);
                  setParentFound(null);
                }}
                onKeyDown={e => e.key === 'Enter' && handleParentSearch()}
                className="flex-1"
              />
              <Button variant="outline" onClick={handleParentSearch} disabled={!parentSearchQuery.trim() || parentSearching} type="button">
                {parentSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground px-1">
              Busca por email o celular para vincular a un padre/madre existente.
            </p>

            {/* Encontrado */}
            {searchDone && parentFound && (
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900 dark:text-green-100">{parentFound.full_name}</p>
                  <p className="text-sm text-green-700 dark:text-green-300">{parentFound.email}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSearchDone(false); setParentFound(null); setParentSearchQuery(''); }} className="text-xs">
                  Cambiar
                </Button>
              </div>
            )}

            {/* No encontrado */}
            {searchDone && !parentFound && !showForm && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-100">Acudiente no encontrado</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Si el acudiente es nuevo, regístralo junto al menor.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => {
                  setShowForm(true);
                  if (parentSearchQuery.includes('@')) setParentEmail(parentSearchQuery.trim().toLowerCase());
                }}>
                  Registrar Nuevo Acudiente y Menor
                </Button>
              </div>
            )}
          </Section>

          {/* ── Formulario Completo (solo si ya se buscó y se continúa) ── */}
          {(parentFound || showForm) && (
            <>
              <Separator />

              {/* Datos del Acudiente (solo si es nuevo y no se encontró perfil) */}
              {showForm && !parentFound && (
                <Section icon={<Users className="h-4 w-4" />} title="Datos del Nuevo Acudiente">
                  <div className="space-y-3 rounded-lg border border-dashed p-4">
                    <div>
                      <Label>Nombre del Acudiente *</Label>
                      <Input placeholder="María López" value={parentName} onChange={e => setParentName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Email *</Label>
                        <Input type="email" placeholder="madre@email.com" value={parentEmail} onChange={e => setParentEmail(e.target.value)} />
                      </div>
                      <div>
                        <Label>Teléfono *</Label>
                        <PhoneInput value={parentPhone} onChange={setParentPhone} />
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              <Separator />

              {/* ── Sección 1: Datos del menor ── */}
              <Section icon={<Baby className="h-4 w-4" />} title="Información del Menor">
                
                {/* Selector de hijos existentes si los hay */}
                {parentChildren.length > 0 && (
                  <div className="bg-muted/40 dark:bg-muted/20 border border-border rounded-xl p-4 space-y-3 transition-all shadow-sm">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground flex items-center gap-2 font-semibold">
                        <Users className="h-4 w-4 text-primary" />
                        Hijos vinculados a este contacto
                      </Label>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                        Historial
                      </span>
                    </div>
                    <Select value={selectedChildId || 'new'} onValueChange={handleSelectExistingChild}>
                      <SelectTrigger className="bg-background border-input focus:ring-primary shadow-sm">
                        <SelectValue placeholder="Seleccionar hijo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new" className="font-medium text-primary">
                          ➕ Registrar a otro hijo
                        </SelectItem>
                        {parentChildren.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.full_name} — {c.doc_number || 'Sin documento'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Tipo de Doc. *</Label>
                    <Select value={docType} onValueChange={setDocType} disabled={!!selectedChildId}>
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
                    <Input placeholder="1234567890" value={docNumber} onChange={e => setDocNumber(e.target.value)} disabled={!!selectedChildId} />
                  </div>
                </div>

                <div>
                  <Label>Nombre Completo *</Label>
                  <Input placeholder="Ana María Gómez López" value={fullName} onChange={e => setFullName(e.target.value)} disabled={!!selectedChildId} />
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

              {/* ── Sección 3: Inscripción ── */}
              <Section icon={<ClipboardList className="h-4 w-4" />} title="Inscripción">
                {branches.length > 0 && (
                  <div>
                    <Label>Sede</Label>
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Equipo</Label>
                    <p className="text-xs text-muted-foreground mb-1">Opcional — independiente del plan</p>
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
                  <div>
                    <Label>Plan</Label>
                    <p className="text-xs text-muted-foreground mb-1">Opcional — independiente del equipo</p>
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

                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <Label>Mensualidad (COP) *</Label>
                    <Input type="number" placeholder="150000" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} min={10000} step={1000} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedPlanId !== 'none' ? 'Cargado desde el plan' : teamId !== 'none' ? 'Cargado desde el equipo' : 'Ingresa manualmente'}
                    </p>
                  </div>
                </div>

                <ProrationCard
                  startDate={startDate}
                  monthlyFee={Number(monthlyFee) || 0}
                  billing={billing}
                  discountPct={discountPct}
                  onDiscountChange={setDiscountPct}
                />
              </Section>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          {(parentFound || showForm) && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
              ) : (
                <><Baby className="h-4 w-4 mr-2" />Registrar Menor</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
