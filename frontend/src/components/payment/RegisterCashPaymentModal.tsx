import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Banknote, Building2, Wallet, Landmark, Calendar as CalendarIcon, User, FileText, CheckCircle2, Paperclip, AlertTriangle } from 'lucide-react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useToast } from '@/hooks/use-toast';
import { emailClient } from '@/lib/email-client';
import { formatCurrency, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileUpload } from '@/components/common/FileUpload';
import type { ReceiptValidationResult } from '@/hooks/useReceiptValidator';
import { buildReceiptOcrFields, isDuplicateReceiptError } from '@/lib/receiptOcrFields';

interface RegisterCashPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RegisterCashPaymentModal({ open, onOpenChange, onSuccess }: RegisterCashPaymentModalProps) {
  const { user } = useAuth();
  const { schoolId, schoolName } = useSchoolContext();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Form state
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('new');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [concept, setConcept] = useState('Mensualidad');
  const [amount, setAmount] = useState<number | ''>(0);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());

  // Soporte de la transferencia (comprobante que la familia envio por WhatsApp).
  // Solo aplica a paymentMethod === 'transfer'; opcional, porque la escuela
  // tambien concilia contra el extracto bancario sin tener la imagen.
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<ReceiptValidationResult | null>(null);
  // Key para remontar el FileUpload y limpiar su estado interno al quitar el soporte.
  const [uploadKey, setUploadKey] = useState(0);

  // Athlete search state
  const [athletePopoverOpen, setAthletePopoverOpen] = useState(false);
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');

  const filteredAthletes = athletes.filter(ath => {
    const term = athleteSearchQuery.toLowerCase();
    const fullName = (ath.full_name || '').toLowerCase();
    const parentName = (ath.parent_name || '').toLowerCase();
    return fullName.includes(term) || parentName.includes(term);
  });

  useEffect(() => {
    if (open && schoolId) {
      fetchAthletes();
    }
  }, [open, schoolId]);

  useEffect(() => {
    if (selectedAthleteId) {
      fetchPendingPayments(selectedAthleteId);
    } else {
      setPendingPayments([]);
      setSelectedPaymentId('new');
    }
  }, [selectedAthleteId]);

  const fetchAthletes = async () => {
    setLoadingAthletes(true);
    try {
      const { data, error } = await supabase
        .from('school_athletes')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      if (error) throw error;
      setAthletes(data || []);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error al cargar deportistas', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAthletes(false);
    }
  };

  const fetchPendingPayments = async (athleteId: string) => {
    const student = athletes.find(a => a.id === athleteId);
    if (!student || !schoolId) return;

    setLoadingPending(true);
    setSelectedPaymentId('new');
    try {
      const hasUserId = !!student.user_id;
      const hasParent = !!student.parent_id;
      const userId         = hasUserId ? student.user_id : null;
      const childId        = (!hasUserId && hasParent) ? student.id : null;
      const unregisteredId = (!hasUserId && !hasParent) ? student.id : null;

      let q = supabase
        .from('payments')
        .select('id, concept, amount, due_date, status')
        .eq('school_id', schoolId)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true });

      if (userId)              q = q.eq('user_id', userId);
      else if (childId)        q = q.eq('child_id', childId);
      else if (unregisteredId) q = q.eq('unregistered_athlete_id', unregisteredId);

      const { data, error } = await q;
      if (error) throw error;
      setPendingPayments(data || []);
    } catch (err: any) {
      console.error(err);
      setPendingPayments([]);
    } finally {
      setLoadingPending(false);
    }
  };

  const clearReceipt = () => {
    setReceiptUrl(null);
    setOcrResult(null);
    setUploadKey(k => k + 1);
  };

  // Razones del veredicto que ameritan avisar al admin (duplicado, destino que no
  // coincide, fecha fuera de ventana...). NO bloquean: el admin ya vio la plata.
  const verdictWarnings: string[] = (() => {
    if (!ocrResult?.verdict || ocrResult.verdict === 'verde') return [];
    const reasons = Array.isArray(ocrResult.verdictReasons) ? ocrResult.verdictReasons : [];
    return reasons
      .map(r => (r as { message?: string })?.message)
      .filter((m): m is string => typeof m === 'string' && m.length > 0);
  })();

  const handlePendingSelect = (value: string) => {
    setSelectedPaymentId(value);
    if (value === 'new') return;
    const pmt = pendingPayments.find(p => p.id === value);
    if (pmt) {
      setConcept(pmt.concept);
      setAmount(Number(pmt.amount) || 0);
    }
  };

  const handleSave = async () => {
    const numericAmount = typeof amount === 'number' ? amount : 0;
    if (!selectedAthleteId || !concept || numericAmount <= 0) {
      toast({ title: 'Datos incompletos', description: 'Por favor completa todos los campos requeridos.', variant: 'destructive' });
      return;
    }

    const selectedStudent = athletes.find(a => a.id === selectedAthleteId);
    if (!selectedStudent || !schoolId || !user) return;

    setLoading(true);
    try {
      const prefix = paymentMethod === 'cash' ? 'CASH' : 'TRF';
      const reference = `${prefix}-${Date.now().toString(36).toUpperCase()}`;

      // Comprobante: solo se adjunta en transferencia. Los campos ocr_*/receipt_*
      // alimentan los indices de dedup (uq_payments_school_ocr_reference y
      // uq_payments_school_receipt_hash), asi que registrar dos veces el mismo
      // soporte de WhatsApp revienta con 23505 en vez de duplicar el ingreso.
      const receiptFields = paymentMethod === 'transfer' && receiptUrl
        ? { receipt_url: receiptUrl, ...buildReceiptOcrFields(ocrResult) }
        : {};

      // Resolve correct IDs from the school_athletes view.
      // Payments are created with exactly ONE of these three fields:
      //   Flujo A (menores)      → child_id   (user_id null, parent_id null in view)
      //   Flujo B (adultos)      → user_id    (user_id set in view)
      //   Flujo C (sin cuenta)   → unregistered_athlete_id (user_id null, parent_id null)
      const hasUserId  = !!selectedStudent.user_id;
      const hasParent  = !!selectedStudent.parent_id;

      const userId           = hasUserId ? selectedStudent.user_id : null;
      const childId          = (!hasUserId && hasParent) ? selectedStudent.id : null;
      const unregisteredId   = (!hasUserId && !hasParent) ? selectedStudent.id : null;

      // Apply only to the selected pending payment, or create a new one.
      if (selectedPaymentId !== 'new') {
        // ✅ Guard: no aprobar pagos bloqueados por revisión
        const { data: existingPaymentData } = await supabase
          .from('payments' as any)
          .select('requires_review')
          .eq('id', selectedPaymentId)
          .single();

        const existingPayment = existingPaymentData as any;

        if (existingPayment?.requires_review) {
          toast({
            title: 'Pago bloqueado',
            description: 'Este pago está en revisión y no puede procesarse.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'paid',
            concept,
            amount: numericAmount,
            payment_method: paymentMethod === 'cash' ? 'cash' : 'transfer',
            payment_channel: paymentMethod === 'cash' ? 'cash' : 'transfer',
            payment_date: paymentDate.toISOString().split('T')[0],
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            reference,
            amount_paid: numericAmount,
            ...receiptFields,
          } as any)
          .eq('id', selectedPaymentId);

        if (updateError) throw updateError;
      } else {
        // No pending payment found — create a new one
        const { error: insertError } = await supabase.from('payments').insert({
          school_id: schoolId,
          child_id: childId,
          user_id: userId,
          unregistered_athlete_id: unregisteredId,
          parent_id: selectedStudent.parent_id || null,
          amount: numericAmount,
          concept,
          status: 'paid',
          payment_method: paymentMethod === 'cash' ? 'cash' : 'transfer',
          payment_channel: paymentMethod === 'cash' ? 'cash' : 'transfer',
          payment_type: 'one_time',
          payment_date: paymentDate.toISOString().split('T')[0],
          due_date: paymentDate.toISOString().split('T')[0],
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          reference,
          amount_paid: numericAmount,
          ...receiptFields,
        } as any);

        if (insertError) throw insertError;
      }

      // Notificar al padre o al atleta (si tienen cuenta)
      const recipientId = selectedStudent.parent_id || userId;
      if (recipientId) {
        await supabase.rpc('notify_user', {
          p_user_id: recipientId,
          p_title: paymentMethod === 'cash' ? '✅ Pago en efectivo registrado' : '✅ Transferencia registrada',
          p_message: `${schoolName || 'La escuela'} registró tu pago de ${formatCurrency(numericAmount)} por ${concept}.`,
          p_type: 'success',
          p_link: '/my-payments'
        });
      }

      // Enviar correo de confirmación silencioso
      if (selectedStudent.parent_email) {
        emailClient.send({
          type: 'payment_confirmation',
          to: selectedStudent.parent_email,
          data: { 
            userName: selectedStudent.parent_name || 'Padre de familia',
            schoolName: schoolName || 'La escuela',
            amount: formatCurrency(numericAmount), 
            concept, 
            reference
          }
        }).catch(() => {}); // Fire and forget
      }

      const methodLabel = paymentMethod === 'cash' ? 'en efectivo' : 'por transferencia';
      toast({ title: 'Cobro Registrado', description: `El pago ${methodLabel} se ha registrado exitosamente.` });
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      if (isDuplicateReceiptError(err)) {
        toast({
          title: 'Comprobante ya registrado',
          description: 'Este soporte ya está vinculado a otro pago de la escuela. Revísalo en Validación de Cobros antes de volver a registrarlo.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Error al reportar', description: err.message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedAthleteId('');
    setSelectedPaymentId('new');
    setPendingPayments([]);
    setPaymentMethod('cash');
    setConcept('Mensualidad');
    setAmount(0);
    setPaymentDate(new Date());
    setAthleteSearchQuery('');
    setAthletePopoverOpen(false);
    clearReceipt();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) resetForm();
    }}>
      <DialogContent className="sm:max-w-[480px] w-[95vw] p-0 overflow-hidden border-primary/20 bg-background/95 backdrop-blur-xl shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-8 pb-4 border-b bg-primary/5 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight">Registrar pago manual</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground font-medium">
            Registra transacciones de efectivo o transferencias de forma inmediata.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5" /> Método de pago
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 group",
                  paymentMethod === 'cash' 
                    ? "bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10" 
                    : "bg-muted/20 border-border/40 hover:border-border/80"
                )}
                onClick={() => {
                  setPaymentMethod('cash');
                  // El soporte solo aplica a transferencia: descartarlo evita
                  // guardar un receipt_url en un pago marcado como efectivo.
                  clearReceipt();
                }}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-colors",
                  paymentMethod === 'cash' ? "bg-emerald-500 text-white" : "bg-muted/40 text-muted-foreground group-hover:bg-muted"
                )}>
                  <Banknote className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-xs font-black uppercase tracking-widest",
                  paymentMethod === 'cash' ? "text-emerald-500" : "text-muted-foreground"
                )}>Efectivo</span>
              </button>

              <button
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 group",
                  paymentMethod === 'transfer' 
                    ? "bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10" 
                    : "bg-muted/20 border-border/40 hover:border-border/80"
                )}
                onClick={() => setPaymentMethod('transfer')}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-colors",
                  paymentMethod === 'transfer' ? "bg-blue-500 text-white" : "bg-muted/40 text-muted-foreground group-hover:bg-muted"
                )}>
                  <Building2 className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-xs font-black uppercase tracking-widest",
                  paymentMethod === 'transfer' ? "text-blue-500" : "text-muted-foreground"
                )}>Transferencia</span>
              </button>
            </div>
          </div>

          {/* Soporte de la transferencia. Aca el comprobante YA le llego a la escuela
              (tipicamente por WhatsApp, dias antes), asi que dateMode='any': no se
              valida la fecha, solo se adjunta como evidencia. La ventana de fechas
              aplica al flujo del acudiente, no a este. El veredicto del BFF igual
              avisa si algo no cuadra, y el dedup por referencia/hash sigue vivo. */}
          {paymentMethod === 'transfer' && (
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Paperclip className="h-3.5 w-3.5" /> Soporte de la transferencia
                <span className="font-bold normal-case tracking-normal text-[10px] text-muted-foreground/70">(opcional)</span>
              </Label>

              {receiptUrl ? (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-bold text-blue-500">
                      <CheckCircle2 className="h-4 w-4 shrink-0" /> Soporte adjunto
                    </span>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearReceipt}>
                      Quitar
                    </Button>
                  </div>

                  {/* Sugerencias del OCR: el admin decide si las aplica al formulario. */}
                  {(ocrResult?.extractedAmount != null || ocrResult?.extractedDate) && (
                    <div className="flex flex-wrap gap-2">
                      {ocrResult?.extractedAmount != null && ocrResult.extractedAmount !== amount && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs rounded-lg"
                          onClick={() => setAmount(ocrResult.extractedAmount as number)}
                        >
                          Usar monto {formatCurrency(ocrResult.extractedAmount)}
                        </Button>
                      )}
                      {ocrResult?.extractedDate && ocrResult.extractedDate !== format(paymentDate, 'yyyy-MM-dd') && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs rounded-lg"
                          onClick={() => setPaymentDate(new Date(`${ocrResult.extractedDate}T00:00:00`))}
                        >
                          Usar fecha {ocrResult.extractedDate}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Avisos del motor de reglas. Informativos: el admin ya confirmo el ingreso. */}
                  {verdictWarnings.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                      <div className="space-y-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                        <p className="font-bold">Revisa antes de confirmar:</p>
                        {verdictWarnings.map((msg, i) => <p key={i}>{msg}</p>)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <FileUpload
                  key={uploadKey}
                  bucket="payment-receipts"
                  accept="image/*,application/pdf"
                  validateReceipt
                  dateMode="any"
                  schoolId={schoolId || undefined}
                  expectedAmount={typeof amount === 'number' && amount > 0 ? amount : undefined}
                  paymentId={selectedPaymentId !== 'new' ? selectedPaymentId : undefined}
                  onUploadComplete={(url) => setReceiptUrl(url)}
                  onValidationResult={(r) => setOcrResult(r)}
                />
              )}
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="student" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Deportista / Atleta
            </Label>
            <Popover open={athletePopoverOpen} onOpenChange={setAthletePopoverOpen}>
              <PopoverTrigger asChild disabled={loadingAthletes}>
                <Button
                  id="student"
                  variant="outline"
                  role="combobox"
                  aria-expanded={athletePopoverOpen}
                  className="w-full h-12 justify-between bg-background/50 border-border/40 rounded-xl font-bold px-4 py-2 hover:bg-background/80 text-left"
                >
                  <span className="truncate">
                    {selectedAthleteId 
                      ? athletes.find((a) => a.id === selectedAthleteId)?.full_name || 'Selecciona a quién aplica'
                      : 'Selecciona a quién aplica'
                    }
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">▼</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 rounded-xl bg-background/95 backdrop-blur-md border-border/40 shadow-2xl" align="start">
                <div className="p-1 mb-2">
                  <Input
                    placeholder="Buscar deportista..."
                    value={athleteSearchQuery}
                    onChange={(e) => setAthleteSearchQuery(e.target.value)}
                    className="h-10 bg-muted/40 rounded-lg text-sm focus-visible:ring-primary/20"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-0.5">
                  {filteredAthletes.length === 0 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">No se encontraron deportistas.</p>
                  ) : (
                    filteredAthletes.map((ath) => (
                      <button
                        key={ath.id}
                        type="button"
                        onClick={() => {
                          setSelectedAthleteId(ath.id);
                          setAthletePopoverOpen(false);
                          setAthleteSearchQuery('');
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted/60 transition-colors flex flex-col justify-center",
                          selectedAthleteId === ath.id && "bg-primary/10 text-primary font-bold hover:bg-primary/20"
                        )}
                      >
                        <span className="font-semibold">{ath.full_name}</span>
                        {ath.parent_name && (
                          <span className="text-[10px] text-muted-foreground">Padre: {ath.parent_name}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {selectedAthleteId && (
            <div className="space-y-3">
              <Label htmlFor="pending-payment" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Aplicar a
              </Label>
              <Select value={selectedPaymentId} onValueChange={handlePendingSelect} disabled={loadingPending}>
                <SelectTrigger id="pending-payment" className="h-12 bg-background/50 border-border/40 rounded-xl font-bold">
                  <SelectValue placeholder={loadingPending ? 'Cargando...' : 'Selecciona un pago pendiente'} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/40 bg-background/95 backdrop-blur-md">
                  <SelectItem value="new" className="rounded-lg py-2.5">
                    Nuevo cobro (sin asociar)
                  </SelectItem>
                  {pendingPayments.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="rounded-lg py-2.5">
                      {p.concept} — {formatCurrency(Number(p.amount) || 0)} · Vence {format(new Date(p.due_date), 'd MMM yyyy', { locale: es })}
                      {p.status === 'overdue' ? ' (atrasado)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="concept" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Concepto de pago
            </Label>
            <Input 
              id="concept" 
              placeholder="Ej. Mensualidad Mayo..." 
              value={concept} 
              onChange={(e) => setConcept(e.target.value)} 
              className="h-12 bg-background/50 border-border/40 rounded-xl font-medium focus-visible:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Landmark className="h-3.5 w-3.5" /> Monto ($ COP)
              </Label>
              <NumberStepper 
                value={amount}
                onChange={setAmount}
                step={10000}
                min={0}
                unit="COP"
                className="h-12"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="date" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" /> Fecha del pago
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full h-12 justify-start text-left font-medium bg-background/50 border-border/40 rounded-xl",
                      !paymentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                    {paymentDate ? format(paymentDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl overflow-hidden border-border/30 shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={(date) => date && setPaymentDate(date)}
                    initialFocus
                    locale={es}
                    className="bg-background/95 backdrop-blur-md"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button 
            className={cn(
              "w-full h-14 mt-4 font-black uppercase tracking-widest text-sm shadow-xl transition-all gap-3",
              paymentMethod === 'cash' 
                ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" 
                : "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20"
            )}
            disabled={loading} 
            onClick={handleSave}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            {loading ? 'Registrando...' : 'Confirmar Registro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
