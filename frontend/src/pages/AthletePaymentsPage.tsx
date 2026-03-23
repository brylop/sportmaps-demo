import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Clock, CheckCircle2, XCircle, AlertCircle, Download, Loader2, DollarSign, Building2, Plus, Check, Calendar, Trophy, Zap, User } from 'lucide-react';
import { getAthletePayments, submitAthleteInstallment, getAthleteEnrollments, AthleteEnrollment } from '@/lib/athlete/queries';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentCheckoutModal } from '@/components/payment/PaymentCheckoutModal';
import { Progress } from '@/components/ui/progress';
import { FileUpload } from '@/components/common/FileUpload';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2 as CheckCircle, Loader2 as Loader, CreditCard as CardIcon } from 'lucide-react';
import { normalizeReceiptUrl } from '@/lib/normalizeReceiptUrl';
import { todayColombia } from '@/lib/dateUtils';

interface Payment {
  id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  receipt_url: string | null;
  due_date: string | null;
  payment_date: string | null;
  created_at: string;
  // ── Campos existentes ──
  team_name?: string;
  school_name?: string;
  concept?: string;
  amount_paid?: number;
  school_id?: string;
  team_id?: string;
  child_id?: string;
  user_id?: string;
  branch_id?: string;
  // ── Campos nuevos del RPC ──
  program_name?: string;
  plan_name?: string;
  child_name?: string;
  program_sport?: string;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending:    { label: 'Pendiente',   icon: Clock,       color: 'bg-amber-100 text-amber-700 border-amber-200' },
  processing: { label: 'Procesando', icon: Loader2,     color: 'bg-blue-100 text-blue-700 border-blue-200' },
  approved:   { label: 'Aprobado',   icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:   { label: 'Rechazado',  icon: XCircle,     color: 'bg-red-100 text-red-700 border-red-200' },
  refunded:   { label: 'Reembolsado', icon: AlertCircle, color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export default function AthletePaymentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'approved' | 'pending'>('all');
  const [viewingProof, setViewingProof] = useState<{
    open: boolean;
    url: string | null;
    concept: string;
    amount: number;
  }>({ open: false, url: null, concept: '', amount: 0 });

  const [enrollments, setEnrollments] = useState<AthleteEnrollment[]>([]);
  const [showEnrollmentPicker, setShowEnrollmentPicker] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<AthleteEnrollment | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  // State for selection and modal
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (user) {
      fetchPayments();
      setSelectedPayment(null);
    }
  }, [user, activeTab]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const result = await getAthletePayments({
        status: activeTab === 'all' ? null 
              : activeTab === 'approved' ? 'approved' 
              : 'pending',
        page: 1,
        limit: 100
      });
      setPayments(result.data || []);
      setSummary(result.summary);
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPicker = async () => {
    try {
      setLoadingEnrollments(true);
      setShowEnrollmentPicker(true);
      const data = await getAthleteEnrollments();
      setEnrollments(data || []);
    } catch (err) {
      console.error('Error fetching enrollments:', err);
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const handleSelectEnrollment = (enrollment: AthleteEnrollment) => {
    // Buscar si ya existe un pago pendiente para esta inscripción en el estado local
    const existingPending = payments.find(p => 
      p.status === 'pending' && 
      (p.child_id === enrollment.child_id || p.user_id === enrollment.child_id) && 
      (p.team_id === enrollment.team_id || (p.plan_name && p.plan_name === enrollment.program_name))
    );

    if (existingPending) {
      setSelectedPayment(existingPending);
      setShowEnrollmentPicker(false);
      setShowPayModal(true);
    } else {
      setSelectedEnrollment(enrollment);
      setShowEnrollmentPicker(false);
      setShowPaymentModal(true);
    }
  };

  const pendingPayments = payments.filter(p => p.status === 'pending');

  const pendingPaymentsCount = summary?.count_pending || 0;
  const historyPaymentsCount = summary?.count_approved || 0;
  const rawPending = summary?.pending_cents || 0;
  const totalPending = (isNaN(rawPending) ? 0 : rawPending) / 100;
  const totalApprovedCount = summary?.count_approved || 0;

  const formatCurrencyLocal = (val: number) =>
    `$${Math.round(val).toLocaleString('es-CO')}`;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const handleShowProof = async (receiptUrl: string, concept: string, amount: number) => {
    if (!receiptUrl) return;

    try {
      const cleanPath = normalizeReceiptUrl(receiptUrl);
      const { data, error } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(cleanPath, 3600);

      if (error) throw error;

      setViewingProof({
        open: true,
        url: data.signedUrl,
        concept,
        amount,
      });
    } catch (err: unknown) {
      console.error('Error generating signed URL:', err);
      toast({
        title: 'Error de acceso',
        description: 'No se pudo generar el acceso seguro al comprobante.',
        variant: 'destructive',
      });
    }
  };

  const handleExport = () => {
    if (payments.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay pagos para exportar.' });
      return;
    }
    const rows = payments.map(p => [
      p.due_date ? formatDate(p.due_date) : '—',
      p.team_name || p.concept || '—',
      p.school_name || '—',
      formatCurrencyLocal(p.amount),
      p.status,
    ]);
    const csv = [
      ['Fecha Vence', 'Concepto', 'Escuela', 'Monto', 'Estado'],
      ...rows
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis-pagos-${todayColombia()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: 'Exportado', description: 'Archivo CSV descargado correctamente.' });
  };

  const renderPaymentList = (list: Payment[]) => {
    if (list.length === 0) return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <h3 className="font-semibold text-lg">Sin pagos</h3>
          <p className="text-muted-foreground mt-1">No hay pagos en esta sección.</p>
        </CardContent>
      </Card>
    );
    return list.map(payment => (
      <PaymentCard
        key={payment.id}
        payment={payment}
        formatCurrency={formatCurrencyLocal}
        formatDate={formatDate}
        onRefresh={fetchPayments}
        isSelected={selectedPayment?.id === payment.id}
        onShowProof={handleShowProof}
        onSelect={payment.status === 'pending'
          ? (p) => setSelectedPayment(prev => prev?.id === p.id ? null : p)
          : undefined
        }
      />
    ));
  };

  if (loading && payments.length === 0) {
    return (
      <div className="flex justify-center items-center p-12 min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mis Pagos</h1>
          <p className="text-muted-foreground">Gestiona tus pagos y consulta tu historial.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleOpenPicker}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Pago
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-xl font-bold">{pendingPaymentsCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monto pendiente</p>
              <p className="text-xl font-bold">${totalPending.toLocaleString('es-CO')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pagos realizados</p>
              <p className="text-xl font-bold">{totalApprovedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">
            Todas ({summary?.count_total || 0})
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Aprobadas ({summary?.count_approved || 0})
          </TabsTrigger>
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-1" />
            Pendientes ({summary?.count_pending || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {renderPaymentList(payments)}
        </TabsContent>
        <TabsContent value="approved" className="space-y-4">
          {renderPaymentList(payments)}
        </TabsContent>
        <TabsContent value="pending" className="space-y-4">
          {renderPaymentList(payments)}
        </TabsContent>
      </Tabs>

      {/* Enrollments Modal */}
      <Dialog open={showEnrollmentPicker} onOpenChange={setShowEnrollmentPicker}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Selecciona qué deseas pagar</DialogTitle>
            <DialogDescription>
              Elige una de tus inscripciones activas para realizar un nuevo pago.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
            {loadingEnrollments ? (
              <div className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground mt-2">Cargando inscripciones...</p>
              </div>
            ) : enrollments.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No tienes inscripciones activas para pagar.</p>
              </div>
            ) : (
              enrollments.map((enrollment) => {
                const isEquipo = !!enrollment.team_id;
                
                return (
                  <button
                    key={enrollment.id}
                    onClick={() => handleSelectEnrollment(enrollment)}
                    className="w-full text-left p-4 rounded-xl border hover:border-emerald-500 
                               hover:bg-emerald-50/10 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0
                        ${isEquipo 
                          ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-200' 
                          : 'bg-purple-100 text-purple-600 group-hover:bg-purple-200'
                        }`}
                      >
                        {isEquipo 
                          ? <Trophy className="h-5 w-5" /> 
                          : <Zap className="h-5 w-5" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground truncate">
                            {enrollment.child_name || 'Atleta'}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                            ${isEquipo 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {isEquipo ? '⚽ Equipo' : '📋 Plan'}
                          </span>
                        </div>

                        <p className="text-sm font-medium text-muted-foreground mt-0.5 truncate">
                          {enrollment.program_name}
                          {enrollment.program_sport 
                            ? ` · ${enrollment.program_sport.toUpperCase()}` 
                            : ''
                          }
                        </p>

                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {enrollment.school_name}
                          </p>
                          <p className="text-xs font-bold text-emerald-600 shrink-0 ml-2">
                            ${(enrollment.price_monthly || 0).toLocaleString('es-CO')}/mes
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Checkout Modal (Direct creation) */}
      {selectedEnrollment && (
        <PaymentCheckoutModal
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          studentId={user?.id || undefined} 
          schoolId={selectedEnrollment.school_id}
          teamId={selectedEnrollment.team_id || undefined}
          childId={selectedEnrollment.child_id || undefined}
          childName={selectedEnrollment.child_name || undefined}
          amount={selectedEnrollment.price_monthly}
          concept={`Pago mensualidad - ${
            selectedEnrollment.child_name
              ? `${selectedEnrollment.child_name} / ${selectedEnrollment.program_name}`
              : selectedEnrollment.program_name
          }`}
          mode="create"
          onSuccess={() => {
            fetchPayments();
            setShowPaymentModal(false);
            setSelectedEnrollment(null);
          }}
        />
      )}


      {selectedPayment && (
        <PaymentCheckoutModal
          open={showPayModal}
          onOpenChange={setShowPayModal}
          studentId={user?.id || ''}
          schoolId={selectedPayment.school_id || ''}
          paymentId={selectedPayment.id}
          teamId={selectedPayment.team_id}
          childId={selectedPayment.child_id}
          childName={selectedPayment.child_name}
          branchId={selectedPayment.branch_id}
          amount={selectedPayment.amount}
          concept={
            selectedPayment.child_name
              ? `${selectedPayment.child_name} — ${selectedPayment.program_name || selectedPayment.team_name}`
              : selectedPayment.program_name || selectedPayment.team_name || selectedPayment.concept || 'Pago mensualidad'
          }
          mode="update"
          onSuccess={() => {
            fetchPayments();
            setShowPayModal(false);
            setSelectedPayment(null);
          }}
        />
      )}

      {/* Barra de acción flotante */}
      {selectedPayment && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
              {selectedPayment.child_name 
                ? `${selectedPayment.child_name} · ${selectedPayment.program_name || selectedPayment.team_name}`
                : selectedPayment.program_name || selectedPayment.team_name
              }
            </span>
            <span className="font-bold text-lg">
              {formatCurrencyLocal(selectedPayment.amount)}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              className="text-slate-300 hover:text-white hover:bg-slate-800"
              onClick={() => setSelectedPayment(null)}
            >
              Cancelar
            </Button>
            <Button 
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 font-bold shadow-lg shadow-emerald-500/20"
              onClick={() => setShowPayModal(true)}
            >
              Generar pago
            </Button>
          </div>
        </div>
      )}

      {/* Proof Viewer Dialog */}
      <Dialog open={viewingProof.open} onOpenChange={(open) => setViewingProof(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mi Comprobante</DialogTitle>
            <DialogDescription>
              {viewingProof.concept}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg flex justify-between items-center">
              <span className="font-semibold text-sm truncate mr-2">{viewingProof.concept}</span>
              <span className="font-bold text-lg shrink-0">
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(viewingProof.amount)}
              </span>
            </div>
            <div className="border rounded-md overflow-hidden bg-slate-50 min-h-[200px] flex items-center justify-center">
              {viewingProof.url ? (
                <img
                  src={viewingProof.url}
                  alt="Comprobante"
                  className="max-w-full max-h-[60vh] object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground p-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Cargando comprobante...</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              {viewingProof.url && (
                <Button variant="outline" asChild>
                  <a href={viewingProof.url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    Abrir original
                  </a>
                </Button>
              )}
              <Button onClick={() => setViewingProof(prev => ({ ...prev, open: false }))}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentCard({ payment, formatCurrency, formatDate, onRefresh, onSelect, onShowProof, isSelected }: {
  payment: Payment;
  formatCurrency: (val: number) => string;
  formatDate: (dateStr: string) => string;
  onRefresh: () => void;
  onSelect?: (payment: Payment) => void;
  onShowProof?: (url: string, concept: string, amount: number) => void;
  isSelected: boolean;
}) {
  const config = statusConfig[payment.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const isEquipo = !!payment.team_id;
  const isPlan   = !payment.team_id && !!payment.plan_name;

  // Nombre del programa siempre disponible
  const programName = payment.program_name || payment.team_name || payment.concept || 'Servicio deportivo';

  return (
    <Card
      className={`transition-all overflow-hidden ${onSelect ? 'cursor-pointer' : ''} ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
          : onSelect ? 'border-border hover:border-primary/30' : 'border-border'
      }`}
      onClick={() => onSelect?.(payment)}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">

          {/* Ícono de estado */}
          <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center 
                          justify-center shrink-0 ${config.color.split(' ')[0]}`}>
            <StatusIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${config.color.split(' ')[1]}`} />
          </div>

          {/* Contenido principal */}
          <div className="flex-1 min-w-0 space-y-1.5">

            {/* Fila 1: Nombre del hijo + badge tipo */}
            {payment.child_name && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  {payment.child_name}
                </span>
                {isEquipo && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full 
                                   bg-blue-100 text-blue-700">
                    ⚽ Equipo
                  </span>
                )}
                {isPlan && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full 
                                   bg-purple-100 text-purple-700">
                    📋 Plan
                  </span>
                )}
              </div>
            )}

            {/* Fila 2: Nombre del programa + monto + estado */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm sm:text-base leading-none">
                {programName}
                {payment.program_sport 
                  ? ` · ${payment.program_sport.toUpperCase()}` 
                  : ''
                }
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-base sm:text-lg text-foreground">
                {formatCurrency(payment.amount)}
              </p>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 
                                                   border-none ${config.color}`}>
                {config.label}
              </Badge>
            </div>

            {/* Fila 3: Metadatos */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 
                            text-[11px] sm:text-xs text-muted-foreground">
              {payment.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Vence: {formatDate(payment.due_date)}
                </span>
              )}
              {payment.payment_date && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Pagado: {formatDate(payment.payment_date)}
                </span>
              )}
              {payment.school_name && (
                <span className="flex items-center gap-1 truncate max-w-[180px]">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{payment.school_name}</span>
                </span>
              )}
            </div>

            {onSelect && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Toca para pagar este cobro
                </p>
              </div>
            )}
          </div>

          {/* Botón comprobante */}
          {payment.receipt_url && (
            <Button
              variant="outline" size="sm"
              className="h-8 text-xs bg-background shrink-0 self-center"
              onClick={(e) => {
                e.stopPropagation();
                onShowProof?.(
                  payment.receipt_url!, 
                  payment.program_name || payment.team_name || payment.concept || 'Pago', 
                  payment.amount
                );
              }}
            >
              <Download className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Comprobante</span>
            </Button>
          )}

        </div>
      </CardContent>
    </Card>
  );
}


