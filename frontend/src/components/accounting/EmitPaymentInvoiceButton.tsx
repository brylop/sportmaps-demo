/**
 * EmitPaymentInvoiceButton — emite la factura electrónica de UN pago cobrado
 * (POST /api/v1/invoicing/emit/:paymentId).
 *
 * Existe porque el endpoint estaba desde siempre y no tenía botón: un pago de
 * hace más de 3 días (fuera de la ventana del cron) o una factura rechazada
 * después de corregir el dato solo se podían emitir por RANGO, que arrastra
 * todo lo demás del periodo.
 *
 * Quién lo ve lo decide el que lo usa con `canEmit` (viene del BFF:
 * permissions.canEmit = canManageFinances; el contador lee pero no emite). El
 * BFF vuelve a validar el permiso y que el pago esté 'paid': esconder el botón
 * es comodidad, no el control.
 *
 * Pasa por una confirmación porque es irreversible: consume un número de la
 * resolución DIAN y solo se deshace con nota crédito.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { invoicingApi } from '@/lib/api/invoicing';
import { reasonLabel, warningLabel } from '@/components/accounting/invoiceReasons';
import { Button } from '@/components/ui/button';
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Send } from 'lucide-react';

export function EmitPaymentInvoiceButton({
    paymentId, amount, detail, label = 'Emitir', onEmitted, size = 'sm', variant = 'outline',
}: {
    paymentId: string;
    amount?: number | null;
    /** Quién/qué, para la confirmación (p. ej. «Mensualidad · Ana Pérez»). */
    detail?: string | null;
    label?: string;
    /** Se llama SIEMPRE que el BFF respondió (salga o no): hay que refrescar listas. */
    onEmitted?: () => void;
    size?: 'sm' | 'default';
    variant?: 'outline' | 'ghost' | 'default';
}) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);

    const mutation = useMutation({
        mutationFn: () => invoicingApi.emit(paymentId),
        onSuccess: (r) => {
            setOpen(false);
            if (r?.ok) {
                const avisos = (r.warnings ?? []).map(warningLabel);
                toast({
                    title: r.status === 'accepted' ? 'Factura validada por la DIAN' : 'Factura enviada al proveedor',
                    description: avisos.length ? avisos.join(' · ') : 'Ya aparece en «Facturas emitidas».',
                });
            } else {
                toast({ title: 'No se emitió', description: reasonLabel(r?.error), variant: 'destructive' });
            }
            onEmitted?.();
        },
        onError: (err: any) => {
            setOpen(false);
            // 422 trae el motivo del motor en el body; el resto (403, 404, red) en message.
            const code = err?.body?.error ?? null;
            toast({
                title: 'No se emitió',
                description: code ? reasonLabel(code) : (err?.message ?? 'Error desconocido'),
                variant: 'destructive',
            });
            onEmitted?.();
        },
    });

    return (
        <>
            <Button
                size={size}
                variant={variant}
                onClick={() => setOpen(true)}
                disabled={mutation.isPending}
                title="Emitir la factura electrónica de este pago"
            >
                {mutation.isPending
                    ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    : <Send className="mr-1 h-3 w-3" />}
                {label}
            </Button>
            <AlertDialog open={open} onOpenChange={(v) => { if (!mutation.isPending) setOpen(v); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Emitir la factura de este pago?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {detail ? <><strong>{detail}</strong>{amount != null ? ` · ${formatCurrency(amount)}` : ''}. </> : null}
                            Sale a la DIAN y consume un número de tu resolución. No se puede borrar: solo se
                            anula con una nota crédito.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
                        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Emitir factura
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
