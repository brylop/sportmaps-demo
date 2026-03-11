import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type SlotStatus = 'available' | 'full' | 'held' | 'booked' | 'excluded' | 'past';

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  instructor_name?: string;
  current_bookings: number;
  status: SlotStatus;
}

interface SlotPickerProps {
  programId: string;
  schoolId: string;
  bookingType: 'trial' | 'program';
  onSlotSelected: (slot: AvailabilitySlot, selectedDate: string) => void;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const statusConfig: Record<SlotStatus, { color: string; label: string; selectable: boolean }> = {
  available: { color: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/25', label: 'Disponible', selectable: true },
  full:      { color: 'bg-gray-100 border-gray-200 text-gray-400', label: 'Lleno', selectable: false },
  held:      { color: 'bg-amber-500/15 border-amber-500/30 text-amber-700', label: 'Reservando...', selectable: false },
  booked:    { color: 'bg-blue-500/15 border-blue-500/30 text-blue-700', label: 'Tu reserva', selectable: false },
  excluded:  { color: 'bg-red-100 border-red-200 text-red-400 line-through', label: 'No disponible', selectable: false },
  past:      { color: 'bg-gray-50 border-gray-100 text-gray-300', label: 'Pasado', selectable: false },
};

export function SlotPicker({ programId, schoolId, bookingType, onSlotSelected }: SlotPickerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [holdingSlot, setHoldingSlot] = useState(false);

  // Generate the next 7 dates for the calendar
  const [weekDates] = useState(() => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    return dates;
  });

  const [selectedDate, setSelectedDate] = useState<Date>(weekDates[0]);

  useEffect(() => {
    fetchSlots();
  }, [programId, selectedDate]);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const dayOfWeek = selectedDate.getDay();

      const { data: availability, error } = await supabase
        .from('school_availability')
        .select(`
          id, day_of_week, start_time, end_time, max_capacity,
          instructor_id, is_active, exceptions
        `)
        .eq('school_id', schoolId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true);

      if (error) throw error;

      if (!availability || availability.length === 0) {
        setSlots([]);
        setLoading(false);
        return;
      }

      // Filter by program if specific
      const filtered = programId
        ? availability.filter(s => !s.program_id || s.program_id === programId)
        : availability;

      // Get booking counts for the selected date
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { data: bookings } = await supabase
        .from('bookings')
        .select('availability_slot_id')
        .in('availability_slot_id', filtered.map(s => s.id))
        .gte('scheduled_at', `${dateStr}T00:00:00`)
        .lte('scheduled_at', `${dateStr}T23:59:59`)
        .not('status', 'eq', 'cancelled');

      // Get active holds
      const { data: holds } = await supabase
        .from('booking_holds')
        .select('availability_slot_id')
        .in('availability_slot_id', filtered.map(s => s.id))
        .eq('scheduled_date', dateStr)
        .gt('expires_at', new Date().toISOString());

      // Get athlete's own bookings
      const { data: myBookings } = await supabase
        .from('bookings')
        .select('availability_slot_id')
        .eq('athlete_id', user?.id || '')
        .in('availability_slot_id', filtered.map(s => s.id))
        .gte('scheduled_at', `${dateStr}T00:00:00`)
        .lte('scheduled_at', `${dateStr}T23:59:59`)
        .not('status', 'eq', 'cancelled');

      const bookingCounts: Record<string, number> = {};
      bookings?.forEach(b => {
        bookingCounts[b.availability_slot_id] = (bookingCounts[b.availability_slot_id] || 0) + 1;
      });

      const holdSet = new Set(holds?.map(h => h.availability_slot_id) || []);
      const myBookingSet = new Set(myBookings?.map(b => b.availability_slot_id) || []);
      const now = new Date();

      const enrichedSlots: AvailabilitySlot[] = filtered.map(slot => {
        const count = bookingCounts[slot.id] || 0;
        const isFull = count >= slot.max_capacity;
        const isHeld = holdSet.has(slot.id) && !myBookingSet.has(slot.id);
        const isBooked = myBookingSet.has(slot.id);
        const isExcluded = slot.exceptions?.some(
          (ex: { date: string }) => ex.date === dateStr
        );

        // Check if time slot is in the past
        const [hours, minutes] = slot.start_time.split(':').map(Number);
        const slotDateTime = new Date(selectedDate);
        slotDateTime.setHours(hours, minutes, 0, 0);
        const isPast = slotDateTime < now;

        let status: SlotStatus = 'available';
        if (isPast) status = 'past';
        else if (isExcluded) status = 'excluded';
        else if (isBooked) status = 'booked';
        else if (isFull) status = 'full';
        else if (isHeld) status = 'held';

        return {
          id: slot.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          max_capacity: slot.max_capacity,
          current_bookings: count,
          status,
        };
      });

      setSlots(enrichedSlots);
    } catch (err) {
      console.error('Error fetching slots:', err);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los horarios disponibles.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = async (slot: AvailabilitySlot) => {
    if (!statusConfig[slot.status].selectable || !user) return;

    try {
      setHoldingSlot(true);
      setSelectedSlot(slot.id);

      // Create a hold on this slot
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { error } = await supabase
        .from('booking_holds')
        .insert({
          athlete_id: user.id,
          availability_slot_id: slot.id,
          scheduled_date: dateStr,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });

      if (error) throw error;

      onSlotSelected(slot, dateStr);
    } catch (err) {
      console.error('Error holding slot:', err);
      toast({
        title: 'Error',
        description: 'No se pudo reservar el horario. Intenta de nuevo.',
        variant: 'destructive',
      });
      setSelectedSlot(null);
    } finally {
      setHoldingSlot(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          {bookingType === 'trial' ? 'Selecciona fecha para tu prueba' : 'Selecciona tu horario'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {weekDates.map((date) => {
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all min-w-[72px] ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-accent'
                }`}
              >
                <span className="text-xs font-medium">{DAY_NAMES[date.getDay()]}</span>
                <span className="text-lg font-bold">{date.getDate()}</span>
                {isToday && (
                  <span className="text-[10px] font-medium text-primary">Hoy</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Day label */}
        <p className="text-sm text-muted-foreground font-medium">
          {DAY_NAMES_FULL[selectedDate.getDay()]} {selectedDate.getDate()}/{selectedDate.getMonth() + 1}
        </p>

        {/* Slots grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground font-medium">No hay horarios disponibles para este día.</p>
            <p className="text-sm text-muted-foreground mt-1">Prueba seleccionando otro día.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {slots.map((slot) => {
              const config = statusConfig[slot.status];
              const spotsLeft = slot.max_capacity - slot.current_bookings;
              return (
                <button
                  key={slot.id}
                  onClick={() => handleSlotClick(slot)}
                  disabled={!config.selectable || holdingSlot}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${config.color} ${
                    config.selectable ? 'cursor-pointer' : 'cursor-not-allowed'
                  } ${selectedSlot === slot.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </p>
                      {slot.instructor_name && (
                        <p className="text-xs opacity-75">Prof. {slot.instructor_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-[10px]">
                      {config.label}
                    </Badge>
                    {config.selectable && (
                      <p className="text-xs mt-1 flex items-center gap-1 justify-end">
                        <Users className="h-3 w-3" />
                        {spotsLeft} {spotsLeft === 1 ? 'cupo' : 'cupos'}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-2 border-t">
          {(['available', 'full', 'held', 'booked'] as SlotStatus[]).map((st) => (
            <div key={st} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`w-3 h-3 rounded ${statusConfig[st].color.split(' ')[0]}`} />
              <span>{statusConfig[st].label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
