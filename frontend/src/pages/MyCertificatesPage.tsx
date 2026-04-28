import { useEffect, useState } from 'react';
import { Loader2, FileCheck2, Plus, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';

type Mine = {
  id: string;
  folio: string;
  kind: string;
  title: string;
  status: 'pending_payment' | 'pending_review' | 'issued' | 'revoked';
  created_at: string;
  issued_at: string | null;
  pdf_url: string | null;
  qr_verify_token: string;
  school_id: string;
  school_name: string;
  athlete_name: string;
};

type Tpl = { id: string; name: string; kind: string; requires_payment: boolean; price: number };
type ChildOpt = { id: string; full_name: string; school_id: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: 'Pendiente pago',   cls: 'bg-amber-100 text-amber-800' },
  pending_review:  { label: 'Por aprobar',      cls: 'bg-blue-100 text-blue-800' },
  issued:          { label: 'Emitida',          cls: 'bg-green-100 text-green-800' },
  revoked:         { label: 'Revocada',         cls: 'bg-gray-200 text-gray-700' },
};

export default function MyCertificatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Mine[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [reqOpen, setReqOpen] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const [children, setChildren] = useState<ChildOpt[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [selectedTpl, setSelectedTpl] = useState<string>('');

  useEffect(() => {
    void load();
    void loadChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('my_athlete_certificates' as any);
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setItems([]);
      return;
    }
    setItems((data as Mine[]) || []);
  }

  async function loadChildren() {
    if (!user) return;
    const { data, error } = await supabase
      .from('children')
      .select('id, full_name, school_id')
      .eq('parent_id', user.id);
    if (error) return;
    setChildren((data as ChildOpt[]) || []);
  }

  async function loadTemplatesForChild(childId: string) {
    const child = children.find((c) => c.id === childId);
    if (!child) return setTemplates([]);
    const { data, error } = await supabase
      .from('school_certificate_templates' as any)
      .select('id, name, kind, requires_payment, price')
      .eq('school_id', child.school_id)
      .eq('active', true)
      .order('name');
    if (error) return setTemplates([]);
    setTemplates((data as unknown as Tpl[]) || []);
  }

  async function submitRequest() {
    const child = children.find((c) => c.id === selectedChild);
    const tpl = templates.find((t) => t.id === selectedTpl);
    if (!child || !tpl) return;
    setReqLoading(true);
    const { error } = await supabase.rpc('request_athlete_certificate' as any, {
      p_school_id:   child.school_id,
      p_template_id: tpl.id,
      p_child_id:    child.id,
      p_profile_id:  null,
    });
    setReqLoading(false);
    if (error) return toast({ title: 'No se pudo solicitar', description: error.message, variant: 'destructive' });
    toast({
      title: 'Solicitud enviada',
      description: tpl.requires_payment
        ? `Costo: ${Number(tpl.price).toLocaleString('es-CO')} COP. Te avisaremos cuando esté lista.`
        : 'La escuela revisará tu solicitud y te notificará cuando esté lista.',
    });
    setReqOpen(false);
    setSelectedChild(''); setSelectedTpl(''); setTemplates([]);
    await load();
  }

  async function downloadPdf(it: Mine) {
    setBusyId(it.id);
    try {
      const res = await bffClient.get<any>(`/api/v1/certificates/${it.id}/signed-url`);
      if (!res?.url) throw new Error(res?.error || 'no_url');
      window.open(res.url, '_blank');
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo descargar', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileCheck2 className="h-7 w-7 text-primary" />
            Mis constancias
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Solicita y descarga las constancias de los atletas a tu cargo.
          </p>
        </div>
        <Button onClick={() => setReqOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Solicitar constancia
        </Button>
      </header>

      <Card>
        <CardHeader><CardTitle>Constancias</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Aún no has solicitado constancias.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Atleta</TableHead>
                  <TableHead>Escuela</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-xs font-mono">{it.folio}</TableCell>
                    <TableCell className="text-sm font-medium">{it.athlete_name}</TableCell>
                    <TableCell className="text-xs">{it.school_name}</TableCell>
                    <TableCell className="text-xs capitalize">{it.kind}</TableCell>
                    <TableCell>
                      <Badge className={STATUS[it.status]?.cls}>{STATUS[it.status]?.label || it.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => window.open(`/cert/${it.folio}`, '_blank')} className="gap-1">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      {it.status === 'issued' && it.pdf_url && (
                        <Button size="sm" variant="outline" onClick={() => downloadPdf(it)} disabled={busyId === it.id} className="gap-1">
                          {busyId === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          PDF
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

      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar constancia</DialogTitle>
            <DialogDescription>Selecciona el atleta y el tipo de constancia que necesitas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Atleta</Label>
              <Select
                value={selectedChild}
                onValueChange={(v) => { setSelectedChild(v); void loadTemplatesForChild(v); setSelectedTpl(''); }}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {children.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de constancia</Label>
              <Select value={selectedTpl} onValueChange={setSelectedTpl} disabled={!selectedChild || templates.length === 0}>
                <SelectTrigger><SelectValue placeholder={!selectedChild ? 'Selecciona atleta primero' : (templates.length === 0 ? 'No hay plantillas activas' : 'Selecciona…')} /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.requires_payment ? ` (${Number(t.price).toLocaleString('es-CO')} COP)` : ' (gratis)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReqOpen(false)}>Cancelar</Button>
            <Button onClick={submitRequest} disabled={!selectedChild || !selectedTpl || reqLoading}>
              {reqLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
