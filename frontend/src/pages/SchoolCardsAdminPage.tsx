import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, IdCard, Plus, Eye, ShieldOff, Download, ExternalLink, RotateCw, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AthleteIdCard, type CardData } from '@/components/cards/AthleteIdCard';
import { CardTemplatesManager } from '@/components/cards/CardTemplatesManager';

type Athlete = {
  kind: 'child' | 'profile';
  athlete_id: string;
  full_name: string;
  avatar_url: string | null;
  doc_number: string | null;
  team_name: string | null;
  branch_name: string | null;
  has_active_card: boolean;
};

type CardRow = {
  id: string;
  qr_token: string;
  status: string;
  issued_at: string;
  valid_until: string;
  version: number;
  athlete_name: string;
  athlete_photo: string | null;
  doc_number: string | null;
  team_name: string | null;
  branch_name: string | null;
  child_id: string | null;
  profile_id: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  active:  'bg-green-100 text-green-700',
  revoked: 'bg-gray-200 text-gray-700',
  expired: 'bg-red-100 text-red-700',
};

export default function SchoolCardsAdminPage() {
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();

  const [tab, setTab] = useState<'athletes' | 'cards' | 'templates'>('athletes');
  const [templates, setTemplates] = useState<{ id: string; name: string; is_default: boolean }[]>([]);
  const [issueTemplate, setIssueTemplate] = useState<string>('default');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueTarget, setIssueTarget] = useState<Athlete | null>(null);
  const [validUntil, setValidUntil] = useState<string>(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [issuing, setIssuing] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<CardData | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [previewFace, setPreviewFace] = useState<'front' | 'back'>('front');
  const previewRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Emisión masiva + filtros
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [cardFilter, setCardFilter] = useState<'all' | 'with' | 'without'>('all');
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Descarga PDF por equipo (encarpetado)
  const [pdfTeam, setPdfTeam] = useState<string>('all');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const [batch, setBatch] = useState<{ data: CardData; token: string }[]>([]);
  const batchRefs = useRef<(HTMLDivElement | null)[]>([]);

  const publicCardOrigin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/c`;
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    if (tab === 'athletes') void loadAthletes();
    else if (tab === 'cards') void loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, tab, search, statusFilter]);

  // Plantillas activas (para elegir cuál usar al emitir).
  useEffect(() => {
    if (!schoolId) return;
    supabase
      .from('athlete_id_card_templates')
      .select('id, name, is_default')
      .eq('school_id', schoolId)
      .eq('active', true)
      .order('is_default', { ascending: false })
      .then(({ data }) => setTemplates((data as any) || []));
  }, [schoolId, tab]);

  // Resuelve el template_id a usar al emitir ('default' → deja que la RPC use la
  // plantilla predeterminada; un id concreto → esa plantilla).
  const resolveTemplateId = () => (issueTemplate === 'default' ? null : issueTemplate);

  async function loadAthletes() {
    if (!schoolId) return;
    setLoadingAthletes(true);
    const { data, error } = await supabase.rpc('list_school_athletes_for_card_issue' as any, {
      p_school_id: schoolId,
      p_search: search || null,
      p_limit: 100,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setAthletes([]);
    } else {
      setAthletes((data as Athlete[]) || []);
    }
    setLoadingAthletes(false);
  }

  async function loadCards() {
    if (!schoolId) return;
    setLoadingCards(true);
    const { data, error } = await supabase.rpc('list_athlete_id_cards' as any, {
      p_school_id: schoolId,
      p_status: statusFilter === 'all' ? null : statusFilter,
      p_search: search || null,
      p_limit: 100,
      p_offset: 0,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setCards([]);
    } else {
      setCards(((data as any)?.rows ?? []) as CardRow[]);
    }
    setLoadingCards(false);
  }

  // ── Filtros (cliente) + cobertura ──────────────────────────────────────────
  const teamOptions = useMemo(
    () => Array.from(new Set(athletes.map((a) => a.team_name).filter(Boolean))) as string[],
    [athletes],
  );
  const branchOptions = useMemo(
    () => Array.from(new Set(athletes.map((a) => a.branch_name).filter(Boolean))) as string[],
    [athletes],
  );
  const filteredAthletes = useMemo(
    () => athletes.filter((a) => {
      if (teamFilter !== 'all' && a.team_name !== teamFilter) return false;
      if (branchFilter !== 'all' && a.branch_name !== branchFilter) return false;
      if (cardFilter === 'with' && !a.has_active_card) return false;
      if (cardFilter === 'without' && a.has_active_card) return false;
      return true;
    }),
    [athletes, teamFilter, branchFilter, cardFilter],
  );
  const coverage = useMemo(() => ({
    total: athletes.length,
    withCard: athletes.filter((a) => a.has_active_card).length,
  }), [athletes]);
  const selectableWithout = filteredAthletes.filter((a) => !a.has_active_card);
  const selectedCount = filteredAthletes.filter((a) => selected.has(a.athlete_id)).length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllWithout() {
    setSelected(new Set(selectableWithout.map((a) => a.athlete_id)));
  }
  function clearSelection() { setSelected(new Set()); }

  async function bulkIssue() {
    if (!schoolId) return;
    const targets = filteredAthletes.filter((a) => selected.has(a.athlete_id) && !a.has_active_card);
    if (targets.length === 0) {
      toast({ title: 'Nada que emitir', description: 'Selecciona atletas sin carnet.' });
      return;
    }
    setBulkIssuing(true);
    setBulkProgress({ done: 0, total: targets.length });
    let ok = 0; let fail = 0;
    for (const a of targets) {
      const { error } = await supabase.rpc('issue_athlete_id_card' as any, {
        p_school_id: schoolId,
        p_child_id: a.kind === 'child' ? a.athlete_id : null,
        p_profile_id: a.kind === 'profile' ? a.athlete_id : null,
        p_template_id: resolveTemplateId(),
        p_valid_until: validUntil,
        p_photo_url: null,
      });
      if (error) fail++; else ok++;
      setBulkProgress({ done: ok + fail, total: targets.length });
    }
    setBulkIssuing(false);
    setBulkProgress(null);
    clearSelection();
    toast({
      title: `Emitidos ${ok} carnet(s)`,
      description: fail ? `${fail} fallaron — revisa e inténtalo de nuevo.` : 'Todos correctos.',
      variant: fail ? 'destructive' : 'default',
    });
    void loadAthletes();
  }

  // Equipos disponibles entre los carnets emitidos (para descargar por equipo)
  const cardTeamOptions = useMemo(
    () => Array.from(new Set(cards.map((c) => c.team_name).filter(Boolean))) as string[],
    [cards],
  );

  // Genera un PDF (tamaño tarjeta CR80, 9 por hoja) con los carnets activos del
  // equipo elegido (o todos) — para imprimir, plastificar y archivar por equipo.
  async function downloadCardsPdf() {
    if (!schoolId) return;
    const target = cards.filter((c) => c.status === 'active' && (pdfTeam === 'all' || c.team_name === pdfTeam));
    if (target.length === 0) {
      toast({ title: 'Sin carnets', description: 'No hay carnets activos para ese equipo.' });
      return;
    }
    setPdfBusy(true);
    setPdfProgress({ done: 0, total: target.length });
    try {
      // 1) Cargar la data completa de cada carnet (branding, foto, estado)
      const datas: { data: CardData; token: string }[] = [];
      for (const c of target) {
        const { data } = await supabase.rpc('verify_athlete_id_card_public' as any, { p_qr_token: c.qr_token });
        if (data) datas.push({ data: data as CardData, token: c.qr_token });
      }
      batchRefs.current = [];
      setBatch(datas);
      // 2) Esperar a que React renderice los carnets ocultos
      await new Promise((r) => setTimeout(r, 500));

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = 210, margin = 10, cols = 3, rows = 3, gap = 6;
      const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols;   // ≈ 54mm (CR80)
      const cardH = cardW * (476 / 300);                              // ≈ 85.6mm
      const perPage = cols * rows;

      let idx = 0;
      for (let i = 0; i < batchRefs.current.length; i++) {
        const node = batchRefs.current[i];
        if (!node) continue;
        const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
        const img = canvas.toDataURL('image/png');
        const pos = idx % perPage;
        if (idx > 0 && pos === 0) pdf.addPage();
        const col = pos % cols;
        const row = Math.floor(pos / cols);
        const x = margin + col * (cardW + gap);
        const y = margin + row * (cardH + gap);
        pdf.addImage(img, 'PNG', x, y, cardW, cardH);
        idx++;
        setPdfProgress({ done: idx, total: datas.length });
      }
      const slug = pdfTeam === 'all' ? 'todos' : pdfTeam.replace(/\s+/g, '-').toLowerCase();
      pdf.save(`carnets-${slug}.pdf`);
      toast({ title: `PDF generado`, description: `${idx} carnet(s) · listos para imprimir (CR80).` });
    } catch (e: any) {
      toast({ title: 'No se pudo generar el PDF', description: e?.message || 'Error', variant: 'destructive' });
    } finally {
      setPdfBusy(false);
      setPdfProgress(null);
      setBatch([]);
    }
  }

  function openIssueDialog(a: Athlete) {
    setIssueTarget(a);
    setIssueOpen(true);
  }

  async function confirmIssue() {
    if (!schoolId || !issueTarget) return;
    setIssuing(true);
    const { data, error } = await supabase.rpc('issue_athlete_id_card' as any, {
      p_school_id: schoolId,
      p_child_id:  issueTarget.kind === 'child'   ? issueTarget.athlete_id : null,
      p_profile_id: issueTarget.kind === 'profile' ? issueTarget.athlete_id : null,
      p_template_id: null,
      p_valid_until: validUntil,
      p_photo_url: null,
    });
    setIssuing(false);
    if (error) {
      toast({ title: 'Error al emitir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Carnet emitido', description: `Versión ${(data as any)?.version || 1}` });
    setIssueOpen(false);
    setIssueTarget(null);
    void loadAthletes();

    const token = (data as any)?.qr_token;
    if (token) await openPreview(token);
  }

  async function revoke(card: CardRow) {
    const reason = window.prompt('Motivo de la revocación (opcional):') ?? null;
    const { error } = await supabase.rpc('revoke_athlete_id_card' as any, {
      p_card_id: card.id,
      p_reason: reason,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Carnet revocado' });
    void loadCards();
  }

  // Comparte el link público del carnet con el padre (WhatsApp o share nativo).
  function shareCard(qrToken: string, name?: string | null) {
    const url = `${window.location.origin}/c/${qrToken}`;
    const text = `Carnet deportivo de ${name || 'tu deportista'} — valida y consúltalo aquí: ${url}`;
    const nav = navigator as any;
    if (nav.share) {
      nav.share({ title: 'Carnet deportivo', text, url }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    }
  }

  async function openPreview(qrToken: string) {
    setPreviewToken(qrToken);
    setPreviewData(null);
    setPreviewFace('front');
    setPreviewOpen(true);
    const { data, error } = await supabase.rpc('verify_athlete_id_card_public' as any, {
      p_qr_token: qrToken,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setPreviewData(data as CardData);
  }

  async function downloadPreview() {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `carnet-${previewToken?.slice(0, 8)}.png`;
      a.click();
    } catch (e: any) {
      toast({ title: 'No se pudo descargar', description: e?.message || 'Error', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <IdCard className="h-7 w-7 text-primary" />
            Carnets digitales
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Emite y gestiona carnets de tus atletas con QR público para validación.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="athletes">Emitir nuevo</TabsTrigger>
          <TabsTrigger value="cards">Carnets emitidos</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
        </TabsList>

        <TabsContent value="athletes">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle>Atletas</CardTitle>
                {/* Cobertura */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Cobertura</span>
                  <div className="w-28 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${coverage.total ? Math.round((coverage.withCard / coverage.total) * 100) : 0}%` }} />
                  </div>
                  <span className="font-bold tabular-nums">{coverage.withCard}/{coverage.total}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o documento…"
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-auto min-w-[150px]"><SelectValue placeholder="Equipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los equipos</SelectItem>
                    {teamOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-auto min-w-[130px]"><SelectValue placeholder="Sede" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las sedes</SelectItem>
                    {branchOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={cardFilter} onValueChange={(v) => setCardFilter(v as any)}>
                  <SelectTrigger className="w-auto min-w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="without">Sin carnet</SelectItem>
                    <SelectItem value="with">Con carnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Barra de selección masiva */}
              {selectableWithout.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  <div className="text-sm">
                    <span className="font-semibold text-primary">{selectedCount} seleccionado(s)</span>
                    {selectedCount < selectableWithout.length && (
                      <button className="ml-2 text-primary underline underline-offset-2" onClick={selectAllWithout}>
                        Seleccionar todos sin carnet ({selectableWithout.length})
                      </button>
                    )}
                    {selectedCount > 0 && (
                      <button className="ml-2 text-muted-foreground underline underline-offset-2" onClick={clearSelection}>
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Vence</Label>
                    <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-8 w-[150px]" />
                    <Button size="sm" disabled={bulkIssuing || selectedCount === 0} onClick={bulkIssue} className="gap-1">
                      {bulkIssuing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      {bulkIssuing && bulkProgress
                        ? `Emitiendo ${bulkProgress.done}/${bulkProgress.total}…`
                        : `Emitir seleccionados (${selectedCount})`}
                    </Button>
                  </div>
                </div>
              )}

              {loadingAthletes ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : filteredAthletes.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No se encontraron atletas con esos filtros.</p>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label="Seleccionar todos sin carnet"
                          className="h-4 w-4 accent-primary align-middle"
                          checked={selectableWithout.length > 0 && selectedCount === selectableWithout.length}
                          onChange={(e) => e.target.checked ? selectAllWithout() : clearSelection()}
                        />
                      </TableHead>
                      <TableHead>Atleta</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Equipo / Sede</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAthletes.map((a) => (
                      <TableRow key={`${a.kind}-${a.athlete_id}`} className={selected.has(a.athlete_id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${a.full_name}`}
                            className="h-4 w-4 accent-primary align-middle disabled:opacity-40"
                            checked={selected.has(a.athlete_id)}
                            disabled={a.has_active_card}
                            title={a.has_active_card ? 'Ya tiene carnet activo' : undefined}
                            onChange={() => toggleSelect(a.athlete_id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{a.full_name}</TableCell>
                        <TableCell className="text-xs tabular-nums">{a.doc_number || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {a.team_name || '—'}{a.branch_name ? ` · ${a.branch_name}` : ''}
                        </TableCell>
                        <TableCell>
                          {a.has_active_card ? (
                            <Badge className="bg-green-100 text-green-700">Con carnet activo</Badge>
                          ) : (
                            <Badge variant="outline">Sin carnet</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => openIssueDialog(a)} className="gap-1">
                            <Plus className="h-3.5 w-3.5" />
                            {a.has_active_card ? 'Reemitir' : 'Emitir'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards">
          <Card>
            <CardHeader>
              <CardTitle>Carnets emitidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar atleta…"
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-auto min-w-[130px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="revoked">Revocados</SelectItem>
                    <SelectItem value="expired">Vencidos</SelectItem>
                  </SelectContent>
                </Select>

                {/* Descarga por equipo (encarpetado) */}
                <div className="flex items-center gap-2 ml-auto">
                  <Select value={pdfTeam} onValueChange={setPdfTeam}>
                    <SelectTrigger className="w-auto min-w-[160px]"><SelectValue placeholder="Equipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los equipos</SelectItem>
                      {cardTeamOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" disabled={pdfBusy} onClick={downloadCardsPdf} className="gap-1">
                    {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {pdfBusy && pdfProgress ? `Generando ${pdfProgress.done}/${pdfProgress.total}…` : 'Descargar PDF'}
                  </Button>
                </div>
              </div>

              {loadingCards ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : cards.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">Sin carnets emitidos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atleta</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Emitido</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>v</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm font-medium">{c.athlete_name}</TableCell>
                        <TableCell className="text-xs">{c.doc_number || '—'}</TableCell>
                        <TableCell className="text-xs">{new Date(c.issued_at).toLocaleDateString('es-CO')}</TableCell>
                        <TableCell className="text-xs">{new Date(c.valid_until).toLocaleDateString('es-CO')}</TableCell>
                        <TableCell className="text-xs">{c.version}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_BADGE[c.status] || ''}>{c.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => openPreview(c.qr_token)} className="gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Button>
                          {c.status === 'active' && (
                            <Button size="sm" variant="outline" onClick={() => shareCard(c.qr_token, c.athlete_name)} className="gap-1">
                              <Send className="h-3.5 w-3.5" />
                              Enviar
                            </Button>
                          )}
                          {c.status === 'active' && (
                            <Button size="sm" variant="outline" onClick={() => revoke(c)} className="gap-1 text-red-600 hover:bg-red-50">
                              <ShieldOff className="h-3.5 w-3.5" />
                              Revocar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <CardTemplatesManager schoolId={schoolId} />
        </TabsContent>
      </Tabs>

      {/* Issue dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir carnet</DialogTitle>
            <DialogDescription>
              {issueTarget?.has_active_card
                ? `Esto revocará el carnet activo actual de ${issueTarget?.full_name} y emitirá uno nuevo.`
                : `Se generará un nuevo carnet para ${issueTarget?.full_name}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {templates.length > 0 && (
              <div>
                <Label>Plantilla</Label>
                <Select value={issueTemplate} onValueChange={setIssueTemplate}>
                  <SelectTrigger><SelectValue placeholder="Plantilla" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Predeterminada de la escuela</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}{t.is_default ? ' ★' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="valid_until">Vence el</Label>
              <Input
                id="valid_until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancelar</Button>
            <Button onClick={confirmIssue} disabled={issuing}>
              {issuing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vista previa del carnet</DialogTitle>
            <DialogDescription>QR público escaneable. Estado en tiempo real.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {!previewData ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <AthleteIdCard
                ref={previewRef}
                data={previewData}
                face={previewFace}
                publicUrl={`${publicCardOrigin}/${previewToken}`}
              />
            )}
            {previewData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewFace((f) => (f === 'front' ? 'back' : 'front'))}
                className="gap-1"
              >
                <RotateCw className="h-3.5 w-3.5" />
                {previewFace === 'front' ? 'Ver reverso' : 'Ver frente'}
              </Button>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => previewToken && window.open(`/c/${previewToken}`, '_blank')}
                className="gap-1"
                disabled={!previewToken}
              >
                <ExternalLink className="h-4 w-4" />
                Abrir
              </Button>
              <Button
                variant="outline"
                onClick={() => previewToken && shareCard(previewToken, previewData?.athlete?.full_name)}
                className="gap-1"
                disabled={!previewToken}
              >
                <Send className="h-4 w-4" />
                Enviar al padre
              </Button>
            </div>
            <Button onClick={downloadPreview} disabled={downloading || !previewData} className="gap-1">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Render oculto para generar el PDF por equipo (html2canvas los captura). */}
      {batch.length > 0 && (
        <div aria-hidden style={{ position: 'fixed', left: -99999, top: 0, opacity: 0, pointerEvents: 'none' }}>
          {batch.map((b, i) => (
            <div key={b.token} ref={(el) => { batchRefs.current[i] = el; }} style={{ marginBottom: 12 }}>
              <AthleteIdCard data={b.data} publicUrl={`${publicCardOrigin}/${b.token}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
