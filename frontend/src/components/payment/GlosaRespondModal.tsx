/**
 * GlosaRespondModal — el acudiente responde una glosa ("aclaración") de su pago.
 * Muestra el motivo en lenguaje simple, un texto libre y (opcional) un soporte.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Info } from 'lucide-react';
import { FileUpload } from '@/components/common/FileUpload';
import { useToast } from '@/hooks/use-toast';
import { respond as respondGlosa, REASON_LABELS, type Glosa } from '@/lib/api/glosas';

interface Props {
    glosa: Glosa | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function GlosaRespondModal({ glosa, open, onOpenChange, onSuccess }: Props) {
    const { toast } = useToast();
    const [text, setText] = useState('');
    const [supportUrl, setSupportUrl] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const reset = () => { setText(''); setSupportUrl(null); setSubmitting(false); };

    const handleSubmit = async () => {
        if (!glosa) return;
        if (text.trim().length === 0) {
            toast({ title: 'Escribe tu aclaración', description: 'Cuéntanos qué pasó con este pago.', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        try {
            await respondGlosa(glosa.id, {
                responseText: text.trim(),
                responseFiles: supportUrl ? [supportUrl] : undefined,
            });
            toast({ title: 'Aclaración enviada', description: 'La escuela la revisará y te avisaremos.' });
            reset();
            onOpenChange(false);
            onSuccess?.();
        } catch (err: any) {
            toast({
                title: 'No se pudo enviar',
                description: err?.message || 'Intenta de nuevo en un momento.',
                variant: 'destructive',
            });
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!submitting) { if (!o) reset(); onOpenChange(o); } }}>
            <DialogContent className="w-[95vw] max-w-md">
                <DialogHeader>
                    <DialogTitle>Tu comprobante necesita una aclaración</DialogTitle>
                    <DialogDescription>Cuéntanos qué pasó y, si puedes, sube un soporte adicional.</DialogDescription>
                </DialogHeader>

                {glosa && (
                    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <AlertDescription className="text-sm text-amber-800 dark:text-amber-300">
                            {REASON_LABELS[glosa.reason]}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-2">
                    <Label htmlFor="glosa-response">Tu aclaración</Label>
                    <Textarea
                        id="glosa-response"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Ej: Pagué con el descuento de hermanos / adjunto el comprobante completo / pagué dos meses..."
                        rows={4}
                        disabled={submitting}
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3" /> Soporte adicional (opcional)
                    </Label>
                    <FileUpload
                        bucket="payment-receipts"
                        accept="image/*,application/pdf"
                        onUploadComplete={(url) => setSupportUrl(url)}
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>) : 'Enviar aclaración'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}