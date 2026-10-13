import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { chargeBatchesApi, type AthleteRef, type TargetAthlete, type TargetKind } from '@/lib/api/chargeBatches';
import type { MultiTargetValue } from './drafts';
import { athleteRefOf, payerLinked, type SchoolAthlete } from './types';


interface Option { id: string; name: string }

interface MultiTargetPickerProps {
    schoolId: string | null;
    teams: Option[];
    athletes: SchoolAthlete[];
    value: MultiTargetValue;
    onChange: (next: MultiTargetValue) => void;
    /** Resultado: a quiénes y cómo se eligieron. */
    onResolved: (r: { target: { kind: TargetKind; ids: string[] }; athletes: AthleteRef[]; withoutPayer: number; label: string }) => void;
}

/**
 * «¿A quiénes?» (§10.3): equipo / categoría / plan (la lista la arma el BFF con
 * GET /charge-batches/targets: solo inscripciones activas, pausados con casilla)
 * o a mano. El personal puede quitar atletas de la lista.
 */
export function MultiTargetPicker({ schoolId, teams, athletes, value, onChange, onResolved }: MultiTargetPickerProps) {
    const [categories, setCategories] = useState<Option[]>([]);
    const [plans, setPlans] = useState<Option[]>([]);
    const [groupAthletes, setGroupAthletes] = useState<TargetAthlete[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const set = (patch: Partial<MultiTargetValue>) => onChange({ ...value, ...patch });

    useEffect(() => {
        if (!schoolId) return;
        let cancelled = false;
        (async () => {
            const [cats, pls] = await Promise.all([
                supabase.from('school_categories').select('id, name').eq('school_id', schoolId).eq('is_active', true).order('sort_order'),
                supabase.from('offering_plans').select('id, name').eq('school_id', schoolId).eq('is_active', true).order('sort_order'),
            ]);
            if (cancelled) return;
            setCategories((cats.data ?? []) as Option[]);
            setPlans((pls.data ?? []) as Option[]);
        })();
        return () => { cancelled = true; };
    }, [schoolId]);

    useEffect(() => {
        if (value.kind === 'list' || !value.groupId) { setGroupAthletes([]); setError(null); return; }
        let cancelled = false;
        setLoading(true);
        setError(null);
        chargeBatchesApi.targets({ kind: value.kind, id: value.groupId, include_paused: value.includePaused })
            .then((r) => { if (!cancelled) setGroupAthletes(r.athletes ?? []); })
            .catch((e: Error) => { if (!cancelled) { setGroupAthletes([]); setError(e.message); } })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [value.kind, value.groupId, value.includePaused]);

    const groupOptions = value.kind === 'team' ? teams : value.kind === 'category' ? categories : plans;
    const groupName = groupOptions.find((o) => o.id === value.groupId)?.name ?? '';

    const resolved = useMemo(() => {
        if (value.kind === 'list') {
            const chosen = athletes.filter((a) => value.manual.includes(a.id));
            return {
                target: { kind: 'list' as const, ids: chosen.map((a) => a.id) },
                athletes: chosen.map(athleteRefOf),
                withoutPayer: chosen.filter((a) => !payerLinked(a)).length,
                label: `${chosen.length} atletas elegidos a mano`,
            };
        }
        const kept = groupAthletes.filter((a) => !value.excluded.includes(a.id));
        const kindLabel = value.kind === 'team' ? 'Equipo' : value.kind === 'category' ? 'Categoría' : 'Plan';
        return {
            target: { kind: value.kind, ids: value.groupId ? [value.groupId] : [] },
            athletes: kept.map((a) => ({ type: a.type, id: a.id })),
            withoutPayer: kept.filter((a) => a.payer_linked === false).length,
            label: value.groupId ? `${kindLabel} ${groupName}` : '',
        };
    }, [value, athletes, groupAthletes, groupName]);

    useEffect(() => { onResolved(resolved); }, [resolved]); // eslint-disable-line react-hooks/exhaustive-deps

    const manualFiltered = useMemo(() => {
        const t = q.trim().toLowerCase();
        return (t ? athletes.filter((a) => (a.full_name ?? '').toLowerCase().includes(t)) : athletes).slice(0, 150);
    }, [athletes, q]);

    return (
        <div className="space-y-3" data-testid="cyp-multi-target">
            <RadioGroup
                value={value.kind}
                onValueChange={(v) => set({ kind: v as MultiTargetValue['kind'], groupId: null, excluded: [] })}
                className="flex flex-wrap gap-x-4 gap-y-2"
                aria-label="Cómo elegir a los atletas"
            >
                {([['team', 'Equipo'], ['category', 'Categoría'], ['plan', 'Plan'], ['list', 'A mano']] as const).map(([k, label]) => (
                    <div key={k} className="flex items-center gap-2">
                        <RadioGroupItem id={`mt-${k}`} value={k} />
                        <Label htmlFor={`mt-${k}`}>{label}</Label>
                    </div>
                ))}
            </RadioGroup>

            {value.kind !== 'list' ? (
                <>
                    <Select value={value.groupId ?? undefined} onValueChange={(v) => set({ groupId: v, excluded: [] })}>
                        <SelectTrigger className="h-10" aria-label="Grupo">
                            <SelectValue placeholder={value.kind === 'team' ? 'Elige el equipo' : value.kind === 'category' ? 'Elige la categoría' : 'Elige el plan'} />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                            {groupOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                            {loading ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Buscando atletas…</span>
                                : value.groupId ? `${resolved.athletes.length} atletas activos${value.excluded.length ? ` (quitaste ${value.excluded.length})` : ''}` : ''}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <Checkbox id="mt-paused" checked={value.includePaused} onCheckedChange={(v) => set({ includePaused: v === true })} />
                            <Label htmlFor="mt-paused" className="text-xs font-normal">Incluir pausados</Label>
                        </div>
                    </div>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    {groupAthletes.length > 0 && (
                        <div className="max-h-48 overflow-y-auto rounded-lg border p-2 grid gap-1 sm:grid-cols-2">
                            {groupAthletes.map((a) => {
                                const on = !value.excluded.includes(a.id);
                                return (
                                    <div key={a.id} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`mt-a-${a.id}`}
                                            checked={on}
                                            onCheckedChange={(v) => set({ excluded: v === true ? value.excluded.filter((x) => x !== a.id) : [...value.excluded, a.id] })}
                                        />
                                        <Label htmlFor={`mt-a-${a.id}`} className="text-xs font-normal truncate">
                                            {a.name}{a.paused ? ' · en pausa' : ''}{a.payer_linked === false ? ' · sin acudiente' : ''}
                                        </Label>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-8 h-10" placeholder="Buscar atleta…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar atleta" />
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-lg border p-2 grid gap-1 sm:grid-cols-2">
                        {manualFiltered.map((a) => (
                            <div key={a.id} className="flex items-center gap-2">
                                <Checkbox
                                    id={`mt-m-${a.id}`}
                                    checked={value.manual.includes(a.id)}
                                    onCheckedChange={(v) => set({ manual: v === true ? [...value.manual, a.id] : value.manual.filter((x) => x !== a.id) })}
                                />
                                <Label htmlFor={`mt-m-${a.id}`} className="text-xs font-normal truncate">{a.full_name}{a.team_name ? ` · ${a.team_name}` : ''}</Label>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{value.manual.length} elegidos (máximo 200 por lote).</p>
                </div>
            )}
        </div>
    );
}
