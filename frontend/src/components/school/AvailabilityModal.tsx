import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { AvailabilityManager } from './AvailabilityManager';

interface AvailabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  coachName: string;
  schoolId: string;
}

export function AvailabilityModal({
  open,
  onOpenChange,
  coachId,
  coachName,
  schoolId,
}: AvailabilityModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-6 w-6 text-primary" />
            Disponibilidad - {coachName}
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Configura los días, horas y tipos de clase
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 min-h-[400px]">
          <AvailabilityManager coachId={coachId} schoolId={schoolId} />
        </div>

        <DialogFooter className="pt-3 border-t mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}