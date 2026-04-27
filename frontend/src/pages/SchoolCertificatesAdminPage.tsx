import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, FileText, ShieldOff, Download, RefreshCw, Settings, FileCheck2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';

type Row = {
  id: string;
  folio: string;
  kind: string;
  title: string;
  status: 'pending_payment' | 'pending_review' | 'issued' | 'revoked';
  created_at: string;
  issued_at: string | null;
  pdf_url: string | null;
  qr_verify_token: string;
  template_id: string;
  athlete_name: string;
  template_name: string;
  requires_payment: boolean;
  price: number | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: 'Pendiente pago',   cls: 'bg-amber-100 text-amber-800' },
  pending_review:  { label: 'Por aprobar',      cls: 'bg-blue-100 text-blue-800' },
  issued:          { label: 'Emitida',          cls: 'bg-green-100 text-green-800' },
  revoked:         { label: 'Revocada',         cls: 'bg-gray-200 text-gray-700' },
};

export default function SchoolCertificatesAdminPage() {
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, search, status]);

  async function load() {
    if (!schoolId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('list_athlete_certificates' as any, {
      p_school_id: schoolId,
      p_status: status === 'all' ? null : status,
      p_kind:   null,
      p_search: search || null,
      p_limit:  100,
      p_offset: 0,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setRows([]);
      return;
    }
    setRows(((data as any)?.rows ?? []) as Row[]);
  }

  async function approve(r: Row) {
    setBusyId(r.id);
    const { error } = await supabase.rpc('issue_athlete_certificate' as any, { p_certificate_id: r.id });
    if (error) {
      setBusyId(null);
      toast({ title: 'No se pudo emitir', description: error.message, variant: 'destructive' });
      return;
    }
    // generar PDF
    try {
      const res = await bffClient.post<any>(`/api/v1/certificates/${r.id}/generate-pdf`, {});
      if (!res?.ok) throw new Error(res?.error || 'pdf_failed');
      toast({ title: 'Constancia emitida', description: `Folio ${r.folio} · PDF generado` });
    } catch (e: any) {
      toast({ title: 'Emitida sin PDF', description: e?.message || 'Genera el PDF manualmente luego', variant: 'destructive' });
    } finally {
      setBusyId(null);
      await load();
    }
  }

  async function regeneratePdf(r: Row) {
    setBusyId(r.id);
    try {
      const res = await bffClient.post<any>(`/api/v1/certificates/${r.id}/generate-pdf`, {});
      if (!res?.ok) throw new Error(res?.error || 'pdf_failed');
      toast({ title: 'PDF regenerado' });
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo regenerar', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  async function downloadPdf(r: Row) {
    setBusyId(r.id);
    try {
      const res = await bffClient.get<any>(`/api/v1/certificates/${r.id}/signed-url`);
      if (!res?.url) throw new Error(res?.error || 'no_url');
      window.open(res.url, '_blank');
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No se pudo descargar', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(r: Row) {
    const reason = window.prompt('Motivo de la revocación (opcional):') ?? null;
    const { error } = await supabase.rpc('revoke_athlete_certificate' as any, {
      p_certificate_id: r.id,
      p_reason: reason,
    });
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    toast({ title: 'Constancia revocada' });
    await load();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileCheck2 className="h-7 w-7 text-primary" />
            Constancias
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aprueba solicitudes de los atletas, genera PDFs con folio único y firma.
          </p>
        </div>
        <Link to="/cards/templates/certificates">
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Plantillas
          </Button>
        </Link>
      </header>

      <Card>
        <CardHeader><CardTitle>Solicitudes y constancias emitidas</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar folio o atleta…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending_review">Por aprobar</SelectItem>
                <SelectItem value="pending_payment">Pendiente pago</SelectItem>
                <SelectItem value="issued">Emitidas</SelectItem>
                <SelectItem value="revoked">Revocadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Sin constancias en este filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Atleta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Solicitada</TableHead>
                  <TableHead>Emitida</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono">{r.folio}</TableCell>
                    <TableCell className="text-sm font-medium">{r.athlete_name}</TableCell>
                    <TableCell className="text-xs">
                      <span className="capitalize">{r.kind}</span>
                      <span className="text-muted-foreground"> · {r.template_name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS[r.status]?.cls}>
                        {STATUS[r.status]?.label || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString('es-CO')}</TableCell>
                    <TableCell className="text-xs">{r.issued_at ? new Date(r.issued_at).toLocaleDateString('es-CO') : '—'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {(r.status === 'pending_review') && (
                        <Button size="sm" onClick={() => approve(r)} disabled={busyId === r.id} className="gap-1">
                          {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          Emitir
                        </Button>
                      )}
                      {r.status === 'issued' && r.pdf_url && (
                        <Button size="sm" variant="outline" onClick={() => downloadPdf(r)} disabled={busyId === r.id} className="gap-1">
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      )}
                      {r.status === 'issued' && (
                        <Button size="sm" variant="ghost" onClick={() => regeneratePdf(r)} disabled={busyId === r.id} className="gap-1">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {r.status !== 'revoked' && (
                        <Button size="sm" variant="outline" onClick={() => revoke(r)} className="gap-1 text-red-600 hover:bg-red-50">
                          <ShieldOff className="h-3.5 w-3.5" />
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
    </div>
  );
}
