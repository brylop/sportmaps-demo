import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatHoras, formatPesos } from '@/lib/cobrosYPagos';
import { formatHourBankMinutes } from '@/lib/hourBank';
import type { ChargeBatchResult } from '@/lib/api/chargeBatches';

interface ResultScreenProps {
    result: ChargeBatchResult;
    onClose: () => void;
    onViewOperation?: () => void;
    onAnnul?: () => void;
    onAnother?: () => void;
    /** Reintenta sumar las horas vendidas al banco (solo si no se sumaron). */
    onRetryHours?: () => void;
    retryingHours?: boolean;
    /** Horas que se separaron de esta operación y siguen sin cobrar (segunda operación, con su propio pago). */
    horasPorRegistrar?: { horas: number; monto: number };
    onRegisterHours?: () => void;
}

/** Pantalla de resultado (§10.4): «2 cobros creados, 3 pagos registrados, descuentos $72.300». */
export function ResultScreen({ result, onClose, onViewOperation, onAnnul, onAnother, onRetryHours, retryingHours, horasPorRegistrar, onRegisterHours }: ResultScreenProps) {
    const hb = result.hour_bank_grant;
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
            {hb?.ok && (
                <p className="text-sm text-emerald-700 dark:text-emerald-400" data-testid="cyp-result-horas-ok">
                    {hb.duplicated ? 'Las horas ya estaban sumadas al banco.' : 'Horas sumadas al banco'}
                    {hb.hours != null ? `: ${formatHoras(hb.hours)} h` : ''}
                    {hb.available_minutes != null ? ` · disponibles ahora ${formatHourBankMinutes(hb.available_minutes)}` : ''}.
                </p>
            )}
            {hb && !hb.ok && (
                <div className="max-w-md rounded-lg border border-amber-400/50 bg-amber-500/10 p-3 text-left text-sm space-y-2" role="alert" data-testid="cyp-result-horas-error">
                    <p className="flex items-start gap-2 font-semibold text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> Las horas NO se sumaron al banco
                    </p>
                    <p className="text-xs text-amber-900/90 dark:text-amber-200">{hb.message ?? 'Avisa a soporte.'}</p>
                    {onRetryHours && hb.reason !== 'sin_cobro' && (
                        <Button size="sm" variant="outline" disabled={retryingHours} onClick={onRetryHours} data-testid="cyp-result-horas-reintentar">
                            {retryingHours ? 'Reintentando…' : 'Reintentar suma de horas'}
                        </Button>
                    )}
                </div>
            )}
            {horasPorRegistrar && onRegisterHours && (
                <div className="max-w-md rounded-lg border border-primary/30 bg-primary/5 p-3 text-left text-sm space-y-2" data-testid="cyp-result-horas-pendientes">
                    <p className="font-semibold">Faltan las horas adicionales</p>
                    <p className="text-xs text-muted-foreground">
                        Quedaron aparte {formatHoras(horasPorRegistrar.horas)} h por {formatPesos(horasPorRegistrar.monto)}: se registran en una segunda operación con su propio pago.
                    </p>
                    <Button size="sm" onClick={onRegisterHours} data-testid="cyp-result-registrar-horas">Registrar las horas ahora</Button>
                </div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
                {onViewOperation && <Button variant="outline" onClick={onViewOperation}>Ver operación</Button>}
                {onAnnul && created > 0 && <Button variant="outline" className="text-destructive" onClick={onAnnul}>Anular lote</Button>}
                {onAnother && <Button variant="outline" onClick={onAnother}>Otra operación</Button>}
                <Button onClick={onClose}>Cerrar</Button>
            </div>
        </div>
    );
}
