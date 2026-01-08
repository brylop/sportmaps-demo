import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  MapPin, 
  Users, 
  CheckCircle2, 
  CalendarCheck,
  DollarSign,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface Facility {
  id: string;
  name: string;
  type: string;
  capacity: number;
  hourly_rate?: number;
  booking_enabled?: boolean;
  available_hours?: Record<string, string[]>;
}

interface FacilityReservationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facility: Facility | null;
  schoolName: string;
}

const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00'
];

export function FacilityReservationModal({ 
  open, 
  onOpenChange, 
  facility,
  schoolName 
}: FacilityReservationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<'date' | 'time' | 'confirm'>('date');

  // Fetch existing reservations for selected date
  const { data: reservations } = useQuery({
    queryKey: ['facility-reservations', facility?.id, selectedDate],
    queryFn: async () => {
      if (!facility?.id || !selectedDate) return [];
      
      const { data, error } = await supabase
        .from('facility_reservations')
        .select('*')
        .eq('facility_id', facility.id)
        .eq('reservation_date', format(selectedDate, 'yyyy-MM-dd'))
        .in('status', ['pending', 'confirmed']);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!facility?.id && !!selectedDate,
  });

  // Create reservation mutation
  const createReservation = useMutation({
    mutationFn: async () => {
      if (!facility || !selectedDate || !selectedSlot || !user) {
        throw new Error('Datos incompletos');
      }

      const endTime = `${parseInt(selectedSlot.split(':')[0]) + 1}:00`;
      
      const { data, error } = await supabase
        .from('facility_reservations')
        .insert({
          facility_id: facility.id,
          user_id: user.id,
          reservation_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: selectedSlot,
          end_time: endTime,
          price: facility.hourly_rate || 0,
          status: 'confirmed',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      
      toast({
        title: '✅ Reserva Confirmada',
        description: `Tu práctica en ${facility?.name} ha sido reservada para el ${format(selectedDate!, 'PPP', { locale: es })} a las ${selectedSlot}`,
      });
      
      onOpenChange(false);
      resetState();
    },
    onError: (error: any) => {
      toast({
        title: 'Error al reservar',
        description: error.message || 'No se pudo completar la reserva',
        variant: 'destructive',
      });
    },
  });

  const resetState = () => {
    setSelectedDate(addDays(new Date(), 1));
    setSelectedSlot(null);
    setStep('date');
  };

  const getAvailableSlots = () => {
    const bookedSlots = reservations?.map(r => r.start_time) || [];
    return TIME_SLOTS.filter(slot => !bookedSlots.includes(slot));
  };

  const isDateDisabled = (date: Date) => {
    return isBefore(date, startOfDay(new Date()));
  };

  const hourlyRate = facility?.hourly_rate || 15000; // Default $15,000 COP

  if (!facility) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-poppins">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Reservar Práctica Libre
          </DialogTitle>
          <DialogDescription className="font-poppins">
            {facility.name} • {schoolName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2">
            {['date', 'time', 'confirm'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step === s 
                    ? 'bg-primary text-white' 
                    : i < ['date', 'time', 'confirm'].indexOf(step)
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </div>
                {i < 2 && <div className="w-8 h-0.5 bg-muted mx-1" />}
              </div>
            ))}
          </div>

          {/* Step: Select Date */}
          {step === 'date' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-center font-poppins">Selecciona la fecha</h3>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={isDateDisabled}
                  locale={es}
                  className="rounded-md border"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => setStep('time')}
                disabled={!selectedDate}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* Step: Select Time */}
          {step === 'time' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="font-semibold font-poppins">Selecciona la hora</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedDate && format(selectedDate, 'PPPP', { locale: es })}
                </p>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {TIME_SLOTS.map((slot) => {
                  const isBooked = reservations?.some(r => r.start_time === slot);
                  const isSelected = selectedSlot === slot;
                  
                  return (
                    <Button
                      key={slot}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      disabled={isBooked}
                      onClick={() => setSelectedSlot(slot)}
                      className={`${isBooked ? 'opacity-50 line-through' : ''} ${
                        isSelected ? 'bg-primary' : ''
                      }`}
                    >
                      {slot}
                    </Button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('date')} className="flex-1">
                  Atrás
                </Button>
                <Button 
                  onClick={() => setStep('confirm')} 
                  disabled={!selectedSlot}
                  className="flex-1"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <Card className="border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Instalación</span>
                    <span className="font-semibold">{facility.name}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4" />
                      Fecha
                    </span>
                    <span className="font-semibold">
                      {selectedDate && format(selectedDate, 'PPP', { locale: es })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Hora
                    </span>
                    <span className="font-semibold">{selectedSlot} - {parseInt(selectedSlot?.split(':')[0] || '0') + 1}:00</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Capacidad
                    </span>
                    <span className="font-semibold">{facility.capacity} personas</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-lg">
                    <span className="font-semibold flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Total
                    </span>
                    <span className="font-bold text-primary">
                      ${hourlyRate.toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('time')} className="flex-1">
                  Atrás
                </Button>
                <Button 
                  onClick={() => createReservation.mutate()}
                  disabled={createReservation.isPending}
                  className="flex-1 bg-[#248223] hover:bg-[#1d6a1c]"
                >
                  {createReservation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Confirmar Reserva
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}