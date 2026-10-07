import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, Loader2, MapPin,
  Pencil, Plus, Stethoscope, UserRound, Video, X, CircleSlash, CheckCircle2, Wallet, Inbox,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AppointmentFormDialog, CancelAppointmentDialog } from '@/components/clinical/AppointmentFormDialog';
import { listMyAgenda, updateAppointment } from '@/lib/clinical/api';
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, clinicalErrorMessage } from '@/lib/clinical/labels';
import {
  APPOINTMENT_BLOCK_TONE, APPOINTMENT_STATUS_TONE_DARK, MODALITY_LABEL, PAYMENT_STATUS_LABEL,
  addDaysISO, appointmentStamp, formatCOP, listPendingRequests, minutesToTime, nowColombiaStamp,
  timeToMinutes, weekStartISO,
} from '@/lib/clinical/agenda-extra';
import type { AppointmentStatus, WellnessAppointment } from '@/lib/clinical/types';
import { dayToLocalDate, todayColombia } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

const HOUR_START = 6;
const HOUR_END = 21;
const HOUR_PX = 56;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

function dayLabel(iso: string, pattern = "EEE d 'de' MMM") {
  return format(dayToLocalDate(iso), pattern, { locale: es });
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge variant="outline" className={cn('text-[11px]', APPOINTMENT_STATUS_TONE[status], APPOINTMENT_STATUS_TONE_DARK[status])}>
      {APPOINTMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Reparte en carriles las citas que se cruzan dentro de un día. */
function layoutDay(apts: WellnessAppointment[]) {
  const items = [...apts].sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
  const laneEnds: number[] = [];
  const placed = items.map((a) => {
    const start = timeToMinutes(a.appointment_time);
    const end = start + a.duration_minutes;
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else laneEnds[lane] = end;
    return { a, start, end, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

export default function WellnessSchedulePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = todayColombia();
  const [weekStart, setWeekStart] = useState(() => weekStartISO(today));
  const [mobileDay, setMobileDay] = useState(today);
  const [showCancelled, setShowCancelled] = useState(false);
  const [selected, setSelected] = useState<WellnessAppointment | null>(null);
  const [form, setForm] = useState<{ open: boolean; appointment: WellnessAppointment | null; date?: string; time?: string }>({ open: false, appointment: null });
  const [cancel, setCancel] = useState<{ appointment: WellnessAppointment | null; mode: 'cancelar' | 'rechazar' }>({ appointment: null, mode: 'cancelar' });

  const weekEnd = addDaysISO(weekStart, 6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);

  const agendaQ = useQuery({
    queryKey: ['agenda', 'week', weekStart],
    queryFn: () => listMyAgenda(weekStart, weekEnd),
  });
  const pendingQ = useQuery({ queryKey: ['agenda', 'pending'], queryFn: listPendingRequests });

  const visible = useMemo(
    () => (agendaQ.data ?? []).filter((a) => showCancelled || a.status !== 'cancelled'),
    [agendaQ.data, showCancelled],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, WellnessAppointment[]>();
    for (const d of days) m.set(d, []);
    for (const a of visible) m.get(a.appointment_date)?.push(a);
    return m;
  }, [visible, days]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['agenda'] });
    qc.invalidateQueries({ queryKey: ['clinical', 'appointments'] });
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const statusM = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateAppointment>[1] }) => updateAppointment(id, patch),
    onSuccess: (saved, vars) => {
      const msg: Record<string, string> = {
        confirmed: 'Cita confirmada', completed: 'Cita marcada como realizada', no_show: 'Marcada como no asistió',
      };
      toast.success(vars.patch.status ? msg[vars.patch.status] ?? 'Cita actualizada' : 'Cita actualizada');
      setSelected((s) => (s && s.id === saved.id ? saved : s));
      invalidate();
    },
    onError: (err) => toast.error(clinicalErrorMessage(err)),
  });

  const goToWeek = (iso: string) => {
    setWeekStart(weekStartISO(iso));
    setMobileDay(iso);
  };
  const shiftWeek = (n: number) => {
    const ws = addDaysISO(weekStart, n * 7);
    setWeekStart(ws);
    setMobileDay(ws <= today && today <= addDaysISO(ws, 6) ? today : ws);
  };

  const openNew = (date?: string, time?: string) => setForm({ open: true, appointment: null, date, time });
  const now = nowColombiaStamp();
  const pending = pendingQ.data ?? [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Agenda</h1>
          <p className="text-sm text-muted-foreground">Tus citas de la semana, solicitudes y atención.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/disponibilidad"><Clock className="mr-2 h-4 w-4" />Disponibilidad</Link>
          </Button>
          <Button onClick={() => openNew(mobileDay >= today ? mobileDay : today)}>
            <Plus className="mr-2 h-4 w-4" />Nueva cita
          </Button>
        </div>
      </div>

      {/* Solicitudes por confirmar */}
      {pendingQ.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
            <span className="text-destructive">No se pudieron cargar las solicitudes: {clinicalErrorMessage(pendingQ.error)}</span>
            <Button size="sm" variant="outline" onClick={() => pendingQ.refetch()}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : pending.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4 text-amber-600" />
              Solicitudes por confirmar
              <Badge variant="secondary">{pending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" className="min-w-0 text-left" onClick={() => setSelected(a)}>
                  <p className="truncate font-medium">{a.athlete_name ?? 'Paciente'}</p>
                  <p className="text-xs text-muted-foreground">
                    {dayLabel(a.appointment_date)} · {a.appointment_time.slice(0, 5)} · {a.duration_minutes} min · {a.service_type}
                  </p>
                </button>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    onClick={() => statusM.mutate({ id: a.id, patch: { status: 'confirmed' } })}
                    disabled={statusM.isPending}
                  >
                    <Check className="mr-1 h-4 w-4" />Confirmar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCancel({ appointment: a, mode: 'rechazar' })}>
                    <X className="mr-1 h-4 w-4" />Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Navegación de semana */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => shiftWeek(-1)} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => goToWeek(today)}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => shiftWeek(1)} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium capitalize">
            {dayLabel(weekStart, "d 'de' MMM")} – {dayLabel(weekEnd, "d 'de' MMM yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-cancelled" checked={showCancelled} onCheckedChange={setShowCancelled} />
          <Label htmlFor="show-cancelled" className="text-xs text-muted-foreground">Mostrar canceladas</Label>
        </div>
      </div>

      {agendaQ.isLoading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : agendaQ.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{clinicalErrorMessage(agendaQ.error)}</p>
            <Button variant="outline" onClick={() => agendaQ.refetch()}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Escritorio: semana */}
          <Card className="hidden overflow-hidden md:block">
            <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b bg-muted/40">
              <div />
              {days.map((d) => (
                <div key={d} className={cn('border-l px-2 py-2 text-center text-xs', d === today && 'bg-primary/10 font-semibold text-primary')}>
                  <div className="capitalize">{dayLabel(d, 'EEE')}</div>
                  <div className="text-base">{dayLabel(d, 'd')}</div>
                </div>
              ))}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height: HOURS.length * HOUR_PX }}>
                <div className="relative">
                  {HOURS.map((h, i) => (
                    <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: i * HOUR_PX }}>
                      {i > 0 && `${String(h).padStart(2, '0')}:00`}
                    </div>
                  ))}
                </div>
                {days.map((d) => {
                  const { placed, lanes } = layoutDay(byDay.get(d) ?? []);
                  return (
                    <div
                      key={d}
                      className={cn('relative cursor-pointer border-l', d === today && 'bg-primary/[0.03]')}
                      onClick={(e) => {
                        if (d < today) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const mins = HOUR_START * 60 + Math.floor(((e.clientY - rect.top) / HOUR_PX) * 4) * 15;
                        openNew(d, minutesToTime(Math.min(mins, HOUR_END * 60 - 15)));
                      }}
                    >
                      {HOURS.map((h, i) => (
                        <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: i * HOUR_PX }} />
                      ))}
                      {placed.map(({ a, start, end, lane }) => {
                        const top = Math.max(0, ((start - HOUR_START * 60) / 60) * HOUR_PX);
                        const bottom = Math.min(HOURS.length * HOUR_PX, ((end - HOUR_START * 60) / 60) * HOUR_PX);
                        const height = Math.max(20, bottom - top);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelected(a); }}
                            className={cn(
                              'absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition hover:z-10 hover:shadow-md',
                              APPOINTMENT_BLOCK_TONE[a.status],
                            )}
                            style={{
                              top, height,
                              left: `calc(${(lane / lanes) * 100}% + 2px)`,
                              width: `calc(${100 / lanes}% - 4px)`,
                            }}
                            title={`${a.appointment_time.slice(0, 5)} ${a.athlete_name ?? ''} · ${a.service_type}`}
                          >
                            <div className="font-semibold">{a.appointment_time.slice(0, 5)} {a.athlete_name ?? 'Paciente'}</div>
                            {height > 34 && <div className="truncate opacity-80">{a.service_type}</div>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Celular: lista por día */}
          <div className="space-y-3 md:hidden">
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
              {days.map((d) => {
                const n = byDay.get(d)?.length ?? 0;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setMobileDay(d)}
                    className={cn(
                      'flex min-w-[46px] flex-col items-center rounded-lg border px-2 py-1.5 text-xs',
                      mobileDay === d ? 'border-primary bg-primary text-primary-foreground' : d === today ? 'border-primary/50' : '',
                    )}
                  >
                    <span className="capitalize">{dayLabel(d, 'EEEEE')}</span>
                    <span className="text-base font-semibold">{dayLabel(d, 'd')}</span>
                    <span className={cn('h-1.5 w-1.5 rounded-full', n > 0 ? (mobileDay === d ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent')} />
                  </button>
                );
              })}
            </div>
            <p className="text-sm font-medium capitalize">{dayLabel(mobileDay, "EEEE d 'de' MMMM")}</p>
            {(byDay.get(mobileDay) ?? []).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
                  <CalendarDays className="h-8 w-8 opacity-40" />
                  Sin citas este día.
                  {mobileDay >= today && (
                    <Button size="sm" variant="outline" onClick={() => openNew(mobileDay)}>
                      <Plus className="mr-1 h-4 w-4" />Agendar
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              (byDay.get(mobileDay) ?? []).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className={cn('flex w-full items-start gap-3 rounded-lg border-l-4 p-3 text-left shadow-sm', APPOINTMENT_BLOCK_TONE[a.status])}
                >
                  <div className="w-12 shrink-0 text-sm font-semibold">{a.appointment_time.slice(0, 5)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.athlete_name ?? 'Paciente'}</p>
                    <p className="truncate text-xs opacity-80">{a.service_type} · {a.duration_minutes} min · {MODALITY_LABEL[a.modality]}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </button>
              ))
            )}
          </div>

          {visible.length === 0 && (
            <p className="hidden text-center text-sm text-muted-foreground md:block">
              No hay citas esta semana. Haz clic en una franja para agendar.
            </p>
          )}
        </>
      )}

      {/* Detalle de la cita */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <AppointmentDetail
              a={selected}
              now={now}
              busy={statusM.isPending}
              onConfirm={() => statusM.mutate({ id: selected.id, patch: { status: 'confirmed' } })}
              onComplete={() => statusM.mutate({ id: selected.id, patch: { status: 'completed' } })}
              onNoShow={() => statusM.mutate({ id: selected.id, patch: { status: 'no_show' } })}
              onPaid={() => statusM.mutate({ id: selected.id, patch: { payment_status: 'paid' } })}
              onReschedule={() => setForm({ open: true, appointment: selected })}
              onCancel={() => setCancel({ appointment: selected, mode: selected.status === 'pending' ? 'rechazar' : 'cancelar' })}
              onAttend={() => navigate(`/pacientes/${selected.patient_id}?nota=evolucion&cita=${selected.id}`)}
            />
          )}
        </SheetContent>
      </Sheet>

      <AppointmentFormDialog
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        appointment={form.appointment}
        defaultDate={form.date}
        defaultTime={form.time}
        onSaved={(saved) => {
          setSelected((s) => (s && s.id === saved.id ? saved : s));
          if (saved.appointment_date < weekStart || saved.appointment_date > weekEnd) goToWeek(saved.appointment_date);
        }}
      />
      <CancelAppointmentDialog
        appointment={cancel.appointment}
        mode={cancel.mode}
        open={!!cancel.appointment}
        onOpenChange={(o) => !o && setCancel((c) => ({ ...c, appointment: null }))}
        onDone={() => setSelected(null)}
      />
    </div>
  );
}

function AppointmentDetail({
  a, now, busy, onConfirm, onComplete, onNoShow, onPaid, onReschedule, onCancel, onAttend,
}: {
  a: WellnessAppointment;
  now: string;
  busy: boolean;
  onConfirm: () => void;
  onComplete: () => void;
  onNoShow: () => void;
  onPaid: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onAttend: () => void;
}) {
  const started = appointmentStamp(a) <= now;
  const open = a.status === 'pending' || a.status === 'confirmed';
  const end = minutesToTime(timeToMinutes(a.appointment_time) + a.duration_minutes);

  return (
    <div className="space-y-5">
      <SheetHeader className="text-left">
        <SheetTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" />
          {a.service_type}
        </SheetTitle>
        <SheetDescription className="capitalize">
          {dayLabel(a.appointment_date, "EEEE d 'de' MMMM")} · {a.appointment_time.slice(0, 5)} – {end}
        </SheetDescription>
        <div><StatusBadge status={a.status} /></div>
      </SheetHeader>

      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{a.athlete_name ?? 'Paciente sin nombre'}</p>
            {a.patient_id ? (
              <Link to={`/pacientes/${a.patient_id}`} className="text-xs text-primary hover:underline">Ver ficha del paciente</Link>
            ) : (
              <p className="text-xs text-muted-foreground">Cita puntual (sin ficha de paciente)</p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          {a.modality === 'virtual' ? <Video className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />}
          <div>
            <p>{MODALITY_LABEL[a.modality]} · {a.duration_minutes} min</p>
            {a.modality === 'virtual' ? (
              a.meeting_url ? (
                <a href={a.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Abrir videollamada <ExternalLink className="h-3 w-3" />
                </a>
              ) : <p className="text-xs text-muted-foreground">Sin enlace de videollamada</p>
            ) : a.location && <p className="text-xs text-muted-foreground">{a.location}</p>}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Wallet className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p>{a.is_courtesy || a.price === 0 ? 'Sin valor / cortesía' : `${formatCOP(a.price)} COP`}</p>
            <p className="text-xs text-muted-foreground">{PAYMENT_STATUS_LABEL[a.payment_status]}</p>
          </div>
        </div>
        {a.client_notes && (
          <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs whitespace-pre-wrap dark:border-sky-900 dark:bg-sky-950/30">
            <p className="mb-1 font-medium">Mensaje del paciente</p>
            {a.client_notes}
          </div>
        )}
        {a.notes && (
          <div className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap">
            <p className="mb-1 font-medium">Notas internas</p>
            {a.notes}
          </div>
        )}
        {a.cancellation_reason && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            Motivo: {a.cancellation_reason}
          </div>
        )}
        {a.booking_source === 'marketplace' && (
          <p className="text-xs text-muted-foreground">Reservada desde el marketplace.</p>
        )}
      </div>

      <div className="grid gap-2">
        {a.status === 'pending' && (
          <Button onClick={onConfirm} disabled={busy}><Check className="mr-2 h-4 w-4" />Confirmar</Button>
        )}
        {a.status === 'confirmed' && (
          a.patient_id ? (
            <Button onClick={onAttend}><Stethoscope className="mr-2 h-4 w-4" />Atender / registrar evolución</Button>
          ) : (
            <Button onClick={onComplete} disabled={busy}><CheckCircle2 className="mr-2 h-4 w-4" />Marcar realizada</Button>
          )
        )}
        {a.status === 'completed' && a.patient_id && (
          <Button variant="outline" asChild><Link to={`/pacientes/${a.patient_id}`}>Ir a la historia</Link></Button>
        )}
        {open && (
          <Button variant="outline" onClick={onReschedule}><Pencil className="mr-2 h-4 w-4" />Reprogramar</Button>
        )}
        {a.status === 'confirmed' && started && (
          <Button variant="outline" onClick={onNoShow} disabled={busy}><CircleSlash className="mr-2 h-4 w-4" />Marcar no asistió</Button>
        )}
        {a.price > 0 && a.payment_status === 'pending' && a.status !== 'cancelled' && (
          <Button variant="outline" onClick={onPaid} disabled={busy}><Wallet className="mr-2 h-4 w-4" />Marcar pagada</Button>
        )}
        {open && (
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />{a.status === 'pending' ? 'Rechazar solicitud' : 'Cancelar cita'}
          </Button>
        )}
      </div>
    </div>
  );
}
