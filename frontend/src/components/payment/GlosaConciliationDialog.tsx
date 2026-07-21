/**
 * GlosaConciliationDialog — vista de conciliación del admin (3 columnas):
 *   Esperado (el cobro) | Extraído (OCR + veredicto + imagen) | Respuesta del acudiente.
 * Acciones: Aceptar (nota obligatoria → pago 'paid') / Ratificar (nota → pago 'pending').
 *
 * El signed URL de la imagen se REGENERA al abrir (TTL 15 min) para que no expire
 * mientras el admin lee la respuesta y redacta la nota.
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeReceiptUrl } from '@/lib/normalizeReceiptUrl';
import { useToast } from '@/hooks/use-toast';
import { resolve as resolveGlosa, REASON_ADMIN_LABELS, STATUS_LABELS, type Glosa } from '@/lib/api/glosas';

const fmtCop = (n?: number | null) =>
    typeof n === 'number' ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n) : '—';

async function signReceipt(url?: string | null, ttl = 900): Promise<string | null> {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const path = normalizeReceiptUrl(url);
    const { data } = await supabase.storage.from('payment-receipts').createSignedUrl(path, ttl);
    return data?.signedUrl ?? null;
}

interface Props {
    glosa: Glosa | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function GlosaConciliationDialog({ glosa, open, onOpenChange, onSuccess }: Props) {
    const { toast } = useToast();
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState<null | 'ACEPTADA' | 'RATIFICADA'>(null);
    const [imgUrl, setImgUrl] = useState<string | null>(null);

    const pay = glosa?.payments ?? null;

    // Regenerar el signed URL al abrir (no reusar uno viejo del listado).
    useEffect(() => {
        let alive = true;
        setNote('');
        setImgUrl(null);
        if (open && pay?.receipt_url) {
            signReceipt(pay.receipt_url).then((u) => { if (alive) setImgUrl(u); });
        }
        return () => { alive = false; };
    }, [open, pay?.receipt_url]);

    const handleResolve = async (outcome: 'ACEPTADA' | 'RATIFICADA') => {
        if (!glosa) return;
        if (note.trim().length === 0) {
            toast({ title: 'La nota es obligatoria', description: 'Deja constancia de por qué aceptas o ratificas.', variant: 'destructive' });
            return;
        }
        setSubmitting(outcome);
        try {
            await resolveGlosa(glosa.id, outcome, note.trim());
            toast({
                title: outcome === 'ACEPTADA' ? 'Pago aprobado' : 'Glosa ratificada',
                description: outcome === 'ACEPTADA' ? 'El pago quedó aprobado y el acudiente fue notificado.' : 'El cobro se reactivó y el acudiente fue notificado.',
            });
            onOpenChange(false);
            onSuccess?.();
        } catch (err: any) {
            toast({ title: 'No se pudo resolver', description: err?.message || 'Intenta de nuevo.', variant: 'destructive' });
        } finally {
            setSubmitting(null);
        }
    };

    const files: string[] = Array.isArray(glosa?.response_files) ? (glosa!.response_files as string[]) : [];

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Conciliar aclaración</DialogTitle>
                    <DialogDescription>
                        {glosa && (
                            <>Motivo: <strong>{REASON_ADMIN_LABELS[glosa.reason]}</strong> · Estado: {STATUS_LABELS[glosa.status]}</>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 md:grid-cols-3">
                    {/* Esperado */}
                    <div className="rounded-lg border p-3 space-y-1.5">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Esperado (el cobro)</p>
                        <p className="text-sm"><strong>Concepto:</strong> {pay?.concept || '—'}</p>
                        <p className="text-sm"><strong>Valor:</strong> {fmtCop(pay?.amount)}</p>
                        <p className="text-sm"><strong>Vence:</strong> {pay?.due_date || '—'}</p>
                        <p className="text-sm"><strong>Acudiente:</strong> {pay?.parent?.full_name || '—'}</p>
                    </div>

                    {/* Extraído */}
                    <div className="rounded-lg border p-3 space-y-1.5">
                        <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                            Extraído del comprobante
                            {pay?.receipt_verdict && (
                                <Badge variant="outline" className="text-[10px] py-0 h-5">{pay.receipt_verdict}</Badge>
                            )}
                        </p>
                        <p className="text-sm"><strong>Monto:</strong> {fmtCop(pay?.ocr_amount)} {pay?.ocr_currency && pay.ocr_currency !== 'COP' ? `(${pay.ocr_currency})` : ''}</p>
                        <p className="text-sm"><strong>Banco:</strong> {pay?.ocr_bank || '—'}</p>
                        <p className="text-sm"><strong>Referencia:</strong> {pay?.ocr_reference || '—'}</p>
                        <p className="text-sm"><strong>Fecha:</strong> {pay?.ocr_date || '—'}</p>
                        <p className="text-sm"><strong>Destino:</strong> {pay?.ocr_destination || '—'}</p>
                        {imgUrl ? (
                            <a href={imgUrl} target="_blank" rel="noopener noreferrer">
                                <img src={imgUrl} alt="Comprobante" className="mt-2 max-h-48 w-full object-contain rounded border bg-muted" />
                            </a>
                        ) : pay?.receipt_url ? (
                            <div className="mt-2 h-24 flex items-center justify-center text-xs text-muted-foreground">
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando imagen...
                            </div>
                        ) : null}
                    </div>

                    {/* Respuesta */}
                    <div className="rounded-lg border p-3 space-y-1.5">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Respuesta del acudiente</p>
                        {glosa?.response_text ? (
                            <p className="text-sm whitespace-pre-wrap">{glosa.response_text}</p>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">Aún no ha respondido.</p>
                        )}
                        {files.length > 0 && (
                            <div className="pt-1 space-y-1">
                                {files.map((f, i) => (
                                    <Button
                                        key={i}
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-blue-600"
                                        onClick={async () => {
                                            const u = await signReceipt(f);
                                            if (u) window.open(u, '_blank', 'noopener,noreferrer');
                                        }}
                                    >
                                        <FileText className="h-3.5 w-3.5 mr-1" /> Soporte {i + 1}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2 pt-2">
                    <Label htmlFor="glosa-note">Nota de resolución (obligatoria)</Label>
                    <Textarea
                        id="glosa-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Deja constancia de tu decisión (queda en el historial)."
                        rows={2}
                        disabled={!!submitting}
                    />
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!submitting}>Cerrar</Button>
                    <Button
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleResolve('RATIFICADA')}
                        disabled={!!submitting}
                    >
                        {submitting === 'RATIFICADA' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                        Ratificar (sigue pendiente)
                    </Button>
                    <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleResolve('ACEPTADA')}
                        disabled={!!submitting}
                    >
                        {submitting === 'ACEPTADA' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Aceptar (aprobar pago)
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
