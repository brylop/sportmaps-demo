import { useCallback, useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageCheck, Undo2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  equipmentApi, type PendingDelivery, type PendingReturn, type ReturnCondition,
} from '@/hooks/useEquipment';

// Firma una ruta privada del bucket equipment-photos para mostrarla.
function usePrivatePhoto(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) { setUrl(null); return; }
    supabase.storage.from('equipment-photos').createSignedUrl(path, 3600)
      .then(({ data }) => { if (active) setUrl(data?.signedUrl ?? null); });
    return () => { active = false; };
  }, [path]);
  return url;
}

function PhotoThumb({ path, label }: { path: string | null; label: string }) {
  const url = usePrivatePhoto(path);
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className="rounded-md border max-h-40 object-cover w-full" />
        </a>
      ) : (
        <div className="rounded-md border bg-muted/40 h-24 flex items-center justify-center text-xs text-muted-foreground">
          Sin foto
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  onChanged: () => void;
}

export function EquipmentApprovalQueue({ open, onOpenChange, schoolId, onChanged }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<PendingDelivery[]>([]);
  const [returns, setReturns] = useState<PendingReturn[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [condById, setCondById] = useState<Record<string, ReturnCondition>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await equipmentApi.pendingApprovals(schoolId);
      setDeliveries(data.deliveries ?? []);
      setReturns(data.returns ?? []);
      setCondById(Object.fromEntries((data.returns ?? []).map((r) => [r.id, r.condition])));
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [schoolId, toast]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  async function run(id: string, fn: () => Promise<void>, okMsg: string) {
    setBusyId(id);
    try {
      await fn();
      toast({ title: okMsg });
      await load();
      onChanged();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  const total = deliveries.length + returns.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cola de aprobación</DialogTitle>
          <DialogDescription>Entregas y devoluciones pendientes de tu aprobación.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : total === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No hay nada pendiente. 🎉</p>
        ) : (
          <div className="space-y-6">
            {deliveries.length > 0 && (
              <section>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <PackageCheck className="h-4 w-4" /> Tomas por aprobar ({deliveries.length})
                </h3>
                <div className="space-y-3">
                  {deliveries.map((d) => (
                    <Card key={d.id}>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{d.item_name} × {d.quantity}</span>
                          <span className="text-muted-foreground">{d.coach_name ?? '—'}</span>
                        </div>
                        {d.checkout_note && <p className="text-xs text-muted-foreground">{d.checkout_note}</p>}
                        <PhotoThumb path={d.checkout_photo_url} label="Foto de la toma" />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" disabled={busyId === d.id}
                            onClick={() => {
                              const note = window.prompt('Motivo del rechazo (obligatorio):') ?? '';
                              if (!note.trim()) return;
                              void run(d.id, () => equipmentApi.rejectDelivery(d.id, note.trim()), 'Toma rechazada');
                            }}>
                            Rechazar
                          </Button>
                          <Button size="sm" disabled={busyId === d.id}
                            onClick={() => void run(d.id, async () => { await equipmentApi.approveDelivery(d.id); try { await equipmentApi.generateActa(d.id); } catch { /* acta best-effort */ } }, 'Toma aprobada')}>
                            {busyId === d.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Aprobar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {returns.length > 0 && (
              <section>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Undo2 className="h-4 w-4" /> Devoluciones por aprobar ({returns.length})
                </h3>
                <div className="space-y-3">
                  {returns.map((r) => (
                    <Card key={r.id}>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{r.item_name}</span>
                          <span className="text-muted-foreground">{r.coach_name ?? '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span>Devuelve <strong>{r.quantity}</strong> de {r.assigned_quantity}</span>
                          {r.quantity !== r.assigned_quantity && <Badge variant="secondary">Parcial</Badge>}
                          {r.status === 'en_disputa' && <Badge variant="destructive">En disputa</Badge>}
                        </div>
                        {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                        <div className="flex gap-3">
                          <PhotoThumb path={r.checkout_photo_url} label="Entrega" />
                          <PhotoThumb path={r.photo_url} label="Devolución" />
                        </div>
                        <div className="flex items-end gap-2 justify-end">
                          <div className="w-40">
                            <label className="text-xs text-muted-foreground">Condición final</label>
                            <Select value={condById[r.id] ?? r.condition}
                              onValueChange={(v) => setCondById((m) => ({ ...m, [r.id]: v as ReturnCondition }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bueno">Bueno (regresa)</SelectItem>
                                <SelectItem value="dañado">Dañado (no regresa)</SelectItem>
                                <SelectItem value="perdido">Perdido (baja inventario)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button size="sm" variant="outline" disabled={busyId === r.id}
                            onClick={() => {
                              const note = window.prompt('Motivo de la disputa (obligatorio):') ?? '';
                              if (!note.trim()) return;
                              void run(r.id, () => equipmentApi.disputeReturn(r.id, note.trim()), 'Devolución en disputa');
                            }}>
                            Disputar
                          </Button>
                          <Button size="sm" disabled={busyId === r.id}
                            onClick={() => void run(r.id, () => equipmentApi.approveReturn(r.id, condById[r.id] ?? r.condition), 'Devolución aprobada')}>
                            {busyId === r.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Aprobar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
