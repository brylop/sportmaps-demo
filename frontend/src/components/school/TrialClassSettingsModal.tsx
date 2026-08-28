import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Settings } from 'lucide-react';
import { useTrialClasses } from '@/hooks/useTrialClasses';

export interface TrialClassSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrialClassSettingsModal({ open, onOpenChange }: TrialClassSettingsModalProps) {
  const { settings, saveSettings, isSavingSettings } = useTrialClasses();

  const [enabled, setEnabled] = useState(true);
  const [price, setPrice] = useState('0');

  useEffect(() => {
    if (open && settings) {
      setEnabled(settings.enabled);
      setPrice(String(settings.price ?? 0));
    }
  }, [open, settings]);

  const handleSave = async () => {
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) return;
    await saveSettings({ enabled, price: numericPrice, requires_approval: settings?.requires_approval ?? false });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border/40 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Settings className="h-5 w-5 text-primary" /> Clases de Prueba
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/80">
            Configura si tu escuela ofrece clases de prueba y su precio por defecto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-4">
            <div>
              <p className="font-semibold text-sm">Habilitar clases de prueba</p>
              <p className="text-xs text-muted-foreground mt-0.5">Permite agendarlas desde este módulo.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold tracking-tight">Precio por defecto (COP)</Label>
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="bg-muted/30 border-border/50 h-11"
            />
            <p className="text-xs text-muted-foreground">
              $0 = sin costo. El cobro se coordina con el prospecto por fuera del sistema.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-medium border-border/50">Cancelar</Button>
          <Button onClick={handleSave} disabled={isSavingSettings} className="font-bold">
            {isSavingSettings && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
