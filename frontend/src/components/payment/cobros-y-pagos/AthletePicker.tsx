import { useMemo, useState } from 'react';
import { ChevronsUpDown, UserPlus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { payerLinked, type SchoolAthlete } from './types';

const norm = (s: string | null | undefined) =>
    (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface AthletePickerProps {
    athletes: SchoolAthlete[];
    loading?: boolean;
    selectedId: string | null;
    onSelect: (id: string) => void;
    /** Atleta fijo (abierto desde la ficha): no se puede cambiar. */
    locked?: boolean;
    onNewAthlete?: () => void;
}

/**
 * Buscador del atleta (modo un atleta): nombre, acudiente o teléfono del
 * acudiente, sobre las tres identidades de `school_athletes`. Debajo, el plan y
 * si tiene acudiente vinculado (D17: sin acudiente se cobra igual).
 */
export function AthletePicker({ athletes, loading, selectedId, onSelect, locked, onNewAthlete }: AthletePickerProps) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const selected = athletes.find((a) => a.id === selectedId) ?? null;

    const filtered = useMemo(() => {
        const term = norm(q).trim();
        const digits = q.replace(/\D/g, '');
        const list = !term
            ? athletes
            : athletes.filter((a) =>
                norm(a.full_name).includes(term)
                || norm(a.parent_name).includes(term)
                || (digits.length >= 4 && (a.parent_phone ?? '').replace(/\D/g, '').includes(digits)));
        return list.slice(0, 80);
    }, [athletes, q]);

    return (
        <div className="space-y-1.5">
            <div className="flex flex-col sm:flex-row gap-2">
                <Popover open={open && !locked} onOpenChange={setOpen}>
                    <PopoverTrigger asChild disabled={loading || locked}>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            aria-label="Atleta"
                            className="w-full sm:flex-1 h-11 justify-between font-semibold text-left"
                            data-testid="cyp-athlete-picker"
                        >
                            <span className="truncate">{selected?.full_name ?? (loading ? 'Cargando deportistas…' : 'Elige el atleta')}</span>
                            {!locked && <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-2" align="start">
                        <Input
                            autoFocus
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Nombre, acudiente o teléfono…"
                            className="h-10 mb-2"
                            aria-label="Buscar atleta"
                        />
                        <div className="max-h-64 overflow-y-auto space-y-0.5" role="listbox">
                            {filtered.length === 0 ? (
                                <div className="p-3 text-center text-xs text-muted-foreground space-y-2">
                                    <p>No aparece.</p>
                                    {onNewAthlete && (
                                        <Button type="button" size="sm" variant="outline" onClick={() => { setOpen(false); onNewAthlete(); }}>
                                            <UserPlus className="h-4 w-4 mr-1" /> Atleta nuevo
                                        </Button>
                                    )}
                                </div>
                            ) : filtered.map((a) => (
                                <button
                                    key={a.id}
                                    type="button"
                                    role="option"
                                    aria-selected={a.id === selectedId}
                                    onClick={() => { onSelect(a.id); setOpen(false); setQ(''); }}
                                    className={cn(
                                        'w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted flex flex-col',
                                        a.id === selectedId && 'bg-primary/10 text-primary',
                                    )}
                                >
                                    <span className="font-semibold">{a.full_name}</span>
                                    <span className="text-[11px] text-muted-foreground">
                                        {[a.team_name, a.plan_name].filter(Boolean).join(' · ') || 'Sin plan'}
                                        {a.parent_name ? ` · Acud. ${a.parent_name}` : ''}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
                {onNewAthlete && !locked && (
                    <Button type="button" variant="ghost" size="sm" className="h-11 shrink-0" onClick={onNewAthlete} data-testid="cyp-new-athlete">
                        <UserPlus className="h-4 w-4 mr-1" /> Atleta nuevo
                    </Button>
                )}
            </div>
            {selected && (
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{[selected.team_name, selected.plan_name].filter(Boolean).join(' · ') || 'Sin plan'}</span>
                    {payerLinked(selected) ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {selected.athlete_type === 'adult' ? 'Paga él mismo' : `Acudiente ${selected.parent_name ?? 'vinculado'}`}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Sin acudiente vinculado: se le cobra igual, pero no podrá pagar en línea hasta vincularlo
                        </span>
                    )}
                    {selected.enrollment_status && selected.enrollment_status !== 'active' && (
                        <span className="text-amber-700 dark:text-amber-400">· Inscripción {selected.enrollment_status === 'paused' ? 'en pausa' : 'no activa'}</span>
                    )}
                </p>
            )}
        </div>
    );
}
