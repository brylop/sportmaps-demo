import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
    REASON_OPTIONS,
    emptyDiscount,
    formatPesos,
    validateDiscountDraft,
    type DiscountDraft,
} from '@/lib/cobrosYPagos';
import type { ReasonCode } from '@/lib/api/chargeBatches';

interface DiscountControlProps {
    idPrefix: string;
    value: DiscountDraft | null;
    onChange: (next: DiscountDraft | null) => void;
    /** Efecto en pesos ya calculado (para «−$72.300 → $650.700»). */
    effect?: number;
    resulting?: number;
    /** «No cobrar» (exoneración, §6.5). Solo si se pasa `onExonerateChange`. */
    exonerate?: { reason_text: string } | null;
    onExonerateChange?: (next: { reason_text: string } | null) => void;
    /** Qué pasa al exonerar: «Beca del mes…», «no se crea», «se anula». */
    exonerateHint?: string;
    /** Motivos que no aplican en este contexto (p. ej. condonación en un cobro sin recargo). */
    hideReasons?: ReasonCode[];
    defaultReason?: ReasonCode;
    className?: string;
}

/**
 * `[valor][% | $][Motivo]` con su efecto en pesos y la opción «No cobrar» en el
 * mismo control (§10.2). El acudiente nunca ve esto (D13): el modal solo lo
 * abre el personal con canManageCharges.
 */
export function DiscountControl({
    idPrefix, value, onChange, effect, resulting, exonerate, onExonerateChange, exonerateHint,
    hideReasons = ['condonacion_mora'], defaultReason, className,
}: DiscountControlProps) {
    const d = value ?? emptyDiscount(defaultReason ?? '');
    const error = value ? validateDiscountDraft(value) : null;
    const set = (patch: Partial<DiscountDraft>) => onChange({ ...d, ...patch });

    if (exonerate) {
        return (
            <div className={cn('rounded-lg border border-violet-300/60 bg-violet-50/60 dark:bg-violet-950/20 p-3 space-y-2', className)}>
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">No cobrar{exonerateHint ? `: ${exonerateHint}` : ''}</p>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onExonerateChange?.(null)}>
                        Quitar
                    </Button>
                </div>
                <Label htmlFor={`${idPrefix}-exo`} className="sr-only">Motivo de no cobrar</Label>
                <Input
                    id={`${idPrefix}-exo`}
                    value={exonerate.reason_text}
                    placeholder="Motivo (obligatorio)"
                    onChange={(e) => onExonerateChange?.({ reason_text: e.target.value })}
                    className="h-9 text-sm"
                />
            </div>
        );
    }

    return (
        <div className={cn('rounded-lg border border-violet-300/60 bg-violet-50/40 dark:bg-violet-950/20 p-3 space-y-2', className)} data-testid={`${idPrefix}-discount`}>
            <div className="grid grid-cols-[minmax(0,6rem)_auto_minmax(0,1fr)] gap-2 items-center">
                <Label htmlFor={`${idPrefix}-dval`} className="sr-only">Valor del descuento</Label>
                <Input
                    id={`${idPrefix}-dval`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={d.value || ''}
                    placeholder={d.basis === 'porcentaje' ? '%' : '$'}
                    onChange={(e) => set({ value: Number(e.target.value) || 0 })}
                    className="h-9 text-sm"
                />
                <ToggleGroup
                    type="single"
                    size="sm"
                    value={d.basis}
                    onValueChange={(v) => v && set({ basis: v as DiscountDraft['basis'] })}
                    aria-label="Tipo de descuento"
                >
                    <ToggleGroupItem value="porcentaje" aria-label="Porcentaje" className="h-9 px-2.5">%</ToggleGroupItem>
                    <ToggleGroupItem value="valor" aria-label="Valor fijo" className="h-9 px-2.5">$</ToggleGroupItem>
                </ToggleGroup>
                <Select value={d.reason_code || undefined} onValueChange={(v) => set({ reason_code: v as ReasonCode })}>
                    <SelectTrigger className="h-9 text-sm" aria-label="Motivo del descuento">
                        <SelectValue placeholder="Motivo" />
                    </SelectTrigger>
                    <SelectContent>
                        {REASON_OPTIONS.filter((o) => !hideReasons.includes(o.value)).map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {d.reason_code === 'otro' && (
                <Input
                    aria-label="Escribe el motivo"
                    value={d.reason_text}
                    placeholder="¿Cuál motivo?"
                    onChange={(e) => set({ reason_text: e.target.value })}
                    className="h-9 text-sm"
                />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-violet-700 dark:text-violet-300 font-medium">
                    {effect && effect > 0
                        ? <>−{formatPesos(effect)}{resulting != null ? <> → <b>{formatPesos(resulting)}</b></> : null}</>
                        : 'Sin efecto todavía'}
                </span>
                <div className="flex gap-1">
                    {onExonerateChange && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { onChange(null); onExonerateChange({ reason_text: '' }); }}>
                            No cobrar
                        </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange(null)}>
                        Quitar descuento
                    </Button>
                </div>
            </div>
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
            {(d.reason_code === 'convenio' || d.reason_code === 'beca') && (
                <p className="text-[11px] text-muted-foreground">¿Todos los meses? Eso es la tarifa del atleta: cámbiala en su inscripción.</p>
            )}
        </div>
    );
}
