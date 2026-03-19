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
import { CheckCircle2, Clock, CreditCard, TrendingUp, Download, Eye, EyeOff, Loader2, XCircle, Save, Bell, DollarSign, Shield, Smartphone, Building2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { formatCurrency, getStoragePath, maskSensitive } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getUserFriendlyError } from '@/lib/error-translator';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { FileUpload } from '@/components/common/FileUpload';
import { emailClient } from '@/lib/email-client';
import { ReviewInstallmentModal } from '@/components/payment/ReviewInstallmentModal';
import { InstallmentsConfigCard } from '@/components/payment/InstallmentsConfigCard';

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
  allow_installments: boolean;
  max_installments_per_payment: number;
  min_installment_amount: number;
  installment_require_proof: boolean;
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
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paid: { label: 'Pagado', className: 'bg-green-500 text-white border-transparent' },
  rejected: { label: 'Rechazado', className: 'bg-red-100 text-red-700 border-red-200' },
  awaiting_approval: { label: 'Por Validar', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  overdue: { label: 'Vencido', className: 'bg-red-50 text-red-600 border-red-200' },
  failed: { label: 'Fallido', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  pending: { label: 'Pendiente', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
};

interface PaymentTransaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  payment_method: string | null;
  payment_type: string | null;
  receipt_url: string | null;
  concept: string;
  team_id: string | null;
  parent: { full_name: string | null; email: string | null } | null;
  child: { full_name: string } | null;
  team: { name: string } | null;
  child_id?: string | null;
  parent_id?: string | null;
}

interface TeamSubscription {
  id: string;
  full_name: string;
  monthly_fee: number;
  team_id: string;
  teams: { name: string } | null;
  payment_method?: string;
  child_id?: string | null;
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
  const [billing, setBilling] = useState<BillingSettings | null>(null);
  const [billingSaving, setBillingSaving] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);

  // Filtros Historial
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');

  // Filtros Validación (Pendientes)
  const [pendingSearch, setPendingSearch] = useState('');

  useEffect(() => {
    if (schoolId) {
      loadBillingSettings();
      fetchPayments();
      loadTeamSubscriptions();
    }
  }, [schoolId, activeBranchId]);

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
        allow_installments: billing.allow_installments,
        max_installments_per_payment: billing.max_installments_per_payment,
        min_installment_amount: billing.min_installment_amount,
        installment_require_proof: billing.installment_require_proof,
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
  };

  const fetchPayments = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('payments')
        .select(`id, amount, status, created_at, payment_method, payment_type, receipt_url, concept, child_id, parent_id, team_id,
          parent:profiles!payments_parent_id_fkey(full_name, email),
          child:children!payments_child_id_fkey(full_name),
          team:teams!payments_team_id_fkey(name)`)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (activeBranchId) query = query.eq('branch_id', activeBranchId);
      const { data, error } = await query;
      if (error) throw error;
      setPayments(((data as any[]) || []).map((p) => ({
        id: p.id, amount: p.amount, status: p.status, created_at: p.created_at,
        payment_method: p.payment_method, payment_type: p.payment_type,
        receipt_url: p.receipt_url, concept: p.concept, child_id: p.child_id, parent_id: p.parent_id,
        team_id: p.team_id,
        parent: p.parent, child: p.child, team: p.team,
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
      const query = supabase
        .from('enrollments')
        .select(`
          id,
          child_id,
          team_id,
          schools!inner ( id ),
          children ( full_name ),
          team:teams!enrollments_team_id_fkey ( name, price_monthly )
        `)
        .eq('school_id', schoolId)
        .eq('status', 'active');

      if (activeBranchId) {
        // En un caso real podrías filtrar enrollments por branch si existiera en enrollment, 
        // pero vamos a filtrar en memoria por simplicidad o dejarlo así ya que se hereda del school.
      }
      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data as any[]).map(e => ({
        id: e.id,
        child_id: e.child_id,
        full_name: e.children?.full_name || 'Sin nombre',
        monthly_fee: e.team?.price_monthly || 0,
        team_id: e.team_id,
        teams: { name: e.team?.name },
      }));
      setTeamSubscriptions(mapped);
    } catch (error: unknown) {
      toast({ title: 'Error en suscripciones', description: getUserFriendlyError(error), variant: 'destructive' });
    }
  };

  // isAuthorized: profile.role handles regular users, currentUserRole handles school 'owner' role
  // (profile.role never contains 'owner' - that's a school_members role, not a profile role)
  const isAuthorized = profile && (
    ['school', 'admin', 'school_admin', 'super_admin'].includes(profile.role) ||
    ['owner', 'admin', 'school_admin', 'super_admin'].includes(currentUserRole || '')
  );
  if (!isAuthorized) return <Navigate to="/dashboard" replace />;

  const handleManualAction = async (paymentId: string, action: 'approve' | 'reject') => {
    setProcessingId(paymentId);
    const newStatus = action === 'approve' ? 'paid' : 'failed';
    try {
      const { error: updateError } = await supabase.from('payments').update({ status: newStatus }).eq('id', paymentId);
      if (updateError) throw updateError;
      if (action === 'approve') {
        const payment = payments.find(p => p.id === paymentId);
        if (payment) {
          if (payment.team_id && (payment.child_id || payment.parent_id)) {
            let enrollQuery = supabase.from('enrollments').update({ status: 'active' }).eq('team_id', payment.team_id).eq('status', 'pending');
            if (payment.child_id) enrollQuery = enrollQuery.eq('child_id', payment.child_id);
            else enrollQuery = enrollQuery.eq('user_id', payment.parent_id);
            const { error: enrollError } = await enrollQuery;
            if (enrollError) console.warn('Could not auto-activate enrollment:', enrollError);
          }
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
              p_type: 'success', p_link: '/history',
            });
          }
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
    const headers = ['Fecha', 'Padre', 'Estudiante', 'Monto', 'Estado', 'Concepto', 'Tipo'];
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
      setViewingProof({ open: true, url: payment.receipt_url, student: payment.child?.full_name || 'Estudiante', amount: payment.amount });
      return;
    }
    try {
      const cleanPath = getStoragePath(payment.receipt_url);
      const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(cleanPath, 300);
      if (error) throw error;
      setViewingProof({ open: true, url: data.signedUrl, student: payment.child?.full_name || 'Estudiante', amount: payment.amount });
    } catch {
      toast({ title: 'Error de acceso', description: 'No se pudo generar el acceso al comprobante.', variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const rawPendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'awaiting_approval');
  const pendingPayments = rawPendingPayments.filter(p => {
    if (!pendingSearch) return true;
    const term = pendingSearch.toLowerCase();
    return p.child?.full_name?.toLowerCase().includes(term) ||
      p.parent?.full_name?.toLowerCase().includes(term) ||
      p.concept?.toLowerCase().includes(term) ||
      p.program?.name?.toLowerCase().includes(term) ||
      p.team?.name?.toLowerCase().includes(term);
  });

  // Filtrar historial
  const rawHistoryPayments = payments.filter(p => p.status !== 'pending' && p.status !== 'awaiting_approval');
  const historyPayments = rawHistoryPayments.filter(p => {
    const searchMatch = !historySearch ||
      p.child?.full_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.parent?.full_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.concept?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.program?.name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.team?.name?.toLowerCase().includes(historySearch.toLowerCase());
    const statusMatch = historyStatusFilter === 'all' || p.status === historyStatusFilter;
    return searchMatch && statusMatch;
  });

  const totalRevenue = payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0);
  const pendingAmount = pendingPayments.reduce((acc, p) => acc + p.amount, 0);

  const getPreferredMethod = (childId?: string) => {
    if (!childId) return { label: 'Pendiente', icon: Clock };
    const latest = payments.find(p => p.child_id === childId && p.status === 'paid');
    if (!latest || !latest.payment_method) return { label: 'Pendiente', icon: Clock };
    switch (latest.payment_method.toLowerCase()) {
      case 'transfer': return { label: 'Transferencia', icon: Smartphone };
      case 'pse': return { label: 'PSE', icon: Building2 };
      case 'card': return { label: 'Tarjeta', icon: CreditCard };
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
            <TabsTrigger value="teams" className="text-xs sm:text-sm">Equipos</TabsTrigger>
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
                  Validación de Cobros
                </CardTitle>
                <CardDescription>Gestiona los pagos pendientes de validación.</CardDescription>
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
                            <p className="font-bold text-sm truncate">{payment.child?.full_name || 'Sin estudiante'}</p>
                            <p className="text-xs text-muted-foreground truncate">{payment.program?.name || payment.team?.name || payment.concept}</p>
                            <p className="text-xs text-muted-foreground">{payment.parent?.full_name || 'Desconocido'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-primary text-sm">{formatCurrency(payment.amount)}</p>
                            <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleDateString('es-CO')}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {payment.receipt_url && (
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-blue-600 border-blue-200 bg-blue-50" onClick={() => handleShowProof(payment)}>
                              <Eye className="h-3 w-3" /> Comprobante
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200 hover:bg-green-50" disabled={processingId === payment.id} onClick={() => handleManualAction(payment.id, 'approve')}>
                            {processingId === payment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Aprobar
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 hover:bg-red-50" disabled={processingId === payment.id} onClick={() => handleManualAction(payment.id, 'reject')}>
                            <XCircle className="h-3 w-3 mr-1" />
                            Rechazar
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
                          <TableHead>Estudiante / Programa</TableHead>
                          <TableHead>Padre</TableHead>
                          <TableHead>Monto</TableHead>
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
                                <span className="font-bold">{payment.child?.full_name || 'Sin estudiante'}</span>
                                <span className="text-xs text-muted-foreground">{payment.program?.name || payment.team?.name || payment.concept}</span>
                              </div>
                            </TableCell>
                            <TableCell><span className="text-sm">{payment.parent?.full_name || 'Desconocido'}</span></TableCell>
                            <TableCell className="font-bold text-primary">{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>
                              {payment.receipt_url ? (
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-blue-600 border-blue-200 bg-blue-50" onClick={() => handleShowProof(payment)}>
                                  <Eye className="h-3 w-3" /> Ver
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Sin comprobante</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" disabled={processingId === payment.id} onClick={() => handleManualAction(payment.id, 'approve')}>
                                  {processingId === payment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                  Aprobar
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={processingId === payment.id} onClick={() => handleManualAction(payment.id, 'reject')}>
                                  <XCircle className="h-3 w-3 mr-1" /> Rechazar
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
              <CardTitle className="text-base sm:text-lg">Vista por Equipos</CardTitle>
              <CardDescription>Cobros programados por equipo y estudiante.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {/* Mobile cards */}
              <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                ) : teamSubscriptions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay estudiantes asignados a equipos.</p>
                ) : teamSubscriptions.map((sub) => (
                  <div key={sub.id} className="border rounded-lg p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-blue-600 truncate">{sub.full_name}</p>
                      <p className="text-xs text-muted-foreground">{sub.teams?.name || 'Sin equipo'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{formatCurrency(sub.monthly_fee || 0)}</p>
                      <p className="text-xs text-muted-foreground">Día {billing?.payment_cutoff_day || 5}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alumno</TableHead>
                      <TableHead>Equipo</TableHead>
                      <TableHead>Monto Mensual</TableHead>
                      <TableHead>Próximo Cobro</TableHead>
                      <TableHead>Método</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                    ) : teamSubscriptions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No hay estudiantes asignados a equipos.</TableCell></TableRow>
                    ) : teamSubscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium text-blue-600">{sub.full_name}</TableCell>
                        <TableCell><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">{sub.teams?.name || 'Sin equipo'}</Badge></TableCell>
                        <TableCell className="font-bold">{formatCurrency(sub.monthly_fee || 0)}</TableCell>
                        <TableCell><span className="flex items-center gap-1.5 text-sm"><Clock className="h-3.5 w-3.5 text-amber-500" />Día {billing?.payment_cutoff_day || 5} (Prox. Mes)</span></TableCell>
                        <TableCell>
                          {(() => {
                            const method = getPreferredMethod(sub.child_id);
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
            </CardContent>
          </Card>
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
                ) : historyPayments.map((payment) => {
                  const cfg = STATUS_CONFIG[payment.status] ?? { label: payment.status, className: 'bg-gray-100 text-gray-600' };
                  return (
                    <div key={payment.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{payment.child?.full_name || payment.parent?.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{payment.program?.name || payment.team?.name || payment.concept}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">{formatCurrency(payment.amount)}</p>
                          <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
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
                      <TableHead>Estudiante</TableHead>
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
                    ) : historyPayments.map((payment) => {
                      const cfg = STATUS_CONFIG[payment.status] ?? { label: payment.status, className: 'bg-gray-100 text-gray-600' };
                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(payment.created_at)}</TableCell>
                          <TableCell className="font-medium">{payment.child?.full_name || payment.parent?.full_name}</TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium text-blue-600">{payment.concept}</div>
                            {payment.program?.name && <div className="text-xs text-muted-foreground mt-0.5">P: {payment.program.name}</div>}
                            {payment.team?.name && <div className="text-xs text-muted-foreground mt-0.5">T: {payment.team.name}</div>}
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
                      <Input id="due_day" type="number" min={1} max={28} className="w-24" value={billing.payment_cutoff_day} onChange={e => updateBilling('payment_cutoff_day', parseInt(e.target.value) || 5)} />
                      <span className="text-sm text-muted-foreground">de cada mes</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grace">Días de gracia</Label>
                    <div className="flex items-center gap-2">
                      <Input id="grace" type="number" min={0} max={15} className="w-24" value={billing.payment_grace_days} onChange={e => updateBilling('payment_grace_days', parseInt(e.target.value) || 0)} />
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
                        <Input id="late_pct" type="number" min={1} max={50} className="w-24" value={billing.late_fee_percentage} onChange={e => updateBilling('late_fee_percentage', parseInt(e.target.value) || 5)} />
                        <span className="text-sm text-muted-foreground">% adicional</span>
                      </div>
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
                        <Input id="reminder_days" type="number" min={1} max={15} className="w-24" value={billing.reminder_days_before} onChange={e => updateBilling('reminder_days_before', parseInt(e.target.value) || 3)} />
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
                        <FileUpload bucket="school-assets" accept="image/*" onUploadComplete={(url) => updateBilling('payment_qr_url', url)} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

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
    </div>
  );
}