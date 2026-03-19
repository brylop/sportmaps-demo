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
import { calcProration, formatCOP } from '@/lib/prorationUtils';

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
        <p className="text-blue-700 dark:text-blue-300">
          Inscripción el 1° del mes — se cobra el mes completo.
        </p>
      ) : (
        <div className="space-y-1 text-blue-700 dark:text-blue-300">
          <div className="flex justify-between">
            <span>Días restantes del mes:</span>
            <span className="font-medium">{remainingDays} de {daysInMonth}</span>
          </div>
          <div className="flex justify-between">
            <span>Primer cobro proporcional:</span>
            <span className="font-bold text-blue-900 dark:text-blue-100">
              {formatCOP(proratedFee)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Vence:</span>
            <span>
              {dueDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
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
    ]).then(([teamsRes, plansRes, branchesRes]) => {
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
    setParentName(''); setParentEmail(''); setParentPhone('');
    setBranchId('none'); setTeamId('none');
    setSelectedPlanId('none'); setSelectedOfferingId(''); setSelectedPlanPrice(0);
    setStartDate(new Date().toISOString().split('T')[0]);
    setMonthlyFee(''); setShowMedical(false);
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!docNumber.trim()) return 'El número de documento es obligatorio.';
    if (!fullName.trim())  return 'El nombre completo es obligatorio.';
    if (!dob)              return 'La fecha de nacimiento es obligatoria.';
    if (!parentName.trim() || parentName.trim().length < 2)
      return 'El nombre del acudiente es obligatorio (mín. 2 caracteres).';
    if (!parentEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))
      return 'El email del acudiente no es válido.';
    if (!/^\d{10,}$/.test(parentPhone.replace(/\s/g, '')))
      return 'El teléfono del acudiente debe tener mínimo 10 dígitos.';
    if (!startDate) return 'La fecha de inscripción es obligatoria.';
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
      await bffClient.post('/api/v1/students/create-one', {
        type: 'child',
        // Identificación
        doc_type:   docType,
        doc_number: docNumber.trim(),
        // Datos personales
        full_name:    fullName.trim(),
        date_of_birth: dob || null,
        gender:       gender || null,
        grade:        grade  || null,
        medical_info: medicalInfo,
        // Acudiente
        parent_name:  parentName.trim(),
        parent_email: parentEmail.trim().toLowerCase(),
        parent_phone: parentPhone.replace(/\s/g, ''),
        // Inscripción
        branch_id:        (branchId && branchId !== 'none') ? branchId : null,
        team_id:          (teamId && teamId !== 'none') ? teamId : null,   // independiente
        offering_plan_id: (selectedPlanId && selectedPlanId !== 'none') ? selectedPlanId : null,   // independiente
        offering_id:      selectedOfferingId || null,  // se guarda junto al plan
        start_date:  startDate,
        monthly_fee: monthlyFee ? Number(monthlyFee) : null,
      }, { 'x-school-id': schoolId });

      toast({ title: '¡Menor registrado!', description: `${fullName} fue inscrito correctamente.` });
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
                <Label>Número de Documento *</Label>
                <Input
                  placeholder="1234567890"
                  value={docNumber}
                  onChange={e => setDocNumber(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Nombre Completo *</Label>
              <Input
                placeholder="Ana María Gómez López"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha de Nacimiento *</Label>
                <Input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
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
              <Input
                placeholder="Ej: 6A, 7B, Primaria"
                value={grade}
                onChange={e => setGrade(e.target.value)}
              />
            </div>

            {/* Información médica — colapsable */}
            <button
              type="button"
              onClick={() => setShowMedical(v => !v)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showMedical ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Información médica {showMedical ? '' : '(opcional)'}
            </button>

            {showMedical && (
              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <div>
                  <Label>¿Tiene alergias?</Label>
                  <Select
                    value={medicalHasAllergies}
                    onValueChange={v => setMedicalHasAllergies(v as 'true' | 'false')}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">No</SelectItem>
                      <SelectItem value="true">Sí</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notas adicionales</Label>
                  <Textarea
                    placeholder="Condiciones, medicamentos, restricciones físicas..."
                    value={medicalNotes}
                    onChange={e => setMedicalNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}
          </Section>

          <Separator />

          {/* ── Sección 2: Acudiente ── */}
          <Section icon={<Users className="h-4 w-4" />} title="Datos del Acudiente">
            <div>
              <Label>Nombre del Acudiente *</Label>
              <Input
                placeholder="María López"
                value={parentName}
                onChange={e => setParentName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email del Acudiente *</Label>
                <Input
                  type="email"
                  placeholder="madre@email.com"
                  value={parentEmail}
                  onChange={e => setParentEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>Teléfono del Acudiente *</Label>
                <Input
                  placeholder="3001234567"
                  value={parentPhone}
                  onChange={e => setParentPhone(e.target.value)}
                />
              </div>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Se enviará una invitación a este correo para que el acudiente active su cuenta
                y pueda ver el historial de pagos de su hijo.
              </AlertDescription>
            </Alert>
          </Section>

          <Separator />

          {/* ── Sección 3: Inscripción ── */}
          <Section icon={<ClipboardList className="h-4 w-4" />} title="Inscripción">

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
                <p className="text-xs text-muted-foreground mb-1">Opcional — independiente del plan</p>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger><SelectValue placeholder="Sin equipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin equipo</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.sport ? (
                          <span className="ml-1 text-xs text-muted-foreground">— {t.sport}</span>
                        ) : null}
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

            {/* Fecha de inscripción y mensualidad */}
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
                <Label>Mensualidad (COP) *</Label>
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
                    ? 'Cargado desde el plan seleccionado'
                    : teamId
                    ? 'Cargado desde el equipo seleccionado'
                    : 'Ingresa el valor manualmente'}
                </p>
              </div>
            </div>

            {/* Card de proration */}
            <ProrationCard startDate={startDate} monthlyFee={Number(monthlyFee) || 0} />
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
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
