import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PatientPicker } from '@/components/clinical/PatientPicker';
import { createAppointment, updateAppointment } from '@/lib/clinical/api';
import { clinicalErrorMessage } from '@/lib/clinical/labels';
import { MODALITY_LABEL, SERVICE_SUGGESTIONS, minutesToTime } from '@/lib/clinical/agenda-extra';
import { todayColombia } from '@/lib/dateUtils';
import type { WellnessAppointment } from '@/lib/clinical/types';

export interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: WellnessAppointment | null;
  defaultPatientId?: string | null;
  defaultDate?: string | null;
  /** Hora sugerida 'HH:MM' (p. ej. al hacer clic en una franja vacía). */
  defaultTime?: string | null;
  onSaved?: (appointment: WellnessAppointment) => void;
}

// Franjas de 15 min entre 05:00 y 22:45.
const TIME_OPTIONS = Array.from({ length: (23 - 5) * 4 }, (_, i) => minutesToTime(5 * 60 + i * 15));
const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120];
type Modality = WellnessAppointment['modality'];

interface FormState {
  mode: 'paciente' | 'libre';
  patientId: string | null;
  athleteName: string;
  date: string;
  time: string;
  duration: number;
  serviceType: string;
  modality: Modality;
  location: string;
  meetingUrl: string;
  price: string;
  notes: string;
}

function initialState(a?: WellnessAppointment | null, patientId?: string | null, date?: string | null, time?: string | null): FormState {
  if (a) {
    return {
      mode: a.patient_id ? 'paciente' : 'libre',
      patientId: a.patient_id,
      athleteName: a.athlete_name ?? '',
      date: a.appointment_date,
      time: a.appointment_time.slice(0, 5),
      duration: a.duration_minutes,
      serviceType: a.service_type,
      modality: a.modality,
      location: a.location ?? '',
      meetingUrl: a.meeting_url ?? '',
      price: a.price ? String(a.price) : '',
      notes: a.notes ?? '',
    };
  }
  return {
    mode: 'paciente',
    patientId: patientId ?? null,
    athleteName: '',
    date: date ?? todayColombia(),
    time: time && TIME_OPTIONS.includes(time) ? time : '08:00',
    duration: 60,
    serviceType: 'Sesión de fisioterapia',
    modality: 'presencial',
    location: '',
    meetingUrl: '',
    price: '',
    notes: '',
  };
}

export function AppointmentFormDialog({
  open, onOpenChange, appointment, defaultPatientId, defaultDate, defaultTime, onSaved,
}: AppointmentFormDialogProps) {
  const qc = useQueryClient();
  const isEdit = !!appointment;
  const [form, setForm] = useState<FormState>(() => initialState(appointment, defaultPatientId, defaultDate, defaultTime));
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialState(appointment, defaultPatientId, defaultDate, defaultTime));
      setConflict(null);
    }
  }, [open, appointment, defaultPatientId, defaultDate, defaultTime]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const priceNum = form.price.trim() === '' ? 0 : Number(form.price.replace(/[^\d]/g, ''));
  const who = form.mode === 'paciente' ? !!form.patientId : form.athleteName.trim().length >= 2;
  const isPastDate = !isEdit && form.date < todayColombia();
  const valid = who && !!form.date && !!form.time && form.serviceType.trim().length >= 2 && !isPastDate
    && (form.modality !== 'virtual' || !form.meetingUrl || /^https?:\/\//i.test(form.meetingUrl.trim()));

  const save = useMutation({
    mutationFn: async () => {
      const common = {
        appointment_date: form.date,
        appointment_time: `${form.time}:00`,
        duration_minutes: form.duration,
        service_type: form.serviceType.trim(),
        modality: form.modality,
        location: form.modality === 'virtual' ? null : form.location.trim() || null,
        meeting_url: form.modality === 'virtual' ? form.meetingUrl.trim() || null : null,
        notes: form.notes.trim() || null,
      };
      if (appointment) return updateAppointment(appointment.id, common);
      return createAppointment({
        ...common,
        patient_id: form.mode === 'paciente' ? form.patientId : null,
        athlete_name: form.mode === 'libre' ? form.athleteName.trim() : null,
        price: Number.isFinite(priceNum) ? priceNum : 0,
      });
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Cita actualizada' : 'Cita agendada');
      qc.invalidateQueries({ queryKey: ['agenda'] });
      qc.invalidateQueries({ queryKey: ['clinical', 'appointments'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = clinicalErrorMessage(err);
      if (String((err as { message?: string })?.message ?? '').includes('HORARIO_OCUPADO')) {
        setConflict(`${msg} Ya tienes otra cita que se cruza con ${form.time} (${form.duration} min). Elige otra hora o cambia la duración.`);
      } else {
        toast.error(msg);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar / reprogramar cita' : 'Nueva cita'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Si cambias la fecha u hora, el paciente recibe un aviso automático.'
              : 'La cita queda confirmada en tu agenda y el paciente recibe un aviso si tiene cuenta.'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}
        >
          {/* Paciente */}
          {isEdit ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Paciente: </span>
              <span className="font-medium">{appointment?.athlete_name ?? 'Sin nombre'}</span>
            </div>
          ) : (
            <div className="space-y-2">
              <ToggleGroup
                type="single"
                value={form.mode}
                onValueChange={(v) => v && set('mode', v as FormState['mode'])}
                className="justify-start"
              >
                <ToggleGroupItem value="paciente" size="sm">Paciente registrado</ToggleGroupItem>
                <ToggleGroupItem value="libre" size="sm">Cita puntual</ToggleGroupItem>
              </ToggleGroup>
              {form.mode === 'paciente' ? (
                <PatientPicker value={form.patientId} onChange={(id) => set('patientId', id)} />
              ) : (
                <Input
                  value={form.athleteName}
                  onChange={(e) => set('athleteName', e.target.value)}
                  placeholder="Nombre de la persona"
                  maxLength={120}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="apt-date">Fecha</Label>
              <Input
                id="apt-date"
                type="date"
                value={form.date}
                min={isEdit ? undefined : todayColombia()}
                onChange={(e) => { set('date', e.target.value); setConflict(null); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Select value={form.time} onValueChange={(v) => { set('time', v); setConflict(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {(TIME_OPTIONS.includes(form.time) ? TIME_OPTIONS : [form.time, ...TIME_OPTIONS]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duración</Label>
              <Select value={String(form.duration)} onValueChange={(v) => { set('duration', Number(v)); setConflict(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(DURATIONS.includes(form.duration) ? DURATIONS : [form.duration, ...DURATIONS]).map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isPastDate && <p className="text-xs text-destructive">La fecha ya pasó.</p>}

          {conflict && (
            <div className="flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{conflict}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="apt-service">Tipo de servicio</Label>
            <Input
              id="apt-service"
              list="apt-service-suggestions"
              value={form.serviceType}
              onChange={(e) => set('serviceType', e.target.value)}
              maxLength={80}
            />
            <datalist id="apt-service-suggestions">
              {SERVICE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { set('serviceType', s); if (s === 'Teleconsulta') set('modality', 'virtual'); }}
                  className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Modalidad</Label>
            <ToggleGroup
              type="single"
              value={form.modality}
              onValueChange={(v) => v && set('modality', v as Modality)}
              className="justify-start"
            >
              {(Object.keys(MODALITY_LABEL) as Modality[]).map((m) => (
                <ToggleGroupItem key={m} value={m} size="sm">{MODALITY_LABEL[m]}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            {form.modality === 'virtual' ? (
              <Input
                value={form.meetingUrl}
                onChange={(e) => set('meetingUrl', e.target.value)}
                placeholder="Enlace de la videollamada (https://…)"
                inputMode="url"
              />
            ) : (
              <Input
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder={form.modality === 'domicilio' ? 'Dirección del paciente' : 'Consultorio o sede'}
                maxLength={200}
              />
            )}
            {form.modality === 'virtual' && form.meetingUrl && !/^https?:\/\//i.test(form.meetingUrl.trim()) && (
              <p className="text-xs text-destructive">El enlace debe empezar por https://</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apt-price">Valor (COP, opcional)</Label>
            <Input
              id="apt-price"
              inputMode="numeric"
              value={form.price}
              onChange={(e) => set('price', e.target.value.replace(/[^\d]/g, ''))}
              placeholder="0"
              disabled={isEdit}
            />
            <p className="text-xs text-muted-foreground">
              {isEdit ? 'El valor no se cambia desde aquí.' : 'Informativo: el pago se acuerda con el paciente.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apt-notes">Notas</Label>
            <Textarea
              id="apt-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              maxLength={1000}
              placeholder="Indicaciones para la cita (no es historia clínica)"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Agendar cita'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pide el motivo y cancela (o rechaza) una cita del profesional. El aviso al
 * paciente lo manda el trigger de la base.
 */
export function CancelAppointmentDialog({
  appointment, open, onOpenChange, mode = 'cancelar', onDone,
}: {
  appointment: WellnessAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'cancelar' | 'rechazar';
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);

  const m = useMutation({
    mutationFn: () => updateAppointment(appointment!.id, {
      status: 'cancelled',
      cancellation_reason: reason.trim() || (mode === 'rechazar' ? 'Solicitud no aceptada por el profesional' : 'Cancelada por el profesional'),
    }),
    onSuccess: () => {
      toast.success(mode === 'rechazar' ? 'Solicitud rechazada' : 'Cita cancelada');
      qc.invalidateQueries({ queryKey: ['agenda'] });
      qc.invalidateQueries({ queryKey: ['clinical', 'appointments'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onDone?.();
      onOpenChange(false);
    },
    onError: (err) => toast.error(clinicalErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{mode === 'rechazar' ? 'Rechazar solicitud' : 'Cancelar cita'}</DialogTitle>
          <DialogDescription>
            {appointment ? `${appointment.athlete_name ?? 'Paciente'} · ${appointment.appointment_date} ${appointment.appointment_time.slice(0, 5)}. ` : ''}
            El paciente recibe un aviso con el motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Motivo</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode === 'rechazar' ? 'Ej.: no tengo disponibilidad ese día, te propongo otra hora' : 'Ej.: incapacidad, cambio de horario'}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={m.isPending}>Volver</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={!appointment || m.isPending}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'rechazar' ? 'Rechazar' : 'Cancelar cita'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AppointmentFormDialog;
