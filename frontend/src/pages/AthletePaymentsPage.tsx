import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Clock, CheckCircle2, XCircle, AlertCircle, Download, Loader2, DollarSign, Building2, Plus, Check, Calendar } from 'lucide-react';
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

interface Payment {
  id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  receipt_url: string | null;
  due_date: string | null;
  payment_date: string | null;
  created_at: string;
  team_name?: string;
  school_name?: string;
  concept?: string;
  amount_paid?: number;
  school_id?: string;
  team_id?: string;
  child_id?: string;
  branch_id?: string;
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  const [enrollments, setEnrollments] = useState<AthleteEnrollment[]>([]);
  const [showEnrollmentPicker, setShowEnrollmentPicker] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<AthleteEnrollment | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  // State for selection and modal
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showPayModal, setShowPayModal]       = useState(false);

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
        status: activeTab === 'pending' ? 'pending' : null,
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
    setSelectedEnrollment(enrollment);
    setShowEnrollmentPicker(false);
    setShowPaymentModal(true);
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
        <Button className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto" onClick={handleOpenPicker}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Pago
        </Button>
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
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="h-4 w-4" />
            Pendientes ({pendingPaymentsCount})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Historial ({historyPaymentsCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">

          {pendingPayments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
                <h3 className="font-semibold text-lg">¡Estás al día!</h3>
                <p className="text-muted-foreground mt-1">No tienes pagos pendientes.</p>
              </CardContent>
            </Card>
          ) : (
            pendingPayments.map(payment => (
              <PaymentCard 
                key={payment.id} 
                payment={payment} 
                formatCurrency={formatCurrencyLocal} 
                formatDate={formatDate} 
                onRefresh={fetchPayments}
                isSelected={selectedPayment?.id === payment.id}
                onSelect={(p) => setSelectedPayment(prev => prev?.id === p.id ? null : p)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {payments.filter(p => p.status !== 'pending').length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <h3 className="font-semibold text-lg">Sin historial</h3>
                <p className="text-muted-foreground mt-1">Aquí aparecerán los pagos completados.</p>
              </CardContent>
            </Card>
          ) : (
            payments.filter(p => p.status !== 'pending').map(payment => (
              <PaymentCard 
                key={payment.id} 
                payment={payment} 
                formatCurrency={formatCurrencyLocal} 
                formatDate={formatDate} 
                onRefresh={fetchPayments}
                isSelected={false}
              />
            ))
          )}
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
              enrollments.map((enrollment) => (
                <button
                  key={enrollment.id}
                  onClick={() => handleSelectEnrollment(enrollment)}
                  className="w-full text-left p-4 rounded-xl border hover:border-emerald-500 hover:bg-emerald-50 transition-all group relative overflow-hidden"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
                      <Building2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground group-hover:text-emerald-700 transition-colors truncate">
                        {enrollment.team_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {enrollment.school_name} • {enrollment.sport}
                      </p>
                      {enrollment.price_monthly > 0 && (
                        <p className="text-xs font-medium text-emerald-600 mt-1">
                          Mensualidad: ${ (enrollment.price_monthly || 0).toLocaleString('es-CO') }
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
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
          amount={selectedEnrollment.price_monthly}
          concept={`Pago mensualidad - ${selectedEnrollment.team_name}`}
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
          branchId={selectedPayment.branch_id}
          amount={selectedPayment.amount}
          concept={selectedPayment.team_name || selectedPayment.concept || 'Pago mensualidad'}
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
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">Pago seleccionado</span>
            <span className="font-bold text-lg">{formatCurrencyLocal(selectedPayment.amount)}</span>
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

    </div>
  );
}

function PaymentCard({ 
  payment, 
  formatCurrency, 
  formatDate, 
  onRefresh, 
  onSelect,
  isSelected
}: {
  payment: Payment;
  formatCurrency: (val: number) => string;
  formatDate: (dateStr: string) => string;
  onRefresh: () => void;
  onSelect?: (payment: Payment) => void;
  isSelected: boolean;
}) {
  const config = statusConfig[payment.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Card 
      className={`transition-all overflow-hidden ${
        onSelect ? 'cursor-pointer' : ''
      } ${
        isSelected 
          ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20' 
          : onSelect ? 'border-border hover:border-primary/30' : 'border-border'
      }`}
      onClick={() => onSelect?.(payment)}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 w-full">
            
            <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0 ${config.color.split(' ')[0]}`}>
              <StatusIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${config.color.split(' ')[1]}`} />
            </div>
            
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-sm font-medium leading-none truncate pr-2">
                {payment.team_name || 'Servicio deportivo'}
              </p>
              
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <p className="font-bold text-base sm:text-lg text-foreground">
                  {formatCurrency(payment.amount)}
                </p>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border-none bg-background/50 ${config.color}`}>
                  {config.label}
                </Badge>
              </div>
              
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-muted-foreground pt-1">
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
                  <span className="flex items-center gap-1 truncate max-w-[150px]">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{payment.school_name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center pl-8 sm:pl-0">
            {payment.receipt_url && (
              <Button variant="outline" size="sm" className="h-8 text-xs bg-background" onClick={(e) => e.stopPropagation()} asChild>
                <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Comprobante</span>
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


