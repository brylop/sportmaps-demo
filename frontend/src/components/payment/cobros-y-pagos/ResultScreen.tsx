import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPesos } from '@/lib/cobrosYPagos';
import type { ChargeBatchResult } from '@/lib/api/chargeBatches';

interface ResultScreenProps {
    result: ChargeBatchResult;
    onClose: () => void;
    onViewOperation?: () => void;
    onAnnul?: () => void;
    onAnother?: () => void;
}

/** Pantalla de resultado (§10.4): «2 cobros creados, 3 pagos registrados, descuentos $72.300». */
export function ResultScreen({ result, onClose, onViewOperation, onAnnul, onAnother }: ResultScreenProps) {
    const created = result.rows_created ?? 0;
    const paid = result.payments_registered ?? ((result.paid_ids?.length ?? 0) + (result.partial_ids?.length ?? 0));
    const parts: string[] = [];
    if (created > 0) parts.push(`${created} ${created === 1 ? 'cobro creado' : 'cobros creados'}${result.total_amount ? ` por ${formatPesos(result.total_amount)}` : ''}`);
    if (paid > 0) parts.push(`${paid} ${paid === 1 ? 'pago registrado' : 'pagos registrados'}${result.paid_total ? ` (${formatPesos(result.paid_total)})` : ''}`);
    if ((result.discount_total ?? 0) > 0) parts.push(`descuentos ${formatPesos(result.discount_total!)}`);
    if ((result.late_fee_waived_total ?? 0) > 0) parts.push(`recargo condonado ${formatPesos(result.late_fee_waived_total!)}`);
    if ((result.partial_ids?.length ?? 0) > 0) parts.push(`${result.partial_ids!.length} quedan con abono parcial`);
    const skipped = result.skipped?.length ?? 0;

    return (
        <div className="flex flex-col items-center text-center gap-4 py-8 px-4" data-testid="cyp-result">
            <div className="rounded-full bg-emerald-500/10 p-3"><CheckCircle2 className="h-8 w-8 text-emerald-600" /></div>
            <div className="space-y-1">
                <p className="text-lg font-bold">{result.duplicated ? 'Esta operación ya estaba registrada' : 'Listo'}</p>
                <p className="text-sm text-muted-foreground">{parts.length ? `${parts.join(', ')}.` : 'Se guardaron los cambios.'}</p>
                {skipped > 0 && <p className="text-xs text-muted-foreground">Se omitieron {skipped} (ya existían o no aplicaban).</p>}
                {result.duplicated && <p className="text-xs text-muted-foreground">No se creó nada dos veces.</p>}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                {onViewOperation && <Button variant="outline" onClick={onViewOperation}>Ver operación</Button>}
                {onAnnul && created > 0 && <Button variant="outline" className="text-destructive" onClick={onAnnul}>Anular lote</Button>}
                {onAnother && <Button variant="outline" onClick={onAnother}>Otra operación</Button>}
                <Button onClick={onClose}>Cerrar</Button>
            </div>
        </div>
    );
}
