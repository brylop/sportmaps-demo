import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { emptyDiscount, formatPesos, type GlobalDiscountDraft } from '@/lib/cobrosYPagos';
import { DiscountControl } from './DiscountControl';

export interface GlobalTarget {
    ref: string;
    label: string;
    checked: boolean;
    share?: number;
}

interface GlobalDiscountProps {
    mode: 'single' | 'multi';
    value: GlobalDiscountDraft;
    onChange: (next: GlobalDiscountDraft) => void;
    targets: GlobalTarget[];
    onToggleTarget: (ref: string, checked: boolean) => void;
    error?: string | null;
}

/**
 * Descuento general sobre la selección (§15.3). Se aplica DESPUÉS de los de
 * cada línea; % igual por línea; valor fijo prorrateado por valor (resto
 * mayor). Por defecto aplica a las líneas sin descuento propio (Q-D2). En modo
 * varios es «Descuento para todos»: el mismo % o valor en cada cobro.
 */
export function GlobalDiscount({ mode, value, onChange, targets, onToggleTarget, error }: GlobalDiscountProps) {
    return (
        <div className="space-y-2" data-testid="cyp-global-discount">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor="cyp-global-on" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {mode === 'multi' ? 'Descuento para todos' : 'Descuento general'}
                </Label>
                <Switch
                    id="cyp-global-on"
                    checked={value.enabled}
                    onCheckedChange={(v) => onChange(v ? { ...emptyDiscount(), ...value, enabled: true } : { ...value, enabled: false })}
                />
            </div>
            {value.enabled && (
                <>
                    <DiscountControl
                        idPrefix="global"
                        value={value}
                        onChange={(next) => onChange(next ? { ...next, enabled: true } : { ...value, enabled: false })}
                    />
                    {targets.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[11px] text-muted-foreground">Sobre:</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                                {targets.map((t) => (
                                    <div key={t.ref} className="flex items-center gap-1.5">
                                        <Checkbox id={`g-${t.ref}`} checked={t.checked} onCheckedChange={(v) => onToggleTarget(t.ref, v === true)} />
                                        <Label htmlFor={`g-${t.ref}`} className="text-xs font-normal">
                                            {t.label}{t.checked && t.share ? <span className="text-violet-700 dark:text-violet-300"> −{formatPesos(t.share)}</span> : null}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                        {mode === 'multi'
                            ? 'El mismo descuento en cada cobro de cada atleta.'
                            : 'Se reparte entre los cobros marcados en proporción a su valor. No toca recargos de mora.'}
                    </p>
                    {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
                </>
            )}
        </div>
    );
}
