import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, CalendarClock, Loader2 } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTrialClasses, type TrialClassBooking, type JointSlot, type BookingChangeNotice } from '@/hooks/useTrialClasses';

const SLOTS_HORIZON_DAYS = 14;

export interface TrialClassRescheduleModalProps {
  booking: TrialClassBooking | null;
  onClose: () => void;
  onRescheduled?: (notice: BookingChangeNotice) => void;
}

export function TrialClassRescheduleModal({ booking, onClose, onRescheduled }: TrialClassRescheduleModalProps) {
  const { getJointSlots, rescheduleBooking, isRescheduling } = useTrialClasses();

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<JointSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<JointSlot | null>(null);

  useEffect(() => {
    if (!booking) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }
    setLoadingSlots(true);
    const from = format(new Date(), 'yyyy-MM-dd');
    const to = format(addDays(new Date(), SLOTS_HORIZON_DAYS), 'yyyy-MM-dd');
    getJointSlots(booking.facility_id, booking.coach_id, from, to)
      .then(setSlots)
      .finally(() => setLoadingSlots(false));
  }, [booking]);

  const slotsByDate = useMemo(() => {
    const groups: Record<string, JointSlot[]> = {};
    for (const s of slots) {
      groups[s.slot_date] = groups[s.slot_date] ?? [];
      groups[s.slot_date].push(s);
    }
    return groups;
  }, [slots]);

  const handleConfirm = async () => {
    if (!booking || !selectedSlot) return;
    const notice = await rescheduleBooking({
      id: booking.id,
      facility_availability_id: selectedSlot.facility_availability_id,
      coach_availability_id: selectedSlot.coach_availability_id,
      scheduled_date: selectedSlot.slot_date,
      start_time: selectedSlot.slot_start_time,
      end_time: selectedSlot.slot_end_time,
    });
    onClose();
    if (notice?.whatsapp_message) onRescheduled?.(notice);
  };

  return (
    <Dialog open={!!booking} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card text-card-foreground border-border/40 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <CalendarClock className="h-6 w-6 text-primary" /> Reprogramar Clase de Prueba
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/80">
            Misma cancha y entrenador — solo cambia la fecha/hora. Se avisa al prospecto por correo y se arma el WhatsApp para reenviar.
          </DialogDescription>
        </DialogHeader>

        {loadingSlots ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : Object.keys(slotsByDate).length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No hay horarios disponibles para esta cancha y entrenador en los próximos {SLOTS_HORIZON_DAYS} días.
          </div>
        ) : (
          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            {Object.entries(slotsByDate).map(([date, daySlots]) => (
              <div key={date} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-primary capitalize flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {format(parseISO(date), 'EEEE d MMM', { locale: es })}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {daySlots.map((s) => {
                    const isSelected = selectedSlot?.facility_availability_id === s.facility_availability_id
                      && selectedSlot?.coach_availability_id === s.coach_availability_id
                      && selectedSlot?.slot_date === s.slot_date
                      && selectedSlot?.slot_start_time === s.slot_start_time;
                    return (
                      <Button
                        key={`${s.slot_date}-${s.slot_start_time}-${s.facility_availability_id}-${s.coach_availability_id}`}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedSlot(s)}
                        className="text-xs h-10"
                      >
                        {s.slot_start_time.slice(0, 5)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11 font-medium border-border/50">Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selectedSlot || isRescheduling} className="flex-1 h-11 font-bold">
            {isRescheduling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar nuevo horario
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
