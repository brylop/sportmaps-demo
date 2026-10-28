import { useCallback, useEffect, useMemo, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageUpload } from '@/components/common/ImageUpload';
import { Pencil, Plus, Shield, Trash2, Users } from 'lucide-react';
import type { TeamDto } from '@/lib/tournamentTypes';
import { MAX_PASTE, parsePastedTeams, suggestShortName } from '@/lib/tournamentTeams';
import { LIVE_BASE } from './FixtureGeneratorDialog';

const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export interface TeamsPanelCategory { id: string; name: string }

interface Props {
  eventId: string;
  /** Escuela dueña: la carpeta del bucket school-assets donde puede escribir su admin. */
  schoolId: string | null;
  categories: TeamsPanelCategory[];
}

type AddMode = 'one' | 'list';

/**
 * Equipos del torneo por categoría: los inscritos (internos) y los rivales externos que el
 * organizador agrega solo con el nombre (sin cuenta ni delegación). Todos entran igual al sorteo,
 * al calendario y a la tabla. Cada equipo puede tener logo y sigla.
 */
export function TournamentTeamsPanel({ eventId, schoolId, categories }: Props) {
  const { toast } = useToast();
  const base = `${LIVE_BASE}/school/${eventId}`;
  const [teams, setTeams] = useState<TeamDto[] | null>(null);
  const [addCat, setAddCat] = useState<string | null>(null);
  const [mode, setMode] = useState<AddMode>('one');
  const [name, setName] = useState('');
  const [club, setClub] = useState('');
  const [shortName, setShortName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<TeamDto | null>(null);

  const load = useCallback(async () => {
    try { setTeams(await bffClient.get<TeamDto[]>(`${base}/teams`)); }
    catch (e) { setTeams([]); toast({ title: 'No se pudieron cargar los equipos', description: (e as Error).message, variant: 'destructive' }); }
  }, [base, toast]);
  useEffect(() => { void load(); }, [load]);

  const byCat = useMemo(() => {
    const m = new Map<string, TeamDto[]>();
    for (const t of teams ?? []) { const k = t.category_id ?? ''; m.set(k, [...(m.get(k) ?? []), t]); }
    return m;
  }, [teams]);

  const parsed = useMemo(() => parsePastedTeams(pasted), [pasted]);
  const uploadPath = schoolId ? `logos/${schoolId}/torneos/${eventId}` : undefined;

  const openAdd = (catId: string) => {
    setAddCat(catId); setMode('one'); setName(''); setClub(''); setShortName(''); setLogo(null); setPasted('');
  };

  const submitAdd = async () => {
    if (!addCat) return;
    const list = mode === 'one'
      ? (name.trim() ? [{ team_name: name.trim(), club_name: club.trim() || undefined, short_name: shortName.trim() || undefined, logo_url: logo ?? undefined }] : [])
      : parsed;
    if (list.length === 0) { toast({ title: 'Escribe al menos un nombre de equipo', variant: 'destructive' }); return; }
    if (list.length > MAX_PASTE) { toast({ title: `Máximo ${MAX_PASTE} equipos por vez`, variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const r = await bffClient.post<{ created: TeamDto[]; skipped: string[] }>(`${base}/teams/external`, { category_id: addCat, teams: list });
      toast({
        title: r.created.length === 1 ? 'Equipo agregado' : `${r.created.length} equipos agregados`,
        description: r.skipped.length ? `Ya estaban: ${r.skipped.join(', ')}.` : 'Ya puedes generar el calendario de la categoría.',
      });
      setAddCat(null);
      await load();
    } catch (e) { toast({ title: 'No se pudieron agregar', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const remove = async (t: TeamDto) => {
    if (!window.confirm(`¿Quitar a «${t.name}» del torneo?`)) return;
    try {
      const r = await bffClient.delete<{ success: boolean; regenerate: boolean }>(`${base}/teams/${t.id}`);
      toast({ title: 'Equipo quitado', description: r.regenerate ? 'Estaba en el calendario: vuelve a generarlo en Resultados.' : undefined });
      await load();
    } catch (e) { toast({ title: 'No se pudo quitar', description: (e as Error).message, variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Equipos del torneo</CardTitle>
        <p className="text-sm text-muted-foreground">Los inscritos y los rivales que agregues con solo el nombre. Todos entran al sorteo, al calendario y a la tabla.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.length === 0 && <p className="text-sm text-muted-foreground">Primero agrega categorías (pestaña Categorías y Precios).</p>}
        {teams === null && categories.length > 0 && <p className="text-sm text-muted-foreground">Cargando equipos…</p>}
        {teams !== null && categories.map((c) => {
          const list = byCat.get(c.id) ?? [];
          return (
            <div key={c.id} className="space-y-2 rounded-md border p-3" data-testid={`teams-cat-${c.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{c.name} <span className="text-muted-foreground">· {list.length} equipo{list.length === 1 ? '' : 's'}</span></p>
                <Button size="sm" variant="outline" onClick={() => openAdd(c.id)}><Plus className="mr-1 h-4 w-4" /> Agregar equipo rival</Button>
              </div>
              {list.length === 0 ? <p className="text-xs text-muted-foreground">Aún no hay equipos en esta categoría.</p> : (
                <ul className="divide-y">
                  {list.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
                      {t.logo_url
                        ? <img src={t.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-full border object-cover" />
                        : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted"><Shield className="h-4 w-4 text-muted-foreground" /></span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.name}{t.short_name ? <span className="ml-1 text-xs text-muted-foreground">({t.short_name})</span> : null}</p>
                        {t.club_name && <p className="truncate text-xs text-muted-foreground">{t.club_name}</p>}
                      </div>
                      <Badge variant={t.is_external ? 'secondary' : 'outline'}>{t.is_external ? 'Rival externo' : 'Inscrito'}</Badge>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Editar ${t.name}`} onClick={() => setEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      {t.is_external && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Quitar ${t.name}`} onClick={() => remove(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>

      {/* Agregar rival: uno a uno o pegando la lista */}
      <Dialog open={!!addCat} onOpenChange={(o) => { if (!o) setAddCat(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar equipo rival</DialogTitle>
            <DialogDescription>{categories.find((c) => c.id === addCat)?.name}. El equipo no necesita cuenta en SportMaps.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2" role="tablist">
            <Button type="button" size="sm" role="tab" aria-selected={mode === 'one'} variant={mode === 'one' ? 'default' : 'outline'} onClick={() => setMode('one')}>Uno a uno</Button>
            <Button type="button" size="sm" role="tab" aria-selected={mode === 'list'} variant={mode === 'list' ? 'default' : 'outline'} onClick={() => setMode('list')}>Pegar una lista</Button>
          </div>
          {mode === 'one' ? (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="tr-name">Nombre del equipo *</Label>
                <Input id="tr-name" maxLength={80} value={name} placeholder="Águilas Sub 14"
                  onChange={(e) => setName(e.target.value)} /></div>
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <div className="space-y-1.5"><Label htmlFor="tr-club">Club (opcional)</Label><Input id="tr-club" maxLength={120} value={club} placeholder="Club Águilas" onChange={(e) => setClub(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-short">Sigla</Label>
                  <Input id="tr-short" maxLength={4} value={shortName} placeholder={suggestShortName(name) || 'AGU'} onChange={(e) => setShortName(e.target.value.toUpperCase())} /></div>
              </div>
              <div className="space-y-1.5"><Label>Logo (opcional)</Label>
                {uploadPath ? <ImageUpload compact value={logo} path={uploadPath} onChange={setLogo} onRemove={() => setLogo(null)} />
                  : <p className="text-xs text-muted-foreground">Podrás subir el logo cuando cargue tu escuela.</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="tr-paste">Un equipo por línea</Label>
              <Textarea id="tr-paste" rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)}
                placeholder={'Águilas Sub 14\nTitanes | Club Titanes\nHalcones'} />
              <p className="text-xs text-muted-foreground">Para poner el club, sepáralo con « | ». Los repetidos se saltan.</p>
              {parsed.length > 0 && <p className="text-sm" data-testid="paste-count">Se agregarán {parsed.length} equipo{parsed.length === 1 ? '' : 's'}.</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCat(null)}>Cancelar</Button>
            <Button onClick={submitAdd} disabled={busy}>{busy ? 'Agregando…' : 'Agregar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TeamEditDialog team={edit} base={base} uploadPath={uploadPath} categories={categories}
        onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />
    </Card>
  );
}

function TeamEditDialog({ team, base, uploadPath, categories, onClose, onSaved }: {
  team: TeamDto | null; base: string; uploadPath?: string; categories: TeamsPanelCategory[]; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [club, setClub] = useState('');
  const [shortName, setShortName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [cat, setCat] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!team) return;
    setName(team.name); setClub(team.club_name ?? ''); setShortName(team.short_name ?? ''); setLogo(team.logo_url); setCat(team.category_id ?? '');
  }, [team]);

  const save = async () => {
    if (!team) return;
    const body: Record<string, unknown> = { logo_url: logo, short_name: shortName.trim() || null };
    if (team.is_external) {
      if (!name.trim()) { toast({ title: 'El equipo necesita un nombre', variant: 'destructive' }); return; }
      Object.assign(body, { team_name: name.trim(), club_name: club.trim() || null });
      if (cat && cat !== team.category_id) body.category_id = cat;
    }
    setBusy(true);
    try { await bffClient.patch(`${base}/teams/${team.id}`, body); toast({ title: 'Equipo guardado' }); onSaved(); }
    catch (e) { toast({ title: 'No se pudo guardar', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!team} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar equipo</DialogTitle>
          <DialogDescription>{team?.is_external ? 'Rival externo' : 'Equipo inscrito: el nombre se cambia desde la inscripción.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {team?.is_external && (
            <>
              <div className="space-y-1.5"><Label htmlFor="te-name">Nombre</Label><Input id="te-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="te-club">Club</Label><Input id="te-club" maxLength={120} value={club} onChange={(e) => setClub(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="te-cat">Categoría</Label>
                <select id="te-cat" className={selectCls} value={cat} onChange={(e) => setCat(e.target.value)}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
            </>
          )}
          <div className="space-y-1.5"><Label htmlFor="te-short">Sigla (hasta 4 letras)</Label>
            <Input id="te-short" maxLength={4} value={shortName} placeholder={suggestShortName(team?.name ?? '')} onChange={(e) => setShortName(e.target.value.toUpperCase())} /></div>
          <div className="space-y-1.5"><Label>Logo</Label>
            {uploadPath ? <ImageUpload compact value={logo} path={uploadPath} onChange={setLogo} onRemove={() => setLogo(null)} />
              : <p className="text-xs text-muted-foreground">No se pudo resolver la escuela para subir el logo.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
