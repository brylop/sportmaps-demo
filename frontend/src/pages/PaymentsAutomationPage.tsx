import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertCircle, Clock, CreditCard, TrendingUp, Download, Eye, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { emailClient } from '@/lib/email-client';
import { EmailTemplates } from '@/lib/email-templates';

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

export default function PaymentsAutomationPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { schoolId, activeBranchId } = useSchoolContext();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [viewingProof, setViewingProof] = useState<{ open: boolean; url: string; student: string; amount: number }>({ open: false, url: '', student: '', amount: 0 });
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Authentication Guard
  if (!profile || (profile.role !== 'school' && profile.role !== 'admin' && profile.role !== 'coach')) {
    // Allow coaches if they have permission (checked internally in components usually, but for page access we might need stricter check)
    // For now, let's assume if they can navigate here, they are allowed, but we'll filter data.
    // If strictly school admin page:
    if (profile.role !== 'school' && profile.role !== 'admin') return <Navigate to="/dashboard" replace />;
  }

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
          child:children(full_name),
          program:programs(name)
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
      const mappedPayments: PaymentTransaction[] = (data || []).map((p: any) => ({
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
      }));

      setPayments(mappedPayments);

    } catch (error: any) {
      console.error('Error fetching payments:', error);
      toast({
        title: 'Error al cargar pagos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [schoolId, activeBranchId]);

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
            await supabase.from('notifications').insert({
              user_id: fullPayment.parent_id,
              title: '✅ Pago Aprobado',
              message: `Tu pago de ${formatCurrency(payment.amount)} ha sido validado exitosamente.`,
              type: 'success',
              link: '/history'
            });
          }
        }
      }

      toast({
        title: action === 'approve' ? 'Pago Aprobado' : 'Pago Rechazado',
        description: `La transacción ha sido ${action === 'approve' ? 'validada' : 'rechazada'} correctamente.`,
        variant: action === 'approve' ? 'default' : 'destructive'
      });

      // Refresh list
      await fetchPayments();

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo procesar la acción',
        variant: 'destructive'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleExportCSV = () => {
    if (payments.length === 0) {
      toast({
        title: "No hay datos",
        description: "No hay transacciones para exportar.",
      });
      return;
    }

    const headers = ['Fecha', 'Estudiante', 'Padre', 'Email', 'Monto', 'Concepto', 'Metodo', 'Estado'];
    const rows = payments.map(p => [
      new Date(p.created_at).toLocaleDateString(),
      p.child?.full_name || 'N/A',
      p.parent?.full_name || 'N/A',
      p.parent?.email || 'N/A',
      p.amount,
      p.concept,
      p.payment_method || 'N/A',
      p.status
    ]);

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

      <Tabs defaultValue="validation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="validation" className="relative">
            Validación Manual
            {pendingPayments.length > 0 && (
              <span className="ml-2 bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full text-[10px]">
                {pendingPayments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Historial de Transacciones</TabsTrigger>
        </TabsList>

        {/* Validation Tab */}
        <TabsContent value="validation">
          <Card className="border-amber-200 bg-amber-50/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                Pagos Pendientes de Aprobación
              </CardTitle>
              <CardDescription>
                Revisa los comprobantes de transferencia y aprueba o rechaza los pagos.
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
                            <span className="text-xs text-muted-foreground">{payment.parent?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-primary">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>
                          {payment.receipt_url || payment.payment_method === 'manual' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-blue-600 border-blue-200 bg-blue-50"
                              onClick={() => setViewingProof({
                                open: true,
                                url: payment.receipt_url || '',
                                student: payment.child?.full_name || 'Estudiante',
                                amount: payment.amount
                              })}
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

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Transacciones</CardTitle>
              <CardDescription>Registro completo de pagos aprobados, rechazados y fallidos.</CardDescription>
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
      </Tabs>

      {/* Proof Viewer Dialog */}
      <Dialog open={viewingProof.open} onOpenChange={(open) => setViewingProof(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Comprobante de Pago</DialogTitle>
            <DialogDescription>
              Verificando soporte de pago para {viewingProof.student}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg flex justify-between items-center">
              <span className="font-semibold">{viewingProof.student}</span>
              <span className="font-bold text-lg">{formatCurrency(viewingProof.amount)}</span>
            </div>

            <div className="border rounded-md overflow-hidden bg-slate-50 min-h-[200px] flex items-center justify-center">
              {viewingProof.url ? (
                <img
                  src={viewingProof.url}
                  alt="Comprobante"
                  className="max-w-full max-h-[60vh] object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    // Show fallback text
                  }}
                />
              ) : (
                <div className="text-center text-muted-foreground p-8">
                  <p>No hay imagen disponible.</p>
                  <p className="text-xs">(Simulación: El usuario no subió archivo real)</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setViewingProof(prev => ({ ...prev, open: false }))}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
