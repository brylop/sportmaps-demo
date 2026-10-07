import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { AlertCircle, CalendarPlus, Check, CircleSlash, Loader2, Pencil, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppointmentFormDialog, CancelAppointmentDialog } from '@/components/clinical/AppointmentFormDialog';
import { listPatientAppointments, updateAppointment } from '@/lib/clinical/api';
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, clinicalErrorMessage } from '@/lib/clinical/labels';
import {
  APPOINTMENT_STATUS_TONE_DARK, MODALITY_LABEL, appointmentStamp, nowColombiaStamp,
} from '@/lib/clinical/agenda-extra';
import type { AppointmentStatus, ClinicalPatient, WellnessAppointment } from '@/lib/clinical/types';
import { dayToLocalDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

export function PatientAppointmentsTab({ patient }: { patient: ClinicalPatient }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WellnessAppointment | null>(null);
  const [cancelling, setCancelling] = useState<WellnessAppointment | null>(null);

  const q = useQuery({
    queryKey: ['clinical', 'appointments', patient.id],
    queryFn: () => listPatientAppointments(patient.id),
  });

  const now = nowColombiaStamp();
  const { upcoming, past, noShows } = useMemo(() => {
    const all = q.data ?? [];
    const up = all
      .filter((a) => appointmentStamp(a) >= now && (a.status === 'pending' || a.status === 'confirmed'))
      .sort((a, b) => appointmentStamp(a).localeCompare(appointmentStamp(b)));
    const upIds = new Set(up.map((a) => a.id));
    return {
      upcoming: up,
      past: all.filter((a) => !upIds.has(a.id)),
      noShows: all.filter((a) => a.status === 'no_show').length,
    };
  }, [q.data, now]);

  const statusM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => updateAppointment(id, { status }),
    onSuccess: (_s, v) => {
      toast.success(v.status === 'confirmed' ? 'Cita confirmada' : v.status === 'no_show' ? 'Marcada como no asistió' : 'Cita actualizada');
      qc.invalidateQueries({ queryKey: ['clinical', 'appointments', patient.id] });
      qc.invalidateQueries({ queryKey: ['agenda'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (err) => toast.error(clinicalErrorMessage(err)),
  });

  const row = (a: WellnessAppointment) => {
    const started = appointmentStamp(a) <= now;
    return (
      <div key={a.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium capitalize">
              {format(dayToLocalDate(a.appointment_date), "EEE d 'de' MMM yyyy", { locale: es })} · {a.appointment_time.slice(0, 5)}
            </span>
            <Badge variant="outline" className={cn('text-[11px]', APPOINTMENT_STATUS_TONE[a.status], APPOINTMENT_STATUS_TONE_DARK[a.status])}>
              {APPOINTMENT_STATUS_LABEL[a.status]}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {a.service_type} · {a.duration_minutes} min · {MODALITY_LABEL[a.modality]}
            {a.cancellation_reason ? ` · Motivo: ${a.cancellation_reason}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {a.status === 'pending' && (
            <Button size="sm" onClick={() => statusM.mutate({ id: a.id, status: 'confirmed' })} disabled={statusM.isPending}>
              <Check className="mr-1 h-3.5 w-3.5" />Confirmar
            </Button>
          )}
          {(a.status === 'pending' || a.status === 'confirmed') && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setEditing(a); setFormOpen(true); }}>
                <Pencil className="mr-1 h-3.5 w-3.5" />Reprogramar
              </Button>
              {a.status === 'confirmed' && started && (
                <Button size="sm" variant="outline" onClick={() => statusM.mutate({ id: a.id, status: 'no_show' })} disabled={statusM.isPending}>
                  <CircleSlash className="mr-1 h-3.5 w-3.5" />No asistió
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setCancelling(a)}>
                <X className="mr-1 h-3.5 w-3.5" />Cancelar
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{(q.data ?? []).length} citas en total</span>
          {noShows > 0 && (
            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {noShows} {noShows === 1 ? 'inasistencia' : 'inasistencias'}
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} disabled={patient.status === 'archivado'}>
          <CalendarPlus className="mr-2 h-4 w-4" />Agendar cita
        </Button>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : q.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-muted-foreground">{clinicalErrorMessage(q.error)}</p>
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : (q.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {patient.full_name} aún no tiene citas.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Próximas</h3>
            {upcoming.length === 0
              ? <p className="text-sm text-muted-foreground">Sin citas próximas.</p>
              : upcoming.map(row)}
          </section>
          {past.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Anteriores</h3>
              {past.map(row)}
            </section>
          )}
        </>
      )}

      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        appointment={editing}
        defaultPatientId={patient.id}
      />
      <CancelAppointmentDialog
        appointment={cancelling}
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
      />
    </div>
  );
}

export default PatientAppointmentsTab;
