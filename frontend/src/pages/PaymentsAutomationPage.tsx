import { useState, useEffect, useRef } from 'react';
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
import { CheckCircle2, Clock, CreditCard, TrendingUp, Download, Eye, EyeOff, Loader2, XCircle, Save, Bell, DollarSign, Shield, AlertTriangle, Trophy, Zap, Banknote } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import { formatCurrency, maskSensitive } from '@/lib/utils';
import { normalizeReceiptUrl } from '@/lib/normalizeReceiptUrl';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getUserFriendlyError } from '@/lib/error-translator';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { FileUpload } from '@/components/common/FileUpload';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';
import { emailClient } from '@/lib/email-client';
import { ReviewInstallmentModal } from '@/components/payment/ReviewInstallmentModal';
import { InstallmentsConfigCard } from '@/components/payment/InstallmentsConfigCard';
import { todayColombia, formatDayCO, daysDiffFromToday } from '@/lib/dateUtils';
import { SportMapsPaySettings } from '@/components/settings/SportMapsPaySettings';
import { PaymentProvidersAdmin } from '@/components/admin/PaymentProvidersAdmin';
import { RegisterCashPaymentModal } from '@/components/payment/RegisterCashPaymentModal';
import { ApprovePaymentMethodSheet } from '@/components/payment/ApprovePaymentMethodSheet';
import { bffClient } from '@/lib/api/bffClient';
import { GlosaConciliationDialog } from '@/components/payment/GlosaConciliationDialog';
import { ReconciliationTab } from '@/components/payment/ReconciliationTab';
import { CreateGlosaDialog } from '@/components/payment/CreateGlosaDialog';
import { listBySchool as listSchoolGlosas, REASON_ADMIN_LABELS, STATUS_LABELS, OPEN_GLOSA_STATUSES, type Glosa } from '@/lib/api/glosas';
import { PaymentOriginBadge } from '@/components/payment/PaymentOriginBadge';
import { FailedAttemptChip } from '@/components/payment/FailedAttemptChip';
import { isGatewayPayment } from '@/lib/paymentOrigin';
import { PaymentAccountsEditor } from '@/components/payment/PaymentAccountsEditor';
import { MonthCloseTab } from '@/components/finances/MonthCloseTab';
import {
  resolvePaymentAccounts,
  serializePaymentAccounts,
  accountsToLegacyColumns,
  type PaymentAccount,
  type LegacyAccountColumns,
} from '@/lib/payment-accounts';


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
  /** El entrenador puede inscribir en equipos con cobro (genera mensualidad). */
  coach_can_enroll_paid_teams: boolean;
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
  /**
   * Llaves de pago de la escuela. Fuente única: es lo que ve el acudiente en su
   * modal y lo que el OCR acepta como destino del comprobante. Las columnas
   * sueltas de arriba quedan como espejo de la primera llave de cada tipo.
   */
  payment_accounts?: PaymentAccount[];
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
  // Default alineado con el de la columna en DB: es el comportamiento de siempre.
  coach_can_enroll_paid_teams: true,
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
  payment_accounts: [],
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

// ── Qué estados se traen del servidor ────────────────────────────────────────
// Estados que SIEMPRE se piden: los que representan plata reportada o un
// desenlace real. Los cobros emitidos y no pagados (pending/overdue sin
// comprobante) NO se traen: son cartera y ya viven en Finanzas. Eran el 98% de
// las filas de la escuela, y con `limit(100)` por created_at desplazaban los
// comprobantes reales fuera de la ventana: un comprobante por validar de
// Dynasty quedó en la posición ~362 de 499 y nunca llegaba al navegador.
// `glosado` va aquí sí o sí: es un comprobante EN DISCUSIÓN (create_glosa lo
// mueve a ese estado y lo saca de la cola de aprobación a propósito). Si no se
// trae, un pago reclamado desaparece de la pantalla — la misma fuga que este
// filtro viene a cerrar.
const CORE_STATUSES = ['paid', 'partial', 'rejected', 'awaiting_approval', 'glosado'] as const;

// Estados que solo se piden si el selector del Historial los pide explícitamente.
// `cancelled` son ~2.4k filas globales (cobros anulados por las limpiezas de
// duplicados): traerlas siempre reintroduce el problema de volumen.
// La lista completa de estados válidos la fija el CHECK payments_status_check
// (mig 20260717000002): pending, paid, overdue, failed, cancelled,
// awaiting_approval, rejected, partial, glosado. No existen refunded ni declined.
const OPT_IN_STATUSES = ['cancelled', 'overdue', 'pending', 'failed'] as const;

// Historial = movimientos con plata, con desenlace real, o en discusión abierta.
const HISTORY_DEFAULT_STATUSES = ['paid', 'partial', 'rejected', 'glosado'] as const;

// Rango del Historial: dos fechas exactas (desde / hasta), no bloques de meses.
// La pregunta operativa de la escuela es "¿qué entró HOY?", y un selector de
// "últimos 3 meses" no la responde. Se aplica en el SERVIDOR para acotar el
// volumen, en vez de un tope de filas que corta en silencio.
//
// LA FECHA QUE MANDA ES LA DEL PAGO (`payment_date`), no la de emisión del
// cobro: la mensualidad de agosto se emite el 30 de julio (batch `open_month`)
// y se paga en agosto. Filtrar por `created_at` metía los pagos de hoy en el
// bloque de julio. Cuando la fila no tiene fecha de pago propia se cae a
// `created_at`, que es lo único que hay.
const HISTORY_DEFAULT_RANGE_DAYS = 365;

/** 'YYYY-MM-DD' + n días. Aritmética de calendario pura, sin husos de por medio. */
function addDaysToDay(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Medianoche hora Colombia de un 'YYYY-MM-DD', en ISO UTC — para comparar
 * contra `created_at`, que es `timestamptz`. 00:00 COT = 05:00Z del mismo día.
 * Se expresa en Z y no con offset `-05:00` para no meter signos en el valor de
 * un filtro de PostgREST.
 */
const dayStartUtc = (day: string) => `${day}T05:00:00.000Z`;

/** Día Colombia de un timestamp, para comparar contra un rango 'YYYY-MM-DD'. */
const dayInCO = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(iso));

/**
 * Atajos del rango. `from`/`to` son funciones y no valores: el módulo se evalúa
 * una vez y la pestaña puede quedar abierta cruzando la medianoche, así que "Hoy"
 * tiene que resolverse en el clic.
 */
const HISTORY_QUICK_RANGES: { label: string; from: () => string; to: () => string }[] = [
  { label: 'Hoy', from: () => todayColombia(), to: () => todayColombia() },
  { label: 'Ayer', from: () => addDaysToDay(todayColombia(), -1), to: () => addDaysToDay(todayColombia(), -1) },
  { label: 'Este mes', from: () => `${todayColombia().slice(0, 7)}-01`, to: () => todayColombia() },
  { label: 'Último año', from: () => addDaysToDay(todayColombia(), -HISTORY_DEFAULT_RANGE_DAYS), to: () => todayColombia() },
];

/** Tope de seguridad de la consulta. No es el filtro: es la red por si acaso. */
const HISTORY_FETCH_CAP = 500;

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paid: { label: 'Pagado', className: 'bg-green-500 text-white border-transparent' },
  rejected: { label: 'Rechazado', className: 'bg-red-100 text-red-700 border-red-200' },
  awaiting_approval: { label: 'Por Validar', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  overdue: { label: 'Vencido', className: 'bg-red-50 text-red-600 border-red-200' },
  failed: { label: 'Fallido', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  pending: { label: 'Pendiente', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  partial: { label: 'Abono parcial', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  // Comprobante con glosa abierta: sale de la cola de aprobación y espera la
  // aclaración del acudiente. Sin esta entrada la tabla mostraba el string crudo.
  glosado: { label: 'En aclaración', className: 'bg-orange-100 text-orange-700 border-orange-200' },
};

interface PaymentTransaction {
  id: string;
  amount: number;
  amount_paid?: number | null;
  status: string;
  created_at: string;
  /** Fecha en que se hizo el pago, la declara quien lo reporta. Distinta de
   *  created_at, que es cuándo se EMITIÓ el cobro. */
  payment_date?: string | null;
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
  // Señales para distinguir un pago gestionado por pasarela de uno manual.
  // OJO: payment_provider NO sirve solo — tiene DEFAULT 'wompi' en la columna
  // (mig 20260504000001), así que efectivo y transferencias también lo traen.
  payment_channel?: string | null;
  payment_provider?: string | null;
  wompi_reference?: string | null;
  wompi_transaction_id?: string | null;
  provider_transaction_id?: string | null;
  qr_id?: string | null;
}

// Devuelto por el RPC school_payment_kpis: agregados sobre TODO el histórico de
// la escuela. tx_count son transacciones reales (paid|partial), no cobros
// emitidos; approval_rate se calcula sobre intentos de pago y es null si no hubo.
interface PaymentKpis {
  revenue_total: number;
  tx_count: number;
  charges_total: number;
  awaiting_count: number;
  awaiting_amount: number;
  debt_count: number;
  debt_amount: number;
  attempts: number;
  approval_rate: number | null;
}

/** Una inscripción activa: a quién se le cobra, cuánto, y qué pasó este mes. */
interface TeamSubscription {
  id: string;
  full_name: string;
  child_id?: string | null;
  user_id?: string | null;
  unregistered_athlete_id?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  /** Sede del equipo. `enrollments` no tiene sede propia; la hereda del equipo. */
  branch_id?: string | null;
  offering_plan_id?: string | null;
  plan_name?: string | null;
  /** Cuota que se le va a cobrar de verdad. Ver `effectiveFee`. */
  fee: number;
  /** De dónde salió la cuota, para poder explicar un $0 sin abrir la base. */
  fee_source: 'enrollment' | 'plan' | 'team' | 'none';
  /**
   * Precio del plan HOY, para detectar tarifa congelada (docs/plan-tarifa-congelada-c12.md,
   * fase F1). Cuando `fee_source === 'enrollment'` y este valor difiere de `fee`, la
   * inscripción quedó en el precio que tenía el plan al momento de inscribirse — el
   * catálogo subió después y no le cascadeó. `null` si el plan no tiene precio propio.
   */
  plan_price_now: number | null;
  start_date: string;
  /** Cobro del mes en curso si existe. `null` = no se le generó nada. */
  charge: {
    status: string;
    due_date: string | null;
    amount: number;
    /** Último intento de pago que se cayó. Se muestra junto al estado del cobro. */
    last_failure_at: string | null;
    last_failure_reason: string | null;
    /** ERROR/VOIDED sin resolver: no sabemos si el dinero se movió. */
    requires_review: boolean;
  } | null;
  /** Deuda de meses ANTERIORES que sigue sin pagar. */
  arrears: { count: number; amount: number } | null;
  /** Atleta al que pertenece la fila. Para no sumar su deuda dos veces. */
  athlete_key: string | null;
}

/**
 * Cuota efectiva de una inscripción, en el MISMO orden que usa el resto del
 * sistema al cobrar: `enrollments.monthly_fee` manda, el plan es el respaldo y
 * el precio del equipo es el último recurso.
 *
 * Esta pantalla leía `teams.price_monthly` de una: en Dynasty está en 0 para
 * todos los equipos, así que 419 de 422 filas mostraban $0 — $57.5M de
 * mensualidad invisible — mientras el monto real estaba en `monthly_fee`.
 */
function effectiveFee(e: {
  monthly_fee?: number | null;
  plan?: { price?: number | null } | null;
  team?: { price_monthly?: number | null } | null;
}): { fee: number; source: TeamSubscription['fee_source'] } {
  const own = Number(e.monthly_fee) || 0;
  if (own > 0) return { fee: own, source: 'enrollment' };
  const plan = Number(e.plan?.price) || 0;
  if (plan > 0) return { fee: plan, source: 'plan' };
  const team = Number(e.team?.price_monthly) || 0;
  if (team > 0) return { fee: team, source: 'team' };
  return { fee: 0, source: 'none' };
}

/**
 * Cuál de los cobros del mes representa a la inscripción cuando hay varios.
 * Gana el que está más avanzado: si ya hay uno pagado, la fila está pagada
 * aunque arrastre otro pendiente de una segunda categoría.
 */
const CHARGE_PRIORITY: Record<string, number> = {
  paid: 0, partial: 1, awaiting_approval: 2, glosado: 3, pending: 4, overdue: 5, rejected: 6, failed: 7,
};

export default function PaymentsAutomationPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { schoolId, activeBranchId, currentUserRole } = useSchoolContext();
  // Deep-link a un tab puntual (ej. "Próximo Cierre de Mes" en Finanzas manda
  // acá a abrir el mes — sin esto, quien llega desde ese link caía siempre en
  // "Cobros" y el botón de abrir mes, que vive en "Config", quedaba invisible.
  const [searchParams, setSearchParams] = useSearchParams();
  const PAYMENTS_TABS = ['recurrent', 'teams', 'glosas', 'conciliacion', 'history', 'cierre', 'config'] as const;
  const tabParam = searchParams.get('tab');
  const activeTab = (PAYMENTS_TABS as readonly string[]).includes(tabParam || '') ? tabParam! : 'recurrent';
  // Se incrementa al conectar/quitar una pasarela: remonta SportMaps Pay para
  // que su gate vuelva a preguntar si ya hay cuenta de recaudo.
  const [revisionPasarelas, setRevisionPasarelas] = useState(0);
  // Mismo criterio que AppSidebar. El BFF autoriza a los mismos en
  // isAdminGlobal(), para no mostrar un formulario que devuelve 403.
  const esPlatformAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  // KPIs agregados en DB (school_payment_kpis). NO se derivan de `payments`:
  // esa lista está paginada a 100 filas y calcular las tarjetas sobre ella
  // mostraba "Histórico acumulado" de solo las últimas horas.
  const [kpis, setKpis] = useState<PaymentKpis | null>(null);
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
  // ¿Este ambiente ya tiene la columna payment_accounts? Se resuelve al cargar.
  const accountsColumnReady = useRef(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);

  // Filtros Historial y Equipos
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyTeamFilter, setHistoryTeamFilter] = useState('all');
  // Rango por fecha del pago. Arranca en el último año para no cambiar de golpe
  // lo que la escuela ya veía al entrar; los atajos de abajo lo acotan a un día.
  const [historyFrom, setHistoryFrom] = useState(() => addDaysToDay(todayColombia(), -HISTORY_DEFAULT_RANGE_DAYS));
  const [historyTo, setHistoryTo] = useState(() => todayColombia());
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  // Filtros "Equipos y Planes". Antes pintaba las 855 filas de una, sin buscador
  // ni orden: para encontrar a alguien había que usar Ctrl+F del navegador.
  const [subsSearch, setSubsSearch] = useState('');
  const [subsTeamFilter, setSubsTeamFilter] = useState('all');
  const [subsSort, setSubsSort] = useState<'name' | 'fee' | 'urgency'>('name');
  const [subsPage, setSubsPage] = useState(1);
  const SUBS_PAGE_SIZE = 15;

  // Filtros Validación (Pendientes)
  const [pendingSearch, setPendingSearch] = useState('');

  // Estados para Cash Payments
  const [showCashModal, setShowCashModal] = useState(false);
  const [paymentToApprove, setPaymentToApprove] = useState<PaymentTransaction | null>(null);

  // Equipos activos para filtros
  const [activeTeams, setActiveTeams] = useState<{ id: string; name: string }[]>([]);

  // Reset de la paginación del historial cuando cambian los filtros
  useEffect(() => { setHistoryPage(1); }, [historySearch, historyStatusFilter, historyTeamFilter, historyFrom, historyTo]);
  useEffect(() => { setSubsPage(1); }, [subsSearch, subsTeamFilter, subsSort, activeBranchId]);

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

  // Los estados opt-in (hoy solo 'Cancelado') no vienen en la carga base, así
  // que elegirlos exige volver a consultar. Se salta el primer render para no
  // duplicar el fetch del efecto de arriba.
  const extraStatusRequested = (OPT_IN_STATUSES as readonly string[]).includes(historyStatusFilter)
    ? historyStatusFilter
    : null;
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    if (schoolId) fetchPayments();
  }, [extraStatusRequested, historyFrom, historyTo]);

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
    if (!data) {
      setBilling({ ...DEFAULT_BILLING, school_id: schoolId });
      return;
    }
    // El select('*') delata si la migración 20260809095613 ya corrió en este
    // ambiente. Si la columna no está, guardar mandándola tumbaría el upsert
    // completo y la escuela no podría salvar NINGÚN ajuste de cobro.
    accountsColumnReady.current = 'payment_accounts' in data;
    // `onlyActive: false` porque el admin también edita las llaves apagadas. Si la
    // escuela nunca guardó la lista (deploy recién hecho), se arma desde las
    // columnas viejas para que no vea el formulario en blanco teniendo datos.
    setBilling({
      ...(data as unknown as BillingSettings),
      payment_accounts: resolvePaymentAccounts(data as LegacyAccountColumns & { payment_accounts?: unknown }, { onlyActive: false }),
    });
  };

  const handleSaveBilling = async () => {
    if (!billing || !schoolId) return;
    setBillingSaving(true);
    try {
      // La lista manda: las columnas sueltas se reescriben con la primera llave
      // activa de cada tipo para no dejar datos viejos contradiciendo lo que el
      // acudiente ve y lo que el OCR compara.
      const accounts = serializePaymentAccounts(billing.payment_accounts ?? []);
      const payload = {
        school_id: schoolId,
        // `payment_accounts` es jsonb en la base: PaymentAccount[] no es asignable
        // a Json (los campos opcionales admiten undefined, que no existe en JSON).
        // El JSON.parse/stringify normaliza y a la vez tira los undefined.
        ...(accountsColumnReady.current
            ? { payment_accounts: JSON.parse(JSON.stringify(accounts)) }
            : {}),
        ...accountsToLegacyColumns(accounts),
        payment_cutoff_day: billing.payment_cutoff_day,
        payment_grace_days: billing.payment_grace_days,
        auto_generate_payments: billing.auto_generate_payments,
        reminder_enabled: billing.reminder_enabled,
        reminder_days_before: billing.reminder_days_before,
        late_fee_enabled: billing.late_fee_enabled,
        late_fee_percentage: billing.late_fee_percentage,
        allow_coach_messaging: billing.allow_coach_messaging,
        coach_can_enroll_paid_teams: billing.coach_can_enroll_paid_teams,
        require_payment_proof: billing.require_payment_proof,
        bank_name: billing.bank_name,
        bank_account_type: billing.bank_account_type,
        bank_account_number: billing.bank_account_number,
        bank_titular_name: billing.bank_titular_name,
        bank_titular_id: billing.bank_titular_id,
        payment_qr_url: billing.payment_qr_url,
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
      // El estado se filtra en el SERVIDOR. Antes se pedían las 100 filas más
      // recientes y se repartían en el cliente entre cola e historial: con 355
      // cobros de cartera creados después, los comprobantes por validar no
      // entraban en esas 100 y la escuela no tenía forma de verlos.
      const extraStatus = (OPT_IN_STATUSES as readonly string[]).includes(historyStatusFilter)
        ? [historyStatusFilter]
        : [];
      const statuses = [...CORE_STATUSES, ...extraStatus].join(',');

      let query = supabase
        .from('payments')
        .select(`
          id, amount, amount_paid, status, created_at, payment_date, payment_method, payment_type,
          receipt_url, concept, child_id, parent_id, user_id, team_id,
          unregistered_athlete_id, early_payment_discount_applied,
          period_year, period_month,
          payment_channel, payment_provider, wompi_reference, wompi_transaction_id,
          provider_transaction_id, qr_id,
          ocr_amount, ocr_currency, ocr_date, ocr_bank, ocr_reference, ocr_provider,
          receipt_verdict, ocr_destination, receipt_verdict_reasons, reconciliation_status,
          requires_review, last_failure_at, last_failure_reason,
          parent:profiles!payments_parent_id_fkey(full_name, email),
          user:profiles!payments_user_id_fkey(full_name, email),
          child:children!payments_child_id_fkey(full_name),
          team:teams!payments_team_id_fkey(name),
          plan:offering_plans!payments_offering_plan_id_fkey(name)
        `)
        .eq('school_id', schoolId)
        // El segundo término es defensivo: si algún día un cobro pending/overdue
        // recibe comprobante sin pasar por awaiting_approval, igual se ve.
        .or(`status.in.(${statuses}),and(status.in.(pending,overdue),receipt_url.not.is.null)`)
        .order('created_at', { ascending: false })
        .limit(HISTORY_FETCH_CAP);

      // Rango de fechas, también en el servidor. Se compara contra `payment_date`
      // (columna `date`, se compara pelada) y, solo cuando esa está en NULL,
      // contra `created_at` (`timestamptz`, se compara con los límites del día
      // en hora Colombia).
      //
      // Los comprobantes por validar NUNCA se recortan por fecha: si uno viejo
      // sigue esperando aprobación tiene que verse, y esconderlo por antigüedad
      // es justo el bug que dejó uno de Dynasty invisible. Esa exención es para
      // la COLA; el Historial sí respeta el rango exacto, y lo aplica en cliente
      // sobre estas mismas filas (ver `inHistoryRange`).
      if (historyFrom || historyTo) {
        const byPaymentDate = ['payment_date.not.is.null'];
        const byCreatedAt = ['payment_date.is.null'];
        if (historyFrom) {
          byPaymentDate.push(`payment_date.gte.${historyFrom}`);
          byCreatedAt.push(`created_at.gte.${dayStartUtc(historyFrom)}`);
        }
        if (historyTo) {
          byPaymentDate.push(`payment_date.lte.${historyTo}`);
          // Límite superior EXCLUSIVO al arranque del día siguiente: con `lte`
          // sobre el mismo día se perdía todo lo del día "hasta" después de las
          // 00:00, que es todo.
          byCreatedAt.push(`created_at.lt.${dayStartUtc(addDaysToDay(historyTo, 1))}`);
        }
        query = query.or(
          `and(${byPaymentDate.join(',')}),and(${byCreatedAt.join(',')}),status.in.(awaiting_approval,partial,glosado)`,
        );
      }

      // Un pago con branch_id NULL no es "de otra sede": es un pago sin sede
      // asignada (207 de 499 en Dynasty). Con .eq() se caían todos al
      // seleccionar una sede, incluidos comprobantes esperando validación.
      if (activeBranchId) query = query.or(`branch_id.is.null,branch_id.eq.${activeBranchId}`);
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
        // `payment_date` se pedía al servidor pero se caía acá: la columna Fecha
        // y el CSV llevaban meses mostrando `created_at` (la EMISIÓN del cobro)
        // por el fallback de `reportedDate`. Un pago aprobado hoy sobre una
        // mensualidad emitida el 30/jul se leía como "30 de jul".
        payment_date: p.payment_date ?? null,
        payment_method: p.payment_method, payment_type: p.payment_type,
        receipt_url: p.receipt_url, concept: p.concept,
        child_id: p.child_id, parent_id: p.parent_id, user_id: p.user_id,
        team_id: p.team_id,
        payment_channel: p.payment_channel ?? null,
        payment_provider: p.payment_provider ?? null,
        wompi_reference: p.wompi_reference ?? null,
        wompi_transaction_id: p.wompi_transaction_id ?? null,
        provider_transaction_id: p.provider_transaction_id ?? null,
        qr_id: p.qr_id ?? null,
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
      // Se refrescan junto con la lista para que aprobar/rechazar un cobro
      // actualice las tarjetas sin tocar los 5 call sites de fetchPayments.
      void fetchKpis();
    }
  };

  // KPIs del histórico completo. Va por RPC y no por la lista paginada: la lista
  // trae 100 filas y las tarjetas tienen que hablar de TODO el histórico.
  const fetchKpis = async () => {
    if (!schoolId) return;
    const { data, error } = await (supabase as any).rpc('school_payment_kpis', {
      p_school_id: schoolId,
      p_branch_id: activeBranchId || null,
    });
    if (error) {
      // No reventamos la pantalla por las tarjetas: la lista de cobros es lo
      // operativo. kpis en null hace que se muestre '—' en vez de un dato falso.
      setKpis(null);
      return;
    }
    setKpis(data as PaymentKpis);
  };

  const loadTeamSubscriptions = async () => {
    if (!schoolId) return;
    try {
      const { data, error } = await (supabase
        .from('enrollments') as any)
        .select(`
          id, child_id, user_id, unregistered_athlete_id,
          team_id, offering_plan_id,
          monthly_fee,
          start_date,
          team:teams!enrollments_team_id_fkey ( name, price_monthly, branch_id ),
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

      // ─── Cobro del mes en curso, por atleta ────────────────────────────────
      // Sin esto la columna "Próximo Cobro" era la etiqueta `Día N (Prox. Mes)`
      // repetida idéntica en todas las filas: la config de la escuela, no la
      // realidad. Con esto se ve el `due_date` de verdad, quién ya pagó y —lo
      // que no se veía en ninguna pantalla— a quién no se le generó el cobro.
      const [periodYear, periodMonth] = todayColombia().split('-').map(Number);
      const { data: periodCharges } = await (supabase.from('payments') as any)
        .select('child_id, user_id, unregistered_athlete_id, team_id, status, due_date, amount, last_failure_at, last_failure_reason, requires_review')
        .eq('school_id', schoolId)
        .eq('period_year', periodYear)
        .eq('period_month', periodMonth)
        .neq('status', 'cancelled');

      // Deuda arrastrada: cobros sin pagar que vencieron ANTES de este mes. Sin
      // esto la pantalla solo hablaría del mes en curso y una mora vieja (Dynasty
      // tiene una del 2026-07-10) no se vería en ninguna parte de esta pestaña.
      const firstOfMonth = `${todayColombia().slice(0, 7)}-01`;
      const { data: oldDebt } = await (supabase.from('payments') as any)
        .select('child_id, user_id, unregistered_athlete_id, amount')
        .eq('school_id', schoolId)
        .in('status', ['pending', 'overdue'])
        .lt('due_date', firstOfMonth);

      const athleteKey = (r: { child_id?: string | null; user_id?: string | null; unregistered_athlete_id?: string | null }) =>
        r.child_id || r.user_id || r.unregistered_athlete_id || null;

      const arrearsByAthlete = new Map<string, { count: number; amount: number }>();
      for (const d of ((oldDebt as any[]) ?? [])) {
        const k = athleteKey(d);
        if (!k) continue;
        const acc = arrearsByAthlete.get(k) ?? { count: 0, amount: 0 };
        acc.count += 1;
        acc.amount += Number(d.amount) || 0;
        arrearsByAthlete.set(k, acc);
      }

      const chargesByAthlete = new Map<string, any[]>();
      for (const c of ((periodCharges as any[]) ?? [])) {
        const k = athleteKey(c);
        if (!k) continue;
        const list = chargesByAthlete.get(k);
        if (list) list.push(c); else chargesByAthlete.set(k, [c]);
      }

      /**
       * Cobro que representa a esta inscripción. Con multi-categoría un atleta
       * tiene dos inscripciones y puede tener dos cobros: se prefiere el del
       * mismo equipo antes de caer al primero que aparezca.
       */
      const chargeFor = (e: any): TeamSubscription['charge'] => {
        const k = athleteKey(e);
        const all = k ? chargesByAthlete.get(k) ?? [] : [];
        if (all.length === 0) return null;
        const sameTeam = e.team_id ? all.filter(c => c.team_id === e.team_id) : [];
        const pool = sameTeam.length > 0 ? sameTeam : all;
        const best = [...pool].sort((a, b) =>
          (CHARGE_PRIORITY[a.status] ?? 99) - (CHARGE_PRIORITY[b.status] ?? 99) ||
          (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'),
        )[0];
        return {
          status: best.status,
          due_date: best.due_date ?? null,
          amount: Number(best.amount) || 0,
          last_failure_at: best.last_failure_at ?? null,
          last_failure_reason: best.last_failure_reason ?? null,
          requires_review: best.requires_review === true,
        };
      };

      const mapped: TeamSubscription[] = rawEnrollments.map(e => {
        let fullName = 'Sin nombre';
        if (e.child_id)                     fullName = childMap.get(e.child_id) || fullName;
        else if (e.user_id)                 fullName = profileMap.get(e.user_id) || fullName;
        else if (e.unregistered_athlete_id)   fullName = unregMap.get(e.unregistered_athlete_id) || fullName;

        const { fee, source } = effectiveFee(e);

        return {
          id: e.id,
          child_id: e.child_id,
          user_id: e.user_id,
          unregistered_athlete_id: e.unregistered_athlete_id,
          full_name: fullName,
          team_id: e.team_id,
          team_name: e.team?.name || null,
          branch_id: e.team?.branch_id ?? null,
          offering_plan_id: e.offering_plan_id,
          plan_name: e.plan?.name || null,
          fee,
          fee_source: source,
          plan_price_now: Number(e.plan?.price) || null,
          start_date: e.start_date,
          charge: chargeFor(e),
          // La deuda vieja es del ATLETA, no de una inscripción suya. Si tiene
          // dos inscripciones activas (multi-categoría) el chip sale en ambas
          // filas, así que el TOTAL se suma una sola vez por `athlete_key`.
          athlete_key: athleteKey(e),
          arrears: (() => {
            const k = athleteKey(e);
            return k ? arrearsByAthlete.get(k) ?? null : null;
          })(),
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
    // Un campo con coma, comilla o salto de línea tiene que ir entrecomillado o
    // corre las columnas del resto de la fila. No es teórico: hay conceptos como
    // "Mensualidad 10/2026 - VIOLETA (pago adelantado del 31/07, ref TRF-...)",
    // y esas filas salían descuadradas del archivo.
    const csvCell = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['Fecha de pago', 'Fecha de emisión', 'Acudiente', 'Deportista', 'Monto', 'Estado', 'Concepto', 'Tipo'];
    const rows = payments.map(p => {
      const cfg = STATUS_CONFIG[p.status];
      return [
        // La fecha del movimiento es cuándo se pagó. Con `created_at` el reporte
        // fechaba los pagos el día en que se EMITIÓ el cobro (para una mensualidad
        // de agosto cobrada el 30 de julio, un mes antes del pago real).
        formatDayCO(p.payment_date || p.created_at),
        formatDayCO(p.created_at),
        // Los nombres ya resueltos: `parent`/`child` son null para atletas adultos
        // y sin cuenta, y el CSV los exportaba todos como "Desconocido" aunque la
        // tabla en pantalla sí mostrara el nombre.
        (p as any).parent_responsible || p.parent?.full_name || '—',
        (p as any).athlete_name || p.child?.full_name || 'Sin nombre',
        p.status === 'partial' ? (p.amount_paid ?? 0) : p.amount,
        cfg?.label ?? p.status,
        p.concept,
        p.payment_type || 'N/A',
      ];
    });
    const csvContent = [headers, ...rows].map(e => e.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_pagos_${todayColombia()}.csv`);
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

  /**
   * Formatea un 'YYYY-MM-DD' sin correrlo un día.
   *
   * `new Date('2026-08-03')` se parsea como medianoche UTC, que en Colombia es el 2 de
   * agosto a las 7 p.m. — o sea que una columna `date` se renderiza con el día anterior.
   * El sufijo 'T00:00:00' la fuerza a interpretarse en hora local.
   */
  const formatBusinessDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  /**
   * En "Cobros por Aprobar" la fecha que importa es CUÁNDO SE PAGÓ, no cuándo se emitió
   * el cobro. Antes se mostraba `created_at` y la escuela veía "30 de jul" en un pago
   * reportado el 3 de agosto: la fecha de emisión de la mensualidad, no la del pago.
   */
  const reportedDate = (p: PaymentTransaction) =>
    p.payment_date ? formatBusinessDate(p.payment_date) : formatDate(p.created_at);

  // "Validación de Cobros" muestra SOLO transferencias manuales que requieren
  // que la escuela apruebe/rechace el comprobante. Los pagos de MercadoPago
  // y Wompi NO aparecen aqui — los valida el gateway automaticamente y se
  // marcan paid via webhook. Si se mostraran aqui, la escuela podria aprobar
  // por error un pago que MP / Wompi todavia esta procesando.
  // ¿Lo gestiona una pasarela (lo confirma un webhook) o lo valida la escuela?
  // La regla vive en lib/paymentOrigin para que Finanzas y esta pantalla no se
  // contradigan. Antes se leía `payment_provider`, que no venía en el select →
  // undefined → la protección llevaba años muerta y los awaiting_approval de
  // pasarela sí caían en la cola de aprobación manual.
  const isGatewayManaged = isGatewayPayment;

  const rawPendingPayments = payments.filter(p => {
    const isGateway = isGatewayManaged(p);
    // "Por aprobar" = cobros con un PAGO REPORTADO que la escuela debe validar:
    //  - awaiting_approval: transferencia/comprobante reportado.
    //  - partial: abono en curso (completar saldo).
    //  - pending SOLO si trae comprobante (reportaron algo).
    // Las inscripciones por QR sin pagar (pending sin comprobante) NO entran
    // aquí — aprobarlas marcaría "pagado" sin que haya entrado plata. Quedan
    // como "Pendiente" en el historial y se saldan al registrar el pago.
    // Los de pasarela los confirma el webhook, no la escuela.
    return !isGateway && (
      p.status === 'awaiting_approval' ||
      p.status === 'partial' ||
      (p.status === 'pending' && !!p.receipt_url)
    );
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

  // Historial = plata que entró o un desenlace real, nada más:
  //  - paid / partial / rejected → movimiento con plata o con veredicto final
  //  - awaiting_approval DE PASARELA → transacción iniciada, solo lectura (la
  //    confirma el webhook; la escuela no la aprueba a mano)
  //  - el estado que se pida explícitamente en el selector (p.ej. Cancelado)
  // Un cobro emitido y no pagado (pending/overdue sin comprobante) YA NO entra:
  // no es una transacción y su lugar es la cartera de Finanzas. La regla vieja
  // era "todo lo que no está en la cola", y por eso el Historial mostraba 100
  // filas 'Pendiente' con Soporte N/A que nadie había pagado, mientras el KPI
  // "Transacciones" contaba solo paid|partial y nunca cuadraba con la tabla.
  const rawHistoryPayments = payments.filter(p => {
    if ((HISTORY_DEFAULT_STATUSES as readonly string[]).includes(p.status)) return true;
    if (p.status === 'awaiting_approval') return isGatewayManaged(p);
    return p.status === historyStatusFilter;
  });
  // Base = todo menos el filtro de estado. De acá salen los contadores de las
  // tarjetas, para que muestren cuánto hay en cada estado con la búsqueda y el
  // equipo ya aplicados (si contaran sobre el total, el número no cuadraría con
  // la tabla al buscar).
  /** Día en que entró la plata. Sin fecha de pago, lo único que hay es la emisión. */
  const paymentDay = (p: PaymentTransaction) => p.payment_date || dayInCO(p.created_at);

  /**
   * El Historial sí respeta el rango exacto elegido. La consulta al servidor deja
   * pasar de largo los estados de la cola (un comprobante por validar no se puede
   * esconder por antigüedad), así que el recorte fino va acá.
   */
  const inHistoryRange = (p: PaymentTransaction) => {
    const day = paymentDay(p);
    if (historyFrom && day < historyFrom) return false;
    if (historyTo && day > historyTo) return false;
    return true;
  };

  const historyBase = rawHistoryPayments.filter(inHistoryRange).filter(p => {
    const searchMatch = !historySearch ||
      p.child?.full_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.parent?.full_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.concept?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.program?.name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.team?.name?.toLowerCase().includes(historySearch.toLowerCase());
    const teamMatch = historyTeamFilter === 'all' || p.team?.name === historyTeamFilter || p.team_id === historyTeamFilter;
    return searchMatch && teamMatch;
  });
  // Orden por FECHA DEL PAGO, no por emisión. La consulta viene ordenada por
  // `created_at` (necesario para que el tope de 500 recorte lo más viejo), y con
  // ese orden un pago recibido hoy sobre una mensualidad emitida el 30/jul
  // aparecía sepultado entre las filas de julio en vez de arriba.
  const historyPayments = historyBase
    .filter(p => historyStatusFilter === 'all' || p.status === historyStatusFilter)
    .sort((a, b) =>
      paymentDay(b).localeCompare(paymentDay(a)) ||
      (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    );

  const historyCounts = historyBase.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  const historyTotalPages = Math.max(1, Math.ceil(historyPayments.length / HISTORY_PAGE_SIZE));
  const pagedHistory = historyPayments.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);

  // Los agregados de dinero (ingresos históricos, saldo por validar, tasa de
  // aprobación) ya NO se calculan acá: se pedían sobre `payments`, que es la
  // página de 100 filas más recientes, y las tarjetas mostraban el total de esa
  // ventana como si fuera el histórico. Ahora vienen de school_payment_kpis.

  // ── Equipos y Planes ──────────────────────────────────────────────────────
  // La columna "Método" salió de acá: adivinaba el medio de pago buscando el
  // último pago dentro del array `payments`, que lo carga el Historial acotado
  // por estado, por el tope de 500 filas y por su rango de fechas. Si el pago
  // del atleta no caía en esa ventana, la fila decía "Pendiente" — o sea que
  // decía "Pendiente" en casi todas. El medio de pago se ve en el Historial,
  // donde el dato es real; acá lo que importa es el cobro del mes.

  /** Cómo va el cobro del mes de una inscripción. */
  const chargeState = (s: TeamSubscription): { label: string; className: string; detail: string | null } => {
    const hoy = todayColombia();
    const vence = s.charge?.due_date ?? null;
    const detail = vence ? `Vence ${formatDayCO(vence)}` : null;

    // Lo más importante de la pantalla: nadie le generó el cobro. Ni la cartera
    // de Finanzas lo muestra (no hay fila que mostrar) ni la cola de aprobación.
    if (!s.charge) {
      return { label: 'Sin cobro generado', className: 'bg-rose-100 text-rose-700 border-rose-200', detail: null };
    }

    // ERROR/VOIDED de la pasarela: `requires_review` es, desde ago 2026, lo
    // único que queda marcado — no sabemos si el dinero se movió y hay que
    // abrir el dashboard del proveedor. Pisa al estado del cobro porque es más
    // urgente que la fecha: cobrarle otra vez a alguien que ya pagó es peor
    // que cobrarle tarde. Distinto de «Por validar», que es un comprobante
    // esperando el ojo del admin, no una duda sobre si entró la plata.
    if (s.charge.requires_review) {
      return { label: 'Verificar en la pasarela', className: 'bg-orange-100 text-orange-800 border-orange-300', detail };
    }
    switch (s.charge.status) {
      case 'paid':
        return { label: 'Pagado', className: 'bg-green-500 text-white border-transparent', detail };
      case 'partial':
        return { label: 'Abono parcial', className: 'bg-blue-50 text-blue-700 border-blue-200', detail };
      case 'awaiting_approval':
        return { label: 'Por validar', className: 'bg-amber-100 text-amber-700 border-amber-200', detail };
      case 'glosado':
        return { label: 'En aclaración', className: 'bg-orange-100 text-orange-700 border-orange-200', detail };
      case 'rejected':
      case 'failed':
        return { label: 'Comprobante rechazado', className: 'bg-red-100 text-red-700 border-red-200', detail };
      default: {
        // pending / overdue: lo decide la fecha, no el estado. Un `pending` con
        // due_date de julio está vencido aunque nadie haya corrido el motor de mora.
        if (vence && vence < hoy) {
          const dias = daysDiffFromToday(vence);
          return {
            label: dias === 1 ? 'Vencido ayer' : `Vencido hace ${dias} días`,
            className: 'bg-red-50 text-red-600 border-red-200',
            detail,
          };
        }
        return { label: 'Al día', className: 'bg-slate-100 text-slate-700 border-slate-200', detail };
      }
    }
  };

  /** Prioridad de orden cuando se pide "Más urgente". */
  const urgencyRank = (s: TeamSubscription) => {
    if (!s.charge) return 0;                                   // nadie le generó el cobro
    if (s.arrears) return 1;                                   // arrastra deuda de otros meses
    if (s.charge.due_date && s.charge.due_date < todayColombia()
      && !['paid', 'partial'].includes(s.charge.status)) return 2;
    if (s.fee === 0) return 3;                                 // activo sin cuota
    if (s.charge.status === 'paid') return 6;
    return 4;
  };

  // C-12 F1 (docs/plan-tarifa-congelada-c12.md): cuántas inscripciones quedaron
  // en el precio que el plan tenía al inscribirse, y el catálogo subió después
  // sin que les cascadeara. Mismo alcance de sede que `subsFiltered`, pero sin
  // el filtro de texto — es un conteo, no debe moverse al buscar.
  const subsEnSede = teamSubscriptions
    .filter(s => !activeBranchId || !s.branch_id || s.branch_id === activeBranchId);
  const subsConPlanPropio = subsEnSede.filter(s => s.fee_source === 'enrollment' && s.plan_price_now != null);
  const subsConTarifaCongelada = subsConPlanPropio.filter(s => s.plan_price_now !== s.fee);

  const subsFiltered = teamSubscriptions
    // Una inscripción sin sede no es "de otra sede": es una sin asignar. Misma
    // regla que la lista de cobros, o al filtrar por sede se caen 55 de Dynasty.
    .filter(s => !activeBranchId || !s.branch_id || s.branch_id === activeBranchId)
    .filter(s => {
      const term = subsSearch.trim().toLowerCase();
      const searchMatch = !term ||
        s.full_name.toLowerCase().includes(term) ||
        (s.team_name || '').toLowerCase().includes(term) ||
        (s.plan_name || '').toLowerCase().includes(term);
      const teamMatch = subsTeamFilter === 'all' || s.team_name === subsTeamFilter || s.team_id === subsTeamFilter;
      return searchMatch && teamMatch;
    })
    .sort((a, b) => {
      if (subsSort === 'fee') return b.fee - a.fee || a.full_name.localeCompare(b.full_name);
      if (subsSort === 'urgency') return urgencyRank(a) - urgencyRank(b) || a.full_name.localeCompare(b.full_name);
      return a.full_name.localeCompare(b.full_name);
    });

  // Totales sobre lo filtrado, para que cuadren con lo que la tabla muestra.
  // La deuda anterior se suma una vez por atleta: es suya, no de cada inscripción.
  const subsTotals = (() => {
    const seenDebt = new Set<string>();
    return subsFiltered.reduce(
      (acc, s) => {
        acc.expected += s.fee;
        if (s.charge) acc.billed += s.charge.amount;
        else { acc.unbilled += s.fee; acc.unbilledCount += 1; }
        if (s.fee === 0) acc.noFee += 1;
        if (s.arrears && s.athlete_key && !seenDebt.has(s.athlete_key)) {
          seenDebt.add(s.athlete_key);
          acc.arrears += s.arrears.amount;
          acc.arrearsCount += 1;
        }
        return acc;
      },
      { expected: 0, billed: 0, unbilled: 0, unbilledCount: 0, noFee: 0, arrears: 0, arrearsCount: 0 },
    );
  })();

  const subsTotalPages = Math.max(1, Math.ceil(subsFiltered.length / SUBS_PAGE_SIZE));
  const pagedSubs = subsFiltered.slice((subsPage - 1) * SUBS_PAGE_SIZE, subsPage * SUBS_PAGE_SIZE);

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
          // Las 4 tarjetas salen del RPC (histórico completo), no del array de
          // 100 filas: así calculadas mostraban $150.000 de $1.250.000 reales.
          // Sin datos del RPC se muestra '—', nunca un número inventado.
          // "todos los meses" explícito: este número es global y no cuadra con
          // "Ingresos del Mes" del panel, que es solo el mes en curso.
          { title: 'Ingresos Totales', value: kpis ? formatCurrency(kpis.revenue_total) : '—', sub: 'Histórico acumulado · todos los meses', icon: TrendingUp, color: 'text-emerald-500' },
          { title: 'Por Validar', value: kpis ? kpis.awaiting_count : '—', sub: kpis ? `${formatCurrency(kpis.awaiting_amount)} pendientes` : 'Sin datos', icon: Clock, color: 'text-amber-500' },
          // Transacciones = pagos con plata movida (paid|partial). Un cobro
          // emitido y no pagado NO es una transacción; contarlos daba 100.
          { title: 'Transacciones', value: kpis ? kpis.tx_count : '—', sub: kpis ? `${kpis.charges_total} cobros emitidos` : 'Sin datos', icon: CreditCard, color: 'text-blue-500' },
          // Tasa sobre INTENTOS de pago, no sobre cobros emitidos (daba 1%).
          { title: 'Tasa Aprobación', value: kpis?.approval_rate != null ? `${kpis.approval_rate}%` : '—', sub: kpis ? `${kpis.attempts} intento(s) de pago` : 'Sin datos', icon: CheckCircle2, color: 'text-primary' },
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
      <Tabs
        value={activeTab}
        onValueChange={(v) => setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.set('tab', v);
          return next;
        }, { replace: true })}
        className="space-y-4"
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full sm:w-auto">
            <TabsTrigger value="recurrent" className="text-xs sm:text-sm">Cobros</TabsTrigger>
            <TabsTrigger value="teams" className="text-xs sm:text-sm">Equipos y Planes</TabsTrigger>
            <TabsTrigger value="glosas" className="text-xs sm:text-sm">Glosas</TabsTrigger>
            <TabsTrigger value="conciliacion" className="text-xs sm:text-sm">Conciliación</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">Historial</TabsTrigger>
            <TabsTrigger value="cierre" className="text-xs sm:text-sm">Cierre</TabsTrigger>
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
                <CardDescription>Confirma los cobros con pago reportado (comprobantes y abonos). Los cobros emitidos que nadie ha pagado están en la cartera, en Finanzas.</CardDescription>
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
                            <p className="text-xs text-muted-foreground">{reportedDate(payment)}</p>
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
                            <TableCell className="font-mono text-xs">{reportedDate(payment)}</TableCell>
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
              <TableRefreshBar
                className="-mx-0 sm:-mx-6 sm:-mb-6 mt-2 sm:rounded-b-lg"
                onRefresh={fetchPayments}
                loading={loading}
                summary={`${pendingPayments.length} cobro(s) por aprobar`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Equipos y Planes ────────────────────────────────────── */}
        <TabsContent value="teams">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg">Vista por Equipos y Planes</CardTitle>
                <CardDescription>
                  Una fila por inscripción activa: cuánto se le cobra y cómo va su cobro de este mes.
                </CardDescription>
                {subsConTarifaCongelada.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {subsConTarifaCongelada.length} de {subsConPlanPropio.length} inscripciones están en una tarifa
                    anterior a la del plan — el precio se les copió al entrar y el plan subió después.
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Buscar alumno, equipo o plan..."
                  value={subsSearch}
                  onChange={(e) => setSubsSearch(e.target.value)}
                  className="w-full sm:w-[240px] h-9"
                />
                <select
                  className="flex h-9 w-full sm:w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={subsTeamFilter}
                  onChange={(e) => setSubsTeamFilter(e.target.value)}
                >
                  <option value="all">Todos los Equipos</option>
                  {activeTeams.map(team => (
                    <option key={team.id} value={team.name}>{team.name}</option>
                  ))}
                </select>
                <select
                  className="flex h-9 w-full sm:w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={subsSort}
                  onChange={(e) => setSubsSort(e.target.value as 'name' | 'fee' | 'urgency')}
                >
                  <option value="name">Nombre (A-Z)</option>
                  <option value="urgency">Más urgente</option>
                  <option value="fee">Mayor cuota</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {/* Totales de lo que la tabla está mostrando. Antes no había ninguno:
                  la pantalla de los cobros programados no decía cuánto se espera cobrar. */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 px-4 sm:px-0 pt-4 sm:pt-0 pb-4">
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Esperado mensual</p>
                  <p className="text-lg font-bold">{formatCurrency(subsTotals.expected)}</p>
                  <p className="text-[11px] text-muted-foreground">{subsFiltered.length} inscripciones activas</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Facturado este mes</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(subsTotals.billed)}</p>
                  <p className="text-[11px] text-muted-foreground">cobros ya emitidos</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sin facturar</p>
                  <p className={`text-lg font-bold ${subsTotals.unbilled > 0 ? 'text-rose-600' : ''}`}>
                    {formatCurrency(subsTotals.unbilled)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{subsTotals.unbilledCount} sin cobro generado</p>
                </div>
                {/* Deuda de meses anteriores. Es del atleta, así que se cuenta
                    una vez por persona aunque tenga dos inscripciones. */}
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Deuda anterior</p>
                  <p className={`text-lg font-bold ${subsTotals.arrears > 0 ? 'text-red-600' : ''}`}>
                    {formatCurrency(subsTotals.arrears)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{subsTotals.arrearsCount} atletas con mora</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sin cuota</p>
                  <p className={`text-lg font-bold ${subsTotals.noFee > 0 ? 'text-amber-600' : ''}`}>{subsTotals.noFee}</p>
                  <p className="text-[11px] text-muted-foreground">activos en cero</p>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                ) : pagedSubs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay inscripciones activas con estos filtros.</p>
                ) : pagedSubs.map((sub) => {
                  const st = chargeState(sub);
                  return (
                    <div key={sub.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{sub.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[sub.team_name, sub.plan_name].filter(Boolean).join(' · ') || 'Sin equipo ni plan'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">{formatCurrency(sub.fee)}</p>
                          {sub.fee === 0 && <p className="text-[10px] text-amber-600">sin cuota</p>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={`text-[10px] ${st.className}`}>{st.label}</Badge>
                        {st.detail && <span className="text-[11px] text-muted-foreground">{st.detail}</span>}
                      </div>
                      <FailedAttemptChip
                        reason={sub.charge?.last_failure_reason}
                        at={sub.charge?.last_failure_at}
                      />
                      {sub.arrears && (
                        <p className="text-[11px] font-medium text-red-600">
                          Debe {formatCurrency(sub.arrears.amount)} de meses anteriores
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alumno</TableHead>
                      <TableHead>Equipo</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Mensualidad</TableHead>
                      <TableHead>Cobro de este mes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin h-5 w-5 mx-auto text-muted-foreground" /></TableCell></TableRow>
                    ) : pagedSubs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay inscripciones activas con estos filtros.</TableCell></TableRow>
                    ) : pagedSubs.map((sub) => {
                      const st = chargeState(sub);
                      return (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">{sub.full_name}</TableCell>
                          <TableCell>
                            {sub.team_name ? (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-100">
                                <Trophy className="h-3 w-3 mr-1" />{sub.team_name}
                              </Badge>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {sub.plan_name ? (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                                <Zap className="h-3 w-3 mr-1" />{sub.plan_name}
                              </Badge>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          {/* El monto que se cobra de verdad, con su origen a la vista: un
                              cero acá es una inscripción activa sin cuota, no un error de lectura. */}
                          <TableCell>
                            <span className="font-bold">{formatCurrency(sub.fee)}</span>
                            {sub.fee === 0 ? (
                              <span className="block text-[10px] text-amber-600">sin cuota asignada</span>
                            ) : sub.fee_source !== 'enrollment' ? (
                              <span className="block text-[10px] text-muted-foreground">
                                heredada {sub.fee_source === 'plan' ? 'del plan' : 'del equipo'}
                              </span>
                            ) : sub.plan_price_now != null && sub.plan_price_now !== sub.fee && (
                              // Tarifa congelada (C-12 F1): el plan cambió de precio después de
                              // que esta inscripción copió el suyo al entrar. No es un error —
                              // puede ser una decisión legítima de la escuela— pero hoy era
                              // información que nadie tenía.
                              <span className="block text-[10px] text-amber-600">
                                el plan hoy vale {formatCurrency(sub.plan_price_now)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${st.className}`}>{st.label}</Badge>
                            {st.detail && <span className="block text-[11px] text-muted-foreground mt-0.5">{st.detail}</span>}
                            {sub.charge?.last_failure_reason && (
                              <span className="block mt-1">
                                <FailedAttemptChip
                                  reason={sub.charge.last_failure_reason}
                                  at={sub.charge.last_failure_at}
                                />
                              </span>
                            )}
                            {sub.arrears && (
                              <span className="block text-[11px] font-medium text-red-600 mt-0.5">
                                Debe {formatCurrency(sub.arrears.amount)} de {sub.arrears.count} cobro
                                {sub.arrears.count === 1 ? '' : 's'} anterior{sub.arrears.count === 1 ? '' : 'es'}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TableRefreshBar
                className="-mx-0 sm:-mx-6 sm:-mb-6 mt-2 sm:rounded-b-lg"
                onRefresh={loadTeamSubscriptions}
                loading={loading}
                summary={
                  subsTotalPages > 1
                    ? `Página ${subsPage} de ${subsTotalPages} · ${subsFiltered.length} inscripciones`
                    : `${subsFiltered.length} inscripciones`
                }
              >
                {subsTotalPages > 1 && (
                  <>
                    <Button variant="outline" size="sm" disabled={subsPage <= 1}
                      onClick={() => setSubsPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={subsPage >= subsTotalPages}
                      onClick={() => setSubsPage((p) => Math.min(subsTotalPages, p + 1))}>Siguiente</Button>
                  </>
                )}
              </TableRefreshBar>
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
                <CardDescription>Pagos que entraron: comprobante aprobado (manual o automático), efectivo, QR y pasarela. Los cobros por cobrar no son transacciones — están en la cartera de Finanzas.</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Buscar alumno, padre o concepto..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full sm:w-[250px] h-9"
                />
                {/* Rango por FECHA DEL PAGO (no de emisión del cobro) con dos
                    calendarios. Los atajos cubren la pregunta de todos los días,
                    "¿qué entró hoy?", que con bloques de meses no se podía hacer. */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      aria-label="Pagos desde"
                      title="Desde — fecha en que entró el pago"
                      value={historyFrom}
                      max={historyTo || todayColombia()}
                      onChange={(e) => setHistoryFrom(e.target.value)}
                      className="h-9 w-full sm:w-[145px]"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">a</span>
                    <Input
                      type="date"
                      aria-label="Pagos hasta"
                      title="Hasta — fecha en que entró el pago"
                      value={historyTo}
                      min={historyFrom}
                      onChange={(e) => setHistoryTo(e.target.value)}
                      className="h-9 w-full sm:w-[145px]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {HISTORY_QUICK_RANGES.map(q => {
                      const active = historyFrom === q.from() && historyTo === q.to();
                      return (
                        <Button
                          key={q.label}
                          variant="ghost"
                          size="sm"
                          className={`h-6 px-2 text-[11px] ${active ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}
                          onClick={() => { setHistoryFrom(q.from()); setHistoryTo(q.to()); }}
                        >
                          {q.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
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
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {/* Filtro por estado en tarjetas. 'Cancelado' es opt-in: no viene
                  en la carga base (son ~2.4k cobros anulados), por eso su
                  contador va en '—' hasta que se selecciona y se vuelve a
                  consultar al servidor. */}
              <div className="px-4 sm:px-0 pt-4 sm:pt-0 pb-4">
                <StatFilterBar
                  columns={6}
                  value={historyStatusFilter === 'all' ? null : historyStatusFilter}
                  onChange={(v) => setHistoryStatusFilter(v ?? 'all')}
                  items={[
                    { key: null, label: 'Total', value: historyBase.length, tone: 'neutral' },
                    { key: 'paid', label: 'Pagado', value: historyCounts.paid ?? 0, tone: 'emerald' },
                    { key: 'partial', label: 'Abono parcial', value: historyCounts.partial ?? 0, tone: 'blue' },
                    { key: 'glosado', label: 'En aclaración', value: historyCounts.glosado ?? 0, tone: 'orange' },
                    { key: 'rejected', label: 'Rechazado', value: historyCounts.rejected ?? 0, tone: 'rose' },
                    {
                      key: 'cancelled',
                      label: 'Cancelado',
                      value: historyStatusFilter === 'cancelled' ? (historyCounts.cancelled ?? 0) : '—',
                      tone: 'violet',
                    },
                  ]}
                />
              </div>
              {/* Si la consulta llegó al tope, el usuario tiene que saberlo: una
                  tabla truncada en silencio se lee como "esto es todo". */}
              {payments.length >= HISTORY_FETCH_CAP && (
                <div className="mx-4 sm:mx-0 mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Se alcanzó el máximo de {HISTORY_FETCH_CAP} movimientos por consulta.
                    Acota el rango de fechas o el estado para ver el resto — lo que falta no está perdido, solo no cabe en esta carga.
                  </span>
                </div>
              )}
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
                            {(payment as any).period_label && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 h-4">
                                Cubre {(payment as any).period_label}
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
                          {(payment as any).last_failure_reason && (
                            <span className="block mt-1">
                              <FailedAttemptChip
                                reason={(payment as any).last_failure_reason}
                                at={(payment as any).last_failure_at}
                              />
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Misma corrección que en la tabla: la fecha del pago, no la de emisión. */}
                          <p className="text-xs text-muted-foreground whitespace-nowrap">{reportedDate(payment)}</p>
                          <PaymentOriginBadge payment={payment} compact />
                        </div>
                        {payment.receipt_url && (
                          <Button variant="ghost" size="sm" className="h-7 text-blue-600 hover:bg-blue-50 shrink-0" onClick={() => handleShowProof(payment)}>
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
                      {/* "Fecha" a secas se leía como la del cobro y la escuela
                          creía que un pago de hoy era del 30 de julio. */}
                      <TableHead>Fecha de pago</TableHead>
                      <TableHead>Deportista</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Entró por</TableHead>
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
                          {/* CUÁNDO ENTRÓ LA PLATA, no cuándo se emitió el cobro. Con
                              `created_at` la mensualidad de agosto generada el 30/jul se leía
                              como un pago "del 30 de jul" aunque el comprobante fuera del 3 de
                              agosto — el mismo error ya corregido en "Cobros por Aprobar". */}
                          <TableCell
                            className="text-xs text-muted-foreground whitespace-nowrap"
                            title={payment.payment_date ? `Cobro emitido el ${formatDate(payment.created_at)}` : undefined}
                          >
                            {reportedDate(payment)}
                          </TableCell>
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
                              {/* QUÉ MES CUBRE. El concepto es texto libre y hay cinco
                                  generadores distintos ("Plan PLAN PRO", "Mensualidad", …):
                                  varios no nombran el mes, así que sin este chip no hay forma
                                  de saber a qué periodo se imputó la plata. */}
                              {(payment as any).period_label && (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 w-fit">
                                  Cubre {(payment as any).period_label}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                          {/* Antes: {payment.payment_method || 'TRANSFER'} — inventaba
                              "TRANSFER" en los pagos sin método registrado. */}
                          <TableCell><PaymentOriginBadge payment={payment} /></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                            {/* El intento fallido es un hecho aparte del estado: el cobro
                                puede seguir pendiente Y haber tenido un rechazo. */}
                            {(payment as any).last_failure_reason && (
                              <span className="block mt-1">
                                <FailedAttemptChip
                                  reason={(payment as any).last_failure_reason}
                                  at={(payment as any).last_failure_at}
                                />
                              </span>
                            )}
                          </TableCell>
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
              <TableRefreshBar
                className="-mx-0 sm:-mx-6 sm:-mb-6 mt-2 sm:rounded-b-lg"
                onRefresh={fetchPayments}
                loading={loading}
                summary={
                  historyTotalPages > 1
                    ? `Página ${historyPage} de ${historyTotalPages} · ${historyPayments.length} transacciones`
                    : `${historyPayments.length} transacciones`
                }
              >
                {historyTotalPages > 1 && (
                  <>
                    <Button variant="outline" size="sm" disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={historyPage >= historyTotalPages}
                      onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}>Siguiente</Button>
                  </>
                )}
              </TableRefreshBar>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Cierre de Mes (F1) ──────────────────────────────────── */}
        <TabsContent value="cierre">
          <MonthCloseTab schoolId={schoolId} activeBranchId={activeBranchId} />
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
                        min={1} max={31} className="w-28 h-9"
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
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label className="font-medium">Coaches pueden inscribir en equipos con cobro</Label>
                      <p className="text-xs text-muted-foreground max-w-[46ch]">
                        Inscribir a un atleta en un equipo con mensualidad le genera el cobro en
                        la apertura del mes. Si lo apagas, esas inscripciones las hace la escuela.
                        Asignar planes de pago nunca lo puede hacer un entrenador.
                      </p>
                    </div>
                    <Switch
                      checked={billing.coach_can_enroll_paid_teams}
                      onCheckedChange={v => updateBilling('coach_can_enroll_paid_teams', v)}
                    />
                  </div>
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
                  </div>
                  <Separator />
                  <PaymentAccountsEditor
                    accounts={billing.payment_accounts ?? []}
                    onChange={next => updateBilling('payment_accounts', next)}
                    showSensitive={showSensitive}
                    onReveal={() => setShowSensitive(true)}
                  />
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

              {/* SportMaps Pay. La key lo remonta cuando cambian las pasarelas
                  de abajo, para que el gate se re-evalúe sin recargar. */}
              <div className="md:col-span-2">
                <SportMapsPaySettings key={`pay-${revisionPasarelas}`} />
              </div>

              {/* Cuenta de recaudo propia. Solo staff de plataforma: §10 del plan
                  de connected-accounts decidió que a la escuela NO se le piden
                  llaves ni secretos (pegar la privada de Wompi es entregar la
                  capacidad de cobrar en su comercio). El camino del cliente es
                  el wizard "Conectar", que todavía no existe; mientras tanto la
                  conexión la hace soporte. Va pegado a SportMaps Pay porque el
                  aviso de ahí manda acá. Sin entrada de menú propia. */}
              {schoolId && esPlatformAdmin && (
                <div className="md:col-span-2">
                  <PaymentProvidersAdmin
                    schoolId={schoolId}
                    onChange={() => setRevisionPasarelas(n => n + 1)}
                  />
                </div>
              )}

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
          <div className="p-4 flex flex-col items-center justify-center bg-muted rounded-lg min-h-[200px] sm:min-h-[300px]">
            {viewingProof.url ? (
              /\.pdf(\?|$)/i.test(viewingProof.url) ? (
                // Los comprobantes en PDF NO se renderizan con <img> (queda en
                // blanco). Se muestran en un <iframe>; con enlace de respaldo.
                <iframe
                  src={viewingProof.url}
                  title="Comprobante"
                  className="w-full h-[60vh] rounded border-0 bg-white"
                />
              ) : (
                <img src={viewingProof.url} alt="Comprobante" className="max-h-[400px] sm:max-h-[500px] object-contain rounded w-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )
            ) : (
              <div className="text-center text-muted-foreground p-8"><p>No hay comprobante disponible.</p></div>
            )}
            {viewingProof.url && (
              <a
                href={viewingProof.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 text-sm text-primary underline"
              >
                Abrir en pestaña nueva
              </a>
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
          Apertura del Mes — Generar Cobros
        </CardTitle>
        <CardDescription>
          Crea la mensualidad de este mes para los atletas inscritos que todavía no la tienen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showPreview ? (
          <Button variant="outline" onClick={loadPreview} disabled={loading} className="w-full">
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Calculando...</>
              : <>Ver vista previa del mes a abrir</>}
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
