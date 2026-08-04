/**
 * CreateGlosaDialog — el admin abre una glosa sobre un comprobante en vez de
 * rechazarlo. El motivo viene prellenado desde el primer motivo amarillo del
 * veredicto (si existe).
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { create as createGlosa, REASON_ADMIN_LABELS, type GlosaReason } from '@/lib/api/glosas';

const AMARILLO_TO_REASON: Record<string, GlosaReason> = {
    MONTO_DIFIERE: 'MONTO_DIFIERE',
    FECHA_FUERA_VENTANA: 'FECHA_FUERA_VENTANA',
    CAMPOS_ILEGIBLES: 'CAMPOS_ILEGIBLES',
    FORMATO_REFERENCIA: 'OTRO',
};

interface Props {
    payment: { id: string; receipt_verdict_reasons?: unknown[] | null } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

function prefillReason(reasons?: unknown[] | null): GlosaReason {
    if (!Array.isArray(reasons)) return 'OTRO';
    const first = reasons.find(
        (r): r is { code: string; level?: string } =>
            typeof r === 'object' && r !== null && (r as any).level === 'amarillo' && typeof (r as any).code === 'string',
    );
    return first ? AMARILLO_TO_REASON[first.code] ?? 'OTRO' : 'OTRO';
}

export function CreateGlosaDialog({ payment, open, onOpenChange, onSuccess }: Props) {
    const { toast } = useToast();
    const [reason, setReason] = useState<GlosaReason>('OTRO');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open && payment) setReason(prefillReason(payment.receipt_verdict_reasons));
    }, [open, payment]);

    const handleSubmit = async () => {
        if (!payment) return;
        setSubmitting(true);
        try {
            await createGlosa({ paymentId: payment.id, reason });
            toast({ title: 'Glosa abierta', description: 'El acudiente fue notificado para que aclare.' });
            onOpenChange(false);
            onSuccess?.();
        } catch (err: any) {
            const status = err?.status ?? err?.statusCode;
            toast({
                title: status === 409 ? 'Ya tiene una aclaración' : 'No se pudo abrir la glosa',
                description: err?.message || 'Intenta de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
            <DialogContent className="w-[95vw] max-w-md">
                <DialogHeader>
                    <DialogTitle>Abrir aclaración (glosa)</DialogTitle>
                    <DialogDescription>
                        El pago quedará en "necesita aclaración" y el acudiente podrá responder. No se rechaza.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <Label>Motivo</Label>
                    <Select value={reason} onValueChange={(v) => setReason(v as GlosaReason)} disabled={submitting}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {(Object.keys(REASON_ADMIN_LABELS) as GlosaReason[]).map((k) => (
                                <SelectItem key={k} value={k}>{REASON_ADMIN_LABELS[k]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Abriendo...</>) : 'Abrir glosa'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
