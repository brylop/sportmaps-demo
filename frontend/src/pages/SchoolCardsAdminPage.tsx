import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, IdCard, Plus, Eye, ShieldOff, Download, ExternalLink } from 'lucide-react';
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

  const [tab, setTab] = useState<'athletes' | 'cards'>('athletes');
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
  const previewRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const publicCardOrigin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/c`;
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    if (tab === 'athletes') void loadAthletes();
    else void loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, tab, search, statusFilter]);

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

  async function openPreview(qrToken: string) {
    setPreviewToken(qrToken);
    setPreviewData(null);
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
        </TabsList>

        <TabsContent value="athletes">
          <Card>
            <CardHeader>
              <CardTitle>Atletas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o documento…"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loadingAthletes ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : athletes.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No se encontraron atletas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atleta</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Equipo / Sede</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {athletes.map((a) => (
                      <TableRow key={`${a.kind}-${a.athlete_id}`}>
                        <TableCell className="text-sm font-medium">{a.full_name}</TableCell>
                        <TableCell className="text-xs">{a.doc_number || '—'}</TableCell>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar atleta…"
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="revoked">Revocados</SelectItem>
                    <SelectItem value="expired">Vencidos</SelectItem>
                  </SelectContent>
                </Select>
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
                publicUrl={`${publicCardOrigin}/${previewToken}`}
              />
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => previewToken && window.open(`/c/${previewToken}`, '_blank')}
              className="gap-1"
              disabled={!previewToken}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir en pestaña nueva
            </Button>
            <Button onClick={downloadPreview} disabled={downloading || !previewData} className="gap-1">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
