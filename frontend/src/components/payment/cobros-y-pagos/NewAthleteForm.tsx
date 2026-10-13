import { useEffect, useState } from 'react';
import { Loader2, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { chargeBatchesApi, type AthleteDuplicate } from '@/lib/api/chargeBatches';
import type { NewAthleteDraft } from './drafts';


function isAdultByBirth(dob: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
    const [y, m, d] = dob.split('-').map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
    return age >= 18;
}

interface NewAthleteFormProps {
    value: NewAthleteDraft;
    onChange: (next: NewAthleteDraft) => void;
    onCancel: () => void;
    /** «Usar este»: cobrarle al que ya existe. */
    onUseExisting: (dup: AthleteDuplicate) => void;
    /** Coincidencias que devolvió la vista previa (409 ATLETA_DUPLICADO o `duplicates`). */
    serverDuplicates?: AthleteDuplicate[];
}

/**
 * «+ Atleta nuevo» (§16): registro mínimo dentro del modal. Nada se crea hasta
 * confirmar la operación completa: la ficha nace en la misma transacción que
 * los cobros (D17). Busca duplicados mientras se escribe (nombre, documento,
 * teléfono); el teléfono solo es «mismo acudiente», informativo.
 */
export function NewAthleteForm({ value: d, onChange, onCancel, onUseExisting, serverDuplicates }: NewAthleteFormProps) {
    const [matches, setMatches] = useState<AthleteDuplicate[]>([]);
    const [searching, setSearching] = useState(false);
    const set = (patch: Partial<NewAthleteDraft>) => onChange({ ...d, ...patch, allow_duplicate: patch.allow_duplicate ?? (('full_name' in patch || 'doc_number' in patch || 'guardian_phone' in patch) ? false : d.allow_duplicate) });

    useEffect(() => {
        const q = d.full_name.trim();
        const doc = d.doc_number.trim();
        const phone = d.guardian_phone.replace(/\D/g, '');
        if (q.length < 3 && doc.length < 5 && phone.length < 7) { setMatches([]); return; }
        let cancelled = false;
        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const r = await chargeBatchesApi.searchAthletes({ q: q || undefined, doc: doc || undefined, phone: phone.length >= 7 ? phone : undefined });
                if (!cancelled) setMatches(r.matches ?? []);
            } catch {
                if (!cancelled) setMatches([]);
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, 450);
        return () => { cancelled = true; clearTimeout(t); };
    }, [d.full_name, d.doc_number, d.guardian_phone]);

    const all = [...(serverDuplicates ?? []), ...matches.filter((m) => !(serverDuplicates ?? []).some((s) => s.id === m.id))];
    const matchedBy = (m: AthleteDuplicate) => (Array.isArray(m.matched_by) ? m.matched_by : [m.matched_by]).join(' + ');
    const onlyPhone = (m: AthleteDuplicate) => {
        const by = Array.isArray(m.matched_by) ? m.matched_by : [m.matched_by];
        return by.length === 1 && /tel/i.test(by[0]);
    };
    const realDups = all.filter((m) => !onlyPhone(m));
    const sameGuardian = all.filter(onlyPhone);

    return (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3" data-testid="cyp-new-athlete-form">
            <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Atleta nuevo</p>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel} aria-label="Cancelar atleta nuevo">
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <RadioGroup value={d.kind} onValueChange={(v) => set({ kind: v as NewAthleteDraft['kind'], doc_type: v === 'adulto' ? 'CC' : 'TI' })} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem id="na-menor" value="menor" /><Label htmlFor="na-menor">Menor</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem id="na-adulto" value="adulto" /><Label htmlFor="na-adulto">Adulto</Label></div>
            </RadioGroup>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="na-name">Nombre completo *</Label>
                    <Input id="na-name" value={d.full_name} onChange={(e) => set({ full_name: e.target.value })} autoComplete="off" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="na-doc">Documento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <div className="flex gap-2">
                        <Select value={d.doc_type} onValueChange={(v) => set({ doc_type: v })}>
                            <SelectTrigger className="w-20" aria-label="Tipo de documento"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {['TI', 'RC', 'CC', 'CE', 'PPT', 'PA'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Input id="na-doc" value={d.doc_number} inputMode="numeric" onChange={(e) => set({ doc_number: e.target.value })} />
                    </div>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="na-dob">Fecha de nacimiento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <Input id="na-dob" type="date" value={d.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
                </div>
                {d.kind === 'menor' && (
                    <div className="space-y-1">
                        <Label htmlFor="na-guardian">Acudiente</Label>
                        <Input id="na-guardian" value={d.guardian_name} onChange={(e) => set({ guardian_name: e.target.value })} />
                    </div>
                )}
                <div className="space-y-1">
                    <Label htmlFor="na-phone">{d.kind === 'menor' ? 'Teléfono del acudiente *' : 'Teléfono *'}</Label>
                    <Input id="na-phone" type="tel" inputMode="tel" value={d.guardian_phone} onChange={(e) => set({ guardian_phone: e.target.value })} placeholder="+57 310 555 0101" />
                </div>
            </div>
            {d.kind === 'menor' && isAdultByBirth(d.date_of_birth) && (
                <p className="text-xs text-amber-700 dark:text-amber-400">Con esa fecha tiene 18 años o más: ¿es «Adulto»?</p>
            )}
            {searching && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Buscando si ya existe…</p>}
            {realDups.length > 0 && (
                <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2" role="status">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">¿Es alguno de estos?</p>
                    {realDups.map((m) => (
                        <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span>
                                <b>{m.full_name}</b>
                                {m.team_name ? ` · ${m.team_name}` : ''}
                                {m.doc_masked ? ` · doc ${m.doc_masked}` : ''}
                                {m.guardian ? ` · acud. ${m.guardian}` : ''}
                                <span className="block text-muted-foreground">coincide: {matchedBy(m)}</span>
                            </span>
                            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => onUseExisting(m)}>
                                <UserCheck className="h-4 w-4 mr-1" /> Usar este
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button" size="sm" variant={d.allow_duplicate ? 'secondary' : 'ghost'} className="h-8 text-xs"
                        onClick={() => set({ allow_duplicate: !d.allow_duplicate })}
                        aria-pressed={d.allow_duplicate}
                    >
                        {d.allow_duplicate ? 'Se creará igual (queda registrado)' : 'Es otra persona: crear igual'}
                    </Button>
                </div>
            )}
            {sameGuardian.length > 0 && realDups.length === 0 && (
                <p className="text-xs text-muted-foreground">Mismo acudiente que {sameGuardian.map((m) => m.full_name).join(', ')} (puede ser un hermano).</p>
            )}
            <p className="text-[11px] text-muted-foreground">
                La ficha se crea al confirmar, junto con los cobros. Queda sin plan: solo admite cobros únicos (clase suelta, torneo, artículos…).
            </p>
        </div>
    );
}

