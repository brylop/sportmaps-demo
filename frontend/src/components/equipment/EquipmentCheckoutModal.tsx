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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Camera, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { equipmentApi, type SelfCheckoutItem } from '@/hooks/useEquipment';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  onDone: () => void;
}

export function EquipmentCheckoutModal({ open, onOpenChange, schoolId, onDone }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<SelfCheckoutItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = items.find((i) => i.id === itemId) ?? null;

  useEffect(() => {
    if (!open) return;
    setItemId(''); setQuantity(1); setNote(''); setPhotoUrl(null);
    setLoading(true);
    equipmentApi.availableForSelfCheckout(schoolId)
      .then(setItems)
      .catch((e) => toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open, schoolId, toast]);

  async function handleSubmit() {
    if (!selected) { toast({ title: 'Selecciona un ítem', variant: 'destructive' }); return; }
    if (quantity <= 0 || quantity > selected.quantity_available) {
      toast({ title: 'Cantidad inválida', description: `Disponible: ${selected.quantity_available}`, variant: 'destructive' });
      return;
    }
    if (!photoUrl) { toast({ title: 'La foto es obligatoria', description: 'Toma una foto de los elementos que llevas.', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      await equipmentApi.selfCheckout({
        p_item_id: selected.id,
        p_quantity: Number(quantity),
        p_photo_url: photoUrl,
        p_branch_id: selected.branch_id,
        p_note: note.trim() || null,
      });
      toast({
        title: 'Registrado ✓',
        description: 'Pendiente de aprobación del administrador. Aceptaste la responsabilidad sobre estos elementos.',
      });
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Tomar dotación</DialogTitle>
          <DialogDescription>Registra los elementos que llevas. Requiere foto de cámara.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No hay ítems disponibles para autoservicio.</p>
        ) : (
          <div className="grid gap-4 py-2">
            <div>
              <Label>Elemento</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un elemento" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}{i.size ? ` (${i.size})` : ''} — disp. {i.quantity_available}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="co-qty">Cantidad</Label>
              <Input id="co-qty" type="number" min={1} max={selected?.quantity_available ?? 1} value={quantity}
                     onChange={(e) => setQuantity(Number(e.target.value))} disabled={!selected} />
            </div>
            <div>
              <Label htmlFor="co-note">Nota (opcional)</Label>
              <Textarea id="co-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Foto de los elementos (obligatoria)</Label>
              <FileUpload
                bucket="equipment-photos"
                path={`${schoolId}/checkouts`}
                accept="image/*"
                capture="environment"
                maxSizeMB={5}
                onUploadComplete={(url) => setPhotoUrl(url)}
              />
              {photoUrl && <p className="text-xs text-muted-foreground mt-1">Foto cargada ✓</p>}
            </div>
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Al confirmar la toma aceptas la responsabilidad sobre estos elementos hasta su devolución.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || loading || items.length === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar toma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
