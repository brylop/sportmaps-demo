import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Loader2, Users, Plus, X, AlertCircle, ArrowDownToLine } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTeamPerformanceRoster } from '@/hooks/usePerformanceData';
import { useFootballLineups, useFootballLineup, useSaveFootballLineup } from '@/hooks/useFootballData';
import { POSITION_LABEL } from '@/lib/school/footballDisplay';
import type { FootballSourceType, LineupRole, PositionCode } from '@/lib/school/footballQueries';
import { FootballPitchBackground } from './FootballPitchBackground';

interface LineupModalProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  sourceType: FootballSourceType;
  sourceId: string;
  matchLabel: string;
}

const MAX_STARTERS = 11;
const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-4-3', '3-5-2', '5-3-2'];
/** Orden visual de arriba (ataque, cerca del arco rival) a abajo (nuestro arquero). */
const BAND_ORDER: PositionCode[] = ['delantero', 'medio', 'defensa', 'arquero'];

interface PlayerState {
  role: LineupRole | null;
  position_code: PositionCode | null;
  jersey_number: number | '';
  minutes_played: number | '';
}

const emptyState: PlayerState = { role: null, position_code: null, jersey_number: '', minutes_played: '' };

const subjectKey = (t: string, id: string) => `${t}:${id}`;

const getFormationCounts = (formationStr: string): Record<'defensa' | 'medio' | 'delantero', number> => {
  const clean = formationStr || '4-4-2';
  const parts = clean.split('-').map(Number);
  if (parts.length === 3) {
    return { defensa: parts[0] || 4, medio: parts[1] || 4, delantero: parts[2] || 2 };
  }
  if (parts.length === 4) {
    // e.g. 4-2-3-1 -> def: 4, med: 2+3 = 5, del: 1
    return {
      defensa: parts[0] || 4,
      medio: (parts[1] || 0) + (parts[2] || 0),
      delantero: parts[3] || 1
    };
  }
  // Default fallback
  return { defensa: 4, medio: 4, delantero: 2 };
};

export function LineupModal({ open, onClose, teamId, teamName, sourceType, sourceId, matchLabel }: LineupModalProps) {
  const { toast } = useToast();
  const { data: roster, isLoading: loadingRoster } = useTeamPerformanceRoster({ team_id: teamId });
  const { data: existingList } = useFootballLineups({ source_type: sourceType, source_id: sourceId });
  const existingLineupId = existingList?.[0]?.id;
  const { data: existingLineup, isLoading: loadingLineup } = useFootballLineup(existingLineupId);
  const saveLineup = useSaveFootballLineup();

  const [formation, setFormation] = useState('');
  const [customFormation, setCustomFormation] = useState(false);
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [addingBand, setAddingBand] = useState<string | null>(null);
  const [addingBench, setAddingBench] = useState(false);

  const subjects = roster?.subjects ?? [];
  const subjectByKey = useMemo(() => {
    const m = new Map<string, (typeof subjects)[number]>();
    for (const s of subjects) m.set(subjectKey(s.subject_type, s.subject_id), s);
    return m;
  }, [subjects]);

  useEffect(() => {
    if (!open) return;
    if (existingLineup) {
      setFormation(existingLineup.formation ?? '');
      setCustomFormation(!!existingLineup.formation && !FORMATIONS.includes(existingLineup.formation));
      const initial: Record<string, PlayerState> = {};
      for (const p of existingLineup.players) {
        initial[subjectKey(p.subject_type, p.subject_id)] = {
          role: p.role,
          position_code: p.position_code ?? null,
          jersey_number: p.jersey_number ?? '',
          minutes_played: p.minutes_played ?? '',
        };
      }
      setPlayers(initial);
    } else if (!loadingLineup) {
      setFormation('4-4-2');
      setCustomFormation(false);
      setPlayers({});
    }
  }, [open, existingLineup, loadingLineup]);

  const setPlayer = (k: string, patch: Partial<PlayerState>) => {
    setPlayers((prev) => ({ ...prev, [k]: { ...(prev[k] ?? emptyState), ...patch } }));
  };

  const removePlayer = (k: string) => {
    setPlayers((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const handleFormationChange = (newFormation: string) => {
    setFormation(newFormation);
    const counts = getFormationCounts(newFormation);
    const targetCounts: Record<PositionCode, number> = {
      arquero: 1,
      defensa: counts.defensa,
      medio: counts.medio,
      delantero: counts.delantero,
    };
    const positionOrder: PositionCode[] = ['arquero', 'defensa', 'medio', 'delantero'];

    // Obtener los titulares actuales
    const currentStarters = Object.entries(players)
      .filter(([, p]) => p.role === 'starter')
      .map(([k, p]) => ({ key: k, oldPosition: p.position_code }));

    // Ordenar titulares para mantener sus posiciones en la medida de lo posible
    currentStarters.sort((a, b) => {
      const idxA = a.oldPosition ? positionOrder.indexOf(a.oldPosition) : 99;
      const idxB = b.oldPosition ? positionOrder.indexOf(b.oldPosition) : 99;
      return idxA - idxB;
    });

    const newPlayers = { ...players };
    const assignedCounts: Record<PositionCode, number> = { arquero: 0, defensa: 0, medio: 0, delantero: 0 };

    for (const s of currentStarters) {
      let assigned = false;
      // Intentar mantener su posición original si cabe
      if (s.oldPosition && assignedCounts[s.oldPosition] < targetCounts[s.oldPosition]) {
        assignedCounts[s.oldPosition]++;
        assigned = true;
      } else {
        // Si no cabe o no tiene posición, reasignar a la primera banda que tenga lugar
        for (const band of positionOrder) {
          if (assignedCounts[band] < targetCounts[band]) {
            newPlayers[s.key] = {
              ...newPlayers[s.key],
              position_code: band,
            };
            assignedCounts[band]++;
            assigned = true;
            break;
          }
        }
      }
      // Si no cabe en ningún lado (ej: más de 11 titulares), queda sin posición
      if (!assigned) {
        newPlayers[s.key] = {
          ...newPlayers[s.key],
          position_code: null,
        };
      }
    }
    setPlayers(newPlayers);
  };

  const entries = Object.entries(players);
  const starters = entries.filter(([, p]) => p.role === 'starter');
  const benchPlayers = entries.filter(([, p]) => p.role === 'bench');
  const startersNoPosition = starters.filter(([, p]) => !p.position_code);
  const startersByBand = useMemo(() => {
    const map: Record<PositionCode, [string, PlayerState][]> = { arquero: [], defensa: [], medio: [], delantero: [] };
    for (const [k, p] of starters) {
      if (p.position_code) map[p.position_code].push([k, p]);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  const assignedKeys = new Set(entries.filter(([, p]) => p.role !== null).map(([k]) => k));
  const availableSubjects = subjects.filter((s) => !assignedKeys.has(subjectKey(s.subject_type, s.subject_id)));

  const handleClose = () => {
    setFormation('');
    setCustomFormation(false);
    setPlayers({});
    setEditingKey(null);
    setAddingBand(null);
    setAddingBench(false);
    onClose();
  };

  const assignToBand = (k: string, band: PositionCode) => {
    setPlayer(k, { role: 'starter', position_code: band });
    setAddingBand(null);
  };

  const assignToBench = (k: string) => {
    setPlayer(k, { role: 'bench' });
    setAddingBench(false);
  };

  const handleSave = async () => {
    if (starters.length > MAX_STARTERS) {
      toast({ title: `Máximo ${MAX_STARTERS} titulares`, description: `Tenés ${starters.length} marcados.`, variant: 'destructive' });
      return;
    }
    if (starters.length === 0 && benchPlayers.length === 0) {
      toast({ title: 'Marcá al menos un jugador (titular o banco).', variant: 'destructive' });
      return;
    }

    const payloadPlayers = entries
      .filter(([, p]) => p.role !== null)
      .map(([k, p]) => {
        const s = subjectByKey.get(k);
        const [fallbackType, fallbackId] = k.split(':');
        
        const jerseyNum = (p.jersey_number === '' || p.jersey_number === undefined || p.jersey_number === null) 
          ? undefined 
          : Number(p.jersey_number);
          
        const minsPlayed = (p.minutes_played === '' || p.minutes_played === undefined || p.minutes_played === null) 
          ? undefined 
          : Number(p.minutes_played);

        return {
          subject_type: (s?.subject_type ?? fallbackType) as 'profile' | 'child' | 'unregistered',
          subject_id: s?.subject_id ?? fallbackId,
          role: p.role as LineupRole,
          position_code: p.position_code || undefined,
          jersey_number: (jerseyNum !== undefined && !isNaN(jerseyNum)) ? jerseyNum : undefined,
          minutes_played: (minsPlayed !== undefined && !isNaN(minsPlayed)) ? minsPlayed : undefined,
        };
      });

    console.log('Sending lineup payload:', {
      team_id: teamId,
      source_type: sourceType,
      source_id: sourceId,
      formation: formation.trim() || null,
      players: payloadPlayers,
    });

    try {
      await saveLineup.mutateAsync({
        team_id: teamId,
        source_type: sourceType,
        source_id: sourceId,
        formation: formation.trim() || null,
        players: payloadPlayers,
      });
      toast({
        title: '✅ Alineación guardada',
        description: `${starters.length} titular(es), ${benchPlayers.length} en banco.`,
      });
      handleClose();
    } catch (err: any) {
      toast({ title: 'Error al guardar la alineación', description: err?.message ?? 'Intenta de nuevo.', variant: 'destructive' });
    }
  };

  const isLoading = loadingRoster || (!!existingLineupId && loadingLineup);

  const PlayerPicker = ({ onPick }: { onPick: (k: string) => void }) => (
    <Command>
      <CommandInput placeholder="Buscar jugador..." />
      <CommandList>
        <CommandEmpty>No quedan jugadores disponibles.</CommandEmpty>
        <CommandGroup>
          {availableSubjects.map((s) => {
            const k = subjectKey(s.subject_type, s.subject_id);
            return (
              <CommandItem key={k} value={s.full_name} onSelect={() => onPick(k)}>
                <Avatar className="h-5 w-5 mr-2">
                  <AvatarImage src={s.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px]">{s.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                {s.full_name}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const PlayerChip = ({ pKey }: { pKey: string }) => {
    const s = subjectByKey.get(pKey);
    const p = players[pKey];
    if (!s || !p) return null;
    return (
      <Popover open={editingKey === pKey} onOpenChange={(o) => setEditingKey(o ? pKey : null)}>
        <PopoverTrigger asChild>
          <button type="button" className="flex flex-col items-center gap-0.5 w-14 group shrink-0">
            <div className="relative">
              <Avatar className="h-9 w-9 border-2 border-white shadow-md">
                <AvatarImage src={s.avatar_url ?? undefined} />
                <AvatarFallback className="text-[11px] bg-primary text-primary-foreground">
                  {s.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {p.jersey_number !== '' && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-yellow-400 text-black text-[9px] font-black flex items-center justify-center border border-white">
                  {p.jersey_number}
                </span>
              )}
            </div>
            <span className="text-[9px] font-semibold text-white drop-shadow-sm leading-tight text-center truncate w-full">
              {s.full_name.split(' ')[0]}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 space-y-2" align="center">
          <p className="text-xs font-semibold">{s.full_name}</p>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px]">Camiseta</Label>
              <Input
                type="number"
                min={0}
                className="h-7 text-xs"
                value={p.jersey_number}
                onChange={(e) => setPlayer(pKey, { jersey_number: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-[10px]">Minutos</Label>
              <Input
                type="number"
                min={0}
                className="h-7 text-xs"
                value={p.minutes_played}
                onChange={(e) => setPlayer(pKey, { minutes_played: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            {p.role === 'starter' && (
              <Button
                size="sm" variant="outline" className="h-7 text-[11px] flex-1 gap-1"
                onClick={() => setPlayer(pKey, { role: 'bench' })}
              >
                <ArrowDownToLine className="w-3 h-3" /> Al banco
              </Button>
            )}
            <Button
              size="sm" variant="outline" className="h-7 text-[11px] flex-1 gap-1 text-red-600 hover:text-red-600"
              onClick={() => { removePlayer(pKey); setEditingKey(null); }}
            >
              <X className="w-3 h-3" /> Quitar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle>Alineación</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Users className="h-3 w-3" /> {teamName} · {matchLabel}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Cargando roster...</span>
          </div>
        ) : subjects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-muted-foreground">Este equipo no tiene atletas inscritos todavía.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Formación</Label>
                {customFormation ? (
                  <Input
                    placeholder="Ej: 4-1-4-1"
                    value={formation}
                    onChange={(e) => setFormation(e.target.value)}
                    onBlur={(e) => handleFormationChange(e.target.value)}
                    maxLength={20}
                  />
                ) : (
                  <Select value={formation || undefined} onValueChange={(v) => handleFormationChange(v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Elegir formación" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATIONS.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button
                type="button" variant="ghost" size="sm" className="h-9 text-[11px] shrink-0"
                onClick={() => setCustomFormation((v) => !v)}
              >
                {customFormation ? 'Presets' : 'Otra'}
              </Button>
            </div>

            <Badge
              variant="outline"
              className={`gap-1.5 ${starters.length > MAX_STARTERS ? 'text-red-600 border-red-500/30 bg-red-500/5' : 'text-green-600 border-green-500/30 bg-green-500/5'}`}
            >
              {starters.length} de {MAX_STARTERS} titulares · {benchPlayers.length} en banco
            </Badge>

            {startersNoPosition.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                  Sin posición asignada -- tocá para ubicar en la cancha
                </p>
                <div className="flex flex-wrap gap-2">
                  {startersNoPosition.map(([k]) => (
                    <Popover key={k}>
                      <PopoverTrigger asChild>
                        <Badge variant="outline" className="cursor-pointer gap-1">
                          {subjectByKey.get(k)?.full_name}
                        </Badge>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-1">
                        {BAND_ORDER.map((band) => (
                          <button
                            key={band}
                            type="button"
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted"
                            onClick={() => setPlayer(k, { position_code: band })}
                          >
                            {POSITION_LABEL[band]}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  ))}
                </div>
              </div>
            )}

            {/* ── Cancha ─────────────────────────────────────────────── */}
            <div className="relative rounded-xl overflow-hidden mx-auto w-full max-w-[290px] border border-white/20 shadow-md bg-green-950" style={{ aspectRatio: '300 / 340' }}>
              <FootballPitchBackground />
              <div className="relative z-10 h-full flex flex-col justify-between py-3">
                {BAND_ORDER.map((band) => {
                  const isArquero = band === 'arquero';
                  const formationCount = isArquero ? 1 : getFormationCounts(formation)[band];
                  const assigned = startersByBand[band];
                  const totalSlots = Math.max(formationCount, assigned.length);
                  return (
                    <div key={band} className="flex items-center justify-around w-full px-2 min-h-[50px]">
                      {Array.from({ length: totalSlots }).map((_, i) => {
                        if (i < assigned.length) {
                          const [k] = assigned[i];
                          return <PlayerChip key={k} pKey={k} />;
                        } else {
                          if (starters.length < MAX_STARTERS) {
                            return (
                              <Popover
                                key={`empty-${band}-${i}`}
                                open={addingBand === `${band}-${i}`}
                                onOpenChange={(o) => setAddingBand(o ? `${band}-${i}` : null)}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    title={`Agregar ${POSITION_LABEL[band]}`}
                                    className="h-8 w-8 rounded-full border-2 border-dashed border-white/50 flex items-center justify-center text-white/80 hover:bg-white/10 hover:border-white transition-colors shrink-0"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60 p-0" align="center">
                                  <PlayerPicker onPick={(k) => assignToBand(k, band)} />
                                </PopoverContent>
                              </Popover>
                            );
                          }
                          return <div key={`empty-spacer-${i}`} className="w-8 h-8 shrink-0" />;
                        }
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Banco ──────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Banco</p>
                <Popover open={addingBench} onOpenChange={setAddingBench}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] gap-1">
                      <Plus className="w-3 h-3" /> Agregar
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="end">
                    <PlayerPicker onPick={assignToBench} />
                  </PopoverContent>
                </Popover>
              </div>
              {benchPlayers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sin suplentes cargados.</p>
              ) : (
                <div className="space-y-1.5">
                  {benchPlayers.map(([k]) => {
                    const s = subjectByKey.get(k);
                    const p = players[k];
                    if (!s || !p) return null;
                    return (
                      <div key={k} className="flex items-center gap-2 rounded-lg border p-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={s.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">{s.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 min-w-0 text-sm truncate">{s.full_name}</span>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Camiseta"
                          className="h-7 text-xs w-16"
                          value={p.jersey_number}
                          onChange={(e) => setPlayer(k, { jersey_number: e.target.value === '' ? '' : Number(e.target.value) })}
                        />
                        <button type="button" onClick={() => removePlayer(k)} className="text-muted-foreground hover:text-red-500 shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background/95 backdrop-blur">
          <Button variant="outline" onClick={handleClose} disabled={saveLineup.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saveLineup.isPending || subjects.length === 0}>
            {saveLineup.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Alineación'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
