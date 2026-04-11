/**
 * PaymentConfirmModal — Modal de desglose y confirmación antes de pagar con ePayco
 *
 * Este modal aparece DESPUÉS de que el padre seleccione "Pagar online"
 * y ANTES de que se abra el checkout de ePayco.
 *
 * Objetivo: transparencia total sobre el fee de procesamiento.
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Building2, Smartphone, Shield, Loader2, ArrowLeft } from 'lucide-react';

interface PaymentConfirmModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    baseAmount: number;
    grossAmount: number;
    sportmapsFee: number;
    feePct: number;
    concept: string;
    childName?: string;
    onConfirm: () => void;
    onBack?: () => void;
    loading?: boolean;
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);

export function PaymentConfirmModal({
    open,
    onOpenChange,
    baseAmount,
    grossAmount,
    sportmapsFee,
    feePct,
    concept,
    childName,
    onConfirm,
    onBack,
    loading = false,
}: PaymentConfirmModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="
                w-[100vw] h-auto max-h-[100dvh] rounded-none overflow-y-auto p-4
                sm:w-full sm:max-w-md sm:rounded-lg sm:p-6
            ">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-xl sm:text-2xl">Confirmar pago online</DialogTitle>
                    <DialogDescription>
                        {childName
                            ? `Pago para ${childName}`
                            : 'Revisa el detalle antes de continuar'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* ── Concepto ───────────────────────────────────────────── */}
                    <div className="bg-primary/5 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-1">Concepto</p>
                        <p className="font-semibold text-base leading-tight">{concept}</p>
                    </div>

                    {/* ── Desglose del fee ───────────────────────────────────── */}
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Mensualidad base</span>
                            <span className="font-semibold">{formatCurrency(baseAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                                Fee procesamiento ({feePct}%)
                            </span>
                            <span className="font-medium text-amber-600">
                                +{formatCurrency(sportmapsFee)}
                            </span>
                        </div>
                        <div className="border-t pt-3">
                            <div className="flex justify-between items-center">
                                <span className="font-bold">Total a pagar</span>
                                <span className="text-2xl font-bold text-primary">
                                    {formatCurrency(grossAmount)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Métodos aceptados ──────────────────────────────────── */}
                    <div className="flex items-center justify-center gap-4 py-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CreditCard className="h-4 w-4" />
                            <span>Tarjeta</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                            <span>PSE</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Smartphone className="h-4 w-4" />
                            <span>Nequi</span>
                        </div>
                    </div>

                    {/* ── Info de seguridad ──────────────────────────────────── */}
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Shield className="h-4 w-4 text-green-600" />
                        <span>Pago seguro procesado por ePayco</span>
                    </div>

                    {/* ── Nota sobre el fee ──────────────────────────────────── */}
                    <p className="text-[11px] text-center text-muted-foreground leading-relaxed px-2">
                        El fee de procesamiento ({feePct}%) cubre los costos de la pasarela de pagos.
                        Tu escuela recibe siempre el monto completo de {formatCurrency(baseAmount)}.
                    </p>

                    {/* ── Botones ────────────────────────────────────────────── */}
                    <div className="space-y-2 pt-1">
                        <Button
                            className="w-full"
                            size="lg"
                            disabled={loading}
                            onClick={onConfirm}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Conectando con ePayco...
                                </>
                            ) : (
                                `Confirmar y pagar ${formatCurrency(grossAmount)}`
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={onBack || (() => onOpenChange(false))}
                            disabled={loading}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver / pagar manualmente
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
