import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { equipmentApi } from '@/hooks/useEquipment';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  onSaved: () => void;
}

export function EquipmentSettingsDialog({ open, onOpenChange, schoolId, onSaved }: Props) {
  const { toast } = useToast();
  const [selfCheckout, setSelfCheckout] = useState(false);
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [returnDays, setReturnDays] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    equipmentApi.getSettings(schoolId)
      .then((s) => {
        setSelfCheckout(s?.self_checkout_enabled ?? false);
        setRequirePhoto(s?.require_photo_admin_mode ?? false);
        setReturnDays(s?.default_return_days != null ? String(s.default_return_days) : '');
      })
      .catch((e) => toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open, schoolId, toast]);

  async function handleSave() {
    setSaving(true);
    try {
      await equipmentApi.saveSettings({
        p_school_id: schoolId,
        p_self_checkout_enabled: selfCheckout,
        p_require_photo_admin_mode: requirePhoto,
        p_default_return_days: returnDays.trim() === '' ? null : Number(returnDays),
      });
      toast({ title: 'Ajustes guardados' });
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustes de Dotación</DialogTitle>
          <DialogDescription>Configura el modo de operación del módulo.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="grid gap-5 py-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label>Habilitar autoservicio de entrenadores</Label>
                <p className="text-xs text-muted-foreground">Permite que el entrenador tome elementos y los registre (con foto).</p>
              </div>
              <Switch checked={selfCheckout} onCheckedChange={setSelfCheckout} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label>Exigir foto también en entregas por admin</Label>
                <p className="text-xs text-muted-foreground">Obliga a adjuntar foto al asignar en Modo A.</p>
              </div>
              <Switch checked={requirePhoto} onCheckedChange={setRequirePhoto} />
            </div>
            <div>
              <Label htmlFor="eq-days">Días por defecto para devolución</Label>
              <Input id="eq-days" type="number" min={0} value={returnDays} placeholder="Ej. 120 (vacío = sin límite)"
                     onChange={(e) => setReturnDays(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
