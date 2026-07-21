import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Building2, Smartphone, Loader2, CheckCircle2, XCircle, Info, Clock, AlertTriangle, Globe, Download, Maximize2, Percent } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

import { FileUpload } from '@/components/common/FileUpload';
import type { ReceiptValidationResult } from '@/hooks/useReceiptValidator';
import { calcEarlyPaymentDiscount, hasEarlierUnpaidPayment, type EarlyPaymentDiscountConfig } from '@/lib/earlyPaymentDiscount';

/** Intenta parsear un string como JSON; devuelve null si no es JSON valido. */
function safeParseJson(s: string): unknown | null {
  try { return JSON.parse(s); } catch { return null; }
}
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BillingDetailsForm } from '@/components/billing/BillingDetailsForm';
import { emailClient } from '@/lib/email-client';
import { getPaymentPayload, SchoolAthlete } from '@/lib/athleteUtils';
import { PaymentConfirmModal } from '@/components/payment/PaymentConfirmModal';
import { useWompiCheckout } from '@/hooks/useWompiCheckout';
import MercadoPagoBrick from '@/components/checkout/MercadoPagoBrick';
import type { MpCreatePaymentResult } from '@/lib/api/mercadopago';
import { autoEvaluate as autoEvaluateGlosa } from '@/lib/api/glosas';
import {
  useNextUnpaidPeriod,
  fetchPeriodStatus,
  isPeriodActive,
  type PeriodStatus,
} from '@/hooks/usePaymentPeriod';

interface PaymentCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  schoolId: string;
  paymentId?: string;
  teamId?: string;
  childId?: string;
  childName?: string;
  branchId?: string;
  amount: number;
  concept: string;
  mode?: 'create' | 'update';
  onSuccess?: () => void;
}

export function PaymentCheckoutModal({
  open, onOpenChange, studentId, schoolId, paymentId, teamId, childId, childName, branchId, amount, concept, mode = 'update', onSuccess
}: PaymentCheckoutModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'pse' | 'card' | 'transfer' | 'online' | 'mercadopago' | null>(null);
  const [mpReference, setMpReference] = useState<string>('');
  const [showOnlineConfirm, setShowOnlineConfirm] = useState(false);
  const [wompiEnabled, setWompiEnabled] = useState(false);
  const [onlineFeePct, setOnlineFeePct] = useState(3);
  const [allowInstallments, setAllowInstallments] = useState(false);
  const [minInstallmentAmount, setMinInstallmentAmount] = useState(0);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  // Resultado del OCR del comprobante manual. Se persiste en el pago para que
  // el admin vea el monto detectado y la alerta de discrepancia en Cobros por
  // Aprobar (igual que el flujo QR / ParentCheckoutPage).
  const [ocrResult, setOcrResult] = useState<ReceiptValidationResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'awaiting_approval'>('idle');

  // Custom Payment Fields
  const [conceptType, setConceptType] = useState<'mensualidad' | 'inscripcion_fija' | 'inscripcion_variable' | 'otro'>('mensualidad');
  const [customAmount, setCustomAmount] = useState((amount || 0).toString());
  const [customConcept, setCustomConcept] = useState('');

  const [checkingPending, setCheckingPending] = useState(false);
  const [pendingPaymentDate, setPendingPaymentDate] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hasCompleteDianData, setHasCompleteDianData] = useState<boolean>(true);
  const [checkingDian, setCheckingDian] = useState<boolean>(true);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [showFullQr, setShowFullQr] = useState(false);

  const [discountConfig, setDiscountConfig] = useState<EarlyPaymentDiscountConfig>({ enabled: false, days: 5, percentage: 0 });
  const [paymentCreatedAt, setPaymentCreatedAt] = useState<string | null>(null);
  const [alreadyAppliedDiscount, setAlreadyAppliedDiscount] = useState<number | null>(null);
  const [hasEarlierUnpaid, setHasEarlierUnpaid] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'update' && paymentId) {
      supabase.from('payments')
        .select('created_at, early_payment_discount_applied, child_id, parent_id')
        .eq('id', paymentId).maybeSingle()
        .then(async ({ data }) => {
          if (!data) return;
          setPaymentCreatedAt(data.created_at);
          setAlreadyAppliedDiscount(data.early_payment_discount_applied ?? null);
          const unpaid = await hasEarlierUnpaidPayment(supabase, {
            schoolId, childId: data.child_id, parentId: data.parent_id,
            excludePaymentId: paymentId, beforeCreatedAt: data.created_at,
          });
          setHasEarlierUnpaid(unpaid);
        });
    } else {
      // mode='create': el pago nace ahora mismo — dia 0 de la ventana.
      const now = new Date().toISOString();
      setPaymentCreatedAt(now);
      setAlreadyAppliedDiscount(null);
      if (childId) {
        hasEarlierUnpaidPayment(supabase, { schoolId, childId, beforeCreatedAt: now }).then(setHasEarlierUnpaid);
      }
    }
  }, [open, mode, paymentId, schoolId, childId]);

  // ── Periodo (mes/año) que cubre este pago ────────────────────────────────
  // Calculado por la RPC `next_unpaid_period`. Se usa para marcar el pago
  // con period_year/period_month y para preguntar al padre si quiere
  // adelantar cuando el mes sugerido ya esta cubierto.
  const { period: nextPeriod } = useNextUnpaidPeriod(
    open && conceptType === 'mensualidad' ? childId ?? null : null,
  );
  const [advancedPeriod, setAdvancedPeriod] = useState<{ year: number; month: number; label: string } | null>(null);
  const [confirmAdvanceOpen, setConfirmAdvanceOpen] = useState(false);

  // Periodo efectivo que se va a cobrar (posiblemente adelantado).
  const effectivePeriod = advancedPeriod ?? (nextPeriod
    ? { year: nextPeriod.year, month: nextPeriod.month, label: nextPeriod.label }
    : null);

  useEffect(() => {
    if (open && schoolId) {
      supabase.from('school_settings')
        .select('bank_name, bank_account_type, bank_account_number, nequi_number, daviplata_number, bank_titular_name, bank_titular_id, payment_qr_url, wompi_enabled, online_fee_pct, allow_installments, min_installment_amount, early_payment_discount_enabled, early_payment_discount_days, early_payment_discount_percentage')
        .eq('school_id', schoolId).single()
        .then(({ data }) => {
          setBankDetails(data);
          setWompiEnabled(!!(data as any)?.wompi_enabled);
          setOnlineFeePct(Number((data as any)?.online_fee_pct ?? 3));
          setAllowInstallments(!!(data as any)?.allow_installments);
          setMinInstallmentAmount(Number((data as any)?.min_installment_amount) || 0);
          setDiscountConfig({
            enabled: !!(data as any)?.early_payment_discount_enabled,
            days: Number((data as any)?.early_payment_discount_days) || 5,
            percentage: Number((data as any)?.early_payment_discount_percentage) || 0,
          });
        });
    }
  }, [open, schoolId]);

  // ── Wompi checkout hook ──────────────────────────────────────────────────
  const finalAmount = mode === 'create' && !['mensualidad', 'inscripcion_fija'].includes(conceptType) ? (parseFloat(customAmount) || 0) : amount;
  const finalConcept = mode === 'create' && conceptType !== 'mensualidad'
    ? (conceptType.startsWith('inscripcion') ? 'Inscripción Anual' : customConcept || 'Pago / Abono')
    : (effectivePeriod ? `Mensualidad ${effectivePeriod.label}` : concept);

  const discountResult = paymentCreatedAt
    ? calcEarlyPaymentDiscount(finalAmount, {
      createdAt: paymentCreatedAt,
      config: discountConfig,
      hasEarlierUnpaid,
      alreadyAppliedAmount: alreadyAppliedDiscount,
    })
    : { eligible: false, discountAmount: 0, finalAmount, validUntil: null };

  const chargeAmount = discountResult.eligible ? discountResult.finalAmount : finalAmount;

  const sportmapsFee = Math.round(chargeAmount * (onlineFeePct / 100));
  const grossAmount = chargeAmount + sportmapsFee;

  const { startSchoolPayment, loading: wompiLoading } = useWompiCheckout({
    onSuccess: () => {
      toast({ title: '¡Pago iniciado!', description: 'Estamos verificando tu pago con Wompi.' });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: 'Error en el pago', description: err.message, variant: 'destructive' });
    },
    onClosed: () => {
      setShowOnlineConfirm(false);
    },
  });

  const openCheckout = async () => {
    let effectivePaymentId = paymentId;

    // En modo "create" todavia NO existe una fila en `payments` (a diferencia de
    // MercadoPago, que la inserta en handleMpSuccess). startSchoolPayment necesita
    // un paymentId para pedirle la sesion al BFF, asi que primero creamos un cobro
    // 'pending' con provider wompi. El estado real llega despues por el webhook.
    if (!effectivePaymentId) {
      try {
        const periodYear  = conceptType === 'mensualidad' && effectivePeriod ? effectivePeriod.year  : null;
        const periodMonth = conceptType === 'mensualidad' && effectivePeriod ? effectivePeriod.month : null;
        const reference = `SCH-WOMPI-${Date.now().toString(36).toUpperCase()}`;
        const { data: inserted, error: insertError } = await supabase.from('payments').insert({
          parent_id: user?.id,
          child_id: childId || null,
          team_id: (teamId && teamId !== '') ? teamId : null,
          school_id: (schoolId && schoolId !== '') ? schoolId : null,
          branch_id: branchId || null,
          amount: finalAmount,
          concept: finalConcept,
          status: 'pending',
          payment_method: 'online',
          payment_provider: 'wompi',
          provider_reference: reference,
          payment_type: 'one_time',
          due_date: new Date().toISOString().split('T')[0],
          period_year:  periodYear,
          period_month: periodMonth,
        } as any).select('id').single();
        if (insertError) throw insertError;
        effectivePaymentId = inserted?.id;
      } catch (err: any) {
        toast({ title: 'Error iniciando el pago', description: err?.message || 'No se pudo crear el cobro.', variant: 'destructive' });
        setShowOnlineConfirm(false);
        return;
      }
    }

    if (!effectivePaymentId) return;
    return startSchoolPayment({
      paymentId: effectivePaymentId,
      schoolId,
      studentName: childName,
    });
  };

  useEffect(() => {
    if (open && user?.id) {
      const checkProfile = async () => {
        setCheckingDian(true);
        const { data } = await supabase.from('profiles')
          .select('document_type, document_number, billing_address, billing_city_dane')
          .eq('id', user.id).single();
        setHasCompleteDianData(!!(data?.document_type && data?.document_number && data?.billing_address && data?.billing_city_dane));
        setCheckingDian(false);
      };
      checkProfile();
    }
  }, [open, user?.id]);

  // Guard legacy: bloquea si ya hay un pago `awaiting_approval`.
  // Para MENSUALIDADES con periodo conocido, este guard se delega al
  // flujo nuevo (next_unpaid_period + AlertDialog "¿adelantar siguiente mes?").
  // Asi el padre puede pagar Junio aunque Mayo este pendiente de validacion.
  // Para inscripcion / abono / otros conceptos, mantenemos el bloqueo total
  // porque no hay periodo y no podemos distinguir duplicados.
  useEffect(() => {
    if (!open || !studentId) return;
    if (conceptType === 'mensualidad') {
      setPendingPaymentDate(null);
      setCheckingPending(false);
      return;
    }
    const checkPendingPayment = async () => {
      setCheckingPending(true);
      setPendingPaymentDate(null);
      try {
        const effectiveChildId = childId || null;
        const idColumn = effectiveChildId ? 'child_id' : 'user_id';
        const idValue = effectiveChildId || studentId;

        let query = supabase.from('payments').select('id, payment_date, created_at')
          .eq(idColumn, idValue)
          .eq('status', 'awaiting_approval')
          .limit(1);

        if (mode === 'update' && paymentId) {
          query = query.neq('id', paymentId);
        }

        const { data, error } = await query;
        if (error) { console.error('[PaymentCheckoutModal]', error); return; }
        if (data && data.length > 0) {
          const rawDate = data[0].payment_date || data[0].created_at;
          setPendingPaymentDate(rawDate ? new Date(rawDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : null);
        }
      } finally {
        setCheckingPending(false);
      }
    };
    checkPendingPayment();
  }, [open, studentId, paymentId, mode, conceptType, childId]);

  useEffect(() => {
    if (!open) {
      setPaymentStatus('idle');
      setSelectedMethod(null);
      setProofUrl(null);
      setOcrResult(null);
      setPendingPaymentDate(null);
      setShowOnlineConfirm(false);
      setAdvancedPeriod(null);
      setConfirmAdvanceOpen(false);
      setMpReference('');
    }
  }, [open]);

  const mpEnabled = !!import.meta.env.VITE_MP_PUBLIC_KEY_DEFAULT;

  const paymentMethods = [
    // ── Pago online Wompi (solo si la escuela lo tiene habilitado) ────────
    ...(wompiEnabled ? [{
      id: 'online' as const,
      name: 'Pagar online (Wompi)',
      description: `Tarjeta, PSE o Nequi — inmediato y seguro`,
      icon: Globe,
      popular: true,
      enabled: true,
      badge: `+${formatCurrency(sportmapsFee)} fee`,
    }] : []),
    // ── MercadoPago (cuando la escuela / global tiene MP configurado) ─────
    ...(mpEnabled ? [{
      id: 'mercadopago' as const,
      name: 'MercadoPago',
      description: 'Tarjeta, PSE, Efecty o wallet MP',
      icon: CreditCard,
      popular: !wompiEnabled,
      enabled: true,
      badge: `+${formatCurrency(sportmapsFee)} fee`,
    }] : []),
    // ── Pago manual (siempre disponible) ──────────────────────────────────
    { id: 'transfer' as const, name: 'Transferencia / Nequi / Daviplata', description: 'Nequi, Daviplata o transferencia bancaria', icon: Smartphone, popular: !wompiEnabled && !mpEnabled, enabled: true },
  ];

  // Generar reference MP una sola vez cuando MP esta habilitado para esta
  // sesion del modal. NO regenera al cambiar de metodo (sino el Brick perderia
  // datos cada vez que el usuario regresa a MP). Se limpia al cerrar el modal.
  useEffect(() => {
    if (mpEnabled && !mpReference) {
      const ref = `SCH-MP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      setMpReference(ref);
    }
  }, [mpEnabled, mpReference]);

  // Handler de éxito del Brick MP — actualiza/crea el payment row
  const handleMpSuccess = async (result: MpCreatePaymentResult) => {
    setProcessing(true);
    setPaymentStatus('processing');
    try {
      const periodYear = conceptType === 'mensualidad' && effectivePeriod ? effectivePeriod.year : null;
      const periodMonth = conceptType === 'mensualidad' && effectivePeriod ? effectivePeriod.month : null;
      const reference = mpReference || `SCH-MP-${Date.now().toString(36).toUpperCase()}`;
      // Mapeo de status MP → status interno SportMaps:
      //   approved → paid (caso ideal)
      //   pending  → pending (MP esta revisando antifraude; el webhook actualizara
      //              cuando MP confirme. NO va a 'awaiting_approval' porque eso es
      //              para comprobantes manuales que la escuela debe validar)
      //   rejected → declined
      const internalStatus =
        result.internalStatus === 'paid' ? 'paid'
          : result.internalStatus === 'rejected' ? 'declined'
            : 'pending';

      if (mode === 'update' && paymentId) {
        const { error: updateError } = await supabase.from('payments').update({
          status: internalStatus,
          payment_method: 'card',
          payment_provider: 'mercadopago',
          provider_reference: reference,
          provider_transaction_id: String(result.paymentId),
          payment_date: new Date().toISOString().split('T')[0],
          receipt_number: reference,
          period_year: periodYear,
          period_month: periodMonth,
          early_payment_discount_applied: discountResult.eligible ? discountResult.discountAmount : null,
          updated_at: new Date().toISOString(),
        } as any).eq('id', paymentId);
        if (updateError) throw updateError;
      } else {
        const payloadChildId: string | null = childId || null;
        const payloadBranchId: string | null = branchId || null;
        const { error: insertError } = await supabase.from('payments').insert({
          parent_id: user?.id,
          child_id: payloadChildId,
          team_id: (teamId && teamId !== '') ? teamId : null,
          school_id: (schoolId && schoolId !== '') ? schoolId : null,
          branch_id: payloadBranchId,
          amount: finalAmount,
          concept: finalConcept,
          status: internalStatus,
          payment_method: 'card',
          payment_provider: 'mercadopago',
          provider_reference: reference,
          provider_transaction_id: String(result.paymentId),
          payment_type: 'one_time',
          payment_date: new Date().toISOString().split('T')[0],
          due_date: new Date().toISOString().split('T')[0],
          receipt_number: reference,
          period_year: periodYear,
          period_month: periodMonth,
          early_payment_discount_applied: discountResult.eligible ? discountResult.discountAmount : null,
        } as any);
        if (insertError) throw insertError;
      }

      setPaymentStatus(internalStatus === 'paid' ? 'success' : 'awaiting_approval');
      toast({
        title: internalStatus === 'paid' ? '¡Pago exitoso!' : 'Pago en proceso',
        description: internalStatus === 'paid'
          ? `Procesado con MercadoPago — ${formatCurrency(chargeAmount)}`
          : `Estado: ${result.statusDetail}. Te notificaremos cuando se confirme.`,
      });
      setTimeout(() => { onSuccess?.(); onOpenChange(false); }, 2500);
    } catch (error: any) {
      setPaymentStatus('error');
      toast({ title: 'Error registrando el pago', description: error?.message ?? 'Error desconocido', variant: 'destructive' });
      setTimeout(() => setPaymentStatus('idle'), 2000);
    } finally {
      setProcessing(false);
    }
  };

  const processPayment = async () => {
    if (processing) return;
    setProcessing(true);
    setPaymentStatus('processing');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Build the correct child/user IDs for the payment
      const payloadChildId: string | null = childId || null;
      const payloadBranchId: string | null = branchId || null;

      // Duplicate check.
      //  - Mensualidad: bloquea solo si hay otro pago activo del MISMO mes.
      //    El unique index `uniq_payment_active_period_per_child` (migracion
      //    20260503000004) ya garantiza esto a nivel BD; aqui damos el error
      //    amigable antes del INSERT.
      //  - Inscripcion / abono / otros: bloquea cualquier awaiting_approval
      //    para ese hijo, como antes.
      const idColumn = payloadChildId ? 'child_id' : 'user_id';
      const idValue = payloadChildId || user.id;

      let duplicateQuery = supabase.from('payments').select('id, period_year, period_month')
        .eq(idColumn, idValue)
        .in('status', ['awaiting_approval', 'paid', 'approved', 'partial']).limit(50);
      if (mode === 'update' && paymentId) {
        duplicateQuery = duplicateQuery.neq('id', paymentId);
      }
      const { data: pendingPayments, error: pendingError } = await duplicateQuery;
      if (pendingError) throw pendingError;

      if (conceptType === 'mensualidad' && effectivePeriod) {
        const samePeriod = (pendingPayments || []).find((p: any) =>
          p.period_year === effectivePeriod.year && p.period_month === effectivePeriod.month,
        );
        if (samePeriod) {
          throw new Error(`Ya existe un pago activo para ${effectivePeriod.label}.`);
        }
      } else if (pendingPayments && pendingPayments.some((p: any) =>
        // Para no-mensualidades, mantener el bloqueo legacy: cualquier awaiting_approval
        // sin periodo definido cuenta como duplicado.
        !p.period_year && !p.period_month,
      )) {
        throw new Error('Ya existe un pago pendiente de aprobación para este deportista.');
      }

      if (mode === 'update' && paymentId && paymentId !== '') {
        const { data: existingPayment, error: fetchError } = await supabase.from('payments').select('school_id, status').eq('id', paymentId).single();
        if (fetchError || !existingPayment) throw new Error('No se encontró el pago pendiente.');
        if (existingPayment.status === 'paid') throw new Error('Este pago ya fue procesado.');
      }

      // Periodo a registrar cuando es mensualidad (NULL en otros conceptos
      // como inscripcion / abono libre).
      const periodYear = conceptType === 'mensualidad' && effectivePeriod ? effectivePeriod.year : null;
      const periodMonth = conceptType === 'mensualidad' && effectivePeriod ? effectivePeriod.month : null;

      if (selectedMethod === 'transfer') {
        if (!proofUrl) throw new Error('Debes subir un comprobante de pago');
        // Campos OCR + veredicto (modo sombra) del comprobante, comunes a insert/update.
        const receiptOcrFields = {
          ocr_amount: ocrResult?.extractedAmount ?? null,
          ocr_currency: ocrResult?.extractedCurrency ?? null,
          ocr_date: ocrResult?.extractedDate ?? null,
          ocr_bank: ocrResult?.extractedBank ?? null,
          ocr_reference: ocrResult?.extractedReference ?? null,
          ocr_provider: ocrResult?.provider ?? null,
          ocr_destination: ocrResult?.extractedDestination ?? null,
          ocr_destination_name: ocrResult?.extractedDestinationName ?? null,
          ocr_origin_name: ocrResult?.extractedOriginName ?? null,
          ocr_time: ocrResult?.extractedTime ?? null,
          ocr_raw_response: ocrResult?.rawResponse
            ? safeParseJson(ocrResult.rawResponse) ?? ocrResult.rawResponse
            : null,
          // Veredicto de reglas: se guarda pero NO cambia el status (sombra).
          receipt_verdict: ocrResult?.verdict ?? null,
          receipt_verdict_reasons: ocrResult?.verdictReasons ?? null,
          receipt_reference_norm: ocrResult?.referenceNorm ?? null,
          receipt_image_sha256: ocrResult?.imageSha256 ?? null,
          receipt_image_sha256_source: ocrResult?.imageSha256Source ?? null,
          receipt_verdict_at: ocrResult?.verdict ? new Date().toISOString() : null,
        };
        let glosaPaymentId: string | null = (mode === 'update' && paymentId) ? paymentId : null;
        if (mode === 'update' && paymentId) {
          const { error: updateError } = await supabase.from('payments').update({
            status: 'awaiting_approval',
            payment_method: 'transfer',
            payment_date: new Date().toISOString().split('T')[0],
            receipt_url: proofUrl,
            period_year: periodYear,
            period_month: periodMonth,
            early_payment_discount_applied: discountResult.eligible ? discountResult.discountAmount : null,
            ...receiptOcrFields,
            updated_at: new Date().toISOString()
          } as any).eq('id', paymentId);
          if (updateError) throw updateError;
        } else {
          const ins = await supabase.from('payments').insert({
            parent_id: user?.id,
            child_id: payloadChildId,
            team_id: (teamId && teamId !== '') ? teamId : null,
            school_id: (schoolId && schoolId !== '') ? schoolId : null,
            branch_id: payloadBranchId,
            amount: finalAmount,
            concept: finalConcept,
            status: 'awaiting_approval',
            payment_method: 'transfer',
            payment_type: 'one_time',
            payment_date: new Date().toISOString().split('T')[0],
            due_date: new Date().toISOString().split('T')[0],
            receipt_url: proofUrl,
            period_year: periodYear,
            period_month: periodMonth,
            early_payment_discount_applied: discountResult.eligible ? discountResult.discountAmount : null,
            ...receiptOcrFields,
            reference: `TRF-${Date.now().toString(36).toUpperCase()}`
          } as any).select('id').single();
          if (ins.error) throw ins.error;
          glosaPaymentId = ins.data?.id ?? null;
        }
        // Auto-glosa app-layer (dormant si auto_glosa_enabled=false). Fire-and-forget.
        if (glosaPaymentId && ocrResult?.verdict === 'amarillo') {
          autoEvaluateGlosa(glosaPaymentId).catch(() => { /* dormant/no-op tolerado */ });
        }
        // Notificar al owner de la escuela con el mes especifico
        // (fire-and-forget; un fallo aqui no debe romper el flujo del padre).
        if (schoolId) {
          void (async () => {
            try {
              const { data: schoolRow } = await supabase
                .from('schools')
                .select('owner_id')
                .eq('id', schoolId)
                .maybeSingle();
              const ownerId = schoolRow?.owner_id;
              if (!ownerId) return;
              const periodLabel = effectivePeriod?.label;
              const studentLabel = childName ?? 'un deportista';
              await supabase.rpc('notify_user', {
                p_user_id: ownerId,
                p_title: periodLabel
                  ? `Comprobante por validar — ${periodLabel}`
                  : 'Comprobante por validar',
                p_message: periodLabel
                  ? `${studentLabel} envió comprobante de ${formatCurrency(chargeAmount)} para ${periodLabel}.`
                  : `${studentLabel} envió un comprobante de ${formatCurrency(chargeAmount)}.`,
                p_type: 'payment',
                p_link: '/finances',
              });
            } catch {
              /* silencio: notificacion no debe interrumpir flujo */
            }
          })();
        }

        setPaymentStatus('awaiting_approval');
        toast({
          title: "Pago registrado",
          description: effectivePeriod
            ? `Comprobante de ${effectivePeriod.label} enviado. La escuela lo validará pronto.`
            : "Tu cupo ha sido reservado. Validaremos tu comprobante pronto.",
        });
        setTimeout(() => { onSuccess?.(); onOpenChange(false); }, 3000);
        return;
      }

      const receiptNumber = `MAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      let error = null;
      if (mode === 'update' && paymentId) {
        const { error: updateError } = await supabase.from('payments').update({
          status: 'paid',
          payment_method: selectedMethod,
          payment_date: new Date().toISOString().split('T')[0],
          receipt_number: receiptNumber,
          period_year: periodYear,
          period_month: periodMonth,
          early_payment_discount_applied: discountResult.eligible ? discountResult.discountAmount : null,
          updated_at: new Date().toISOString()
        }).eq('id', paymentId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('payments').insert({
          parent_id: user?.id,
          child_id: payloadChildId,
          team_id: (teamId && teamId !== '') ? teamId : null,
          school_id: (schoolId && schoolId !== '') ? schoolId : null,
          branch_id: payloadBranchId,
          amount: finalAmount,
          concept: finalConcept,
          status: 'paid',
          payment_method: selectedMethod,
          payment_type: 'one_time',
          payment_date: new Date().toISOString().split('T')[0],
          due_date: new Date().toISOString().split('T')[0],
          receipt_number: receiptNumber,
          period_year: periodYear,
          period_month: periodMonth,
          early_payment_discount_applied: discountResult.eligible ? discountResult.discountAmount : null,
        });
        error = insertError;
      }
      if (error) throw error;

      // Notificar al padre/atleta por email (fire-and-forget)
      const parentEmail = user?.email;
      if (parentEmail) {
        emailClient.send({
          type: 'payment_confirmation',
          to: parentEmail,
          data: {
            studentName: childName || (childId ? 'tu hijo' : 'tu cuenta'),
            amount: formatCurrency(chargeAmount),
            concept: finalConcept,
            paymentMethod: selectedMethod === 'pse' ? 'PSE' : (selectedMethod === 'card' ? 'Tarjeta' : 'Transferencia'),
          },
        }).catch(() => {/* silencio — no interrumpir flujo si email falla */ });
      }

      setPaymentStatus('success');
      toast({ title: "¡Pago exitoso!", description: `Tu pago de ${formatCurrency(chargeAmount)} fue procesado correctamente` });
      setTimeout(() => { onSuccess?.(); onOpenChange(false); setPaymentStatus('idle'); setSelectedMethod(null); }, 2000);
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      setPaymentStatus('error');
      // 23505 = comprobante ya usado (unique index de referencia o de hash de imagen).
      const dupMsg = err.message?.toLowerCase() ?? '';
      const isDuplicate = err.code === '23505'
        && (dupMsg.includes('ocr_reference') || dupMsg.includes('receipt_hash') || dupMsg.includes('receipt_image_sha256'));
      toast({
        title: isDuplicate ? "Comprobante ya usado" : "Error en el pago",
        description: isDuplicate
          ? "Este comprobante ya está vinculado a otro pago en esta escuela. Si crees que es un error, contacta a la administración."
          : (err.message || "No se pudo procesar tu pago."),
        variant: "destructive",
      });
      setTimeout(() => setPaymentStatus('idle'), 2000);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => { if (!processing) onOpenChange(false); };

  // ── Handler que decide si abre el AlertDialog "¿adelantar siguiente mes?"
  // antes de procesar el pago. Solo aplica al concepto 'mensualidad'.
  const handlePayClick = () => {
    if (processing) return;
    if (!selectedMethod) return;

    // No-mensualidad o sin info de periodo → flujo directo
    if (conceptType !== 'mensualidad' || !nextPeriod || !childId) {
      void processPayment();
      return;
    }

    // El mes sugerido todavia esta libre → cobramos ese mes
    if (!isPeriodActive(nextPeriod.current_status as PeriodStatus)) {
      void processPayment();
      return;
    }

    // El mes sugerido ya tiene un pago activo → preguntamos si adelantar
    setConfirmAdvanceOpen(true);
  };

  // Calcula el mes siguiente al sugerido y verifica que tampoco este pagado.
  // Si tambien esta pagado, salta al siguiente y asi sucesivamente (max 12
  // saltos para evitar loops). Setea advancedPeriod y dispara processPayment.
  const handleConfirmAdvance = async () => {
    if (!nextPeriod || !childId) {
      setConfirmAdvanceOpen(false);
      return;
    }
    let y = nextPeriod.year;
    let m = nextPeriod.month + 1;
    if (m > 12) { m = 1; y += 1; }

    // Saltar meses que ya esten cubiertos (si el padre adelanto varios)
    for (let i = 0; i < 12; i++) {
      try {
        const result = await fetchPeriodStatus(childId, y, m);
        if (!isPeriodActive(result.status)) break;
      } catch {
        break;
      }
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }

    setAdvancedPeriod({
      year: y,
      month: m,
      label: `${[
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ][m - 1]} ${y}`,
    });
    setConfirmAdvanceOpen(false);
    // Defer al siguiente tick para que finalConcept use el nuevo periodo
    setTimeout(() => { void processPayment(); }, 0);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        {/*
        RESPONSIVE KEY:
        - Mobile (<sm): w-[100vw] h-[100dvh] rounded-none → full screen sheet
        - sm+: max-w-md centrado con border-radius normal
        El dvh (dynamic viewport height) evita el problema del teclado virtual en iOS
      */}
        <DialogContent
          className="
        w-[100vw] h-[100dvh] max-h-[100dvh] rounded-none overflow-y-auto p-4
        sm:w-full sm:max-w-md sm:h-auto sm:max-h-[90vh] sm:rounded-lg sm:p-6
        "
          onPointerDownOutside={(e) => {
            // Si MP brick esta montado con datos posibles, prevenir cierre por
            // click fuera (el iframe MP no permite recuperar los datos).
            if (mpReference) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (mpReference) e.preventDefault();
          }}
        >
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl sm:text-2xl">
              {conceptType === 'mensualidad' && effectivePeriod
                ? `Mensualidad ${effectivePeriod.label}`
                : 'Realizar Pago'}
            </DialogTitle>
            <DialogDescription>
              {conceptType === 'mensualidad' && effectivePeriod && childName
                ? `Pago para ${childName} — ${effectivePeriod.label}`
                : 'Selecciona tu método de pago preferido'}
            </DialogDescription>
          </DialogHeader>

          {/* Estado 1: Verificando */}
          {checkingPending && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="h-10 w-10 mx-auto text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Verificando pagos pendientes...</p>
            </div>
          )}

          {/* Estado 2: Bloqueado */}
          {!checkingPending && pendingPaymentDate !== null && paymentStatus === 'idle' && (
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-9 w-9 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-amber-600">Pago en espera de validación</h3>
                <p className="text-sm text-muted-foreground px-4">
                  Ya existe un comprobante enviado el <span className="font-medium text-foreground">{pendingPaymentDate}</span> pendiente de aprobación.
                </p>
                <p className="text-xs text-muted-foreground px-6">
                  No puedes registrar un nuevo pago hasta que ese comprobante sea aprobado o rechazado.
                </p>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Entendido</Button>
            </div>
          )}

          {/* Estado 3: Formulario */}
          {!checkingPending && pendingPaymentDate === null && paymentStatus === 'idle' && (
            <div className="space-y-5 py-2">
              {/* Resumen */}
              <div className="bg-primary/5 rounded-lg p-4 space-y-4">
                {mode === 'create' ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de Pago</Label>
                      <Select value={conceptType} onValueChange={(v: any) => setConceptType(v)}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Concepto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensualidad">Mensualidad ({concept})</SelectItem>
                          <SelectItem value="inscripcion_fija">Inscripción Anual (Monto Fijo)</SelectItem>
                          <SelectItem value="inscripcion_variable">Inscripción Anual (Monto Variable)</SelectItem>
                          <SelectItem value="otro">Otro Concepto / Abono libre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {conceptType === 'otro' && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descripción del Pago</Label>
                        <Input placeholder="Ej. Uniforme, Aporte especial..." value={customConcept} onChange={(e) => setCustomConcept(e.target.value)} className="bg-white" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monto ($ COP)</Label>
                      {['mensualidad', 'inscripcion_fija'].includes(conceptType) ? (
                        <div className="flex items-baseline gap-2">
                          {discountResult.eligible && discountResult.discountAmount > 0 ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm text-muted-foreground line-through font-normal">
                                {formatCurrency(amount)}
                              </span>
                              <span className="text-2xl sm:text-3xl font-bold text-primary">
                                {formatCurrency(chargeAmount)}
                              </span>
                            </div>
                          ) : (
                            <p className="text-2xl sm:text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
                          )}
                          <p className="text-sm text-muted-foreground">/ {conceptType === 'mensualidad' ? 'mes' : 'tarifa plan'}</p>
                        </div>
                      ) : (
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                          <Input type="number" min="0" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} className="bg-white pl-7 text-lg font-bold text-primary" placeholder="Ej. 150000" />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Concepto</p>
                    <p className="font-semibold text-base leading-tight">{concept}</p>
                    <div className="flex items-baseline gap-2">
                      {discountResult.eligible && discountResult.discountAmount > 0 ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm text-muted-foreground line-through font-normal">
                            {formatCurrency(amount)}
                          </span>
                          <span className="text-2xl sm:text-3xl font-bold text-primary">
                            {formatCurrency(chargeAmount)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-2xl sm:text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
                      )}
                      <p className="text-sm text-muted-foreground">cobro pendiente</p>
                    </div>
                  </div>
                )}
                {discountResult.eligible && discountResult.discountAmount > 0 && (
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 flex items-start gap-2">
                    <Percent className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Descuento por pronto pago: −{formatCurrency(discountResult.discountAmount)}
                      </p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                        Pagas {formatCurrency(chargeAmount)} en vez de {formatCurrency(finalAmount)}
                        {discountResult.validUntil ? ` · válido hasta ${discountResult.validUntil}` : ''}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Métodos */}
              <div className="space-y-3">
                <p className="font-medium text-sm">Método de pago:</p>
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  const isSelected = selectedMethod === method.id;
                  const isDisabled = !method.enabled;
                  return (
                    <button
                      key={method.id}
                      onClick={() => !isDisabled && setSelectedMethod(method.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 p-3 sm:p-4 border-2 rounded-lg transition-all text-left ${isDisabled ? 'border-border/50 opacity-50 cursor-not-allowed bg-muted/30'
                        : isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDisabled ? 'bg-muted/50' : isSelected ? 'bg-primary text-white' : 'bg-muted'}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{method.name}</p>
                          {method.popular && method.enabled && <Badge variant="secondary" className="text-xs">Recomendado</Badge>}
                          {isDisabled && <Badge variant="outline" className="text-xs text-muted-foreground">Próximamente</Badge>}
                          {(method as any).badge && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">{(method as any).badge}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{method.description}</p>
                      </div>
                      {isSelected && !isDisabled && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Formulario DIAN si falta */}
              {selectedMethod && !checkingDian && !hasCompleteDianData && (
                <div className="pt-4 border-t">
                  <BillingDetailsForm onComplete={() => setHasCompleteDianData(true)} />
                </div>
              )}

              {/* Datos bancarios */}
              {selectedMethod === 'transfer' && hasCompleteDianData && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <Alert variant="default" className="bg-primary/5 border-primary/20">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <AlertTitle className="text-primary font-bold text-sm">Información de Transferencia</AlertTitle>
                    <AlertDescription className="space-y-2 mt-2">
                      <p className="text-sm">Realiza tu transferencia a la siguiente cuenta:</p>
                      {bankDetails ? (
                        <div className="bg-background/80 p-3 rounded border space-y-1 font-mono text-xs break-all">
                          {bankDetails.bank_name && <p><strong>Banco:</strong> {bankDetails.bank_name} ({bankDetails.bank_account_type})</p>}
                          {bankDetails.bank_account_number && <p><strong>Número:</strong> {bankDetails.bank_account_number}</p>}
                          {bankDetails.nequi_number && <p><strong>Nequi:</strong> {bankDetails.nequi_number}</p>}
                          {bankDetails.daviplata_number && <p><strong>Daviplata:</strong> {bankDetails.daviplata_number}</p>}
                          {bankDetails.bank_titular_name && <p><strong>Titular:</strong> {bankDetails.bank_titular_name}</p>}
                          {bankDetails.bank_titular_id && <p><strong>NIT/CC:</strong> {bankDetails.bank_titular_id}</p>}
                        </div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">La escuela no ha configurado sus datos bancarios aún.</p>
                      )}
                      {bankDetails?.payment_qr_url && (
                        <div className="mt-3 text-center flex flex-col items-center">
                          <p className="text-xs font-semibold mb-2 text-muted-foreground">O escanea este QR:</p>
                          <div
                            className="relative group cursor-pointer overflow-hidden rounded-lg border shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02]"
                            onClick={(e) => { e.stopPropagation(); setShowFullQr(true); }}
                          >
                            <img
                              src={bankDetails.payment_qr_url}
                              alt="QR de Pago"
                              className="w-28 h-28 sm:w-32 sm:h-32 object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-[10px] text-white font-medium bg-black/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Maximize2 className="h-3 w-3" /> Ampliar
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 block">Clic para ampliar 🔍</span>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Sube tu comprobante:</p>
                    <FileUpload
                      bucket="payment-receipts"
                      accept="image/*,application/pdf"
                      validateReceipt={true}
                      schoolId={schoolId || undefined}
                      paymentId={mode === 'update' ? (paymentId || undefined) : undefined}
                      onUploadComplete={(url) => setProofUrl(url)}
                      onValidationResult={(r) => setOcrResult(r)}
                      expectedAmount={chargeAmount}
                      // Bloqueo estricto solo en concept fijo (mensualidad/inscripcion fija).
                      // Para abono / inscripcion variable / otros, OCR es advisory.
                      conceptKind={
                        conceptType === 'mensualidad' || conceptType === 'inscripcion_fija'
                          ? 'fixed'
                          : 'lenient'
                      }
                      allowPartial={allowInstallments}
                      minPartialAmount={minInstallmentAmount}
                    />
                    {proofUrl && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Comprobante cargado correctamente
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Brick MercadoPago — solo se monta cuando el usuario selecciona MP.
                IMPORTANT: NO usar display:none para ocultarlo cuando otro metodo
                esta seleccionado, porque el SDK MP mide el contenedor durante
                .render() y con display:none queda con width/height=0, lo que
                causa errores 'Could not find container' y SVG vacios. */}
              {hasCompleteDianData && mpReference && mpEnabled && selectedMethod === 'mercadopago' && (
                <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                  <MercadoPagoBrick
                    key={mpReference}
                    publicKey={import.meta.env.VITE_MP_PUBLIC_KEY_DEFAULT}
                    sandbox={false}
                    transactionAmount={chargeAmount}
                    externalReference={mpReference}
                    payerEmail={user?.email || 'demo@sportmaps.co'}
                    payerFirstName={(user?.user_metadata?.full_name || 'Padre').split(' ')[0]}
                    payerLastName={(user?.user_metadata?.full_name || '').split(' ').slice(1).join(' ') || 'Demo'}
                    description={`${finalConcept} — ${childName ?? 'deportista'}`}
                    schoolId={schoolId}
                    onSuccess={handleMpSuccess}
                    onPending={handleMpSuccess}
                    onError={(err) => toast({ title: 'Error en MercadoPago', description: err.message, variant: 'destructive' })}
                  />
                  <Button variant="outline" className="w-full" onClick={handleClose} disabled={processing}>Cancelar</Button>
                </div>
              )}

              {/* Botones acción para los demás métodos (no online ni MP) */}
              {hasCompleteDianData && selectedMethod !== 'online' && selectedMethod !== 'mercadopago' && (
                <div className="space-y-2 pt-2">
                  <Button className="w-full" size="lg" disabled={!selectedMethod || processing} onClick={handlePayClick}>
                    {processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</> : `Pagar ${formatCurrency(chargeAmount)}`}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={handleClose} disabled={processing}>Cancelar</Button>
                </div>
              )}

              {/* Botón online → abre PaymentConfirmModal */}
              {selectedMethod === 'online' && (
                <div className="space-y-2 pt-2">
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                    disabled={wompiLoading}
                    onClick={() => setShowOnlineConfirm(true)}
                  >
                    {wompiLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Conectando...</>
                    ) : (
                      `Pagar online ${formatCurrency(grossAmount)}`
                    )}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={handleClose}>Cancelar</Button>
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground">
                {selectedMethod === 'transfer'
                  ? "El comprobante será revisado por la administración antes de validarse."
                  : selectedMethod === 'online'
                    ? `Incluye ${formatCurrency(sportmapsFee)} de procesamiento. Tu escuela recibe ${formatCurrency(chargeAmount)} completos.`
                    : "🔒 Pago 100% seguro."}
              </p>
            </div>
          )}

          {/* Estado: Procesando */}
          {paymentStatus === 'processing' && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
              <div>
                <h3 className="text-lg font-semibold">Procesando tu pago...</h3>
                <p className="text-sm text-muted-foreground">Esto puede tomar unos segundos</p>
              </div>
            </div>
          )}

          {/* Estado: Éxito */}
          {paymentStatus === 'success' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-600">¡Pago exitoso!</h3>
                <p className="text-sm text-muted-foreground">Tu pago de {formatCurrency(chargeAmount)} fue procesado correctamente</p>
              </div>
            </div>
          )}

          {/* Estado: En verificación */}
          {paymentStatus === 'awaiting_approval' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-600">Pago en Verificación</h3>
                <p className="text-sm text-muted-foreground px-4">
                  Hemos recibido tu comprobante. Será validado pronto por la escuela.
                </p>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Entendido</Button>
            </div>
          )}

          {/* Estado: Error */}
          {paymentStatus === 'error' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-600">Pago rechazado</h3>
                <p className="text-sm text-muted-foreground">No se pudo procesar tu pago. Por favor, inténtalo de nuevo.</p>
              </div>
              <Button onClick={() => setPaymentStatus('idle')}>Intentar de nuevo</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal de confirmación de pago online (Wompi) ────────────────────── */}
      <PaymentConfirmModal
        open={showOnlineConfirm}
        onOpenChange={setShowOnlineConfirm}
        baseAmount={chargeAmount}
        grossAmount={grossAmount}
        sportmapsFee={sportmapsFee}
        feePct={onlineFeePct}
        concept={finalConcept}
        childName={childName}
        loading={wompiLoading}
        onConfirm={openCheckout}
        onBack={() => setShowOnlineConfirm(false)}
      />

      {/* ── Confirmacion: ¿adelantar el siguiente mes? ──────────────────────── */}
      <AlertDialog open={confirmAdvanceOpen} onOpenChange={setConfirmAdvanceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {nextPeriod && `${nextPeriod.label} ya tiene un pago activo`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {nextPeriod?.current_status === 'paid' || nextPeriod?.current_status === 'approved'
                ? `Ya pagaste ${nextPeriod.label} para ${childName ?? 'este deportista'}.`
                : nextPeriod?.current_status === 'awaiting_approval'
                  ? `Hay un comprobante de ${nextPeriod?.label} esperando validacion de la escuela.`
                  : `Ya hay un cobro registrado para ${nextPeriod?.label}.`}
              {' '}¿Deseas adelantar el siguiente mes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { void handleConfirmAdvance(); }}>
              Sí, adelantar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showFullQr} onOpenChange={setShowFullQr}>
        <DialogContent className="sm:max-w-md max-w-[90vw] rounded-xl p-6 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md border border-primary/20 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <DialogHeader className="w-full text-center mb-2">
            <DialogTitle className="text-lg font-bold text-foreground">QR de Pago</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Escanea este código desde la app de tu banco para realizar la transferencia a la escuela
            </DialogDescription>
          </DialogHeader>

          <div className="bg-white p-4 rounded-xl border shadow-inner flex items-center justify-center max-w-full max-h-[60vh] overflow-hidden">
            <img
              src={bankDetails?.payment_qr_url || ''}
              alt="Código QR de Pago Completo"
              className="max-w-full max-h-[50vh] object-contain rounded-lg transition-transform duration-300 hover:scale-105"
            />
          </div>

          <div className="flex gap-3 w-full mt-6">
            <Button
              variant="outline"
              className="flex-1 border-primary/20 hover:bg-primary/5 text-xs h-9"
              onClick={async () => {
                try {
                  const response = await fetch(bankDetails?.payment_qr_url || '');
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `qr-pago-${(concept || 'pago').toLowerCase().replace(/\s+/g, '-')}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                  toast({ title: "Código QR descargado" });
                } catch (e) {
                  window.open(bankDetails?.payment_qr_url || '', '_blank');
                }
              }}
            >
              <Download className="h-4 w-4 mr-2 text-primary" /> Descargar QR
            </Button>
            <Button
              className="flex-1 text-xs h-9"
              onClick={() => setShowFullQr(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}