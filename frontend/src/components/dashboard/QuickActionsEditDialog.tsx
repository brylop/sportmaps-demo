import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { QUICK_ACTIONS_CATALOG_SCHOOL, DEFAULT_QUICK_ACTIONS_SCHOOL } from '@/config/quickActionsCatalog';

interface QuickActionsEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentIds: string[];
  onSave: (ids: string[]) => void | Promise<void>;
  saving?: boolean;
}

/**
 * Elegir qué "Acciones Rápidas" se ven en el Dashboard. Sin reordenar en v1
 * (el orden queda como el orden en que se van marcando) — reordenar es un
 * paso aparte si hace falta, no cambia el riesgo de esto.
 */
export function QuickActionsEditDialog({ open, onOpenChange, currentIds, onSave, saving }: QuickActionsEditDialogProps) {
  const [selected, setSelected] = useState<string[]>(
    currentIds.length > 0 ? currentIds : DEFAULT_QUICK_ACTIONS_SCHOOL,
  );

  // Si el diálogo se reabre con otro valor guardado (ej. otro usuario, u otro
  // tab), el checklist tiene que reflejarlo — no quedarse con lo que se marcó
  // la vez anterior que se abrió.
  useEffect(() => {
    if (open) {
      setSelected(currentIds.length > 0 ? currentIds : DEFAULT_QUICK_ACTIONS_SCHOOL);
    }
  }, [open, currentIds]);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalizar Acciones Rápidas</DialogTitle>
          <DialogDescription>
            Elige qué accesos quieres ver en tu Dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {QUICK_ACTIONS_CATALOG_SCHOOL.map((candidate) => {
            const Icon = candidate.icon;
            const checked = selected.includes(candidate.id);
            return (
              <div key={candidate.id} className="flex items-center gap-3">
                <Checkbox
                  id={`qa-${candidate.id}`}
                  checked={checked}
                  onCheckedChange={() => toggle(candidate.id)}
                />
                <Label htmlFor={`qa-${candidate.id}`} className="flex items-center gap-2 font-normal cursor-pointer">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {candidate.label}
                </Label>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={saving || selected.length === 0}
            onClick={() => onSave(selected)}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
