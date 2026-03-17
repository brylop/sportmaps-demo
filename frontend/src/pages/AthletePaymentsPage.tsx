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

interface Payment {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_provider: string | null;
  receipt_url: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  program_name?: string;
  school_name?: string;
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

  // New Selection State
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [showMultiAbonoModal, setShowMultiAbonoModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPayments();
      setSelectedPaymentIds([]); // Clear selection on tab change
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

  const togglePaymentSelection = (id: string) => {
    setSelectedPaymentIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const allPendingSelected = pendingPayments.length > 0 && selectedPaymentIds.length === pendingPayments.length;
  
  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedPaymentIds([]);
    } else {
      setSelectedPaymentIds(pendingPayments.map(p => p.id));
    }
  };

  const selectedTotalCents = payments
    .filter(p => selectedPaymentIds.includes(p.id))
    .reduce((sum, p) => sum + p.amount_cents, 0);

  const pendingPaymentsCount = summary?.count_pending || 0;
  const historyPaymentsCount = summary?.count_approved || 0;
  const rawPending = summary?.pending_cents || 0;
  const totalPending = (isNaN(rawPending) ? 0 : rawPending) / 100;
  const totalApprovedCount = summary?.count_approved || 0;

  const formatCurrencyLocal = (cents: number) =>
    `$${Math.round(cents / 100).toLocaleString('es-CO')}`;

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
          {pendingPayments.length > 0 && (
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleSelectAll}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${allPendingSelected ? 'bg-primary border-primary' : 'border-input hover:border-primary'}`}
                >
                  {allPendingSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                </button>
                <span className="text-sm font-medium cursor-pointer" onClick={toggleSelectAll}>Seleccionar todos</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedPaymentIds.length} seleccionados
              </span>
            </div>
          )}

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
                isSelected={selectedPaymentIds.includes(payment.id)}
                onToggleSelect={() => togglePaymentSelection(payment.id)}
                isSelectable={true}
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
                isSelectable={false}
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
                        {enrollment.program_name}
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
          programId={selectedEnrollment.program_id || undefined}
          teamId={selectedEnrollment.team_id || undefined}
          amount={selectedEnrollment.price_monthly}
          concept={`Pago mensualidad - ${selectedEnrollment.program_name}`}
          mode="create"
          onSuccess={() => {
            fetchPayments();
            setShowPaymentModal(false);
            setSelectedEnrollment(null);
          }}
        />
      )}

      {/* Floating Action Bar */}
      {selectedPaymentIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-slate-800 text-slate-200 hover:bg-slate-800 border-none">
              {selectedPaymentIds.length} seleccionados
            </Badge>
            <div className="hidden sm:block">
              <span className="text-slate-400 text-sm">Total: </span>
              <span className="font-bold">{formatCurrencyLocal(selectedTotalCents)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              className="text-slate-300 hover:text-white hover:bg-slate-800 px-3"
              onClick={() => setSelectedPaymentIds([])}
            >
              Cancelar
            </Button>
            <Button 
              className="bg-emerald-500 hover:bg-emerald-600 border-none text-white px-6 w-full sm:w-auto"
              onClick={() => setShowMultiAbonoModal(true)}
            >
              Abonar {formatCurrencyLocal(selectedTotalCents)}
            </Button>
          </div>
        </div>
      )}

      {/* Multi-Payment Summary Abono Modal */}
      {showMultiAbonoModal && (
        <PaymentAbonarModal
          open={showMultiAbonoModal}
          onOpenChange={setShowMultiAbonoModal}
          selectedPayments={payments.filter(p => selectedPaymentIds.includes(p.id))}
          formatCurrency={formatCurrencyLocal}
          onSuccess={() => {
            setShowMultiAbonoModal(false);
            setSelectedPaymentIds([]);
            fetchPayments();
          }}
        />
      )}

    </div>
  );
}

function PaymentCard({ 
  payment, 
  formatCurrency, 
  formatDate, 
  onRefresh, 
  isSelected = false, 
  onToggleSelect,
  isSelectable = false
}: {
  payment: Payment;
  formatCurrency: (cents: number) => string;
  formatDate: (dateStr: string) => string;
  onRefresh: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  isSelectable?: boolean;
}) {
  const config = statusConfig[payment.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  const handleClick = () => {
    if (isSelectable && onToggleSelect) {
      onToggleSelect();
    }
  };

  return (
    <Card 
      className={`transition-all overflow-hidden ${isSelectable ? 'cursor-pointer hover:border-primary/50' : ''} ${isSelected ? 'border-primary bg-primary/5' : ''}`}
      onClick={handleClick}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 w-full">
            {isSelectable && (
              <div 
                className={`w-5 h-5 mt-1 sm:mt-0 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-input hover:border-primary'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleSelect) onToggleSelect();
                }}
              >
                {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
              </div>
            )}
            
            <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0 ${config.color.split(' ')[0]}`}>
              <StatusIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${config.color.split(' ')[1]}`} />
            </div>
            
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-sm font-medium leading-none truncate pr-2">
                {payment.program_name || 'Servicio deportivo'}
              </p>
              
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <p className="font-bold text-base sm:text-lg text-foreground">
                  {formatCurrency(payment.amount_cents)}
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
                {payment.paid_at && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Pagado: {formatDate(payment.paid_at)}
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

function PaymentAbonarModal({ open, onOpenChange, selectedPayments, formatCurrency, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPayments: Payment[];
  formatCurrency: (cents: number) => string;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // State for each payment form
  const [paymentForms, setPaymentForms] = useState<Record<string, {
    amount: string; // Stored as COP string
    method: string;
    receiptUrl: string;
    receiptDate: string;
    notes: string;
  }>>({});

  // Initialize forms when component mounts or selectedPayments changes
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const initialForms: Record<string, any> = {};
    
    selectedPayments.forEach(p => {
      initialForms[p.id] = {
        amount: Math.round(p.amount_cents / 100).toString(),
        method: 'transfer',
        receiptUrl: '',
        receiptDate: today,
        notes: ''
      };
    });
    
    setPaymentForms(initialForms);
  }, [selectedPayments]);

  const handleUpdateForm = (id: string, field: string, value: string) => {
    setPaymentForms(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleBatchSubmit = async () => {
    try {
      setLoading(true);
      
      // Validate all forms first
      const promises = selectedPayments.map(payment => {
        const form = paymentForms[payment.id];
        const amountCents = parseFloat(form.amount) * 100;
        
        if (isNaN(amountCents) || amountCents <= 0 || amountCents > payment.amount_cents) {
          throw new Error(`Monto inválido para el pago: ${payment.program_name || 'Desconocido'}`);
        }
        
        return submitAthleteInstallment({
          athletePaymentId: payment.id,
          amountCents: amountCents,
          receiptUrl: form.receiptUrl || 'https://placeholder.com/receipt', // Allow empty for manual reporting or placeholder
          receiptDate: form.receiptDate,
          paymentMethod: form.method,
          notes: form.notes
        });
      });

      await Promise.all(promises);

      toast({
        title: '¡Abonos enviados!',
        description: `Se han registrado ${selectedPayments.length} abonos exitosamente.`,
      });
      onSuccess();
    } catch (err: any) {
      console.error('Error submitting installments:', err);
      toast({
        title: 'Error de validación',
        description: err.message || 'Ocurrió un error al procesar los pagos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const totalOriginalCents = selectedPayments.reduce((sum, p) => sum + p.amount_cents, 0);
  const totalToPayCents = selectedPayments.reduce((sum, p) => {
    const val = parseFloat(paymentForms[p.id]?.amount || '0') * 100;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  
  const progressPct = Math.min(100, (totalToPayCents / totalOriginalCents) * 100) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="p-6 pb-2 border-b">
          <DialogHeader>
            <DialogTitle>Registrar Abonos ({selectedPayments.length})</DialogTitle>
            <DialogDescription>
              Completa la información de pago para las cuotas seleccionadas.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 p-4 bg-muted/50 rounded-xl space-y-2 border">
            <div className="flex justify-between text-sm font-medium">
              <span>Total a reportar:</span>
              <span className="text-primary font-bold">{formatCurrency(totalToPayCents)}</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Abonando {progressPct.toFixed(0)}%</span>
              <span>Deuda total: {formatCurrency(totalOriginalCents)}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
          {selectedPayments.map((payment, index) => {
            const form = paymentForms[payment.id] || { amount: '', method: 'transfer', receiptUrl: '', receiptDate: '', notes: '' };
            const maxAmountCop = Math.round(payment.amount_cents / 100);
            
            return (
              <div key={payment.id} className="relative">
                {index > 0 && <div className="absolute -top-3 left-0 right-0 h-px bg-border" />}
                
                <div className="flex items-center justify-between mb-3 mt-1">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <span className="bg-primary/10 text-primary w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                      {index + 1}
                    </span>
                    {payment.program_name || `Cuota #${payment.id.slice(0,4)}`}
                  </h4>
                  <Badge variant="outline" className="text-[10px]">
                    Deuda: {formatCurrency(payment.amount_cents)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Monto a pagar (COP)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                      <Input 
                        type="number" 
                        className="pl-7 h-9 text-sm" 
                        value={form.amount} 
                        onChange={(e) => handleUpdateForm(payment.id, 'amount', e.target.value)} 
                        max={maxAmountCop}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Método de Pago</Label>
                    <Select value={form.method} onValueChange={(v) => handleUpdateForm(payment.id, 'method', v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transfer">Transf. Bancaria</SelectItem>
                        <SelectItem value="pse">PSE / Tarjeta</SelectItem>
                        <SelectItem value="nequi">Nequi</SelectItem>
                        <SelectItem value="daviplata">Daviplata</SelectItem>
                        <SelectItem value="cash">Efectivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs">Comprobante de Pago</Label>
                    <FileUpload
                      bucket="payment-receipts"
                      path={`athletes/${user?.id}`}
                      accept="image/*,application/pdf"
                      onUploadComplete={(url) => handleUpdateForm(payment.id, 'receiptUrl', url)}
                      validateReceipt={true}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Fecha del pago</Label>
                    <Input 
                      type="date" 
                      className="h-9 text-sm"
                      value={form.receiptDate} 
                      onChange={(e) => handleUpdateForm(payment.id, 'receiptDate', e.target.value)} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Notas (Opcional)</Label>
                    <Input 
                      placeholder="Ej: Transferencia Banco X..." 
                      className="h-9 text-sm"
                      value={form.notes} 
                      onChange={(e) => handleUpdateForm(payment.id, 'notes', e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 pt-4 border-t bg-muted/20">
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 min-w-[150px]" 
              onClick={handleBatchSubmit} 
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {loading ? 'Procesando...' : 'Confirmar Pagos'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
