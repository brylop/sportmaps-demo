import { useEffect, useMemo, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowDown, ArrowUp, Dices } from 'lucide-react';
import type { FixtureFormat, FixturesResponse } from '@/lib/tournamentTypes';
import {
  buildFixturesBody, DEFAULT_DRAFT, moveItem, summarizeDraft, validateDraft, type FormatDraft,
} from '@/lib/tournamentFormats';

const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const LIVE_BASE = '/api/v1/tournament-live';

export interface TeamRef { id: string; name: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  categoryId: string;
  /** Equipos de la categoría (si se conocen). Vacío = el BFF valida la cantidad. */
  teams: TeamRef[];
  onGenerated: (r: FixturesResponse) => void;
}

const FORMAT_LABEL: Record<FixtureFormat, string> = { liga: 'Liga', copa: 'Copa', grupos: 'Grupos + fase final' };

export function FixtureGeneratorDialog({ open, onOpenChange, eventId, categoryId, teams, onGenerated }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<FormatDraft>(DEFAULT_DRAFT);
  const [allMatches, setAllMatches] = useState(true);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const known = teams.length >= 2 ? teams.length : null;
  const patch = (p: Partial<FormatDraft>) => { setDraft((d) => ({ ...d, ...p })); setServerError(null); };

  // Al abrir (o cambiar de categoría) se parte del orden actual de los equipos.
  useEffect(() => {
    if (open) { setDraft((d) => ({ ...d, teamOrder: teams.map((t) => t.id) })); setServerError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categoryId, teams.length]);

  const error = useMemo(() => validateDraft(draft, known), [draft, known]);
  const summary = useMemo(() => summarizeDraft(draft, teams.length), [draft, teams.length]);
  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? id;

  const submit = async () => {
    if (error) return;
    setBusy(true); setServerError(null);
    try {
      const body = buildFixturesBody(draft, teams.length);
      const r = await bffClient.post<FixturesResponse>(`${LIVE_BASE}/school/${eventId}/categories/${categoryId}/fixtures`, body);
      toast({ title: 'Calendario generado', description: `${r.matches} partidos (${FORMAT_LABEL[r.format] ?? r.format}). Semilla del sorteo: ${r.seed}.` });
      onGenerated(r);
      onOpenChange(false);
    } catch (e) {
      setServerError((e as Error)?.message || 'No se pudo generar el calendario.');
    } finally { setBusy(false); }
  };

  const numField = (value: number | null, set: (n: number) => void, min = 1) => (
    <Input type="number" min={min} value={value ?? ''} onChange={(e) => set(Number(e.target.value))} className="h-10" />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Generar calendario</DialogTitle>
          <DialogDescription>Elige el formato y cómo sortear. Al regenerar solo se borran los partidos programados que aún no se han jugado.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fx-format">Formato</Label>
            <select id="fx-format" className={selectCls} value={draft.format} onChange={(e) => patch({ format: e.target.value as FixtureFormat })}>
              {(Object.keys(FORMAT_LABEL) as FixtureFormat[]).map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
            </select>
          </div>

          {draft.format === 'liga' && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="fx-all">Todos contra todos</Label>
                <Switch id="fx-all" checked={allMatches} onCheckedChange={(v) => { setAllMatches(v); patch({ matchesPerTeam: v ? null : Math.max(1, (known ?? 4) - 1) }); }} />
              </div>
              {!allMatches && (
                <div className="space-y-1.5">
                  <Label>Partidos por equipo</Label>
                  {numField(draft.matchesPerTeam, (n) => patch({ matchesPerTeam: n }))}
                </div>
              )}
              {allMatches && (
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="fx-double">Ida y vuelta</Label>
                  <Switch id="fx-double" checked={draft.doubleRound} onCheckedChange={(v) => patch({ doubleRound: v })} />
                </div>
              )}
            </div>
          )}

          {draft.format === 'copa' && (
            <div className="flex items-center justify-between gap-2 rounded-md border p-3">
              <Label htmlFor="fx-third">Partido por el tercer puesto</Label>
              <Switch id="fx-third" checked={draft.thirdPlace} onCheckedChange={(v) => patch({ thirdPlace: v })} />
            </div>
          )}

          {draft.format === 'grupos' && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Cuántos grupos</Label>{numField(draft.groupCount, (n) => patch({ groupCount: n }), 2)}</div>
                <div className="space-y-1.5"><Label>Clasifican por grupo</Label>{numField(draft.advance, (n) => patch({ advance: n }))}</div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="fx-gdouble">Ida y vuelta en grupos</Label>
                <Switch id="fx-gdouble" checked={draft.doubleRound} onCheckedChange={(v) => patch({ doubleRound: v })} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="fx-gthird">Partido por el tercer puesto</Label>
                <Switch id="fx-gthird" checked={draft.thirdPlace} onCheckedChange={(v) => patch({ thirdPlace: v })} />
              </div>
            </div>
          )}

          {/* Sorteo */}
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="fx-draw">Sorteo</Label>
            <select id="fx-draw" className={selectCls} value={draft.draw} onChange={(e) => patch({ draw: e.target.value as 'random' | 'manual' })}>
              <option value="random">Aleatorio</option>
              <option value="manual" disabled={teams.length < 2}>Manual (por orden de los equipos)</option>
            </select>
            {draft.draw === 'random' ? (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <Input aria-label="Semilla del sorteo" placeholder="Semilla (vacía = nueva cada vez)" value={draft.seed} onChange={(e) => patch({ seed: e.target.value })} />
                  <Button type="button" variant="outline" onClick={() => patch({ seed: String(Math.floor(Math.random() * 1_000_000)) })}>
                    <Dices className="mr-1 h-4 w-4" /> Repetir sorteo
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Con la misma semilla sale exactamente el mismo sorteo.</p>
              </div>
            ) : (
              <ol className="space-y-1">
                {draft.teamOrder.map((id, i) => (
                  <li key={id} className="flex items-center gap-2 rounded border px-2 py-1 text-sm">
                    <span className="w-6 text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1">{nameOf(id)}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Subir ${nameOf(id)}`} disabled={i === 0} onClick={() => patch({ teamOrder: moveItem(draft.teamOrder, i, -1) })}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Bajar ${nameOf(id)}`} disabled={i === draft.teamOrder.length - 1} onClick={() => patch({ teamOrder: moveItem(draft.teamOrder, i, 1) })}><ArrowDown className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Calendario opcional */}
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="fx-sched">Asignar fecha, hora y cancha</Label>
              <Switch id="fx-sched" checked={draft.scheduleOn} onCheckedChange={(v) => patch({ scheduleOn: v })} />
            </div>
            {draft.scheduleOn && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="fx-start">Inicio (hora de Colombia)</Label>
                  <Input id="fx-start" type="datetime-local" value={draft.start} onChange={(e) => patch({ start: e.target.value })} />
                </div>
                <div className="space-y-1.5"><Label>Canchas</Label>{numField(draft.courts, (n) => patch({ courts: n }))}</div>
                <div className="space-y-1.5"><Label>Minutos por partido</Label>{numField(draft.slotMinutes, (n) => patch({ slotMinutes: n }), 5)}</div>
                <div className="space-y-1.5"><Label>Descanso (min)</Label>{numField(draft.breakMinutes, (n) => patch({ breakMinutes: n }), 0)}</div>
              </div>
            )}
          </div>

          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm" data-testid="fx-summary">{summary.text}</p>
          {(error || serverError) && <p role="alert" className="text-sm text-destructive">{serverError ?? error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !!error}>{busy ? 'Generando…' : 'Generar calendario'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
