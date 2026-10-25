import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bffClient, type AuthMode } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Undo2, Play, Flag, Pencil, RotateCcw, Plus, Trash2, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { applyAction, derive, emptyState, type Action, type LiveState, type Side } from '@/lib/tournamentScoring';
import type { ActionResponse, MatchDto } from '@/lib/tournamentTypes';
import {
  ActionQueue, classifyError, safeStorage, type FlushEvent, type QueuedAction, type SendResult,
} from '@/lib/tournamentActionQueue';
import { formatBogota, STATUS_LABEL, teamName } from '@/lib/tournamentDisplay';

/** Dónde pegarle al BFF: igual para el organizador (`/school/:id/...`) y para el token (`/scorer/:token/...`). */
export interface ScorerEndpoints {
  actionsUrl: (matchId: string) => string;
  takeUrl: (matchId: string) => string;
  authMode?: AuthMode;
}

interface Props {
  match: MatchDto;
  endpoints: ScorerEndpoints;
  /** Identifica la cola local (una por torneo/enlace). */
  queueKey: string;
  onClose: () => void;
  /** Avisa al padre de la versión confirmada por el servidor (para refrescar su lista). */
  onMatchChange?: (m: MatchDto) => void;
}

const toLiveState = (m: MatchDto): LiveState =>
  m.live_state ? { status: m.live_state.status, points: m.live_state.points ?? '', walkover: m.live_state.walkover ?? null } : emptyState(m.status);

/** Estado local = estado confirmado + acciones pendientes aplicadas con el motor (las que no apliquen se ignoran). */
export function foldPending(base: LiveState, pending: QueuedAction[], cfg: MatchDto['config'], knockout: boolean): LiveState {
  let s = base;
  for (const p of pending) {
    const r = applyAction(s, p.action, cfg, { knockout });
    if (r.ok) s = r.state;
  }
  return s;
}

export function LiveScorer({ match, endpoints, queueKey, onClose, onMatchChange }: Props) {
  const { toast } = useToast();
  const cfg = match.config;
  const knockout = match.stage === 'knockout' || match.stage === 'third_place';
  const epRef = useRef(endpoints);
  epRef.current = endpoints;

  const [serverMatch, setServerMatch] = useState<MatchDto>(match);
  const [, setTick] = useState(0);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  const [lastRetry, setLastRetry] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [woOpen, setWoOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [taken, setTaken] = useState<string | null>(null);

  const send = useCallback(async (item: QueuedAction, expected: number): Promise<SendResult> => {
    try {
      const ep = epRef.current;
      const r = await bffClient.post<ActionResponse>(
        ep.actionsUrl(item.matchId),
        { action: item.action, client_action_id: item.client_action_id, expected_version: expected },
        undefined, ep.authMode ?? 'required',
      );
      return { kind: 'ok', duplicate: r.duplicate, warning: r.warning, match: r.match };
    } catch (e) { return classifyError(e); }
  }, []);

  const queueRef = useRef<ActionQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = new ActionQueue({ key: queueKey, storage: safeStorage(), send, onChange: () => setTick((t) => t + 1) });
  }
  const queue = queueRef.current;

  const handleEvents = useCallback((events: FlushEvent[]) => {
    if (events.length === 0) return;
    setLastRetry(events.some((e) => e.type === 'retry'));
    for (const e of events) {
      if (e.type === 'sent' && e.match.id === match.id) { setServerMatch(e.match); onMatchChange?.(e.match); setTaken(null); }
      if (e.type === 'sent' && e.warning) toast({ title: 'Aviso', description: e.warning });
      if (e.type === 'other_scorer' && e.matchId === match.id) setTaken(e.message || 'Otra persona está anotando este partido.');
      if (e.type === 'conflict' && e.matchId === match.id) {
        if (e.match) { setServerMatch(e.match); onMatchChange?.(e.match); }
        toast({ title: 'Marcador sincronizado', description: 'Otra persona cambió este partido. Mostramos lo que tiene el servidor; revisa el marcador.', variant: 'destructive' });
      }
      if (e.type === 'rule_error') toast({ title: 'Acción no aplicada', description: e.message, variant: 'destructive' });
      if (e.type === 'auth_error') toast({ title: 'No se pudo sincronizar', description: e.message, variant: 'destructive' });
    }
  }, [match.id, onMatchChange, toast]);

  const takeOver = async () => {
    try {
      const ep = epRef.current;
      await bffClient.post(ep.takeUrl(match.id), {}, undefined, ep.authMode ?? 'required');
      setTaken(null);
      await flush(true);
    } catch (e) { toast({ title: 'No se pudo tomar el partido', description: (e as Error).message, variant: 'destructive' }); }
  };

  const flush = useCallback(async (force = false) => { handleEvents(await queue.flush(force)); }, [queue, handleEvents]);

  // Versión confirmada al abrir (solo si no hay nada pendiente de este partido) + «tomar» el partido.
  useEffect(() => {
    if (queue.pending(match.id).length === 0) queue.setVersion(match.id, match.version);
    setServerMatch(match);
    if (match.status !== 'played' && match.status !== 'walkover' && match.status !== 'cancelled') {
      const ep = epRef.current;
      bffClient.post(ep.takeUrl(match.id), {}, undefined, ep.authMode ?? 'required').catch(() => { /* otro anotador activo: el servidor lo resolverá por versión */ });
    }
    void flush(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  // Reintento periódico + al volver la señal.
  useEffect(() => {
    const iv = setInterval(() => { void flush(); }, 2000);
    const on = () => { setOnline(true); void flush(true); };
    const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { clearInterval(iv); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [flush]);

  // Pantalla encendida mientras se anota (Wake Lock, con respaldo silencioso si el navegador no lo soporta).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        if (!nav.wakeLock || document.visibilityState !== 'visible') return;
        const l = await nav.wakeLock.request('screen');
        if (cancelled) { void l.release().catch(() => undefined); return; }
        lock = l;
      } catch { /* sin permiso o sin soporte */ }
    };
    const onVis = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      try { void lock?.release().catch(() => undefined); } catch { /* ya liberado */ }
    };
  }, []);

  const pending = queue.pending(match.id);
  const state = useMemo(
    () => foldPending(toLiveState(serverMatch), pending, cfg, knockout),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverMatch, pending.length, pending[pending.length - 1]?.client_action_id, cfg, knockout],
  );
  const d = derive(state, cfg);
  const status = state.status;
  const live = status === 'live';
  // Un partido terminado antes del motor (sin secuencia de puntos) muestra lo que guardó el servidor.
  const legacy = pending.length === 0 && !serverMatch.live_state && status !== 'scheduled';
  const homeScore = legacy ? serverMatch.home_score ?? 0 : d.homeScore;
  const awayScore = legacy ? serverMatch.away_score ?? 0 : d.awayScore;
  const sets = legacy ? serverMatch.sets : d.sets;
  const openSet = sets.find((s) => !s.closed) ?? null;
  const bigHome = cfg.model === 'sets' ? (openSet?.home ?? 0) : homeScore;
  const bigAway = cfg.model === 'sets' ? (openSet?.away ?? 0) : awayScore;
  const decided = cfg.model === 'sets' && d.decided;

  const run = (action: Action): boolean => {
    const r = applyAction(state, action, cfg, { knockout });
    if (r.ok === false) { toast({ title: 'No se puede', description: r.message, variant: 'destructive' }); return false; }
    queue.enqueue(match.id, action);
    void flush(true);
    return true;
  };

  const totalPending = queue.size;
  const sync = !online || lastRetry
    ? { label: totalPending > 0 ? `Sin señal · ${totalPending} pendiente${totalPending === 1 ? '' : 's'}` : 'Sin señal', icon: <WifiOff className="h-4 w-4" />, cls: 'bg-destructive/10 text-destructive' }
    : totalPending > 0
      ? { label: `${totalPending} pendiente${totalPending === 1 ? '' : 's'}`, icon: <Loader2 className="h-4 w-4 animate-spin" />, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' }
      : { label: 'Sincronizado', icon: <Wifi className="h-4 w-4" />, cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' };

  const homeName = teamName(match, 'home');
  const awayName = teamName(match, 'away');
  const canUndo = live && (state.points?.length ?? 0) > 0;

  const scoreButton = (side: Side, name: string, value: number) => (
    <Button
      type="button" disabled={!live || decided}
      onClick={() => run({ type: 'point', side })}
      className="flex h-44 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-center"
      aria-label={`Sumar un punto a ${name}`}
    >
      <span className="line-clamp-2 px-1 text-base font-semibold">{name}</span>
      <span className="text-6xl font-bold tabular-nums">{value}</span>
      <span className="flex items-center gap-1 text-sm opacity-90"><Plus className="h-4 w-4" /> 1</span>
    </Button>
  );

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-3 p-3" data-testid="live-scorer">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Volver"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          <div>{match.court ?? 'Sin cancha'} · {formatBogota(match.scheduled_at)}</div>
        </div>
        <Badge variant={live ? 'default' : 'outline'}>{STATUS_LABEL[status]}</Badge>
      </div>

      {taken && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p>{taken}</p>
          <Button size="sm" onClick={takeOver}>Tomar el partido</Button>
        </div>
      )}

      <div role="status" className={`flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${sync.cls}`}>{sync.icon}{sync.label}</div>

      {cfg.model === 'sets' && (
        <div className="rounded-lg border p-2 text-center text-sm">
          <div className="text-xs text-muted-foreground">Sets ganados</div>
          <div className="text-2xl font-bold tabular-nums" data-testid="sets-won">{homeScore} - {awayScore}</div>
          {sets.filter((s) => s.closed).length > 0 && (
            <div className="text-muted-foreground">{sets.filter((s) => s.closed).map((s) => `${s.home}-${s.away}`).join(' · ')}</div>
          )}
          {live && !decided && <div className="mt-0.5 text-xs">Set {Math.min(sets.length + (openSet ? 0 : 1), cfg.best_of)} en juego · el set se cierra solo al llegar a los puntos</div>}
          {decided && <div className="mt-0.5 text-xs font-medium text-primary">Partido decidido: termínalo o deshaz el último punto</div>}
        </div>
      )}

      <div className="flex gap-3">
        {scoreButton('home', homeName, bigHome)}
        {scoreButton('away', awayName, bigAway)}
      </div>

      <Button type="button" variant="outline" className="h-14 text-lg" disabled={!canUndo} onClick={() => run({ type: 'undo' })}>
        <Undo2 className="mr-2 h-5 w-5" /> Deshacer
      </Button>

      <div className="grid grid-cols-2 gap-2">
        {status === 'scheduled' && (
          <Button type="button" className="col-span-2 h-12" onClick={() => run({ type: 'start' })}><Play className="mr-2 h-4 w-4" /> Iniciar partido</Button>
        )}
        {live && (
          <Button type="button" className="col-span-2 h-12" variant="secondary" onClick={() => setConfirmFinish(true)}><Flag className="mr-2 h-4 w-4" /> Terminar partido</Button>
        )}
        {(status === 'played' || status === 'walkover') && (
          <Button type="button" className="col-span-2 h-12" variant="secondary" onClick={() => run({ type: 'reopen' })}><RotateCcw className="mr-2 h-4 w-4" /> Reabrir partido</Button>
        )}
        {(status === 'scheduled' || status === 'live') && (
          <Button type="button" variant="outline" onClick={() => setWoOpen(true)}>W.O.</Button>
        )}
        {status !== 'cancelled' && (
          <Button type="button" variant="outline" onClick={() => setFixOpen(true)}><Pencil className="mr-1 h-4 w-4" /> Corregir marcador</Button>
        )}
      </div>

      <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Terminar el partido?</AlertDialogTitle>
            <AlertDialogDescription>
              {homeName} {homeScore} - {awayScore} {awayName}. Podrás reabrirlo si te equivocas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir anotando</AlertDialogCancel>
            <AlertDialogAction onClick={() => { run({ type: 'finish' }); }}>Sí, terminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WalkoverDialog open={woOpen} onOpenChange={setWoOpen} homeName={homeName} awayName={awayName} onPick={(winner) => { if (run({ type: 'walkover', winner })) setWoOpen(false); }} />
      <CorrectDialog
        open={fixOpen} onOpenChange={setFixOpen} model={cfg.model} homeName={homeName} awayName={awayName}
        initialGoals={[homeScore, awayScore]} initialSets={sets.filter((s) => s.closed).map((s) => [s.home, s.away] as [number, number])}
        onSubmit={(a) => { if (run(a)) setFixOpen(false); }}
      />
    </div>
  );
}

function WalkoverDialog({ open, onOpenChange, homeName, awayName, onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; homeName: string; awayName: string; onPick: (w: Side) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>W.O.</DialogTitle>
          <DialogDescription>¿Quién gana por no presentación del rival?</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button className="h-12" onClick={() => onPick('home')}>Gana {homeName}</Button>
          <Button className="h-12" onClick={() => onPick('away')}>Gana {awayName}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CorrectDialog({ open, onOpenChange, model, homeName, awayName, initialGoals, initialSets, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void; model: 'goals' | 'sets'; homeName: string; awayName: string;
  initialGoals: [number, number]; initialSets: Array<[number, number]>; onSubmit: (a: Action) => void;
}) {
  const [h, setH] = useState('0');
  const [a, setA] = useState('0');
  const [rows, setRows] = useState<Array<[string, string]>>([]);
  useEffect(() => {
    if (!open) return;
    setH(String(initialGoals[0])); setA(String(initialGoals[1]));
    setRows((initialSets.length ? initialSets : [[0, 0]]).map(([x, y]) => [String(x), String(y)] as [string, string]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = () => {
    if (model === 'goals') onSubmit({ type: 'correct', home: Number(h), away: Number(a) });
    else onSubmit({ type: 'correct', sets: rows.map(([x, y]) => [Number(x), Number(y)] as [number, number]) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corregir marcador</DialogTitle>
          <DialogDescription>
            {model === 'goals' ? 'Escribe el marcador final.' : 'Escribe el marcador de cada set jugado (solo sets cerrados).'}
          </DialogDescription>
        </DialogHeader>
        {model === 'goals' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{homeName}</Label><Input type="number" min={0} value={h} onChange={(e) => setH(e.target.value)} className="h-12 text-center text-xl" /></div>
            <div className="space-y-1.5"><Label>{awayName}</Label><Input type="number" min={0} value={a} onChange={(e) => setA(e.target.value)} className="h-12 text-center text-xl" /></div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1.5rem_1fr_1fr_2rem] items-end gap-2 text-xs text-muted-foreground"><span /><span>{homeName}</span><span>{awayName}</span><span /></div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr_2rem] items-center gap-2">
                <span className="text-sm text-muted-foreground">{i + 1}</span>
                <Input aria-label={`Set ${i + 1} local`} type="number" min={0} value={r[0]} onChange={(e) => setRows((p) => p.map((x, j) => j === i ? [e.target.value, x[1]] : x))} className="h-11 text-center" />
                <Input aria-label={`Set ${i + 1} visitante`} type="number" min={0} value={r[1]} onChange={(e) => setRows((p) => p.map((x, j) => j === i ? [x[0], e.target.value] : x))} className="h-11 text-center" />
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar set ${i + 1}`} disabled={rows.length <= 1} onClick={() => setRows((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((p) => [...p, ['0', '0']])}><Plus className="mr-1 h-4 w-4" /> Agregar set</Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Guardar marcador</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
