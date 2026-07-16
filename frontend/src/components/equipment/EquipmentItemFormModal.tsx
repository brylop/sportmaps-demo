import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '@/components/common/FileUpload';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { equipmentApi, type EquipmentItem, type EquipmentCondition, type CheckoutOverride } from '@/hooks/useEquipment';

const SHARED = '__shared__';
const INHERIT = '__inherit__';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  branches: Array<{ id: string; name: string }>;
  item: EquipmentItem | null; // null = nuevo
  onSaved: () => void;
}

export function EquipmentItemFormModal({ open, onOpenChange, schoolId, branches, item, onSaved }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [total, setTotal] = useState<number>(1);
  const [branchId, setBranchId] = useState<string>(SHARED);
  const [condition, setCondition] = useState<EquipmentCondition>('nuevo');
  const [override, setOverride] = useState<string>(INHERIT);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setSize(item?.size ?? '');
    setTotal(item?.quantity_total ?? 1);
    setBranchId(item?.branch_id ?? SHARED);
    setCondition(item?.condition ?? 'nuevo');
    setOverride(item?.self_checkout_override ?? INHERIT);
    setPhotoUrl(item?.photo_url ?? null);
  }, [open, item]);

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: 'Falta el nombre', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await equipmentApi.upsertItem({
        p_school_id: schoolId,
        p_id: item?.id ?? null,
        p_name: name.trim(),
        p_quantity_total: Number(total),
        p_branch_id: branchId === SHARED ? null : branchId,
        p_size: size.trim() || null,
        p_condition: condition,
        p_photo_url: photoUrl,
        p_self_checkout_override: override === INHERIT ? null : (override as CheckoutOverride),
      });
      toast({ title: item ? 'Ítem actualizado' : 'Ítem creado' });
      onSaved();
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
          <DialogTitle>{item ? 'Editar ítem' : 'Nuevo ítem de dotación'}</DialogTitle>
          <DialogDescription>
            {item
              ? 'Al editar la cantidad total no puedes bajar de lo ya asignado.'
              : 'Registra un elemento de dotación. La cantidad disponible arranca igual al total.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div>
            <Label htmlFor="eq-name">Nombre</Label>
            <Input id="eq-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Balón fútbol #5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="eq-size">Talla / medida</Label>
              <Input id="eq-size" value={size} onChange={(e) => setSize(e.target.value)} placeholder="M, #5, …" />
            </div>
            <div>
              <Label htmlFor="eq-total">Cantidad total</Label>
              <Input id="eq-total" type="number" min={0} value={total}
                     onChange={(e) => setTotal(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sede</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SHARED}>Compartida (todas)</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condición</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v as EquipmentCondition)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nuevo">Nuevo</SelectItem>
                  <SelectItem value="usado">Usado</SelectItem>
                  <SelectItem value="deteriorado">Deteriorado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Autoservicio para este ítem</Label>
            <Select value={override} onValueChange={setOverride}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={INHERIT}>Heredar config de la escuela</SelectItem>
                <SelectItem value="permitido">Permitido</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Foto (opcional)</Label>
            <FileUpload
              bucket="equipment-photos"
              path={`${schoolId}/items`}
              accept="image/*"
              maxSizeMB={5}
              onUploadComplete={(url) => setPhotoUrl(url)}
            />
            {photoUrl && <p className="text-xs text-muted-foreground mt-1">Foto cargada ✓</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {item ? 'Guardar' : 'Crear ítem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
