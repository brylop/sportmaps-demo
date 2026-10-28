import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { liveApi, type RosterEntry, type ScorerScope } from './liveApi';

type Stat = 'attack' | 'ace' | 'block';
const STATS: Array<{ key: Stat; label: string }> = [
  { key: 'attack', label: 'Ataque' },
  { key: 'ace', label: 'Ace' },
  { key: 'block', label: 'Bloqueo' },
];

// Una planilla por partido y pestaña: no se vuelve a pedir en cada punto.
const rosterCache = new Map<string, Promise<RosterEntry[]>>();
export const _clearRosterCache = () => rosterCache.clear();

function rosterFor(scope: ScorerScope, matchId: string): Promise<RosterEntry[]> {
  const key = `${scope.kind}:${scope.kind === 'school' ? scope.eventId : scope.token}:${matchId}`;
  if (!rosterCache.has(key)) rosterCache.set(key, liveApi.roster(scope, matchId).then((r) => r.roster).catch(() => { rosterCache.delete(key); return []; }));
  return rosterCache.get(key)!;
}

/**
 * OPCIONAL, después de un punto: «¿Quién hizo el punto?» → jugadora + tipo. Si el equipo no tiene
 * planilla no se muestra nada. No bloquea el anotador: si no se toca, desaparece con el siguiente punto.
 * Si se deshace el punto, la estadística deja de contar sola (el BFF la cruza con la secuencia).
 */
export function PointTagger({ scope, matchId, side, pointIndex, teamName, onDone }: {
  scope: ScorerScope; matchId: string; side: 'home' | 'away'; pointIndex: number; teamName: string; onDone: () => void;
}) {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [player, setPlayer] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let alive = true;
    rosterFor(scope, matchId).then((r) => { if (alive) setRoster(r.filter((x) => x.side === side)); });
    return () => { alive = false; };
  }, [scope, matchId, side]);

  if (!roster || roster.length === 0) return null;

  const save = async (stat: Stat) => {
    if (!player) return;
    setState('saving');
    try {
      await liveApi.tagPoint(scope, matchId, { member_id: player, stat, point_index: pointIndex });
      setState('saved');
      setTimeout(onDone, 600);
    } catch { setState('error'); }
  };

  return (
    <div className="space-y-2 rounded-xl border bg-muted/40 p-2" data-testid="point-tagger">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Opcional · ¿quién hizo el punto de {teamName}?</span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDone} aria-label="Cerrar"><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {roster.map((r) => (
          <Button key={r.id} type="button" size="sm" variant={player === r.id ? 'default' : 'outline'} className="h-10 shrink-0" onClick={() => setPlayer(r.id)} aria-pressed={player === r.id}>
            {r.name}
          </Button>
        ))}
      </div>
      {player && (
        <div className="grid grid-cols-3 gap-1.5">
          {STATS.map((s) => (
            <Button key={s.key} type="button" variant="secondary" className="h-11" disabled={state === 'saving' || state === 'saved'} onClick={() => save(s.key)}>{s.label}</Button>
          ))}
        </div>
      )}
      {state === 'saved' && <p className="text-xs text-emerald-700 dark:text-emerald-300">Guardado.</p>}
      {state === 'error' && <p className="text-xs text-destructive">No se guardó (puede que el punto aún no esté sincronizado). Sigue anotando.</p>}
    </div>
  );
}

export default PointTagger;
