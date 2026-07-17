import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bffClient } from '@/lib/api/bffClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Trophy, Share2, Rocket, Link2, AlertCircle, Plus, Trash2, Save } from 'lucide-react';

interface Category {
  division: string; level: string; category: string; rama: string;
  age_min: number | null; age_max: number | null; team_min: number | null; team_max: number | null;
}
interface Phase {
  phase_name: string; valid_until: string; deposit_percent: number;
  price_solo: number; price_pkg1: number;
}
interface Delegation {
  id: string; status: string; total_owed: number; total_paid: number;
  contact_name: string | null; submitted_at: string | null; created_at: string;
  school: { id: string; name: string; city: string | null } | null;
  teams: { count: number }[]; members: { count: number }[];
  payments?: { id: string; amount: number; status: string; payment_method: string; proof_url: string | null; created_at: string }[];
}
interface Detail {
  id: string; title: string; sport: string; description: string | null; slug: string;
  status: string; visibility: 'public' | 'invited_only' | 'school_only';
  tournament_scope: 'internal' | 'external' | null; payer_mode: 'school' | 'parent' | 'flexible' | null;
  event_date: string; start_time: string; end_time: string | null;
  address: string; city: string; capacity: number | null;
  registration_deadline: string | null;
  categories?: any[]; phases?: any[];
}

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Borrador', variant: 'outline' }, active: { label: 'Publicado', variant: 'default' },
  closed: { label: 'Cerrado', variant: 'secondary' }, cancelled: { label: 'Cancelado', variant: 'destructive' },
  completed: { label: 'Finalizado', variant: 'secondary' },
};
const SCOPE_LABEL: Record<string, string> = { internal: 'Interno', external: 'Externo' };
const VIS_LABEL: Record<string, string> = { public: 'Público', invited_only: 'Por invitación', school_only: 'Solo mi escuela' };
const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const emptyCat = (): Category => ({ division: 'General', level: '1', category: 'Open', rama: 'Mixto', age_min: null, age_max: null, team_min: 1, team_max: 30 });
const emptyPhase = (): Phase => ({ phase_name: 'Preventa', valid_until: '', deposit_percent: 30, price_solo: 0, price_pkg1: 0 });

export default function SchoolTournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [t, setT] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // editores
  const [info, setInfo] = useState<Partial<Detail>>({});
  const [cats, setCats] = useState<Category[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tpls, setTpls] = useState<any[]>([]);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingCats, setSavingCats] = useState(false);

  // inscritos
  const [dels, setDels] = useState<Delegation[]>([]);
  const [delsLoaded, setDelsLoaded] = useState(false);

  // resultados (liga)
  const [resCatId, setResCatId] = useState<string>('');
  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [scorers, setScorers] = useState<any[]>([]);
  const [scoreEdits, setScoreEdits] = useState<Record<string, { h: string; a: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await bffClient.get<Detail>(`/api/v1/events/school-tournaments/${id}`);
      setT(d);
      setInfo({
        title: d.title, description: d.description, event_date: d.event_date, start_time: d.start_time,
        end_time: d.end_time, address: d.address, city: d.city, capacity: d.capacity,
        visibility: d.visibility, payer_mode: d.payer_mode, registration_deadline: d.registration_deadline,
      });
      setCats((d.categories ?? []).map((c: any) => ({
        division: c.division, level: c.level, category: c.category, rama: c.rama,
        age_min: c.age_min, age_max: c.age_max, team_min: c.team_min, team_max: c.team_max,
      })));
      setPhases((d.phases ?? []).map((p: any) => ({
        phase_name: p.phase_name, valid_until: p.valid_until, deposit_percent: p.deposit_percent,
        price_solo: p.price_solo, price_pkg1: p.price_pkg1,
      })));
      try {
        const tp = await bffClient.get<any[]>(`/api/v1/events/category-templates?sport=${encodeURIComponent(d.sport || '')}`);
        setTpls(tp);
      } catch { /* sin plantillas para este deporte */ }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'No se pudo cargar.', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [id, toast]);

  useEffect(() => { void load(); }, [load]);

  const loadDelegations = useCallback(async () => {
    try {
      const d = await bffClient.get<Delegation[]>(`/api/v1/events/school-tournaments/${id}/delegations`);
      setDels(d); setDelsLoaded(true);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'No se pudieron cargar los inscritos.', variant: 'destructive' });
    }
  }, [id, toast]);

  const recordPayment = async (d: Delegation) => {
    const remaining = Math.max(Number(d.total_owed || 0) - Number(d.total_paid || 0), 0);
    const raw = window.prompt('Monto recibido (COP):', String(remaining || ''));
    if (raw == null) return;
    const amount = Number(raw);
    if (!amount || amount <= 0) { toast({ title: 'Monto inválido', variant: 'destructive' }); return; }
    try {
      await bffClient.post(`/api/v1/events/school-tournaments/${id}/delegations/${d.id}/record-payment`, { amount, payment_method: 'cash' });
      toast({ title: 'Pago registrado' }); await loadDelegations();
    } catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
  };
  const approveDel = async (d: Delegation) => {
    try {
      await bffClient.patch(`/api/v1/events/school-tournaments/${id}/delegations/${d.id}`, { action: 'approve' });
      toast({ title: 'Delegación aprobada' }); await loadDelegations();
    } catch (e: any) { toast({ title: 'No se pudo aprobar', description: e?.message, variant: 'destructive' }); }
  };
  const rejectDel = async (d: Delegation) => {
    const reason = window.prompt('Motivo del rechazo (opcional):') ?? undefined;
    try {
      await bffClient.patch(`/api/v1/events/school-tournaments/${id}/delegations/${d.id}`, { action: 'reject', rejection_reason: reason });
      toast({ title: 'Delegación rechazada' }); await loadDelegations();
    } catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
  };
  const verifyPayment = async (d: Delegation, payId: string, action: 'verify' | 'reject') => {
    try {
      await bffClient.patch(`/api/v1/events/school-tournaments/${id}/delegations/${d.id}/payments/${payId}`, { action });
      toast({ title: action === 'verify' ? 'Pago verificado' : 'Pago rechazado' }); await loadDelegations();
    } catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
  };

  const loadResults = useCallback(async (catId: string) => {
    if (!catId) return;
    try {
      const [m, s] = await Promise.all([
        bffClient.get<any[]>(`/api/v1/events/school-tournaments/${id}/matches?category_id=${catId}`),
        bffClient.get<{ standings: any[]; scorers: any[] }>(`/api/v1/events/school-tournaments/${id}/standings?category_id=${catId}`),
      ]);
      setMatches(m); setStandings(s.standings || []); setScorers(s.scorers || []);
    } catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
  }, [id, toast]);

  const genFixtures = async (catId: string) => {
    try {
      const r = await bffClient.post<{ matches: number }>(`/api/v1/events/school-tournaments/${id}/categories/${catId}/generate-fixtures`, {});
      toast({ title: 'Calendario generado', description: `${r.matches} partidos.` });
      await loadResults(catId);
    } catch (e: any) { toast({ title: 'No se pudo generar', description: e?.message, variant: 'destructive' }); }
  };
  const saveResult = async (matchId: string) => {
    const ed = scoreEdits[matchId];
    if (!ed || ed.h === '' || ed.a === '') { toast({ title: 'Ingresa el marcador', variant: 'destructive' }); return; }
    try {
      await bffClient.patch(`/api/v1/events/school-tournaments/${id}/matches/${matchId}`, { home_score: Number(ed.h), away_score: Number(ed.a) });
      toast({ title: 'Resultado guardado' }); await loadResults(resCatId);
    } catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
  };

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
  const publicUrl = t ? `${window.location.origin}/event/${t.slug}` : '';

  const saveInfo = async () => {
    setSavingInfo(true);
    try { await bffClient.patch(`/api/v1/events/school-tournaments/${id}`, info); toast({ title: 'Guardado' }); await load(); }
    catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
    finally { setSavingInfo(false); }
  };
  const saveCatsAndPhases = async () => {
    setSavingCats(true);
    try {
      await bffClient.put(`/api/v1/events/school-tournaments/${id}/categories`, { categories: cats });
      await bffClient.put(`/api/v1/events/school-tournaments/${id}/price-phases`, { phases });
      toast({ title: 'Categorías y precios guardados' });
      await load();
    } catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
    finally { setSavingCats(false); }
  };
  const publish = async () => {
    setPublishing(true);
    try { await bffClient.post(`/api/v1/events/school-tournaments/${id}/publish`, {}); toast({ title: 'Torneo publicado' }); await load(); }
    catch (e: any) { toast({ title: 'Error al publicar', description: e?.message, variant: 'destructive' }); }
    finally { setPublishing(false); }
  };
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: t?.title, url: publicUrl }); else { await navigator.clipboard.writeText(publicUrl); toast({ title: 'Enlace copiado' }); } } catch { /* cancelado */ }
  };

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-6 space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full" /></div>;
  if (!t) return (
    <div className="mx-auto max-w-2xl px-4 py-10"><Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertCircle className="h-10 w-10 text-muted-foreground" /><p className="font-medium">Torneo no encontrado</p>
      <Button variant="outline" onClick={() => navigate('/school/tournaments')}><ArrowLeft className="mr-1 h-4 w-4" /> Volver a Mis Torneos</Button>
    </CardContent></Card></div>
  );

  const st = STATUS_LABEL[t.status] ?? { label: t.status, variant: 'outline' as const };
  const isDraft = t.status === 'draft';
  const isActive = t.status === 'active';
  const isInternal = t.tournament_scope === 'internal';
  const savedCats = t.categories ?? [];
  const savedPhases = t.phases ?? [];
  const canPublish = savedCats.length > 0 && savedPhases.length > 0;
  const isShareable = isActive && t.visibility !== 'school_only';

  const payStatus = (d: Delegation) => {
    const owed = Number(d.total_owed || 0), paid = Number(d.total_paid || 0);
    if (owed > 0 && paid >= owed) return { label: 'Pagado', variant: 'default' as const };
    if (paid > 0) return { label: 'Parcial', variant: 'secondary' as const };
    return { label: 'Pendiente', variant: 'outline' as const };
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <button onClick={() => navigate('/school/tournaments')} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a Mis Torneos
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10"><Trophy className="h-6 w-6 text-primary" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{t.title}</h1><Badge variant={st.variant}>{st.label}</Badge></div>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant="secondary">{t.sport}</Badge>
              {t.tournament_scope && <Badge variant="outline">{SCOPE_LABEL[t.tournament_scope]}</Badge>}
              <Badge variant="outline">{VIS_LABEL[t.visibility]}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <Button onClick={publish} disabled={publishing || !canPublish} title={!canPublish ? 'Agrega al menos 1 categoría y 1 fase de precio' : ''}>
              <Rocket className="mr-1 h-4 w-4" /> {publishing ? 'Publicando…' : 'Publicar'}
            </Button>
          )}
          {isShareable && <Button variant="outline" onClick={share}><Share2 className="mr-1 h-4 w-4" /> Compartir</Button>}
        </div>
      </div>

      {isDraft && !canPublish && (
        <Card className="mb-6 border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20"><CardContent className="flex items-start gap-3 py-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>Para <strong>publicar</strong> necesitas al menos <strong>1 categoría</strong> y <strong>1 fase de precio</strong> (pestaña Categorías y Precios).</p>
        </CardContent></Card>
      )}

      <Tabs defaultValue="info" onValueChange={(v) => {
        if (v === 'inscritos' && !delsLoaded) void loadDelegations();
        if (v === 'resultados') {
          const c = resCatId || savedCats[0]?.id || '';
          if (c) { setResCatId(c); void loadResults(c); }
        }
      }}>
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="cats">Categorías y Precios</TabsTrigger>
          <TabsTrigger value="inscritos" disabled={isInternal}>Inscritos</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
        </TabsList>

        {/* ─── INFO (editable) ─── */}
        <TabsContent value="info" className="mt-4">
          <Card><CardContent className="grid gap-4 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Título</Label><Input value={info.title ?? ''} onChange={(e) => setInfo({ ...info, title: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Descripción</Label><Textarea rows={3} value={info.description ?? ''} onChange={(e) => setInfo({ ...info, description: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={info.event_date ?? ''} onChange={(e) => setInfo({ ...info, event_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Cierre inscripciones</Label><Input type="date" value={info.registration_deadline ?? ''} onChange={(e) => setInfo({ ...info, registration_deadline: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Hora inicio</Label><Input type="time" value={info.start_time ?? ''} onChange={(e) => setInfo({ ...info, start_time: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Hora fin</Label><Input type="time" value={info.end_time ?? ''} onChange={(e) => setInfo({ ...info, end_time: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Dirección</Label><Input value={info.address ?? ''} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Ciudad</Label><Input value={info.city ?? ''} onChange={(e) => setInfo({ ...info, city: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Cupo</Label><Input type="number" min={1} value={info.capacity ?? ''} onChange={(e) => setInfo({ ...info, capacity: e.target.value ? Number(e.target.value) : null })} /></div>
            {!isInternal && (
              <div className="space-y-1.5"><Label>¿Quién paga?</Label>
                <select className={selectCls} value={info.payer_mode ?? 'school'} onChange={(e) => setInfo({ ...info, payer_mode: e.target.value as any })}>
                  <option value="school">La escuela recauda</option><option value="parent">Cada familia paga</option><option value="flexible">Flexible</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-2"><Button onClick={saveInfo} disabled={savingInfo}><Save className="mr-1 h-4 w-4" /> {savingInfo ? 'Guardando…' : 'Guardar cambios'}</Button></div>
          </CardContent></Card>
        </TabsContent>

        {/* ─── CATEGORÍAS Y PRECIOS ─── */}
        <TabsContent value="cats" className="mt-4 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Categorías</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setCats([...cats, emptyCat()])}><Plus className="mr-1 h-4 w-4" /> Agregar</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {tpls.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2">
                  <span className="text-xs font-medium text-muted-foreground">Sugeridas para {t.sport}:</span>
                  {tpls.map((tp, k) => (
                    <Button key={k} size="sm" variant="secondary" className="h-7"
                      onClick={() => setCats([...cats, {
                        division: tp.division, level: tp.level ?? '1', category: tp.category, rama: tp.rama,
                        age_min: tp.age_min, age_max: tp.age_max, team_min: tp.team_min, team_max: tp.team_max,
                      }])}>
                      + {tp.category}{tp.rama !== 'Mixto' ? ` ${tp.rama[0]}` : ''}
                    </Button>
                  ))}
                </div>
              )}
              {cats.length === 0 && <p className="text-sm text-muted-foreground">Sin categorías. Agrega una sugerida o crea la tuya para poder publicar.</p>}
              {cats.map((c, i) => (
                <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-7">
                  <Input className="sm:col-span-2" placeholder="División" value={c.division} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, division: e.target.value } : x))} />
                  <Input className="sm:col-span-2" placeholder="Categoría" value={c.category} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} />
                  <select className={selectCls} value={c.rama} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, rama: e.target.value } : x))}>
                    <option>Mixto</option><option>Masculino</option><option>Femenino</option>
                  </select>
                  <Input type="number" placeholder="Edad min" value={c.age_min ?? ''} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, age_min: e.target.value ? Number(e.target.value) : null } : x))} />
                  <div className="flex gap-1">
                    <Input type="number" placeholder="Edad max" value={c.age_max ?? ''} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, age_max: e.target.value ? Number(e.target.value) : null } : x))} />
                    <Button size="icon" variant="ghost" onClick={() => setCats(cats.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Tamaño de equipo (mín/máx integrantes) y plantillas por deporte: próximamente.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Fases de precio</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setPhases([...phases, emptyPhase()])}><Plus className="mr-1 h-4 w-4" /> Agregar</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {phases.length === 0 && <p className="text-sm text-muted-foreground">Sin fases. Agrega al menos una (precio de inscripción).</p>}
              {phases.map((p, i) => (
                <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6">
                  <Input className="sm:col-span-2" placeholder="Nombre (Preventa)" value={p.phase_name} onChange={(e) => setPhases(phases.map((x, j) => j === i ? { ...x, phase_name: e.target.value } : x))} />
                  <Input type="date" title="Válida hasta" value={p.valid_until} onChange={(e) => setPhases(phases.map((x, j) => j === i ? { ...x, valid_until: e.target.value } : x))} />
                  <Input type="number" placeholder="Precio inscripción" value={p.price_solo || ''} onChange={(e) => setPhases(phases.map((x, j) => j === i ? { ...x, price_solo: Number(e.target.value) } : x))} />
                  <Input type="number" placeholder="% depósito" value={p.deposit_percent || ''} onChange={(e) => setPhases(phases.map((x, j) => j === i ? { ...x, deposit_percent: Number(e.target.value) } : x))} />
                  <Button size="icon" variant="ghost" onClick={() => setPhases(phases.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end"><Button onClick={saveCatsAndPhases} disabled={savingCats}><Save className="mr-1 h-4 w-4" /> {savingCats ? 'Guardando…' : 'Guardar categorías y precios'}</Button></div>
        </TabsContent>

        {/* ─── INSCRITOS ─── */}
        <TabsContent value="inscritos" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Delegaciones inscritas</CardTitle></CardHeader>
            <CardContent>
              {!delsLoaded ? (
                <Skeleton className="h-24 w-full" />
              ) : dels.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay academias inscritas.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Academia</TableHead><TableHead>Equipos</TableHead><TableHead>Atletas</TableHead>
                      <TableHead>Adeudado</TableHead><TableHead>Pagado</TableHead><TableHead>Pago</TableHead><TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {dels.map((d) => {
                        const ps = payStatus(d);
                        return (
                          <TableRow key={d.id}>
                            <TableCell className="font-medium">{d.school?.name ?? d.contact_name ?? '—'}</TableCell>
                            <TableCell>{d.teams?.[0]?.count ?? 0}</TableCell>
                            <TableCell>{d.members?.[0]?.count ?? 0}</TableCell>
                            <TableCell>{money(Number(d.total_owed))}</TableCell>
                            <TableCell>{money(Number(d.total_paid))}</TableCell>
                            <TableCell><Badge variant={ps.variant}>{ps.label}</Badge></TableCell>
                            <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-1">
                                {(d.payments ?? []).filter((p) => p.status === 'pending').map((p) => (
                                  <div key={p.id} className="flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs dark:bg-amber-950/30">
                                    <span className="text-amber-700 dark:text-amber-400">Comprobante {money(Number(p.amount))}</span>
                                    {p.proof_url && <a href={p.proof_url} target="_blank" rel="noreferrer" className="underline">ver</a>}
                                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => verifyPayment(d, p.id, 'verify')}>✓</Button>
                                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => verifyPayment(d, p.id, 'reject')}>✕</Button>
                                  </div>
                                ))}
                                {['submitted', 'draft', 'pending_payment'].includes(d.status) ? (
                                  <div className="flex justify-end gap-1">
                                    <Button size="sm" variant="outline" onClick={() => recordPayment(d)}>Pago</Button>
                                    <Button size="sm" onClick={() => approveDel(d)}>Aprobar</Button>
                                    <Button size="sm" variant="ghost" onClick={() => rejectDel(d)}>Rechazar</Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── RESULTADOS (Liga) ─── */}
        <TabsContent value="resultados" className="mt-4 space-y-6">
          {savedCats.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              Primero agrega categorías (pestaña Categorías y Precios) para generar el calendario.
            </CardContent></Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <select className={selectCls + ' max-w-xs'} value={resCatId}
                  onChange={(e) => { setResCatId(e.target.value); void loadResults(e.target.value); }}>
                  {savedCats.map((c: any) => <option key={c.id} value={c.id}>{c.division} · {c.category} ({c.rama})</option>)}
                </select>
                <Button variant="outline" onClick={() => genFixtures(resCatId)}>Generar calendario (Liga)</Button>
              </div>

              {/* Tabla de posiciones */}
              <Card>
                <CardHeader><CardTitle className="text-base">Tabla de posiciones</CardTitle></CardHeader>
                <CardContent>
                  {standings.length === 0 ? <p className="text-sm text-muted-foreground">Sin equipos/partidos aún.</p> : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Equipo</TableHead><TableHead>PJ</TableHead><TableHead>G</TableHead><TableHead>E</TableHead><TableHead>P</TableHead>
                          <TableHead>GF</TableHead><TableHead>GC</TableHead><TableHead>DG</TableHead><TableHead className="font-bold">Pts</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {standings.map((r: any, i: number) => (
                            <TableRow key={r.team_id}>
                              <TableCell className="font-medium">{i + 1}. {r.team_name}</TableCell>
                              <TableCell>{r.P}</TableCell><TableCell>{r.W}</TableCell><TableCell>{r.D}</TableCell><TableCell>{r.L}</TableCell>
                              <TableCell>{r.GF}</TableCell><TableCell>{r.GA}</TableCell><TableCell>{r.GD}</TableCell><TableCell className="font-bold">{r.Pts}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Goleadores */}
              {scorers.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Goleadores</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {scorers.map((s: any, i: number) => (
                      <div key={i} className="flex justify-between border-b py-1 last:border-0">
                        <span>{i + 1}. {s.name}</span><span className="font-semibold">{s.goals}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Partidos */}
              <Card>
                <CardHeader><CardTitle className="text-base">Partidos</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {matches.length === 0 ? <p className="text-sm text-muted-foreground">Genera el calendario para ver los partidos.</p> : matches.map((m: any) => (
                    <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                      <Badge variant="outline">J{m.round}</Badge>
                      <span className="flex-1 text-right">{m.home?.team_name ?? '—'}</span>
                      <Input className="h-8 w-12 text-center" type="number" min={0}
                        defaultValue={m.home_score ?? ''}
                        onChange={(e) => setScoreEdits((p) => ({ ...p, [m.id]: { h: e.target.value, a: p[m.id]?.a ?? (m.away_score ?? '') } }))} />
                      <span>-</span>
                      <Input className="h-8 w-12 text-center" type="number" min={0}
                        defaultValue={m.away_score ?? ''}
                        onChange={(e) => setScoreEdits((p) => ({ ...p, [m.id]: { h: p[m.id]?.h ?? (m.home_score ?? ''), a: e.target.value } }))} />
                      <span className="flex-1">{m.away?.team_name ?? '—'}</span>
                      <Button size="sm" variant="ghost" onClick={() => saveResult(m.id)}>Guardar</Button>
                      {m.status === 'played' && <Badge variant="secondary">jugado</Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
