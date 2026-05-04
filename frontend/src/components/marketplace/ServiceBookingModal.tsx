import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import {
  Loader2,
  Clock,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Baby,
  User,
  CalendarDays,
  CheckCircle2,
  Stethoscope,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWompiCheckout } from '@/hooks/useWompiCheckout';
import type { ExploreItem } from '@/hooks/useExplorarGlobal';

interface ServiceBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ExploreItem;
  isParent: boolean;
}

interface Child {
  id: string;
  full_name: string;
  date_of_birth: string;
}

interface TimeSlot {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  available: boolean;
}

type Step = 'who' | 'date' | 'slot' | 'confirm';

export function ServiceBookingModal({ open, onOpenChange, service, isParent }: ServiceBookingModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(isParent ? 'who' : 'date');

  // State
  const [bookingFor, setBookingFor] = useState<'self' | 'child'>(isParent ? 'child' : 'self');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep(isParent ? 'who' : 'date');
      setBookingFor(isParent ? 'child' : 'self');
      setSelectedChildId(null);
      setSelectedDate(undefined);
      setSelectedSlot(null);
    }
  }, [open, isParent]);

  // Fetch children (for parents)
  const { data: children = [] } = useQuery({
    queryKey: ['my-children-booking', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('children')
        .select('id, full_name, date_of_birth')
        .eq('parent_id', user.id)
        .order('full_name');
      if (error) throw error;
      return (data || []) as Child[];
    },
    enabled: open && isParent && !!user,
  });

  // Fetch vendor profile for slots
  const vendorProfileQuery = useQuery({
    queryKey: ['vendor-profile-by-slug', service.vendor_slug],
    queryFn: async () => {
      if (!service.vendor_slug) return null;
      const { data } = await supabase
        .from('vendor_profiles')
        .select('id, user_id')
        .eq('slug', service.vendor_slug)
        .single();
      return data;
    },
    enabled: open && !!service.vendor_slug,
  });

  // Fetch available slots for selected date
  const slotsQuery = useQuery({
    queryKey: ['available-slots', vendorProfileQuery.data?.id, service.id, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!vendorProfileQuery.data?.id || !selectedDate) return { slots: [] };
      const { data } = await supabase.rpc('get_available_slots', {
        p_vendor_profile_id: vendorProfileQuery.data.id,
        p_service_listing_id: service.id,
        p_date: selectedDate.toISOString().split('T')[0],
      });
      return data || { slots: [] };
    },
    enabled: !!vendorProfileQuery.data?.id && !!selectedDate,
  });

  const slots: TimeSlot[] = slotsQuery.data?.slots || [];

  // Un servicio es cortesia si viene marcado explicitamente is_courtesy o si su precio es 0.
  const isCourtesyBooking = service.is_courtesy === true || isCourtesyBooking;

  // Create appointment + checkout
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedDate || !selectedSlot) throw new Error('Datos incompletos');

      const athleteId = bookingFor === 'child' ? selectedChildId : user.id;
      const athleteName = bookingFor === 'child'
        ? children.find(c => c.id === selectedChildId)?.full_name
        : profile?.full_name;

      // 1. Create appointment
      const { data: appointment, error: aptErr } = await supabase
        .from('wellness_appointments')
        .insert({
          professional_id: vendorProfileQuery.data?.user_id,
          athlete_id: athleteId,
          athlete_name: athleteName,
          appointment_date: selectedDate.toISOString().split('T')[0],
          appointment_time: selectedSlot.start_time,
          duration_minutes: selectedSlot.duration_minutes,
          service_type: service.service_type || 'Otro',
          service_listing_id: service.id,
          price: isCourtesyBooking ? 0 : service.price,
          payment_status: isCourtesyBooking ? 'courtesy' : 'pending',
          is_courtesy: isCourtesyBooking,
          booking_source: 'marketplace',
          status: isCourtesyBooking ? 'confirmed' : 'pending',
        })
        .select('id')
        .single();

      if (aptErr) throw new Error(aptErr.message);

      // 2. If courtesy, just return
      if (isCourtesyBooking) {
        return { type: 'courtesy', appointmentId: appointment.id };
      }

      // 3. Open Wompi checkout via unified hook (BFF + Widget)
      return { type: 'paid', appointmentId: appointment.id };
    },
    onSuccess: async (result) => {
      if (result.type === 'courtesy') {
        toast.success('Sesion de cortesia confirmada');
        onOpenChange(false);
        navigate('/wellness/appointments');
        return;
      }
      // Disparar Wompi widget — el hook habla con el BFF y abre el widget
      toast.success('Abriendo pago seguro...');
      const tx = await startServiceCheckout({
        appointmentId: result.appointmentId,
        serviceListingId: service.id,
      });
      if (tx?.status === 'APPROVED') {
        onOpenChange(false);
        navigate('/wellness/appointments');
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al reservar');
    },
  });

  // Hook unificado de Wompi
  const { startServiceCheckout } = useWompiCheckout({
    onError: (err) => toast.error(err.message),
  });

  const selectedChild = children.find(c => c.id === selectedChildId);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const canProceedFromWho = bookingFor === 'self' || (bookingFor === 'child' && selectedChildId);
  const canProceedFromDate = !!selectedDate;
  const canProceedFromSlot = !!selectedSlot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-emerald-600" />
            Reservar cita
          </DialogTitle>
          <DialogDescription>
            {service.name} — {service.vendor_name}
            {service.vendor_city && ` (${service.vendor_city})`}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-1">
          {(isParent ? ['who', 'date', 'slot', 'confirm'] as Step[] : ['date', 'slot', 'confirm'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`h-1.5 rounded-full flex-1 transition-colors ${
                (isParent ? ['who', 'date', 'slot', 'confirm'] : ['date', 'slot', 'confirm']).indexOf(step) >= i
                  ? 'bg-emerald-500' : 'bg-muted'
              }`} />
            </div>
          ))}
        </div>

        {/* ── Step: WHO (parents only) ──────────────────────────────────────── */}
        {step === 'who' && isParent && (
          <div className="space-y-4 py-2">
            <p className="text-sm font-medium">¿Para quien es la cita?</p>

            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  bookingFor === 'self' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border hover:border-emerald-300'
                }`}
                onClick={() => { setBookingFor('self'); setSelectedChildId(null); }}
              >
                <User className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium text-sm">Para mi</p>
                  <p className="text-xs text-muted-foreground">{profile?.full_name}</p>
                </div>
              </label>

              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Mis hijos</p>

              {children.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No tienes hijos registrados.
                  <Button variant="link" size="sm" onClick={() => navigate('/my-children')}>
                    Agregar hijo
                  </Button>
                </p>
              ) : (
                <RadioGroup
                  value={selectedChildId || ''}
                  onValueChange={(v) => { setSelectedChildId(v); setBookingFor('child'); }}
                  className="space-y-2"
                >
                  {children.map((child) => (
                    <label
                      key={child.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        bookingFor === 'child' && selectedChildId === child.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'border-border hover:border-emerald-300'
                      }`}
                    >
                      <RadioGroupItem value={child.id} className="sr-only" />
                      <Avatar className="h-9 w-9 bg-emerald-100">
                        <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-bold">
                          {getInitials(child.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{child.full_name}</p>
                        {child.date_of_birth && (
                          <p className="text-xs text-muted-foreground">
                            <Baby className="h-3 w-3 inline mr-1" />
                            {new Date().getFullYear() - new Date(child.date_of_birth).getFullYear()} años
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}
            </div>
          </div>
        )}

        {/* ── Step: DATE ─────────────────────────────────────────────────────── */}
        {step === 'date' && (
          <div className="space-y-4 py-2">
            {bookingFor === 'child' && selectedChild && (
              <Badge variant="outline" className="gap-1.5">
                <Baby className="h-3.5 w-3.5" />
                Cita para: {selectedChild.full_name}
              </Badge>
            )}
            <p className="text-sm font-medium">Selecciona una fecha</p>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date() || date.getDay() === 0}
                className="rounded-xl border"
              />
            </div>
          </div>
        )}

        {/* ── Step: SLOT ─────────────────────────────────────────────────────── */}
        {step === 'slot' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium">
                {selectedDate?.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>

            {slotsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No hay horarios disponibles este dia</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setStep('date')}>
                  Elegir otra fecha
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.filter(s => s.available).map((slot) => (
                  <button
                    key={slot.start_time}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      selectedSlot?.start_time === slot.start_time
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-sm'
                        : 'border-border hover:border-emerald-300'
                    }`}
                  >
                    <p className="font-semibold text-sm">{slot.start_time.slice(0, 5)}</p>
                    <p className="text-[10px] text-muted-foreground">{slot.duration_minutes} min</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step: CONFIRM ──────────────────────────────────────────────────── */}
        {step === 'confirm' && (
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-sm">Resumen de la reserva</h4>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Servicio</span>
                  <span className="font-medium">{service.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profesional</span>
                  <span className="font-medium">{service.vendor_name}</span>
                </div>
                {bookingFor === 'child' && selectedChild && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paciente</span>
                    <span className="font-medium flex items-center gap-1">
                      <Baby className="h-3.5 w-3.5" />
                      {selectedChild.full_name}
                    </span>
                  </div>
                )}
                {bookingFor === 'self' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paciente</span>
                    <span className="font-medium">{profile?.full_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="font-medium">
                    {selectedDate?.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hora</span>
                  <span className="font-medium">{selectedSlot?.start_time.slice(0, 5)} — {selectedSlot?.end_time.slice(0, 5)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-emerald-600">
                    {isCourtesyBooking ? (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-4 w-4" />
                        Cortesia
                      </span>
                    ) : (
                      `$${service.price.toLocaleString('es-CO')} COP`
                    )}
                  </span>
                </div>
              </div>
            </div>

            {service.price > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Se abrira el checkout seguro de Wompi para completar el pago.
              </p>
            )}
          </div>
        )}

        {/* ── Navigation buttons ─────────────────────────────────────────────── */}
        <DialogFooter className="flex-row gap-2">
          {step !== (isParent ? 'who' : 'date') && (
            <Button
              variant="outline"
              onClick={() => {
                const steps: Step[] = isParent ? ['who', 'date', 'slot', 'confirm'] : ['date', 'slot', 'confirm'];
                const idx = steps.indexOf(step);
                if (idx > 0) setStep(steps[idx - 1]);
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Atras
            </Button>
          )}

          <div className="flex-1" />

          {step === 'who' && (
            <Button
              onClick={() => setStep('date')}
              disabled={!canProceedFromWho}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 'date' && (
            <Button
              onClick={() => setStep('slot')}
              disabled={!canProceedFromDate}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Ver horarios
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 'slot' && (
            <Button
              onClick={() => setStep('confirm')}
              disabled={!canProceedFromSlot}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirmar hora
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 'confirm' && (
            <Button
              onClick={() => bookMutation.mutate()}
              disabled={bookMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {bookMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
              ) : isCourtesyBooking ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar cortesia</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Pagar ${service.price.toLocaleString('es-CO')}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
