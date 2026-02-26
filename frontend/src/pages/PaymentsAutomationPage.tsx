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
import { CheckCircle2, Clock, CreditCard, TrendingUp, Download, Eye, Loader2, XCircle, Save, Bell, DollarSign, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { formatCurrency, getStoragePath } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { emailClient } from '@/lib/email-client';
import { EmailTemplates } from '@/lib/email-templates';

interface BillingSettings {
  id?: string;
  school_id: string;
  payment_due_day: number;
  grace_period_days: number;
  auto_generate_payments: boolean;
  reminder_enabled: boolean;
  reminder_days_before: number;
  late_fee_enabled: boolean;
  late_fee_percentage: number;
  allow_coach_messaging: boolean;
  require_payment_proof: boolean;
}

const DEFAULT_BILLING: Omit<BillingSettings, 'school_id'> = {
  payment_due_day: 5,
  grace_period_days: 5,
  auto_generate_payments: true,
  reminder_enabled: true,
  reminder_days_before: 3,
  late_fee_enabled: false,
  late_fee_percentage: 5,
  allow_coach_messaging: true,
  require_payment_proof: true,
};

// Interfaces for real data
interface PaymentTransaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  payment_method: string | null;
  payment_type: string | null;
  receipt_url: string | null;
  concept: string;
  parent: { full_name: string | null; email: string | null } | null;
  child: { full_name: string } | null;
  program: { name: string } | null;
}

interface TeamSubscription {
  id: string;
  full_name: string;
  monthly_fee: number;
  team_id: string;
  teams: {
    name: string;
  } | null;
  payment_method?: string;
}

/**
 * Página principal para la gestión y automatización de pagos de la escuela.
 * Permite a los administradores validar comprobantes manuales, ver el historial de transacciones
 * y exportar reportes financieros.
 */
export default function PaymentsAutomationPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { schoolId, activeBranchId } = useSchoolContext();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [teamSubscriptions, setTeamSubscriptions] = useState<TeamSubscription[]>([]);
  const [viewingProof, setViewingProof] = useState<{ open: boolean; url: string; student: string; amount: number }>({ open: false, url: '', student: '', amount: 0 });
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ── Billing settings state ──────────────────────────────────────────────
  const [billing, setBilling] = useState<BillingSettings | null>(null);
  const [billingSaving, setBillingSaving] = useState(false);

  useEffect(() => {
    if (schoolId) {
      loadBillingSettings();
      fetchPayments();
      loadTeamSubscriptions();
    }
  }, [schoolId, activeBranchId]);

  const loadBillingSettings = async () => {
    if (!schoolId) return;
    const { data } = await supabase
      .from('school_settings')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle();
    setBilling(data ? (data as unknown as BillingSettings) : { ...DEFAULT_BILLING, school_id: schoolId });
  };

  const handleSaveBilling = async () => {
    if (!billing || !schoolId) return;
    setBillingSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        payment_due_day: billing.payment_due_day,
        grace_period_days: billing.grace_period_days,
        auto_generate_payments: billing.auto_generate_payments,
        reminder_enabled: billing.reminder_enabled,
        reminder_days_before: billing.reminder_days_before,
        late_fee_enabled: billing.late_fee_enabled,
        late_fee_percentage: billing.late_fee_percentage,
        allow_coach_messaging: billing.allow_coach_messaging,
        require_payment_proof: billing.require_payment_proof,
      };
      if (billing.id) {
        const { error } = await (supabase.from('school_settings') as any).update(payload).eq('id', billing.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase.from('school_settings') as any).insert(payload).select().single();
        if (error) throw error;
        setBilling(data as unknown as BillingSettings);
      }
      toast({ title: '✅ Configuración de pagos guardada' });
    } catch (err: any) {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    } finally {
      setBillingSaving(false);
    }
  };

  const updateBilling = <K extends keyof BillingSettings>(key: K, value: BillingSettings[K]) => {
    if (billing) setBilling({ ...billing, [key]: value });
  };
  // ────────────────────────────────────────────────────────────────────────


  const fetchPayments = async () => {
    if (!schoolId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('payments')
        .select(`
          id,
          amount,
          status,
          created_at,
          payment_method,
          payment_type,
          receipt_url,
          concept,
          parent:profiles!payments_parent_id_fkey(full_name, email),
          child:children!payments_child_id_fkey(full_name),
          program:teams!payments_program_id_fkey(name)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (activeBranchId) {
        query = query.eq('branch_id', activeBranchId);
      }

      // Safety limit
      query = query.limit(50);

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to flat structure if needed, or keep as is.
      // The types returned by select need casting or proper type definition match.
      // We'll use 'any' casting for the join results to match our interface simply.
      const mappedPayments: PaymentTransaction[] = ((data as any[] || [])).map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        created_at: p.created_at,
        payment_method: p.payment_method,
        payment_type: p.payment_type,
        receipt_url: p.receipt_url,
        concept: p.concept,
        parent: p.parent,
        child: p.child,
        program: p.program
      })) as PaymentTransaction[];

      setPayments(mappedPayments);

    } catch (error: any) {
      console.error('Error in fetchPayments:', error);
      const errorMessage = error?.message || error?.error_description || String(error);
      toast({
        title: 'Error al cargar pagos',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamSubscriptions = async () => {
    if (!schoolId) return;
    try {
      let query = supabase
        .from('children')
        .select(`
          id,
          full_name,
          monthly_fee,
          team_id,
          teams:teams!children_team_id_fkey(
            name
          )
        `)
        .eq('school_id', schoolId)
        .not('team_id', 'is', null);

      if (activeBranchId) {
        query = query.eq('branch_id', activeBranchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTeamSubscriptions(data as unknown as TeamSubscription[]);
    } catch (error: any) {
      console.error('Error loading team subscriptions:', error);
      toast({
        title: 'Error en suscripciones',
        description: error?.message || String(error),
        variant: 'destructive',
      });
    }
  };


  // Authentication Guard (Moved after all hooks to comply with Rules of Hooks)
  const isAuthorized = profile && [
    'school',
    'admin',
    'school_admin',
    'super_admin',
    'owner'
  ].includes(profile.role);

  if (!isAuthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  /**
   * Aprueba o rechaza un pago registrado manualmente (transferencia/nequi).
   * Si se aprueba, activa automáticamente la inscripción asociada y envía notificaciones.
   * 
   * @param paymentId UUID del pago a procesar.
   * @param action Acción a realizar: 'approve' (aprobar) o 'reject' (rechazar).
   */
  const handleManualAction = async (paymentId: string, action: 'approve' | 'reject') => {
    setProcessingId(paymentId);
    const newStatus = action === 'approve' ? 'paid' : 'rejected';

    try {
      // 1. Update Payment Status
      const { error: updateError } = await supabase
        .from('payments')
        .update({ status: newStatus })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // 2. If Approved, Activate Enrollment if applicable
      if (action === 'approve') {
        // Find the payment details to know which program/child/user
        const payment = payments.find(p => p.id === paymentId);
        if (payment) {
          // We need checking if there is a pending enrollment.
          // We don't have program_id directly in the strict types of 'payments' state unless we stored it.
          // Let's refetch or rely on what we have. Ideally we need program_id and child_id.
          // The 'payments' table has them.

          const { data: fullPayment } = await supabase
            .from('payments')
            .select('program_id, child_id, parent_id')
            .eq('id', paymentId)
            .single();

          if (fullPayment && fullPayment.program_id && (fullPayment.child_id || fullPayment.parent_id)) {
            // Update enrollment
            // Match by program + child (or parent if child is null)
            let enrollQuery = supabase.from('enrollments')
              .update({ status: 'active' })
              .eq('program_id', fullPayment.program_id)
              .eq('status', 'pending'); // Only update pending ones

            if (fullPayment.child_id) {
              enrollQuery = enrollQuery.eq('child_id', fullPayment.child_id);
            } else {
              enrollQuery = enrollQuery.eq('user_id', fullPayment.parent_id);
            }

            const { error: enrollError } = await enrollQuery;
            if (enrollError) console.warn("Could not auto-activate enrollment:", enrollError);
          }

          // 3. Send Notification to Parent + Email
          if (fullPayment?.parent_id) {
            // Send Email
            if (payment.parent?.email) {
              await emailClient.send({
                to: payment.parent.email,
                subject: '¡Pago Aprobado - SportMaps!',
                html: EmailTemplates.paymentConfirmation(
                  payment.parent.full_name || 'Usuario',
                  formatCurrency(payment.amount),
                  payment.concept,
                  payment.id.slice(0, 8).toUpperCase()
                )
              });
            }

            // In-App Notification
            await supabase.rpc('notify_user', {
              p_user_id: fullPayment.parent_id,
              p_title: '✅ Pago Aprobado',
              p_message: `Tu pago de ${formatCurrency(payment.amount)} ha sido validado exitosamente.`,
              p_type: 'success',
              p_link: '/history'
            });
          }
        }
      }

      toast({
        title: action === 'approve' ? 'Pago Aprobado' : 'Pago Rechazado',
        description: `La transacción ha sido ${action === 'approve' ? 'validada' : 'rechazada'} correctamente.`,
        variant: action === 'approve' ? 'default' : 'destructive'
      });
      await fetchPayments();

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: `No se pudo procesar la acción: ${message}`,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Genera y descarga un archivo CSV con el historial de pagos filtrado.
   */
  const handleExportCSV = () => {
    if (payments.length === 0) {
      toast({
        title: "No hay datos",
        description: "No hay transacciones para exportar.",
      });
      return;
    }

    const headers = ['Fecha', 'Padre', 'Estudiante', 'Monto', 'Estado', 'Concepto', 'Tipo'];
    const rows = (payments as PaymentTransaction[]).map(p => {
      const date = new Date(p.created_at).toLocaleDateString();
      const parentName = p.parent?.full_name || 'Desconocido';
      const childName = p.child?.full_name || 'Desconocido';
      return [date, parentName, childName, p.amount, p.status, p.concept, p.payment_type || 'N/A'];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.className = "hidden";
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_pagos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Reporte Generado",
      description: "El archivo CSV se ha descargado correctamente.",
    });
  };

  const handleShowProof = async (payment: PaymentTransaction) => {
    if (!payment.receipt_url) return;

    // If it's already a full URL (legacy or external), just show it
    if (payment.receipt_url.startsWith('http')) {
      setViewingProof({
        open: true,
        url: payment.receipt_url,
        student: payment.child?.full_name || 'Estudiante',
        amount: payment.amount
      });
      return;
    }

    // Generate signed URL for private bucket
    try {
      const cleanPath = getStoragePath(payment.receipt_url);
      const { data, error } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(cleanPath, 300); // 5 minutes

      if (error) throw error;

      setViewingProof({
        open: true,
        url: data.signedUrl,
        student: payment.child?.full_name || 'Estudiante',
        amount: payment.amount
      });
    } catch (err: unknown) {
      console.error("Error generating signed URL:", err);
      toast({
        title: "Error de acceso",
        description: "No se pudo generar el acceso seguro al comprobante.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Separate lists
  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'awaiting_approval');
  const historyPayments = payments.filter(p => p.status !== 'pending' && p.status !== 'awaiting_approval');

  // Stats calculation
  const totalRevenue = payments
    .filter(p => p.status === 'paid')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const pendingAmount = pendingPayments.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Pagos</h1>
          <p className="text-muted-foreground">
            Administra cobros, validaciones y el historial financiero
            {activeBranchId ? ' de la sede actual.' : '.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPayments} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
            Actualizar
          </Button>
          <Button variant="default" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Reporte
          </Button>
        </div>
      </div>

      {/* Stats Grid - REAL DATA */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Histórico acumulado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Validar</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayments.length}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(pendingAmount)} pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
            <p className="text-xs text-muted-foreground">Total registradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Aprobación</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payments.length > 0
                ? Math.round((payments.filter(p => p.status === 'paid').length / payments.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Pagos exitosos</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="recurrent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recurrent">Cobros Recurrentes</TabsTrigger>
          <TabsTrigger value="teams">Vista por Equipos</TabsTrigger>
          <TabsTrigger value="history">Transacciones</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        {/* Cobros Recurrentes Tab */}
        <TabsContent value="recurrent">
          <Card className="border-amber-200 bg-amber-50/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                Validación de Cobros
              </CardTitle>
              <CardDescription>
                Gestiona los pagos pendientes de validación y recordatorios.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
              ) : pendingPayments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p>No hay pagos pendientes por validar.</p>
                </div>
              ) : (
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
                            <span className="text-xs text-muted-foreground">{payment.program?.name || payment.concept}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{payment.parent?.full_name || 'Desconocido'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-primary">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>
                          {payment.receipt_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-blue-600 border-blue-200 bg-blue-50"
                              onClick={() => handleShowProof(payment)}
                            >
                              <Eye className="h-3 w-3" /> Ver
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sin comprobante</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                              disabled={processingId === payment.id}
                              onClick={() => handleManualAction(payment.id, 'approve')}
                            >
                              {processingId === payment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              disabled={processingId === payment.id}
                              onClick={() => handleManualAction(payment.id, 'reject')}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Rechazar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vista por Equipos Tab */}
        <TabsContent value="teams">
          <Card>
            <CardHeader>
              <CardTitle>Vista por Equipos</CardTitle>
              <CardDescription>
                Listado de cobros programados por cada equipo y estudiante.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alumno</TableHead>
                      <TableHead>Equipo</TableHead>
                      <TableHead>Monto Mensual</TableHead>
                      <TableHead>Próximo Cobro</TableHead>
                      <TableHead>Método de Pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : teamSubscriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No hay estudiantes asignados a equipos.
                        </TableCell>
                      </TableRow>
                    ) : (
                      teamSubscriptions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium text-blue-600 cursor-pointer hover:underline">
                            {sub.full_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
                              {sub.teams?.name || 'Sin equipo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">
                            {formatCurrency(sub.monthly_fee || 0)}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5 text-sm">
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                              Día {billing?.payment_due_day || 5} (Prox. Mes)
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="gap-1.5 py-1 px-3 bg-slate-100 text-slate-700 border-transparent">
                              <CreditCard className="h-3.5 w-3.5" />
                              Cobro Automático
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Transacciones</CardTitle>
              <CardDescription>Registro completo de todos los movimientos financieros.</CardDescription>
            </CardHeader>
            <CardContent>
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
                  {historyPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(payment.created_at)}</TableCell>
                      <TableCell className="font-medium">{payment.child?.full_name || payment.parent?.full_name}</TableCell>
                      <TableCell className="text-sm">{payment.program?.name || payment.concept}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell className="text-xs uppercase">{payment.payment_method || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          payment.status === 'paid' ? 'default' :
                            payment.status === 'rejected' ? 'destructive' :
                              payment.status === 'awaiting_approval' ? 'secondary' : 'outline'
                        } className={
                          payment.status === 'paid' ? 'bg-green-500 hover:bg-green-600' :
                            payment.status === 'awaiting_approval' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' : ''
                        }>
                          {payment.status === 'paid' ? 'Pagado' :
                            payment.status === 'rejected' ? 'Rechazado' :
                              payment.status === 'awaiting_approval' ? 'Por Validar' : payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.receipt_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-blue-600 hover:bg-blue-50"
                            onClick={() => handleShowProof(payment)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {historyPayments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">No hay historial disponible.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ─── Configuración Tab ───────────────────────────────────── */}
        <TabsContent value="config" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Configuración</h2>
              <p className="text-sm text-muted-foreground">Reglas de facturación, mora y notificaciones.</p>
            </div>
            <Button onClick={handleSaveBilling} disabled={billingSaving} className="gap-2">
              {billingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Cambios
            </Button>
          </div>

          {billing && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Payment Rules */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-emerald-500" /> Reglas de Cobro
                  </CardTitle>
                  <CardDescription>Cuándo y cómo se generan los cobros mensuales.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="due_day">Día de corte del mes</Label>
                    <div className="flex items-center gap-2">
                      <Input id="due_day" type="number" min={1} max={28} className="w-24"
                        value={billing.payment_due_day}
                        onChange={e => updateBilling('payment_due_day', parseInt(e.target.value) || 5)} />
                      <span className="text-sm text-muted-foreground">de cada mes</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grace">Días de gracia</Label>
                    <div className="flex items-center gap-2">
                      <Input id="grace" type="number" min={0} max={15} className="w-24"
                        value={billing.grace_period_days}
                        onChange={e => updateBilling('grace_period_days', parseInt(e.target.value) || 0)} />
                      <span className="text-sm text-muted-foreground">días después del corte</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Generar cobros automáticos</Label>
                      <p className="text-xs text-muted-foreground">Crear pagos pendientes cada mes</p>
                    </div>
                    <Switch checked={billing.auto_generate_payments}
                      onCheckedChange={v => updateBilling('auto_generate_payments', v)} />
                  </div>
                </CardContent>
              </Card>

              {/* Late Fees */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" /> Mora y Penalización
                  </CardTitle>
                  <CardDescription>Recargos por pago tardío.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Habilitar mora</Label>
                      <p className="text-xs text-muted-foreground">Recargo después del período de gracia</p>
                    </div>
                    <Switch checked={billing.late_fee_enabled}
                      onCheckedChange={v => updateBilling('late_fee_enabled', v)} />
                  </div>
                  {billing.late_fee_enabled && (
                    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                      <Label htmlFor="late_pct">Porcentaje de recargo</Label>
                      <div className="flex items-center gap-2">
                        <Input id="late_pct" type="number" min={1} max={50} className="w-24"
                          value={billing.late_fee_percentage}
                          onChange={e => updateBilling('late_fee_percentage', parseInt(e.target.value) || 5)} />
                        <span className="text-sm text-muted-foreground">% adicional</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <Label className="font-medium">Exigir comprobante de pago</Label>
                      <p className="text-xs text-muted-foreground">Los padres deben subir foto del recibo</p>
                    </div>
                    <Switch checked={billing.require_payment_proof}
                      onCheckedChange={v => updateBilling('require_payment_proof', v)} />
                  </div>
                </CardContent>
              </Card>

              {/* Reminders */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-blue-500" /> Recordatorios
                  </CardTitle>
                  <CardDescription>Notificaciones automáticas de pago.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Enviar recordatorios</Label>
                      <p className="text-xs text-muted-foreground">Notificar a los padres antes del vencimiento</p>
                    </div>
                    <Switch checked={billing.reminder_enabled}
                      onCheckedChange={v => updateBilling('reminder_enabled', v)} />
                  </div>
                  {billing.reminder_enabled && (
                    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                      <Label htmlFor="reminder_days">Días antes del vencimiento</Label>
                      <div className="flex items-center gap-2">
                        <Input id="reminder_days" type="number" min={1} max={15} className="w-24"
                          value={billing.reminder_days_before}
                          onChange={e => updateBilling('reminder_days_before', parseInt(e.target.value) || 3)} />
                        <span className="text-sm text-muted-foreground">días antes</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Permissions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-500" /> Permisos
                  </CardTitle>
                  <CardDescription>Qué pueden hacer los coaches y el staff.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Coaches pueden enviar mensajes</Label>
                      <p className="text-xs text-muted-foreground">Comunicación directa coach → padres</p>
                    </div>
                    <Switch checked={billing.allow_coach_messaging}
                      onCheckedChange={v => updateBilling('allow_coach_messaging', v)} />
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground text-center">
                    Más opciones de permisos estarán disponibles próximamente.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Proof of payment dialog */}
      <Dialog open={viewingProof.open} onOpenChange={open => setViewingProof(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprobante de Pago</DialogTitle>
            <DialogDescription>
              {viewingProof.student} — {formatCurrency(viewingProof.amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 flex items-center justify-center bg-muted rounded-lg min-h-[300px]">
            {viewingProof.url ? (
              <img
                src={viewingProof.url}
                alt="Comprobante"
                className="max-h-[500px] object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="text-center text-muted-foreground p-8">
                <p>No hay imagen disponible.</p>
                <p className="text-xs">(El usuario no subió archivo real)</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setViewingProof(prev => ({ ...prev, open: false }))}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
