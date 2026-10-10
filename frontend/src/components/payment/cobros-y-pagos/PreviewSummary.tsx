import { useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { REASON_LABEL, SKIP_REASON_LABEL, WARNING_LABEL, formatPesos } from '@/lib/cobrosYPagos';
import type { ChargeBatchPreview, ChargeOverride, PreviewSkipped } from '@/lib/api/chargeBatches';

export interface LocalTotals {
    toCreate: { n: number; total: number };
    toPay: { n: number; total: number };
    discountsTotal: number;
    lateFeeWaived: number;
    exonerated: number;
    listTotal: number;
    perAthleteAmounts?: boolean;
}

interface PreviewSummaryProps {
    mode: 'single' | 'multi';
    local: LocalTotals;
    preview: ChargeBatchPreview | null;
    fresh: boolean;
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    overrides: ChargeOverride[];
    onToggleOverride: (o: ChargeOverride, on: boolean) => void;
    withoutPayer?: number;
    omitWithoutPayer?: boolean;
    onOmitWithoutPayer?: (v: boolean) => void;
}

const skippedAthleteId = (s: PreviewSkipped) => (typeof s.athlete === 'string' ? s.athlete : s.athlete.id);
const skippedAthleteName = (s: PreviewSkipped) => (typeof s.athlete === 'string' ? '' : s.athlete.name ?? '');

/**
 * Resumen y vista previa OBLIGATORIA (§10.3, R2): «Se van a crear N cobros por
 * $X», lo que se omite y por qué (con «cobrar igual» para los omitibles:
 * seguro en 12 meses, misma línea hoy), y los avisos (sin acudiente, débito
 * automático, > 50 %). Antes de la vista previa muestra la estimación local.
 */
export function PreviewSummary({
    mode, local, preview, fresh, loading, error, onRefresh, overrides, onToggleOverride,
    withoutPayer, omitWithoutPayer, onOmitWithoutPayer,
}: PreviewSummaryProps) {
    const [open, setOpen] = useState(false);
    const p = fresh ? preview : null;
    const toCreate = p?.to_create ?? (p ? { n: p.rows_to_create, total: p.total_amount } : local.toCreate);
    const toPay = p?.to_pay ?? local.toPay;
    const discounts = p?.discounts?.total ?? local.discountsTotal;
    const waived = p?.late_fee_waived ?? local.lateFeeWaived;
    const exonerated = p?.exonerated ?? local.exonerated;
    const skipped = p?.skipped ?? [];
    const warnings = p?.warnings_count ?? {};
    const byReason = p?.discounts?.by_reason ?? {};

    return (
        <div className="rounded-xl border bg-muted/30 p-3 space-y-2 text-sm" data-testid="cyp-preview" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {p ? 'Vista previa' : mode === 'multi' ? 'Estimado (falta la vista previa)' : 'Resumen'}
                </p>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onRefresh} disabled={loading}>
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                    Actualizar
                </Button>
            </div>

            {toCreate.n > 0 && (
                <p data-testid="cyp-preview-create">
                    Se {toCreate.n === 1 ? 'crea' : mode === 'multi' ? 'van a crear' : 'crean'} <b>{toCreate.n} {toCreate.n === 1 ? 'cobro' : 'cobros'}</b> por <b>{formatPesos(toCreate.total)}</b>
                    {mode === 'multi' && local.perAthleteAmounts && !p ? ' (más las mensualidades de cada atleta)' : ''}
                </p>
            )}
            {mode === 'multi' && (p?.list_total ?? local.listTotal) > 0 && discounts > 0 && (
                <p className="text-xs text-muted-foreground">
                    Valor de lista {formatPesos(p?.list_total ?? local.listTotal)} · descuentos −{formatPesos(discounts)}
                    {Object.keys(byReason).length > 0 ? ` (${Object.keys(byReason).map((r) => REASON_LABEL[r] ?? r).join(', ')})` : ''}
                </p>
            )}
            {mode === 'single' && toPay.n > 0 && (
                <p data-testid="cyp-preview-pay">Se registra el pago de <b>{toPay.n} {toPay.n === 1 ? 'cobro' : 'cobros'}</b> por <b>{formatPesos(toPay.total)}</b></p>
            )}
            {mode === 'single' && (discounts > 0 || waived > 0 || exonerated > 0) && (
                <p className="text-xs text-violet-700 dark:text-violet-300">
                    {discounts > 0 && <>Descuentos −{formatPesos(discounts)}</>}
                    {discounts > 0 && waived > 0 && ' · '}
                    {waived > 0 && <>Recargo condonado −{formatPesos(waived)}</>}
                    {exonerated > 0 && <>{(discounts > 0 || waived > 0) ? ' · ' : ''}{exonerated} sin cobrar</>}
                </p>
            )}

            {skipped.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-semibold">Se omiten {skipped.length}:</p>
                    {skipped.slice(0, 12).map((s, i) => {
                        const athlete = skippedAthleteId(s);
                        const o: ChargeOverride = { athlete, line_idx: s.line_idx, action: 'force' };
                        const forced = overrides.some((x) => x.athlete === athlete && x.line_idx === s.line_idx && x.action === 'force');
                        return (
                            <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span>{skippedAthleteName(s) ? `${skippedAthleteName(s)} — ` : ''}{SKIP_REASON_LABEL[s.reason] ?? s.reason}{s.detail ? ` (${s.detail})` : ''}</span>
                                {s.overridable && (
                                    <div className="flex items-center gap-1.5">
                                        <Checkbox id={`ov-${i}`} checked={forced} onCheckedChange={(v) => onToggleOverride(o, v === true)} />
                                        <Label htmlFor={`ov-${i}`} className="text-xs font-normal">Cobrar igual</Label>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {skipped.length > 12 && <p className="text-xs text-muted-foreground">…y {skipped.length - 12} más.</p>}
                </div>
            )}

            {(withoutPayer ?? warnings.sin_acudiente ?? 0) > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {warnings.sin_acudiente ?? withoutPayer} {WARNING_LABEL.sin_acudiente}</span>
                    {mode === 'multi' && onOmitWithoutPayer && (
                        <div className="flex items-center gap-1.5">
                            <Checkbox id="omit-np" checked={!!omitWithoutPayer} onCheckedChange={(v) => onOmitWithoutPayer(v === true)} />
                            <Label htmlFor="omit-np" className="text-xs font-normal">Omitirlos</Label>
                        </div>
                    )}
                </div>
            )}
            {Object.entries(warnings).filter(([k, n]) => k !== 'sin_acudiente' && n > 0).map(([k, n]) => (
                <p key={k} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {n} {WARNING_LABEL[k] ?? k}
                </p>
            ))}

            {mode === 'multi' && p?.athletes && p.athletes.length > 0 && (
                <Collapsible open={open} onOpenChange={setOpen}>
                    <CollapsibleTrigger asChild>
                        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs">
                            Detalle por atleta <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1 max-h-48 overflow-y-auto space-y-0.5 text-xs">
                        {p.athletes.map((a) => (
                            <p key={a.id}>
                                {a.name}{a.enrollment_label ? ` · ${a.enrollment_label}` : ''}
                                {a.suggested_monthly ? ` · mensualidad ${formatPesos(a.suggested_monthly)}` : ''}
                                {a.payer_linked === false ? ' · sin acudiente' : ''}{a.autopay ? ' · débito automático' : ''}
                            </p>
                        ))}
                    </CollapsibleContent>
                </Collapsible>
            )}

            {p?.errors && p.errors.length > 0 && p.errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive" role="alert">{e.message ?? e.code}</p>
            ))}
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
            {!fresh && preview && !loading && <p className="text-[11px] text-muted-foreground">Cambiaste algo: la vista previa se está actualizando.</p>}
        </div>
    );
}
