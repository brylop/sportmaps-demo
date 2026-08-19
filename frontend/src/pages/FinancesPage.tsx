import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DollarSign, AlertCircle, TrendingUp, MessageCircle, CheckCircle2, History, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ReminderHistoryModal } from '@/components/finances/ReminderHistoryModal';
import { paymentRemindersAPI } from '@/lib/api/payment-reminders';

import { useSchoolContext } from '@/hooks/useSchoolContext';
import { todayColombia, daysDiffFromToday, formatDayCO } from '@/lib/dateUtils';
import { Input } from '@/components/ui/input';
import { PaymentOriginBadge } from '@/components/payment/PaymentOriginBadge';
import { FailedAttemptChip } from '@/components/payment/FailedAttemptChip';
import {
  resolvePaymentOrigin,
  ORIGIN_FILTERS,
  type PaymentOrigin,
  type PaymentOriginInput,
  type PaymentOriginKind,
} from '@/lib/paymentOrigin';
import { StatFilterBar, type StatFilterTone } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';

// Color de cada origen en las tarjetas de filtro de Transacciones.
const ORIGIN_TONES: Record<string, StatFilterTone> = {
  gateway: 'blue',
  transfer_receipt: 'emerald',
  transfer_manual: 'yellow',
  cash: 'violet',
  card_manual: 'orange',
  pse_manual: 'primary',
  other: 'neutral',
  unknown: 'rose',
};

/** Una fila embebida de PostgREST llega como objeto o como array de un elemento. */
const embedded = <T,>(v: unknown): T | null =>
  (Array.isArray(v) ? (v[0] as T | undefined) : (v as T | null)) ?? null;

/** Un texto en blanco de la base vale lo mismo que un NULL. */
const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : null;
};

/**
 * Quién figura como pagador. `account` y `self` ya tienen usuario en la app;
 * `temp` y `unregistered` son contactos que cargó la escuela y todavía no se
 * registraron — esa familia no puede pagar en línea, hay que llamarla.
 */
type PayerSource = 'account' | 'self' | 'temp' | 'unregistered' | 'none';

/** Lo que hace falta de un cobro para ponerle cara: los cuatro caminos posibles. */
type PayableRow = {
  student?: unknown;       // children
  parent?: unknown;        // profiles vía parent_id
  athlete?: unknown;       // profiles vía user_id — atleta adulto, se paga solo
  unregistered?: unknown;  // unregistered_athletes — cargado por la escuela
};

type PersonRef = { full_name?: string | null; phone?: string | null };
type ChildRef = { full_name?: string | null; parent_name_temp?: string | null; parent_phone_temp?: string | null };

/**
 * El acudiente NO siempre está en `payments.parent_id`: ese campo se llena solo
 * cuando la familia creó su cuenta. La escuela igual cargó el contacto y quedó en
 * `children.parent_*_temp`, y los atletas adultos se pagan a sí mismos. Mirando
 * únicamente `parent_id`, 131 de las 221 filas vencidas de Dynasty salían como
 * "Desconocido" con el nombre y el celular sentados en la base — y sin nombre no
 * hay a quién cobrarle.
 */
const resolvePayer = (p: PayableRow): { name: string | null; phone: string | null; source: PayerSource } => {
  const child = embedded<ChildRef>(p.student);
  const account = embedded<PersonRef>(p.parent);
  const adult = embedded<PersonRef>(p.athlete);
  const unreg = embedded<PersonRef>(p.unregistered);

  const fromAccount = clean(account?.full_name);
  if (fromAccount) return { name: fromAccount, phone: clean(account?.phone), source: 'account' };

  const fromTemp = clean(child?.parent_name_temp);
  if (fromTemp) return { name: fromTemp, phone: clean(child?.parent_phone_temp), source: 'temp' };

  const fromAdult = clean(adult?.full_name);
  if (fromAdult) return { name: fromAdult, phone: clean(adult?.phone), source: 'self' };

  const fromUnreg = clean(unreg?.full_name);
  if (fromUnreg) return { name: fromUnreg, phone: clean(unreg?.phone), source: 'unregistered' };

  return { name: null, phone: null, source: 'none' };
};

/**
 * El atleta tampoco está siempre en `children`: si es adulto va por `user_id`, y
 * si la escuela lo cargó sin invitarlo, por `unregistered_athlete_id`.
 */
const resolveAthleteName = (p: PayableRow): string | null =>
  clean(embedded<ChildRef>(p.student)?.full_name)
  ?? clean(embedded<PersonRef>(p.athlete)?.full_name)
  ?? clean(embedded<PersonRef>(p.unregistered)?.full_name);

interface OverdueAccount {
  id: string;
  parent: string;
  /** De dónde salió el nombre del pagador; manda si se le marca "sin cuenta". */
  payerSource: PayerSource;
  /** El celular que la escuela tiene para cobrarle, venga de donde venga. */
  parentPhone: string | null;
  student: string;
  concept: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  status: 'overdue' | 'reminder_sent';
  lastContactDate?: string;
  /**
   * Último intento de pago que se cayó. Cambia la conversación de cobro: no es
   * lo mismo una familia que no hizo nada que una a la que el banco le tumbó
   * el débito — a esa hay que decirle que pruebe con otro medio.
   */
  lastFailureAt?: string | null;
  lastFailureReason?: string | null;
  /** ERROR/VOIDED sin resolver: no sabemos si el dinero se movió. */
  requiresReview?: boolean;
}

/**
 * Cómo se agrupa la cartera por lo que pasó con el último intento de pago.
 *
 * No es lo mismo una familia que no hizo nada que una a la que el banco le
 * tumbó el débito: a la primera se le cobra, a la segunda se le explica. Y los
 * ambiguos no se cobran hasta verificar, porque quizá ya pagaron.
 */
type AttemptFilter = 'all' | 'rejected' | 'review' | 'none';

interface Transaction {
  id: string;
  date: string;
  /** Deportista del cobro. Es lo que distingue dos pagos del mismo pagador. */
  athlete: string;
  /** Acudiente, solo cuando es distinto del deportista (menores). */
  payer: string | null;
  concept: string;
  amount: number;
  isPartial: boolean;
  origin: PaymentOrigin;
  raw: PaymentOriginInput;
  /** Día + hora + id: orden estable. Ver `sortKey` más abajo. */
  sortKey: string;
}

const TX_PAGE_SIZE = 10;
/** La cartera de Dynasty son 221 filas: sin paginar, la pantalla es una sábana. */
const OVERDUE_PAGE_SIZE = 25;

/**
 * Tope explícito de la consulta. No es un filtro: es el techo que PostgREST
 * aplica igual (`max-rows` = 1000) aunque no se pida nada. Pedirlo a la vista
 * permite DARSE CUENTA de que se truncó, en vez de perder plata en silencio
 * — el mismo principio que F-01. Dynasty ya va en 593 filas de `payments` y
 * cada mes agrega ~360 cobros, así que el techo se cruza pronto.
 */
const FETCH_CAP = 1000;

/**
 * Estados que esta pantalla usa de verdad: transacciones (paid/partial) y
 * cartera (pending/overdue). `cancelled` son cobros anulados por las limpiezas
 * de duplicados — 169 de las 593 filas de Dynasty — y no se muestran en ninguna
 * de las dos tablas: traerlos solo acerca el techo de 1000.
 */
const USED_STATUSES = ['paid', 'partial', 'pending', 'overdue'] as const;

/** Lo mínimo que hay que saber de un cobro para clasificarlo como vencido o por vencer. */
type ChargeState = {
  status: string;
  due_date: string;
  period_year?: number | null;
  period_month?: number | null;
};

/**
 * Un cobro de un mes que todavía no empieza NO está vencido, aunque su `due_date`
 * ya haya pasado. Salía "Mensualidad Septiembre 2026 · 2 días vencido" el 4 de
 * agosto, porque el QR estampaba el período de septiembre pero el vencimiento del
 * día en que se generó el cobro. Espejo del cinturón que lleva `apply_late_fees`
 * en la migración 20260804125644.
 */
const isFuturePeriod = (p: ChargeState): boolean => {
  if (!p.period_year || !p.period_month) return false;
  const [y, m] = todayColombia().split('-').map(Number);
  return p.period_year * 12 + p.period_month > y * 12 + m;
};

const isUnpaid = (p: ChargeState): boolean => p.status === 'pending' || p.status === 'overdue';

/** Vencido de verdad: impago, de un período ya empezado, y con el plazo cumplido. */
const isOverdueCharge = (p: ChargeState): boolean =>
  isUnpaid(p) && !isFuturePeriod(p) && (p.status === 'overdue' || p.due_date < todayColombia());

/**
 * Impago que aún no vence. Incluye a propósito los `overdue` de período futuro:
 * si solo se los quitáramos de "vencido" sin recogerlos acá, esa plata
 * desaparecería de las dos tarjetas — el mismo fallo silencioso que F-01.
 */
const isUpcomingCharge = (p: ChargeState): boolean => isUnpaid(p) && !isOverdueCharge(p);

export default function FinancesPage() {
  const { toast } = useToast();
  const { schoolId, activeBranchId, schoolName } = useSchoolContext();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Filtros de la tabla de transacciones.
  const [txSearch, setTxSearch] = useState('');
  const [txOrigin, setTxOrigin] = useState<PaymentOriginKind | 'all'>('all');
  const [txPage, setTxPage] = useState(1);
  useEffect(() => { setTxPage(1); }, [txSearch, txOrigin]);

  // Paginación de la cartera. Se reinicia al cambiar de escuela o sede: la página
  // 7 de otra sede no significa nada acá.
  const [odPage, setOdPage] = useState(1);
  useEffect(() => { setOdPage(1); }, [schoolId, activeBranchId]);

  // Fetch payments from Supabase — filtrado por school_id y branch
  const { data: payments, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['school-payments-all', schoolId, activeBranchId],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(`
          id,
          amount,
          amount_paid,
          status,
          due_date,
          payment_date,
          created_at,
          concept,
          payment_method,
          payment_channel,
          payment_provider,
          receipt_url,
          wompi_reference,
          wompi_transaction_id,
          provider_transaction_id,
          qr_id,
          period_year,
          period_month,
          last_failure_at,
          last_failure_reason,
          requires_review,
          student:children(full_name, parent_name_temp, parent_phone_temp),
          parent:profiles!payments_parent_id_fkey(full_name, phone),
          athlete:profiles!payments_user_id_fkey(full_name, phone),
          unregistered:unregistered_athletes(full_name, phone)
        `)
        .in('status', USED_STATUSES as unknown as string[])
        // `id` como último criterio: sin un desempate determinista, dos cargas
        // de la misma pantalla podían devolver los empates de `due_date` en
        // orden distinto y mover filas de página.
        .order('due_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(FETCH_CAP);

      if (schoolId) query = query.eq('school_id', schoolId);
      // Un pago sin sede asignada (branch_id NULL) no es "de otra sede": con
      // .eq() se caía de la vista al seleccionar sede, igual que pasaba en
      // Gestión de Pagos y hacía desaparecer plata real de la pantalla.
      if (activeBranchId) query = query.or(`branch_id.is.null,branch_id.eq.${activeBranchId}`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Calculate Aggregates
  const financialSummary = {
    totalIncome: payments?.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    totalOverdue: payments?.filter(isOverdueCharge).reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    pendingPayments: payments?.filter(isUpcomingCharge).reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };

  // Map Overdue Accounts
  const accountsData = payments?.filter(isOverdueCharge) || [];

  const [overdueAccounts, setOverdueAccounts] = useState<OverdueAccount[]>([]);

  // Update effect to sync state
  useEffect(() => {
    if (accountsData) {
      setOverdueAccounts(accountsData.map(p => {
        const payer = resolvePayer(p);
        return {
          id: p.id,
          parent: payer.name || 'Desconocido',
          payerSource: payer.source,
          parentPhone: payer.phone,
          student: resolveAthleteName(p) || 'Deportista',
          concept: p.concept,
          amount: Number(p.amount),
          dueDate: p.due_date,
          daysOverdue: daysDiffFromToday(p.due_date),
          status: 'overdue' as const,
          lastFailureAt: (p as any).last_failure_at ?? null,
          lastFailureReason: (p as any).last_failure_reason ?? null,
          requiresReview: (p as any).requires_review === true,
        };
      }));
    }
  }, [payments]);


  // ── Filtro por lo que pasó con el último intento de pago ───────────────────
  const [attemptFilter, setAttemptFilter] = useState<AttemptFilter>('all');

  const attemptCounts = useMemo(() => {
    let rejected = 0, review = 0, none = 0;
    for (const a of overdueAccounts) {
      if (a.requiresReview) review += 1;
      else if (a.lastFailureReason) rejected += 1;
      else none += 1;
    }
    return { rejected, review, none };
  }, [overdueAccounts]);

  const filteredOverdue = useMemo(() => {
    switch (attemptFilter) {
      case 'rejected': return overdueAccounts.filter(a => a.lastFailureReason && !a.requiresReview);
      case 'review':   return overdueAccounts.filter(a => a.requiresReview);
      case 'none':     return overdueAccounts.filter(a => !a.lastFailureReason && !a.requiresReview);
      default:         return overdueAccounts;
    }
  }, [overdueAccounts, attemptFilter]);

  // Cambiar de filtro con la página 3 abierta dejaba la tabla vacía sin motivo.
  useEffect(() => { setOdPage(1); }, [attemptFilter]);

  // Si la cartera se encoge (alguien pagó, o se cambió de sede) la página en la que
  // estaba parado el usuario puede ya no existir: se acota en vez de mostrar una
  // tabla vacía sin explicación.
  const odTotalPages = Math.max(1, Math.ceil(filteredOverdue.length / OVERDUE_PAGE_SIZE));
  const odCurrentPage = Math.min(odPage, odTotalPages);
  const pagedOverdue = filteredOverdue.slice(
    (odCurrentPage - 1) * OVERDUE_PAGE_SIZE,
    odCurrentPage * OVERDUE_PAGE_SIZE,
  );

  // ── Transacciones ──────────────────────────────────────────────────────────
  // Antes: los 5 primeros `paid` ordenados por due_date (no por fecha de pago),
  // mostrando solo el PADRE y con `method: 'Transferencia'` hardcodeado. Eso hacía
  // que (a) dos atletas de la misma familia con el mismo plan se vieran como filas
  // duplicadas, (b) un pago por Wompi se anunciara como transferencia, y (c) el
  // orden pareciera aleatorio. Ahora: atleta + pagador, origen real, y filtros.
  const nameOf = (v: unknown): string | null =>
    (Array.isArray(v) ? (v[0] as { full_name?: string })?.full_name : (v as { full_name?: string })?.full_name) || null;

  /**
   * Clave de orden del listado. El DÍA lo manda `payment_date` (la fecha
   * declarada del pago), pero `payment_date` es una columna `date`: no tiene
   * hora, así que no desempata nada. Con 53 pagos entre el 3 y el 5 de agosto
   * todos empataban, y el orden dentro del empate lo terminaba decidiendo el
   * orden en que Postgres devolvía las filas — que no está garantizado y cambia
   * entre cargas. Resultado: la página 1 mezclaba días salteados y NO eran las
   * 10 transacciones más recientes, así que un pago recién aprobado parecía no
   * existir (estaba en la página 7). `created_at` + `id` desempatan estable.
   */
  const sortKey = (p: { payment_date?: string | null; created_at?: string | null; due_date?: string | null; id: string }) =>
    `${(p.payment_date || p.created_at || p.due_date || '').slice(0, 10)}|${p.created_at || ''}|${p.id}`;

  const allTransactions: Transaction[] = (payments || [])
    .filter(p => p.status === 'paid' || p.status === 'partial')
    .map(p => ({
      id: p.id,
      // La fecha del movimiento es cuándo se pagó; due_date es cuándo se debía.
      date: p.payment_date || p.created_at || p.due_date,
      sortKey: sortKey(p),
      athlete: nameOf(p.student) || nameOf(p.parent) || 'Sin nombre',
      // Solo se muestra el pagador si es alguien distinto del atleta (menores).
      payer: nameOf(p.student) ? nameOf(p.parent) : null,
      concept: p.concept,
      amount: Number(p.status === 'partial' ? (p.amount_paid ?? 0) : p.amount),
      isPartial: p.status === 'partial',
      origin: resolvePaymentOrigin(p),
      raw: p as PaymentOriginInput,
    }))
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  // Base = solo búsqueda. De acá salen los contadores de las tarjetas de origen,
  // para que el número de cada tarjeta cuadre con lo que muestra la tabla.
  const txBase = allTransactions.filter(t => {
    const term = txSearch.trim().toLowerCase();
    return !term ||
      t.athlete.toLowerCase().includes(term) ||
      (t.payer || '').toLowerCase().includes(term) ||
      (t.concept || '').toLowerCase().includes(term);
  });

  const transactions = txBase.filter(t => txOrigin === 'all' || t.origin.kind === txOrigin);

  const txOriginCounts = txBase.reduce<Record<string, number>>((acc, t) => {
    acc[t.origin.kind] = (acc[t.origin.kind] ?? 0) + 1;
    return acc;
  }, {});

  const txTotalPages = Math.max(1, Math.ceil(transactions.length / TX_PAGE_SIZE));
  const pagedTransactions = transactions.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);
  const txTotal = transactions.reduce((sum, t) => sum + t.amount, 0);

  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  /**
   * Antes: un `setTimeout` de 1,5 s y un toast que anunciaba "Recordatorio WhatsApp
   * enviado" sin mandar nada, con el historial en memoria — se perdía al recargar.
   * Le afirmaba a la escuela que había cobrado cuando no había cobrado.
   */
  const handleSendReminder = async (accountId: string) => {
    const account = overdueAccounts.find(a => a.id === accountId);
    if (!account || !schoolId) return;

    setSendingReminder(accountId);
    try {
      const result = await paymentRemindersAPI.sendWhatsAppReminder(
        {
          paymentId: account.id,
          contactName: account.parent,
          contactPhone: account.parentPhone,
          athleteName: account.student,
          amount: account.amount,
          dueDate: account.dueDate,
          status: 'overdue',
        },
        { schoolId, schoolName },
      );

      if (result.status === 'no_phone') {
        toast({
          variant: 'destructive',
          title: 'Sin teléfono para cobrar',
          description: `No hay celular registrado para ${account.parent}. Agrégalo en la ficha de ${account.student}.`,
        });
        return;
      }

      if (result.status === 'invalid_phone') {
        toast({
          variant: 'destructive',
          title: 'El teléfono no es marcable',
          description: `«${result.phone}» no es un celular válido. Corrígelo en la ficha de ${account.student} y vuelve a intentar.`,
        });
        return;
      }

      // La fila se marca solo cuando WhatsApp se abrió de verdad.
      setOverdueAccounts(prev => prev.map(a =>
        a.id === accountId
          ? { ...a, status: 'reminder_sent' as const, lastContactDate: new Date().toISOString() }
          : a
      ));

      toast({
        title: 'WhatsApp abierto',
        description: `Revisa el mensaje para ${account.parent} y dale enviar${result.usedFallback ? ' (se usó el texto por defecto: la plantilla no respondió)' : ''}.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo preparar el recordatorio',
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
      });
    } finally {
      setSendingReminder(null);
    }
  };

  const getStatusBadge = (account: OverdueAccount) => {
    if (account.status === 'reminder_sent') {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-yellow-500 text-white gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Recordatorio Enviado
          </Badge>
          {account.lastContactDate && (
            <span className="text-xs text-muted-foreground">
              Último: {new Date(account.lastContactDate).toLocaleDateString('es-CO')}
            </span>
          )}
        </div>
      );
    }
    return <Badge variant="destructive">{account.daysOverdue} días vencido</Badge>;
  };

  // F-01: NO mostrar $0 silencioso ante un error de carga. En una pantalla de
  // dinero, una tabla vacía se lee como "no hay deuda" — hay que distinguir el
  // fallo de red del estado sin datos y ofrecer reintento.
  if (isError) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
          <p className="text-muted-foreground">Panel de control financiero</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudieron cargar las finanzas</AlertTitle>
          <AlertDescription className="mt-1 flex flex-col items-start gap-3">
            <span>
              Ocurrió un error al cargar los pagos. Esto <strong>no</strong> significa
              que no haya deuda o ingresos — es un fallo de conexión. Reintenta.
            </span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
          <p className="text-muted-foreground">Panel de control financiero</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" onClick={() => setShowHistoryModal(true)}>
            <History className="mr-2 h-4 w-4" />
            Ver Historial de Recordatorios
          </Button>
        </div>
      </div>

      {/* Truncamiento visible, no silencioso: si la consulta topó el límite, los
          totales de abajo están incompletos y hay que decirlo. */}
      {payments && payments.length >= FETCH_CAP && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Vista incompleta</AlertTitle>
          <AlertDescription>
            Se alcanzó el tope de {FETCH_CAP} cobros por consulta, así que los totales
            y las tablas de esta pantalla <strong>no incluyen todo el histórico</strong>.
            Hay que acotar por período en el servidor antes de usar estos números.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            {/* Histórico a propósito: el acumulado del mes en curso vive en la
                tarjeta "Ingresos del Mes" del Dashboard. El rótulo decía "(Mes)"
                pero la cuenta nunca filtró por mes. */}
            <CardTitle className="text-sm font-medium">Total Ingresado (Histórico)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              ${financialSummary.totalIncome.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              ${financialSummary.totalOverdue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              ${financialSummary.pendingPayments.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Cuentas por Cobrar - Acción Requerida
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Separar la cartera por lo que pasó con el último intento. «Sin
              intento» es la mora clásica; «Pago rechazado» es una familia que
              SÍ trató de pagar — a esa se le escribe distinto. «Verificar en
              pasarela» no se cobra hasta saber si el dinero se movió. */}
          <div className="mb-4">
            <StatFilterBar
              columns={4}
              value={attemptFilter === 'all' ? null : attemptFilter}
              onChange={(v) => setAttemptFilter((v as AttemptFilter) ?? 'all')}
              items={[
                { key: null, label: 'Todas', value: overdueAccounts.length, tone: 'neutral' },
                { key: 'rejected', label: 'Pago rechazado', value: attemptCounts.rejected, tone: 'yellow' },
                {
                  key: 'review',
                  label: 'Verificar en pasarela',
                  value: attemptCounts.review,
                  tone: 'orange',
                  hidden: attemptCounts.review === 0 && attemptFilter !== 'review',
                },
                { key: 'none', label: 'Sin intento', value: attemptCounts.none, tone: 'rose' },
              ]}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acudiente / Pagador</TableHead>
                <TableHead>Deportista</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Monto Vencido</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Sin esto, filtrar por «Verificar en pasarela» sin resultados
                  dejaba la tabla en blanco y se leía como que se cayó la carga. */}
              {pagedOverdue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {attemptFilter === 'all'
                      ? 'No hay cuentas por cobrar.'
                      : 'Ninguna cuenta por cobrar cae en este filtro.'}
                  </TableCell>
                </TableRow>
              )}
              {pagedOverdue.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span>{account.parent}</span>
                      {(account.payerSource === 'temp' || account.payerSource === 'unregistered') && (
                        <span className="flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground">
                          <Badge variant="outline" className="px-1 py-0 text-[10px] font-normal">
                            sin cuenta
                          </Badge>
                          {account.parentPhone}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{account.student}</TableCell>
                  <TableCell>{account.concept}</TableCell>
                  <TableCell className="text-red-500 font-bold">
                    ${account.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(account)}
                    {(account.lastFailureReason || account.requiresReview) && (
                      <span className="block mt-1">
                        <FailedAttemptChip
                          reason={account.lastFailureReason}
                          at={account.lastFailureAt}
                          requiresReview={account.requiresReview}
                          showReason
                        />
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={account.status === 'reminder_sent' ? 'ghost' : 'outline'}
                      onClick={() => handleSendReminder(account.id)}
                      disabled={sendingReminder === account.id}
                      className={account.status === 'reminder_sent' ? 'text-green-600' : ''}
                    >
                      {sendingReminder === account.id ? (
                        <>
                          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Enviando...
                        </>
                      ) : account.status === 'reminder_sent' ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Reenviar
                        </>
                      ) : (
                        <>
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Enviar WhatsApp
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TableRefreshBar
            className="-mx-6 -mb-6 mt-2 rounded-b-lg"
            onRefresh={refetch}
            loading={isFetching}
            summary={
              // Con un filtro activo el total tiene que ser el de lo FILTRADO,
              // y el monto también: mostrar «$52M» debajo de 6 filas de $910k
              // se lee como que el filtro no hizo nada.
              `${filteredOverdue.length} cuenta(s) por cobrar` +
              (attemptFilter === 'all' ? '' : ` de ${overdueAccounts.length}`) +
              ` · $${filteredOverdue.reduce((s, a) => s + a.amount, 0).toLocaleString('es-CO')}` +
              (odTotalPages > 1 ? ` · página ${odCurrentPage} de ${odTotalPages}` : '')
            }
          >
            {odTotalPages > 1 && (
              <>
                <Button variant="outline" size="sm" disabled={odCurrentPage <= 1}
                  onClick={() => setOdPage(odCurrentPage - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={odCurrentPage >= odTotalPages}
                  onClick={() => setOdPage(odCurrentPage + 1)}>Siguiente</Button>
              </>
            )}
          </TableRefreshBar>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <CardTitle>Transacciones</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Pagos que entraron: pasarela, transferencia, efectivo y QR. La cartera por cobrar está arriba.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input
              placeholder="Buscar deportista, acudiente o concepto..."
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              className="w-full sm:w-[260px] h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtro por origen en tarjetas. Solo se muestran los orígenes que
              existen en los datos: con los 9 siempre visibles la mayoría
              quedaba en 0 y el filtro se volvía ruido. */}
          <div className="mb-4">
            <StatFilterBar
              columns={4}
              value={txOrigin === 'all' ? null : txOrigin}
              onChange={(v) => setTxOrigin((v as PaymentOriginKind) ?? 'all')}
              items={[
                { key: null, label: 'Todos', value: txBase.length, tone: 'neutral' },
                ...ORIGIN_FILTERS.filter(o => o.value !== 'all').map(o => ({
                  key: o.value as PaymentOriginKind,
                  label: o.label,
                  value: txOriginCounts[o.value] ?? 0,
                  tone: ORIGIN_TONES[o.value] ?? 'neutral',
                  hidden: (txOriginCounts[o.value] ?? 0) === 0 && txOrigin !== o.value,
                })),
              ]}
            />
          </div>
          {/* Mobile: tarjetas. Una tabla de 5 columnas en un teléfono obliga a
              scrollear en horizontal para leer el monto, que es justo el dato
              que se viene a buscar. */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay transacciones con estos filtros.</p>
            ) : pagedTransactions.map((t) => (
              <div key={t.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{t.athlete}</p>
                    {t.payer && <p className="text-xs text-muted-foreground truncate">Paga: {t.payer}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-green-500 whitespace-nowrap">${t.amount.toLocaleString('es-CO')}</p>
                    {t.isPartial && (
                      <Badge variant="outline" className="text-[10px] py-0 bg-blue-50 text-blue-700 border-blue-200">abono</Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.concept}</p>
                <div className="flex items-center justify-between gap-2">
                  <PaymentOriginBadge payment={t.raw} />
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    {formatDayCO(t.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Deportista</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Entró por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay transacciones con estos filtros.
                    </TableCell>
                  </TableRow>
                ) : pagedTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDayCO(t.date)}
                    </TableCell>
                    <TableCell>
                      {/* El deportista es lo que diferencia dos pagos del mismo
                          acudiente: antes solo se veía el padre y dos hijos con
                          el mismo plan parecían la misma fila repetida. */}
                      <div className="flex flex-col">
                        <span className="font-semibold">{t.athlete}</span>
                        {t.payer && <span className="text-xs text-muted-foreground">Paga: {t.payer}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{t.concept}</TableCell>
                    <TableCell className="font-bold text-green-500 whitespace-nowrap">
                      ${t.amount.toLocaleString('es-CO')}
                      {t.isPartial && (
                        <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">
                          abono
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell><PaymentOriginBadge payment={t.raw} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <TableRefreshBar
            className="-mx-6 -mb-6 mt-2 rounded-b-lg"
            onRefresh={refetch}
            loading={isFetching}
            summary={
              `${transactions.length} transacción(es) · $${txTotal.toLocaleString('es-CO')}` +
              (txTotalPages > 1 ? ` · página ${txPage} de ${txTotalPages}` : '')
            }
          >
            {txTotalPages > 1 && (
              <>
                <Button variant="outline" size="sm" disabled={txPage <= 1}
                  onClick={() => setTxPage(p => Math.max(1, p - 1))}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={txPage >= txTotalPages}
                  onClick={() => setTxPage(p => Math.min(txTotalPages, p + 1))}>Siguiente</Button>
              </>
            )}
          </TableRefreshBar>
        </CardContent>
      </Card>

      {/* Reminder History Modal */}
      {/* Recibia `reminders`, prop que este modal no tiene: carga sus propios
          registros y para eso necesita `schoolId`, que no se le pasaba. Resultado:
          el historial salia vacio siempre. */}
      <ReminderHistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
        schoolId={schoolId ?? ''}
      />
    </div>
  );
}
