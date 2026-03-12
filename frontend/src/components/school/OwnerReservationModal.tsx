import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Clock, Building2, CalendarCheck, CheckCircle2, Loader2,
  Wrench, UserCheck, Lock, Pencil,
} from 'lucide-react';
import { format, isBefore, startOfDay, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  FacilityReservation,
  CreateReservationPayload,
  UpdateReservationPayload,
} from '@/hooks/useFacilityReservations';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Facility {
  id: string;
  name: string;
  type: string;
  capacity: number;
  hourly_rate?: number;
}

type ReservationType = 'manual' | 'block';
type Step = 'details' | 'datetime' | 'confirm';

export interface OwnerReservationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilities: Facility[];
  editReservation?: FacilityReservation | null;
  onSubmit: (
    payload: CreateReservationPayload | { id: string; payload: UpdateReservationPayload }
  ) => Promise<any>;
  isLoading?: boolean;
  getBookedSlots: (facilityId: string, date: Date, excludeId?: string) => Promise<string[]>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  '06:00','07:00','08:00','09:00','10:00','11:00',
  '12:00','13:00','14:00','15:00','16:00','17:00',
  '18:00','19:00','20:00','21:00',
];

const RESERVATION_TYPES: {
  value: ReservationType; label: string; description: string;
  icon: React.ReactNode; color: string;
}[] = [
  {
    value: 'manual',
    label: 'Reserva Manual',
    description: 'Registra una reserva hecha por teléfono o en persona.',
    icon: <UserCheck className="h-5 w-5" />,
    color: 'border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400',
  },
  {
    value: 'block',
    label: 'Bloqueo Interno',
    description: 'Bloquea el espacio para mantenimiento o uso interno.',
    icon: <Lock className="h-5 w-5" />,
    color: 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectType(notes: string | null): ReservationType {
  if (!notes) return 'manual';
  const lower = notes.toLowerCase();
  return lower.includes('bloqueo') || lower.includes('mantenimiento') ? 'block' : 'manual';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OwnerReservationModal({
  open, onOpenChange, facilities, editReservation,
  onSubmit, isLoading = false, getBookedSlots,
}: OwnerReservationModalProps) {
  const isEdit = !!editReservation;

  const [step, setStep] = useState<Step>('details');
  const [reservationType, setReservationType] = useState<ReservationType>('manual');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Pre-fill on edit
  useEffect(() => {
    if (editReservation && open) {
      setSelectedFacilityId(editReservation.facility_id);
      setNotes(editReservation.notes ?? '');
      setReservationType(detectType(editReservation.notes));
      setSelectedDate(parse(editReservation.reservation_date, 'yyyy-MM-dd', new Date()));
      setSelectedSlots([editReservation.start_time.slice(0, 5)]);
      // Note: In edit mode, we currently only support editing single-hour reservations 
      // or the start time of a multi-hour one as a single slot for simplicity,
      // but the logic below allows expanding it.
      setStep('details');
    } else if (!open) {
      resetState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editReservation, open]);

  // Fetch booked slots
  useEffect(() => {
    if (selectedFacilityId && selectedDate) {
      getBookedSlots(selectedFacilityId, selectedDate, editReservation?.id)
        .then(setBookedSlots);
    } else {
      setBookedSlots([]);
    }
  }, [selectedFacilityId, selectedDate, editReservation?.id, getBookedSlots]);

  const resetState = () => {
    setStep('details');
    setReservationType('manual');
    setSelectedFacilityId('');
    setNotes('');
    setSelectedDate(undefined);
    setSelectedSlots([]);
    setBookedSlots([]);
  };

  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId);
  const selectedType = RESERVATION_TYPES.find((t) => t.value === reservationType)!;
  const STEPS: Step[] = ['details', 'datetime', 'confirm'];

  const handleSelectSlot = (slot: string) => {
    if (selectedSlots.length === 0) {
      setSelectedSlots([slot]);
    } else if (selectedSlots.length === 1) {
      const start = selectedSlots[0];
      if (slot === start) {
        setSelectedSlots([]);
        return;
      }
      
      const startIndex = TIME_SLOTS.indexOf(start);
      const newIndex = TIME_SLOTS.indexOf(slot);
      
      if (newIndex > startIndex) {
        const range = TIME_SLOTS.slice(startIndex, newIndex + 1);
        const hasConflict = range.some(s => bookedSlots.includes(s));
        if (!hasConflict) {
          setSelectedSlots(range);
        } else {
          setSelectedSlots([slot]);
        }
      } else {
        setSelectedSlots([slot]);
      }
    } else {
      setSelectedSlots([slot]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFacility || !selectedDate || selectedSlots.length === 0) return;
    
    const startTime = selectedSlots[0];
    const lastSlot = selectedSlots[selectedSlots.length - 1];
    const endHour = parseInt(lastSlot.split(':')[0]) + 1;
    const endTime = `${endHour.toString().padStart(2, '0')}:00`;
    
    const baseNotes = notes.trim() || (reservationType === 'block' ? 'Bloqueo interno' : undefined);
    const durationMultiplier = selectedSlots.length;

    if (isEdit && editReservation) {
      await onSubmit({
        id: editReservation.id,
        payload: {
          facility_id: selectedFacility.id,
          reservation_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: startTime,
          end_time: endTime,
          notes: baseNotes,
          price: reservationType === 'block' ? 0 : (selectedFacility.hourly_rate ?? 0) * durationMultiplier,
        },
      });
    } else {
      await onSubmit({
        facility_id: selectedFacility.id,
        reservation_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: startTime,
        end_time: endTime,
        price: reservationType === 'block' ? 0 : (selectedFacility.hourly_rate ?? 0) * durationMultiplier,
        notes: baseNotes,
        status: 'confirmed',
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card text-card-foreground border-border/40 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            {isEdit
              ? <><Pencil className="h-6 w-6 text-primary" /> Editar Reserva</>
              : <><Building2 className="h-6 w-6 text-primary" /> Nueva Reserva</>
            }
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/80">
            {isEdit
              ? 'Modifica los datos de la reserva existente.'
              : 'Registra una reserva manual o bloquea un espacio.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 py-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                step === s ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20'
                  : i < STEPS.indexOf(step) ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>{i + 1}</div>
              {i < 2 && <div className={`w-10 h-0.5 mx-1 transition-colors duration-300 ${i < STEPS.indexOf(step) ? 'bg-primary/40' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        {/* ── Step 1 ── */}
        {step === 'details' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {!isEdit && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold tracking-tight">Tipo de reserva</Label>
                <div className="grid grid-cols-2 gap-4">
                  {RESERVATION_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setReservationType(type.value)}
                      className={`flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                        reservationType === type.value
                          ? `${type.color} border-current ring-2 ring-current/10 shadow-md`
                          : 'border-border/50 bg-muted/30 hover:border-muted-foreground/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className={reservationType === type.value ? '' : 'text-muted-foreground'}>
                        {type.icon}
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">{type.label}</p>
                        <p className="text-[11px] opacity-80 leading-snug mt-1">{type.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-semibold tracking-tight">Instalación</Label>
              <Select value={selectedFacilityId} onValueChange={setSelectedFacilityId}>
                <SelectTrigger className="bg-muted/30 border-border/50 h-11">
                  <SelectValue placeholder="Selecciona una instalación…" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <div className="flex flex-col">
                        <span className="font-semibold">{f.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{f.type}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold tracking-tight">
                Notas <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
              </Label>
              <Textarea
                placeholder={
                  reservationType === 'block'
                    ? 'Ej. Mantenimiento de piso, evento institucional…'
                    : 'Ej. Pago en efectivo confirmado, grupo de 8 personas…'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="bg-muted/30 border-border/50 resize-none focus-visible:ring-primary/20"
              />
            </div>

            <Button className="w-full h-11 text-base font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]" onClick={() => setStep('datetime')} disabled={!selectedFacilityId}>
              Continuar
            </Button>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 'datetime' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center">
              <h3 className="font-bold text-lg">Selecciona la fecha y hora</h3>
              <p className="text-xs text-muted-foreground mt-1">Puedes seleccionar un rango de horas continuo.</p>
            </div>
            
            <div className="flex justify-center bg-muted/20 p-4 rounded-2xl border border-border/30">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(d) => isBefore(d, startOfDay(new Date()))}
                locale={es}
                className="rounded-md"
              />
            </div>

            {selectedDate && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Horarios disponibles
                  </h3>
                  <p className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full capitalize">
                    {format(selectedDate, 'EEEE d MMM', { locale: es })}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = bookedSlots.includes(slot);
                    const isSelected = selectedSlots.includes(slot);
                    return (
                      <Button
                        key={slot}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        disabled={isBooked}
                        onClick={() => handleSelectSlot(slot)}
                        className={`text-xs h-10 transition-all duration-200 ${
                          isBooked 
                            ? 'opacity-20 grayscale cursor-not-allowed bg-muted' 
                            : isSelected 
                              ? 'shadow-md shadow-primary/20 scale-[1.05]' 
                              : 'bg-muted/30 border-border/40 hover:bg-muted/50 hover:border-primary/30'
                        }`}
                      >
                        {slot}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1 h-11 font-medium border-border/50">Atrás</Button>
              <Button onClick={() => setStep('confirm')} disabled={!selectedDate || selectedSlots.length === 0} className="flex-1 h-11 font-bold">
                Confirmar Horario
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 'confirm' && selectedFacility && selectedDate && selectedSlots.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <Card className="border-primary/20 bg-primary/5 shadow-inner overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4 border-b border-primary/10 flex items-center justify-between">
                  <Badge variant="secondary" className={`${selectedType.color} border-current/20 font-bold px-3 py-1`}>
                    {selectedType.icon}
                    <span className="ml-2">{selectedType.label}</span>
                  </Badge>
                  {isEdit && <Badge variant="outline" className="border-primary/30 text-primary text-[10px] uppercase font-bold tracking-widest bg-primary/5">Modo Edición</Badge>}
                </div>
                
                <div className="p-5 space-y-4 text-sm">
                  <div className="flex justify-between items-center group">
                    <span className="text-muted-foreground flex items-center gap-2 group-hover:text-foreground transition-colors"><Building2 className="h-4 w-4 text-primary" />Instalación</span>
                    <span className="font-bold text-base">{selectedFacility.name}</span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-muted-foreground flex items-center gap-2 group-hover:text-foreground transition-colors"><CalendarCheck className="h-4 w-4 text-primary" />Fecha</span>
                    <span className="font-bold text-base">{format(selectedDate, 'PPPP', { locale: es })}</span>
                  </div>
                  <div className="flex justify-between items-start group">
                    <span className="text-muted-foreground flex items-center gap-2 group-hover:text-foreground transition-colors mt-0.5"><Clock className="h-4 w-4 text-primary" />Horario</span>
                    <div className="text-right">
                      <span className="font-bold text-base block">
                        {selectedSlots[0]} — {parseInt(selectedSlots[selectedSlots.length - 1].split(':')[0]) + 1}:00
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                        Duración: {selectedSlots.length} {selectedSlots.length === 1 ? 'hora' : 'horas'}
                      </span>
                    </div>
                  </div>
                  
                  {notes && (
                    <div className="space-y-1.5 pt-1 border-t border-primary/10">
                      <span className="text-muted-foreground flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><Wrench className="h-3.5 w-3.5 text-primary" />Notas Internas</span>
                      <p className="font-medium bg-background/50 p-3 rounded-lg border border-border/30 text-xs italic">{notes}</p>
                    </div>
                  )}
                </div>
                
                <div className="p-4 bg-primary/10 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary/60">Estado automático</span>
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 px-2 py-0.5 font-bold shadow-sm shadow-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />Confirmada
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('datetime')} className="flex-1 h-12 font-medium border-border/50">Revisar</Button>
              <Button onClick={handleSubmit} disabled={isLoading} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all">
                {isLoading
                  ? <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  : <CheckCircle2 className="h-5 w-5 mr-2" />
                }
                {isEdit ? 'Actualizar Reserva' : reservationType === 'block' ? 'Confirmar Bloqueo' : 'Finalizar Registro'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
