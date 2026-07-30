import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DollarSign, AlertCircle, TrendingUp, MessageCircle, CheckCircle2, History, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ReminderHistoryModal, ReminderRecord } from '@/components/finances/ReminderHistoryModal';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { todayColombia, daysDiffFromToday } from '@/lib/dateUtils';
import { Input } from '@/components/ui/input';
import { PaymentOriginBadge } from '@/components/payment/PaymentOriginBadge';
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

interface OverdueAccount {
  id: string;
  parent: string;
  student: string;
  concept: string;
  amount: number;
  daysOverdue: number;
  status: 'overdue' | 'reminder_sent';
  lastContactDate?: string;
}

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
}

const TX_PAGE_SIZE = 10;

export default function FinancesPage() {
  const { toast } = useToast();
  const { schoolId, activeBranchId } = useSchoolContext();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Filtros de la tabla de transacciones.
  const [txSearch, setTxSearch] = useState('');
  const [txOrigin, setTxOrigin] = useState<PaymentOriginKind | 'all'>('all');
  const [txPage, setTxPage] = useState(1);
  useEffect(() => { setTxPage(1); }, [txSearch, txOrigin]);

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
          student:children(full_name),
          parent:profiles!payments_parent_id_fkey(full_name)
        `)
        .order('due_date', { ascending: false });

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
    totalOverdue: payments?.filter(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < todayColombia())).reduce((sum, p) => sum + Number(p.amount), 0) || 0,
    pendingPayments: payments?.filter(p => p.status === 'pending' && p.due_date >= todayColombia()).reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };

  // Map Overdue Accounts
  const accountsData = payments?.filter(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < todayColombia())) || [];

  const [overdueAccounts, setOverdueAccounts] = useState<OverdueAccount[]>([]);

  // Update effect to sync state
  useEffect(() => {
    if (accountsData) {
      setOverdueAccounts(accountsData.map(p => ({
        id: p.id,
        parent: (Array.isArray(p.parent) ? p.parent[0]?.full_name : p.parent?.full_name) || 'Desconocido',
        student: (Array.isArray(p.student) ? p.student[0]?.full_name : p.student?.full_name) || 'Deportista',
        concept: p.concept,
        amount: Number(p.amount),
        daysOverdue: daysDiffFromToday(p.due_date),
        status: 'overdue'
      })));
    }
  }, [payments]);


  // ── Transacciones ──────────────────────────────────────────────────────────
  // Antes: los 5 primeros `paid` ordenados por due_date (no por fecha de pago),
  // mostrando solo el PADRE y con `method: 'Transferencia'` hardcodeado. Eso hacía
  // que (a) dos atletas de la misma familia con el mismo plan se vieran como filas
  // duplicadas, (b) un pago por Wompi se anunciara como transferencia, y (c) el
  // orden pareciera aleatorio. Ahora: atleta + pagador, origen real, y filtros.
  const nameOf = (v: unknown): string | null =>
    (Array.isArray(v) ? (v[0] as { full_name?: string })?.full_name : (v as { full_name?: string })?.full_name) || null;

  const allTransactions: Transaction[] = (payments || [])
    .filter(p => p.status === 'paid' || p.status === 'partial')
    .map(p => ({
      id: p.id,
      // La fecha del movimiento es cuándo se pagó; due_date es cuándo se debía.
      date: p.payment_date || p.created_at || p.due_date,
      athlete: nameOf(p.student) || nameOf(p.parent) || 'Sin nombre',
      // Solo se muestra el pagador si es alguien distinto del atleta (menores).
      payer: nameOf(p.student) ? nameOf(p.parent) : null,
      concept: p.concept,
      amount: Number(p.status === 'partial' ? (p.amount_paid ?? 0) : p.amount),
      isPartial: p.status === 'partial',
      origin: resolvePaymentOrigin(p),
      raw: p as PaymentOriginInput,
    }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

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

  const [reminderHistory, setReminderHistory] = useState<ReminderRecord[]>([]);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const handleSendReminder = async (accountId: string) => {
    setSendingReminder(accountId);

    // Simulate WhatsApp notification
    await new Promise(resolve => setTimeout(resolve, 1500));

    const account = overdueAccounts.find(a => a.id === accountId);
    if (!account) return;

    const now = new Date().toISOString();

    // Add to reminder history
    const newReminder: ReminderRecord = {
      id: `reminder-${Date.now()}`,
      parent: account.parent,
      student: account.student,
      amount: account.amount,
      sentAt: now,
      channel: 'whatsapp',
    };
    setReminderHistory(prev => [newReminder, ...prev]);

    // Update account status
    setOverdueAccounts(prev => prev.map(a =>
      a.id === accountId
        ? { ...a, status: 'reminder_sent' as const, lastContactDate: now }
        : a
    ));

    setSendingReminder(null);

    // Show WhatsApp simulation toast
    toast({
      title: '📱 Recordatorio WhatsApp enviado',
      description: `Se envió recordatorio de pago a ${account.parent} por $${account.amount.toLocaleString()}`,
    });
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresado (Mes)</CardTitle>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Padre</TableHead>
                <TableHead>Deportista</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Monto Vencido</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.parent}</TableCell>
                  <TableCell>{account.student}</TableCell>
                  <TableCell>{account.concept}</TableCell>
                  <TableCell className="text-red-500 font-bold">
                    ${account.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(account)}
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
            summary={`${overdueAccounts.length} cuenta(s) por cobrar`}
          />
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
                    {t.date ? new Date(t.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
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
                      {t.date ? new Date(t.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
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
      <ReminderHistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
        reminders={reminderHistory}
      />
    </div>
  );
}
