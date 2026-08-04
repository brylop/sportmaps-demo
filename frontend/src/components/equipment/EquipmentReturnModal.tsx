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
import { equipmentApi, type CoachAssignment, type ReturnCondition } from '@/hooks/useEquipment';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  assignment: CoachAssignment | null;
  onDone: () => void;
}

export function EquipmentReturnModal({ open, onOpenChange, schoolId, assignment, onDone }: Props) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState<number>(1);
  const [condition, setCondition] = useState<ReturnCondition>('bueno');
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const remaining = assignment ? assignment.quantity - assignment.returned_quantity : 0;
  const photoRequired = assignment?.mode === 'self_checkout';

  useEffect(() => {
    if (!open || !assignment) return;
    setQuantity(Math.max(1, remaining));
    setCondition('bueno');
    setNote('');
    setPhotoUrl(null);
  }, [open, assignment, remaining]);

  if (!assignment) return null;

  async function handleSubmit() {
    if (quantity <= 0 || quantity > remaining) {
      toast({ title: 'Cantidad inválida', description: `Puedes devolver hasta ${remaining}.`, variant: 'destructive' });
      return;
    }
    if (photoRequired && !photoUrl) {
      toast({ title: 'La foto es obligatoria', description: 'Esta entrega fue por autoservicio.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await equipmentApi.requestReturn({
        p_assignment_id: assignment!.id,
        p_quantity: Number(quantity),
        p_condition: condition,
        p_photo_url: photoUrl,
        p_note: note.trim() || null,
      });
      toast({ title: 'Devolución registrada', description: 'Pendiente de aprobación del administrador.' });
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
          <DialogTitle>Devolver: {assignment.item_name}</DialogTitle>
          <DialogDescription>Puedes devolver hasta {remaining} (parcial permitido).</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ret-qty">Cantidad a devolver</Label>
              <Input id="ret-qty" type="number" min={1} max={remaining} value={quantity}
                     onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v as ReturnCondition)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bueno">Buen estado</SelectItem>
                  <SelectItem value="dañado">Dañado</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="ret-note">Nota (opcional)</Label>
            <Textarea id="ret-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Foto {photoRequired ? '(obligatoria)' : '(opcional)'}</Label>
            <FileUpload
              bucket="equipment-photos"
              path={`${schoolId}/returns`}
              accept="image/*"
              capture={photoRequired ? 'environment' : undefined}
              maxSizeMB={5}
              onUploadComplete={(url) => setPhotoUrl(url)}
            />
            {photoUrl && <p className="text-xs text-muted-foreground mt-1">Foto cargada ✓</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Registrar devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
