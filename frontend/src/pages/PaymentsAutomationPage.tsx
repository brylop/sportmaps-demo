import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { NumberStepper } from '@/components/ui/number-stepper';
import { CheckCircle2, Clock, CreditCard, TrendingUp, Download, Eye, EyeOff, Loader2, XCircle, Save, Bell, DollarSign, Shield, Smartphone, Building2, AlertTriangle, Trophy, Zap, Banknote } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { formatCurrency, maskSensitive } from '@/lib/utils';
import { normalizeReceiptUrl } from '@/lib/normalizeReceiptUrl';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getUserFriendlyError } from '@/lib/error-translator';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { FileUpload } from '@/components/common/FileUpload';
import { emailClient } from '@/lib/email-client';
import { ReviewInstallmentModal } from '@/components/payment/ReviewInstallmentModal';
import { InstallmentsConfigCard } from '@/components/payment/InstallmentsConfigCard';
import { todayColombia } from '@/lib/dateUtils';
import { SportMapsPaySettings } from '@/components/settings/SportMapsPaySettings';
import { RegisterCashPaymentModal } from '@/components/payment/RegisterCashPaymentModal';
import { ApprovePaymentMethodSheet } from '@/components/payment/ApprovePaymentMethodSheet';
import { bffClient } from '@/lib/api/bffClient';
import { GlosaConciliationDialog } from '@/components/payment/GlosaConciliationDialog';
import { ReconciliationTab } from '@/components/payment/ReconciliationTab';
import { CreateGlosaDialog } from '@/components/payment/CreateGlosaDialog';
import { listBySchool as listSchoolGlosas, REASON_ADMIN_LABELS, STATUS_LABELS, OPEN_GLOSA_STATUSES, type Glosa } from '@/lib/api/glosas';


interface BillingSettings {
  school_id: string;
  payment_cutoff_day: number;
  payment_grace_days: number;
  auto_generate_payments: boolean;
  reminder_enabled: boolean;
  reminder_days_before: number;
  late_fee_enabled: boolean;
  late_fee_percentage: number;
  allow_coach_messaging: boolean;
  require_payment_proof: boolean;
  bank_name?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  nequi_number?: string | null;
  daviplata_number?: string | null;
  bank_titular_name?: string | null;
  bank_titular_id?: string | null;
  payment_qr_url?: string | null;
  breb_number?: string | null;
  transfer_key?: string | null;
  allow_installments: boolean;
  max_installments_per_payment: number;
  min_installment_amount: number;
  installment_require_proof: boolean;
  billing_cycle_type: 'prorated' | 'fixed_calendar' | 'rolling_30';
  early_payment_discount_enabled: boolean;
  early_payment_discount_days: number;
  early_payment_discount_percentage: number;
  // Validación automática de comprobantes (Fase 5)
  auto_approve_enabled: boolean;
  auto_approve_max_amount: number;
  auto_glosa_enabled: boolean;
}


const DEFAULT_BILLING: Omit<BillingSettings, 'school_id'> = {
  payment_cutoff_day: 5,
  payment_grace_days: 5,
  auto_generate_payments: true,
  reminder_enabled: true,
  reminder_days_before: 3,
  late_fee_enabled: false,
  late_fee_percentage: 5,
  allow_coach_messaging: true,
  require_payment_proof: true,
  allow_installments: true,
  max_installments_per_payment: 3,
  min_installment_amount: 10000,
  installment_require_proof: true,
  billing_cycle_type: 'prorated',
  early_payment_discount_enabled: false,
  early_payment_discount_days: 5,
  early_payment_discount_percentage: 0,
  auto_approve_enabled: false,
  auto_approve_max_amount: 0,
  auto_glosa_enabled: false,
};


// ── Helper de OCR badge (mostrar match/no-match al admin) ────────────────────
type OcrStatus = 'match' | 'mismatch' | 'no_ocr';
function getOcrStatus(p: { amount: number; ocr_amount?: number | null }): OcrStatus {
  if (p.ocr_amount == null) return 'no_ocr';
  const diffPct = Math.abs(p.ocr_amount - p.amount) / Math.max(p.amount, 1) * 100;
  return diffPct <= 0.5 ? 'match' : 'mismatch';
}

function OcrMatchBadge({ payment }: { payment: { amount: number; ocr_amount?: number | null; ocr_bank?: string | null } }) {
  const status = getOcrStatus(payment);
  if (status === 'no_ocr') {
    return (
      <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-600 border-gray-200 py-0 h-5">
        Sin OCR
      </Badge>
    );
  }
  if (status === 'match') {
    return (
      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-300 py-0 h-5">
        <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> OCR ok {payment.ocr_bank ? `· ${payment.ocr_bank}` : ''}
      </Badge>
    );
  }
  // mismatch
  return (
    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-300 py-0 h-5 font-semibold">
      <AlertTriangle className="h-2.5 w-2.5 mr-1" />
      OCR: {formatCurrency(payment.ocr_amount as number)} ≠ esperado
    </Badge>
  );
}

// Badge read-only del veredicto de reglas (modo sombra, Fase 2). Informativo:
// NO cambia la decisión de aprobar/rechazar — sirve para calibrar antes de activar.
function VerdictBadge({ verdict }: { verdict?: string | null }) {
  if (!verdict) return null;
  const cfg: Record<string, { label: string; className: string }> = {
    verde: { label: 'Veredicto: verde', className: 'bg-green-50 text-green-700 border-green-300' },
    amarillo: { label: 'Veredicto: amarillo', className: 'bg-amber-50 text-amber-700 border-amber-300' },
    rojo: { label: 'Veredicto: rojo', className: 'bg-red-50 text-red-700 border-red-300' },
  };
  const c = cfg[verdict];
  if (!c) return null;
  return (
    <Badge variant="outline" title="Veredicto automático de reglas (informativo, no decide)" className={`text-[10px] py-0 h-5 ${c.className}`}>
      {c.label}
    </Badge>
  );
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paid: { label: 'Pagado', className: 'bg-green-500 text-white border-transparent' },
  rejected: { label: 'Rechazado', className: 'bg-red-100 text-red-700 border-red-200' },
  awaiting_approval: { label: 'Por Validar', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  overdue: { label: 'Vencido', className: 'bg-red-50 text-red-600 border-red-200' },
  failed: { label: 'Fallido', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  pending: { label: 'Pendiente', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  partial: { label: 'Abono parcial', className: 'bg-blue-50 text-blue-700 border-blue-200' },
};

interface PaymentTransaction {
  id: string;
  amount: number;
  amount_paid?: number | null;
  status: string;
  created_at: string;
  payment_method: string | null;
  payment_type: string | null;
  receipt_url: string | null;
  concept: string;
  team_id: string | null;
  parent: { full_name: string | null; email: string | null } | null;
  child: { full_name: string } | null;
  program: { name: string } | null;
  team: { name: string } | null;
  child_id?: string | null;
  parent_id?: string | null;
  user_id?: string | null;
  unregistered_athlete_id?: string | null;
  athlete_name?: string | null;
  parent_responsible?: string | null;
  plan?: { name: string } | null;
  early_payment_discount_applied?: number | null;
  // OCR del comprobante manual (LLM Vision). Null si no se logro leer o si es Wompi.
  ocr_amount?: number | null;
  ocr_currency?: string | null;
  ocr_date?: string | null;
  ocr_bank?: string | null;
  ocr_reference?: string | null;
  ocr_provider?: string | null;
  // Veredicto de reglas (modo sombra, Fase 2). Informativo.
  receipt_verdict?: string | null;
  ocr_destination?: string | null;
  receipt_verdict_reasons?: unknown[] | null;
  reconciliation_status?: string | null;
}

interface TeamSubscription {
  id: string;
  full_name: string;
  child_id?: string | null;
  user_id?: string | null;
  unregistered_athlete_id?: string | null;
  // Equipo
  team_id?: string | null;
  team_name?: string | null;
  price_monthly: number;
  // Plan
  offering_plan_id?: string | null;
  plan_name?: string | null;
  plan_price?: number;
  has_team: boolean;
  has_plan: boolean;
  start_date: string;
}

export default function PaymentsAutomationPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { schoolId, activeBranchId, currentUserRole } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [teamSubscriptions, setTeamSubscriptions] = useState<TeamSubscription[]>([]);
  const [viewingProof, setViewingProof] = useState<{ open: boolean; url: string; student: string; amount: number }>({
    open: false, url: '', student: '', amount: 0,
  });
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Glosas (aclaraciones) de la escuela.
  const [glosas, setGlosas] = useState<Glosa[]>([]);
  const [conciliatingGlosa, setConciliatingGlosa] = useState<Glosa | null>(null);
  const [creatingGlosaPayment, setCreatingGlosaPayment] = useState<PaymentTransaction | null>(null);
  const [billing, setBilling] = useState<BillingSettings | null>(null);
  const [billingSaving, setBillingSaving] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);

  // Filtros Historial y Equipos
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyTeamFilter, setHistoryTeamFilter] = useState('all');
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  // Filtros Validación (Pendientes)
  const [pendingSearch, setPendingSearch] = useState('');

  // Estados para Cash Payments
  const [showCashModal, setShowCashModal] = useState(false);
  const [paymentToApprove, setPaymentToApprove] = useState<PaymentTransaction | null>(null);

  // Equipos activos para filtros
  const [activeTeams, setActiveTeams] = useState<{ id: string; name: string }[]>([]);

  // Reset de la paginación del historial cuando cambian los filtros
  useEffect(() => { setHistoryPage(1); }, [historySearch, historyStatusFilter, historyTeamFilter]);

  useEffect(() => {
    const teamsMap = new Map();
    payments.forEach(p => p.team?.name && teamsMap.set(p.team.name, { id: p.team_id, name: p.team.name }));
    teamSubscriptions.forEach(t => t.team_name && teamsMap.set(t.team_name, { id: t.team_id, name: t.team_name }));
    setActiveTeams(Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
  }, [payments, teamSubscriptions]);

  useEffect(() => {
    if (schoolId) {
      loadBillingSettings();
      fetchPayments();
      loadTeamSubscriptions();
      fetchGlosas();
    }
  }, [schoolId, activeBranchId]);

  const fetchGlosas = async () => {
    if (!schoolId) return;
    try {
      const rows = await listSchoolGlosas();
      setGlosas(rows);
    } catch {
      setGlosas([]);
    }
  };

  const loadBillingSettings = async () => {
    if (!schoolId) return;
    const { data } = await supabase.from('school_settings').select('*').eq('school_id', schoolId).maybeSingle();
    setBilling(data ? (data as unknown as BillingSettings) : { ...DEFAULT_BILLING, school_id: schoolId });
  };

  const handleSaveBilling = async () => {
    if (!billing || !schoolId) return;
    setBillingSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        payment_cutoff_day: billing.payment_cutoff_day,
        payment_grace_days: billing.payment_grace_days,
        auto_generate_payments: billing.auto_generate_payments,
        reminder_enabled: billing.reminder_enabled,
        reminder_days_before: billing.reminder_days_before,
        late_fee_enabled: billing.late_fee_enabled,
        late_fee_percentage: billing.late_fee_percentage,
        allow_coach_messaging: billing.allow_coach_messaging,
        require_payment_proof: billing.require_payment_proof,
        bank_name: billing.bank_name,
        bank_account_type: billing.bank_account_type,
        bank_account_number: billing.bank_account_number,
        nequi_number: billing.nequi_number,
        daviplata_number: billing.daviplata_number,
        bank_titular_name: billing.bank_titular_name,
        bank_titular_id: billing.bank_titular_id,
        payment_qr_url: billing.payment_qr_url,
        breb_number: billing.breb_number,
        transfer_key: billing.transfer_key,
        billing_cycle_type: billing.billing_cycle_type,
        allow_installments: billing.allow_installments,
        max_installments_per_payment: billing.max_installments_per_payment,
        min_installment_amount: billing.min_installment_amount,
        installment_require_proof: billing.installment_require_proof,
        early_payment_discount_enabled: billing.early_payment_discount_enabled,
        early_payment_discount_days: billing.early_payment_discount_days,
        early_payment_discount_percentage: billing.early_payment_discount_percentage,
        auto_approve_enabled: billing.auto_approve_enabled,
        auto_approve_max_amount: billing.auto_approve_max_amount,
        auto_glosa_enabled: billing.auto_glosa_enabled,
      };

      const { error } = await supabase.from('school_settings').upsert(payload, { onConflict: 'school_id' });
      if (error) throw error;
      toast({ title: '✅ Configuración de pagos guardada' });
    } catch (err: any) {
      toast({ title: 'Error al guardar', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      setBillingSaving(false);
    }
  };

  const updateBilling = <K extends keyof BillingSettings>(key: K, value: BillingSettings[K]) => {
    if (billing) setBilling({ ...billing, [key]: value });
  };  const fetchPayments = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('payments')
        .select(`
          id, amount, amount_paid, status, created_at, payment_method, payment_type,
          receipt_url, concept, child_id, parent_id, user_id, team_id,
          unregistered_athlete_id, early_payment_discount_applied,
          period_year, period_month,
          ocr_amount, ocr_currency, ocr_date, ocr_bank, ocr_reference, ocr_provider,
          receipt_verdict, ocr_destination, receipt_verdict_reasons, reconciliation_status,
          parent:profiles!payments_parent_id_fkey(full_name, email),
          user:profiles!payments_user_id_fkey(full_name, email),
          child:children!payments_child_id_fkey(full_name),
          team:teams!payments_team_id_fkey(name),
          plan:offering_plans!payments_offering_plan_id_fkey(name)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (activeBranchId) query = query.eq('branch_id', activeBranchId);
      const { data, error } = await query;
      if (error) throw error;

      // Resolver nombres de atletas sin cuenta (unregistered)
      const unregisteredIds = (data || [])
        .filter((p: any) => p.unregistered_athlete_id)
        .map((p: any) => p.unregistered_athlete_id);

      const unregisteredMap = new Map<string, string>();
      if (unregisteredIds.length > 0) {
        const { data: unregistered } = await (supabase
          .from('unregistered_athletes') as any)
          .select('id, full_name')
          .in('id', unregisteredIds);
        (unregistered || []).forEach((u: any) => unregisteredMap.set(u.id, u.full_name));
      }

      // Set de periodos ya cubiertos (paid/approved) por hijo, para marcar
      // duplicados visibles cuando un comprobante pendiente apunta a un mes
      // ya pagado. Clave: `${child_id}|${year}|${month}`.
      const settledPeriods = new Set<string>();
      (data as any[] | null)?.forEach((p) => {
        if (p.child_id && p.period_year && p.period_month && (p.status === 'paid' || p.status === 'approved')) {
          settledPeriods.add(`${p.child_id}|${p.period_year}|${p.period_month}`);
        }
      });

      const monthLabel = (y?: number | null, m?: number | null): string | null =>
        y && m && m >= 1 && m <= 12
          ? `${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m - 1]} ${y}`
          : null;

      setPayments(((data as any[]) || []).map((p) => ({
        id: p.id, amount: p.amount, amount_paid: p.amount_paid, status: p.status, created_at: p.created_at,
        payment_method: p.payment_method, payment_type: p.payment_type,
        receipt_url: p.receipt_url, concept: p.concept,
        child_id: p.child_id, parent_id: p.parent_id, user_id: p.user_id,
        team_id: p.team_id,
        unregistered_athlete_id: p.unregistered_athlete_id,
        early_payment_discount_applied: p.early_payment_discount_applied,
        ocr_amount: p.ocr_amount, ocr_currency: p.ocr_currency,
        ocr_date: p.ocr_date, ocr_bank: p.ocr_bank,
        ocr_reference: p.ocr_reference, ocr_provider: p.ocr_provider,
        receipt_verdict: p.receipt_verdict ?? null,
        ocr_destination: p.ocr_destination ?? null,
        receipt_verdict_reasons: p.receipt_verdict_reasons ?? null,
        reconciliation_status: p.reconciliation_status ?? null,
        period_year:  p.period_year ?? null,
        period_month: p.period_month ?? null,
        period_label: monthLabel(p.period_year, p.period_month),
        // Solo marcamos duplicado en pendientes que reclaman un periodo
        // ya saldado por OTRO pago (no por si mismo).
        period_already_settled:
          p.status === 'awaiting_approval' &&
          p.child_id && p.period_year && p.period_month &&
          settledPeriods.has(`${p.child_id}|${p.period_year}|${p.period_month}`),
        // Nombre del atleta resuelto por tipo
        athlete_name:
          p.child?.full_name ||
          ((p.user_id || p.parent_id) && !p.child_id ? (p.user?.full_name || p.parent?.full_name) : null) ||
          (p.unregistered_athlete_id ? unregisteredMap.get(p.unregistered_athlete_id) : null) ||
          null,
        // Padre/responsable solo si es diferente al atleta (menores)
        parent_responsible: p.child_id ? (p.parent?.full_name || null) : null,
        parent: p.parent,
        child: p.child,
        program: null,
        team: p.team,
        plan: p.plan,
      })));
    } catch (error: unknown) {
      toast({ title: 'Error al cargar pagos', description: getUserFriendlyError(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamSubscriptions = async () => {
    if (!schoolId) return;
    try {
      const { data, error } = await (supabase
        .from('enrollments') as any)
        .select(`
          id, child_id, user_id, unregistered_athlete_id,
          team_id, offering_plan_id,
          start_date,
          team:teams!enrollments_team_id_fkey ( name, price_monthly ),
          plan:offering_plans!enrollments_offering_plan_id_fkey ( name, price )
        `)
        .eq('school_id', schoolId)
        .eq('status', 'active');

      if (error) throw error;

      // ─── OPTIMIZACIÓN: Fetch en bloque ─────────────────────────────────────
      const rawEnrollments = (data as any[]) || [];
      if (rawEnrollments.length === 0) {
        setTeamSubscriptions([]);
        return;
      }

      const childIds = rawEnrollments.map(e => e.child_id).filter(Boolean);
      const userIds  = rawEnrollments.map(e => e.user_id).filter(Boolean);
      const unregIds = rawEnrollments.map(e => e.unregistered_athlete_id).filter(Boolean);

      // 1. Atletas (BFF para menores - soporta multi-school)
      const childrenData = childIds.length > 0
        ? await bffClient.post<any[]>(`/api/v1/students/children-by-ids`, { ids: childIds }, { 'x-school-id': schoolId })
        : [];
      const childMap = new Map<string, string>((childrenData ?? []).map(c => [c.id, c.full_name]));

      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] };
      const profileMap = new Map<string, string>((profiles ?? []).map(p => [p.id, p.full_name]));

      const { data: unreg } = unregIds.length > 0
        ? await (supabase.from('unregistered_athletes') as any).select('id, full_name').in('id', unregIds)
        : { data: [] };
      const unregMap = new Map<string, string>((unreg ?? []).map(u => [u.id, u.full_name]));

      const mapped = rawEnrollments.map(e => {
        let fullName = 'Sin nombre';
        if (e.child_id)                     fullName = childMap.get(e.child_id) || fullName;
        else if (e.user_id)                 fullName = profileMap.get(e.user_id) || fullName;
        else if (e.unregistered_athlete_id)   fullName = unregMap.get(e.unregistered_athlete_id) || fullName;

        return {
          id: e.id,
          child_id: e.child_id,
          user_id: e.user_id,
          unregistered_athlete_id: e.unregistered_athlete_id,
          full_name: fullName,
          // Equipo
          team_id: e.team_id,
          team_name: e.team?.name || null,
          price_monthly: e.team?.price_monthly || 0,
          // Plan
          offering_plan_id: e.offering_plan_id,
          plan_name: e.plan?.name || null,
          plan_price: e.plan?.price || 0,
          // Tipo
          has_team: !!e.team_id,
          has_plan: !!e.offering_plan_id,
          start_date: e.start_date,
        };
      });

      setTeamSubscriptions(mapped);
    } catch (error: unknown) {
      toast({ title: 'Error en suscripciones', description: getUserFriendlyError(error), variant: 'destructive' });
    }
  };

  // isAuthorized: profile.role handles regular users, currentUserRole handles school 'owner' role
  // (profile.role never contains 'owner' - that's a school_members role, not a profile role)
  const isAuthorized = profile && (
    ['school', 'admin', 'school_admin', 'super_admin', 'personal_trainer'].includes(profile.role) ||
    ['owner', 'admin', 'school_admin', 'super_admin', 'personal_trainer'].includes(currentUserRole || '')
  );
  if (!isAuthorized) return <Navigate to="/dashboard" replace />;

  const handleManualAction = async (paymentId: string, action: 'approve' | 'reject') => {
    setProcessingId(paymentId);
    const newStatus = action === 'approve' ? 'paid' : 'rejected';
    const payment = payments.find(p => p.id === paymentId);

    try {
      const updatePayload: any = { status: newStatus };
      
      if (action === 'approve' && profile && payment) {
        updatePayload.approved_by = profile.id;
        updatePayload.approved_at = new Date().toISOString();
        updatePayload.amount_paid = payment.amount - (Number(payment.early_payment_discount_applied) || 0);
        // Fase 5: todo aprobado (auto o manual) queda pendiente de conciliación bancaria.
        updatePayload.reconciliation_status = 'pendiente';
      }

      const { error: updateError } = await supabase.from('payments').update(updatePayload).eq('id', paymentId);
      if (updateError) throw updateError;
      if (action === 'approve' && payment) {
        // Activar enrollment asociado
        let enrollQuery = (supabase.from('enrollments') as any)
          .update({ status: 'active' })
          .eq('school_id', schoolId)
          .eq('status', 'pending');

        if (payment.child_id)       enrollQuery = enrollQuery.eq('child_id', payment.child_id);
        else if (payment.parent_id) enrollQuery = enrollQuery.eq('user_id', payment.parent_id);
        if (payment.team_id)        enrollQuery = enrollQuery.eq('team_id', payment.team_id);

        await enrollQuery;

        if (payment.parent_id) {
          if (payment.parent?.email) {
            await emailClient.send({
              type: 'payment_confirmation',
              to: payment.parent.email,
              data: {
                userName: payment.parent.full_name || 'Usuario',
                schoolName: 'Tu Escuela',
                amount: formatCurrency(payment.amount),
                concept: payment.concept,
                reference: payment.id.slice(0, 8).toUpperCase(),
              },
            });
          }
          await supabase.rpc('notify_user', {
            p_user_id: payment.parent_id, p_title: '✅ Pago Aprobado',
            p_message: `Tu pago de ${formatCurrency(payment.amount)} ha sido validado.`,
            p_type: 'success', p_link: '/my-payments',
          });
        }
      }

      if (action === 'reject') {
        const payment = payments.find(p => p.id === paymentId);
        if (payment?.parent_id) {
          await supabase.rpc('notify_user', {
            p_user_id: payment.parent_id,
            p_title: '❌ Pago Rechazado',
            p_message: `Tu comprobante de ${formatCurrency(payment.amount)} no pudo ser validado. Contáctanos para más información.`,
            p_type: 'error',
            p_link: '/my-payments',
          });
        }
      }
      toast({
        title: action === 'approve' ? 'Pago Aprobado' : 'Pago Rechazado',
        description: `La transacción ha sido ${action === 'approve' ? 'validada' : 'rechazada'} correctamente.`,
        variant: action === 'approve' ? 'default' : 'destructive',
      });
      await fetchPayments();
    } catch (error: unknown) {
      toast({ title: 'Error', description: `No se pudo procesar la acción: ${getUserFriendlyError(error)}`, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleExportCSV = () => {
    if (payments.length === 0) { toast({ title: 'No hay datos', description: 'No hay transacciones para exportar.' }); return; }
    const headers = ['Fecha', 'Padre', 'Deportista', 'Monto', 'Estado', 'Concepto', 'Tipo'];
    const rows = payments.map(p => {
      const cfg = STATUS_CONFIG[p.status];
      return [new Date(p.created_at).toLocaleDateString(), p.parent?.full_name || 'Desconocido', p.child?.full_name || 'Desconocido', p.amount, cfg?.label ?? p.status, p.concept, p.payment_type || 'N/A'];
    });
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_pagos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast({ title: 'Reporte Generado', description: 'El archivo CSV se ha descargado correctamente.' });
  };

  const handleShowProof = async (payment: PaymentTransaction) => {
    if (!payment.receipt_url) return;
    if (payment.receipt_url.startsWith('http')) {
      setViewingProof({ open: true, url: payment.receipt_url, student: payment.child?.full_name || 'Deportista', amount: payment.amount });
      return;
    }
    try {
      const cleanPath = normalizeReceiptUrl(payment.receipt_url);
      const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(cleanPath, 300);
      if (error) throw error;
      setViewingProof({ open: true, url: data.signedUrl, student: payment.child?.full_name || 'Deportista', amount: payment.amount });
    } catch {
      toast({ title: 'Error de acceso', description: 'No se pudo generar el acceso al comprobante.', variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // "Validación de Cobros" muestra SOLO transferencias manuales que requieren
  // que la escuela apruebe/rechace el comprobante. Los pagos de MercadoPago
  // y Wompi NO aparecen aqui — los valida el gateway automaticamente y se
  // marcan paid via webhook. Si se mostraran aqui, la escuela podria aprobar
  // por error un pago que MP / Wompi todavia esta procesando.
  const rawPendingPayments = payments.filter(p => {
    const provider = (p as any).payment_provider;
    const isGateway = provider === 'mercadopago' || provider === 'wompi';
    // Aprobables a mano: transferencia reportada (awaiting_approval) o
    // inscripción por QR "por cobrar" (pending sin pasarela). Los de pasarela
    // NO se aprueban a mano — los confirma el webhook automáticamente.
    // 'partial' = abono en curso: sigue en el panel para completar el saldo.
    return !isGateway && (p.status === 'awaiting_approval' || p.status === 'pending' || p.status === 'partial');
  });
  const pendingPayments = rawPendingPayments.filter(p => {
    if (!pendingSearch) return true;
    const term = pendingSearch.toLowerCase();
    return p.child?.full_name?.toLowerCase().includes(term) ||
      p.parent?.full_name?.toLowerCase().includes(term) ||
      p.concept?.toLowerCase().includes(term) ||
      p.program?.name?.toLowerCase().includes(term) ||
      p.team?.name?.toLowerCase().includes(term);
  });

  // Historial muestra todo lo que NO esta en cola de validacion manual:
  //  - paid / refunded / declined / cancelled (estados terminales)
  //  - pending de MercadoPago / Wompi (gateway esta procesando, escuela ve solo lectura)
  //  - awaiting_approval de MercadoPago / Wompi (igual, gateway-managed)
  // Excluye los `awaiting_approval` de transferencia manual porque ya estan en
  // "Validación de Cobros" arriba.
  const rawHistoryPayments = payments.filter(p => {
    const provider = (p as any).payment_provider;
    const isGatewayPayment = provider === 'mercadopago' || provider === 'wompi';
    // pending/awaiting_approval SIN pasarela → ya están en "Validación de Cobros"
    // (la escuela los aprueba). En historial solo los de pasarela (read-only,
    // gateway-managed). Evita que el mismo cobro aparezca en dos listas.
    if (p.status === 'pending') return isGatewayPayment;
    if (p.status === 'awaiting_approval') return isGatewayPayment;
    return true;
  });
  const historyPayments = rawHistoryPayments.filter(p => {
    const searchMatch = !historySearch ||
      p.child?.full_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.parent?.full_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.concept?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.program?.name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.team?.name?.toLowerCase().includes(historySearch.toLowerCase());
    const statusMatch = historyStatusFilter === 'all' || p.status === historyStatusFilter;
    const teamMatch = historyTeamFilter === 'all' || p.team?.name === historyTeamFilter || p.team_id === historyTeamFilter;
    return searchMatch && statusMatch && teamMatch;
  });

  const historyTotalPages = Math.max(1, Math.ceil(historyPayments.length / HISTORY_PAGE_SIZE));
  const pagedHistory = historyPayments.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);

  // Ingresos = dinero realmente recibido: total de pagos saldados + los abonos
  // (amount_paid) de los parciales. Antes solo contaba 'paid' y dejaba fuera los abonos.
  const totalRevenue = payments.reduce((acc, p) => {
    const paid = Number(p.amount_paid) || 0;
    if (p.status === 'paid' || p.status === 'approved') return acc + (paid > 0 ? paid : p.amount);
    if (p.status === 'partial') return acc + paid;
    return acc;
  }, 0);
  // Pendiente = saldo por cobrar (para parciales, total - abonado; no el total).
  const pendingAmount = pendingPayments.reduce((acc, p) => acc + Math.max(p.amount - (Number(p.amount_paid) || 0), 0), 0);

  const getPreferredMethod = (athleteId?: string) => {
    if (!athleteId) return { label: 'Pendiente', icon: Clock };
    const latest = payments.find(p => 
      p.status === 'paid' && (
        p.child_id === athleteId || 
        p.user_id === athleteId || 
        p.unregistered_athlete_id === athleteId
      )
    );
    if (!latest || !latest.payment_method) return { label: 'Pendiente', icon: Clock };
    switch (latest.payment_method.toLowerCase()) {
      case 'transfer': return { label: 'Transferencia', icon: Smartphone };
      case 'pse': return { label: 'PSE', icon: Building2 };
      case 'card': return { label: 'Tarjeta', icon: CreditCard };
      case 'cash': return { label: 'Efectivo', icon: Banknote };
      default: return { label: latest.payment_method.toUpperCase(), icon: CreditCard };
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden animate-in fade-in">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Gestión de Pagos</h1>
          <p className="text-muted-foreground text-sm">
            Administra cobros, validaciones y el historial financiero{activeBranchId ? ' de la sede actual.' : '.'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => setShowCashModal(true)}
            variant="outline"
            size="sm"
            className="gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          >
            <Banknote className="h-4 w-4" />
            <span className="hidden sm:inline">Registrar pago</span>
            <span className="sm:hidden">Pago</span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchPayments} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button variant="default" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Exportar Reporte</span>
            <span className="sm:hidden">Exportar</span>
          </Button>
        </div>
      </div>

      {/* ── Stats: 2 cols en mobile, 4 en lg ─────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Ingresos Totales', value: formatCurrency(totalRevenue), sub: 'Histórico acumulado', icon: TrendingUp, color: 'text-emerald-500' },
          { title: 'Por Validar', value: pendingPayments.length, sub: `${formatCurrency(pendingAmount)} pendientes`, icon: Clock, color: 'text-amber-500' },
          { title: 'Transacciones', value: payments.length, sub: 'Total registradas', icon: CreditCard, color: 'text-blue-500' },
          { title: 'Tasa Aprobación', value: `${payments.length > 0 ? Math.round((payments.filter(p => p.status === 'paid').length / payments.length) * 100) : 0}%`, sub: 'Pagos exitosos', icon: CheckCircle2, color: 'text-primary' },
        ].map(({ title, value, sub, icon: Icon, color }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium line-clamp-1">{title}</CardTitle>
              <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold truncate">{value}</div>
              <p className="text-xs text-muted-foreground line-clamp-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs: scroll horizontal en mobile ────────────────────────────── */}
      <Tabs defaultValue="recurrent" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full sm:w-auto">
            <TabsTrigger value="recurrent" className="text-xs sm:text-sm">Cobros</TabsTrigger>
            <TabsTrigger value="teams" className="text-xs sm:text-sm">Equipos y Planes</TabsTrigger>
            <TabsTrigger value="glosas" className="text-xs sm:text-sm">Glosas</TabsTrigger>
            <TabsTrigger value="conciliacion" className="text-xs sm:text-sm">Conciliación</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">Historial</TabsTrigger>
            <TabsTrigger value="config" className="text-xs sm:text-sm">Config</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab: Validación de cobros ────────────────────────────────── */}
        <TabsContent value="recurrent">
          <Card className="border-amber-200 bg-amber-50/10">
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                  Cobros por Aprobar
                </CardTitle>
                <CardDescription>Confirma los cobros pendientes: inscripciones por QR y transferencias reportadas.</CardDescription>
              </div>
              <div className="w-full sm:w-auto">
                <Input
                  placeholder="Buscar alumno, padre o equipo..."
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  className="w-full sm:w-[250px] h-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
              ) : pendingPayments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex flex-col items-center p-6">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p>No hay pagos pendientes por validar.</p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
                    {pendingPayments.map((payment) => (
                      <div key={payment.id} className="border rounded-lg p-4 space-y-3 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{(payment as any).athlete_name || 'Sin nombre'}</p>
                            <div className="flex gap-1 flex-wrap mt-0.5">
                              {payment.team?.name && (
                                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 py-0 h-4">
                                  <Trophy className="h-2.5 w-2.5 mr-1" /> {payment.team.name}
                                </Badge>
                              )}
                              {(payment as any).plan?.name && (
                                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 py-0 h-4">
                                  <Zap className="h-2.5 w-2.5 mr-1" /> {(payment as any).plan.name}
                                </Badge>
                              )}
                              {(payment as any).period_label && (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 h-4">
                                  {(payment as any).period_label}
                                </Badge>
                              )}
                              {!payment.team?.name && !(payment as any).plan?.name && !(payment as any).period_label && (
                                <span className="text-xs text-muted-foreground truncate">{payment.concept}</span>
                              )}
                            </div>
                            {(payment as any).period_already_settled && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-600">
                                <AlertTriangle className="h-3 w-3" /> Este mes ya fue pagado y aprobado
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">{(payment as any).parent_responsible || '—'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-primary text-sm">{formatCurrency(payment.amount)}</p>
                            <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleDateString('es-CO')}</p>
                            <div className="mt-1 flex flex-wrap gap-1 justify-end">
                              {(payment.receipt_url || payment.status === 'awaiting_approval') ? (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Transferencia</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Inscripción QR</Badge>
                              )}
                              <VerdictBadge verdict={payment.receipt_verdict} />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {payment.receipt_url && (
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-blue-600 border-blue-200 bg-blue-50" onClick={() => handleShowProof(payment)}>
                              <Eye className="h-3 w-3" /> Comprobante
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200 hover:bg-green-50" onClick={() => setPaymentToApprove(payment)}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Aprobar
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 hover:bg-red-50" disabled={processingId === payment.id} onClick={() => handleManualAction(payment.id, 'reject')}>
                            <XCircle className="h-3 w-3 mr-1" />
                            Rechazar
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => setCreatingGlosaPayment(payment)}>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Glosar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Deportista / Programa</TableHead>
                          <TableHead>Padre</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Origen</TableHead>
                          <TableHead>Comprobante</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-mono text-xs">{formatDate(payment.created_at)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold">{(payment as any).athlete_name || 'Sin nombre'}</span>
                                <div className="flex gap-1 flex-wrap mt-0.5">
                                  {payment.team?.name && (
                                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 py-0 h-5">
                                      <Trophy className="h-2.5 w-2.5 mr-1" /> {payment.team.name}
                                    </Badge>
                                  )}
                                  {(payment as any).plan?.name && (
                                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 py-0 h-5">
                                      <Zap className="h-2.5 w-2.5 mr-1" /> {(payment as any).plan.name}
                                    </Badge>
                                  )}
                                  {(payment as any).period_label && (
                                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 h-5">
                                      {(payment as any).period_label}
                                    </Badge>
                                  )}
                                  {!payment.team?.name && !(payment as any).plan?.name && !(payment as any).period_label && (
                                    <span className="text-xs text-muted-foreground">{payment.concept}</span>
                                  )}
                                </div>
                                {(payment as any).period_already_settled && (
                                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-600">
                                    <AlertTriangle className="h-3 w-3" /> Este mes ya fue pagado y aprobado
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell><span className="text-sm">{(payment as any).parent_responsible || <span className="text-muted-foreground text-xs">—</span>}</span></TableCell>
                            <TableCell className="font-bold text-primary whitespace-nowrap align-top">
                              <div className="flex flex-col gap-0.5">
                                <span>{formatCurrency(payment.amount)}</span>
                                {(payment.status === 'partial' || (Number(payment.amount_paid) || 0) > 0) && (
                                  <>
                                    <Badge variant="outline" className="w-fit whitespace-nowrap text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 py-0 h-4 px-1.5 font-semibold">
                                      Abono parcial
                                    </Badge>
                                    <span className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">
                                      Abonado {formatCurrency(Number(payment.amount_paid) || 0)} · saldo {formatCurrency(Math.max(payment.amount - (Number(payment.amount_paid) || 0), 0))}
                                    </span>
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(payment.receipt_url || payment.status === 'awaiting_approval') ? (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Transferencia</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Inscripción QR</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {payment.receipt_url ? (
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-blue-600 border-blue-200 bg-blue-50" onClick={() => handleShowProof(payment)}>
                                  <Eye className="h-3 w-3" /> Ver
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => setPaymentToApprove(payment)}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Aprobar
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={processingId === payment.id} onClick={() => handleManualAction(payment.id, 'reject')}>
                                  <XCircle className="h-3 w-3 mr-1" /> Rechazar
                                </Button>
                                <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => setCreatingGlosaPayment(payment)}>
                                  <AlertTriangle className="h-3 w-3 mr-1" /> Glosar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Equipos ─────────────────────────────────────────────── */}
        <TabsContent value="teams">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Vista por Equipos y Planes</CardTitle>
              <CardDescription>Cobros programados por equipo y por plan.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {/* Mobile cards */}
              <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                ) : teamSubscriptions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay deportistas asignados a equipos o planes.</p>
                ) : teamSubscriptions.map((sub) => (
                  <div key={sub.id} className="border rounded-lg p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${sub.has_plan ? 'text-green-600' : 'text-blue-600'}`}>{sub.full_name}</p>
                      <p className="text-xs text-muted-foreground">{sub.team_name || sub.plan_name || 'Sin asignar'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{formatCurrency(sub.price_monthly || sub.plan_price || 0)}</p>
                      <p className="text-xs text-muted-foreground">
                        {billing?.billing_cycle_type === 'rolling_30'
                          ? (() => {
                              const d = new Date(sub.start_date + 'T12:00:00');
                              d.setDate(d.getDate() + 30);
                              return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                            })()
                          : `Día ${billing?.payment_cutoff_day || 10}`
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop view */}
              <div className="hidden md:block space-y-8">
                {/* ── EQUIPOS ── */}
                {teamSubscriptions.filter(s => s.has_team).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground px-1">
                      Equipos ({teamSubscriptions.filter(s => s.has_team).length})
                    </p>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Alumno</TableHead>
                            <TableHead>Equipo</TableHead>
                            <TableHead>Mensualidad</TableHead>
                            <TableHead>Próximo Cobro</TableHead>
                            <TableHead>Método</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamSubscriptions.filter(s => s.has_team).map(sub => (
                            <TableRow key={sub.id}>
                              <TableCell className="font-medium text-blue-600">{sub.full_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
                                  {sub.team_name || 'Sin equipo'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold">{formatCurrency(sub.price_monthly)}</TableCell>
                              <TableCell>
                                <span className="flex items-center gap-1.5 text-sm">
                                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                                  {billing?.billing_cycle_type === 'rolling_30'
                                    ? (() => {
                                        const d = new Date(sub.start_date + 'T12:00:00');
                                        d.setDate(d.getDate() + 30);
                                        return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' (+30d)';
                                      })()
                                    : `Día ${billing?.payment_cutoff_day || 10} (Prox. Mes)`
                                  }
                                </span>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const method = getPreferredMethod(sub.child_id || sub.user_id || sub.unregistered_athlete_id || undefined);
                                  const Icon = method.icon;
                                  return (
                                    <Badge variant="secondary" className="gap-1.5 py-1 px-3 bg-slate-100 text-slate-700">
                                      <Icon className="h-3.5 w-3.5" />{method.label}
                                    </Badge>
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* ── PLANES ── */}
                {teamSubscriptions.filter(s => s.has_plan).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground px-1">
                      Planes ({teamSubscriptions.filter(s => s.has_plan).length})
                    </p>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Atleta</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Próximo Cobro</TableHead>
                            <TableHead>Método</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamSubscriptions.filter(s => s.has_plan).map(sub => (
                            <TableRow key={sub.id}>
                              <TableCell className="font-medium text-green-600">{sub.full_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">
                                  {sub.plan_name || 'Sin plan'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold">{formatCurrency(sub.plan_price || 0)}</TableCell>
                              <TableCell>
                                <span className="flex items-center gap-1.5 text-sm">
                                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                                  {billing?.billing_cycle_type === 'rolling_30'
                                    ? (() => {
                                        const d = new Date(sub.start_date + 'T12:00:00');
                                        d.setDate(d.getDate() + 30);
                                        return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' (+30d)';
                                      })()
                                    : `Día ${billing?.payment_cutoff_day || 10} (Prox. Mes)`
                                  }
                                </span>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const method = getPreferredMethod(sub.child_id || sub.user_id || sub.unregistered_athlete_id || undefined);
                                  const Icon = method.icon;
                                  return (
                                    <Badge variant="secondary" className="gap-1.5 py-1 px-3 bg-slate-100 text-slate-700">
                                      <Icon className="h-3.5 w-3.5" />{method.label}
                                    </Badge>
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {teamSubscriptions.length === 0 && !loading && (
                   <div className="text-center py-12 text-muted-foreground">
                     <p>No hay deportistas asignados a equipos o planes activos.</p>
                   </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Glosas (aclaraciones) ───────────────────────────────── */}
        <TabsContent value="glosas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-orange-500" /> Aclaraciones (glosas)
              </CardTitle>
              <CardDescription>
                Comprobantes que necesitan una aclaración del acudiente. Concilia en vez de rechazar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const today = todayColombia();
                const open = glosas.filter(g => OPEN_GLOSA_STATUSES.includes(g.status));
                const overdue = open.filter(g => g.responds_by < today).length;
                const dueSoon = open.filter(g => g.responds_by >= today && g.responds_by <= today).length;
                return (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Abiertas: {open.length}</Badge>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Vencidas: {overdue}</Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Vencen hoy: {dueSoon}</Badge>
                  </div>
                );
              })()}

              {glosas.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No hay aclaraciones. Abre una desde un comprobante con el botón "Glosar".
                </div>
              ) : (
                <div className="space-y-2">
                  {glosas.map(g => (
                    <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm truncate">{g.payments?.parent?.full_name || g.payments?.child?.full_name || 'Acudiente'}</span>
                          <Badge variant="outline" className="text-[10px]">{REASON_ADMIN_LABELS[g.reason]}</Badge>
                          <Badge variant="outline" className="text-[10px] bg-muted">{STATUS_LABELS[g.status]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {g.payments?.concept || 'Cobro'} · {formatCurrency(g.payments?.amount || 0)} · responde antes del {g.responds_by}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setConciliatingGlosa(g)}>
                        {OPEN_GLOSA_STATUSES.includes(g.status) ? 'Conciliar' : 'Ver'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Conciliación bancaria (Fase 6) ──────────────────────── */}
        <TabsContent value="conciliacion">
          {schoolId ? (
            <ReconciliationTab schoolId={schoolId} />
          ) : (
            <p className="text-sm text-muted-foreground">Selecciona una escuela para conciliar.</p>
          )}
        </TabsContent>

        {/* ── Tab: Historial ───────────────────────────────────────────── */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg">Transacciones</CardTitle>
                <CardDescription>Registro completo de todos los movimientos financieros.</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Buscar alumno, padre o concepto..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full sm:w-[250px] h-9"
                />
                <select
                  className="flex h-9 w-full sm:w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={historyTeamFilter}
                  onChange={(e) => setHistoryTeamFilter(e.target.value)}
                >
                  <option value="all">Todos los Equipos</option>
                  {activeTeams.map(team => (
                    <option key={team.id} value={team.name}>{team.name}</option>
                  ))}
                </select>
                <select
                  className="flex h-9 w-full sm:w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="paid">Pagado</option>
                  <option value="rejected">Rechazado</option>
                  <option value="failed">Fallido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {/* Mobile cards */}
              <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
                {historyPayments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay historial disponible.</p>
                ) : pagedHistory.map((payment) => {
                  const cfg = STATUS_CONFIG[payment.status] ?? { label: payment.status, className: 'bg-gray-100 text-gray-600' };
                  return (
                    <div key={payment.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{(payment as any).athlete_name || 'Sin nombre'}</p>
                          <div className="flex gap-1 flex-wrap mt-0.5">
                            {payment.team?.name && (
                              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 py-0 h-4">
                                <Trophy className="h-2.5 w-2.5 mr-1" /> {payment.team.name}
                              </Badge>
                            )}
                            {(payment as any).plan?.name && (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 py-0 h-4">
                                <Zap className="h-2.5 w-2.5 mr-1" /> {(payment as any).plan.name}
                              </Badge>
                            )}
                            {!payment.team?.name && !(payment as any).plan?.name && (
                              <span className="text-xs text-muted-foreground truncate">{payment.concept}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">{formatCurrency(payment.amount)}</p>
                          <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                          {payment.reconciliation_status === 'pendiente' && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 py-0 h-4 ml-1" title="Aprobado; pendiente de conciliación bancaria">
                              pend. conciliación
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleDateString('es-CO')}</p>
                        {payment.receipt_url && (
                          <Button variant="ghost" size="sm" className="h-7 text-blue-600 hover:bg-blue-50" onClick={() => handleShowProof(payment)}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Deportista</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Soporte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyPayments.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron transacciones con los filtros actuales.</TableCell></TableRow>
                    ) : pagedHistory.map((payment) => {
                      const cfg = STATUS_CONFIG[payment.status] ?? { label: payment.status, className: 'bg-gray-100 text-gray-600' };
                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(payment.created_at)}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="font-bold">{(payment as any).athlete_name || 'Sin nombre'}</span>
                              <span className="text-xs text-muted-foreground">
                                {(payment as any).parent_responsible || <span className="text-muted-foreground text-xs">—</span>}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium text-blue-600 mb-1">{payment.concept}</div>
                            <div className="flex flex-col gap-1">
                              {payment.team?.name && (
                                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 w-fit">
                                  <Trophy className="h-3 w-3 mr-1" /> {payment.team.name}
                                </Badge>
                              )}
                              {(payment as any).plan?.name && (
                                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 w-fit">
                                  <Zap className="h-3 w-3 mr-1" /> {(payment as any).plan.name}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell className="text-xs uppercase">{payment.payment_method || 'TRANSFER'}</TableCell>
                          <TableCell><Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge></TableCell>
                          <TableCell>
                            {payment.receipt_url ? (
                              <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:bg-blue-50" onClick={() => handleShowProof(payment)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : <span className="text-xs text-muted-foreground">N/A</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {historyTotalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-3 mt-2 border-t text-sm">
                  <span className="text-muted-foreground">
                    Página {historyPage} de {historyTotalPages} · {historyPayments.length} transacciones
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={historyPage >= historyTotalPages}
                      onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}>Siguiente</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Configuración (sin cambios de lógica, solo responsive) ── */}
        <TabsContent value="config" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Configuración</h2>
              <p className="text-sm text-muted-foreground">Reglas de facturación, mora y notificaciones.</p>
            </div>
            <Button onClick={handleSaveBilling} disabled={billingSaving} className="gap-2 w-full sm:w-auto">
              {billingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Cambios
            </Button>
          </div>
          {billing && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-5 w-5 text-emerald-500" />Reglas de Cobro</CardTitle>
                  <CardDescription>Cuándo y cómo se generan los cobros mensuales.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="due_day">Día de corte del mes</Label>
                    <div className="flex items-center gap-2">
                      <NumberStepper
                        min={1} max={28} className="w-28 h-9"
                        value={billing.payment_cutoff_day}
                        onChange={v => updateBilling('payment_cutoff_day', v === "" ? 5 : v)}
                      />
                      <span className="text-sm text-muted-foreground">de cada mes</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ciclo de facturación</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {([
                        {
                          value: 'prorated',
                          label: 'Prorrateado automático',
                          desc: 'El primer cobro es proporcional a los días restantes del mes.',
                        },
                        {
                          value: 'fixed_calendar',
                          label: 'Mensualidad fija por calendario',
                          desc: 'Siempre cobra el mes completo. Vence en el día de corte.',
                        },
                        {
                          value: 'rolling_30',
                          label: 'Ciclo de 30 días desde inscripción',
                          desc: 'Cada cobro vence exactamente 30 días después del anterior.',
                        },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateBilling('billing_cycle_type', opt.value)}
                          className={`text-left p-3 rounded-lg border-2 transition-colors ${
                            billing.billing_cycle_type === opt.value
                              ? 'border-primary bg-primary/5'
                              : 'border-muted hover:border-primary/40'
                          }`}
                        >
                          <p className="font-medium text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grace">Días de gracia</Label>
                    <div className="flex items-center gap-2">
                      <NumberStepper
                        min={0} max={15} className="w-28 h-9"
                        value={billing.payment_grace_days}
                        onChange={v => updateBilling('payment_grace_days', v === "" ? 0 : v)}
                      />
                      <span className="text-sm text-muted-foreground">días después del corte</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Generar cobros automáticos</Label>
                      <p className="text-xs text-muted-foreground">Crear pagos pendientes cada mes</p>
                    </div>
                    <Switch checked={billing.auto_generate_payments} onCheckedChange={v => updateBilling('auto_generate_payments', v)} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Descuento por pronto pago</Label>
                      <p className="text-xs text-muted-foreground">Premia a quien paga apenas se genera el cobro</p>
                    </div>
                    <Switch
                      checked={billing.early_payment_discount_enabled}
                      onCheckedChange={v => updateBilling('early_payment_discount_enabled', v)}
                    />
                  </div>
                  {billing.early_payment_discount_enabled && (
                    <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                      <div className="space-y-2">
                        <Label htmlFor="epd_days">Días de vigencia</Label>
                        <div className="flex items-center gap-2">
                          <NumberStepper
                            min={1} max={30} className="w-28 h-9"
                            value={billing.early_payment_discount_days}
                            onChange={v => updateBilling('early_payment_discount_days', v === "" ? 5 : v)}
                          />
                          <span className="text-sm text-muted-foreground">días desde que se genera el cobro</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="epd_pct">Porcentaje de descuento</Label>
                        <div className="flex items-center gap-2">
                          <NumberStepper
                            min={1} max={50} className="w-28 h-9"
                            value={billing.early_payment_discount_percentage}
                            onChange={v => updateBilling('early_payment_discount_percentage', v === "" ? 0 : v)}
                          />
                          <span className="text-sm text-muted-foreground">% de descuento</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        No aplica si el deportista tiene otro cobro pendiente o vencido de un mes anterior en esta escuela.
                      </p>
                    </div>
                  )}

                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-5 w-5 text-amber-500" />Mora y Penalización</CardTitle>
                  <CardDescription>Recargos por pago tardío.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Habilitar mora</Label>
                      <p className="text-xs text-muted-foreground">Recargo después del período de gracia</p>
                    </div>
                    <Switch checked={billing.late_fee_enabled} onCheckedChange={v => updateBilling('late_fee_enabled', v)} />
                  </div>
                  {billing.late_fee_enabled && (
                    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                      <Label htmlFor="late_pct">Porcentaje de recargo</Label>
                      <div className="flex items-center gap-2">
                        <NumberStepper
                          min={1} max={50} className="w-28 h-9"
                          value={billing.late_fee_percentage}
                          onChange={v => updateBilling('late_fee_percentage', v === "" ? 5 : v)}
                        />
                        <span className="text-sm text-muted-foreground">% adicional</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Se aplica automáticamente una sola vez sobre el saldo pendiente cuando el pago
                        supera la fecha de vencimiento más los {billing.payment_grace_days} días de gracia.
                        El recargo se suma al monto a cobrar y el pago pasa a “Vencido”.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <Label className="font-medium">Exigir comprobante</Label>
                      <p className="text-xs text-muted-foreground">Los padres deben subir foto del recibo</p>
                    </div>
                    <Switch checked={billing.require_payment_proof} onCheckedChange={v => updateBilling('require_payment_proof', v)} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-green-500" />Validación automática de comprobantes</CardTitle>
                  <CardDescription>El sistema lee el comprobante y decide por reglas (el servidor nunca confía en el cliente).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="pr-4">
                      <Label className="font-medium">Auto-aprobar comprobantes verdes</Label>
                      <p className="text-xs text-muted-foreground">
                        Un comprobante nítido, del monto exacto, a tu cuenta, con fecha reciente y no
                        duplicado se aprueba solo (doble lectura del servidor). Requiere 2 proveedores OCR.
                      </p>
                    </div>
                    <Switch checked={billing.auto_approve_enabled} onCheckedChange={v => updateBilling('auto_approve_enabled', v)} />
                  </div>
                  {billing.auto_approve_enabled && (
                    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                      <Label htmlFor="auto_approve_max">Tope de auto-aprobación (COP)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="auto_approve_max"
                          type="number"
                          min={0}
                          className="w-40 h-9"
                          value={billing.auto_approve_max_amount || ''}
                          onChange={e => updateBilling('auto_approve_max_amount', Number(e.target.value) || 0)}
                        />
                        <span className="text-sm text-muted-foreground">máx. por pago</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Solo se auto-aprueban cobros de <strong>{formatCurrency(billing.auto_approve_max_amount || 0)}</strong> o menos.
                        Montos mayores siempre pasan por revisión manual. Déjalo en 0 para no auto-aprobar por monto.
                      </p>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="pr-4">
                      <Label className="font-medium">Abrir glosa automática</Label>
                      <p className="text-xs text-muted-foreground">
                        Si un comprobante tiene inconsistencias (monto/fecha/referencia), el sistema abre
                        una aclaración al acudiente en vez de dejarlo en revisión manual.
                      </p>
                    </div>
                    <Switch checked={billing.auto_glosa_enabled} onCheckedChange={v => updateBilling('auto_glosa_enabled', v)} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-5 w-5 text-blue-500" />Recordatorios</CardTitle>
                  <CardDescription>Notificaciones automáticas de pago.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Enviar recordatorios</Label>
                      <p className="text-xs text-muted-foreground">Notificar antes del vencimiento</p>
                    </div>
                    <Switch checked={billing.reminder_enabled} onCheckedChange={v => updateBilling('reminder_enabled', v)} />
                  </div>
                  {billing.reminder_enabled && (
                    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                      <Label htmlFor="reminder_days">Días antes del vencimiento</Label>
                      <div className="flex items-center gap-2">
                        <NumberStepper
                          min={1} max={15} className="w-28 h-9"
                          value={billing.reminder_days_before}
                          onChange={v => updateBilling('reminder_days_before', v === "" ? 3 : v)}
                        />
                        <span className="text-sm text-muted-foreground">días antes</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-5 w-5 text-purple-500" />Permisos</CardTitle>
                  <CardDescription>Qué pueden hacer los coaches y el staff.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Coaches pueden enviar mensajes</Label>
                      <p className="text-xs text-muted-foreground">Comunicación directa coach → padres</p>
                    </div>
                    <Switch checked={billing.allow_coach_messaging} onCheckedChange={v => updateBilling('allow_coach_messaging', v)} />
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground text-center">Más opciones de permisos próximamente.</p>
                </CardContent>
              </Card>
              {/* Datos de Pago — full width */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-5 w-5 text-indigo-500" />Datos de Pago para Transferencia</CardTitle>
                  <CardDescription>Esta información la verán los acudientes al elegir pago manual.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="bank_name">Nombre del Banco</Label>
                      <Input id="bank_name" placeholder="Ej: Bancolombia" value={billing.bank_name || ''} onChange={e => updateBilling('bank_name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bank_account_type">Tipo de Cuenta</Label>
                      <select id="bank_account_type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={billing.bank_account_type || ''} onChange={e => updateBilling('bank_account_type', e.target.value)}>
                        <option value="">Selecciona tipo</option>
                        <option value="ahorros">Ahorros</option>
                        <option value="corriente">Corriente</option>
                        <option value="billetera_digital">Billetera Digital</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="bank_account_number">Número de Cuenta</Label>
                        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setShowSensitive(!showSensitive)}>
                          {showSensitive ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                          {showSensitive ? "Ocultar" : "Mostrar"}
                        </Button>
                      </div>
                      <Input 
                        id="bank_account_number" 
                        placeholder="Ej: 123-456789-01" 
                        value={showSensitive ? (billing.bank_account_number || '') : maskSensitive(billing.bank_account_number)} 
                        onChange={e => updateBilling('bank_account_number', e.target.value)} 
                        onFocus={() => setShowSensitive(true)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nequi_number">Número Nequi (Opcional)</Label>
                      <Input 
                        id="nequi_number" 
                        placeholder="Celular" 
                        value={showSensitive ? (billing.nequi_number || '') : maskSensitive(billing.nequi_number)} 
                        onChange={e => updateBilling('nequi_number', e.target.value)} 
                        onFocus={() => setShowSensitive(true)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="daviplata_number">Número Daviplata (Opcional)</Label>
                      <Input 
                        id="daviplata_number" 
                        placeholder="Celular" 
                        value={showSensitive ? (billing.daviplata_number || '') : maskSensitive(billing.daviplata_number)} 
                        onChange={e => updateBilling('daviplata_number', e.target.value)} 
                        onFocus={() => setShowSensitive(true)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="breb_number">Número Bre-B (Opcional)</Label>
                      <Input 
                        id="breb_number" 
                        placeholder="Celular o ID" 
                        value={showSensitive ? (billing.breb_number || '') : maskSensitive(billing.breb_number)} 
                        onChange={e => updateBilling('breb_number', e.target.value)} 
                        onFocus={() => setShowSensitive(true)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transfer_key">Llave de Transferencia</Label>
                      <Input 
                        id="transfer_key" 
                        placeholder="Ej: Celular, Correo o Alias" 
                        value={showSensitive ? (billing.transfer_key || '') : maskSensitive(billing.transfer_key)} 
                        onChange={e => updateBilling('transfer_key', e.target.value)} 
                        onFocus={() => setShowSensitive(true)}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="bank_titular_name">Nombre del Titular</Label>
                      <Input id="bank_titular_name" placeholder="Titular de la cuenta" value={billing.bank_titular_name || ''} onChange={e => updateBilling('bank_titular_name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bank_titular_id">NIT o Cédula del Titular</Label>
                      <Input 
                        id="bank_titular_id" 
                        placeholder="Documento" 
                        value={showSensitive ? (billing.bank_titular_id || '') : maskSensitive(billing.bank_titular_id)} 
                        onChange={e => updateBilling('bank_titular_id', e.target.value)} 
                        onFocus={() => setShowSensitive(true)}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <div>
                      <Label>Código QR para Transferencia</Label>
                      <p className="text-xs text-muted-foreground mb-4">Este QR se mostrará con los datos bancarios.</p>
                    </div>
                    {billing.payment_qr_url ? (
                      <div className="flex flex-col sm:flex-row items-start gap-4 p-4 border rounded-lg bg-muted/30">
                        <img src={billing.payment_qr_url} alt="QR de Pago" className="w-32 h-32 object-cover rounded-md border bg-white" />
                        <Button variant="destructive" size="sm" onClick={() => updateBilling('payment_qr_url', null)}>Eliminar QR</Button>
                      </div>
                    ) : (
                      <div className="p-4 border rounded-lg border-dashed">
                        <FileUpload bucket="school-assets" path={`qr/${schoolId}`} accept="image/*" onUploadComplete={(url) => updateBilling('payment_qr_url', url)} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* SportMaps Pay */}
              <div className="md:col-span-2">
                <SportMapsPaySettings />
              </div>

              {/* Nueva Sección: Abonos */}
                <InstallmentsConfigCard 
                  settings={{
                    allow_installments: billing.allow_installments,
                    max_installments_per_payment: billing.max_installments_per_payment,
                    min_installment_amount: billing.min_installment_amount,
                    installment_require_proof: billing.installment_require_proof,
                  }}
                  onChange={(updated) => setBilling({ ...billing, ...updated })}
                />

                {/* Botón generar cobros pendientes */}
                <BackfillPaymentsCard
                  schoolId={schoolId}
                  billing={billing}
                  onSuccess={fetchPayments}
                />

            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog comprobante */}
      <Dialog open={viewingProof.open} onOpenChange={open => setViewingProof(prev => ({ ...prev, open }))}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprobante de Pago</DialogTitle>
            <DialogDescription>{viewingProof.student} — {formatCurrency(viewingProof.amount)}</DialogDescription>
          </DialogHeader>
          <div className="p-4 flex items-center justify-center bg-muted rounded-lg min-h-[200px] sm:min-h-[300px]">
            {viewingProof.url ? (
              <img src={viewingProof.url} alt="Comprobante" className="max-h-[400px] sm:max-h-[500px] object-contain rounded w-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="text-center text-muted-foreground p-8"><p>No hay imagen disponible.</p></div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setViewingProof(prev => ({ ...prev, open: false }))}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash and Approval Modals */}
      <RegisterCashPaymentModal 
        open={showCashModal} 
        onOpenChange={setShowCashModal} 
        onSuccess={fetchPayments} 
      />
      <ApprovePaymentMethodSheet
        open={!!paymentToApprove}
        onOpenChange={(open) => !open && setPaymentToApprove(null)}
        payment={paymentToApprove}
        onSuccess={() => {
          setPaymentToApprove(null);
          fetchPayments();
        }}
      />
      <CreateGlosaDialog
        payment={creatingGlosaPayment}
        open={!!creatingGlosaPayment}
        onOpenChange={(o) => { if (!o) setCreatingGlosaPayment(null); }}
        onSuccess={() => { fetchPayments(); fetchGlosas(); }}
      />
      <GlosaConciliationDialog
        glosa={conciliatingGlosa}
        open={!!conciliatingGlosa}
        onOpenChange={(o) => { if (!o) setConciliatingGlosa(null); }}
        onSuccess={() => { fetchPayments(); fetchGlosas(); }}
      />
    </div>
  );
}

function BackfillPaymentsCard({
  schoolId, onSuccess,
}: {
  schoolId: string | null;
  billing?: BillingSettings | null;  // ya no se usa (F0: la generación es server-side); se mantiene por compat del padre
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading]   = useState(false);
  const [preview, setPreview]   = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating]  = useState(false);

  // Periodo a abrir = mes actual (hora Colombia). todayColombia() → 'YYYY-MM-DD'.
  const currentPeriod = () => {
    const [y, m] = todayColombia().split('-').map(Number);
    return { p_school_id: schoolId, p_year: y, p_month: m };
  };

  // F0: la vista previa ahora la calcula el servidor (preview_open_month) con la
  // MISMA lógica canónica que el cron. Se eliminó el cálculo client-side + el
  // prorrateo (calcFirstPayment): el prorrateo vive solo en el alta (checkout/QR).
  const loadPreview = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('preview_open_month', currentPeriod());
      if (error) throw error;
      setPreview(((data?.items) ?? []) as any[]);
      setShowPreview(true);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // F0: genera vía RPC única open_month (advisory lock + dedup por mes + period
  // poblado). Se eliminó el INSERT client-side en loop (vulnerable a doble-clic).
  const handleGenerate = async () => {
    if (!schoolId || preview.length === 0) return;
    setGenerating(true);
    try {
      const { data, error } = await (supabase as any).rpc('open_month', currentPeriod());
      if (error) throw error;
      const n = data?.generados ?? 0;
      toast({
        title: `${n} pago(s) generado(s)`,
        description: 'Cobros del mes creados por la vía unificada.',
      });
      setShowPreview(false);
      setPreview([]);
      onSuccess();
    } catch (e: any) {
      toast({ title: 'Error al generar pagos', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Cobros Pendientes por Generar
        </CardTitle>
        <CardDescription>
          Atletas inscritos que aún no tienen ningún pago registrado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showPreview ? (
          <Button variant="outline" onClick={loadPreview} disabled={loading} className="w-full">
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Calculando...</>
              : <>Verificar atletas sin cobro</>}
          </Button>
        ) : preview.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Todos los atletas tienen pagos registrados.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se generarán <strong>{preview.length} cobro(s)</strong> del mes (cuota completa):
            </p>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Vence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{row.athlete}</TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">
                        {row.tipo === 'menor' ? '🧒 Menor' : row.tipo === 'adulto' ? '🧑 Adulto' : '📋 No registrado'}
                      </TableCell>
                      <TableCell className="font-bold text-primary text-sm">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(row.amount)}
                      </TableCell>
                      <TableCell className="text-xs">{row.due_date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={generating}>
                {generating
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando...</>
                  : <>Confirmar y generar {preview.length} pago(s)</>}
              </Button>
              <Button variant="ghost" onClick={() => { setShowPreview(false); setPreview([]); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}