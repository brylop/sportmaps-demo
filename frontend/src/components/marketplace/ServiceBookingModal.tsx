import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfDay } from 'date-fns';
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
  ChevronRight,
  ChevronLeft,
  Baby,
  User,
  CalendarDays,
  CheckCircle2,
  Stethoscope,
  Sparkles,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { emptySlotsReason, getAvailableSlotsDetailed, requestServiceAppointment } from '@/lib/clinical/api';
import { todayColombia } from '@/lib/dateUtils';
import { clinicalErrorMessage, ageFrom } from '@/lib/clinical/labels';
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
  date_of_birth: string | null;
}

interface TimeSlot {
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

type Step = 'who' | 'date' | 'slot' | 'confirm';

export function ServiceBookingModal({ open, onOpenChange, service, isParent }: ServiceBookingModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(isParent ? 'who' : 'date');

  const [bookingFor, setBookingFor] = useState<'self' | 'child'>(isParent ? 'child' : 'self');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  useEffect(() => {
    if (open) {
      setStep(isParent ? 'who' : 'date');
      setBookingFor(isParent ? 'child' : 'self');
      setSelectedChildId(null);
      setSelectedDate(undefined);
      setSelectedSlot(null);
    }
  }, [open, isParent]);

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

  // El vendor_profile del servicio: viene en el item; si no, se busca por slug.
  const vendorProfileQuery = useQuery({
    queryKey: ['vendor-profile-by-slug', service.vendor_id, service.vendor_slug],
    queryFn: async () => {
      if (service.vendor_id) return { id: service.vendor_id };
      if (!service.vendor_slug) return null;
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('id')
        .eq('slug', service.vendor_slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && (!!service.vendor_id || !!service.vendor_slug),
  });

  // Fecha local del calendario (no toISOString: en Colombia de noche corre un día).
  const dateISO = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const vendorProfileId = vendorProfileQuery.data?.id ?? null;

  const slotsQuery = useQuery({
    queryKey: ['agenda', 'available-slots', vendorProfileId, service.id, dateISO],
    queryFn: () => getAvailableSlotsDetailed(vendorProfileId as string, service.id, dateISO as string),
    enabled: open && !!vendorProfileId && !!dateISO,
  });
  const slots: TimeSlot[] = slotsQuery.data?.slots ?? [];

  const isCourtesyBooking = service.is_courtesy === true || service.price === 0;

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user || !dateISO || !selectedSlot) throw new Error('Datos incompletos');
      if (bookingFor === 'child' && !selectedChildId) throw new Error('Elige para quién es la cita');
      return requestServiceAppointment({
        serviceListingId: service.id,
        date: dateISO,
        time: selectedSlot.start_time,
        childId: bookingFor === 'child' ? selectedChildId : null,
      });
    },
    onSuccess: () => {
      toast.success('Solicitud enviada', {
        description: 'El profesional debe confirmarla. Te avisaremos cuando lo haga.',
      });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['my-wellness-appointments'] });
      onOpenChange(false);
      navigate('/wellness/appointments');
    },
    onError: (err: unknown) => {
      toast.error(clinicalErrorMessage(err));
      // Si el horario se ocupó mientras tanto, refrescar los horarios.
      slotsQuery.refetch();
    },
  });

  const selectedChild = children.find(c => c.id === selectedChildId);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const canProceedFromWho = bookingFor === 'self' || (bookingFor === 'child' && !!selectedChildId);
  const canProceedFromDate = !!selectedDate;
  const canProceedFromSlot = !!selectedSlot;
  const steps: Step[] = isParent ? ['who', 'date', 'slot', 'confirm'] : ['date', 'slot', 'confirm'];
  // "Hoy" en Colombia, no en el huso del dispositivo (la RPC valida en hora de Bogotá).
  const today = startOfDay(new Date(`${todayColombia()}T00:00:00`));

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

        <div className="flex items-center gap-1 px-1">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`h-1.5 rounded-full flex-1 transition-colors ${
                steps.indexOf(step) >= i ? 'bg-emerald-500' : 'bg-muted'
              }`} />
            </div>
          ))}
        </div>

        {/* ── Paso: ¿para quién? (solo acudientes) ── */}
        {step === 'who' && isParent && (
          <div className="space-y-4 py-2">
            <p className="text-sm font-medium">¿Para quién es la cita?</p>

            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  bookingFor === 'self' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border hover:border-emerald-300'
                }`}
                onClick={() => { setBookingFor('self'); setSelectedChildId(null); }}
              >
                <User className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium text-sm">Para mí</p>
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
                  {children.map((child) => {
                    const age = ageFrom(child.date_of_birth);
                    return (
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
                          {age !== null && (
                            <p className="text-xs text-muted-foreground">
                              <Baby className="h-3 w-3 inline mr-1" />
                              {age} años
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
            </div>
          </div>
        )}

        {/* ── Paso: fecha ── */}
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
                onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                disabled={(date) => date < today}
                className="rounded-xl border"
              />
            </div>
          </div>
        )}

        {/* ── Paso: horario ── */}
        {step === 'slot' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium">
                {selectedDate?.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>

            {slotsQuery.isLoading || vendorProfileQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : slotsQuery.isError ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-destructive">{clinicalErrorMessage(slotsQuery.error)}</p>
                <Button variant="outline" size="sm" onClick={() => slotsQuery.refetch()}>Reintentar</Button>
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{emptySlotsReason(slotsQuery.data)}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setStep('date')}>
                  Elegir otra fecha
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.start_time}
                    type="button"
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

        {/* ── Paso: confirmar ── */}
        {step === 'confirm' && (
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-sm">Resumen de la solicitud</h4>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Servicio</span>
                  <span className="font-medium text-right">{service.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Profesional</span>
                  <span className="font-medium text-right">{service.vendor_name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Paciente</span>
                  <span className="font-medium flex items-center gap-1 text-right">
                    {bookingFor === 'child' && selectedChild ? (
                      <><Baby className="h-3.5 w-3.5" />{selectedChild.full_name}</>
                    ) : profile?.full_name}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="font-medium">
                    {selectedDate?.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Hora</span>
                  <span className="font-medium">{selectedSlot?.start_time.slice(0, 5)} — {selectedSlot?.end_time.slice(0, 5)}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-3 text-base">
                  <span className="font-semibold">Valor</span>
                  <span className="font-bold text-emerald-600">
                    {isCourtesyBooking ? (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-4 w-4" />
                        Cortesía
                      </span>
                    ) : (
                      `$${service.price.toLocaleString('es-CO')} COP`
                    )}
                  </span>
                </div>
                {!isCourtesyBooking && (
                  <p className="text-xs text-muted-foreground">
                    Valor de referencia; el pago se acuerda con el profesional.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Tu solicitud queda <strong>por confirmar</strong>. El profesional debe aceptarla y te avisaremos
                por notificación cuando lo haga.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row gap-2">
          {step !== steps[0] && (
            <Button
              variant="outline"
              onClick={() => {
                const idx = steps.indexOf(step);
                if (idx > 0) setStep(steps[idx - 1]);
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Atrás
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
              Elegir hora
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
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Enviar solicitud</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
