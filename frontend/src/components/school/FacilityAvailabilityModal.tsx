import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Clock } from 'lucide-react';
import { AvailabilityManager } from './AvailabilityManager';

interface FacilityAvailabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId: string;
  facilityName: string;
  facilityCapacity: number;
  schoolId: string;
}

export function FacilityAvailabilityModal({
  open, onOpenChange, facilityId, facilityName, facilityCapacity, schoolId,
}: FacilityAvailabilityModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 rounded-2xl bg-card border-border/40 shadow-2xl overflow-hidden">
        <DialogHeader className="mb-4 shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Configurar Disponibilidad de {facilityName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Añade, edita o elimina bloques de horario para esta instalación.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          <AvailabilityManager
            resourceType="facility"
            facilityId={facilityId}
            schoolId={schoolId}
            defaultCapacity={facilityCapacity}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
