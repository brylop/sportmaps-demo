import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dumbbell, Camera, Loader2, Check, AlertTriangle, Undo2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { equipmentApi, type CoachAssignment } from '@/hooks/useEquipment';
import { EquipmentReturnModal } from '@/components/equipment/EquipmentReturnModal';
import { EquipmentCheckoutModal } from '@/components/equipment/EquipmentCheckoutModal';

const STATUS_LABEL: Record<string, string> = {
  pendiente_aceptacion: 'Por aceptar',
  pendiente_aprobacion_entrega: 'Por aprobar (admin)',
  activa: 'Activa',
  en_disputa: 'En disputa',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  cerrada: 'Cerrada',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { dateStyle: 'medium' });
}

async function downloadActa(path: string) {
  const { data } = await supabase.storage.from('certificates').createSignedUrl(path, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
}

export default function CoachEquipmentPage() {
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();
  const [rows, setRows] = useState<CoachAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [returnFor, setReturnFor] = useState<CoachAssignment | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    equipmentApi.myAssignments()
      .then(setRows)
      .catch((e) => toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const pending = useMemo(() => rows.filter((r) => r.status === 'pendiente_aceptacion'), [rows]);
  const active = useMemo(() => rows.filter((r) => r.status === 'activa'), [rows]);
  const history = useMemo(
    () => rows.filter((r) => !['pendiente_aceptacion', 'activa'].includes(r.status)),
    [rows]
  );

  async function run(id: string, fn: () => Promise<void>, okMsg: string) {
    setBusyId(id);
    try { await fn(); toast({ title: okMsg }); load(); }
    catch (e) { toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusyId(null); }
  }

  function handleReportDifference(a: CoachAssignment) {
    const qtyStr = window.prompt(`¿Cuántas unidades recibiste realmente? (asignadas: ${a.quantity})`);
    if (qtyStr == null) return;
    const qty = Number(qtyStr);
    if (!Number.isFinite(qty) || qty < 0) { toast({ title: 'Cantidad inválida', variant: 'destructive' }); return; }
    const note = window.prompt('Describe la diferencia (obligatorio):') ?? '';
    if (!note.trim()) { toast({ title: 'La nota es obligatoria', variant: 'destructive' }); return; }
    void run(a.id, () => equipmentApi.reportDifference(a.id, qty, note.trim()), 'Diferencia reportada');
  }

  function Row({ a, actions }: { a: CoachAssignment; actions?: ReactNode }) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b last:border-0">
        <div className="min-w-0">
          <p className="font-medium truncate">
            {a.item_name}{a.size ? ` · ${a.size}` : ''} <span className="text-muted-foreground">× {a.quantity}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {a.branch_name ?? 'Sin sede'} · <Badge variant="secondary" className="text-[10px]">{STATUS_LABEL[a.status] ?? a.status}</Badge>
            {a.return_due_at && a.status === 'activa' && <> · Devolver antes: {fmtDate(a.return_due_at)}</>}
            {a.returned_quantity > 0 && <> · Devuelto: {a.returned_quantity}/{a.quantity}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {a.acta_pdf_url && (
            <Button size="sm" variant="ghost" onClick={() => void downloadActa(a.acta_pdf_url!)} title="Descargar acta">
              <FileDown className="h-4 w-4" />
            </Button>
          )}
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Dumbbell className="h-7 w-7 text-primary" /> Mi dotación
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Elementos bajo tu responsabilidad.</p>
        </div>
        <Button onClick={() => setCheckoutOpen(true)}>
          <Camera className="h-4 w-4 mr-2" /> Tomar dotación
        </Button>
      </header>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Por aceptar ({pending.length})</CardTitle></CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nada por aceptar.</p>
              ) : pending.map((a) => (
                <Row key={a.id} a={a} actions={
                  <>
                    <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => handleReportDifference(a)}>
                      <AlertTriangle className="h-4 w-4 mr-1" /> Diferencia
                    </Button>
                    <Button size="sm" disabled={busyId === a.id} onClick={() => void run(a.id, () => equipmentApi.accept(a.id), 'Recibido aceptado')}>
                      {busyId === a.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Acepto
                    </Button>
                  </>
                } />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Activas ({active.length})</CardTitle></CardHeader>
            <CardContent>
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Sin dotación activa.</p>
              ) : active.map((a) => (
                <Row key={a.id} a={a} actions={
                  <Button size="sm" variant="outline" onClick={() => setReturnFor(a)}>
                    <Undo2 className="h-4 w-4 mr-1" /> Devolver
                  </Button>
                } />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Historial ({history.length})</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Sin historial.</p>
              ) : history.map((a) => <Row key={a.id} a={a} />)}
            </CardContent>
          </Card>
        </div>
      )}

      {schoolId && (
        <EquipmentCheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} schoolId={schoolId} onDone={load} />
      )}
      <EquipmentReturnModal
        open={returnFor !== null}
        onOpenChange={(v) => { if (!v) setReturnFor(null); }}
        schoolId={schoolId ?? ''}
        assignment={returnFor}
        onDone={load}
      />
    </div>
  );
}
