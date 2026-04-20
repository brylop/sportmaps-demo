import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Baby, User } from 'lucide-react';

interface StudentTypeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectChild: () => void;
  onSelectAdult: () => void;
}

export function StudentTypeSelector({ open, onClose, onSelectChild, onSelectAdult }: StudentTypeSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Atleta</DialogTitle>
          <DialogDescription>
            Selecciona el tipo de registro que deseas realizar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-4 h-auto py-8 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20"
            onClick={() => { onClose(); onSelectChild(); }}
          >
            <Baby className="h-12 w-12 text-blue-500" />
            <div className="text-center">
              <div className="font-bold">Menor de Edad</div>
              <div className="text-xs text-muted-foreground">Requiere acudiente</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-4 h-auto py-8 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20"
            onClick={() => { onClose(); onSelectAdult(); }}
          >
            <User className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <div className="font-bold">Atleta Adulto</div>
              <div className="text-xs text-muted-foreground">Más de 18 años</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
