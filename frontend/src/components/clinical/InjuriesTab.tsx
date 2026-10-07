import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle, Check, ChevronDown, Eye, EyeOff, History, Loader2, Lock, Plus, RotateCcw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDayCO, todayColombia } from '@/lib/dateUtils';
import { createInjury, listConsents, listInjuries, listInjuryEvents, updateInjury } from '@/lib/clinical/api';
import {
  AVAILABILITY_LABEL, AVAILABILITY_TONE, BODY_REGION_LABEL, RTP_STAGES, RTP_STAGE_LABEL, clinicalErrorMessage,
} from '@/lib/clinical/labels';
import { daysBetweenISO } from '@/lib/clinical/family-extra';
import {
  BODY_REGIONS, type AthleteInjury, type AvailabilityStatus, type BodyRegion, type ClinicalEpisode,
  type ClinicalPatient, type RtpStage,
} from '@/lib/clinical/types';

const SIDE_LABEL: Record<AthleteInjury['side'], string> = {
  izquierdo: 'Izquierdo', derecho: 'Derecho', bilateral: 'Bilateral', na: 'No aplica',
};
const TYPE_LABEL: Record<AthleteInjury['injury_type'], string> = {
  muscular: 'Muscular', ligamentosa: 'Ligamentosa', tendinosa: 'Tendinosa', osea: 'Ósea', articular: 'Articular',
  contusion: 'Contusión', meniscal: 'Meniscal', neurologica: 'Neurológica', conmocion: 'Conmoción', otra: 'Otra',
};
const MECHANISM_LABEL: Record<AthleteInjury['mechanism'], string> = {
  contacto: 'Con contacto', sin_contacto: 'Sin contacto', sobreuso: 'Sobreuso', desconocido: 'Desconocido',
};
const CONTEXT_LABEL: Record<AthleteInjury['context'], string> = {
  entrenamiento: 'Entrenamiento', partido: 'Partido', fuera_deporte: 'Fuera del deporte', desconocido: 'Desconocido',
};
const SEVERITY_LABEL: Record<AthleteInjury['severity'], string> = {
  minima: 'Mínima (1-3 días)', leve: 'Leve (4-7 días)', moderada: 'Moderada (8-28 días)', grave: 'Grave (> 28 días)',
};
const AVAILABILITY_OPTIONS: AvailabilityStatus[] = ['no_disponible', 'restringido', 'disponible'];

type Props = { patient: ClinicalPatient; episodes: ClinicalEpisode[]; canWrite: boolean };

function FieldSelect<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function entries<K extends string>(rec: Record<K, string>) {
  return (Object.keys(rec) as K[]).map((k) => ({ value: k, label: rec[k] }));
}

// ── Stepper de vuelta al juego ───────────────────────────────────────────────
function RtpStepper({ stage }: { stage: RtpStage }) {
  const idx = RTP_STAGES.indexOf(stage);
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {RTP_STAGES.map((s, i) => (
          <div key={s} className={cn('h-1.5 flex-1 rounded-full', i <= idx ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Etapa {idx + 1} de {RTP_STAGES.length}: <span className="font-medium text-foreground">{RTP_STAGE_LABEL[stage]}</span>
      </p>
    </div>
  );
}

// ── Crear lesión ─────────────────────────────────────────────────────────────
function CreateInjuryDialog({ open, onOpenChange, patient, episodes }: {
  open: boolean; onOpenChange: (o: boolean) => void; patient: ClinicalPatient; episodes: ClinicalEpisode[];
}) {
  const qc = useQueryClient();
  const openEpisodes = episodes.filter((e) => e.status === 'abierto');
  const empty = () => ({
    body_region: 'rodilla' as BodyRegion,
    side: 'na' as AthleteInjury['side'],
    injury_type: 'muscular' as AthleteInjury['injury_type'],
    mechanism: 'desconocido' as AthleteInjury['mechanism'],
    context: 'entrenamiento' as AthleteInjury['context'],
    severity: 'leve' as AthleteInjury['severity'],
    is_recurrence: false,
    occurred_on: todayColombia(),
    description: '',
    episode_id: openEpisodes.length === 1 ? openEpisodes[0].id : 'none',
    availability_status: 'no_disponible' as AvailabilityStatus,
    rtp_stage: 'reposo' as RtpStage,
    restrictions: '',
    expected_return: '',
  });
  const [f, setF] = useState(empty);
  const set = <K extends keyof ReturnType<typeof empty>>(k: K, v: ReturnType<typeof empty>[K]) => setF((s) => ({ ...s, [k]: v }));

  const today = todayColombia();
  const invalidDate = !f.occurred_on || f.occurred_on > today;
  const invalidReturn = !!f.expected_return && f.expected_return < f.occurred_on;

  const createM = useMutation({
    mutationFn: () => createInjury({
      patient_id: patient.id,
      episode_id: f.episode_id === 'none' ? null : f.episode_id,
      body_region: f.body_region,
      side: f.side,
      injury_type: f.injury_type,
      mechanism: f.mechanism,
      context: f.context,
      severity: f.severity,
      is_recurrence: f.is_recurrence,
      description: f.description.trim() || null,
      occurred_on: f.occurred_on,
      availability_status: f.availability_status,
      rtp_stage: f.rtp_stage,
      restrictions: f.restrictions.trim() || null,
      expected_return: f.expected_return || null,
    }),
    onSuccess: () => {
      toast.success('Lesión registrada.');
      qc.invalidateQueries({ queryKey: ['clinical', 'injuries', patient.id] });
      qc.invalidateQueries({ queryKey: ['clinical', 'active-injuries'] });
      setF(empty());
      onOpenChange(false);
    },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar lesión</DialogTitle>
          <DialogDescription>{patient.full_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldSelect label="Zona" value={f.body_region} onChange={(v) => set('body_region', v)}
              options={BODY_REGIONS.map((r) => ({ value: r, label: BODY_REGION_LABEL[r] }))} />
            <FieldSelect label="Lado" value={f.side} onChange={(v) => set('side', v)} options={entries(SIDE_LABEL)} />
            <FieldSelect label="Tipo" value={f.injury_type} onChange={(v) => set('injury_type', v)} options={entries(TYPE_LABEL)} />
            <FieldSelect label="Mecanismo" value={f.mechanism} onChange={(v) => set('mechanism', v)} options={entries(MECHANISM_LABEL)} />
            <FieldSelect label="Contexto" value={f.context} onChange={(v) => set('context', v)} options={entries(CONTEXT_LABEL)} />
            <FieldSelect label="Severidad" value={f.severity} onChange={(v) => set('severity', v)} options={entries(SEVERITY_LABEL)} />
            <div className="space-y-1.5">
              <Label htmlFor="inj-date">Fecha de la lesión</Label>
              <Input id="inj-date" type="date" max={today} value={f.occurred_on} onChange={(e) => set('occurred_on', e.target.value)} />
              {invalidDate && <p className="text-xs text-destructive">La fecha no puede ser futura.</p>}
            </div>
            <label className="flex items-center gap-2 text-sm sm:pt-7 cursor-pointer">
              <Checkbox checked={f.is_recurrence} onCheckedChange={(v) => set('is_recurrence', v === true)} />
              Es una recaída
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inj-desc">Descripción (privada, solo la ves tú)</Label>
            <Textarea id="inj-desc" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          {openEpisodes.length > 0 && (
            <FieldSelect label="Vincular a un episodio abierto (opcional)" value={f.episode_id} onChange={(v) => set('episode_id', v)}
              options={[{ value: 'none', label: 'Sin vincular' }, ...openEpisodes.map((e) => ({ value: e.id, label: e.reason }))]} />
          )}
          <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-medium flex items-center gap-2"><Eye className="w-4 h-4" />Estado inicial</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldSelect label="Disponibilidad" value={f.availability_status} onChange={(v) => set('availability_status', v)}
                options={AVAILABILITY_OPTIONS.map((a) => ({ value: a, label: AVAILABILITY_LABEL[a] }))} />
              <FieldSelect label="Etapa" value={f.rtp_stage} onChange={(v) => set('rtp_stage', v)}
                options={RTP_STAGES.map((s) => ({ value: s, label: RTP_STAGE_LABEL[s] }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inj-restr">Restricciones (visible para el entrenador)</Label>
              <Textarea id="inj-restr" rows={2} placeholder="Ej.: sin saltos ni cambios de dirección" value={f.restrictions}
                onChange={(e) => set('restrictions', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inj-ret">Regreso estimado</Label>
              <Input id="inj-ret" type="date" min={f.occurred_on} value={f.expected_return} onChange={(e) => set('expected_return', e.target.value)} />
              {invalidReturn && <p className="text-xs text-destructive">El regreso no puede ser antes de la lesión.</p>}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={invalidDate || invalidReturn || createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Historial ────────────────────────────────────────────────────────────────
function InjuryHistory({ injuryId }: { injuryId: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['clinical', 'injury-events', injuryId],
    queryFn: () => listInjuryEvents(injuryId),
    enabled: open,
  });
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground [&[data-state=open]>svg:last-child]:rotate-180">
        <History className="w-3.5 h-3.5" />Historial de cambios<ChevronDown className="w-3.5 h-3.5 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {q.isLoading && <Skeleton className="h-10 w-full" />}
        {q.error && <p className="text-xs text-destructive">{clinicalErrorMessage(q.error)}</p>}
        {q.data && q.data.length === 0 && <p className="text-xs text-muted-foreground">Sin cambios registrados.</p>}
        {q.data && q.data.length > 0 && (
          <ol className="space-y-1.5 border-l pl-3">
            {q.data.map((ev) => (
              <li key={ev.id} className="text-xs">
                <span className="text-muted-foreground">{format(parseISO(ev.created_at), "d MMM yyyy, h:mm a", { locale: es })}</span>
                {' · '}
                {ev.status === 'resuelta' ? 'Resuelta' : AVAILABILITY_LABEL[ev.availability_status as AvailabilityStatus] ?? ev.availability_status}
                {' · '}
                {RTP_STAGE_LABEL[ev.rtp_stage as RtpStage] ?? ev.rtp_stage}
                {ev.restrictions ? ` · ${ev.restrictions}` : ''}
                {ev.expected_return ? ` · regreso ${formatDayCO(ev.expected_return)}` : ''}
              </li>
            ))}
          </ol>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Panel de actualización ───────────────────────────────────────────────────
function UpdatePanel({ injury, patientId }: { injury: AthleteInjury; patientId: string }) {
  const qc = useQueryClient();
  const [stage, setStage] = useState<RtpStage>(injury.rtp_stage);
  const [availability, setAvailability] = useState<AvailabilityStatus>(injury.availability_status);
  const [restrictions, setRestrictions] = useState(injury.restrictions ?? '');
  const [expected, setExpected] = useState(injury.expected_return ?? '');
  const [confirmResolve, setConfirmResolve] = useState(false);

  const dirty = stage !== injury.rtp_stage || availability !== injury.availability_status
    || restrictions.trim() !== (injury.restrictions ?? '') || expected !== (injury.expected_return ?? '');
  const invalidReturn = !!expected && expected < injury.occurred_on;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['clinical', 'injuries', patientId] });
    qc.invalidateQueries({ queryKey: ['clinical', 'injury-events', injury.id] });
    qc.invalidateQueries({ queryKey: ['clinical', 'active-injuries'] });
  };

  const saveM = useMutation({
    mutationFn: () => updateInjury(injury.id, {
      rtp_stage: stage, availability_status: availability,
      restrictions: restrictions.trim() || null, expected_return: expected || null,
    }),
    onSuccess: () => { toast.success('Estado actualizado.'); invalidate(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });
  const resolveM = useMutation({
    mutationFn: () => updateInjury(injury.id, { status: 'resuelta' }),
    onSuccess: () => { toast.success('Lesión marcada como resuelta.'); setConfirmResolve(false); invalidate(); },
    onError: (e) => toast.error(clinicalErrorMessage(e)),
  });

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldSelect<RtpStage> label="Etapa" value={stage} onChange={setStage}
          options={RTP_STAGES.map((s) => ({ value: s, label: RTP_STAGE_LABEL[s] }))} />
        <FieldSelect<AvailabilityStatus> label="Disponibilidad" value={availability} onChange={setAvailability}
          options={AVAILABILITY_OPTIONS.map((a) => ({ value: a, label: AVAILABILITY_LABEL[a] }))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`restr-${injury.id}`}>Restricciones (visible para el entrenador)</Label>
        <Textarea id={`restr-${injury.id}`} rows={2} value={restrictions} onChange={(e) => setRestrictions(e.target.value)}
          placeholder="Ej.: puede trotar, sin contacto" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`ret-${injury.id}`}>Regreso estimado</Label>
        <Input id={`ret-${injury.id}`} type="date" min={injury.occurred_on} value={expected} onChange={(e) => setExpected(e.target.value)} />
        {invalidReturn && <p className="text-xs text-destructive">El regreso no puede ser antes de la lesión.</p>}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button className="flex-1" disabled={!dirty || invalidReturn || saveM.isPending} onClick={() => saveM.mutate()}>
          {saveM.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar cambios
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => setConfirmResolve(true)}>
          <Check className="w-4 h-4 mr-2" />Marcar resuelta
        </Button>
      </div>
      <AlertDialog open={confirmResolve} onOpenChange={setConfirmResolve}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar la lesión como resuelta?</AlertDialogTitle>
            <AlertDialogDescription>
              Quedará como disponible y apto para competir, con fecha de regreso hoy. El entrenador dejará de verla como restricción.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolveM.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={resolveM.isPending} onClick={(e) => { e.preventDefault(); resolveM.mutate(); }}>
              {resolveM.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Marcar resuelta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Tarjeta de lesión ────────────────────────────────────────────────────────
function InjuryCard({ injury, patientId, canWrite, episodes }: {
  injury: AthleteInjury; patientId: string; canWrite: boolean; episodes: ClinicalEpisode[];
}) {
  const [editing, setEditing] = useState(false);
  const active = injury.status === 'activa';
  const today = todayColombia();
  const since = daysBetweenISO(injury.occurred_on, today);
  const lost = injury.returned_on ? daysBetweenISO(injury.occurred_on, injury.returned_on) : null;
  const episode = injury.episode_id ? episodes.find((e) => e.id === injury.episode_id) : null;

  return (
    <Card className={cn(!active && 'opacity-80')}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">
              {BODY_REGION_LABEL[injury.body_region] ?? injury.body_region}
              {injury.side !== 'na' ? ` · ${SIDE_LABEL[injury.side]}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {TYPE_LABEL[injury.injury_type]} · {SEVERITY_LABEL[injury.severity]} · {CONTEXT_LABEL[injury.context]} · {MECHANISM_LABEL[injury.mechanism]}
              {injury.is_recurrence ? ' · Recaída' : ''}
            </p>
          </div>
          {active ? (
            <Badge variant="outline" className={cn('shrink-0', AVAILABILITY_TONE[injury.availability_status])}>
              {AVAILABILITY_LABEL[injury.availability_status]}
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">Resuelta</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Ocurrió el {formatDayCO(injury.occurred_on)}</span>
          {active ? <span>Hace {since} {since === 1 ? 'día' : 'días'}</span>
            : lost !== null && <span className="font-medium text-foreground">{lost} {lost === 1 ? 'día perdido' : 'días perdidos'}</span>}
          {active && injury.expected_return && <span>Regreso estimado: {formatDayCO(injury.expected_return)}</span>}
          {!active && injury.returned_on && <span>Regresó el {formatDayCO(injury.returned_on)}</span>}
          {episode && <span>Episodio: {episode.reason}</span>}
        </div>

        <RtpStepper stage={injury.rtp_stage} />

        {injury.restrictions && active && (
          <p className="text-sm rounded-md bg-muted/60 px-2 py-1.5"><span className="font-medium">Restricciones:</span> {injury.restrictions}</p>
        )}
        {injury.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{injury.description}</p>}

        {active && canWrite && (
          editing
            ? <UpdatePanel injury={injury} patientId={patientId} />
            : <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setEditing(true)}>
                <RotateCcw className="w-4 h-4 mr-2" />Actualizar estado
              </Button>
        )}

        <InjuryHistory injuryId={injury.id} />
      </CardContent>
    </Card>
  );
}

export function InjuriesTab({ patient, episodes, canWrite }: Props) {
  const [creating, setCreating] = useState(false);
  const injuriesQ = useQuery({
    queryKey: ['clinical', 'injuries', patient.id],
    queryFn: () => listInjuries(patient.id),
  });
  const consentsQ = useQuery({
    queryKey: ['clinical', 'consents', patient.id],
    queryFn: () => listConsents(patient.id),
  });

  const shares = (consentsQ.data ?? []).some((c) => c.consent_type === 'compartir_disponibilidad' && !c.revoked_at);
  const injuries = injuriesQ.data ?? [];
  const active = injuries.filter((i) => i.status === 'activa');
  const resolved = injuries.filter((i) => i.status !== 'activa');

  return (
    <div className="space-y-4">
      {!canWrite && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Solo lectura: falta el consentimiento del paciente (o de su acudiente) para datos de salud y tratamiento.
            Cuando lo autorice podrás registrar y actualizar lesiones.
          </AlertDescription>
        </Alert>
      )}

      {!consentsQ.isLoading && (
        shares ? (
          <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
            <Eye className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-sm">
              La familia autorizó compartir la disponibilidad con la escuela. El entrenador ve el estado, la etapa,
              las restricciones y la fecha de regreso de las lesiones activas. Nunca el diagnóstico ni la descripción.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <EyeOff className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm">
              No hay autorización para compartir la disponibilidad con la escuela: el entrenador no verá estas lesiones.
              El paciente o su acudiente puede autorizarlo desde «Mi salud».
            </AlertDescription>
          </Alert>
        )
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Lesiones {active.length > 0 && <span className="text-muted-foreground font-normal">({active.length} activas)</span>}</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1" />Registrar lesión</Button>
        )}
      </div>

      {injuriesQ.isLoading && <div className="space-y-2"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>}

      {injuriesQ.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {clinicalErrorMessage(injuriesQ.error)}
            <Button size="sm" variant="outline" onClick={() => injuriesQ.refetch()}>Reintentar</Button>
          </AlertDescription>
        </Alert>
      )}

      {!injuriesQ.isLoading && !injuriesQ.error && injuries.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No hay lesiones registradas.</CardContent></Card>
      )}

      <div className="space-y-3">
        {active.map((i) => <InjuryCard key={i.id} injury={i} patientId={patient.id} canWrite={canWrite} episodes={episodes} />)}
      </div>

      {resolved.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:rotate-180">
            <ChevronDown className="w-4 h-4 transition-transform" />Lesiones resueltas ({resolved.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            {resolved.map((i) => <InjuryCard key={i.id} injury={i} patientId={patient.id} canWrite={canWrite} episodes={episodes} />)}
          </CollapsibleContent>
        </Collapsible>
      )}

      {canWrite && <CreateInjuryDialog open={creating} onOpenChange={setCreating} patient={patient} episodes={episodes} />}
    </div>
  );
}

export default InjuriesTab;
