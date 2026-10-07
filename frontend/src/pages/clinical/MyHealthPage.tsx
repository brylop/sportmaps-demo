import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Circle, ClipboardList, Dumbbell, HeartPulse,
  Loader2, MessageCircle, Phone, PlayCircle, ShieldCheck, Stethoscope,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDayCO, todayColombia } from '@/lib/dateUtils';
import {
  getMyHealthSummary, grantConsents, logExerciseDone, revokeConsent, unlogExerciseDone,
} from '@/lib/clinical/api';
import {
  APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, AVAILABILITY_LABEL, AVAILABILITY_TONE, BODY_REGION_LABEL,
  CONSENT_LABEL, EPISODE_STATUS_LABEL, RTP_STAGE_LABEL, SPECIALTY_LABEL, clinicalErrorMessage,
} from '@/lib/clinical/labels';
import { lastNDaysColombia, whatsappLink, adherencePct } from '@/lib/clinical/family-extra';
import type { ConsentType, HealthSummaryPatient, Specialty } from '@/lib/clinical/types';

const SUMMARY_KEY = ['clinical', 'my-health-summary'];

const SIDE_LABEL: Record<string, string> = { izquierdo: 'izquierda', derecho: 'derecha', bilateral: 'ambos lados', na: '' };

function specialtyLabel(s: string | null | undefined) {
  if (!s) return null;
  return SPECIALTY_LABEL[s as Specialty] ?? s;
}

function Section({ icon: Icon, title, children }: { icon: typeof HeartPulse; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
        <Icon className="w-4 h-4 text-primary" />{title}
      </h3>
      {children}
    </section>
  );
}

// ── (a) Consentimientos pendientes ───────────────────────────────────────────
function PendingConsents({ patient }: { patient: HealthSummaryPatient }) {
  const qc = useQueryClient();
  const pending = useMemo(
    () => [...patient.pending_consents].sort((a, b) => Number(b.required) - Number(a.required)),
    [patient.pending_consents],
  );
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const grantM = useMutation({
    mutationFn: () => grantConsents(patient.patient_id, pending.filter((c) => selected[c.type]).map((c) => c.type as ConsentType)),
    onSuccess: () => {
      toast.success('Autorización registrada.');
      setSelected({});
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });
  if (pending.length === 0) return null;
  const anySelected = pending.some((c) => selected[c.type]);
  const requiredMissingNow = pending.filter((c) => c.required);

  return (
    <Section icon={ShieldCheck} title="Autorizaciones pendientes">
      {requiredMissingNow.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            Sin las autorizaciones obligatorias el profesional no puede registrar la atención ni asignar ejercicios.
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        {pending.map((c) => (
          <div key={c.type} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">{c.title || CONSENT_LABEL[c.type]}</p>
              <span className={c.required ? 'text-[11px] text-rose-600 dark:text-rose-400 font-medium' : 'text-[11px] text-muted-foreground'}>
                {c.required ? 'Obligatoria' : 'Opcional'}
              </span>
            </div>
            <ScrollArea className="h-28 rounded-md bg-muted/50 p-2">
              <p className="text-xs whitespace-pre-line leading-relaxed">{c.body}</p>
            </ScrollArea>
            {c.type === 'compartir_disponibilidad' && (
              <p className="text-xs text-muted-foreground">
                El entrenador y la escuela verían solo si puede entrenar, las restricciones y la fecha de regreso. Nunca el diagnóstico.
              </p>
            )}
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={!!selected[c.type]}
                onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.type]: v === true }))}
                className="mt-0.5"
              />
              <span>Leí y autorizo</span>
            </label>
          </div>
        ))}
      </div>
      <Button className="w-full sm:w-auto" disabled={!anySelected || grantM.isPending} onClick={() => grantM.mutate()}>
        {grantM.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Autorizar
      </Button>
    </Section>
  );
}

// ── (b) Disponibilidad / lesiones ────────────────────────────────────────────
function Injuries({ patient }: { patient: HealthSummaryPatient }) {
  const active = patient.injuries.filter((i) => i.status === 'activa');
  if (active.length === 0) {
    return (
      <Section icon={HeartPulse} title="Disponibilidad">
        <p className="text-sm text-muted-foreground">Sin lesiones activas registradas.</p>
      </Section>
    );
  }
  return (
    <Section icon={HeartPulse} title="Disponibilidad y lesiones activas">
      <div className="space-y-2">
        {active.map((i) => (
          <div key={i.id} className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-medium text-sm">
                {BODY_REGION_LABEL[i.body_region] ?? i.body_region}
                {SIDE_LABEL[i.side] ? ` (${SIDE_LABEL[i.side]})` : ''}
              </p>
              <Badge variant="outline" className={AVAILABILITY_TONE[i.availability_status]}>
                {AVAILABILITY_LABEL[i.availability_status]}
              </Badge>
            </div>
            <p className="text-sm"><span className="text-muted-foreground">Etapa:</span> {RTP_STAGE_LABEL[i.rtp_stage]}</p>
            {i.restrictions && <p className="text-sm"><span className="text-muted-foreground">Restricciones:</span> {i.restrictions}</p>}
            <p className="text-xs text-muted-foreground">
              Desde {formatDayCO(i.occurred_on)}
              {i.expected_return ? ` · Regreso estimado: ${formatDayCO(i.expected_return)}` : ''}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── (c) Tratamiento ──────────────────────────────────────────────────────────
function Treatment({ patient }: { patient: HealthSummaryPatient }) {
  const open = patient.episodes.filter((e) => e.status === 'abierto');
  const closed = patient.episodes.filter((e) => e.status !== 'abierto');
  if (patient.episodes.length === 0) return null;
  return (
    <Section icon={ClipboardList} title="Tratamiento">
      <div className="space-y-2">
        {open.map((e) => (
          <div key={e.id} className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-medium text-sm">{e.reason}</p>
              <Badge variant="secondary">{EPISODE_STATUS_LABEL[e.status]}</Badge>
            </div>
            {e.treatment_goals && <p className="text-sm"><span className="text-muted-foreground">Objetivos:</span> {e.treatment_goals}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Sesiones: {e.sessions_done}{e.planned_sessions ? ` de ${e.planned_sessions}` : ''}
              </span>
              {e.frequency && <span>Frecuencia: {e.frequency}</span>}
              <span>Desde {formatDayCO(e.opened_at)}</span>
            </div>
            {e.planned_sessions ? (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (e.sessions_done / e.planned_sessions) * 100)}%` }} />
              </div>
            ) : null}
          </div>
        ))}
        {closed.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:rotate-180">
              <ChevronDown className="w-4 h-4 transition-transform" />
              Tratamientos terminados ({closed.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {closed.map((e) => (
                <div key={e.id} className="rounded-lg border border-dashed p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-medium text-sm">{e.reason}</p>
                    <Badge variant="outline">{EPISODE_STATUS_LABEL[e.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDayCO(e.opened_at)} – {formatDayCO(e.closed_at)} · {e.sessions_done} sesiones
                  </p>
                  {e.discharge_summary && <p className="text-sm whitespace-pre-line">{e.discharge_summary}</p>}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </Section>
  );
}

// ── (d) Ejercicios de hoy ────────────────────────────────────────────────────
type Exercise = HealthSummaryPatient['exercises'][number];

function ExerciseItem({ ex, today, days }: { ex: Exercise; today: string; days: string[] }) {
  const qc = useQueryClient();
  const [pain, setPain] = useState<number | null>(null);
  const done = new Set(ex.done_dates.map((d) => d.slice(0, 10)));
  const doneToday = done.has(today);
  const notStarted = ex.start_date > today;
  const doneCount = days.filter((d) => done.has(d)).length;
  const pct = adherencePct(doneCount, ex.frequency_per_week, 14);

  const toggleM = useMutation({
    mutationFn: async (args: { undo: boolean; pain: number | null }) => {
      if (args.undo) await unlogExerciseDone(ex.assignment_id, today);
      else await logExerciseDone(ex.assignment_id, today, args.pain);
    },
    onSuccess: (_d, args) => {
      if (!args.undo) toast.success('¡Bien! Ejercicio registrado.');
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  const params = [
    ex.sets && ex.reps ? `${ex.sets} series × ${ex.reps} repeticiones` : ex.sets ? `${ex.sets} series` : ex.reps ? `${ex.reps} repeticiones` : null,
    ex.hold_seconds ? `sostener ${ex.hold_seconds} s` : null,
    `${ex.frequency_per_week} ${ex.frequency_per_week === 1 ? 'vez' : 'veces'} por semana`,
  ].filter(Boolean).join(' · ');

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', doneToday && 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm">{ex.name}</p>
          <p className="text-xs text-muted-foreground">{params}</p>
        </div>
        {ex.video_url && (
          <a href={ex.video_url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-xs text-primary font-medium">
            <PlayCircle className="w-4 h-4" />Video
          </a>
        )}
      </div>
      {ex.description && <p className="text-xs text-muted-foreground whitespace-pre-line">{ex.description}</p>}
      {ex.instructions && <p className="text-sm whitespace-pre-line"><span className="font-medium">Indicaciones:</span> {ex.instructions}</p>}
      {ex.end_date && <p className="text-xs text-muted-foreground">Hasta el {formatDayCO(ex.end_date)}</p>}

      {notStarted ? (
        <p className="text-xs text-muted-foreground">Empieza el {formatDayCO(ex.start_date)}.</p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">¿Cuánto dolor sentiste? (opcional, 0 = nada, 10 = máximo)</p>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    const next = pain === n ? null : n;
                    setPain(next);
                    if (doneToday && next !== null) toggleM.mutate({ undo: false, pain: next });
                  }}
                  className={cn(
                    'w-8 h-8 rounded-md border text-xs font-medium',
                    pain === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant={doneToday ? 'outline' : 'default'}
            className="w-full h-11"
            disabled={toggleM.isPending}
            onClick={() => toggleM.mutate({ undo: doneToday, pain })}
          >
            {toggleM.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : doneToday ? <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> : <Circle className="w-4 h-4 mr-2" />}
            {doneToday ? 'Hecho hoy (toca para desmarcar)' : 'Marcar hecho hoy'}
          </Button>
        </>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Últimos 14 días</span>
          <span>{doneCount} hechos · {pct}% de lo indicado</span>
        </div>
        <div className="flex gap-1">
          {days.map((d) => (
            <span
              key={d}
              title={formatDayCO(d)}
              className={cn('h-2.5 flex-1 rounded-full', done.has(d) ? 'bg-emerald-500' : 'bg-muted', d === today && 'ring-1 ring-primary/60')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Exercises({ patient, today, days }: { patient: HealthSummaryPatient; today: string; days: string[] }) {
  if (patient.exercises.length === 0) return null;
  return (
    <Section icon={Dumbbell} title="Ejercicios de hoy">
      <div className="space-y-2">
        {patient.exercises.map((ex) => <ExerciseItem key={ex.assignment_id} ex={ex} today={today} days={days} />)}
      </div>
    </Section>
  );
}

// ── (e) Próximas citas ───────────────────────────────────────────────────────
function Appointments({ patient }: { patient: HealthSummaryPatient }) {
  return (
    <Section icon={CalendarDays} title="Próximas citas">
      {patient.upcoming_appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay citas programadas.</p>
      ) : (
        <div className="space-y-2">
          {patient.upcoming_appointments.map((a) => (
            <div key={a.id} className="rounded-lg border p-3 flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium">{formatDayCO(a.date)} · {a.time?.slice(0, 5)}</p>
                <p className="text-xs text-muted-foreground">
                  {a.service_type} · {a.duration_minutes} min · {a.modality}{a.location ? ` · ${a.location}` : ''}
                </p>
                {a.meeting_url && (
                  <a href={a.meeting_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary">Enlace de la videollamada</a>
                )}
              </div>
              <Badge variant="outline" className={cn('shrink-0', APPOINTMENT_STATUS_TONE[a.status])}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
            </div>
          ))}
        </div>
      )}
      <Button asChild variant="link" className="px-0 h-auto">
        <Link to="/wellness/appointments">Ver todas mis citas</Link>
      </Button>
    </Section>
  );
}

// ── (f) Consentimientos vigentes ─────────────────────────────────────────────
const REVOKE_CONSEQUENCE: Record<ConsentType, string> = {
  datos_sensibles: 'El profesional ya no podrá registrar nuevas atenciones, lesiones ni ejercicios. Lo que ya está en la historia clínica se conserva, como exige la ley.',
  tratamiento: 'El profesional ya no podrá registrar nuevas atenciones ni asignar ejercicios. Lo que ya está en la historia clínica se conserva, como exige la ley.',
  compartir_disponibilidad: 'El entrenador y la escuela dejarán de ver si puede entrenar, las restricciones y la fecha de regreso.',
};

function ActiveConsents({ patient }: { patient: HealthSummaryPatient }) {
  const qc = useQueryClient();
  const [toRevoke, setToRevoke] = useState<HealthSummaryPatient['consents'][number] | null>(null);
  const revokeM = useMutation({
    mutationFn: (id: string) => revokeConsent(id),
    onSuccess: () => {
      toast.success('Autorización retirada.');
      setToRevoke(null);
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });
  if (patient.consents.length === 0) return null;
  return (
    <Section icon={ShieldCheck} title="Autorizaciones vigentes">
      <div className="space-y-2">
        {patient.consents.map((c) => (
          <div key={c.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{CONSENT_LABEL[c.type] ?? c.type}</p>
              <p className="text-xs text-muted-foreground">
                {formatDayCO(c.granted_at)} · por {c.granted_by} · v{c.version}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => setToRevoke(c)}>Revocar</Button>
          </div>
        ))}
      </div>
      <AlertDialog open={!!toRevoke} onOpenChange={(o) => !o && setToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar esta autorización?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRevoke ? REVOKE_CONSEQUENCE[toRevoke.type] : ''} Puedes volver a autorizar cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeM.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeM.isPending}
              onClick={(e) => { e.preventDefault(); if (toRevoke) revokeM.mutate(toRevoke.id); }}
            >
              {revokeM.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Retirar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

// ── Tarjeta por paciente ─────────────────────────────────────────────────────
function PatientCard({ patient, today, days }: { patient: HealthSummaryPatient; today: string; days: string[] }) {
  const pro = patient.professional;
  const wa = pro.phone ? whatsappLink(pro.phone) : null;
  const subtitle = [pro.practice, specialtyLabel(pro.specialty)].filter(Boolean).join(' · ');
  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="text-lg">
          {patient.patient_name}
          {patient.is_self ? <span className="text-sm font-normal text-muted-foreground"> (tú)</span> : null}
        </CardTitle>
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          {pro.avatar_url ? (
            <img src={pro.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{pro.name ?? 'Profesional de la salud'}</p>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
          {pro.phone && (
            <div className="flex gap-1 shrink-0">
              <Button asChild size="icon" variant="outline" className="h-9 w-9">
                <a href={`tel:${pro.phone.replace(/[^\d+]/g, '')}`} aria-label="Llamar"><Phone className="w-4 h-4" /></a>
              </Button>
              {wa && (
                <Button asChild size="icon" variant="outline" className="h-9 w-9">
                  <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp"><MessageCircle className="w-4 h-4" /></a>
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <PendingConsents patient={patient} />
        <Injuries patient={patient} />
        <Treatment patient={patient} />
        <Exercises patient={patient} today={today} days={days} />
        <Appointments patient={patient} />
        <ActiveConsents patient={patient} />
      </CardContent>
    </Card>
  );
}

export default function MyHealthPage() {
  const today = todayColombia();
  const days = useMemo(() => lastNDaysColombia(14), []);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: getMyHealthSummary,
  });

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><HeartPulse className="w-6 h-6 text-primary" />Mi salud</h1>
        <p className="text-sm text-muted-foreground">Tu plan con tu profesional de la salud: ejercicios, citas y recuperación.</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {clinicalErrorMessage(error)}
            <Button size="sm" variant="outline" onClick={() => refetch()}>Reintentar</Button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && (data ?? []).length === 0 && (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Stethoscope className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Todavía no tienes un plan de salud</p>
            <p className="text-sm text-muted-foreground">
              Cuando un profesional de la salud te atienda en SportMaps, aquí verás tu plan, tus ejercicios, tus citas y cómo va la recuperación.
            </p>
          </CardContent>
        </Card>
      )}

      {(data ?? []).map((p) => <PatientCard key={p.patient_id} patient={p} today={today} days={days} />)}
    </div>
  );
}
