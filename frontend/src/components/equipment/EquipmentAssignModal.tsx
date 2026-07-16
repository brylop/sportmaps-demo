import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '@/components/common/FileUpload';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  equipmentApi, type EquipmentItem, type EquipmentSettings, type CoachOption,
} from '@/hooks/useEquipment';

const SHARED = '__shared__';

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  item: EquipmentItem | null;
  branches: Array<{ id: string; name: string }>;
  settings: EquipmentSettings | null;
  onAssigned: () => void;
}

export function EquipmentAssignModal({ open, onOpenChange, schoolId, item, branches, settings, onAssigned }: Props) {
  const { toast } = useToast();
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [coachId, setCoachId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [branchId, setBranchId] = useState<string>(SHARED);
  const [dueAt, setDueAt] = useState<string>('');
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [saving, setSaving] = useState(false);

  const requirePhoto = settings?.require_photo_admin_mode ?? false;

  useEffect(() => {
    if (!open || !item) return;
    setCoachId('');
    setQuantity(1);
    setBranchId(item.branch_id ?? SHARED);
    setDueAt(settings?.default_return_days ? addDaysISO(settings.default_return_days) : '');
    setNote('');
    setPhotoUrl(null);
    setLoadingCoaches(true);
    equipmentApi.listCoaches(schoolId)
      .then(setCoaches)
      .catch((e) => toast({ title: 'Error cargando entrenadores', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setLoadingCoaches(false));
  }, [open, item, schoolId, settings, toast]);

  if (!item) return null;

  async function handleAssign() {
    if (!coachId) { toast({ title: 'Selecciona un entrenador', variant: 'destructive' }); return; }
    if (quantity <= 0 || quantity > item!.quantity_available) {
      toast({ title: 'Cantidad inválida', description: `Disponible: ${item!.quantity_available}`, variant: 'destructive' });
      return;
    }
    if (requirePhoto && !photoUrl) { toast({ title: 'La escuela exige foto en la entrega', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      await equipmentApi.assign({
        p_item_id: item!.id,
        p_assigned_to: coachId,
        p_quantity: Number(quantity),
        p_branch_id: branchId === SHARED ? null : branchId,
        p_return_due_at: dueAt || null,
        p_note: note.trim() || null,
        p_photo_url: photoUrl,
      });
      toast({ title: 'Dotación asignada', description: 'El entrenador debe aceptarla en su app.' });
      onAssigned();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar: {item.name}</DialogTitle>
          <DialogDescription>Disponible: {item.quantity_available} de {item.quantity_total}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div>
            <Label>Entrenador</Label>
            <Select value={coachId} onValueChange={setCoachId} disabled={loadingCoaches}>
              <SelectTrigger><SelectValue placeholder={loadingCoaches ? 'Cargando…' : 'Selecciona un entrenador'} /></SelectTrigger>
              <SelectContent>
                {coaches.map((c) => (
                  <SelectItem key={c.profile_id} value={c.profile_id}>{c.full_name ?? c.profile_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingCoaches && coaches.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No hay entrenadores activos en esta escuela.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="eq-qty">Cantidad</Label>
              <Input id="eq-qty" type="number" min={1} max={item.quantity_available} value={quantity}
                     onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="eq-due">Fecha límite de devolución</Label>
              <Input id="eq-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Sede de la operación</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SHARED}>Sin sede específica</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="eq-note">Nota (opcional)</Label>
            <Textarea id="eq-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Foto de entrega {requirePhoto ? '(obligatoria)' : '(opcional)'}</Label>
            <FileUpload
              bucket="equipment-photos"
              path={`${schoolId}/deliveries`}
              accept="image/*"
              maxSizeMB={5}
              onUploadComplete={(url) => setPhotoUrl(url)}
            />
            {photoUrl && <p className="text-xs text-muted-foreground mt-1">Foto cargada ✓</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleAssign} disabled={saving || coaches.length === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
